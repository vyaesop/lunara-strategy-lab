import { Hono, type Context } from "hono";
import { z } from "zod";
import {
  AdvancePhaseRequest,
  CreateSessionRequest,
  HintRequest,
  SessionListResponse,
  SessionMutationResponse,
  SessionResponse,
  SessionTurnRequest,
  SessionTurnResponse,
  SubmitDecisionRequest,
  SubmitHypothesisRequest,
  nowIso,
  type UserHypothesis,
} from "@lunara/schemas";
import {
  abandon,
  canRequestHint,
  complete,
  discardHypothesis,
  recordCompletion,
  requestReveal,
  submitDecision,
  submitHypothesis,
  transition,
  utcDateKey,
  type MachineResult,
} from "@lunara/core";
import { findExercise } from "@lunara/curriculum";
import { isAIError } from "@lunara/ai";
import type { HonoEnv } from "../context";
import { ApiHttpError, invalid, notFound } from "../errors";
import { newId } from "../ids";
import { assessSession } from "../services/assess";
import { coachReply } from "../services/coach";
import { ensureProfile, listSkills, updateStats } from "../services/profile";
import {
  appendMessage,
  createSession,
  getOwnedSession,
  listMessages,
  listSessions,
  released,
  saveAssessment,
  saveState,
  toState,
} from "../services/sessions";
import { applyAssessmentToSkills } from "../services/skills";
import { assertWithinBudget } from "../services/usage";
import { parseBody } from "../validate";

export const sessionRoutes = new Hono<HonoEnv>();

/** Session payload with released hidden material merged in. */
const SessionDetail = SessionResponse.extend({
  released: z.object({
    hints: z.array(z.string()),
    solution: z.string().nullable(),
    keyInsights: z.array(z.string()).nullable(),
    debrief: z.string().nullable(),
  }),
});

function unwrap<T>(r: MachineResult<T>): T {
  if (r.ok) return r.state;
  const code = r.code === "session_not_active" ? "conflict" : "invalid_request";
  throw new ApiHttpError(code, r.reason, { machine: r.code });
}

async function loadOwned(c: Context<HonoEnv>) {
  const { db } = c.get("services");
  const session = await getOwnedSession(db, c.get("user").id, c.req.param("sessionId") ?? "");
  if (!session) throw notFound("Session");
  const exercise = findExercise(session.exerciseId);
  if (!exercise) throw new ApiHttpError("internal", "Exercise content missing for session");
  return { db, session, exercise };
}

sessionRoutes.get("/", async (c) => {
  const { db } = c.get("services");
  const sessions = await listSessions(db, c.get("user").id);
  return c.json(SessionListResponse.parse({ sessions }));
});

sessionRoutes.post("/", async (c) => {
  const { db } = c.get("services");
  const body = await parseBody(c, CreateSessionRequest);
  const exercise = findExercise(body.exerciseId);
  if (!exercise || exercise.public.status !== "published") throw notFound("Exercise");
  const session = await createSession(db, c.get("user").id, exercise);
  const intro = await appendMessage(db, {
    sessionId: session.id,
    userId: c.get("user").id,
    role: "coach",
    kind: "turn",
    phase: "introduction",
    content: `Welcome to "${exercise.public.title}". ${exercise.public.summary} Before we begin: in your own words, what is the situation and what are you being asked to work out?`,
  });
  const fresh = (await getOwnedSession(db, c.get("user").id, session.id))!;
  return c.json(
    SessionDetail.parse({ session: fresh, messages: [intro], exercise: exercise.public, released: released(fresh, exercise) }),
    201,
  );
});

sessionRoutes.get("/:sessionId", async (c) => {
  const { db, session, exercise } = await loadOwned(c);
  const messages = await listMessages(db, session.id);
  return c.json(SessionDetail.parse({ session, messages, exercise: exercise.public, released: released(session, exercise) }));
});

