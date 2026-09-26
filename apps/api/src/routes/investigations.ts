import { Hono, type Context } from "hono";
import {
  ConcludeRequest,
  HintRequest,
  InvestigationListResponse,
  InvestigationSessionListResponse,
  InvestigationSessionView,
  PerformActionRequest,
  UpsertInvestigationHypothesisRequest,
  nowIso,
  type InvestigationHypothesis,
} from "@lunara/schemas";
import {
  abandonInvestigation,
  addHypothesis,
  conclude,
  discardInvestigationHypothesis,
  performAction,
  requestHint,
  updateHypothesis,
  type EngineResult,
} from "@lunara/core";
import { findInvestigation, listPublishedInvestigations } from "@lunara/curriculum";
import { isAIError } from "@lunara/ai";
import type { HonoEnv } from "../context";
import { ApiHttpError, notFound } from "../errors";
import { newId } from "../ids";
import {
  createInvestigationSession,
  evaluateInvestigation,
  getOwnedInvestigationSession,
  investigationView,
  listInvestigationSessions,
  saveInvestigationState,
  toInvestigationState,
} from "../services/investigations";
import { ensureProfile, updateStats } from "../services/profile";
import { applyAssessmentToSkills } from "../services/skills";
import { assertWithinBudget } from "../services/usage";
import { recordCompletion, utcDateKey } from "@lunara/core";
import { parseBody } from "../validate";

export const investigationRoutes = new Hono<HonoEnv>();
export const investigationSessionRoutes = new Hono<HonoEnv>();

function unwrap<T>(r: EngineResult<T>): T {
  if (r.ok) return r.state;
  throw new ApiHttpError(r.code === "not_active" ? "conflict" : "invalid_request", r.reason, { engine: r.code });
}

async function loadOwned(c: Context<HonoEnv>) {
  const { db } = c.get("services");
  const session = await getOwnedInvestigationSession(db, c.get("user").id, c.req.param("sessionId") ?? "");
  if (!session) throw notFound("Investigation session");
  const def = findInvestigation(session.investigationId);
  if (!def) throw new ApiHttpError("internal", "Investigation content missing");
  return { db, session, def };
}

investigationRoutes.get("/", (c) => c.json(InvestigationListResponse.parse({ investigations: listPublishedInvestigations() })));

investigationRoutes.get("/:investigationId", (c) => {
  const def = findInvestigation(c.req.param("investigationId"));
  if (!def || def.public.status !== "published") throw notFound("Investigation");
  return c.json({ investigation: def.public });
});

investigationRoutes.post("/:investigationId/sessions", async (c) => {
  const { db } = c.get("services");
  const def = findInvestigation(c.req.param("investigationId"));
  if (!def || def.public.status !== "published") throw notFound("Investigation");
  const session = await createInvestigationSession(db, c.get("user").id, def);
  return c.json(InvestigationSessionView.parse(investigationView(session, def)), 201);
});

investigationSessionRoutes.get("/", async (c) => {
  const { db } = c.get("services");
  return c.json(InvestigationSessionListResponse.parse({ sessions: await listInvestigationSessions(db, c.get("user").id) }));
});

investigationSessionRoutes.get("/:sessionId", async (c) => {
  const { session, def } = await loadOwned(c);
  return c.json(InvestigationSessionView.parse(investigationView(session, def)));
});

investigationSessionRoutes.post("/:sessionId/actions", async (c) => {
  const { db, session, def } = await loadOwned(c);
  const body = await parseBody(c, PerformActionRequest);
  const next = unwrap(performAction(toInvestigationState(session), def, body.actionId, nowIso()));
  const saved = await saveInvestigationState(db, session.id, next);
  return c.json(InvestigationSessionView.parse(investigationView(saved, def)));
});

investigationSessionRoutes.post("/:sessionId/hypotheses", async (c) => {
  const { db, session, def } = await loadOwned(c);
  const body = await parseBody(c, UpsertInvestigationHypothesisRequest);
  const now = nowIso();
  const hyp: InvestigationHypothesis = { ...body, id: newId("ihyp"), status: "active", createdAt: now, updatedAt: now };
  const next = unwrap(addHypothesis(toInvestigationState(session), def, hyp));
  const saved = await saveInvestigationState(db, session.id, next);
  return c.json(InvestigationSessionView.parse(investigationView(saved, def)));
});

investigationSessionRoutes.patch("/:sessionId/hypotheses/:hypothesisId", async (c) => {
  const { db, session, def } = await loadOwned(c);
  const body = await parseBody(c, UpsertInvestigationHypothesisRequest.partial());
  const { revisesId: _ignored, ...patch } = body;
  const next = unwrap(updateHypothesis(toInvestigationState(session), def, c.req.param("hypothesisId") ?? "", patch, nowIso()));
  const saved = await saveInvestigationState(db, session.id, next);
  return c.json(InvestigationSessionView.parse(investigationView(saved, def)));
});

