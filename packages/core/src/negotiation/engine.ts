import type { NegotiationDefinition, Proposal } from "@lunara/schemas";

/**
 * Deterministic counterpart logic. The model never decides whether a deal
 * is acceptable; it only phrases what this engine decided.
 */
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Normalise an issue value to 0..1 in the direction a party prefers. */
export function normalise(def: NegotiationDefinition, key: string, value: number, prefersHigh: boolean): number {
  const issue = def.public.issues.find((i) => i.key === key);
  if (!issue) return 0;
  const span = issue.max - issue.min || 1;
  const t = clamp01((value - issue.min) / span);
  return prefersHigh ? t : 1 - t;
}

export function counterpartUtility(def: NegotiationDefinition, terms: Proposal): number {
  let total = 0;
  let weightSum = 0;
  for (const issue of def.public.issues) {
    const w = def.hidden.weights[issue.key] ?? 0;
    const prefersHigh = def.hidden.counterpartPrefersHigh[issue.key] ?? !issue.userPrefersHigh;
    total += w * normalise(def, issue.key, terms[issue.key] ?? issue.min, prefersHigh);
    weightSum += w;
  }
  return weightSum ? clamp01(total / weightSum) : 0;
}

/** User-side value relative to the reference deal (1 = as good as the reference, can exceed). */
export function userValue(def: NegotiationDefinition, terms: Proposal): number {
  let total = 0;
  let ref = 0;
  for (const issue of def.public.issues) {
    total += normalise(def, issue.key, terms[issue.key] ?? issue.min, issue.userPrefersHigh);
    ref += normalise(def, issue.key, def.hidden.referenceDeal[issue.key] ?? issue.min, issue.userPrefersHigh);
  }
  return ref ? clamp01(total / ref) : 0;
}

export function acceptanceThreshold(def: NegotiationDefinition, round: number): number {
  return Math.max(def.hidden.floor, def.hidden.acceptThreshold - def.hidden.patienceDecay * Math.max(0, round - 1));
}

/** Validate a proposal: every issue present and within range, snapped to step. */
export function validateProposal(def: NegotiationDefinition, terms: Proposal): { ok: true; terms: Proposal } | { ok: false; reason: string } {
  const out: Proposal = {};
  for (const issue of def.public.issues) {
    const v = terms[issue.key];
    if (v === undefined || Number.isNaN(v)) return { ok: false, reason: `Missing value for ${issue.label}.` };
    if (v < issue.min || v > issue.max) return { ok: false, reason: `${issue.label} must be between ${issue.min} and ${issue.max}.` };
    out[issue.key] = Math.round(v / issue.step) * issue.step;
  }
  return { ok: true, terms: out };
}

export type CounterpartDecision =
  | { kind: "accept"; utility: number; threshold: number }
  | { kind: "counter"; utility: number; threshold: number; counter: Proposal }
  | { kind: "reject"; utility: number; threshold: number };

/**
 * Decide on a user proposal. Accept when utility clears the (decaying)
 * threshold. Otherwise counter by conceding on the counterpart's
 * least-weighted issues first, moving a fraction toward the user's ask,
 * until the counter's utility is just above threshold. If no counter can
 * be constructed within range, reject.
 */
export function respondToProposal(def: NegotiationDefinition, terms: Proposal, round: number, lastCounter: Proposal | null): CounterpartDecision {
  const utility = counterpartUtility(def, terms);
  const threshold = acceptanceThreshold(def, round);
  if (utility >= threshold) return { kind: "accept", utility, threshold };

  const base: Proposal = { ...(lastCounter ?? def.hidden.opening) };
  const order = [...def.public.issues].sort((a, b) => (def.hidden.weights[a.key] ?? 0) - (def.hidden.weights[b.key] ?? 0));
  const counter: Proposal = { ...base };
  // Move each issue a third of the way toward the user's ask, cheapest concessions first, stopping when still acceptable.
  for (const issue of order) {
    const from = counter[issue.key] ?? issue.min;
    const to = terms[issue.key] ?? from;
    const moved = from + (to - from) / 3;
    const snapped = Math.round(moved / issue.step) * issue.step;
    const trial = { ...counter, [issue.key]: snapped };
    if (counterpartUtility(def, trial) >= threshold) counter[issue.key] = snapped;
  }
  const same = def.public.issues.every((i) => counter[i.key] === base[i.key]);
  if (same && round >= def.public.maxRounds) return { kind: "reject", utility, threshold };
  return { kind: "counter", utility, threshold, counter };
}
