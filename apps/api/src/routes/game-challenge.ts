import { Hono, type Context } from "hono";
import { ChallengeListResponse, ChallengeStageRequest, ChallengeView, GameListResponse, GameTurnRequest, GameView } from "@lunara/schemas";
import { recordCompletion, utcDateKey } from "@lunara/core";
import { findChallenge, listPublishedChallenges } from "@lunara/curriculum";
import { isAIError } from "@lunara/ai";
import type { HonoEnv } from "../context";
import { ApiHttpError, notFound } from "../errors";
import { abandonAttempt, assessAttempt, challengeView, getOwnedAttempt, listAttempts, startAttempt, submitStage } from "../services/challenge";
import { abandonGame, createGame, evaluateGame, gameView, getOwnedGame, listGames, playTurn } from "../services/game";
import { ensureProfile, updateStats } from "../services/profile";
import { applyAssessmentToSkills } from "../services/skills";
import { assertWithinBudget } from "../services/usage";
import { parseBody } from "../validate";

export const gameRoutes = new Hono<HonoEnv>();
export const challengeRoutes = new Hono<HonoEnv>();

function budget(c: Context<HonoEnv>) {
  const { db, env } = c.get("services");
  return assertWithinBudget(db, c.get("user").id, { dailyLimit: env.AI_DAILY_REQUEST_LIMIT, monthlyCostLimitUsd: env.AI_MONTHLY_COST_LIMIT_USD });
}

// ── Game ────────────────────────────────────────────────────────────────────

async function loadGame(c: Context<HonoEnv>) {
  const { db } = c.get("services");
  const session = await getOwnedGame(db, c.get("user").id, c.req.param("gameId") ?? "");
  if (!session) throw notFound("Game");
  return { db, session };
}

gameRoutes.get("/", async (c) => {
  const { db } = c.get("services");
  return c.json(GameListResponse.parse({ sessions: await listGames(db, c.get("user").id) }));
});
gameRoutes.post("/", async (c) => {
  const { db } = c.get("services");
  return c.json(GameView.parse(gameView(await createGame(db, c.get("user").id))), 201);
});
gameRoutes.get("/:gameId", async (c) => {
  const { session } = await loadGame(c);
  return c.json(GameView.parse(gameView(session)));
});
gameRoutes.post("/:gameId/turn", async (c) => {
  const { db, session } = await loadGame(c);
  const body = await parseBody(c, GameTurnRequest);
  return c.json(GameView.parse(gameView(await playTurn(db, session, body))));
});
gameRoutes.post("/:gameId/abandon", async (c) => {
  const { db, session } = await loadGame(c);
  return c.json(GameView.parse(gameView(await abandonGame(db, session))));
});
gameRoutes.post("/:gameId/evaluate", async (c) => {
  const { db, session } = await loadGame(c);
  const { ai } = c.get("services");
  const user = c.get("user");
  if (session.evaluation) return c.json(GameView.parse(gameView(session)));
  await budget(c);
  try {
    const evaluated = await evaluateGame(db, ai, session);
    const ev = evaluated.evaluation!;
    await applyAssessmentToSkills(db, user.id, session.id, session.gameId, {
      overallScore: ev.overallScore, unaidedScore: ev.overallScore, hintLevelUsed: 0, revealedBeforeDecision: false, criteria: ev.criteria, skillScores: ev.skillScores,
      correct: null, outcomeQuality: "not_applicable", strengths: ev.strengths, weaknesses: ev.weaknesses, errorPatterns: [], debrief: ev.debrief, assessedAt: ev.assessedAt,
    });
    const profile = await ensureProfile(db, user);
    await updateStats(db, user.id, recordCompletion(profile.stats, utcDateKey(new Date().toISOString())));
    return c.json(GameView.parse(gameView(evaluated)));
  } catch (err) {
    if (isAIError(err)) throw new ApiHttpError("ai_unavailable", "The debrief could not be generated right now.", { code: err.code });
    throw err;
  }
});

// ── Challenge ───────────────────────────────────────────────────────────────

async function loadAttempt(c: Context<HonoEnv>) {
  const { db } = c.get("services");
  const attempt = await getOwnedAttempt(db, c.get("user").id, c.req.param("attemptId") ?? "");
  if (!attempt) throw notFound("Attempt");
  const def = findChallenge(attempt.challengeId);
  if (!def) throw new ApiHttpError("internal", "Challenge content missing");
  return { db, attempt, def };
}

challengeRoutes.get("/", async (c) => {
  const { db } = c.get("services");
  const attempts = (await listAttempts(db, c.get("user").id)).map((a) => ({ id: a.id, challengeId: a.challengeId, monthKey: a.monthKey, stage: a.stage, status: a.status, startedAt: a.startedAt, completedAt: a.completedAt, overallScore: a.assessment?.overallScore ?? null }));
  return c.json(ChallengeListResponse.parse({ challenges: listPublishedChallenges(), attempts }));
});
challengeRoutes.post("/:challengeId/attempts", async (c) => {
  const { db } = c.get("services");
  const def = findChallenge(c.req.param("challengeId"));
  if (!def || def.public.status !== "published") throw notFound("Challenge");
  const monthKey = new Date().toISOString().slice(0, 7);
  const attempt = await startAttempt(db, c.get("user").id, def, monthKey);
  return c.json(ChallengeView.parse(challengeView(attempt, def)), 201);
});
challengeRoutes.get("/attempts/:attemptId", async (c) => {
  const { attempt, def } = await loadAttempt(c);
  return c.json(ChallengeView.parse(challengeView(attempt, def)));
});
challengeRoutes.post("/attempts/:attemptId/stage", async (c) => {
  const { db, attempt, def } = await loadAttempt(c);
  const { ai } = c.get("services");
  const body = await parseBody(c, ChallengeStageRequest);
  if (body.stage === "decision") await budget(c);
  try {
    let saved = await submitStage(db, ai, def, attempt, body);
    if (saved.stage === "assessed" && !saved.assessment) {
      await budget(c);
      saved = await assessAttempt(db, ai, def, saved);
      const a = saved.assessment!;
      await applyAssessmentToSkills(db, c.get("user").id, saved.id, saved.challengeId, {
        overallScore: a.overallScore, unaidedScore: a.overallScore, hintLevelUsed: 0, revealedBeforeDecision: false, criteria: a.criteria, skillScores: a.skillScores,
        correct: null, outcomeQuality: "not_applicable", strengths: a.strengths, weaknesses: a.weaknesses, errorPatterns: a.errorPatterns, debrief: a.debrief, assessedAt: a.assessedAt,
      });
      const profile = await ensureProfile(db, c.get("user"));
      await updateStats(db, c.get("user").id, recordCompletion(profile.stats, utcDateKey(new Date().toISOString())));
    }
    return c.json(ChallengeView.parse(challengeView(saved, def)));
  } catch (err) {
    if (isAIError(err)) throw new ApiHttpError("ai_unavailable", "The reviewer is unavailable right now; your work is saved.", { code: err.code });
    throw err;
  }
});
challengeRoutes.post("/attempts/:attemptId/abandon", async (c) => {
  const { db, attempt, def } = await loadAttempt(c);
  return c.json(ChallengeView.parse(challengeView(await abandonAttempt(db, attempt), def)));
});
