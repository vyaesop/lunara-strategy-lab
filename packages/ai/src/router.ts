import type { AIProviderId, AITask } from "@lunara/schemas";
import type { z } from "zod";
import { AIError, isAIError } from "./errors";
import { generateStructured, type StructuredResult } from "./structured";
import type {
  AIProvider,
  ChatMessage,
  GenerateResult,
  ProviderConfig,
  RoutingTable,
  TaskRoute,
  UsageEvent,
  UsageSink,
} from "./types";

export interface RouterOptions {
  providers: Map<AIProviderId, AIProvider>;
  providerConfigs: Partial<Record<AIProviderId, ProviderConfig>>;
  routes: RoutingTable;
  usageSink?: UsageSink;
  defaultTimeoutMs?: number;
  /** Retries on retryable errors before trying the configured fallback. */
  maxRetries?: number;
}

export interface CallOptions {
  temperature?: number;
  maxOutputTokens?: number;
  /** Declare that the messages include private user-authored content. */
  containsUserContent?: boolean;
  signal?: AbortSignal;
}

export interface RoutedResult extends GenerateResult {
  task: AITask;
  usedFallback: boolean;
}

const DEFAULT_TIMEOUT_MS = 30_000;

function estimateCost(provider: AIProvider, model: string, usage: { inputTokens: number; outputTokens: number }): number {
  const caps = provider.capabilities(model);
  const inCost = caps.pricePer1MInputUsd ?? 0;
  const outCost = caps.pricePer1MOutputUsd ?? 0;
  return (usage.inputTokens / 1_000_000) * inCost + (usage.outputTokens / 1_000_000) * outCost;
}

function withTimeout(signal: AbortSignal | undefined, timeoutMs: number): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("timeout")), timeoutMs);
  const onAbort = () => controller.abort(signal?.reason);
  signal?.addEventListener("abort", onAbort, { once: true });
  return {
    signal: controller.signal,
    clear: () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    },
  };
}

/**
 * Task-based model router. Resolves a task to a provider + model, applies
 * timeout, bounded retries and an explicit fallback, and records usage for
 * every attempt. Never escalates to an unconfigured route.
 */
export class ModelRouter {
  private readonly providers: Map<AIProviderId, AIProvider>;
  private readonly providerConfigs: Partial<Record<AIProviderId, ProviderConfig>>;
  private readonly routes: RoutingTable;
  private readonly usageSink: UsageSink | undefined;
  private readonly defaultTimeoutMs: number;
  private readonly maxRetries: number;

  constructor(options: RouterOptions) {
    this.providers = options.providers;
    this.providerConfigs = options.providerConfigs;
    this.routes = options.routes;
    this.usageSink = options.usageSink;
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxRetries = options.maxRetries ?? 1;
  }

  route(task: AITask): TaskRoute {
    return this.routes[task];
  }

  provider(id: AIProviderId): AIProvider {
    const p = this.providers.get(id);
    if (!p) throw new AIError("not_configured", `Provider ${id} is not configured`);
    return p;
  }

  /** Whether the route for a task may receive private user content. */
  allowsUserContent(task: AITask): boolean {
    const route = this.route(task);
    return this.providerConfigs[route.provider]?.allowsUserContent ?? false;
  }

  private async attempt(
    task: AITask,
    target: { provider: AIProviderId; model: string },
    messages: ChatMessage[],
    route: TaskRoute,
    call: CallOptions,
  ): Promise<GenerateResult> {
    const provider = this.provider(target.provider);
    const { signal, clear } = withTimeout(call.signal, route.timeoutMs ?? this.defaultTimeoutMs);
    const started = Date.now();
    try {
      const result = await provider.generate({
        model: target.model,
        messages,
        temperature: call.temperature ?? route.temperature,
        maxOutputTokens: call.maxOutputTokens ?? route.maxOutputTokens,
        signal,
      });
      await this.record({
        task,
        provider: target.provider,
        model: target.model,
        usage: result.usage,
        latencyMs: Date.now() - started,
        estimatedCostUsd: estimateCost(provider, target.model, result.usage),
        ok: true,
        errorCode: null,
      });
      return result;
    } catch (err) {
      const code = isAIError(err) ? err.code : "provider_error";
      await this.record({
        task,
        provider: target.provider,
        model: target.model,
        usage: { inputTokens: 0, outputTokens: 0 },
        latencyMs: Date.now() - started,
        estimatedCostUsd: 0,
        ok: false,
        errorCode: signal.aborted ? "timeout" : code,
      });
      if (signal.aborted && !isAIError(err)) {
        throw new AIError("timeout", `${provider.name} timed out`, { retryable: true, cause: err });
      }
      throw err;
    } finally {
      clear();
    }
  }

