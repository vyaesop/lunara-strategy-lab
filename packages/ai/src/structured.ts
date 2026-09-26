import type { z } from "zod";
import { AIError } from "./errors";
import type { AIProvider, GenerateOptions, GenerateResult } from "./types";

/**
 * Structured generation with local validation. Works with any provider: ask
 * for JSON, extract the first JSON object, validate with Zod, and on failure
 * make at most `repairAttempts` bounded repair calls that feed the validation
 * errors back to the model.
 */
export interface StructuredResult<T> {
  value: T;
  raw: GenerateResult;
  repaired: boolean;
  /** Every provider call made, for usage accounting. */
  calls: GenerateResult[];
}

export function extractJson(text: string): string | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] ?? text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  return candidate.slice(start, end + 1);
}

export async function generateStructured<S extends z.ZodType>(
  provider: AIProvider,
  schema: S,
  options: GenerateOptions,
  repairAttempts = 1,
): Promise<StructuredResult<z.infer<S>>> {
  const calls: GenerateResult[] = [];
  let raw = await provider.generate({ ...options, jsonMode: true });
  calls.push(raw);
  let lastError = "";
  for (let attempt = 0; ; attempt++) {
    const json = extractJson(raw.text);
    if (json === null) {
      lastError = "No JSON object found in response.";
    } else {
      let parsed: unknown;
      let parseOk = true;
      try {
        parsed = JSON.parse(json);
      } catch {
        parseOk = false;
        lastError = "Response was not valid JSON.";
      }
      if (parseOk) {
        const result = schema.safeParse(parsed);
        if (result.success) return { value: result.data, raw, repaired: attempt > 0, calls };
        lastError = result.error.issues
          .slice(0, 8)
          .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
          .join("; ");
      }
    }
    if (attempt >= repairAttempts) {
      throw new AIError(
        "structured_output_invalid",
        `Structured output invalid after ${attempt + 1} attempt(s): ${lastError}`,
      );
    }
    raw = await provider.generate({
      ...options,
      jsonMode: true,
      messages: [
        ...options.messages,
        { role: "assistant", content: raw.text.slice(0, 4000) },
        {
          role: "user",
          content: `Your previous reply did not match the required JSON schema. Problems: ${lastError}. Reply with only a corrected JSON object and no prose.`,
        },
      ],
    });
    calls.push(raw);
  }
}