sessionRoutes.post("/:sessionId/messages", async (c) => {
  const { db, session, exercise } = await loadOwned(c);
  const { ai, env } = c.get("services");
  const user = c.get("user");
  const body = await parseBody(c, SessionTurnRequest);
  if (session.status !== "active") throw new ApiHttpError("conflict", "Session is not active");

  await assertWithinBudget(db, user.id, { dailyLimit: env.AI_DAILY_REQUEST_LIMIT, monthlyCostLimitUsd: env.AI_MONTHLY_COST_LIMIT_USD });

  const userMessage = await appendMessage(db, {
    sessionId: session.id,
    userId: user.id,
    role: "user",
    kind: "turn",
    phase: session.phase,
    content: body.content,
  });
  const profile = await ensureProfile(db, user);
  const history = await listMessages(db, session.id);
  let reply: { text: string; model: string };
  try {
    reply = await coachReply(ai, exercise, session, history, profile.preferences);
  } catch (err) {
    if (isAIError(err)) throw new ApiHttpError("ai_unavailable", "The coach is unavailable right now; your message was saved.", { code: err.code });
    throw err;
  }
  const coachMessage = await appendMessage(db, {
    sessionId: session.id,
    userId: user.id,
    role: "coach",
    kind: "turn",
    phase: session.phase,
    content: reply.text,
    model: reply.model,
  });
  // A first substantive message moves the session out of the introduction.
  let current = (await getOwnedSession(db, user.id, session.id))!;
  if (current.phase === "introduction") {
    const r = transition(toState(current), "initial_understanding");
    if (r.ok) current = await saveState(db, session.id, r.state);
  }
  return c.json(SessionTurnResponse.parse({ session: current, userMessage, coachMessage }));
});

sessionRoutes.post("/:sessionId/hypotheses", async (c) => {
  const { db, session } = await loadOwned(c);
  const body = await parseBody(c, SubmitHypothesisRequest);
  const hypothesis: UserHypothesis = {
    id: newId("hyp"),
    statement: body.statement,
    supportingEvidence: body.supportingEvidence,
    contradictingEvidence: body.contradictingEvidence,
    assumptions: body.assumptions,
    confidence: body.confidence,
    status: "active",
    revisesId: body.revisesId ?? null,
    createdAt: nowIso(),
  };
  if (hypothesis.revisesId && !session.hypotheses.some((h) => h.id === hypothesis.revisesId)) {
    throw invalid("revisesId does not match an existing hypothesis");
  }
  const next = unwrap(submitHypothesis(toState(session), hypothesis));
  const saved = await saveState(db, session.id, next);
  return c.json(SessionMutationResponse.parse({ session: saved }));
});

sessionRoutes.delete("/:sessionId/hypotheses/:hypothesisId", async (c) => {
  const { db, session } = await loadOwned(c);
  const id = c.req.param("hypothesisId");
  if (!session.hypotheses.some((h) => h.id === id)) throw notFound("Hypothesis");
  const next = unwrap(discardHypothesis(toState(session), id));
  const saved = await saveState(db, session.id, next);
  return c.json(SessionMutationResponse.parse({ session: saved }));
});

sessionRoutes.post("/:sessionId/hint", async (c) => {
  const { db, session, exercise } = await loadOwned(c);
  const body = await parseBody(c, HintRequest.optional().default({}));
  const level = body.level ?? session.hintLevel + 1;
  const next = unwrap(canRequestHint(toState(session), level));
  const saved = await saveState(db, session.id, next);
  const hint = await appendMessage(db, {
    sessionId: session.id,
    userId: c.get("user").id,
    role: "coach",
    kind: "hint",
    phase: saved.phase,
    content: exercise.hidden.hints[level - 1]!,
  });
  if (level === 5) {
    // The worked explanation is a reveal; record it so assessment can tell assisted from unaided.
    await appendMessage(db, { sessionId: session.id, userId: c.get("user").id, role: "system", kind: "reveal", phase: saved.phase, content: "Worked explanation shown (hint 5)." });
  }
  return c.json({ session: saved, hint });
});

/**
 * Assess the attempt (debrief phase), persist the assessment, apply skill
 * evidence and move to skill_update. Idempotent: an assessed session returns
 * its stored assessment.
 */
