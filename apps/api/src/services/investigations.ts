import { and, desc, eq } from "drizzle-orm";
import type { ChatMessage, ModelRouter } from "@lunara/ai";
import {
  INVESTIGATION_SESSION_SCHEMA_VERSION,
  InvestigationAssessmentDraft,
  InvestigationEvaluation,
  InvestigationSession,
  nowIso,
  type InvestigationDefinition,
  type InvestigationSessionView,
} from "@lunara/schemas";
import {
  aggregateRubric,
  classifyOutcome,
  evaluateDeterministic,
  initialState,
  revealedEvidence,
  skillScoresFromRubric,
  type InvestigationState,
} from "@lunara/core";
import type { Db } from "../db/client";
import { investigationSessions } from "../db/schema";
import { newId } from "../ids";

const iso = (d: Date | null | undefined): string | null => (d ? d.toISOString() : null);

export function rowToInvestigationSession(row: typeof investigationSessions.$inferSelect): InvestigationSession {
  return InvestigationSession.parse({
    schemaVersion: row.schemaVersion,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    id: row.id,
    uid: row.userId,
    investigationId: row.investigationId,
    investigationVersion: row.investigationVersion,
    status: row.status,
    pointsRemaining: row.pointsRemaining,
    revealedEvidenceIds: row.revealedEvidenceIds,
    actionsTaken: row.actionsTaken,
    hypotheses: row.hypotheses,
    confidenceHistory: row.confidenceHistory,
    hintLevel: row.hintLevel,
    conclusion: row.conclusion,
    evaluation: row.evaluation,
    startedAt: row.startedAt.toISOString(),
    lastActivityAt: row.lastActivityAt.toISOString(),
    completedAt: iso(row.completedAt),
  });
}

export function toInvestigationState(s: InvestigationSession): InvestigationState {
  return {
    status: s.status,
    pointsRemaining: s.pointsRemaining,
    revealedEvidenceIds: s.revealedEvidenceIds,
    actionsTaken: s.actionsTaken,
    hypotheses: s.hypotheses,
    confidenceHistory: s.confidenceHistory,
    hintLevel: s.hintLevel,
    conclusion: s.conclusion,
  };
}