investigationSessionRoutes.delete("/:sessionId/hypotheses/:hypothesisId", async (c) => {
  const { db, session, def } = await loadOwned(c);
  const next = unwrap(discardInvestigationHypothesis(toInvestigationState(session), c.req.param("hypothesisId") ?? ""));
  const saved = await saveInvestigationState(db, session.id, next);
  return c.json(InvestigationSessionView.parse(investigationView(saved, def)));
});

investigationSessionRoutes.post("/:sessionId/hint", async (c) => {
  const { db, session, def } = await loadOwned(c);
  const body = await parseBody(c, HintRequest.optional().default({}));
  const next = unwrap(requestHint(toInvestigationState(session), body.level ?? session.hintLevel + 1));
  const saved = await saveInvestigationState(db, session.id, next);
  return c.json(InvestigationSessionView.parse(investigationView(saved, def)));
});

investigationSessionRoutes.post("/:sessionId/abandon", async (c) => {
  const { db, session, def } = await loadOwned(c);
  const next = unwrap(abandonInvestigation(toInvestigationState(session)));
  const saved = await saveInvestigationState(db, session.id, next);
  return c.json(InvestigationSessionView.parse(investigationView(saved, def)));
});

/** Conclude: records the conclusion, evaluates (deterministic + AI rubric), applies skill evidence, completes. */
investigationSessionRoutes.post("/:sessionId/conclude", async (c) => {
  const { db, session, def } = await loadOwned(c);
  const { ai, env } = c.get("services");
  const user = c.get("user");
  const body = await parseBody(c, ConcludeRequest);
  await assertWithinBudget(db, user.id, { dailyLimit: env.AI_DAILY_REQUEST_LIMIT, monthlyCostLimitUsd: env.AI_MONTHLY_COST_LIMIT_USD });
  const concludedState = unwrap(conclude(toInvestigationState(session), { ...body, submittedAt: nowIso() }));
  // Persist the conclusion first so a failed evaluation can be retried without losing it.
  const concludedSession = await saveInvestigationState(db, session.id, concludedState);
  let result: Awaited<ReturnType<typeof evaluateInvestigation>>;
  try {
    result = await evaluateInvestigation(ai, def, concludedSession);
  } catch (err) {
    if (isAIError(err)) throw new ApiHttpError("ai_unavailable", "Your conclusion is saved; the evaluation could not be generated right now.", { code: err.code });
    throw err;
  }
  const completedAt = new Date();
  const saved = await saveInvestigationState(db, session.id, concludedState, { evaluation: result.evaluation, completedAt });
  await applyAssessmentToSkills(db, user.id, session.id, session.investigationId, {
    overallScore: result.evaluation.overallScore,
    unaidedScore: result.evaluation.overallScore,
    hintLevelUsed: result.evaluation.hintLevelUsed,
    revealedBeforeDecision: false,
    criteria: result.evaluation.criteria,
    skillScores: result.evaluation.skillScores,
    correct: result.evaluation.correct,
    outcomeQuality: result.evaluation.outcomeQuality,
    strengths: result.evaluation.strengths,
    weaknesses: result.evaluation.weaknesses,
    errorPatterns: result.evaluation.errorPatterns,
    debrief: result.evaluation.debrief,
    assessedAt: result.evaluation.assessedAt,
  });
  const profile = await ensureProfile(db, user);
  await updateStats(db, user.id, recordCompletion(profile.stats, utcDateKey(completedAt.toISOString())));
  return c.json(InvestigationSessionView.parse(investigationView(saved, def)));
});

/** Retry evaluation for a concluded session whose evaluation failed. */
investigationSessionRoutes.post("/:sessionId/evaluate", async (c) => {
  const { db, session, def } = await loadOwned(c);
  const { ai, env } = c.get("services");
  const user = c.get("user");
  if (session.evaluation) return c.json(InvestigationSessionView.parse(investigationView(session, def)));
  if (!session.conclusion) throw new ApiHttpError("conflict", "Conclude the investigation first");
  await assertWithinBudget(db, user.id, { dailyLimit: env.AI_DAILY_REQUEST_LIMIT, monthlyCostLimitUsd: env.AI_MONTHLY_COST_LIMIT_USD });
  const result = await evaluateInvestigation(ai, def, session);
  const saved = await saveInvestigationState(db, session.id, toInvestigationState(session), { evaluation: result.evaluation, completedAt: new Date() });
  return c.json(InvestigationSessionView.parse(investigationView(saved, def)));
});
