import { AIError, errorFromStatus } from "../errors";
import type {
  AIProvider,
  ChatMessage,
  EmbedResult,
  GenerateOptions,
  GenerateResult,
  ModelCapabilities,
} from "../types";

/**
 * Google AI Studio (Gemini API) over the REST `generateContent` endpoint.
 * The key travels in a header, never in the URL, so it stays out of logs.
 */
export interface GeminiOptions {
  apiKey: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  capabilities?: Partial<Record<string, Partial<ModelCapabilities>>>;
}

const DEFAULT_CAPS: ModelCapabilities = {
  structuredOutput: true,
  streaming: true,
  embeddings: true,
  contextTokens: null,
  pricePer1MInputUsd: null,
  pricePer1MOutputUsd: null,
};

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>;
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
}

function toGeminiBody(messages: ChatMessage[], options: GenerateOptions) {
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
  const generationConfig: Record<string, unknown> = {
    temperature: options.temperature ?? 0.4,
    maxOutputTokens: options.maxOutputTokens ?? 1024,
  };
  if (options.jsonMode) generationConfig.responseMimeType = "application/json";
  return {
    ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
    contents,
    generationConfig,
  };
}

export class GeminiProvider implements AIProvider {
  readonly id = "gemini" as const;
  readonly name = "Google Gemini (AI Studio)";
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly caps: Partial<Record<string, Partial<ModelCapabilities>>>;

  constructor(options: GeminiOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? "https://generativelanguage.googleapis.com/v1beta").replace(/\/+$/, "");
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.caps = options.capabilities ?? {};
  }

  capabilities(model: string): ModelCapabilities {
    return { ...DEFAULT_CAPS, ...(this.caps[model] ?? {}) };
  }

  private async post<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": this.apiKey },
        body: JSON.stringify(body),
        ...(signal ? { signal } : {}),
      });
    } catch (cause) {
      if (signal?.aborted) throw new AIError("timeout", "Gemini request aborted", { retryable: true, cause });
      throw new AIError("provider_unavailable", "Gemini unreachable", { retryable: true, cause });
    }
    if (!res.ok) throw errorFromStatus(res.status, this.name);
    try {
      return (await res.json()) as T;
    } catch (cause) {
      throw new AIError("invalid_response", "Gemini returned non-JSON", { cause });
    }
  }

  async generate(options: GenerateOptions): Promise<GenerateResult> {
    const data = await this.post<GeminiResponse>(
      `/models/${encodeURIComponent(options.model)}:generateContent`,
      toGeminiBody(options.messages, options),
      options.signal,
    );
    const candidate = data.candidates?.[0];
    if (!candidate) throw new AIError("invalid_response", "Gemini returned no candidates");
    const text = (candidate.content?.parts ?? []).map((p) => p.text ?? "").join("");
    const fr = candidate.finishReason;
    return {
      text,
      usage: {
        inputTokens: data.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
      },
      model: options.model,
      provider: "gemini",
      finishReason: fr === "STOP" ? "stop" : fr === "MAX_TOKENS" ? "length" : fr === "SAFETY" ? "content_filter" : "other",
    };
  }

  async *stream(options: GenerateOptions): AsyncIterable<string> {
    const res = await this.fetchImpl(
      `${this.baseUrl}/models/${encodeURIComponent(options.model)}:streamGenerateContent?alt=sse`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": this.apiKey },
        body: JSON.stringify(toGeminiBody(options.messages, options)),
        ...(options.signal ? { signal: options.signal } : {}),
      },
    );
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
        try {
          const json = JSON.parse(trimmed.slice(5).trim()) as GeminiResponse;
          const text = (json.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("");
          if (text) yield text;
        } catch {
          // ignore partial lines
        }
      }
    }
  }

  async embed(input: string[], model: string, signal?: AbortSignal): Promise<EmbedResult> {
    const data = await this.post<{ embeddings?: Array<{ values?: number[] }> }>(
      `/models/${encodeURIComponent(model)}:batchEmbedContents`,
      { requests: input.map((text) => ({ model: `models/${model}`, content: { parts: [{ text }] } })) },
      signal,
    );
    const vectors = (data.embeddings ?? []).map((e) => e.values ?? []);
    if (vectors.length !== input.length) throw new AIError("invalid_response", "Gemini returned wrong embedding count");
    return { vectors, usage: { inputTokens: 0, outputTokens: 0 }, model, provider: "gemini" };
  }
}
