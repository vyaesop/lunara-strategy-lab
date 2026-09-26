import type {
  EvidenceItem,
  InvestigationConclusion,
  InvestigationDefinition,
  InvestigationHypothesis,
  InvestigationSession,
} from "@lunara/schemas";

/**
 * Deterministic investigation engine. Evidence release follows the scenario
 * definition, never the model. All functions are pure; the API persists the
 * returned state.
 */
export type InvestigationState = Pick<
  InvestigationSession,
  "status" | "pointsRemaining" | "revealedEvidenceIds" | "actionsTaken" | "hypotheses" | "confidenceHistory" | "hintLevel" | "conclusion"
>;

export type EngineErrorCode =
  | "not_active"
  | "unknown_action"
  | "action_already_taken"
  | "insufficient_points"
  | "prerequisite_missing"
  | "unknown_evidence"
  | "evidence_not_revealed"
  | "unknown_hypothesis"
  | "too_many_hypotheses"
  | "no_hypothesis"
  | "hint_out_of_order"
  | "hint_requires_attempt";

export type EngineResult<T = InvestigationState> = { ok: true; state: T } | { ok: false; code: EngineErrorCode; reason: string };

const fail = (code: EngineErrorCode, reason: string): EngineResult => ({ ok: false, code, reason });

export const MAX_HYPOTHESES = 10;

export function initialState(def: InvestigationDefinition): InvestigationState {
  return {
    status: "active",
    pointsRemaining: def.public.budget,
    revealedEvidenceIds: def.hidden.evidence.filter((e) => e.initial).map((e) => e.id),
    actionsTaken: [],
    hypotheses: [],
    confidenceHistory: [],
    hintLevel: 0,
    conclusion: null,
  };
}

export function revealedEvidence(state: InvestigationState, def: InvestigationDefinition): EvidenceItem[] {
  const ids = new Set(state.revealedEvidenceIds);
  return def.hidden.evidence.filter((e) => ids.has(e.id));
}

export function isActionAvailable(state: InvestigationState, def: InvestigationDefinition, actionId: string): EngineResult<true> {
  if (state.status !== "active") return fail("not_active", "Investigation is not active.") as EngineResult<true>;
  const action = def.public.actions.find((a) => a.id === actionId);
  if (!action) return fail("unknown_action", "Unknown action.") as EngineResult<true>;
  if (state.actionsTaken.some((a) => a.actionId === actionId)) return fail("action_already_taken", "You have already taken this action.") as EngineResult<true>;
  if (action.cost > state.pointsRemaining) return fail("insufficient_points", `This action costs ${action.cost}; you have ${state.pointsRemaining}.`) as EngineResult<true>;
  const revealed = new Set(state.revealedEvidenceIds);
  const missing = action.requiresEvidence.filter((id) => !revealed.has(id));
  if (missing.length) return fail("prerequisite_missing", "This action depends on evidence you have not uncovered yet.") as EngineResult<true>;
  return { ok: true, state: true };
}

export function performAction(state: InvestigationState, def: InvestigationDefinition, actionId: string, at: string): EngineResult {
  const check = isActionAvailable(state, def, actionId);
  if (!check.ok) return check as EngineResult;
  const action = def.public.actions.find((a) => a.id === actionId)!;
  const reveals = def.hidden.actionReveals[actionId] ?? [];
  const already = new Set(state.revealedEvidenceIds);
  const newlyRevealed = reveals.filter((id) => !already.has(id));
  return {
    ok: true,
    state: {
      ...state,
      pointsRemaining: state.pointsRemaining - action.cost,
      revealedEvidenceIds: [...state.revealedEvidenceIds, ...newlyRevealed],
      actionsTaken: [...state.actionsTaken, { actionId, cost: action.cost, revealedEvidenceIds: newlyRevealed, at }],
    },
  };
}

function validateLinks(state: InvestigationState, def: InvestigationDefinition, hyp: Pick<InvestigationHypothesis, "links" | "answerEntityId">): EngineResult<true> {
  const known = new Set(def.hidden.evidence.map((e) => e.id));
  const revealed = new Set(state.revealedEvidenceIds);
  for (const l of hyp.links) {
    if (!known.has(l.evidenceId)) return fail("unknown_evidence", "A link refers to evidence that does not exist.") as EngineResult<true>;
    if (!revealed.has(l.evidenceId)) return fail("evidence_not_revealed", "You can only link evidence you have uncovered.") as EngineResult<true>;
  }
  if (hyp.answerEntityId && !def.public.entities.some((e) => e.id === hyp.answerEntityId && e.candidate)) {
    return fail("unknown_evidence", "The named entity is not a candidate answer.") as EngineResult<true>;
  }
  return { ok: true, state: true };
}

export function addHypothesis(state: InvestigationState, def: InvestigationDefinition, hyp: InvestigationHypothesis): EngineResult {
  if (state.status !== "active") return fail("not_active", "Investigation is not active.");
  if (state.hypotheses.length >= MAX_HYPOTHESES) return fail("too_many_hypotheses", `At most ${MAX_HYPOTHESES} hypotheses.`);
  const v = validateLinks(state, def, hyp);
  if (!v.ok) return v as EngineResult;
  if (hyp.revisesId && !state.hypotheses.some((h) => h.id === hyp.revisesId)) return fail("unknown_hypothesis", "revisesId does not exist.");
  const hypotheses = state.hypotheses.map((h) => (hyp.revisesId && h.id === hyp.revisesId && h.status === "active" ? { ...h, status: "revised" as const } : h));
  return {
    ok: true,
    state: {
      ...state,
      hypotheses: [...hypotheses, hyp],
      confidenceHistory: [...state.confidenceHistory, { hypothesisId: hyp.id, confidence: hyp.confidence, at: hyp.createdAt }].slice(-200),
    },
  };
}

