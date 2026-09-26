import { Hono, type Context } from "hono";
import { NegotiationListResponse, NegotiationPrepareRequest, NegotiationProposeRequest, NegotiationSayRequest, NegotiationSessionListResponse, NegotiationSessionView } from "@lunara/schemas";
import { recordCompletion, utcDateKey } from "@lunara/core";
import { findNegotiation, listPublishedNegotiations } from "@lunara/curriculum";
import { isAIError } from "@lunara/ai";
import type { HonoEnv } from "../context";
import { ApiHttpError, notFound } from "../errors";
import { acceptOffer, createNegotiationSession, evaluateNegotiation, getOwnedNegotiation, listNegotiationSessions, negotiationView, propose, saveNegotiationEvaluation, say, updatePreparation, walkAway } from "../services/negotiation";
import { ensureProfile, updateStats } from "../services/profile";
import { applyAssessmentToSkills } from "../services/skills";
import { assertWithinBudget } from "../services/usage";
import { parseBody } from "../validate";

export const negotiationRoutes = new Hono<HonoEnv>();
export const negotiationSessionRoutes = new Hono<HonoEnv>();

async function loadOwned(c: Context<HonoEnv>) {
  const { db } = c.get("services");
  const session = await getOwnedNegotiation(db, c.get("user").id, c.req.param("sessionId") ?? "");
  if (!session) throw notFound("Negotiation session");
  const def = findNegotiation(session.negotiationId);
  if (!def) throw new ApiHttpError("internal", "Negotiation content missing");
  return { db, session, def };
}

function budget(c: Context<HonoEnv>) {
  const { db, env } = c.get("services");
  return assertWithinBudget(db, c.get("user").id, { dailyLimit: env.AI_DAILY_REQUEST_LIMIT, monthlyCostLimitUsd: env.AI_MONTHLY_COST_LIMIT_USD });
}

negotiationRoutes.get("/", (c) => c.json(NegotiationListResponse.parse({ negotiations: listPublishedNegotiations() })));
negotiationRoutes.post("/:negotiationId/sessions", async (c) => {
  const { db, ai } = c.get("services");
  const def = findNegotiation(c.req.param("negotiationId"));
  if (!def || def.public.status !== "published") throw notFound("Negotiation");
  if (!ai.allowsUserContent("coach.turn")) throw new ApiHttpError("forbidden", "The configured AI provider is not approved for private content (AI_ALLOW_USER_CONTENT)");
  const session = await createNegotiationSession(db, c.get("user").id, def);
  return c.json(NegotiationSessionView.parse(negotiationView(session, def)), 201);
});

negotiationSessionRoutes.get("/", async (c) => {
  const { db } = c.get("services");
  return c.json(NegotiationSessionListResponse.parse({ sessions: await listNegotiationSessions(db, c.get("user").id) }));
});
negotiationSessionRoutes.get("/:sessionId", async (c) => {
  const { session, def } = await loadOwned(c);
  return c.json(NegotiationSessionView.parse(negotiationView(session, def)));
});
negotiationSessionRoutes.patch("/:sessionId/preparation", async (c) => {
  const { db, session, def } = await loadOwned(c);
  const body = await parseBody(c, NegotiationPrepareRequest);
  return c.json(NegotiationSessionView.parse(negotiationView(await updatePreparation(db, session, body), def)));
});
negotiationSessionRoutes.post("/:sessionId/say", async (c) => {
  const { db, session, def } = await loadOwned(c);
  const { ai } = c.get("services");
  const body = await parseBody(c, NegotiationSayRequest);
  await budget(c);
  try {
    return c.json(NegotiationSessionView.parse(negotiationView(await say(db, ai, def, session, body.content), def)));
  } catch (err) {
    if (isAIError(err)) throw new ApiHttpError("ai_unavailable", "The counterpart is unavailable right now.", { code: err.code });
    throw err;
  }
});
negotiationSessionRoutes.post("/:sessionId/propose", async (c) => {
  const { db, session, def } = await loadOwned(c);
  const { ai } = c.get("services");
  const body = await parseBody(c, NegotiationProposeRequest);
  await budget(c);
  try {
    return c.json(NegotiationSessionView.parse(negotiationView(await propose(db, ai, def, session, body.terms, body.message), def)));
  } catch (err) {
    if (isAIError(err)) throw new ApiHttpError("ai_unavailable", "The counterpart is unavailable right now.", { code: err.code });
    throw err;
  }
});
negotiationSessionRoutes.post("/:sessionId/accept", async (c) => {
  const { db, session, def } = await loadOwned(c);
  return c.json(NegotiationSessionView.parse(negotiationView(await acceptOffer(db, def, session), def)));
});
negotiationSessionRoutes.post("/:sessionId/walk-away", async (c) => {
  const { db, session, def } = await loadOwned(c);
  return c.json(NegotiationSessionView.parse(negotiationView(await walkAway(db, session), def)));
});
/** Evaluation after the session ends; reveals the counterpart's simulated incentives. */
negotiationSessionRoutes.post("/:sessionId/evaluate", async (c) => {
  const { db, session, def } = await loadOwned(c);
  const { ai } = c.get("services");
  const user = c.get("user");
  if (session.evaluation) return c.json(NegotiationSessionView.parse(negotiationView(session, def)));
  if (session.status !== "completed") throw new ApiHttpError("conflict", "Finish the negotiation first");
  await budget(c);
  try {
    const evaluation = await evaluateNegotiation(ai, def, session);
    const saved = await saveNegotiationEvaluation(db, session, evaluation);
    await applyAssessmentToSkills(db, user.id, session.id, session.negotiationId, {
      overallScore: evaluation.overallScore, unaidedScore: evaluation.overallScore, hintLevelUsed: 0, revealedBeforeDecision: false,
      criteria: evaluation.criteria, skillScores: evaluation.skillScores, correct: evaluation.dealReached, outcomeQuality: evaluation.outcomeQuality,
      strengths: evaluation.strengths, weaknesses: evaluation.weaknesses, errorPatterns: evaluation.errorPatterns, debrief: evaluation.debrief, assessedAt: evaluation.assessedAt,
    });
    const profile = await ensureProfile(db, user);
    await updateStats(db, user.id, recordCompletion(profile.stats, utcDateKey(new Date().toISOString())));
    return c.json(NegotiationSessionView.parse(negotiationView(saved, def)));
  } catch (err) {
    if (isAIError(err)) throw new ApiHttpError("ai_unavailable", "The debrief could not be generated right now.", { code: err.code });
    throw err;
  }
});
