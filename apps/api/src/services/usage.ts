import { and, eq, gte, sql } from "drizzle-orm";
import type { UsageEvent, UsageSink } from "@lunara/ai";
import { requestContext } from "../context";
import type { Db } from "../db/client";
import { aiUsage } from "../db/schema";
import { ApiHttpError } from "../errors";
import { newId } from "../ids";

/** Writes one ai_usage row per provider attempt, attributed via request context. */
export function createUsageSink(db: Db): UsageSink {
  return {
    async record(event: UsageEvent) {
      const ctx = requestContext.getStore();
      await db.insert(aiUsage).values({
        id: newId("usg"),
        userId: ctx?.userId ?? null,
        task: event.task,
        provider: event.provider,
        model: event.model,
        inputTokens: event.usage.inputTokens,
        outputTokens: event.usage.outputTokens,
        latencyMs: event.latencyMs,
        estimatedCostUsd: event.estimatedCostUsd,
        ok: event.ok,
        errorCode: event.errorCode,
      });
    },
  };
}

export interface UsageSummary {
  dailyRequests: number;
  monthlyCostUsd: number;
  dailyLimit: number;
  monthlyCostLimitUsd: number;
}

export async function summarizeUsage(
  db: Db,
  userId: string,
  limits: { dailyLimit: number; monthlyCostLimitUsd: number },
  now = new Date(),
): Promise<UsageSummary> {
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const [daily] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(aiUsage)
    .where(and(eq(aiUsage.userId, userId), gte(aiUsage.createdAt, dayStart)));
  const [monthly] = await db
    .select({ cost: sql<number>`coalesce(sum(${aiUsage.estimatedCostUsd}), 0)::float` })
    .from(aiUsage)
    .where(and(eq(aiUsage.userId, userId), gte(aiUsage.createdAt, monthStart)));
  return {
    dailyRequests: Number(daily?.n ?? 0),
    monthlyCostUsd: Number(monthly?.cost ?? 0),
    dailyLimit: limits.dailyLimit,
    monthlyCostLimitUsd: limits.monthlyCostLimitUsd,
  };
}

/** Throw a clear error before calling a provider when a budget is exhausted. */
export async function assertWithinBudget(
  db: Db,
  userId: string,
  limits: { dailyLimit: number; monthlyCostLimitUsd: number },
): Promise<UsageSummary> {
  const s = await summarizeUsage(db, userId, limits);
  if (s.dailyRequests >= s.dailyLimit) {
    throw new ApiHttpError("budget_exceeded", `Daily AI request limit (${s.dailyLimit}) reached`);
  }
  if (s.monthlyCostUsd >= s.monthlyCostLimitUsd) {
    throw new ApiHttpError("budget_exceeded", "Monthly AI budget reached");
  }
  return s;
}
