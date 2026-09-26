import { and, desc, eq } from "drizzle-orm";
import type { ChatMessage, ModelRouter } from "@lunara/ai";
import {
  AdversarialQuestionsDraft,
  CHALLENGE_ATTEMPT_SCHEMA_VERSION,
  CHALLENGE_STAGES,
  ChallengeAssessment,
  ChallengeAssessmentDraft,
  ChallengeAttempt,
  ChallengeData,
  nowIso,
  type ChallengeDefinition,
  type ChallengeStage,
  type ChallengeStageRequest,
  type ChallengeView,
} from "@lunara/schemas";
import { aggregateRubric, skillScoresFromRubric } from "@lunara/core";
import type { Db } from "../db/client";
import { challengeAttempts } from "../db/schema";
import { ApiHttpError, invalid } from "../errors";
import { newId } from "../ids";

const iso = (d: Date | null | undefined): string | null => (d ? d.toISOString() : null);

export function rowToAttempt(r: typeof challengeAttempts.$inferSelect): ChallengeAttempt {
  return ChallengeAttempt.parse({
    schemaVersion: r.schemaVersion,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    id: r.id,
    uid: r.userId,
    challengeId: r.challengeId,
    challengeVersion: r.challengeVersion,
    monthKey: r.monthKey,
    stage: r.stage,
    status: r.status,
    data: r.data,
    assessment: r.assessment,
    startedAt: r.startedAt.toISOString(),
    lastActivityAt: r.lastActivityAt.toISOString(),
    completedAt: iso(r.completedAt),
  });
}

export async function listAttempts(db: Db, userId: string): Promise<ChallengeAttempt[]> {
  const rows = await db.select().from(challengeAttempts).where(eq(challengeAttempts.userId, userId)).orderBy(desc(challengeAttempts.startedAt)).limit(50);
  return rows.map(rowToAttempt);
}

export async function getOwnedAttempt(db: Db, userId: string, id: string): Promise<ChallengeAttempt | null> {
  const row = await db.query.challengeAttempts.findFirst({ where: and(eq(challengeAttempts.id, id), eq(challengeAttempts.userId, userId)) });
  return row ? rowToAttempt(row) : null;
}

export async function startAttempt(db: Db, userId: string, def: ChallengeDefinition, monthKey: string): Promise<ChallengeAttempt> {
  const now = new Date();
  const data = ChallengeData.parse({ pointsRemaining: def.public.budget, revealedEvidenceIds: def.hidden.evidence.filter((e) => e.initial).map((e) => e.id) });
  const [row] = await db
    .insert(challengeAttempts)
    .values({ id: newId("chal"), userId, schemaVersion: CHALLENGE_ATTEMPT_SCHEMA_VERSION, challengeId: def.public.id, challengeVersion: def.public.version, monthKey, stage: "situation", status: "active", data, assessment: null, startedAt: now, lastActivityAt: now, createdAt: now, updatedAt: now })
    .returning();
  return rowToAttempt(row!);
}

export function challengeView(attempt: ChallengeAttempt, def: ChallengeDefinition): ChallengeView {
  const revealed = new Set(attempt.data.revealedEvidenceIds);
  const done = attempt.stage === "assessed";
  return {
    attempt,
    challenge: def.public,
    revealedEvidence: def.hidden.evidence.filter((e) => revealed.has(e.id)),
    referenceAnalysis: done ? def.hidden.referenceAnalysis : null,
    caseDebrief: done ? def.hidden.debrief : null,
  };
}

async function persist(db: Db, id: string, patch: Partial<typeof challengeAttempts.$inferInsert>): Promise<ChallengeAttempt> {
  const [row] = await db.update(challengeAttempts).set({ ...patch, lastActivityAt: new Date(), updatedAt: new Date() }).where(eq(challengeAttempts.id, id)).returning();
  return rowToAttempt(row!);
}

function nextStage(stage: ChallengeStage): ChallengeStage {
  return CHALLENGE_STAGES[CHALLENGE_STAGES.indexOf(stage) + 1] ?? "assessed";
}

