import { z } from "zod";
import { DocumentId, IsoTimestamp, LongText, MediumText, PersistedMeta, ShortText, UnitInterval } from "./common";
import { Difficulty, ExerciseStatus, RubricCriterion } from "./exercise";
import { CriterionEvaluation, HintLevel, OutcomeQuality } from "./session";
import { SkillId } from "./skills";

/**
 * Historical strategy simulations. Historical evidence (source-backed) is
 * kept separate from the fictional simulation layer, and counterfactual
 * branches are labelled. Effects are deterministic; AI is used only for
 * narration and debrief.
 */

export const SourceType = z.enum(["book", "article", "primary_document", "encyclopedia", "lecture", "website"]);
export const VerificationStatus = z.enum(["verified", "partially_verified", "unverified"]);

export const SourceRecord = z.object({
  id: DocumentId,
  title: ShortText,
  author: ShortText,
  publication: z.string().max(200).default(""),
  year: z.number().int().min(-3000).max(2100).nullable().default(null),
  url: z.string().max(500).nullable().default(null),
  /** Page or passage when known. */
  locator: z.string().max(120).nullable().default(null),
  type: SourceType,
  verification: VerificationStatus,
  note: z.string().max(500).default(""),
});
export type SourceRecord = z.infer<typeof SourceRecord>;

/** A historical claim with the sources that support it and how certain it is. */
export const HistoricalClaim = z.object({
  id: DocumentId,
  text: MediumText,
  certainty: z.enum(["established", "interpretation", "disputed"]),
  sourceIds: z.array(DocumentId).min(1),
});
export type HistoricalClaim = z.infer<typeof HistoricalClaim>;

export const ResourceDef = z.object({
  key: z.string().regex(/^[a-z_]+$/).max(40),
  label: ShortText,
  description: z.string().max(300).default(""),
  initial: z.number(),
  min: z.number().nullable().default(null),
  max: z.number().nullable().default(null),
  /** Shown to the player as a number; if false the player only sees a qualitative band. */
  visible: z.boolean().default(true),
});
export type ResourceDef = z.infer<typeof ResourceDef>;

export const Effect = z.object({
  resource: z.string().max(40),
  delta: z.number(),
});

export const Condition = z.object({
  resource: z.string().max(40),
  op: z.enum([">=", "<=", ">", "<", "=="]),
  value: z.number(),
});

export const SimOption = z.object({
  id: DocumentId,
  label: ShortText,
  description: MediumText,
  /** Player-visible. */
  requires: z.array(Condition).max(5).default([]),
  /** Server-only: applied immediately. */
  effects: z.array(Effect).max(10).default([]),
  /** Server-only: evidence revealed by choosing this option. */
  reveals: z.array(DocumentId).max(5).default([]),
  /** Server-only: which historical claim this mirrors, if any. */
  historicalMatch: z.boolean().default(false),
  /** Server-only: labelled counterfactual narration when this option departs from the record. */
  counterfactualNote: z.string().max(1000).default(""),
  /** Server-only: deterministic opponent / environment consequence after this option. */
  consequence: z
    .object({
      narration: LongText,
      effects: z.array(Effect).max(10).default([]),
      /** Turn id to jump to; default is the next turn in order. */
      nextTurnId: DocumentId.nullable().default(null),
    })
    .nullable()
    .default(null),
});
export type SimOption = z.infer<typeof SimOption>;

export const SimTurn = z.object({
  id: DocumentId,
  title: ShortText,
  /** In-character situation the player sees. */
  situation: LongText,
  /** Information the historical actor plausibly had; player-visible. */
  intelligence: z.array(MediumText).max(10).default([]),
  /** Server-only: hidden state facts the player does not know. */
  hidden: z.array(MediumText).max(10).default([]),
  options: z.array(SimOption).min(2).max(6),
  /** Turn is terminal after any option. */
  terminal: z.boolean().default(false),
});
export type SimTurn = z.infer<typeof SimTurn>;

export const SimulationPublic = PersistedMeta.extend({
  id: DocumentId,
  slug: z.string().regex(/^[a-z0-9-]+$/).max(80),
  version: z.number().int().min(1),
  status: ExerciseStatus,
  title: ShortText,
  figure: ShortText,
  period: ShortText,
  summary: MediumText,
  difficulty: Difficulty,
  estimatedMinutes: z.number().int().min(10).max(120),
  learningObjectives: z.array(ShortText).min(1).max(6),
  /** Source-backed background shown before play. */
  background: LongText,
  role: MediumText,
  resources: z.array(ResourceDef).min(1).max(8),
  sources: z.array(SourceRecord).min(1).max(20),
  claims: z.array(HistoricalClaim).min(1).max(30),
  expectedDimensions: z.array(SkillId).min(1).max(6),
  tags: z.array(z.string().max(40)).max(12),
});
export type SimulationPublic = z.infer<typeof SimulationPublic>;

