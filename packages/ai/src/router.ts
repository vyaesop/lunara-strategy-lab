import type { AIProviderId, AITask } from "@lunara/schemas";
import type { z } from "zod";
import { AIError, isAIError } from "./errors";
import { generateStructured, type StructuredResult } from "./structured";
import type {
  AIProvider,
  ChatMessage,
  GenerateResult,
  ProviderConfig,
  RouteTarget,
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

  /**
   * Ordered targets for a task: primary, then `fallback`, then `fallbacks`,
   * deduplicated and limited to configured providers. With private user
   * content, only providers approved for it are kept.
   */
  chain(task: AITask, containsUserContent = false): RouteTarget[] {
    const route = this.route(task);
    const all: RouteTarget[] = [
      { provider: route.provider, model: route.model },
      ...(route.fallback ? [route.fallback] : []),
      ...(route.fallbacks ?? []),
    ];
    const seen = new Set<string>();
    return all.filter((t) => {
      const key = `${t.provider}:${t.model}`;
      if (seen.has(key) || !this.providers.has(t.provider)) return false;
      seen.add(key);
      return !containsUserContent || (this.providerConfigs[t.provider]?.allowsUserContent ?? false);
    });
  }

  /** Whether any target for a task may receive private user content. */
  allowsUserContent(task: AITask): boolean {
    return this.chain(task, true).length > 0;
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
    const targets = this.chain(task, call.containsUserContent ?? false);
    if (targets.length === 0) {
      throw new AIError(
        "user_content_not_allowed",
        `No route for ${task} (${route.provider}) is approved for private user content`,
      );
    }
    const primary = { provider: route.provider, model: route.model };
    let lastError: unknown;
    for (const [index, target] of targets.entries()) {
      const isPrimary = target.provider === primary.provider && target.model === primary.model;
      // The primary gets bounded retries; each fallback gets one attempt.
      const attempts = isPrimary ? this.maxRetries + 1 : 1;
      for (let i = 0; i < attempts; i++) {
        try {
          const r = await this.attempt(task, target, messages, route, call);
          return { ...r, task, usedFallback: index > 0 || !isPrimary };
        } catch (err) {
          lastError = err;
          if (call.signal?.aborted) throw err;
          // Rate limits go straight to the next target: an instant retry only burns quota.
          if (!(isAIError(err) && err.retryable) || err.code === "rate_limited") break;
        }
      }
    }
    throw lastError;
  }

  async generateStructured<S extends z.ZodType>(
    task: AITask,
    schema: S,
    messages: ChatMessage[],
    call: CallOptions = {},
  ): Promise<StructuredResult<z.infer<S>> & { task: AITask; usedFallback: boolean }> {
    const route = this.route(task);
    const targets = this.chain(task, call.containsUserContent ?? false);
    if (targets.length === 0) {
      throw new AIError("user_content_not_allowed", `No route for ${task} is approved for private user content`);
    }
    let lastError: unknown;
    for (const [index, target] of targets.entries()) {
      try {
        const r = await this.structuredAttempt(task, schema, target, messages, route, call);
        return { ...r, task, usedFallback: index > 0 };
      } catch (err) {
        lastError = err;
        if (call.signal?.aborted) throw err;
        // Any failure (throttling, outage, invalid JSON after repair) moves to the next target.
      }
    }
    throw lastError;
  }

  private async structuredAttempt<S extends z.ZodType>(
    task: AITask,
    schema: S,
    target: RouteTarget,
    messages: ChatMessage[],
    route: TaskRoute,
    call: CallOptions,
  ): Promise<StructuredResult<z.infer<S>>> {
    const provider = this.provider(target.provider);
    const { signal, clear } = withTimeout(call.signal, route.timeoutMs ?? this.defaultTimeoutMs);
    const started = Date.now();
    try {
      const result = await generateStructured(provider, schema, {
        model: target.model,
        messages,
        temperature: call.temperature ?? route.temperature ?? 0.2,
        maxOutputTokens: call.maxOutputTokens ?? route.maxOutputTokens,
        signal,
      });
      for (const c of result.calls) {
        await this.record({
          task,
          provider: target.provider,
          model: target.model,
          usage: c.usage,
          latencyMs: Math.round((Date.now() - started) / result.calls.length),
          estimatedCostUsd: estimateCost(provider, target.model, c.usage),
          ok: true,
          errorCode: null,
        });
      }
      return result;
    } catch (err) {
      await this.record({
        task,
        provider: target.provider,
        model: target.model,
        usage: { inputTokens: 0, outputTokens: 0 },
        latencyMs: Date.now() - started,
        estimatedCostUsd: 0,
        ok: false,
        errorCode: signal.aborted ? "timeout" : isAIError(err) ? err.code : "provider_error",
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
