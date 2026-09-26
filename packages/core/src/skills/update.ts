import type { IsoTimestamp, SkillAssessment, SkillEvidenceRef, SkillId } from "@lunara/schemas";

/**
 * Evidence-driven skill estimate update.
 *
 * estimate' = estimate + k * w * (score - estimate)
 *   k = clamp(1 / (evidenceCount + 1), K_MIN, K_MAX)   fast early, stable later
 *   w = max(W_MIN, 1 - HINT_PENALTY * hintLevel)        assisted evidence counts less
 *
 * `unaidedEstimate` moves only on hint-free, unrevealed evidence so the
 * profile can distinguish assisted learning from unaided mastery.
 * `confidence` is a function of evidence count, not of the score.
 */
export const K_MIN = 0.1;
export const K_MAX = 0.5;
export const W_MIN = 0.5;
export const HINT_PENALTY = 0.1;
export const CONFIDENCE_SATURATION = 8;
export const RECENT_EVIDENCE_LIMIT = 10;
export const SKILL_SCHEMA_VERSION = 1;

export interface SkillEvidenceInput {
  sessionId: string;
  exerciseId: string;
  score: number;
  hintLevel: number;
  revealedBeforeDecision: boolean;
  note?: string;
  at: IsoTimestamp;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function emptySkill(skillId: SkillId, now: IsoTimestamp): SkillAssessment {
  return {
    schemaVersion: SKILL_SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now,
    skillId,
    estimate: 0.5,
    unaidedEstimate: null,
    confidence: 0,
    evidenceCount: 0,
    lastEvidenceAt: null,
    recentEvidence: [],
  };
}

export function learningRate(evidenceCount: number): number {
  return clamp(1 / (evidenceCount + 1), K_MIN, K_MAX);
}

export function assistanceWeight(hintLevel: number): number {
  return Math.max(W_MIN, 1 - HINT_PENALTY * clamp(hintLevel, 0, 5));
}

export function confidenceFromEvidence(evidenceCount: number): number {
  return clamp(evidenceCount / CONFIDENCE_SATURATION, 0, 1);
}

export function applyEvidence(
  current: SkillAssessment | null,
  skillId: SkillId,
  evidence: SkillEvidenceInput,
): SkillAssessment {
  const base = current ?? emptySkill(skillId, evidence.at);
  const score = clamp(evidence.score, 0, 1);
  const k = learningRate(base.evidenceCount);
  const w = assistanceWeight(evidence.hintLevel);
  const delta = k * w * (score - base.estimate);
  const estimate = clamp(base.estimate + delta, 0, 1);

  const unaided = evidence.hintLevel === 0 && !evidence.revealedBeforeDecision;
  let unaidedEstimate = base.unaidedEstimate;
  if (unaided) {
    unaidedEstimate =
      unaidedEstimate === null ? score : clamp(unaidedEstimate + k * (score - unaidedEstimate), 0, 1);
  }

  const ref: SkillEvidenceRef = {
    sessionId: evidence.sessionId,
    exerciseId: evidence.exerciseId,
    score,
    hintLevel: clamp(Math.round(evidence.hintLevel), 0, 5),
    delta: clamp(delta, -1, 1),
    at: evidence.at,
    ...(evidence.note ? { note: evidence.note.slice(0, 280) } : {}),
  };
  const recentEvidence = [...base.recentEvidence, ref].slice(-RECENT_EVIDENCE_LIMIT);
  const evidenceCount = base.evidenceCount + 1;

  return {
    ...base,
    updatedAt: evidence.at,
    estimate,
    unaidedEstimate,
    confidence: confidenceFromEvidence(evidenceCount),
    evidenceCount,
    lastEvidenceAt: evidence.at,
    recentEvidence,
  };
}

/** Simple trend over recent evidence: mean of last half minus mean of first half. */
export function recentTrend(skill: SkillAssessment): number | null {
  const scores = skill.recentEvidence.map((e) => e.score);
  if (scores.length < 4) return null;
  const mid = Math.floor(scores.length / 2);
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  return mean(scores.slice(mid)) - mean(scores.slice(0, mid));
}
