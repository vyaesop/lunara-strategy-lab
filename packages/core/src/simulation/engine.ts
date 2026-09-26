import type { SimDecision, SimOption, SimTurn, SimulationDefinition, SimulationSession, TurnView } from "@lunara/schemas";

/**
 * Deterministic turn engine. Resources, availability, effects and branching
 * come from the scenario definition. AI never changes state.
 */
export type SimState = Pick<SimulationSession, "status" | "currentTurnId" | "resources" | "decisions" | "revealedEvidenceIds" | "log" | "hintLevel">;

export type SimErrorCode = "not_active" | "unknown_turn" | "unknown_option" | "option_unavailable" | "hint_out_of_order";
export type SimResult<T = SimState> = { ok: true; state: T } | { ok: false; code: SimErrorCode; reason: string };
const fail = (code: SimErrorCode, reason: string): SimResult => ({ ok: false, code, reason });

type Condition = SimOption["requires"][number];

export function initialSimState(def: SimulationDefinition, at: string): SimState {
  const first = def.hidden.turns[0]!;
  return {
    status: "active",
    currentTurnId: first.id,
    resources: Object.fromEntries(def.public.resources.map((r) => [r.key, r.initial])),
    decisions: [],
    revealedEvidenceIds: [],
    log: [{ turnId: first.id, kind: "situation", text: first.situation, at }],
    hintLevel: 0,
  };
}

export function findTurn(def: SimulationDefinition, id: string | null): SimTurn | null {
  return id ? (def.hidden.turns.find((t) => t.id === id) ?? null) : null;
}

export function conditionMet(resources: Record<string, number>, c: Condition): boolean {
  const v = resources[c.resource] ?? 0;
  switch (c.op) {
    case ">=": return v >= c.value;
    case "<=": return v <= c.value;
    case ">": return v > c.value;
    case "<": return v < c.value;
    case "==": return v === c.value;
  }
}

export function applyEffects(def: SimulationDefinition, resources: Record<string, number>, effects: Array<{ resource: string; delta: number }>): Record<string, number> {
  const next = { ...resources };
  for (const e of effects) {
    const spec = def.public.resources.find((r) => r.key === e.resource);
    let v = (next[e.resource] ?? 0) + e.delta;
    if (spec?.min !== null && spec?.min !== undefined) v = Math.max(spec.min, v);
    if (spec?.max !== null && spec?.max !== undefined) v = Math.min(spec.max, v);
    next[e.resource] = Math.round(v * 100) / 100;
  }
  return next;
}

/** Player-facing view of a turn: hidden facts and effects stripped, availability computed. */
export function turnView(def: SimulationDefinition, state: SimState): TurnView | null {
  const turn = findTurn(def, state.currentTurnId);
  if (!turn) return null;
  return {
    id: turn.id,
    title: turn.title,
    situation: turn.situation,
    intelligence: turn.intelligence,
    options: turn.options.map((o) => ({
      id: o.id,
      label: o.label,
      description: o.description,
      requires: o.requires,
      available: o.requires.every((c) => conditionMet(state.resources, c)),
    })),
    terminal: turn.terminal,
  };
}

/** Resources as the player sees them: hidden ones are reported as a band. */
export function visibleResources(def: SimulationDefinition, resources: Record<string, number>): Array<{ key: string; label: string; value: number | null; band: "low" | "mid" | "high" | null }> {
  return def.public.resources.map((r) => {
    const v = resources[r.key] ?? r.initial;
    if (r.visible) return { key: r.key, label: r.label, value: v, band: null };
    const lo = r.min ?? 0;
    const hi = r.max ?? Math.max(r.initial * 2, lo + 1);
    const p = (v - lo) / (hi - lo || 1);
    return { key: r.key, label: r.label, value: null, band: p < 0.34 ? "low" : p < 0.67 ? "mid" : "high" };
  });
}

export interface DecideInput {
  turnId: string;
  optionId: string;
  rationale: string;
  confidence: number | null;
  at: string;
}

export interface DecideOutcome {
  state: SimState;
  option: SimOption;
  /** Text the player is shown after deciding. */
  narration: Array<{ kind: "consequence" | "counterfactual"; text: string }>;
  ended: boolean;
}