/** Stages advance strictly in order; each submission validates against the current stage. */
export async function submitStage(db: Db, ai: ModelRouter, def: ChallengeDefinition, attempt: ChallengeAttempt, req: ChallengeStageRequest): Promise<ChallengeAttempt> {
  if (attempt.status !== "active") throw new ApiHttpError("conflict", "Attempt is not active");
  if (req.stage !== attempt.stage) throw new ApiHttpError("conflict", `Current stage is ${attempt.stage}`);
  const data = { ...attempt.data };
  switch (req.stage) {
    case "situation":
      data.situation = req.data;
      break;
    case "hypotheses": {
      const revealed = new Set(data.revealedEvidenceIds);
      for (const h of req.data) for (const id of h.evidenceIds) if (!revealed.has(id)) throw invalid("Hypotheses may only cite evidence you have uncovered");
      data.hypotheses = req.data.map((h) => ({ ...h, id: newId("chyp") }));
      break;
    }
    case "information": {
      if (req.actionId) {
        const action = def.public.actions.find((a) => a.id === req.actionId);
        if (!action) throw invalid("Unknown action");
        if (data.actionsTaken.some((a) => a.actionId === action.id)) throw invalid("Already taken");
        if (action.cost > data.pointsRemaining) throw invalid("Not enough points");
        const revealed = new Set(data.revealedEvidenceIds);
        if (action.requiresEvidence.some((id) => !revealed.has(id))) throw invalid("Prerequisite evidence missing");
        data.pointsRemaining -= action.cost;
        data.actionsTaken = [...data.actionsTaken, { actionId: action.id, cost: action.cost, at: nowIso() }];
        data.revealedEvidenceIds = [...new Set([...data.revealedEvidenceIds, ...(def.hidden.actionReveals[action.id] ?? [])])];
        return persist(db, attempt.id, { data });
      }
      if (!req.done) throw invalid("Choose an action or finish the information stage");
      break;
    }
    case "tree":
      data.treeId = req.treeId;
      break;
    case "anticipation":
      data.anticipation = req.data;
      break;
    case "strategy":
      data.strategy = req.data;
      break;
    case "decision": {
      data.decision = req.data;
      // Generate the adversarial questions now so the next stage is ready.
      const questions = await adversarialQuestions(ai, def, { ...attempt, data });
      data.adversarial = { questions, answers: [] };
      break;
    }
    case "adversarial": {
      if (req.answers.length < data.adversarial.questions.length) throw invalid(`Answer all ${data.adversarial.questions.length} questions`);
      data.adversarial = { ...data.adversarial, answers: req.answers.slice(0, data.adversarial.questions.length) };
      break;
    }
    default:
      throw invalid("Unknown stage");
  }
  const stage = nextStage(req.stage);
  return persist(db, attempt.id, { data, stage });
}

function summarise(def: ChallengeDefinition, attempt: ChallengeAttempt): string {
  const d = attempt.data;
  const ev = new Map(def.hidden.evidence.map((e) => [e.id, e.title]));
  return [
    `SITUATION: ${d.situation ? `${d.situation.summary}\nKNOWNS: ${d.situation.knowns.join("; ")}\nUNKNOWNS: ${d.situation.unknowns.join("; ")}\nASSUMPTIONS: ${d.situation.assumptions.join("; ") || "none"}` : "none"}`,
    `HYPOTHESES: ${d.hypotheses.map((h) => `${h.statement} (${Math.round(h.confidence * 100)}%; cites ${h.evidenceIds.map((id) => ev.get(id) ?? id).join(", ") || "nothing"})`).join(" | ") || "none"}`,
    `EVIDENCE UNCOVERED: ${d.revealedEvidenceIds.map((id) => ev.get(id) ?? id).join("; ")} (points used ${def.public.budget - d.pointsRemaining}/${def.public.budget})`,
    `KEY EVIDENCE MISSED: ${def.hidden.keyEvidenceIds.filter((id) => !d.revealedEvidenceIds.includes(id)).map((id) => ev.get(id) ?? id).join("; ") || "none"}`,
    `TREE LINKED: ${d.treeId ?? "none"}`,
    `ANTICIPATION: ${d.anticipation.map((p) => `${p.actor}: ${p.response} (${Math.round(p.probability * 100)}%${p.trigger ? `; trigger: ${p.trigger}` : ""})`).join(" | ") || "none"}`,
    `STRATEGY: ${d.strategy ? `PRIMARY: ${d.strategy.primary}\nFALLBACK: ${d.strategy.fallback}\nASSUMPTIONS: ${d.strategy.assumptions.join("; ")} (confidence ${Math.round(d.strategy.confidence * 100)}%)` : "none"}`,
    `DECISION: ${d.decision ? `${d.decision.text} — ${d.decision.rationale} (confidence ${Math.round(d.decision.confidence * 100)}%)` : "none"}`,
  ].join("\n\n");
}

