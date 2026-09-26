import type { CriterionEvaluation, OutcomeQuality, RubricCriterion, SkillId } from "@lunara/schemas";

/** Constants for separating assisted performance from unaided mastery. */
export const UNAIDED_HINT_DISCOUNT = 0.12;
export const REVEALED_BEFORE_DECISION_CAP = 0.3;
export const WELL_SUPPORTED_THRESHOLD = 0.6;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export class RubricError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RubricError";
  }
}

/** Weighted mean over all criteria. Every criterion must be evaluated exactly once. */
export function aggregateRubric(criteria: RubricCriterion[], evaluations: CriterionEvaluation[]): number {
  if (criteria.length === 0) throw new RubricError("Rubric has no criteria.");
  const byId = new Map(evaluations.map((e) => [e.criterionId, e]));
  if (byId.size !== evaluations.length) throw new RubricError("Duplicate criterion evaluation.");
  let weighted = 0;
  let total = 0;
  for (const c of criteria) {
    const e = byId.get(c.id);
    if (!e) throw new RubricError(`Missing evaluation for criterion ${c.id}.`);
    weighted += c.weight * clamp01(e.score);
    total += c.weight;
  }
  for (const id of byId.keys()) {
    if (!criteria.some((c) => c.id === id)) throw new RubricError(`Unknown criterion ${id}.`);
  }
  return clamp01(weighted / total);
}

/** Per-skill weighted means, for the skills that the rubric tags. */
export function skillScoresFromRubric(
  criteria: RubricCriterion[],
  evaluations: CriterionEvaluation[],
): Array<{ skillId: SkillId; score: number }> {
  const byId = new Map(evaluations.map((e) => [e.criterionId, e]));
  const acc = new Map<SkillId, { weighted: number; total: number }>();
  for (const c of criteria) {
    const e = byId.get(c.id);
    if (!e) throw new RubricError(`Missing evaluation for criterion ${c.id}.`);
    const cur = acc.get(c.skill) ?? { weighted: 0, total: 0 };
    cur.weighted += c.weight * clamp01(e.score);
    cur.total += c.weight;
    acc.set(c.skill, cur);
  }
  return [...acc.entries()].map(([skillId, { weighted, total }]) => ({
    skillId,
    score: clamp01(weighted / total),
  }));
}

/**
 * Unaided score: the overall score discounted for hints and capped when the
 * solution was revealed before the decision. Requesting help is not punished
 * in the overall score; this value exists to keep the two apart.
 */
export function unaidedScore(overall: number, hintLevel: number, revealedBeforeDecision: boolean): number {
  const discounted = clamp01(overall) * (1 - UNAIDED_HINT_DISCOUNT * Math.min(5, Math.max(0, hintLevel)));
  return revealedBeforeDecision ? Math.min(discounted, REVEALED_BEFORE_DECISION_CAP) : clamp01(discounted);
}

/**
 * Separate luck from judgement. `correct` is null for open exercises.
 * `supportScore` is the rubric aggregate for reasoning quality.
 */
export function classifyOutcome(correct: boolean | null, supportScore: number): OutcomeQuality {
  if (correct === null) return "not_applicable";
  const supported = supportScore >= WELL_SUPPORTED_THRESHOLD;
  if (correct) return supported ? "correct_well_supported" : "correct_by_coincidence";
  return supported ? "incorrect_reasonably_justified" : "incorrect_poorly_supported";
}
