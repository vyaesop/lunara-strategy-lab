import { z } from "zod";
import { DocumentId, IsoTimestamp, LongText, MediumText, PersistedMeta, ShortText, UnitInterval } from "./common";
import { CriterionEvaluation, HintLevel, OutcomeQuality } from "./session";
import { Difficulty, ExerciseStatus, HintLadder, RubricCriterion } from "./exercise";
import { SkillId } from "./skills";

/**
 * Inference Lab: investigation scenarios with deterministic evidence release.
 * Public parts are safe for clients; hidden parts (full evidence bank, what
 * each action reveals, ground truth, rubric) stay on the server.
 */

export const EvidenceKind = z.enum(["document", "testimony", "observation", "report", "physical"]);
export const Reliability = z.enum(["high", "medium", "low"]);

export const EvidenceItem = z.object({
  id: DocumentId,
  title: ShortText,
  content: MediumText,
  /** Where it came from (a person, a log, a lab). */
  source: ShortText,
  kind: EvidenceKind,
  reliability: Reliability,
  /** Revealed at the start of the investigation. */
  initial: z.boolean().default(false),
});
export type EvidenceItem = z.infer<typeof EvidenceItem>;

export const ActionKind = z.enum(["interview", "inspect", "search", "request_report", "observe", "test"]);

/** Client-visible description of an action; what it reveals is hidden. */
export const InvestigationActionPublic = z.object({
  id: DocumentId,
  label: ShortText,
  description: MediumText,
  kind: ActionKind,
  cost: z.number().int().min(0).max(20),
  /** Evidence that must already be revealed before this action is available. */
  requiresEvidence: z.array(DocumentId).max(5).default([]),
});
export type InvestigationActionPublic = z.infer<typeof InvestigationActionPublic>;

export const Entity = z.object({
  id: DocumentId,
  name: ShortText,
  role: ShortText,
  description: MediumText,
  /** Entities that can be the answer (a suspect, a cause) are selectable in hypotheses. */
  candidate: z.boolean().default(false),
});
export type Entity = z.infer<typeof Entity>;

export const InvestigationKind = z.enum(["fictional", "real_world"]);

export const InvestigationPublic = PersistedMeta.extend({
  id: DocumentId,
  slug: z.string().regex(/^[a-z0-9-]+$/).max(80),
  version: z.number().int().min(1),
  status: ExerciseStatus,
  kind: InvestigationKind,
  title: ShortText,
  summary: MediumText,
  difficulty: Difficulty,
  estimatedMinutes: z.number().int().min(5).max(120),
  learningObjectives: z.array(ShortText).min(1).max(6),
  briefing: LongText,
  knownFacts: z.array(MediumText).max(20),
  entities: z.array(Entity).min(1).max(20),
  actions: z.array(InvestigationActionPublic).min(1).max(20),
  /** Investigation points available. */
  budget: z.number().int().min(1).max(100),
  expectedDimensions: z.array(SkillId).min(1).max(6),
  tags: z.array(z.string().max(40)).max(12),
});
export type InvestigationPublic = z.infer<typeof InvestigationPublic>;

export const InvestigationHidden = z.object({
  investigationId: DocumentId,
  version: z.number().int().min(1),
  evidence: z.array(EvidenceItem).min(3).max(40),
  /** actionId → evidence ids released by that action. */
  actionReveals: z.record(z.string(), z.array(DocumentId)),
  groundTruth: z.object({
    /** Entity id of the answer for fixed cases; null for open real-world cases. */
    answerEntityId: DocumentId.nullable(),
    summary: LongText,
    /** Evidence a well-supported conclusion must account for. */
    keyEvidenceIds: z.array(DocumentId).min(1),
    /** Evidence designed to mislead; noticing its weakness is rewarded. */
    misleadingEvidenceIds: z.array(DocumentId).default([]),
  }),
  rubric: z.array(RubricCriterion).min(1).max(8),
  hints: HintLadder,
  debrief: LongText,
  coachNotes: z.string().max(4_000).optional(),
});
export type InvestigationHidden = z.infer<typeof InvestigationHidden>;

export const InvestigationDefinition = z.object({ public: InvestigationPublic, hidden: InvestigationHidden });
export type InvestigationDefinition = z.infer<typeof InvestigationDefinition>;

// ── Session state ───────────────────────────────────────────────────────────

export const EvidenceRelation = z.enum(["supports", "contradicts", "neutral"]);

