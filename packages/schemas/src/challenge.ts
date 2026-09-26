import { z } from "zod";
import { DocumentId, IsoTimestamp, LongText, MediumText, PersistedMeta, ShortText, UnitInterval } from "./common";
import { Difficulty, ExerciseStatus, RubricCriterion } from "./exercise";
import { EvidenceItem, InvestigationActionPublic } from "./investigation";
import { CriterionEvaluation } from "./session";
import { SkillId } from "./skills";

/** Monthly master challenge: one unfamiliar problem across every core capability. */
export const ChallengeStage = z.enum(["situation", "hypotheses", "information", "tree", "anticipation", "strategy", "decision", "adversarial", "assessed"]);
export type ChallengeStage = z.infer<typeof ChallengeStage>;
export const CHALLENGE_STAGES = ChallengeStage.options;

export const ChallengePublic = PersistedMeta.extend({
  id: DocumentId,
  slug: z.string().regex(/^[a-z0-9-]+$/).max(80),
  version: z.number().int().min(1),
  status: ExerciseStatus,
  title: ShortText,
  summary: MediumText,
  difficulty: Difficulty,
  estimatedMinutes: z.number().int().min(30).max(240),
  /** Suggested time budget; elapsed time is recorded, not enforced. */
  timeBudgetMinutes: z.number().int().min(30).max(240),
  briefing: LongText,
  knownFacts: z.array(MediumText).max(20),
  actions: z.array(InvestigationActionPublic).min(1).max(20),
  budget: z.number().int().min(1).max(100),
  expectedDimensions: z.array(SkillId).min(1).max(8),
});
export type ChallengePublic = z.infer<typeof ChallengePublic>;

export const ChallengeHidden = z.object({
  challengeId: DocumentId,
  version: z.number().int().min(1),
  evidence: z.array(EvidenceItem).min(3).max(40),
  actionReveals: z.record(z.string(), z.array(DocumentId)),
  keyEvidenceIds: z.array(DocumentId).min(1),
  /** Reference analysis released after assessment. */
  referenceAnalysis: LongText,
  /** Adversarial reviewer persona for the final stage. */
  adversaryPersona: MediumText,
  rubric: z.array(RubricCriterion).min(1).max(10),
  debrief: LongText,
});

export const ChallengeDefinition = z.object({ public: ChallengePublic, hidden: ChallengeHidden });
export type ChallengeDefinition = z.infer<typeof ChallengeDefinition>;

export const ChallengeHypothesis = z.object({ id: DocumentId, statement: MediumText, confidence: UnitInterval, evidenceIds: z.array(DocumentId).max(10).default([]) });
export const ChallengePrediction = z.object({ actor: ShortText, response: MediumText, probability: UnitInterval, trigger: z.string().max(500).default("") });

export const ChallengeData = z.object({
  situation: z.object({ summary: LongText, knowns: z.array(MediumText).min(1), unknowns: z.array(MediumText).min(1), assumptions: z.array(MediumText).default([]) }).nullable().default(null),
  hypotheses: z.array(ChallengeHypothesis).max(8).default([]),
  revealedEvidenceIds: z.array(DocumentId).default([]),
  actionsTaken: z.array(z.object({ actionId: DocumentId, cost: z.number().int(), at: IsoTimestamp })).default([]),
  pointsRemaining: z.number().int().min(0),
  treeId: DocumentId.nullable().default(null),
  anticipation: z.array(ChallengePrediction).max(8).default([]),
  strategy: z.object({ primary: LongText, fallback: LongText, assumptions: z.array(MediumText).min(1), confidence: UnitInterval }).nullable().default(null),
  decision: z.object({ text: MediumText, rationale: LongText, confidence: UnitInterval }).nullable().default(null),
  adversarial: z.object({
    questions: z.array(MediumText).max(5).default([]),
    answers: z.array(z.string().max(4000)).max(5).default([]),
  }).default({ questions: [], answers: [] }),
});
export type ChallengeData = z.infer<typeof ChallengeData>;

export const ChallengeAssessment = z.object({
  criteria: z.array(CriterionEvaluation).min(1),
  overallScore: UnitInterval,
  skillScores: z.array(z.object({ skillId: SkillId, score: UnitInterval })).min(1),
  evidenceCoverage: UnitInterval,
  elapsedMinutes: z.number().int().min(0),
  withinTimeBudget: z.boolean(),
  /** Compared with the same user's earlier attempts at this challenge. */
  previousBest: UnitInterval.nullable(),
  strengths: z.array(ShortText).max(5),
  weaknesses: z.array(ShortText).max(5),
  errorPatterns: z.array(z.string().max(60)).max(5),
  debrief: LongText,
  assessedAt: IsoTimestamp,
});
export type ChallengeAssessment = z.infer<typeof ChallengeAssessment>;

export const CHALLENGE_ATTEMPT_SCHEMA_VERSION = 1;

export const ChallengeAttempt = PersistedMeta.extend({
  id: DocumentId,
  uid: z.string().min(1).max(128),
  challengeId: DocumentId,
  challengeVersion: z.number().int().min(1),
  /** YYYY-MM the attempt belongs to. */
  monthKey: z.string().regex(/^\d{4}-\d{2}$/),
  stage: ChallengeStage,
  status: z.enum(["active", "completed", "abandoned"]),
  data: ChallengeData,
  assessment: ChallengeAssessment.nullable(),
  startedAt: IsoTimestamp,
  lastActivityAt: IsoTimestamp,
  completedAt: IsoTimestamp.nullable(),
});
export type ChallengeAttempt = z.infer<typeof ChallengeAttempt>;

export const ChallengeView = z.object({
  attempt: ChallengeAttempt,
  challenge: ChallengePublic,
  revealedEvidence: z.array(EvidenceItem),
  referenceAnalysis: z.string().nullable(),
  caseDebrief: z.string().nullable(),
});
export type ChallengeView = z.infer<typeof ChallengeView>;

export const AdversarialQuestionsDraft = z.object({ questions: z.array(MediumText).min(2).max(4) });
export const ChallengeAssessmentDraft = z.object({
  criteria: z.array(CriterionEvaluation).min(1),
  strengths: z.array(ShortText).max(5),
  weaknesses: z.array(ShortText).max(5),
  errorPatterns: z.array(z.string().max(60)).max(5),
  debrief: LongText,
});