export function decide(def: SimulationDefinition, state: SimState, input: DecideInput): SimResult<DecideOutcome> {
  if (state.status !== "active") return fail("not_active", "Simulation is not active.") as SimResult<DecideOutcome>;
  const turn = findTurn(def, state.currentTurnId);
  if (!turn || turn.id !== input.turnId) return fail("unknown_turn", "That is not the current turn.") as SimResult<DecideOutcome>;
  const option = turn.options.find((o) => o.id === input.optionId);
  if (!option) return fail("unknown_option", "Unknown option.") as SimResult<DecideOutcome>;
  if (!option.requires.every((c) => conditionMet(state.resources, c))) {
    return fail("option_unavailable", "That option's requirements are not met.") as SimResult<DecideOutcome>;
  }

  let resources = applyEffects(def, state.resources, option.effects);
  const narration: DecideOutcome["narration"] = [];
  const log = [...state.log];
  if (option.counterfactualNote) {
    narration.push({ kind: "counterfactual", text: option.counterfactualNote });
    log.push({ turnId: turn.id, kind: "counterfactual", text: option.counterfactualNote, at: input.at });
  }
  let nextTurnId: string | null = null;
  if (option.consequence) {
    resources = applyEffects(def, resources, option.consequence.effects);
    narration.push({ kind: "consequence", text: option.consequence.narration });
    log.push({ turnId: turn.id, kind: "consequence", text: option.consequence.narration, at: input.at });
    nextTurnId = option.consequence.nextTurnId;
  }
  if (!nextTurnId && !turn.terminal) {
    const idx = def.hidden.turns.findIndex((t) => t.id === turn.id);
    nextTurnId = def.hidden.turns[idx + 1]?.id ?? null;
  }
  const ended = turn.terminal || nextTurnId === null;
  const nextTurn = ended ? null : findTurn(def, nextTurnId);
  if (nextTurn) log.push({ turnId: nextTurn.id, kind: "situation", text: nextTurn.situation, at: input.at });

  const decision: SimDecision = {
    turnId: turn.id,
    optionId: option.id,
    rationale: input.rationale,
    confidence: input.confidence,
    resourcesAfter: resources,
    historicalMatch: option.historicalMatch,
    at: input.at,
  };
  const revealed = new Set(state.revealedEvidenceIds);
  for (const id of option.reveals) revealed.add(id);

  return {
    ok: true,
    state: {
      state: {
        ...state,
        status: ended ? "completed" : "active",
        currentTurnId: ended ? null : nextTurnId,
        resources,
        decisions: [...state.decisions, decision],
        revealedEvidenceIds: [...revealed],
        log: log.slice(-120),
      },
      option,
      narration,
      ended,
    },
  };
}

export function requestSimHint(state: SimState, level: number): SimResult {
  if (state.status !== "active") return fail("not_active", "Simulation is not active.");
  if (level !== state.hintLevel + 1 || level < 1 || level > 5) return fail("hint_out_of_order", `Next hint is level ${state.hintLevel + 1}.`);
  return { ok: true, state: { ...state, hintLevel: level } };
}

export function abandonSim(state: SimState): SimResult {
  if (state.status !== "active") return fail("not_active", "Simulation is not active.");
  return { ok: true, state: { ...state, status: "abandoned" } };
}

/** Validate a definition's graph: every option leads somewhere reachable; effects reference known resources. */
export function validateSimulation(def: SimulationDefinition): string[] {
  const errors: string[] = [];
  const turnIds = new Set(def.hidden.turns.map((t) => t.id));
  const resourceKeys = new Set(def.public.resources.map((r) => r.key));
  const sourceIds = new Set(def.public.sources.map((s) => s.id));
  for (const t of def.hidden.turns) {
    for (const o of t.options) {
      for (const e of [...o.effects, ...(o.consequence?.effects ?? [])]) if (!resourceKeys.has(e.resource)) errors.push(`${t.id}/${o.id}: unknown resource ${e.resource}`);
      for (const c of o.requires) if (!resourceKeys.has(c.resource)) errors.push(`${t.id}/${o.id}: requires unknown resource ${c.resource}`);
      if (o.consequence?.nextTurnId && !turnIds.has(o.consequence.nextTurnId)) errors.push(`${t.id}/${o.id}: nextTurnId ${o.consequence.nextTurnId} unknown`);
      for (const r of o.reveals) if (!(r in def.hidden.evidence)) errors.push(`${t.id}/${o.id}: reveals unknown evidence ${r}`);
    }
    if (!t.options.some((o) => o.historicalMatch) && !t.terminal) {
      // Not an error: some turns are purely counterfactual branches. Flag only if no turn matches history at all.
    }
  }
  if (!def.hidden.turns.some((t) => t.options.some((o) => o.historicalMatch))) errors.push("no option is marked historicalMatch");
  for (const c of def.public.claims) for (const s of c.sourceIds) if (!sourceIds.has(s)) errors.push(`claim ${c.id}: unknown source ${s}`);
  for (const s of def.hidden.historicalRecord.sourceIds) if (!sourceIds.has(s)) errors.push(`historicalRecord: unknown source ${s}`);
  const rubricSkills = new Set(def.hidden.rubric.map((c) => c.skill));
  for (const d of def.public.expectedDimensions) if (!rubricSkills.has(d)) errors.push(`expectedDimension ${d} has no rubric criterion`);
  // Reachability from the first turn.
  const seen = new Set<string>();
  const stack = [def.hidden.turns[0]!.id];
  while (stack.length) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const t = def.hidden.turns.find((x) => x.id === id)!;
    const idx = def.hidden.turns.indexOf(t);
    for (const o of t.options) {
      const next = o.consequence?.nextTurnId ?? (t.terminal ? null : def.hidden.turns[idx + 1]?.id ?? null);
      if (next) stack.push(next);
    }
  }
  for (const t of def.hidden.turns) if (!seen.has(t.id)) errors.push(`turn ${t.id} unreachable`);
  return errors;
}
