import { z } from "zod";
import { DocumentId, IsoTimestamp, LongText, MediumText, PersistedMeta, ShortText, UnitInterval } from "./common";

/** Real-world Strategy Lab: the user's own projects, decisions and predictions. */

export const ProjectItem = z.object({
  id: DocumentId,
  text: MediumText,
  status: z.enum(["open", "done", "dropped"]).default("open"),
  note: z.string().max(1000).default(""),
});
export type ProjectItem = z.infer<typeof ProjectItem>;

export const ProjectSection = z.enum(["objectives", "milestones", "constraints", "stakeholders", "resources", "risks", "assumptions", "options", "outcomes", "lessons"]);
export type ProjectSection = z.infer<typeof ProjectSection>;

export const STRATEGIC_PROJECT_SCHEMA_VERSION = 1;

export const StrategicProject = PersistedMeta.extend({
  id: DocumentId,
  uid: z.string().min(1).max(128),
  title: ShortText,
  summary: z.string().max(4000).default(""),
  status: z.enum(["active", "paused", "completed", "archived"]).default("active"),
  sections: z.record(ProjectSection, z.array(ProjectItem).max(50)),
  notes: z.string().max(20_000).default(""),
  /** Linked artefacts created elsewhere in the platform. */
  links: z.object({
    treeIds: z.array(DocumentId).max(20).default([]),
    councilIds: z.array(DocumentId).max(20).default([]),
    documentIds: z.array(DocumentId).max(50).default([]),
  }).default({ treeIds: [], councilIds: [], documentIds: [] }),
});
export type StrategicProject = z.infer<typeof StrategicProject>;

/** AI structuring suggestions: proposed items per section; the user accepts or discards each. */
export const ProjectSuggestions = z.object({
  suggestions: z.array(z.object({ section: ProjectSection, text: MediumText, why: z.string().max(400) })).min(1).max(20),
  questions: z.array(ShortText).max(6).default([]),
});
export type ProjectSuggestions = z.infer<typeof ProjectSuggestions>;

// ── Decision journal ────────────────────────────────────────────────────────

export const Prediction = z.object({
  id: DocumentId,
  statement: MediumText,
  /** Stated probability the statement turns out true; null for non-binary predictions. */
  probability: UnitInterval.nullable().default(null),
  reasoning: z.string().max(2000).default(""),
  /** Evidence that would show the prediction was wrong. */
  invalidatingEvidence: z.string().max(1000).default(""),
  /** Resolution: true/false for binary, null while open. */
  resolved: z.boolean().nullable().default(null),
  resolutionNote: z.string().max(2000).default(""),
  resolvedAt: IsoTimestamp.nullable().default(null),
  reviewAt: IsoTimestamp.nullable().default(null),
});
export type Prediction = z.infer<typeof Prediction>;

export const DECISION_RECORD_SCHEMA_VERSION = 1;

export const DecisionRecord = PersistedMeta.extend({
  id: DocumentId,
  uid: z.string().min(1).max(128),
  projectId: DocumentId.nullable().default(null),
  title: ShortText,
  context: LongText,
  evidence: z.array(MediumText).max(20).default([]),
  objective: MediumText,
  alternatives: z.array(z.object({ text: MediumText, expectedOutcome: z.string().max(1000).default("") })).max(10).default([]),
  chosenAction: MediumText,
  rationale: LongText,
  risks: z.array(MediumText).max(10).default([]),
  confidence: UnitInterval,
  predictions: z.array(Prediction).max(10).default([]),
  actualOutcome: z.string().max(4000).default(""),
  lessons: z.string().max(4000).default(""),
  status: z.enum(["open", "reviewed"]).default("open"),
  reviewAt: IsoTimestamp.nullable().default(null),
  reviewedAt: IsoTimestamp.nullable().default(null),
  decidedAt: IsoTimestamp,
});
export type DecisionRecord = z.infer<typeof DecisionRecord>;

/** Calibration summary over resolved binary predictions; shown only with enough data. */
export const CalibrationSummary = z.object({
  resolvedCount: z.number().int().min(0),
  brier: z.number().min(0).max(1).nullable(),
  enoughData: z.boolean(),
  buckets: z.array(z.object({ lower: z.number(), upper: z.number(), count: z.number().int(), meanForecast: z.number(), observedFrequency: z.number() })),
});
export type CalibrationSummary = z.infer<typeof CalibrationSummary>;

// ── Daily briefing ──────────────────────────────────────────────────────────

export const QuickPuzzle = z.object({
  id: DocumentId,
  kind: z.enum(["deduction", "estimation", "assumption_spotting", "base_rate"]),
  prompt: MediumText,
  /** Shown after the user commits an answer. */
  answer: MediumText,
  explanation: z.string().max(2000),
});
export type QuickPuzzle = z.infer<typeof QuickPuzzle>;

export const DailyBriefing = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  uid: z.string().min(1).max(128),
  puzzle: QuickPuzzle,
  strategicQuestion: MediumText,
  /** Review item due, if any. */
  reviewItemId: DocumentId.nullable(),
  /** A prediction or decision due for review, if any. */
  predictionPrompt: z.object({ kind: z.enum(["resolve_prediction", "review_decision", "new_prediction"]), refId: DocumentId.nullable(), text: MediumText }),
  /** Recommended exercise id from the curriculum engine, if any. */
  exerciseId: DocumentId.nullable(),
  responses: z.object({
    puzzleAnswer: z.string().max(2000).nullable().default(null),
    puzzleCorrectSelf: z.boolean().nullable().default(null),
    strategicAnswer: z.string().max(4000).nullable().default(null),
    predictionText: z.string().max(2000).nullable().default(null),
  }).default({ puzzleAnswer: null, puzzleCorrectSelf: null, strategicAnswer: null, predictionText: null }),
  completedAt: IsoTimestamp.nullable().default(null),
  createdAt: IsoTimestamp,
});
export type DailyBriefing = z.infer<typeof DailyBriefing>;
