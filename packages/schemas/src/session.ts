import { z } from "zod";
import {
  DocumentId,
  IsoTimestamp,
  LongText,
  MediumText,
  PersistedMeta,
  ShortText,
  UnitInterval,
} from "./common";
import { TrainingMode } from "./exercise";
import { SkillId } from "./skills";

export const SessionPhase = z.enum([
  "introduction",
  "initial_understanding",
  "hypothesis",
  "evidence_challenge",
  "revision",
  "final_decision",
  "debrief",
  "skill_update",
  "completed",
]);
export type SessionPhase = z.infer<typeof SessionPhase>;
export const SESSION_PHASES = SessionPhase.options;

export const SessionStatus = z.enum(["active", "completed", "abandoned"]);
export type SessionStatus = z.infer<typeof SessionStatus>;

export const HintLevel = z.number().int().min(0).max(5);
export type HintLevel = z.infer<typeof HintLevel>;

export const UserHypothesis = z.object({
  id: DocumentId,
  statement: MediumText,
  supportingEvidence: z.array(ShortText).max(10).default([]),
  contradictingEvidence: z.array(ShortText).max(10).default([]),
  assumptions: z.array(ShortText).max(10).default([]),
  confidence: UnitInterval,
  status: z.enum(["active", "revised", "discarded"]).default("active"),
  /** Id of the hypothesis this one revises, if any. */
  revisesId: DocumentId.nullable().default(null),
  createdAt: IsoTimestamp,
});
export type UserHypothesis = z.infer<typeof UserHypothesis>;

export const SessionDecision = z.object({
  text: MediumText,
  rationale: LongText,
  confidence: UnitInterval,
  submittedAt: IsoTimestamp,
});
export type SessionDecision = z.infer<typeof SessionDecision>;

export const CriterionEvaluation = z.object({
  criterionId: DocumentId,
  score: UnitInterval,
  /** Evidence from the user's own messages that justifies the score. */
  evidence: MediumText,
});
export type CriterionEvaluation = z.infer<typeof CriterionEvaluation>;

/** Classification of the relationship between correctness and support. */
export const OutcomeQuality = z.enum([
  "correct_well_supported",
  "correct_by_coincidence",
  "plausible_underdetermined",
  "incorrect_reasonably_justified",
  "incorrect_poorly_supported",
  "not_applicable",
]);
export type OutcomeQuality = z.infer<typeof OutcomeQuality>;

export const SessionAssessment = z.object({
  overallScore: UnitInterval,
  /** Score discounted for assistance; equals overallScore when hintLevel = 0. */
  unaidedScore: UnitInterval,
  hintLevelUsed: HintLevel,
  revealedBeforeDecision: z.boolean(),
  criteria: z.array(CriterionEvaluation).min(1),
  skillScores: z.array(z.object({ skillId: SkillId, score: UnitInterval })).min(1),
  /** For fixed-answer exercises: did the decision match the solution? Null for open exercises. */
  correct: z.boolean().nullable(),
  outcomeQuality: OutcomeQuality,
  strengths: z.array(ShortText).max(5),
  weaknesses: z.array(ShortText).max(5),
  /** Named recurring error patterns (curriculum inputs). */
  errorPatterns: z.array(z.string().max(60)).max(5),
  debrief: LongText,
  assessedAt: IsoTimestamp,
});
export type SessionAssessment = z.infer<typeof SessionAssessment>;

/** What the assessment model returns; the server computes aggregates and outcome quality itself. */
export const AssessmentDraft = z.object({
  criteria: z.array(CriterionEvaluation).min(1),
  correct: z.boolean().nullable(),
  strengths: z.array(ShortText).max(5),
  weaknesses: z.array(ShortText).max(5),
  errorPatterns: z.array(z.string().max(60)).max(5),
  debrief: LongText,
});
export type AssessmentDraft = z.infer<typeof AssessmentDraft>;

export const SESSION_SCHEMA_VERSION = 1;

export const CoachingSession = PersistedMeta.extend({
  id: DocumentId,
  uid: z.string().min(1).max(128),
  exerciseId: DocumentId,
  exerciseVersion: z.number().int().min(1),
  mode: TrainingMode,
  status: SessionStatus,
  phase: SessionPhase,
  hintLevel: HintLevel,
  revealed: z.boolean(),
  hypotheses: z.array(UserHypothesis).max(20),
  decision: SessionDecision.nullable(),
  assessment: SessionAssessment.nullable(),
  messageCount: z.number().int().min(0),
  startedAt: IsoTimestamp,
  lastActivityAt: IsoTimestamp,
  completedAt: IsoTimestamp.nullable(),
});
export type CoachingSession = z.infer<typeof CoachingSession>;

export const MessageRole = z.enum(["user", "coach", "system"]);
export const MessageKind = z.enum(["turn", "hint", "reveal", "debrief", "phase_change"]);

export const SessionMessage = z.object({
  id: DocumentId,
  sessionId: DocumentId,
  role: MessageRole,
  kind: MessageKind,
  content: z.string().min(1).max(20_000),
  phase: SessionPhase,
  /** Provider/model id only; never prompt text. */
  model: z.string().max(120).nullable(),
  createdAt: IsoTimestamp,
});
export type SessionMessage = z.infer<typeof SessionMessage>;
