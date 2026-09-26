import { and, eq } from "drizzle-orm";
import { SkillAssessment, type SessionAssessment, type SkillId } from "@lunara/schemas";
import { applyEvidence } from "@lunara/core";
import type { Db } from "../db/client";
import { skillAssessments } from "../db/schema";

const iso = (d: Date | null | undefined): string | null => (d ? d.toISOString() : null);

export function rowToSkill(r: typeof skillAssessments.$inferSelect): SkillAssessment {
  return SkillAssessment.parse({
    schemaVersion: r.schemaVersion,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    skillId: r.skillId,
    estimate: r.estimate,
    unaidedEstimate: r.unaidedEstimate,
    confidence: r.confidence,
    evidenceCount: r.evidenceCount,
    lastEvidenceAt: iso(r.lastEvidenceAt),
    recentEvidence: r.recentEvidence,
  });
}

/** Apply one session's assessment to every skill it produced evidence for. */
export async function applyAssessmentToSkills(
  db: Db,
  userId: string,
  sessionId: string,
  exerciseId: string,
  assessment: SessionAssessment,
): Promise<SkillAssessment[]> {
  const updated: SkillAssessment[] = [];
  for (const { skillId, score } of assessment.skillScores) {
    const existing = await db.query.skillAssessments.findFirst({
      where: and(eq(skillAssessments.userId, userId), eq(skillAssessments.skillId, skillId)),
    });
    const next = applyEvidence(existing ? rowToSkill(existing) : null, skillId as SkillId, {
      sessionId,
      exerciseId,
      score,
      hintLevel: assessment.hintLevelUsed,
      revealedBeforeDecision: assessment.revealedBeforeDecision,
      note: assessment.outcomeQuality,
      at: assessment.assessedAt,
    });
    const values = {
      userId,
      skillId,
      schemaVersion: next.schemaVersion,
      estimate: next.estimate,
      unaidedEstimate: next.unaidedEstimate,
      confidence: next.confidence,
      evidenceCount: next.evidenceCount,
      lastEvidenceAt: next.lastEvidenceAt ? new Date(next.lastEvidenceAt) : null,
      recentEvidence: next.recentEvidence,
      updatedAt: new Date(),
    };
    await db
      .insert(skillAssessments)
      .values({ ...values, createdAt: new Date() })
      .onConflictDoUpdate({ target: [skillAssessments.userId, skillAssessments.skillId], set: values });
    updated.push(next);
  }
  return updated;
}
