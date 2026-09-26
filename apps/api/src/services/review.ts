import { and, asc, count, eq, gte, lte, type SQL } from "drizzle-orm";
import { ReviewItem, nowIso, type CreateReviewItemRequest, type ReviewRating } from "@lunara/schemas";
import { applyEvidence, gradeCard, newReviewCard, previewIntervals, retentionScore } from "@lunara/core";
import type { Db } from "../db/client";
import { reviewItems, skillAssessments } from "../db/schema";
import { newId } from "../ids";
import { rowToSkill } from "./skills";

export const MAX_REVIEW_ITEMS = 5_000;

async function countWhere(db: Db, where: SQL | undefined): Promise<number> {
  const rows = await db.select({ n: count() }).from(reviewItems).where(where);
  return Number(rows[0]?.n ?? 0);
}

export function rowToReviewItem(r: typeof reviewItems.$inferSelect): ReviewItem {
  return ReviewItem.parse({
    schemaVersion: r.schemaVersion,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    id: r.id,
    uid: r.userId,
    kind: r.kind,
    prompt: r.prompt,
    answer: r.answer,
    objective: r.objective,
    source: r.source,
    conceptIds: r.conceptIds,
    skill: r.skill,
    card: r.card,
    history: r.history,
    suspended: r.suspended,
  });
}

export async function createReviewItem(db: Db, userId: string, input: CreateReviewItemRequest, now = new Date()): Promise<ReviewItem> {
  if ((await countWhere(db, eq(reviewItems.userId, userId))) >= MAX_REVIEW_ITEMS) throw new Error(`At most ${MAX_REVIEW_ITEMS} review items`);
  const card = newReviewCard(now);
  const [row] = await db
    .insert(reviewItems)
    .values({
      id: newId("rev"),
      userId,
      kind: input.kind,
      prompt: input.prompt,
      answer: input.answer,
      objective: input.objective ?? "",
      source: input.source ?? { type: "manual", refId: null, label: "" },
      conceptIds: input.conceptIds ?? [],
      skill: input.skill ?? null,
      card,
      due: new Date(card.due),
      history: [],
    })
    .returning();
  return rowToReviewItem(row!);
}

export async function listReviewItems(db: Db, userId: string): Promise<ReviewItem[]> {
  const rows = await db.select().from(reviewItems).where(eq(reviewItems.userId, userId)).orderBy(asc(reviewItems.due)).limit(MAX_REVIEW_ITEMS);
  return rows.map(rowToReviewItem);
}

export async function dueQueue(db: Db, userId: string, now = new Date(), limit = 20) {
  const dueRows = await db
    .select()
    .from(reviewItems)
    .where(and(eq(reviewItems.userId, userId), eq(reviewItems.suspended, false), lte(reviewItems.due, now)))
    .orderBy(asc(reviewItems.due))
    .limit(limit);
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const [dueCount, totalCount, reviewedToday] = await Promise.all([
    countDue(db, userId, now),
    countWhere(db, eq(reviewItems.userId, userId)),
    countWhere(db, and(eq(reviewItems.userId, userId), gte(reviewItems.updatedAt, dayStart))),
  ]);
  return {
    due: dueRows.map((r) => ({ ...rowToReviewItem(r), preview: previewIntervals(rowToReviewItem(r).card, now) })),
    dueCount,
    totalCount,
    reviewedToday,
  };
}

export async function countDue(db: Db, userId: string, now = new Date()): Promise<number> {
  return countWhere(db, and(eq(reviewItems.userId, userId), eq(reviewItems.suspended, false), lte(reviewItems.due, now)));
}

/** Grade an item, reschedule with FSRS, and record retention evidence. */
export async function gradeReviewItem(db: Db, userId: string, id: string, rating: ReviewRating, explanation: string | null, now = new Date()): Promise<{ item: ReviewItem; intervalDays: number } | null> {
  const row = await db.query.reviewItems.findFirst({ where: and(eq(reviewItems.id, id), eq(reviewItems.userId, userId)) });
  if (!row) return null;
  const item = rowToReviewItem(row);
  const { card, intervalDays } = gradeCard(item.card, rating, now);
  const ratingNumber = { again: 1, hard: 2, good: 3, easy: 4 }[rating];
  const history = [...item.history, { at: now.toISOString(), rating: ratingNumber, explanation }].slice(-30);
  const [updated] = await db
    .update(reviewItems)
    .set({ card, due: new Date(card.due), history, updatedAt: now })
    .where(eq(reviewItems.id, id))
    .returning();

  // Retention evidence on the learning_retention skill (and the item's own skill, lightly).
  const skillId = "learning_retention" as const;
  const existing = await db.query.skillAssessments.findFirst({ where: and(eq(skillAssessments.userId, userId), eq(skillAssessments.skillId, skillId)) });
  const next = applyEvidence(existing ? rowToSkill(existing) : null, skillId, {
    sessionId: id,
    exerciseId: item.source.refId ?? "review",
    score: retentionScore(rating),
    hintLevel: 0,
    revealedBeforeDecision: false,
    note: `review:${rating}`,
    at: nowIso(),
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
    updatedAt: now,
  };
  await db.insert(skillAssessments).values({ ...values, createdAt: now }).onConflictDoUpdate({ target: [skillAssessments.userId, skillAssessments.skillId], set: values });

  return { item: rowToReviewItem(updated!), intervalDays };
}

export async function setSuspended(db: Db, userId: string, id: string, suspended: boolean): Promise<ReviewItem | null> {
  const [row] = await db.update(reviewItems).set({ suspended, updatedAt: new Date() }).where(and(eq(reviewItems.id, id), eq(reviewItems.userId, userId))).returning();
  return row ? rowToReviewItem(row) : null;
}

export async function deleteReviewItem(db: Db, userId: string, id: string): Promise<boolean> {
  const rows = await db.delete(reviewItems).where(and(eq(reviewItems.id, id), eq(reviewItems.userId, userId))).returning({ id: reviewItems.id });
  return rows.length > 0;
}