export async function createInvestigationSession(db: Db, userId: string, def: InvestigationDefinition): Promise<InvestigationSession> {
  const s = initialState(def);
  const now = new Date();
  const [row] = await db
    .insert(investigationSessions)
    .values({
      id: newId("inv"),
      userId,
      schemaVersion: INVESTIGATION_SESSION_SCHEMA_VERSION,
      investigationId: def.public.id,
      investigationVersion: def.public.version,
      status: s.status,
      pointsRemaining: s.pointsRemaining,
      revealedEvidenceIds: s.revealedEvidenceIds,
      actionsTaken: [],
      hypotheses: [],
      confidenceHistory: [],
      hintLevel: 0,
      conclusion: null,
      evaluation: null,
      startedAt: now,
      lastActivityAt: now,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return rowToInvestigationSession(row!);
}

export async function getOwnedInvestigationSession(db: Db, userId: string, id: string): Promise<InvestigationSession | null> {
  const row = await db.query.investigationSessions.findFirst({ where: and(eq(investigationSessions.id, id), eq(investigationSessions.userId, userId)) });
  return row ? rowToInvestigationSession(row) : null;
}

export async function listInvestigationSessions(db: Db, userId: string, limit = 50): Promise<InvestigationSession[]> {
  const rows = await db.select().from(investigationSessions).where(eq(investigationSessions.userId, userId)).orderBy(desc(investigationSessions.lastActivityAt)).limit(limit);
  return rows.map(rowToInvestigationSession);
}

export async function saveInvestigationState(db: Db, id: string, state: InvestigationState, extra: { evaluation?: InvestigationEvaluation; completedAt?: Date } = {}): Promise<InvestigationSession> {
  const now = new Date();
  const [row] = await db
    .update(investigationSessions)
    .set({
      status: state.status,
      pointsRemaining: state.pointsRemaining,
      revealedEvidenceIds: state.revealedEvidenceIds,
      actionsTaken: state.actionsTaken,
      hypotheses: state.hypotheses,
      confidenceHistory: state.confidenceHistory,
      hintLevel: state.hintLevel,
      conclusion: state.conclusion,
      lastActivityAt: now,
      updatedAt: now,
      ...(extra.evaluation ? { evaluation: extra.evaluation } : {}),
      ...(extra.completedAt ? { completedAt: extra.completedAt } : {}),
    })
    .where(eq(investigationSessions.id, id))
    .returning();
  return rowToInvestigationSession(row!);
}

/** Everything the client may see for a session. Hidden material is released by state only. */
export function investigationView(session: InvestigationSession, def: InvestigationDefinition): InvestigationSessionView {
  const state = toInvestigationState(session);
  const concluded = session.status === "completed" && session.conclusion !== null;
  return {
    session,
    investigation: def.public,
    revealedEvidence: revealedEvidence(state, def),
    hints: def.hidden.hints.slice(0, session.hintLevel),
    groundTruth: concluded ? { answerEntityId: def.hidden.groundTruth.answerEntityId, summary: def.hidden.groundTruth.summary, debrief: def.hidden.debrief } : null,
  };
}

// ── Evaluation ──────────────────────────────────────────────────────────────

function buildEvaluationMessages(def: InvestigationDefinition, session: InvestigationSession, det: ReturnType<typeof evaluateDeterministic>): ChatMessage[] {
  const state = toInvestigationState(session);
  const revealed = revealedEvidence(state, def);
  const evidenceById = new Map(def.hidden.evidence.map((e) => [e.id, e]));
  const concluded = session.hypotheses.find((h) => h.id === session.conclusion?.hypothesisId);
  const example = InvestigationAssessmentDraft.parse({
    criteria: def.hidden.rubric.map((c) => ({ criterionId: c.id, score: 0.5, evidence: "Cite the learner's hypotheses, links or rationale." })),
    strengths: ["One concrete strength"],
    weaknesses: ["One concrete gap"],
    errorPatterns: ["confirmatory_actions"],
    debrief: "Two to four paragraphs comparing the learner's investigation with the ground truth, naming specific choices they made.",
  });
  const hyps = session.hypotheses
    .map((h) => {
      const entity = def.public.entities.find((e) => e.id === h.answerEntityId)?.name ?? "no entity";
      const links = h.links.map((l) => `${l.relation}(${l.weight}) ${evidenceById.get(l.evidenceId)?.title ?? l.evidenceId}${l.note ? ` — ${l.note}` : ""}`).join("; ");
      return `- [${h.status}] ${h.statement} → ${entity} | confidence ${Math.round(h.confidence * 100)}% | links: ${links || "none"} | assumptions: ${h.assumptions.join("; ") || "none"}${h.distinguishingTest ? ` | distinguishing test: ${h.distinguishingTest}` : ""}`;
    })
    .join("\n");
  const system = [
    "You are assessing a learner's investigation. Judge the reasoning process and evidence handling, not luck.",
    "Score each rubric criterion 0..1 using its level descriptors and cite the learner's own hypotheses, links, actions or rationale as evidence.",
    "The deterministic facts below are computed by the system; use them, do not recompute or contradict them.",
    "",
    `CASE: ${def.public.title}`,
    `GROUND TRUTH: ${def.hidden.groundTruth.summary}`,
    `KEY EVIDENCE: ${def.hidden.groundTruth.keyEvidenceIds.map((id) => evidenceById.get(id)?.title ?? id).join(" / ")}`,
    `MISLEADING EVIDENCE: ${def.hidden.groundTruth.misleadingEvidenceIds.map((id) => evidenceById.get(id)?.title ?? id).join(" / ") || "none"}`,
    "RUBRIC:",
    ...def.hidden.rubric.map((c) => `- ${c.id} (weight ${c.weight}, skill ${c.skill}): ${c.title}. ${c.description} Levels: ${c.levels.map((l) => `${l.score}=${l.descriptor}`).join("; ")}`),
    "",
    `ACTIONS TAKEN (in order): ${session.actionsTaken.map((a) => def.public.actions.find((x) => x.id === a.actionId)?.label ?? a.actionId).join(" → ") || "none"}`,
    `POINTS USED: ${det.pointsUsed}/${def.public.budget}. HINTS: ${session.hintLevel}/5.`,
    `EVIDENCE UNCOVERED: ${revealed.map((e) => e.title).join("; ")}`,
    `KEY EVIDENCE NEVER UNCOVERED: ${det.missedKeyEvidenceIds.map((id) => evidenceById.get(id)?.title ?? id).join("; ") || "none"}`,
    `DETERMINISTIC: correct=${det.correct}, evidenceCoverage=${det.evidenceCoverage.toFixed(2)}, contradictionAwareness=${det.contradictionAwareness.toFixed(2)}, misledBy=${det.misledByCount}, competingHypotheses=${det.competingHypotheses}`,
    `HYPOTHESES:\n${hyps || "none"}`,
    `CONCLUSION: ${concluded ? `${concluded.statement} (confidence ${Math.round((session.conclusion?.confidence ?? 0) * 100)}%)` : "none"}\nRATIONALE: ${session.conclusion?.rationale ?? ""}`,
    "",
    "RESPOND WITH JSON ONLY matching this shape (same criterion ids):",
    `EXAMPLE_JSON:${JSON.stringify(example)}`,
    "END_EXAMPLE_JSON",
  ].join("\n");
  return [
    { role: "system", content: system },
    { role: "user", content: "Assess the investigation and return the JSON object." },
  ];
}

export async function evaluateInvestigation(ai: ModelRouter, def: InvestigationDefinition, session: InvestigationSession): Promise<{ evaluation: InvestigationEvaluation; model: string }> {
  const det = evaluateDeterministic(toInvestigationState(session), def);
  const { value: draft, raw } = await ai.generateStructured("coach.assess", InvestigationAssessmentDraft, buildEvaluationMessages(def, session, det));
  const overall = aggregateRubric(def.hidden.rubric, draft.criteria);
  const evaluation = InvestigationEvaluation.parse({
    correct: det.correct,
    evidenceCoverage: det.evidenceCoverage,
    contradictionAwareness: det.contradictionAwareness,
    misledByCount: det.misledByCount,
    competingHypotheses: det.competingHypotheses,
    pointsUsed: det.pointsUsed,
    budget: def.public.budget,
    hintLevelUsed: session.hintLevel,
    criteria: draft.criteria,
    overallScore: overall,
    skillScores: skillScoresFromRubric(def.hidden.rubric, draft.criteria),
    outcomeQuality: classifyOutcome(det.correct, overall),
    calibration: { statedConfidence: session.conclusion?.confidence ?? 0, correct: det.correct },
    strengths: draft.strengths,
    weaknesses: draft.weaknesses,
    errorPatterns: draft.errorPatterns,
    debrief: draft.debrief,
    assessedAt: nowIso(),
  });
  return { evaluation, model: `${raw.provider}:${raw.model}` };
}
