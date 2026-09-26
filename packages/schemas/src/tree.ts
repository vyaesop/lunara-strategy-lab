import { z } from "zod";
import { DocumentId, IsoTimestamp, PersistedMeta, ShortText, UnitInterval } from "./common";

/** Visual scenario tree: user-authored branching plans, investigations and anticipation. */

export const TreeNodeType = z.enum([
  "objective",
  "decision",
  "opponent_response",
  "event",
  "information_action",
  "hypothesis",
  "outcome",
  "contingency",
  "assumption",
]);
export type TreeNodeType = z.infer<typeof TreeNodeType>;

export const TreeNode = z.object({
  id: DocumentId,
  type: TreeNodeType,
  title: ShortText,
  description: z.string().max(2_000).default(""),
  preconditions: z.string().max(500).default(""),
  /** Only meaningful for event / opponent_response / outcome nodes. */
  probability: UnitInterval.nullable().default(null),
  cost: z.string().max(120).default(""),
  time: z.string().max(120).default(""),
  risk: z.enum(["low", "medium", "high"]).nullable().default(null),
  evidenceRefs: z.array(z.string().max(120)).max(10).default([]),
  notes: z.string().max(1_000).default(""),
  position: z.object({ x: z.number(), y: z.number() }),
  collapsed: z.boolean().default(false),
});
export type TreeNode = z.infer<typeof TreeNode>;

export const TreeEdge = z.object({
  id: DocumentId,
  source: DocumentId,
  target: DocumentId,
  label: z.string().max(80).default(""),
});
export type TreeEdge = z.infer<typeof TreeEdge>;

export const TreeGraph = z.object({
  nodes: z.array(TreeNode).max(300),
  edges: z.array(TreeEdge).max(600),
});
export type TreeGraph = z.infer<typeof TreeGraph>;

export const CritiqueMode = z.enum(["independent", "hints", "audit"]);
export type CritiqueMode = z.infer<typeof CritiqueMode>;

export const CritiqueFindingKind = z.enum([
  "missing_branch",
  "unexamined_opponent_response",
  "unstated_assumption",
  "unrealistic_transition",
  "resource_constraint",
  "unprotected_failure_point",
  "information_opportunity",
  "missing_contingency",
  "structure",
]);

export const CritiqueFinding = z.object({
  kind: CritiqueFindingKind,
  severity: z.enum(["info", "warning", "critical"]),
  nodeId: DocumentId.nullable().default(null),
  message: z.string().max(600),
  suggestion: z.string().max(600).default(""),
  /** Deterministic structural checks vs. model judgement. */
  source: z.enum(["structural", "ai"]),
});
export type CritiqueFinding = z.infer<typeof CritiqueFinding>;

export const TreeCritique = z.object({
  id: DocumentId,
  mode: CritiqueMode,
  treeVersion: z.number().int().min(1),
  findings: z.array(CritiqueFinding).max(40),
  /** In 'hints' mode only a few findings are shown at a time; the rest stay hidden until requested. */
  shownCount: z.number().int().min(0),
  createdAt: IsoTimestamp,
});
export type TreeCritique = z.infer<typeof TreeCritique>;

export const TreeVersion = z.object({
  version: z.number().int().min(1),
  savedAt: IsoTimestamp,
  graph: TreeGraph,
  nodeCount: z.number().int().min(0),
});

export const SCENARIO_TREE_SCHEMA_VERSION = 1;

export const ScenarioTree = PersistedMeta.extend({
  id: DocumentId,
  uid: z.string().min(1).max(128),
  title: ShortText,
  objective: z.string().max(1_000).default(""),
  /** Optional link to the exercise, investigation or project this tree belongs to. */
  context: z.object({ kind: z.enum(["exercise", "investigation", "project", "free"]), refId: DocumentId.nullable() }).default({ kind: "free", refId: null }),
  version: z.number().int().min(1),
  graph: TreeGraph,
  /** Last few saved versions for comparison and restore (newest last). */
  history: z.array(TreeVersion).max(10),
  critiques: z.array(TreeCritique).max(10),
});
export type ScenarioTree = z.infer<typeof ScenarioTree>;

/** Model output for the AI critique; validated and merged with structural findings. */
export const TreeCritiqueDraft = z.object({
  findings: z.array(CritiqueFinding.omit({ source: true })).max(25),
});
export type TreeCritiqueDraft = z.infer<typeof TreeCritiqueDraft>;
