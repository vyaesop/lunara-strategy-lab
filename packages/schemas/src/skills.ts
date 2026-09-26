import { z } from "zod";
import { DocumentId, IsoTimestamp, PersistedMeta, UnitInterval } from "./common";

/**
 * Skill dimensions tracked in the strategic profile. Each has an explicit
 * definition, scoring method and evidence source in
 * `@lunara/core/skills/definitions`. Never presented as intelligence scores.
 */
export const SkillId = z.enum([
  "hypothesis_generation",
  "evidence_evaluation",
  "logical_validity",
  "strategic_foresight",
  "planning",
  "risk_assessment",
  "information_gathering",
  "negotiation",
  "calibration",
  "adaptability",
  "systems_thinking",
  "decision_quality",
  "learning_retention",
]);
export type SkillId = z.infer<typeof SkillId>;
export const SKILL_IDS = SkillId.options;

export const SkillEvidenceRef = z.object({
  sessionId: DocumentId,
  exerciseId: DocumentId,
  /** Observed score for this skill in that session, 0..1. */
  score: UnitInterval,
  /** Hint level used in the session (0 = unaided). */
  hintLevel: z.number().int().min(0).max(5),
  /** Change applied to the estimate. */
  delta: z.number().min(-1).max(1),
  note: z.string().max(280).optional(),
  at: IsoTimestamp,
});
export type SkillEvidenceRef = z.infer<typeof SkillEvidenceRef>;

export const SkillAssessment = PersistedMeta.extend({
  skillId: SkillId,
  /** Current estimate of demonstrated ability, 0..1. */
  estimate: UnitInterval,
  /** Estimate from unaided (hint-free) evidence only; null until observed. */
  unaidedEstimate: UnitInterval.nullable(),
  /** How much evidence backs the estimate, 0..1 (derived from evidenceCount). */
  confidence: UnitInterval,
  evidenceCount: z.number().int().min(0),
  lastEvidenceAt: IsoTimestamp.nullable(),
  /** Bounded recent history for explanations and trend display. */
  recentEvidence: z.array(SkillEvidenceRef).max(10),
});
export type SkillAssessment = z.infer<typeof SkillAssessment>;