async function adversarialQuestions(ai: ModelRouter, def: ChallengeDefinition, attempt: ChallengeAttempt): Promise<string[]> {
  const example = AdversarialQuestionsDraft.parse({ questions: ["A specific, hard question about the adviser's reasoning.", "Another one, about what happens if a key assumption is wrong."] });
  const messages: ChatMessage[] = [
    { role: "system", content: [def.hidden.adversaryPersona, `CASE: ${def.public.briefing}`, `REFERENCE (do not reveal): ${def.hidden.referenceAnalysis}`, `THE ADVISER'S WORK:\n${summarise(def, attempt)}`, "Write 3 questions. RESPOND WITH JSON ONLY:", `EXAMPLE_JSON:${JSON.stringify(example)}`, "END_EXAMPLE_JSON"].join("\n\n") },
    { role: "user", content: "Ask your questions." },
  ];
  const { value } = await ai.generateStructured("council.role", AdversarialQuestionsDraft, messages);
  return value.questions.slice(0, 4);
}

export async function assessAttempt(db: Db, ai: ModelRouter, def: ChallengeDefinition, attempt: ChallengeAttempt): Promise<ChallengeAttempt> {
  if (attempt.stage !== "assessed" || attempt.assessment) return attempt;
  const previous = (await listAttempts(db, attempt.uid)).filter((a) => a.challengeId === attempt.challengeId && a.id !== attempt.id && a.assessment);
  const previousBest = previous.length ? Math.max(...previous.map((a) => a.assessment!.overallScore)) : null;
  const example = ChallengeAssessmentDraft.parse({
    criteria: def.hidden.rubric.map((c) => ({ criterionId: c.id, score: 0.5, evidence: "Cite the adviser's own stage responses." })),
    strengths: ["One concrete strength"],
    weaknesses: ["One concrete gap"],
    errorPatterns: ["missed_structural_evidence"],
    debrief: "Three to five paragraphs across all stages: process, evidence quality, coherence, uncertainty and adaptation under adversarial review.",
  });
  const qa = attempt.data.adversarial.questions.map((q, i) => `Q: ${q}\nA: ${attempt.data.adversarial.answers[i] ?? "(no answer)"}`).join("\n\n");
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: [
        "You are assessing a learner's complete attempt at a master challenge. Score each rubric criterion 0..1 with descriptors, citing the learner's own words. Judge process and evidence quality, not agreement with the reference. This is not an intelligence measure; say nothing about ability in general.",
        `CASE: ${def.public.title}\nREFERENCE ANALYSIS: ${def.hidden.referenceAnalysis}`,
        "RUBRIC:\n" + def.hidden.rubric.map((c) => `- ${c.id} (weight ${c.weight}, skill ${c.skill}): ${c.title}. ${c.description} Levels: ${c.levels.map((l) => `${l.score}=${l.descriptor}`).join("; ")}`).join("\n"),
        `THE ATTEMPT:\n${summarise(def, attempt)}`,
        `ADVERSARIAL REVIEW:\n${qa}`,
        "RESPOND WITH JSON ONLY:",
        `EXAMPLE_JSON:${JSON.stringify(example)}`,
        "END_EXAMPLE_JSON",
      ].join("\n\n"),
    },
    { role: "user", content: "Assess the attempt." },
  ];
  const { value: draft } = await ai.generateStructured("coach.assess", ChallengeAssessmentDraft, messages);
  const elapsedMinutes = Math.round((Date.now() - new Date(attempt.startedAt).getTime()) / 60_000);
  const covered = def.hidden.keyEvidenceIds.filter((id) => attempt.data.revealedEvidenceIds.includes(id)).length;
  const assessment = ChallengeAssessment.parse({
    criteria: draft.criteria,
    overallScore: aggregateRubric(def.hidden.rubric, draft.criteria),
    skillScores: skillScoresFromRubric(def.hidden.rubric, draft.criteria),
    evidenceCoverage: covered / def.hidden.keyEvidenceIds.length,
    elapsedMinutes,
    withinTimeBudget: elapsedMinutes <= def.public.timeBudgetMinutes,
    previousBest,
    strengths: draft.strengths,
    weaknesses: draft.weaknesses,
    errorPatterns: draft.errorPatterns,
    debrief: draft.debrief,
    assessedAt: nowIso(),
  });
  return persist(db, attempt.id, { assessment, status: "completed", completedAt: new Date() });
}

export async function abandonAttempt(db: Db, attempt: ChallengeAttempt): Promise<ChallengeAttempt> {
  return persist(db, attempt.id, { status: "abandoned" });
}
