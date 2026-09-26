import { z } from "zod";
import { DocumentId, IsoTimestamp, LongText, MediumText, PersistedMeta, ShortText, UnitInterval } from "./common";
import { Difficulty, ExerciseStatus, RubricCriterion } from "./exercise";
import { CriterionEvaluation, OutcomeQuality } from "./session";
import { SkillId } from "./skills";

/**
 * Negotiation role-play. The counterpart's persona and incentives are fixed
 * per scenario; acceptance of a proposal is decided deterministically from
 * hidden weights and reservation values, never by the model. The model only
 * voices the counterpart.
 */
export const NegotiationIssue = z.object({
  key: z.string().regex(/^[a-z_]+$/).max(40),
  label: ShortText,
  unit: z.string().max(20).default(""),
  min: z.number(),
  max: z.number(),
  step: z.number().positive().default(1),
  /** True if the user's side prefers higher values. */
  userPrefersHigh: z.boolean(),
});
export type NegotiationIssue = z.infer<typeof NegotiationIssue>;

export const NegotiationPublic = PersistedMeta.extend({
  id: DocumentId,
  slug: z.string().regex(/^[a-z0-9-]+$/).max(80),
  version: z.number().int().min(1),
  status: ExerciseStatus,
  title: ShortText,
  summary: MediumText,
  difficulty: Difficulty,
  estimatedMinutes: z.number().int().min(5).max(90),
  learningObjectives: z.array(ShortText).min(1).max(6),
  briefing: LongText,
  userRole: MediumText,
  /** What the user knows about the counterpart. */
  counterpart: z.object({ name: ShortText, role: ShortText, publicDescription: MediumText }),
  issues: z.array(NegotiationIssue).min(1).max(6),
  /** The user's own reservation guidance, visible: below this the deal is not worth it. */
  userGuidance: MediumText,
  maxRounds: z.number().int().min(3).max(20),
  expectedDimensions: z.array(SkillId).min(1).max(6),
  tags: z.array(z.string().max(40)).max(12),
});
export type NegotiationPublic = z.infer<typeof NegotiationPublic>;

export const NegotiationHidden = z.object({
  negotiationId: DocumentId,
  version: z.number().int().min(1),
  /** In-character persona and incentives for the model. */
  persona: LongText,
  /** Per-issue weights (sum ≈ 1) and direction for the counterpart. */
  weights: z.record(z.string(), z.number().min(0).max(1)),
  counterpartPrefersHigh: z.record(z.string(), z.boolean()),
  /** Minimum counterpart utility (0..1) to accept; decays per round by `patienceDecay` down to `floor`. */
  acceptThreshold: UnitInterval,
  patienceDecay: z.number().min(0).max(0.2).default(0.02),
  floor: UnitInterval,
  /** Counterpart's opening position. */
  opening: z.record(z.string(), z.number()),
  /** Best deal the user could realistically get, for the debrief. */
  referenceDeal: z.record(z.string(), z.number()),
  rubric: z.array(RubricCriterion).min(1).max(8),
  debrief: LongText,
});
export type NegotiationHidden = z.infer<typeof NegotiationHidden>;

export const NegotiationDefinition = z.object({ public: NegotiationPublic, hidden: NegotiationHidden });
export type NegotiationDefinition = z.infer<typeof NegotiationDefinition>;

export const Proposal = z.record(z.string(), z.number());
export type Proposal = z.infer<typeof Proposal>;

export const ProposalRecord = z.object({
  round: z.number().int().min(1),
  by: z.enum(["user", "counterpart"]),
  terms: Proposal,
  /** Counterpart's response to a user proposal. */
  response: z.enum(["accepted", "rejected", "countered"]).nullable(),
  at: IsoTimestamp,
});

export const NegotiationMessage = z.object({
  id: DocumentId,
  role: z.enum(["user", "counterpart", "system"]),
  content: z.string().max(6000),
  round: z.number().int().min(0),
  model: z.string().max(120).nullable().default(null),
  at: IsoTimestamp,
});

export const NegotiationEvaluation = z.object({
  dealReached: z.boolean(),
  finalTerms: Proposal.nullable(),
  /** User-side value of the final deal relative to the reference deal, 0..1 (null if no deal). */
  userValue: UnitInterval.nullable(),
  /** Counterpart utility of the final deal. */
  counterpartUtility: UnitInterval.nullable(),
  roundsUsed: z.number().int().min(0),
  criteria: z.array(CriterionEvaluation).min(1),
  overallScore: UnitInterval,
  skillScores: z.array(z.object({ skillId: SkillId, score: UnitInterval })).min(1),
  outcomeQuality: OutcomeQuality,
  strengths: z.array(ShortText).max(5),
  weaknesses: z.array(ShortText).max(5),
  errorPatterns: z.array(z.string().max(60)).max(5),
  debrief: LongText,
  /** Revealed after the session: the counterpart's simulated incentives. */
  counterpartIncentives: LongText,
  assessedAt: IsoTimestamp,
});
export type NegotiationEvaluation = z.infer<typeof NegotiationEvaluation>;

export const NEGOTIATION_SESSION_SCHEMA_VERSION = 1;

export const NegotiationSession = PersistedMeta.extend({
  id: DocumentId,
  uid: z.string().min(1).max(128),
  negotiationId: DocumentId,
  negotiationVersion: z.number().int().min(1),
  status: z.enum(["active", "completed", "abandoned"]),
  round: z.number().int().min(0),
  messages: z.array(NegotiationMessage).max(120),
  proposals: z.array(ProposalRecord).max(60),
  /** User's private preparation, visible only to them. */
  preparation: z.object({ interests: z.string().max(2000).default(""), batna: z.string().max(2000).default(""), walkaway: Proposal.nullable().default(null), plan: z.string().max(2000).default("") }),
  outcome: z.object({ dealReached: z.boolean(), terms: Proposal.nullable() }).nullable(),
  evaluation: NegotiationEvaluation.nullable(),
  startedAt: IsoTimestamp,
  lastActivityAt: IsoTimestamp,
  completedAt: IsoTimestamp.nullable(),
});
export type NegotiationSession = z.infer<typeof NegotiationSession>;

export const NegotiationAssessmentDraft = z.object({
  criteria: z.array(CriterionEvaluation).min(1),
  strengths: z.array(ShortText).max(5),
  weaknesses: z.array(ShortText).max(5),
  errorPatterns: z.array(z.string().max(60)).max(5),
  debrief: LongText,
});
