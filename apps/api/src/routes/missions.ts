import { Hono, type Context } from "hono";
import { CreateCustomMissionRequest, MissionListResponse, MissionSessionListResponse, MissionSessionView, MissionStepRespondRequest } from "@lunara/schemas";
import { recordCompletion, utcDateKey } from "@lunara/core";
import { isAIError } from "@lunara/ai";
import type { HonoEnv } from "../context";
import { ApiHttpError, notFound } from "../errors";
import { abandonMission, completeMission, createCustomMission, debriefMission, deleteCustomMission, findAnyMission, getOwnedMissionSession, listAllMissions, listMissionSessions, respondToStep, startMission } from "../services/missions";
import { ensureProfile, updateStats } from "../services/profile";
import { applyAssessmentToSkills } from "../services/skills";
import { assertWithinBudget } from "../services/usage";
import { parseBody } from "../validate";

export const missionRoutes = new Hono<HonoEnv>();
export const missionSessionRoutes = new Hono<HonoEnv>();

async function loadOwned(c: Context<HonoEnv>) {
  const { db } = c.get("services");
  const session = await getOwnedMissionSession(db, c.get("user").id, c.req.param("sessionId") ?? "");
  if (!session) throw notFound("Mission session");
  return { db, session };
}

missionRoutes.get("/", async (c) => {
  const { db } = c.get("services");
  return c.json(MissionListResponse.parse({ missions: await listAllMissions(db, c.get("user").id) }));
});
missionRoutes.post("/custom", async (c) => {
  const { db } = c.get("services");
  const body = await parseBody(c, CreateCustomMissionRequest);
  return c.json({ mission: await createCustomMission(db, c.get("user").id, body) }, 201);
});
missionRoutes.delete("/custom/:missionId", async (c) => {
  const { db } = c.get("services");
  if (!(await deleteCustomMission(db, c.get("user").id, c.req.param("missionId")))) throw notFound("Mission");
  return c.json({ ok: true });
});
missionRoutes.post("/:missionId/sessions", async (c) => {
  const { db } = c.get("services");
  const def = await findAnyMission(db, c.get("user").id, c.req.param("missionId"));
  if (!def) throw notFound("Mission");
  return c.json(MissionSessionView.parse({ session: await startMission(db, c.get("user").id, def) }), 201);
});

missionSessionRoutes.get("/", async (c) => {
  const { db } = c.get("services");
  return c.json(MissionSessionListResponse.parse({ sessions: await listMissionSessions(db, c.get("user").id) }));
});
missionSessionRoutes.get("/:sessionId", async (c) => {
  const { session } = await loadOwned(c);
  return c.json(MissionSessionView.parse({ session }));
});
missionSessionRoutes.post("/:sessionId/steps", async (c) => {
  const { db, session } = await loadOwned(c);
  const body = await parseBody(c, MissionStepRespondRequest);
  return c.json(MissionSessionView.parse({ session: await respondToStep(db, session, body.stepId, body.response, body.refId) }));
});
missionSessionRoutes.post("/:sessionId/debrief", async (c) => {
  const { db, session } = await loadOwned(c);
  const { ai, env } = c.get("services");
  const user = c.get("user");
  if (session.debrief) return c.json(MissionSessionView.parse({ session }));
  await assertWithinBudget(db, user.id, { dailyLimit: env.AI_DAILY_REQUEST_LIMIT, monthlyCostLimitUsd: env.AI_MONTHLY_COST_LIMIT_USD });
  try {
    const debrief = await debriefMission(ai, session);
    const saved = await completeMission(db, session, debrief);
    await applyAssessmentToSkills(db, user.id, session.id, session.missionId, {
      overallScore: debrief.overallScore, unaidedScore: debrief.overallScore, hintLevelUsed: 0, revealedBeforeDecision: false,
      criteria: debrief.criteria, skillScores: debrief.skillScores, correct: null, outcomeQuality: "not_applicable",
      strengths: debrief.strengths, weaknesses: debrief.weaknesses, errorPatterns: debrief.errorPatterns, debrief: debrief.debrief, assessedAt: debrief.assessedAt,
    });
    const profile = await ensureProfile(db, user);
    await updateStats(db, user.id, recordCompletion(profile.stats, utcDateKey(new Date().toISOString())));
    return c.json(MissionSessionView.parse({ session: saved }));
  } catch (err) {
    if (isAIError(err)) throw new ApiHttpError("ai_unavailable", "The debrief could not be generated right now.", { code: err.code });
    throw err;
  }
});
missionSessionRoutes.post("/:sessionId/abandon", async (c) => {
  const { db, session } = await loadOwned(c);
  return c.json(MissionSessionView.parse({ session: await abandonMission(db, session) }));
});