export const SimulationHidden = z.object({
  simulationId: DocumentId,
  version: z.number().int().min(1),
  turns: z.array(SimTurn).min(1).max(20),
  /** Evidence items revealed by options, keyed by id. */
  evidence: z.record(z.string(), MediumText).default({}),
  /** Documented decision the historical actor took and its outcome. */
  historicalRecord: z.object({ decision: LongText, outcome: LongText, sourceIds: z.array(DocumentId).min(1) }),
  rubric: z.array(RubricCriterion).min(1).max(8),
  debrief: LongText,
  coachNotes: z.string().max(4_000).optional(),
});
export type SimulationHidden = z.infer<typeof SimulationHidden>;

export const SimulationDefinition = z.object({ public: SimulationPublic, hidden: SimulationHidden });
export type SimulationDefinition = z.infer<typeof SimulationDefinition>;

// ── Session ─────────────────────────────────────────────────────────────────

export const SimDecision = z.object({
  turnId: DocumentId,
  optionId: DocumentId,
  rationale: z.string().max(3000).default(""),
  confidence: UnitInterval.nullable().default(null),
  /** Snapshot of resources after the option and its consequence. */
  resourcesAfter: z.record(z.string(), z.number()),
  historicalMatch: z.boolean(),
  at: IsoTimestamp,
});
export type SimDecision = z.infer<typeof SimDecision>;

export const SimulationEvaluation = z.object({
  criteria: z.array(CriterionEvaluation).min(1),
  overallScore: UnitInterval,
  skillScores: z.array(z.object({ skillId: SkillId, score: UnitInterval })).min(1),
  outcomeQuality: OutcomeQuality,
  historicalMatches: z.number().int().min(0),
  turnsPlayed: z.number().int().min(0),
  finalResources: z.record(z.string(), z.number()),
  /** Whether the run ended in a defined success state per the scenario's end condition. */
  succeeded: z.boolean().nullable(),
  strengths: z.array(ShortText).max(5),
  weaknesses: z.array(ShortText).max(5),
  errorPatterns: z.array(z.string().max(60)).max(5),
  debrief: LongText,
  assessedAt: IsoTimestamp,
});
export type SimulationEvaluation = z.infer<typeof SimulationEvaluation>;

export const SIMULATION_SESSION_SCHEMA_VERSION = 1;

export const SimulationSession = PersistedMeta.extend({
  id: DocumentId,
  uid: z.string().min(1).max(128),
  simulationId: DocumentId,
  simulationVersion: z.number().int().min(1),
  status: z.enum(["active", "completed", "abandoned"]),
  currentTurnId: DocumentId.nullable(),
  resources: z.record(z.string(), z.number()),
  decisions: z.array(SimDecision).max(40),
  revealedEvidenceIds: z.array(DocumentId),
  /** Narration log the player has seen (situation + consequence text), for resume. */
  log: z.array(z.object({ turnId: DocumentId, kind: z.enum(["situation", "consequence", "counterfactual"]), text: z.string().max(6000), at: IsoTimestamp })).max(120),
  hintLevel: HintLevel,
  evaluation: SimulationEvaluation.nullable(),
  startedAt: IsoTimestamp,
  lastActivityAt: IsoTimestamp,
  completedAt: IsoTimestamp.nullable(),
});
export type SimulationSession = z.infer<typeof SimulationSession>;

/** What the player sees for the current turn: no hidden facts, no effects. */
export const TurnView = z.object({
  id: DocumentId,
  title: ShortText,
  situation: LongText,
  intelligence: z.array(MediumText),
  options: z.array(
    z.object({
      id: DocumentId,
      label: ShortText,
      description: MediumText,
      requires: z.array(Condition),
      available: z.boolean(),
    }),
  ),
  terminal: z.boolean(),
});
export type TurnView = z.infer<typeof TurnView>;

export const SimulationAssessmentDraft = z.object({
  criteria: z.array(CriterionEvaluation).min(1),
  strengths: z.array(ShortText).max(5),
  weaknesses: z.array(ShortText).max(5),
  errorPatterns: z.array(z.string().max(60)).max(5),
  debrief: LongText,
});
export type SimulationAssessmentDraft = z.infer<typeof SimulationAssessmentDraft>;
