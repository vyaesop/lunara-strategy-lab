import {
  SESSION_PHASES,
  type CoachingSession,
  type ExerciseHidden,
  type HintLevel,
  type SessionDecision,
  type SessionPhase,
  type UserHypothesis,
} from "@lunara/schemas";

/**
 * Pure, server-authoritative session state machine.
 *
 * Nothing here touches Firebase or the network. Route handlers load the
 * session, call these functions, and persist the result. The AI may only
 * *propose* transitions; the server applies them through `transition`.
 */

export type SessionState = Pick<
  CoachingSession,
  "phase" | "status" | "hintLevel" | "revealed" | "hypotheses" | "decision"
>;

export type MachineErrorCode =
  | "session_not_active"
  | "illegal_transition"
  | "missing_hypothesis"
  | "missing_decision"
  | "hint_out_of_order"
  | "hint_requires_attempt"
  | "phase_disallows_action"
  | "reveal_requires_attempt";

export type MachineResult<T = SessionState> =
  | { ok: true; state: T }
  | { ok: false; code: MachineErrorCode; reason: string };

const fail = (code: MachineErrorCode, reason: string): MachineResult => ({ ok: false, code, reason });

export const REASONING_PHASES: readonly SessionPhase[] = [
  "initial_understanding",
  "hypothesis",
  "evidence_challenge",
  "revision",
  "final_decision",
];

export const HYPOTHESIS_PHASES: readonly SessionPhase[] = [
  "initial_understanding",
  "hypothesis",
  "evidence_challenge",
  "revision",
];

/** Backward loops the learning flow explicitly permits. */
const ALLOWED_LOOPS: ReadonlyArray<readonly [SessionPhase, SessionPhase]> = [
  ["evidence_challenge", "hypothesis"],
  ["revision", "evidence_challenge"],
  ["revision", "hypothesis"],
];

export function phaseIndex(phase: SessionPhase): number {
  return SESSION_PHASES.indexOf(phase);
}

export function isAtOrAfter(phase: SessionPhase, target: SessionPhase): boolean {
  return phaseIndex(phase) >= phaseIndex(target);
}

export function nextPhase(phase: SessionPhase): SessionPhase | null {
  const i = phaseIndex(phase);
  return SESSION_PHASES[i + 1] ?? null;
}

export function hasGenuineAttempt(state: SessionState): boolean {
  return state.hypotheses.some((h) => h.status !== "discarded") || state.decision !== null;
}

/** Whether the solution may be shown to the user right now. */
export function canRevealSolution(state: SessionState): boolean {
  return state.revealed || state.decision !== null || isAtOrAfter(state.phase, "debrief");
}

/**
 * Validate a requested phase change. Legal moves are one step forward, or
 * one of the explicit loops. Forward moves carry preconditions so the model
 * cannot rush the learner to the answer.
 */
export function canTransition(state: SessionState, to: SessionPhase): MachineResult {
  if (state.status !== "active") return fail("session_not_active", "Session is not active.");
  const from = state.phase;
  if (from === to) return fail("illegal_transition", `Already in phase ${to}.`);

  const forward = nextPhase(from) === to;
  const loop = ALLOWED_LOOPS.some(([a, b]) => a === from && b === to);
  if (!forward && !loop) {
    return fail("illegal_transition", `Cannot move from ${from} to ${to}.`);
  }

  if (to === "final_decision" && !hasGenuineAttempt(state) && !state.revealed) {
    return fail("missing_hypothesis", "Submit at least one hypothesis or plan before deciding.");
  }
  if (to === "debrief" && state.decision === null && !state.revealed) {
    return fail("missing_decision", "A decision or an explicit reveal is required before the debrief.");
  }
  return { ok: true, state: { ...state, phase: to } };
}

export function transition(state: SessionState, to: SessionPhase): MachineResult {
  return canTransition(state, to);
}