export const EvidenceLink = z.object({
  evidenceId: DocumentId,
  relation: EvidenceRelation,
  /** 1 weak … 3 strong. */
  weight: z.number().int().min(1).max(3).default(2),
  note: z.string().max(280).optional(),
});
export type EvidenceLink = z.infer<typeof EvidenceLink>;

export const InvestigationHypothesis = z.object({
  id: DocumentId,
  statement: MediumText,
  /** Which candidate entity this hypothesis names, if any. */
  answerEntityId: DocumentId.nullable().default(null),
  links: z.array(EvidenceLink).max(30).default([]),
  assumptions: z.array(ShortText).max(10).default([]),
  /** What evidence would distinguish this from its rivals. */
  distinguishingTest: z.string().max(500).optional(),
  confidence: UnitInterval,
  status: z.enum(["active", "revised", "discarded"]).default("active"),
  revisesId: DocumentId.nullable().default(null),
  createdAt: IsoTimestamp,
  updatedAt: IsoTimestamp,
});
export type InvestigationHypothesis = z.infer<typeof InvestigationHypothesis>;

export const ActionRecord = z.object({
  actionId: DocumentId,
  cost: z.number().int().min(0),
  revealedEvidenceIds: z.array(DocumentId),
  at: IsoTimestamp,
});

export const InvestigationConclusion = z.object({
  hypothesisId: DocumentId,
  rationale: LongText,
  confidence: UnitInterval,
  submittedAt: IsoTimestamp,
});
export type InvestigationConclusion = z.infer<typeof InvestigationConclusion>;

export const InvestigationEvaluation = z.object({
  correct: z.boolean().nullable(),
  /** Deterministic: key evidence revealed AND linked to the concluded hypothesis / key evidence. */
  evidenceCoverage: UnitInterval,
  /** Deterministic: contradicting key evidence acknowledged on the concluded hypothesis. */
  contradictionAwareness: UnitInterval,
  /** Deterministic: misleading evidence linked as 'supports' with weight ≥ 2 counts against. */
  misledByCount: z.number().int().min(0),
  competingHypotheses: z.number().int().min(0),
  pointsUsed: z.number().int().min(0),
  budget: z.number().int().min(1),
  hintLevelUsed: HintLevel,
  /** From the AI rubric pass. */
  criteria: z.array(CriterionEvaluation).min(1),
  overallScore: UnitInterval,
  skillScores: z.array(z.object({ skillId: SkillId, score: UnitInterval })).min(1),
  outcomeQuality: OutcomeQuality,
  calibration: z.object({ statedConfidence: UnitInterval, correct: z.boolean().nullable() }),
  strengths: z.array(ShortText).max(5),
  weaknesses: z.array(ShortText).max(5),
  errorPatterns: z.array(z.string().max(60)).max(5),
  debrief: LongText,
  assessedAt: IsoTimestamp,
});
export type InvestigationEvaluation = z.infer<typeof InvestigationEvaluation>;

export const INVESTIGATION_SESSION_SCHEMA_VERSION = 1;

export const InvestigationSession = PersistedMeta.extend({
  id: DocumentId,
  uid: z.string().min(1).max(128),
  investigationId: DocumentId,
  investigationVersion: z.number().int().min(1),
  status: z.enum(["active", "completed", "abandoned"]),
  pointsRemaining: z.number().int().min(0),
  revealedEvidenceIds: z.array(DocumentId),
  actionsTaken: z.array(ActionRecord),
  hypotheses: z.array(InvestigationHypothesis).max(10),
  confidenceHistory: z.array(z.object({ hypothesisId: DocumentId, confidence: UnitInterval, at: IsoTimestamp })).max(200),
  hintLevel: HintLevel,
  conclusion: InvestigationConclusion.nullable(),
  evaluation: InvestigationEvaluation.nullable(),
  startedAt: IsoTimestamp,
  lastActivityAt: IsoTimestamp,
  completedAt: IsoTimestamp.nullable(),
});
export type InvestigationSession = z.infer<typeof InvestigationSession>;

/** Evaluation draft from the model; deterministic fields are computed server-side. */
export const InvestigationAssessmentDraft = z.object({
  criteria: z.array(CriterionEvaluation).min(1),
  strengths: z.array(ShortText).max(5),
  weaknesses: z.array(ShortText).max(5),
  errorPatterns: z.array(z.string().max(60)).max(5),
  debrief: LongText,
});
export type InvestigationAssessmentDraft = z.infer<typeof InvestigationAssessmentDraft>;