sessionRoutes.post("/:sessionId/assess", async (c) => {
  const { db, session, exercise } = await loadOwned(c);
  const { ai, env } = c.get("services");
  const user = c.get("user");
  if (session.assessment) {
    return c.json({ session, skills: await listSkills(db, user.id) });
  }
  if (session.status !== "active" || session.phase !== "debrief") {
    throw new ApiHttpError("conflict", "Assessment is available once the debrief phase is reached");
  }
  await assertWithinBudget(db, user.id, { dailyLimit: env.AI_DAILY_REQUEST_LIMIT, monthlyCostLimitUsd: env.AI_MONTHLY_COST_LIMIT_USD });
  const history = await listMessages(db, session.id);
  const decisionAt = session.decision ? new Date(session.decision.submittedAt).getTime() : Number.POSITIVE_INFINITY;
  const revealedBeforeDecision = history.some((m) => m.kind === "reveal" && new Date(m.createdAt).getTime() <= decisionAt);
  let result: Awaited<ReturnType<typeof assessSession>>;
  try {
    result = await assessSession({ ai, exercise, session, history, revealedBeforeDecision });
  } catch (err) {
    if (isAIError(err)) throw new ApiHttpError("ai_unavailable", "The assessment could not be generated right now; try again shortly.", { code: err.code });
    throw err;
  }
  const next = unwrap(transition(toState(session), "skill_update"));
  await saveAssessment(db, session.id, result.assessment);
  const saved = await saveState(db, session.id, next);
  await appendMessage(db, {
    sessionId: session.id,
    userId: user.id,
    role: "coach",
    kind: "debrief",
    phase: saved.phase,
    content: result.assessment.debrief,
    model: result.model,
  });
  const skills = await applyAssessmentToSkills(db, user.id, session.id, session.exerciseId, result.assessment);
  const fresh = (await getOwnedSession(db, user.id, session.id))!;
  return c.json({ session: fresh, skills });
});

sessionRoutes.post("/:sessionId/reveal", async (c) => {
  const { db, session, exercise } = await loadOwned(c);
  const next = unwrap(requestReveal(toState(session)));
  const saved = await saveState(db, session.id, next);
  await appendMessage(db, {
    sessionId: session.id,
    userId: c.get("user").id,
    role: "system",
    kind: "reveal",
    phase: saved.phase,
    content: "Solution revealed at the learner's request.",
  });
  return c.json({ session: saved, released: released(saved, exercise) });
});

sessionRoutes.post("/:sessionId/decision", async (c) => {
  const { db, session, exercise } = await loadOwned(c);
  const body = await parseBody(c, SubmitDecisionRequest);
  const next = unwrap(submitDecision(toState(session), { ...body, submittedAt: nowIso() }));
  const saved = await saveState(db, session.id, next);
  await appendMessage(db, {
    sessionId: session.id,
    userId: c.get("user").id,
    role: "system",
    kind: "phase_change",
    phase: saved.phase,
    content: "Decision recorded. The debrief is now available.",
  });
  return c.json({ session: saved, released: released(saved, exercise) });
});

sessionRoutes.post("/:sessionId/advance", async (c) => {
  const { db, session, exercise } = await loadOwned(c);
  const user = c.get("user");
  const body = await parseBody(c, AdvancePhaseRequest);
  let next = unwrap(transition(toState(session), body.to));
  let completedAt: Date | undefined;
  if (next.phase === "completed") {
    // Reaching the end closes the session and counts toward the streak.
    next = unwrap(complete(next));
    completedAt = new Date();
    const profile = await ensureProfile(db, user);
    await updateStats(db, user.id, recordCompletion(profile.stats, utcDateKey(completedAt.toISOString())));
  }
  const saved = await saveState(db, session.id, next, completedAt ? { completedAt } : {});
  await appendMessage(db, {
    sessionId: session.id,
    userId: user.id,
    role: "system",
    kind: "phase_change",
    phase: saved.phase,
    content: saved.status === "completed" ? "Session completed." : `Phase: ${saved.phase.replace(/_/g, " ")}.`,
  });
  return c.json({ session: saved, released: released(saved, exercise) });
});

sessionRoutes.post("/:sessionId/abandon", async (c) => {
  const { db, session } = await loadOwned(c);
  const next = unwrap(abandon(toState(session)));
  const saved = await saveState(db, session.id, next);
  return c.json(SessionMutationResponse.parse({ session: saved }));
});
