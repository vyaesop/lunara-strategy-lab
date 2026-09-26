import { z } from "zod";
import { IsoTimestamp } from "./common";

/** Tasks the model router knows how to route. */
export const AITask = z.enum([
  "coach.turn",
  "coach.hint",
  "coach.assess",
  "exercise.generate",
  "council.role",
  "tree.audit",
  "embed",
  "health",
]);
export type AITask = z.infer<typeof AITask>;

export const AIProviderId = z.enum(["mock", "gemini", "groq", "openrouter", "ollama", "openai_compatible"]);
export type AIProviderId = z.infer<typeof AIProviderId>;

export const AIUsageRecord = z.object({
  id: z.string().min(1),
  uid: z.string().min(1).nullable(),
  task: AITask,
  provider: AIProviderId,
  model: z.string().min(1).max(120),
  inputTokens: z.number().int().min(0),
  outputTokens: z.number().int().min(0),
  latencyMs: z.number().int().min(0),
  estimatedCostUsd: z.number().min(0),
  ok: z.boolean(),
  errorCode: z.string().max(80).nullable(),
  createdAt: IsoTimestamp,
});
export type AIUsageRecord = z.infer<typeof AIUsageRecord>;

export const DailyUsage = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  requests: z.number().int().min(0),
  inputTokens: z.number().int().min(0),
  outputTokens: z.number().int().min(0),
  estimatedCostUsd: z.number().min(0),
  byTask: z.record(z.string(), z.number().int().min(0)),
  updatedAt: IsoTimestamp,
});
export type DailyUsage = z.infer<typeof DailyUsage>;
