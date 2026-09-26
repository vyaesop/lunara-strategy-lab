import type { AIProviderId } from "@lunara/schemas";
import { AIError, errorFromStatus } from "../errors";
import type { AIProvider, EmbedResult, GenerateOptions, GenerateResult, ModelCapabilities } from "../types";

/**
 * Adapter for any OpenAI-style `/chat/completions` endpoint: Groq,
 * OpenRouter, Ollama (`/v1`) and self-hosted gateways. Uses `fetch` only.
 */
export interface OpenAICompatibleOptions {
  id: AIProviderId;
  name: string;
  baseUrl: string;
  apiKey?: string;
  headers?: Record<string, string>;
  capabilities?: Partial<Record<string, Partial<ModelCapabilities>>>;
  fetchImpl?: typeof fetch;
}

const DEFAULT_CAPS: ModelCapabilities = {
  structuredOutput: true,
  streaming: true,
  embeddings: false,
  contextTokens: null,
  pricePer1MInputUsd: null,
  pricePer1MOutputUsd: null,
};

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string | null }; finish_reason?: string | null }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  model?: string;
  /** Some gateways (OpenRouter) report upstream failures in a 200 body. */
  error?: { code?: number | string; message?: string };
}

interface EmbeddingResponse {
  data?: Array<{ embedding?: number[] }>;
  usage?: { prompt_tokens?: number };
  model?: string;
}

export class OpenAICompatibleProvider implements AIProvider {
  readonly id: AIProviderId;
  readonly name: string;
  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;
  private readonly headers: Record<string, string>;
  private readonly caps: Partial<Record<string, Partial<ModelCapabilities>>>;
  private readonly fetchImpl: typeof fetch;

  constructor(options: OpenAICompatibleOptions) {
    this.id = options.id;
    this.name = options.name;
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.apiKey = options.apiKey;
    this.headers = options.headers ?? {};
    this.caps = options.capabilities ?? {};
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  capabilities(model: string): ModelCapabilities {
    return { ...DEFAULT_CAPS, ...(this.caps[model] ?? {}) };
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = { "content-type": "application/json", ...this.headers };
    if (this.apiKey) headers.authorization = `Bearer ${this.apiKey}`;
    return headers;
  }

  private async post<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method: "POST",
        headers: this.buildHeaders(),
        body: JSON.stringify(body),
        ...(signal ? { signal } : {}),
      });
    } catch (cause) {
      if (signal?.aborted) throw new AIError("timeout", `${this.name} request aborted`, { retryable: true, cause });
      throw new AIError("provider_unavailable", `${this.name} unreachable`, { retryable: true, cause });
    }
    if (!res.ok) throw errorFromStatus(res.status, this.name);
    try {
      return (await res.json()) as T;
    } catch (cause) {
      throw new AIError("invalid_response", `${this.name} returned non-JSON`, { cause });
    }
  }

  async generate(options: GenerateOptions): Promise<GenerateResult> {
    const body: Record<string, unknown> = {
      model: options.model,
      messages: options.messages,
      temperature: options.temperature ?? 0.4,
      max_tokens: options.maxOutputTokens ?? 1024,
      stream: false,
    };
    if (options.jsonMode) body.response_format = { type: "json_object" };
    const data = await this.post<ChatCompletionResponse>("/chat/completions", body, options.signal);
    const choice = data.choices?.[0];
    if (!choice) {
      if (data.error) {
        const rateLimited = String(data.error.code) === "429";
        throw new AIError(rateLimited ? "rate_limited" : "provider_unavailable", `${this.name}: ${data.error.message ?? "upstream error"}`, { retryable: true });
      }
      throw new AIError("invalid_response", `${this.name} returned no choices`);
    }
    const finish = choice.finish_reason;
    return {
      text: choice.message?.content ?? "",
      usage: {
        inputTokens: data.usage?.prompt_tokens ?? 0,
        outputTokens: data.usage?.completion_tokens ?? 0,
      },
      model: data.model ?? options.model,
      provider: this.id,
      finishReason:
        finish === "stop" ? "stop" : finish === "length" ? "length" : finish === "content_filter" ? "content_filter" : "other",
    };
  }

  async *stream(options: GenerateOptions): AsyncIterable<string> {
    const body = {
      model: options.model,
      messages: options.messages,
      temperature: options.temperature ?? 0.4,
      max_tokens: options.maxOutputTokens ?? 1024,
      stream: true,
    };
    const res = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: this.buildHeaders(),
      body: JSON.stringify(body),
      ...(options.signal ? { signal: options.signal } : {}),
    });
    if (!res.ok || !res.body) throw errorFromStatus(res.status, this.name);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === "[DONE]") return;
        try {
          const json = JSON.parse(payload) as { choices?: Array<{ delta?: { content?: string } }> };
          const delta = json.choices?.[0]?.delta?.content;
          if (delta) yield delta;
        } catch {
          // ignore keep-alive or partial lines
        }
      }
    }
  }

  async embed(input: string[], model: string, signal?: AbortSignal): Promise<EmbedResult> {
    const data = await this.post<EmbeddingResponse>("/embeddings", { model, input }, signal);
    const vectors = (data.data ?? []).map((d) => d.embedding ?? []);
    if (vectors.length !== input.length) {
      throw new AIError("invalid_response", `${this.name} returned wrong embedding count`);
    }
    return {
      vectors,
      usage: { inputTokens: data.usage?.prompt_tokens ?? 0, outputTokens: 0 },
      model: data.model ?? model,
      provider: this.id,
    };
  }
}