/** Validate a hint request. Hints are strictly sequential (n = current + 1). */
export function canRequestHint(state: SessionState, level: HintLevel): MachineResult {
  if (state.status !== "active") return fail("session_not_active", "Session is not active.");
  if (!REASONING_PHASES.includes(state.phase)) {
    return fail("phase_disallows_action", `Hints are not available during ${state.phase}.`);
  }
  if (level !== state.hintLevel + 1 || level < 1 || level > 5) {
    return fail("hint_out_of_order", `Next available hint level is ${state.hintLevel + 1}.`);
  }
  if (level === 5 && !hasGenuineAttempt(state)) {
    return fail("hint_requires_attempt", "The worked explanation unlocks after you record an attempt.");
  }
  return {
    ok: true,
    state: { ...state, hintLevel: level, revealed: level === 5 ? true : state.revealed },
  };
}

/** User explicitly asks for the solution after a genuine attempt. */
export function requestReveal(state: SessionState): MachineResult {
  if (state.status !== "active") return fail("session_not_active", "Session is not active.");
  if (state.revealed) return { ok: true, state };
  if (!hasGenuineAttempt(state)) {
    return fail("reveal_requires_attempt", "Record a hypothesis or decision before revealing the solution.");
  }
  return { ok: true, state: { ...state, revealed: true } };
}

export function submitHypothesis(state: SessionState, hypothesis: UserHypothesis): MachineResult {
  if (state.status !== "active") return fail("session_not_active", "Session is not active.");
  if (!HYPOTHESIS_PHASES.includes(state.phase)) {
    return fail("phase_disallows_action", `Hypotheses cannot be added during ${state.phase}.`);
  }
  const hypotheses = state.hypotheses.map((h) =>
    hypothesis.revisesId && h.id === hypothesis.revisesId && h.status === "active"
      ? { ...h, status: "revised" as const }
      : h,
  );
  hypotheses.push(hypothesis);
  // Convenience: recording a first hypothesis moves the learner into the hypothesis phase.
  const phase = state.phase === "initial_understanding" ? "hypothesis" : state.phase;
  return { ok: true, state: { ...state, hypotheses, phase } };
}

export function discardHypothesis(state: SessionState, hypothesisId: string): MachineResult {
  if (state.status !== "active") return fail("session_not_active", "Session is not active.");
  const hypotheses = state.hypotheses.map((h) =>
    h.id === hypothesisId ? { ...h, status: "discarded" as const } : h,
  );
  return { ok: true, state: { ...state, hypotheses } };
}

export function submitDecision(state: SessionState, decision: SessionDecision): MachineResult {
  if (state.status !== "active") return fail("session_not_active", "Session is not active.");
  if (state.phase !== "final_decision") {
    return fail("phase_disallows_action", "Decisions are recorded in the final decision phase.");
  }
  return { ok: true, state: { ...state, decision, phase: "debrief" } };
}

export function abandon(state: SessionState): MachineResult {
  if (state.status !== "active") return fail("session_not_active", "Session is not active.");
  return { ok: true, state: { ...state, status: "abandoned" } };
}

export function complete(state: SessionState): MachineResult {
  if (state.status !== "active") return fail("session_not_active", "Session is not active.");
  if (state.phase !== "skill_update" && state.phase !== "completed") {
    return fail("illegal_transition", "Complete the debrief and skill update first.");
  }
  return { ok: true, state: { ...state, phase: "completed", status: "completed" } };
}

/**
 * The single gate deciding which hidden material a client may see.
 * Everything not returned here stays on the server.
 */
export interface ReleasedMaterial {
  hints: string[];
  solution: string | null;
  keyInsights: string[] | null;
  debrief: string | null;
}

export function releaseHiddenMaterial(state: SessionState, hidden: ExerciseHidden): ReleasedMaterial {
  const solutionVisible = canRevealSolution(state);
  const debriefVisible = isAtOrAfter(state.phase, "debrief") || state.status === "completed";
  return {
    hints: hidden.hints.slice(0, state.hintLevel),
    solution: solutionVisible ? hidden.solution : null,
    keyInsights: solutionVisible ? hidden.keyInsights : null,
    debrief: debriefVisible ? hidden.debrief : null,
  };
}
