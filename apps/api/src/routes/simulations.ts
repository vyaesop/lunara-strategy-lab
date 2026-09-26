import { Hono, type Context } from "hono";
import { SimDecideRequest, SimulationListResponse, SimulationSessionListResponse, SimulationSessionView, nowIso } from "@lunara/schemas";
import { abandonSim, decide, recordCompletion, utcDateKey, type SimResult } from "@lunara/core";
import { findSimulation, listPublishedSimulations } from "@lunara/curriculum";
import { isAIError } from "@lunara/ai";
import type { HonoEnv } from "../context";
import { ApiHttpError, notFound } from "../errors";
import { ensureProfile, updateStats } from "../services/profile";
import { createSimSession, evaluateSimulation, getOwnedSimSession, listSimSessions, saveSimState, simView, toSimState } from "../services/simulations";
import { applyAssessmentToSkills } from "../services/skills";
import { assertWithinBudget } from "../services/usage";
import { parseBody } from "../validate";

export const simulationRoutes = new Hono<HonoEnv>();
export const simulationSessionRoutes = new Hono<HonoEnv>();

function unwrap<T>(r: SimResult<T>): T {
  if (r.ok) return r.state;
  throw new ApiHttpError(r.code === "not_active" ? "conflict" : "invalid_request", r.reason, { engine: r.code });
}

async function loadOwned(c: Context<HonoEnv>) {
  const { db } = c.get("services");
  const session = await getOwnedSimSession(db, c.get("user").id, c.req.param("sessionId") ?? "");
  if (!session) throw notFound("Simulation session");
  const def = findSimulation(session.simulationId);
  if (!def) throw new ApiHttpError("internal", "Simulation content missing");
  return { db, session, def };
}

simulationRoutes.get("/", (c) => c.json(SimulationListResponse.parse({ simulations: listPublishedSimulations() })));

simulationRoutes.get("/:simulationId", (c) => {
  const def = findSimulation(c.req.param("simulationId"));
  if (!def || def.public.status !== "published") throw notFound("Simulation");
  return c.json({ simulation: def.public });
});

simulationRoutes.post("/:simulationId/sessions", async (c) => {
  const { db } = c.get("services");
  const def = findSimulation(c.req.param("simulationId"));
  if (!def || def.public.status !== "published") throw notFound("Simulation");
  const session = await createSimSession(db, c.get("user").id, def);
  return c.json(SimulationSessionView.parse(simView(session, def)), 201);
});

simulationSessionRoutes.get("/", async (c) => {
  const { db } = c.get("services");
  return c.json(SimulationSessionListResponse.parse({ sessions: await listSimSessions(db, c.get("user").id) }));
});

simulationSessionRoutes.get("/:sessionId", async (c) => {
  const { session, def } = await loadOwned(c);
  return c.json(SimulationSessionView.parse(simView(session, def)));
});

simulationSessionRoutes.post("/:sessionId/decide", async (c) => {
  const { db, session, def } = await loadOwned(c);
  const { ai, env } = c.get("services");
  const user = c.get("user");
  const body = await parseBody(c, SimDecideRequest);
  const out = unwrap(decide(def, toSimState(session), { ...body, at: nowIso() }));
  let saved = await saveSimState(db, session.id, out.state);
  if (out.ended) {
    // Evaluate at the end of the run; the decisions are already persisted if this fails.
    await assertWithinBudget(db, user.id, { dailyLimit: env.AI_DAILY_REQUEST_LIMIT, monthlyCostLimitUsd: env.AI_MONTHLY_COST_LIMIT_USD });
    try {
      const result = await evaluateSimulation(ai, def, saved);
      const completedAt = new Date();
      saved = await saveSimState(db, session.id, out.state, { evaluation: result.evaluation, completedAt });
      await applyAssessmentToSkills(db, user.id, session.id, session.simulationId, {
        overallScore: result.evaluation.overallScore,
        unaidedScore: result.evaluation.overallScore,
        hintLevelUsed: saved.hintLevel,
        revealedBeforeDecision: false,
        criteria: result.evaluation.criteria,
        skillScores: result.evaluation.skillScores,
        correct: result.evaluation.succeeded,
        outcomeQuality: result.evaluation.outcomeQuality,
        strengths: result.evaluation.strengths,
        weaknesses: result.evaluation.weaknesses,
        errorPatterns: result.evaluation.errorPatterns,
        debrief: result.evaluation.debrief,
        assessedAt: result.evaluation.assessedAt,
      });
      const profile = await ensureProfile(db, user);
      await updateStats(db, user.id, recordCompletion(profile.stats, utcDateKey(completedAt.toISOString())));
    } catch (err) {
      if (!isAIError(err)) throw err;
      // Leave evaluation null; the client can retry via /evaluate.
    }
  }
  return c.json(SimulationSessionView.parse(simView(saved, def, out.narration)));
});

simulationSessionRoutes.post("/:sessionId/evaluate", async (c) => {
  const { db, session, def } = await loadOwned(c);
  const { ai, env } = c.get("services");
  const user = c.get("user");
  if (session.evaluation) return c.json(SimulationSessionView.parse(simView(session, def)));
  if (session.status !== "completed") throw new ApiHttpError("conflict", "Finish the simulation first");
  await assertWithinBudget(db, user.id, { dailyLimit: env.AI_DAILY_REQUEST_LIMIT, monthlyCostLimitUsd: env.AI_MONTHLY_COST_LIMIT_USD });
  try {
    const result = await evaluateSimulation(ai, def, session);
    const saved = await saveSimState(db, session.id, toSimState(session), { evaluation: result.evaluation, completedAt: new Date() });
    return c.json(SimulationSessionView.parse(simView(saved, def)));
  } catch (err) {
    if (isAIError(err)) throw new ApiHttpError("ai_unavailable", "The debrief could not be generated right now.", { code: err.code });
    throw err;
  }
});

simulationSessionRoutes.post("/:sessionId/abandon", async (c) => {
  const { db, session, def } = await loadOwned(c);
  const next = unwrap(abandonSim(toSimState(session)));
  const saved = await saveSimState(db, session.id, next);
  return c.json(SimulationSessionView.parse(simView(saved, def)));
});
