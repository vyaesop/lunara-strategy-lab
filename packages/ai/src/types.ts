import type { AIProviderId, AITask } from "@lunara/schemas";

export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface GenerateOptions {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxOutputTokens?: number;
  /** Ask the provider for JSON output when it supports it. */
  jsonMode?: boolean;
  signal?: AbortSignal;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface GenerateResult {
  text: string;
  usage: TokenUsage;
  model: string;
  provider: AIProviderId;
  finishReason: "stop" | "length" | "content_filter" | "other";
}

export interface EmbedResult {
  vectors: number[][];
  usage: TokenUsage;
  model: string;
  provider: AIProviderId;
}

export interface ModelCapabilities {
  /** Provider claims native JSON output. We validate locally regardless. */
  structuredOutput: boolean;
  streaming: boolean;
  embeddings: boolean;
  contextTokens: number | null;
  /** USD per 1M tokens when known; used for estimates only. */
  pricePer1MInputUsd: number | null;
  pricePer1MOutputUsd: number | null;
}

export interface AIProvider {
  readonly id: AIProviderId;
  readonly name: string;
  capabilities(model: string): ModelCapabilities;
  generate(options: GenerateOptions): Promise<GenerateResult>;
  stream(options: GenerateOptions): AsyncIterable<string>;
  embed?(input: string[], model: string, signal?: AbortSignal): Promise<EmbedResult>;
}

export interface TaskRoute {
  provider: AIProviderId;
  model: string;
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
  /** Explicit fallback only; the router never escalates silently. */
  fallback?: { provider: AIProviderId; model: string } | null;
}

export type RoutingTable = Record<AITask, TaskRoute>;

export interface ProviderConfig {
  id: AIProviderId;
  baseUrl?: string;
  apiKey?: string;
  /** Whether private user-authored content may be sent here (docs/AI_PROVIDERS.md). */
  allowsUserContent: boolean;
}

export interface UsageEvent {
  task: AITask;
  provider: AIProviderId;
  model: string;
  usage: TokenUsage;
  latencyMs: number;
  estimatedCostUsd: number;
  ok: boolean;
  errorCode: string | null;
}

export interface UsageSink {
  record(event: UsageEvent): Promise<void> | void;
}
