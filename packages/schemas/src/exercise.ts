import { z } from "zod";
import {
  DocumentId,
  LongText,
  MediumText,
  PersistedMeta,
  ShortText,
  UnitInterval,
} from "./common";
import { SkillId } from "./skills";

export const TrainingMode = z.enum([
  "strategic_planning",
  "critical_thinking",
  "deductive_reasoning",
  "abductive_reasoning",
  "inductive_reasoning",
  "bayesian_reasoning",
  "negotiation",
  "adversarial_thinking",
  "long_term_planning",
  "decision_under_uncertainty",
  "systems_thinking",
  "historical_analysis",
  "intelligence_analysis",
]);
export type TrainingMode = z.infer<typeof TrainingMode>;
export const TRAINING_MODES = TrainingMode.options;

export const Difficulty = z.number().int().min(1).max(5);

export const ExerciseStatus = z.enum(["draft", "published", "archived"]);
export const ExerciseSource = z.enum(["curated", "generated"]);

/** Whether the exercise has one defensible answer or is judged by rubric. */
export const AnswerKind = z.enum(["fixed", "open"]);

export const RubricLevel = z.object({
  score: UnitInterval,
  descriptor: ShortText,
});

export const RubricCriterion = z.object({
  id: DocumentId,
  title: ShortText,
  description: MediumText,
  /** Relative weight; normalised at evaluation time. */
  weight: z.number().positive().max(10),
  skill: SkillId,
  levels: z.array(RubricLevel).min(2).max(5),
});
export type RubricCriterion = z.infer<typeof RubricCriterion>;

/**
 * Hint ladder. Level index = hint level - 1.
 *  1 clarify objective, 2 relevant category, 3 overlooked clue/constraint,
 *  4 method or framework, 5 worked explanation.
 */
export const HintLadder = z.tuple([
  MediumText,
  MediumText,
  MediumText,
  MediumText,
  LongText,
]);
export type HintLadder = z.infer<typeof HintLadder>;

/** Client-visible part of an exercise. Never contains hidden material. */
export const ExercisePublic = PersistedMeta.extend({
  id: DocumentId,
  slug: z.string().regex(/^[a-z0-9-]+$/).max(80),
  version: z.number().int().min(1),
  status: ExerciseStatus,
  source: ExerciseSource,
  title: ShortText,
  summary: MediumText,
  mode: TrainingMode,
  difficulty: Difficulty,
  answerKind: AnswerKind,
  estimatedMinutes: z.number().int().min(3).max(120),
  learningObjectives: z.array(ShortText).min(1).max(6),
  /** Scenario text shown at the start. */
  scenario: LongText,
  /** Established facts the learner may rely on. */
  facts: z.array(MediumText).max(30),
  /** Constraints or rules of the exercise. */
  constraints: z.array(MediumText).max(20),
  /** Skill dimensions this exercise produces evidence for. */
  expectedDimensions: z.array(SkillId).min(1).max(6),
  tags: z.array(z.string().max(40)).max(12),
});
export type ExercisePublic = z.infer<typeof ExercisePublic>;

/** Server-only material. Released piecewise according to session state. */
export const ExerciseHidden = z.object({
  exerciseId: DocumentId,
  version: z.number().int().min(1),
  /** Model solution or, for open exercises, the reference analysis. */
  solution: LongText,
  /** What a strong answer must establish; used by coach and assessment. */
  keyInsights: z.array(MediumText).min(1).max(10),
  /** Common weak lines of reasoning the coach should challenge. */
  commonErrors: z.array(MediumText).max(10),
  rubric: z.array(RubricCriterion).min(1).max(8),
  hints: HintLadder,
  debrief: LongText,
  /** Coaching guidance for the model in each phase; not user-visible. */
  coachNotes: z.string().max(4_000).optional(),
});
export type ExerciseHidden = z.infer<typeof ExerciseHidden>;

export const ExerciseDefinition = z.object({
  public: ExercisePublic,
  hidden: ExerciseHidden,
});
export type ExerciseDefinition = z.infer<typeof ExerciseDefinition>;
