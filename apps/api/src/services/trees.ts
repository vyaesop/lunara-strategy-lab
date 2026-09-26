import { and, desc, eq } from "drizzle-orm";
import type { ChatMessage, ModelRouter } from "@lunara/ai";
import {
  SCENARIO_TREE_SCHEMA_VERSION,
  ScenarioTree,
  TreeCritique,
  TreeCritiqueDraft,
  nowIso,
  type CritiqueFinding,
  type CritiqueMode,
  type TreeGraph,
} from "@lunara/schemas";
import { auditTreeStructure } from "@lunara/core";
import type { Db } from "../db/client";
import { scenarioTrees } from "../db/schema";
import { ApiHttpError } from "../errors";
import { newId } from "../ids";

export function rowToTree(row: typeof scenarioTrees.$inferSelect): ScenarioTree {
  return ScenarioTree.parse({
    schemaVersion: row.schemaVersion,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    id: row.id,
    uid: row.userId,
    title: row.title,
    objective: row.objective,
    context: row.context,
    version: row.version,
    graph: row.graph,
    history: row.history,
    critiques: row.critiques,
  });
}

export async function createTree(db: Db, userId: string, input: { title: string; objective?: string; context?: ScenarioTree["context"] }): Promise<ScenarioTree> {
  const now = new Date();
  const rootId = newId("node");
  const graph: TreeGraph = {
    nodes: [
      {
        id: rootId,
        type: "objective",
        title: input.title,
        description: input.objective ?? "",
        preconditions: "",
        probability: null,
        cost: "",
        time: "",
        risk: null,
        evidenceRefs: [],
        notes: "",
        position: { x: 0, y: 0 },
        collapsed: false,
      },
    ],
    edges: [],
  };
  const [row] = await db
    .insert(scenarioTrees)
    .values({
      id: newId("tree"),
      userId,
      schemaVersion: SCENARIO_TREE_SCHEMA_VERSION,
      title: input.title,
      objective: input.objective ?? "",
      context: input.context ?? { kind: "free", refId: null },
      version: 1,
      graph,
      history: [],
      critiques: [],
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return rowToTree(row!);
}

export async function getOwnedTree(db: Db, userId: string, id: string): Promise<ScenarioTree | null> {
  const row = await db.query.scenarioTrees.findFirst({ where: and(eq(scenarioTrees.id, id), eq(scenarioTrees.userId, userId)) });
  return row ? rowToTree(row) : null;
}

export async function listTrees(db: Db, userId: string) {
  const rows = await db.select().from(scenarioTrees).where(eq(scenarioTrees.userId, userId)).orderBy(desc(scenarioTrees.updatedAt)).limit(100);
  return rows.map((r) => {
    const t = rowToTree(r);
    return { id: t.id, title: t.title, objective: t.objective, version: t.version, updatedAt: t.updatedAt, createdAt: t.createdAt, context: t.context, nodeCount: t.graph.nodes.length };
  });
}

/** Save a new version. Optimistic concurrency: the client must send the version it loaded. */
export async function saveTree(db: Db, tree: ScenarioTree, input: { title?: string; objective?: string; graph: TreeGraph; baseVersion: number }): Promise<ScenarioTree> {
  if (input.baseVersion !== tree.version) {
    throw new ApiHttpError("conflict", `This tree was saved elsewhere (version ${tree.version}); reload before saving.`, { currentVersion: tree.version });
  }
  const history = [...tree.history, { version: tree.version, savedAt: tree.updatedAt, graph: tree.graph, nodeCount: tree.graph.nodes.length }].slice(-10);
  const [row] = await db
    .update(scenarioTrees)
    .set({
      title: input.title ?? tree.title,
      objective: input.objective ?? tree.objective,
      graph: input.graph,
      version: tree.version + 1,
      history,
      updatedAt: new Date(),
    })
    .where(eq(scenarioTrees.id, tree.id))
    .returning();
  return rowToTree(row!);
}

export async function deleteTree(db: Db, tree: ScenarioTree): Promise<void> {
  await db.delete(scenarioTrees).where(eq(scenarioTrees.id, tree.id));
}

// ── Critique ────────────────────────────────────────────────────────────────

const SHOWN_BY_MODE: Record<CritiqueMode, number> = { independent: 0, hints: 3, audit: Number.MAX_SAFE_INTEGER };

function describeGraph(tree: ScenarioTree): string {
  const byId = new Map(tree.graph.nodes.map((n) => [n.id, n]));
  const lines = tree.graph.nodes.map((n) => {
    const kids = tree.graph.edges.filter((e) => e.source === n.id).map((e) => byId.get(e.target)?.title ?? e.target);
    const meta = [n.probability !== null ? `p=${n.probability}` : "", n.cost ? `cost=${n.cost}` : "", n.time ? `time=${n.time}` : "", n.risk ? `risk=${n.risk}` : ""].filter(Boolean).join(", ");
    return `- [${n.id}] ${n.type.toUpperCase()}: ${n.title}${n.description ? ` — ${n.description}` : ""}${meta ? ` (${meta})` : ""}${n.preconditions ? ` | preconditions: ${n.preconditions}` : ""}${kids.length ? ` → ${kids.join(" | ")}` : ""}`;
  });
  return lines.join("\n");
}

function buildCritiqueMessages(tree: ScenarioTree, structural: CritiqueFinding[]): ChatMessage[] {
  const example = TreeCritiqueDraft.parse({
    findings: [
      { kind: "unexamined_opponent_response", severity: "warning", nodeId: tree.graph.nodes[0]?.id ?? null, message: "What the finding is, referring to node titles.", suggestion: "What to add or change." },
    ],
  });
  const system = [
    "You are auditing a strategic scenario tree built by a learner. Identify what is missing or weak; do not rewrite their plan and do not decide for them.",
    "Look for: missing branches, unexamined opponent or environmental responses, unstated assumptions, unrealistic transitions, unconsidered resource constraints, unprotected failure points, opportunities to gather information before committing, and branches that end without a contingency.",
    "Use node ids from the tree in `nodeId` when a finding concerns a specific node; otherwise null. Be specific and concise. At most 12 findings, most important first. Do not repeat the structural findings listed below.",
    "",
    `TITLE: ${tree.title}`,
    `OBJECTIVE: ${tree.objective || "(not stated)"}`,
    `TREE (${tree.graph.nodes.length} nodes):\n${describeGraph(tree)}`,
    "",
    `ALREADY FOUND BY STRUCTURAL CHECKS: ${structural.map((f) => f.message).join(" / ") || "none"}`,
    "",
    "RESPOND WITH JSON ONLY:",
    `EXAMPLE_JSON:${JSON.stringify(example)}`,
    "END_EXAMPLE_JSON",
  ].join("\n");
  return [
    { role: "system", content: system },
    { role: "user", content: "Audit the tree and return the JSON object." },
  ];
}

/** Structural findings always; AI findings unless mode is 'independent'. */
export async function critiqueTree(db: Db, ai: ModelRouter, tree: ScenarioTree, mode: CritiqueMode): Promise<{ tree: ScenarioTree; critique: TreeCritique }> {
  const structural = auditTreeStructure(tree.graph);
  let aiFindings: CritiqueFinding[] = [];
  if (mode !== "independent") {
    const validNodeIds = new Set(tree.graph.nodes.map((n) => n.id));
    const { value } = await ai.generateStructured("tree.audit", TreeCritiqueDraft, buildCritiqueMessages(tree, structural));
    aiFindings = value.findings.map((f) => ({ ...f, nodeId: f.nodeId && validNodeIds.has(f.nodeId) ? f.nodeId : null, source: "ai" as const }));
  }
  const order = { critical: 0, warning: 1, info: 2 };
  const findings = [...structural, ...aiFindings].sort((a, b) => order[a.severity] - order[b.severity]).slice(0, 40);
  const critique = TreeCritique.parse({
    id: newId("crit"),
    mode,
    treeVersion: tree.version,
    findings,
    shownCount: Math.min(findings.length, SHOWN_BY_MODE[mode]),
    createdAt: nowIso(),
  });
  const critiques = [...tree.critiques, critique].slice(-10);
  const [row] = await db.update(scenarioTrees).set({ critiques, updatedAt: new Date() }).where(eq(scenarioTrees.id, tree.id)).returning();
  return { tree: rowToTree(row!), critique };
}

/** Progressive hints: reveal more of an existing critique. */
export async function revealMoreCritique(db: Db, tree: ScenarioTree, critiqueId: string, count = 3): Promise<ScenarioTree> {
  const critiques = tree.critiques.map((c) => (c.id === critiqueId ? { ...c, shownCount: Math.min(c.findings.length, c.shownCount + count) } : c));
  const [row] = await db.update(scenarioTrees).set({ critiques }).where(eq(scenarioTrees.id, tree.id)).returning();
  return rowToTree(row!);
}
