import { and, desc, eq } from "drizzle-orm";
import type { ChatMessage, ModelRouter } from "@lunara/ai";
import {
  SIMULATION_SESSION_SCHEMA_VERSION,
  SimulationAssessmentDraft,
  SimulationEvaluation,
  SimulationSession,
  nowIso,
  type SimulationDefinition,
  type SimulationSessionView,
} from "@lunara/schemas";
import { aggregateRubric, classifyOutcome, initialSimState, skillScoresFromRubric, turnView, visibleResources, type SimState } from "@lunara/core";
import type { Db } from "../db/client";
import { simulationSessions } from "../db/schema";
import { newId } from "../ids";

const iso = (d: Date | null | undefined): string | null => (d ? d.toISOString() : null);

export function rowToSimSession(row: typeof simulationSessions.$inferSelect): SimulationSession {
  return SimulationSession.parse({
    schemaVersion: row.schemaVersion,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    id: row.id,
    uid: row.userId,
    simulationId: row.simulationId,
    simulationVersion: row.simulationVersion,
    status: row.status,
    currentTurnId: row.currentTurnId,
    resources: row.resources,
    decisions: row.decisions,
    revealedEvidenceIds: row.revealedEvidenceIds,
    log: row.log,
    hintLevel: row.hintLevel,
    evaluation: row.evaluation,
    startedAt: row.startedAt.toISOString(),
    lastActivityAt: row.lastActivityAt.toISOString(),
    completedAt: iso(row.completedAt),
  });
}

export function toSimState(s: SimulationSession): SimState {
  return { status: s.status, currentTurnId: s.currentTurnId, resources: s.resources, decisions: s.decisions, revealedEvidenceIds: s.revealedEvidenceIds, log: s.log, hintLevel: s.hintLevel };
}

