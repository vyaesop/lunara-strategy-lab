import { and, count, desc, eq, gte, sql } from "drizzle-orm";
import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { validateChallenges, validateCurriculum, validateInvestigations, validateMissions, validateNegotiations, validateSimulations } from "@lunara/curriculum";
import type { HonoEnv } from "../context";
import { aiUsage, coachingSessions, investigationSessions, profiles, simulationSessions, user } from "../db/schema";
import { ApiHttpError } from "../errors";

/** Admin is a server-side flag on the profile, bootstrapped from ADMIN_EMAILS. Hidden routes are not authorization. */
export const requireAdmin = createMiddleware<HonoEnv>(async (c, next) => {
  const { db } = c.get("services");
  const row = await db.query.profiles.findFirst({ where: eq(profiles.userId, c.get("user").id), columns: { isAdmin: true } });
  if (!row?.isAdmin) throw new ApiHttpError("forbidden", "Administrator access required");
  await next();
});

export const adminRoutes = new Hono<HonoEnv>();
adminRoutes.use("*", requireAdmin);

/** Aggregate, anonymised platform metrics and configuration. No user content, no keys. */
adminRoutes.get("/overview", async (c) => {
  const { db, ai, env, aiDescription, aiIsMock } = c.get("services");
  const since7 = new Date(Date.now() - 7 * 86_400_000);
  const since30 = new Date(Date.now() - 30 * 86_400_000);
  const [[users], [sessions], [investigations], [simulations], usage7, byTask, byProvider, errors7] = await Promise.all([
    db.select({ n: count() }).from(user),
    db.select({ n: count() }).from(coachingSessions),
    db.select({ n: count() }).from(investigationSessions),
    db.select({ n: count() }).from(simulationSessions),
    db.select({ calls: count(), cost: sql<number>`coalesce(sum(${aiUsage.estimatedCostUsd}),0)::float`, inputTokens: sql<number>`coalesce(sum(${aiUsage.inputTokens}),0)::int`, outputTokens: sql<number>`coalesce(sum(${aiUsage.outputTokens}),0)::int` }).from(aiUsage).where(gte(aiUsage.createdAt, since7)),
    db.select({ task: aiUsage.task, calls: count(), cost: sql<number>`coalesce(sum(${aiUsage.estimatedCostUsd}),0)::float` }).from(aiUsage).where(gte(aiUsage.createdAt, since30)).groupBy(aiUsage.task).orderBy(desc(count())),
    db.select({ provider: aiUsage.provider, model: aiUsage.model, calls: count(), cost: sql<number>`coalesce(sum(${aiUsage.estimatedCostUsd}),0)::float`, avgLatencyMs: sql<number>`coalesce(avg(${aiUsage.latencyMs}),0)::int` }).from(aiUsage).where(gte(aiUsage.createdAt, since30)).groupBy(aiUsage.provider, aiUsage.model),
    db.select({ errorCode: aiUsage.errorCode, n: count() }).from(aiUsage).where(and(gte(aiUsage.createdAt, since7), eq(aiUsage.ok, false))).groupBy(aiUsage.errorCode),
  ]);
  const tasks = ["coach.turn", "coach.hint", "coach.assess", "exercise.generate", "council.role", "tree.audit", "embed", "health"] as const;
  return c.json({
    counts: { users: Number(users?.n ?? 0), coachingSessions: Number(sessions?.n ?? 0), investigations: Number(investigations?.n ?? 0), simulations: Number(simulations?.n ?? 0) },
    ai: {
      defaultProvider: aiDescription.provider,
      mock: aiIsMock,
      routes: tasks.map((t) => ({ task: t, provider: ai.route(t).provider, model: ai.route(t).model, allowsUserContent: ai.allowsUserContent(t) })),
      last7Days: { calls: Number(usage7[0]?.calls ?? 0), estimatedCostUsd: Number(usage7[0]?.cost ?? 0), inputTokens: Number(usage7[0]?.inputTokens ?? 0), outputTokens: Number(usage7[0]?.outputTokens ?? 0) },
      byTask30Days: byTask.map((r) => ({ task: r.task, calls: Number(r.calls), estimatedCostUsd: Number(r.cost) })),
      byProvider30Days: byProvider.map((r) => ({ provider: r.provider, model: r.model, calls: Number(r.calls), estimatedCostUsd: Number(r.cost), avgLatencyMs: Number(r.avgLatencyMs) })),
      errors7Days: errors7.map((r) => ({ code: r.errorCode ?? "unknown", n: Number(r.n) })),
    },
    limits: { ratePerMinute: env.RATE_LIMIT_PER_MINUTE, aiDailyRequests: env.AI_DAILY_REQUEST_LIMIT, aiMonthlyCostUsd: env.AI_MONTHLY_COST_LIMIT_USD },
  });
});

/** Content validation report across every curated collection. */
adminRoutes.get("/content", (c) => {
  const report = {
    exercises: validateCurriculum(),
    investigations: validateInvestigations(),
    simulations: validateSimulations(),
    negotiations: validateNegotiations(),
    missions: validateMissions(),
    challenges: validateChallenges(),
  };
  return c.json({ report, ok: Object.values(report).every((r) => r.ok) });
});
