import { z } from "zod";
import { DocumentId, IsoTimestamp, LongText, MediumText, PersistedMeta, ShortText, UnitInterval } from "./common";
import { Difficulty, ExerciseStatus, RubricCriterion } from "./exercise";
import { CriterionEvaluation } from "./session";
import { SkillId } from "./skills";

/** Missions: connected sequences of steps ending in a debrief. Curated or user-authored from a project. */
export const MissionStepKind = z.enum(["reflection", "plan", "decision", "prediction", "exercise", "tree", "council"]);
export type MissionStepKind = z.infer<typeof MissionStepKind>;

export const MissionStep = z.object({
  id: DocumentId,
  title: ShortText,
  kind: MissionStepKind,
  prompt: LongText,
  guidance: z.string().max(2000).default(""),
  /** For `exercise` steps: which curated exercise to complete. */
  exerciseId: DocumentId.nullable().default(null),
});
export type MissionStep = z.infer<typeof MissionStep>;

export const MissionDefinition = PersistedMeta.extend({
  id: DocumentId,
  slug: z.string().regex(/^[a-z0-9-]+$/).max(80),
  version: z.number().int().min(1),
  status: ExerciseStatus,
  source: z.enum(["curated", "custom"]),
  title: ShortText,
  summary: MediumText,
  difficulty: Difficulty,
  estimatedMinutes: z.number().int().min(10).max(600),
  objectives: z.array(ShortText).min(1).max(6),
  constraints: z.array(MediumText).max(10).default([]),
  steps: z.array(MissionStep).min(2).max(12),
  rubric: z.array(RubricCriterion).min(1).max(8),
  expectedDimensions: z.array(SkillId).min(1).max(6),
  /** For custom missions: the project it was built from. */
  projectId: DocumentId.nullable().default(null),
});
export type MissionDefinition = z.infer<typeof MissionDefinition>;

export const StepResponse = z.object({
  stepId: DocumentId,
  response: z.string().max(8000),
  /** Linked artefact created for this step (session, tree, council, decision). */
  refId: DocumentId.nullable().default(null),
  completedAt: IsoTimestamp,
});

export const MissionDebrief = z.object({
  criteria: z.array(CriterionEvaluation).min(1),
  overallScore: UnitInterval,
  skillScores: z.array(z.object({ skillId: SkillId, score: UnitInterval })).min(1),
  strengths: z.array(ShortText).max(5),
  weaknesses: z.array(ShortText).max(5),
  errorPatterns: z.array(z.string().max(60)).max(5),
  debrief: LongText,
  assessedAt: IsoTimestamp,
});
export type MissionDebrief = z.infer<typeof MissionDebrief>;

export const MISSION_SESSION_SCHEMA_VERSION = 1;

export const MissionSession = PersistedMeta.extend({
  id: DocumentId,
  uid: z.string().min(1).max(128),
  missionId: DocumentId,
  missionVersion: z.number().int().min(1),
  /** Snapshot of the definition so custom missions can be edited later without changing this run. */
  definition: MissionDefinition,
  status: z.enum(["active", "completed", "abandoned"]),
  responses: z.array(StepResponse).max(12),
  debrief: MissionDebrief.nullable(),
  startedAt: IsoTimestamp,
  lastActivityAt: IsoTimestamp,
  completedAt: IsoTimestamp.nullable(),
});
export type MissionSession = z.infer<typeof MissionSession>;

export const MissionDebriefDraft = z.object({
  criteria: z.array(CriterionEvaluation).min(1),
  strengths: z.array(ShortText).max(5),
  weaknesses: z.array(ShortText).max(5),
  errorPatterns: z.array(z.string().max(60)).max(5),
  debrief: LongText,
});
