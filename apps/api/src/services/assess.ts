import type { ChatMessage, ModelRouter } from "@lunara/ai";
import {
  AssessmentDraft,
  SessionAssessment,
  nowIso,
  type CoachingSession,
  type ExerciseDefinition,
  type SessionMessage,
} from "@lunara/schemas";
import { aggregateRubric, classifyOutcome, skillScoresFromRubric, unaidedScore } from "@lunara/core";

/**
 * Structured assessment of a finished attempt. The model scores each rubric
 * criterion with quoted evidence; the server computes the aggregate, the
 * unaided score, per-skill scores and the outcome-quality classification so
 * those numbers never come from free text.
 */
export function buildAssessmentMessages(exercise: ExerciseDefinition, session: CoachingSession, history: SessionMessage[]): ChatMessage[] {
  const pub = exercise.public;
  const hid = exercise.hidden;
  const example = AssessmentDraft.parse({
    criteria: hid.rubric.map((c) => ({ criterionId: c.id, score: 0.5, evidence: "Quote or paraphrase from the learner's own messages." })),
    correct: pub.answerKind === "fixed" ? false : null,
    strengths: ["One concrete strength"],
    weaknesses: ["One concrete gap"],
    errorPatterns: ["premature_commitment"],
    debrief: "Two to four paragraphs comparing the learner's reasoning with the solution, naming specific moves they made.",
  });
  const transcript = history
    .filter((m) => m.role === "user" || (m.role === "coach" && m.kind === "turn"))
    .slice(-30)
    .map((m) => `${m.role === "user" ? "LEARNER" : "COACH"}: ${m.content}`)
    .join("\n");
  const system = [
    "You are assessing a learner's reasoning in a strategy-training exercise. Be fair, specific and evidence-based.",
    "Score each rubric criterion from 0 to 1 using its level descriptors. For every score, cite evidence from the learner's own hypotheses, messages or decision. Do not reward restating the solution after it was revealed.",
    "Judge the reasoning process, not luck: a correct answer with weak support scores low on the criteria that measure support.",
    pub.answerKind === "fixed"
      ? "Set `correct` to true only if the learner's final decision matches the solution in substance."
      : "This is an open exercise; set `correct` to null.",
    "Name at most five strengths and five weaknesses. `errorPatterns` are short snake_case labels of recurring reasoning errors (e.g. premature_commitment, ignored_base_rate, no_contingency, badge_equals_owner).",
    "The debrief must be personal: refer to what this learner actually wrote. No praise without evidence.",
    "",
    `EXERCISE: ${pub.title} (${pub.mode})`,
    `OBJECTIVES: ${pub.learningObjectives.join(" | ")}`,
    `SCENARIO: ${pub.scenario}`,
    `SOLUTION / REFERENCE ANALYSIS: ${hid.solution}`,
    `KEY INSIGHTS: ${hid.keyInsights.join(" / ")}`,
    `COMMON ERRORS: ${hid.commonErrors.join(" / ")}`,
    "RUBRIC:",
    ...hid.rubric.map((c) => `- ${c.id} (weight ${c.weight}, skill ${c.skill}): ${c.title}. ${c.description} Levels: ${c.levels.map((l) => `${l.score}=${l.descriptor}`).join("; ")}`),
    "",
    `HINTS USED: ${session.hintLevel}/5. SOLUTION REVEALED BEFORE DECISION: ${session.revealed && !session.decision ? "yes" : "see timing"}.`,
    `LEARNER HYPOTHESES:\n${session.hypotheses.map((h) => `- [${h.status}] ${h.statement} | for: ${h.supportingEvidence.join("; ") || "-"} | against: ${h.contradictingEvidence.join("; ") || "-"} | assumes: ${h.assumptions.join("; ") || "-"} | confidence ${Math.round(h.confidence * 100)}%`).join("\n") || "none"}`,
    `LEARNER DECISION: ${session.decision ? `${session.decision.text} — ${session.decision.rationale} (confidence ${Math.round(session.decision.confidence * 100)}%)` : "none (solution revealed instead)"}`,
    `TRANSCRIPT:\n${transcript || "(no messages)"}`,
    "",
    "RESPOND WITH JSON ONLY, matching this shape exactly (same criterion ids, same keys):",
    `EXAMPLE_JSON:${JSON.stringify(example)}`,
    "END_EXAMPLE_JSON",
  ].join("\n");
  return [
    { role: "system", content: system },
    { role: "user", content: "Assess the attempt and return the JSON object." },
  ];
}

export interface AssessInput {
  ai: ModelRouter;
  exercise: ExerciseDefinition;
  session: CoachingSession;
  history: SessionMessage[];
  revealedBeforeDecision: boolean;
}

export async function assessSession(input: AssessInput): Promise<{ assessment: SessionAssessment; model: string }> {
  const { exercise, session } = input;
  const messages = buildAssessmentMessages(exercise, session, input.history);
  const { value: draft, raw } = await input.ai.generateStructured("coach.assess", AssessmentDraft, messages);

  // Server-side numbers. Missing or unknown criteria are a validation failure, not a silent zero.
  const overall = aggregateRubric(exercise.hidden.rubric, draft.criteria);
  const skillScores = skillScoresFromRubric(exercise.hidden.rubric, draft.criteria);
  const correct = exercise.public.answerKind === "fixed" ? draft.correct : null;
  const assessment = SessionAssessment.parse({
    overallScore: overall,
    unaidedScore: unaidedScore(overall, session.hintLevel, input.revealedBeforeDecision),
    hintLevelUsed: session.hintLevel,
    revealedBeforeDecision: input.revealedBeforeDecision,
    criteria: draft.criteria,
    skillScores,
    correct,
    outcomeQuality: classifyOutcome(correct, overall),
    strengths: draft.strengths,
    weaknesses: draft.weaknesses,
    errorPatterns: draft.errorPatterns,
    debrief: draft.debrief,
    assessedAt: nowIso(),
  });
  return { assessment, model: `${raw.provider}:${raw.model}` };
}
