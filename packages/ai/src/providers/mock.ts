import type { AIProvider, EmbedResult, GenerateOptions, GenerateResult, ModelCapabilities } from "../types";

/**
 * Deterministic provider for tests and for environments with no keys.
 * A `scripted` handler lets tests control exact output per call.
 */
export interface MockProviderOptions {
  scripted?: (options: GenerateOptions, callIndex: number) => string | undefined;
  latencyMs?: number;
}

const approxTokens = (s: string) => Math.max(1, Math.ceil(s.length / 4));

export class MockProvider implements AIProvider {
  readonly id = "mock" as const;
  readonly name = "Mock (deterministic)";
  private calls = 0;
  readonly log: GenerateOptions[] = [];

  constructor(private readonly options: MockProviderOptions = {}) {}

  capabilities(): ModelCapabilities {
    return {
      structuredOutput: true,
      streaming: true,
      embeddings: true,
      contextTokens: 32_000,
      pricePer1MInputUsd: 0,
      pricePer1MOutputUsd: 0,
    };
  }

  private produce(options: GenerateOptions): string {
    const idx = this.calls++;
    this.log.push(options);
    const scripted = this.options.scripted?.(options, idx);
    if (scripted !== undefined) return scripted;
    const lastUser = [...options.messages].reverse().find((m) => m.role === "user")?.content ?? "";
    if (options.jsonMode) {
      // Structured tasks embed a valid example after an EXAMPLE_JSON: marker; echo it so the
      // whole pipeline (validation, persistence, scoring) runs deterministically without a model.
      const system = options.messages.filter((m) => m.role === "system").map((m) => m.content).join("\n");
      const marker = system.lastIndexOf("EXAMPLE_JSON:");
      if (marker !== -1) {
        const after = system.slice(marker + "EXAMPLE_JSON:".length);
        const end = after.indexOf("\nEND_EXAMPLE_JSON");
        return (end === -1 ? after : after.slice(0, end)).trim();
      }
      return JSON.stringify({ mock: true, echo: lastUser.slice(0, 200), call: idx });
    }
    return `[mock coach] Before I respond: what do you already know for certain here, and what are you assuming? (You said: "${lastUser.slice(0, 120)}")`;
  }

  async generate(options: GenerateOptions): Promise<GenerateResult> {
    if (this.options.latencyMs) await new Promise((r) => setTimeout(r, this.options.latencyMs));
    const text = this.produce(options);
    const inputTokens = options.messages.reduce((a, m) => a + approxTokens(m.content), 0);
    return {
      text,
      usage: { inputTokens, outputTokens: approxTokens(text) },
      model: options.model,
      provider: "mock",
      finishReason: "stop",
    };
  }

  async *stream(options: GenerateOptions): AsyncIterable<string> {
    const { text } = await this.generate(options);
    for (const chunk of text.split(/(\s+)/)) {
      if (chunk) yield chunk;
    }
  }

  async embed(input: string[], model: string): Promise<EmbedResult> {
    const vectors = input.map((s) => {
      const v = new Array<number>(8).fill(0);
      for (let i = 0; i < s.length; i++) v[i % 8] = (v[i % 8] ?? 0) + s.charCodeAt(i) / 1000;
      const norm = Math.sqrt(v.reduce((a, b) => a + b * b, 0)) || 1;
      return v.map((x) => x / norm);
    });
    return {
      vectors,
      usage: { inputTokens: input.reduce((a, s) => a + approxTokens(s), 0), outputTokens: 0 },
      model,
      provider: "mock",
    };
  }
}