export async function createSimSession(db: Db, userId: string, def: SimulationDefinition): Promise<SimulationSession> {
  const now = new Date();
  const s = initialSimState(def, now.toISOString());
  const [row] = await db
    .insert(simulationSessions)
    .values({
      id: newId("sim"),
      userId,
      schemaVersion: SIMULATION_SESSION_SCHEMA_VERSION,
      simulationId: def.public.id,
      simulationVersion: def.public.version,
      status: s.status,
      currentTurnId: s.currentTurnId,
      resources: s.resources,
      decisions: [],
      revealedEvidenceIds: [],
      log: s.log,
      hintLevel: 0,
      evaluation: null,
      startedAt: now,
      lastActivityAt: now,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return rowToSimSession(row!);
}

export async function getOwnedSimSession(db: Db, userId: string, id: string): Promise<SimulationSession | null> {
  const row = await db.query.simulationSessions.findFirst({ where: and(eq(simulationSessions.id, id), eq(simulationSessions.userId, userId)) });
  return row ? rowToSimSession(row) : null;
}

export async function listSimSessions(db: Db, userId: string, limit = 50): Promise<SimulationSession[]> {
  const rows = await db.select().from(simulationSessions).where(eq(simulationSessions.userId, userId)).orderBy(desc(simulationSessions.lastActivityAt)).limit(limit);
  return rows.map(rowToSimSession);
}

export async function saveSimState(db: Db, id: string, state: SimState, extra: { evaluation?: SimulationEvaluation; completedAt?: Date } = {}): Promise<SimulationSession> {
  const now = new Date();
  const [row] = await db
    .update(simulationSessions)
    .set({
      status: state.status,
      currentTurnId: state.currentTurnId,
      resources: state.resources,
      decisions: state.decisions,
      revealedEvidenceIds: state.revealedEvidenceIds,
      log: state.log,
      hintLevel: state.hintLevel,
      lastActivityAt: now,
      updatedAt: now,
      ...(extra.evaluation ? { evaluation: extra.evaluation } : {}),
      ...(extra.completedAt ? { completedAt: extra.completedAt } : {}),
    })
    .where(eq(simulationSessions.id, id))
    .returning();
  return rowToSimSession(row!);
}

export function simView(session: SimulationSession, def: SimulationDefinition, narration: SimulationSessionView["narration"] = []): SimulationSessionView {
  const state = toSimState(session);
  const done = session.status === "completed";
  return {
    session,
    simulation: def.public,
    turn: turnView(def, state),
    resources: visibleResources(def, session.resources),
    revealedEvidence: session.revealedEvidenceIds.map((id) => ({ id, text: def.hidden.evidence[id] ?? "" })),
    hints: [],
    historicalRecord: done ? { ...def.hidden.historicalRecord, debrief: def.hidden.debrief } : null,
    narration,
  };
}

function buildSimAssessmentMessages(def: SimulationDefinition, session: SimulationSession): ChatMessage[] {
  const example = SimulationAssessmentDraft.parse({
    criteria: def.hidden.rubric.map((c) => ({ criterionId: c.id, score: 0.5, evidence: "Quote the player's rationale." })),
    strengths: ["One concrete strength"],
    weaknesses: ["One concrete gap"],
    errorPatterns: ["momentum_over_objective"],
    debrief: "Two to four paragraphs comparing the player's decisions and rationales with the historical record, distinguishing good reasoning from lucky outcomes.",
  });
  const decisions = session.decisions
    .map((d) => {
      const turn = def.hidden.turns.find((t) => t.id === d.turnId);
      const opt = turn?.options.find((o) => o.id === d.optionId);
      return `- ${turn?.title ?? d.turnId}: chose "${opt?.label ?? d.optionId}" (${d.historicalMatch ? "matches the record" : "counterfactual"}; confidence ${d.confidence === null ? "n/a" : Math.round(d.confidence * 100) + "%"}). Rationale: ${d.rationale || "(none given)"}`;
    })
    .join("\n");
  const system = [
    "You are assessing a learner's decisions in a historical strategy simulation. Judge the reasoning, not whether they replicated history: a well-reasoned counterfactual can score higher than an unjustified historical match.",
    "Score each rubric criterion 0..1 with level descriptors, citing the player's rationales. Distinguish success by reasoning from success by luck.",
    "Do not invent historical facts. Only the background, claims and record below may be treated as history; everything else in the scenario is simulation.",
    "",
    `SCENARIO: ${def.public.title} (${def.public.figure}, ${def.public.period})`,
    `BACKGROUND: ${def.public.background}`,
    `CLAIMS: ${def.public.claims.map((c) => `[${c.certainty}] ${c.text}`).join(" | ")}`,
    `HISTORICAL RECORD: ${def.hidden.historicalRecord.decision} OUTCOME: ${def.hidden.historicalRecord.outcome}`,
    "RUBRIC:",
    ...def.hidden.rubric.map((c) => `- ${c.id} (weight ${c.weight}, skill ${c.skill}): ${c.title}. ${c.description} Levels: ${c.levels.map((l) => `${l.score}=${l.descriptor}`).join("; ")}`),
    "",
    `PLAYER DECISIONS:\n${decisions || "none"}`,
    `FINAL RESOURCES: ${JSON.stringify(session.resources)}`,
    "",
    "RESPOND WITH JSON ONLY:",
    `EXAMPLE_JSON:${JSON.stringify(example)}`,
    "END_EXAMPLE_JSON",
  ].join("\n");
  return [
    { role: "system", content: system },
    { role: "user", content: "Assess the run and return the JSON object." },
  ];
}

export async function evaluateSimulation(ai: ModelRouter, def: SimulationDefinition, session: SimulationSession): Promise<{ evaluation: SimulationEvaluation; model: string }> {
  const { value: draft, raw } = await ai.generateStructured("coach.assess", SimulationAssessmentDraft, buildSimAssessmentMessages(def, session));
  const overall = aggregateRubric(def.hidden.rubric, draft.criteria);
  const settlement = def.public.resources.find((r) => r.key === "german_settlement" || r.key === "cost_position");
  const succeeded = settlement ? (session.resources[settlement.key] ?? 0) >= settlement.initial : null;
  const evaluation = SimulationEvaluation.parse({
    criteria: draft.criteria,
    overallScore: overall,
    skillScores: skillScoresFromRubric(def.hidden.rubric, draft.criteria),
    outcomeQuality: classifyOutcome(succeeded, overall),
    historicalMatches: session.decisions.filter((d) => d.historicalMatch).length,
    turnsPlayed: session.decisions.length,
    finalResources: session.resources,
    succeeded,
    strengths: draft.strengths,
    weaknesses: draft.weaknesses,
    errorPatterns: draft.errorPatterns,
    debrief: draft.debrief,
    assessedAt: nowIso(),
  });
  return { evaluation, model: `${raw.provider}:${raw.model}` };
}