export function updateHypothesis(
  state: InvestigationState,
  def: InvestigationDefinition,
  id: string,
  patch: Partial<Omit<InvestigationHypothesis, "id" | "createdAt" | "status" | "revisesId">>,
  at: string,
): EngineResult {
  if (state.status !== "active") return fail("not_active", "Investigation is not active.");
  const existing = state.hypotheses.find((h) => h.id === id);
  if (!existing || existing.status === "discarded") return fail("unknown_hypothesis", "Hypothesis not found.");
  const next: InvestigationHypothesis = { ...existing, ...patch, updatedAt: at };
  const v = validateLinks(state, def, next);
  if (!v.ok) return v as EngineResult;
  const confidenceChanged = patch.confidence !== undefined && patch.confidence !== existing.confidence;
  return {
    ok: true,
    state: {
      ...state,
      hypotheses: state.hypotheses.map((h) => (h.id === id ? next : h)),
      confidenceHistory: confidenceChanged
        ? [...state.confidenceHistory, { hypothesisId: id, confidence: next.confidence, at }].slice(-200)
        : state.confidenceHistory,
    },
  };
}

export function discardInvestigationHypothesis(state: InvestigationState, id: string): EngineResult {
  if (state.status !== "active") return fail("not_active", "Investigation is not active.");
  if (!state.hypotheses.some((h) => h.id === id)) return fail("unknown_hypothesis", "Hypothesis not found.");
  return { ok: true, state: { ...state, hypotheses: state.hypotheses.map((h) => (h.id === id ? { ...h, status: "discarded" as const } : h)) } };
}

export function requestHint(state: InvestigationState, level: number): EngineResult {
  if (state.status !== "active") return fail("not_active", "Investigation is not active.");
  if (level !== state.hintLevel + 1 || level < 1 || level > 5) return fail("hint_out_of_order", `Next hint is level ${state.hintLevel + 1}.`);
  if (level === 5 && !state.hypotheses.some((h) => h.status !== "discarded")) return fail("hint_requires_attempt", "Record a hypothesis before the worked explanation.");
  return { ok: true, state: { ...state, hintLevel: level } };
}

export function conclude(state: InvestigationState, conclusion: InvestigationConclusion): EngineResult {
  if (state.status !== "active") return fail("not_active", "Investigation is not active.");
  const hyp = state.hypotheses.find((h) => h.id === conclusion.hypothesisId && h.status !== "discarded");
  if (!hyp) return fail("no_hypothesis", "Conclude with one of your active hypotheses.");
  return {
    ok: true,
    state: {
      ...state,
      conclusion,
      status: "completed",
      confidenceHistory: [...state.confidenceHistory, { hypothesisId: hyp.id, confidence: conclusion.confidence, at: conclusion.submittedAt }].slice(-200),
    },
  };
}

export function abandonInvestigation(state: InvestigationState): EngineResult {
  if (state.status !== "active") return fail("not_active", "Investigation is not active.");
  return { ok: true, state: { ...state, status: "abandoned" } };
}

// ── Deterministic evaluation ────────────────────────────────────────────────

export interface DeterministicEvaluation {
  correct: boolean | null;
  evidenceCoverage: number;
  contradictionAwareness: number;
  misledByCount: number;
  competingHypotheses: number;
  pointsUsed: number;
  /** Key evidence never uncovered, for the debrief. */
  missedKeyEvidenceIds: string[];
}

/**
 * Scores what can be scored without a model:
 *  - correct: concluded hypothesis names the ground-truth entity (null for open cases)
 *  - evidenceCoverage: share of key evidence that was uncovered AND linked on the concluded hypothesis
 *  - contradictionAwareness: of the key evidence the learner linked, the share where their relation
 *    matches the truth-implied relation when the hypothesis is wrong (i.e. they noticed the contradiction)
 *  - misledByCount: misleading evidence linked as strong support
 */
export function evaluateDeterministic(state: InvestigationState, def: InvestigationDefinition): DeterministicEvaluation {
  const truth = def.hidden.groundTruth;
  const concluded = state.conclusion ? state.hypotheses.find((h) => h.id === state.conclusion!.hypothesisId) : undefined;
  const links = concluded?.links ?? [];
  const linked = new Map(links.map((l) => [l.evidenceId, l]));
  const revealed = new Set(state.revealedEvidenceIds);

  const correct = truth.answerEntityId === null ? null : concluded ? concluded.answerEntityId === truth.answerEntityId : false;
  const key = truth.keyEvidenceIds;
  const covered = key.filter((id) => revealed.has(id) && linked.has(id)).length;
  const evidenceCoverage = key.length ? covered / key.length : 0;

  // Contradiction awareness: for an incorrect conclusion, key evidence should have been linked as contradicting.
  // For a correct conclusion, key evidence linked as supporting counts as awareness of what carries the case.
  const keyLinked = key.filter((id) => linked.has(id));
  let aware = 0;
  for (const id of keyLinked) {
    const rel = linked.get(id)!.relation;
    if (correct === false && rel === "contradicts") aware++;
    if (correct !== false && rel === "supports") aware++;
  }
  const contradictionAwareness = keyLinked.length ? aware / keyLinked.length : 0;

  const misledByCount = truth.misleadingEvidenceIds.filter((id) => {
    const l = linked.get(id);
    return l && l.relation === "supports" && l.weight >= 2;
  }).length;

  return {
    correct,
    evidenceCoverage,
    contradictionAwareness,
    misledByCount,
    competingHypotheses: state.hypotheses.filter((h) => h.status !== "discarded").length,
    pointsUsed: def.public.budget - state.pointsRemaining,
    missedKeyEvidenceIds: key.filter((id) => !revealed.has(id)),
  };
}