  async generate(task: AITask, messages: ChatMessage[], call: CallOptions = {}): Promise<RoutedResult> {
    const route = this.route(task);
    if (call.containsUserContent && !this.allowsUserContent(task)) {
      throw new AIError(
        "user_content_not_allowed",
        `Route for ${task} (${route.provider}) is not approved for private user content`,
      );
    }
    const primary = { provider: route.provider, model: route.model };
    let lastError: unknown;
    for (let i = 0; i <= this.maxRetries; i++) {
      try {
        const r = await this.attempt(task, primary, messages, route, call);
        return { ...r, task, usedFallback: false };
      } catch (err) {
        lastError = err;
        if (!(isAIError(err) && err.retryable)) break;
      }
    }
    if (route.fallback && this.providers.has(route.fallback.provider)) {
      if (call.containsUserContent && !(this.providerConfigs[route.fallback.provider]?.allowsUserContent ?? false)) {
        throw lastError;
      }
      const r = await this.attempt(task, route.fallback, messages, route, call);
      return { ...r, task, usedFallback: true };
    }
    throw lastError;
  }

  async generateStructured<S extends z.ZodType>(
    task: AITask,
    schema: S,
    messages: ChatMessage[],
    call: CallOptions = {},
  ): Promise<StructuredResult<z.infer<S>> & { task: AITask }> {
    const route = this.route(task);
    if (call.containsUserContent && !this.allowsUserContent(task)) {
      throw new AIError("user_content_not_allowed", `Route for ${task} is not approved for private user content`);
    }
    const provider = this.provider(route.provider);
    const { signal, clear } = withTimeout(call.signal, route.timeoutMs ?? this.defaultTimeoutMs);
    const started = Date.now();
    try {
      const result = await generateStructured(provider, schema, {
        model: route.model,
        messages,
        temperature: call.temperature ?? route.temperature ?? 0.2,
        maxOutputTokens: call.maxOutputTokens ?? route.maxOutputTokens,
        signal,
      });
      for (const c of result.calls) {
        await this.record({
          task,
          provider: route.provider,
          model: route.model,
          usage: c.usage,
          latencyMs: Math.round((Date.now() - started) / result.calls.length),
          estimatedCostUsd: estimateCost(provider, route.model, c.usage),
          ok: true,
          errorCode: null,
        });
      }
      return { ...result, task };
    } catch (err) {
      await this.record({
        task,
        provider: route.provider,
        model: route.model,
        usage: { inputTokens: 0, outputTokens: 0 },
        latencyMs: Date.now() - started,
        estimatedCostUsd: 0,
        ok: false,
        errorCode: isAIError(err) ? err.code : "provider_error",
      });
      throw err;
    } finally {
      clear();
    }
  }

  async embed(input: string[], call: CallOptions = {}): Promise<number[][]> {
    const route = this.route("embed");
    const provider = this.provider(route.provider);
    if (!provider.embed) throw new AIError("unsupported_capability", `${provider.name} has no embeddings`);
    if (call.containsUserContent && !this.allowsUserContent("embed")) {
      throw new AIError("user_content_not_allowed", "Embedding route is not approved for private user content");
    }
    const { signal, clear } = withTimeout(call.signal, route.timeoutMs ?? this.defaultTimeoutMs);
    const started = Date.now();
    try {
      const r = await provider.embed(input, route.model, signal);
      await this.record({
        task: "embed",
        provider: route.provider,
        model: route.model,
        usage: r.usage,
        latencyMs: Date.now() - started,
        estimatedCostUsd: estimateCost(provider, route.model, r.usage),
        ok: true,
        errorCode: null,
      });
      return r.vectors;
    } finally {
      clear();
    }
  }

  private async record(event: UsageEvent): Promise<void> {
    if (!this.usageSink) return;
    try {
      await this.usageSink.record(event);
    } catch {
      // usage accounting must never break a request
    }
  }
}
