import { and, eq, or } from "drizzle-orm";
import { KnowledgeConcept, KnowledgeRelation, type RelationKind } from "@lunara/schemas";
import { findDuplicateConcept, slugify, validateRelation } from "@lunara/core";
import type { Db } from "../db/client";
import { knowledgeConcepts, knowledgeRelations, readingNotes, reviewItems } from "../db/schema";
import { ApiHttpError, invalid } from "../errors";
import { newId } from "../ids";

export const MAX_CONCEPTS_PER_USER = 2_000;

export function rowToConcept(r: typeof knowledgeConcepts.$inferSelect): KnowledgeConcept {
  return KnowledgeConcept.parse({
    schemaVersion: r.schemaVersion,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    id: r.id,
    uid: r.userId,
    slug: r.slug,
    name: r.name,
    kind: r.kind,
    summary: r.summary,
    provenance: r.provenance,
    aliases: r.aliases,
  });
}

export function rowToRelation(r: typeof knowledgeRelations.$inferSelect): KnowledgeRelation {
  return KnowledgeRelation.parse({
    schemaVersion: r.schemaVersion,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    id: r.id,
    uid: r.userId,
    fromId: r.fromId,
    toId: r.toId,
    kind: r.kind,
    note: r.note,
    provenance: r.provenance,
  });
}

export async function listConcepts(db: Db, userId: string): Promise<KnowledgeConcept[]> {
  const rows = await db.select().from(knowledgeConcepts).where(eq(knowledgeConcepts.userId, userId)).limit(MAX_CONCEPTS_PER_USER);
  return rows.map(rowToConcept);
}

export async function listRelations(db: Db, userId: string): Promise<KnowledgeRelation[]> {
  const rows = await db.select().from(knowledgeRelations).where(eq(knowledgeRelations.userId, userId)).limit(10_000);
  return rows.map(rowToRelation);
}

/**
 * Create or return the existing concept with the same canonical name.
 * AI-suggested concepts are stored unconfirmed until the user accepts them.
 */
export async function upsertConcept(
  db: Db,
  userId: string,
  input: { name: string; kind: KnowledgeConcept["kind"]; summary?: string; aliases?: string[]; documentId?: string | null; origin?: "user" | "ai_suggested" | "curriculum"; sessionId?: string | null },
): Promise<{ concept: KnowledgeConcept; existing: boolean }> {
  const existing = await listConcepts(db, userId);
  const dup = findDuplicateConcept(existing, input.name);
  if (dup) return { concept: existing.find((c) => c.id === dup)!, existing: true };
  if (existing.length >= MAX_CONCEPTS_PER_USER) throw invalid(`At most ${MAX_CONCEPTS_PER_USER} concepts`);
  const origin = input.origin ?? "user";
  const [row] = await db
    .insert(knowledgeConcepts)
    .values({
      id: newId("cpt"),
      userId,
      slug: slugify(input.name),
      name: input.name.trim(),
      kind: input.kind,
      summary: input.summary ?? "",
      provenance: { origin, documentId: input.documentId ?? null, sessionId: input.sessionId ?? null, confirmed: origin !== "ai_suggested" },
      aliases: input.aliases ?? [],
    })
    .returning();
  return { concept: rowToConcept(row!), existing: false };
}

export async function updateConcept(db: Db, userId: string, id: string, patch: { name?: string; kind?: KnowledgeConcept["kind"]; summary?: string; aliases?: string[]; confirmed?: boolean }): Promise<KnowledgeConcept | null> {
  const current = await db.query.knowledgeConcepts.findFirst({ where: and(eq(knowledgeConcepts.id, id), eq(knowledgeConcepts.userId, userId)) });
  if (!current) return null;
  if (patch.name && slugify(patch.name) !== current.slug) {
    const others = (await listConcepts(db, userId)).filter((c) => c.id !== id);
    if (findDuplicateConcept(others, patch.name)) throw new ApiHttpError("conflict", "Another concept already has that name; merge them instead.");
  }
  const provenance = patch.confirmed !== undefined ? { ...(current.provenance as KnowledgeConcept["provenance"]), confirmed: patch.confirmed } : undefined;
  const [row] = await db
    .update(knowledgeConcepts)
    .set({
      ...(patch.name ? { name: patch.name.trim(), slug: slugify(patch.name) } : {}),
      ...(patch.kind ? { kind: patch.kind } : {}),
      ...(patch.summary !== undefined ? { summary: patch.summary } : {}),
      ...(patch.aliases ? { aliases: patch.aliases } : {}),
      ...(provenance ? { provenance } : {}),
      updatedAt: new Date(),
    })
    .where(eq(knowledgeConcepts.id, id))
    .returning();
  return rowToConcept(row!);
}

/** Merge `id` into `intoId`: relations, notes and review items are re-pointed; the alias is kept. */
export async function mergeConcept(db: Db, userId: string, id: string, intoId: string): Promise<KnowledgeConcept | null> {
  if (id === intoId) throw invalid("Choose a different target");
  const [from, into] = await Promise.all([
    db.query.knowledgeConcepts.findFirst({ where: and(eq(knowledgeConcepts.id, id), eq(knowledgeConcepts.userId, userId)) }),
    db.query.knowledgeConcepts.findFirst({ where: and(eq(knowledgeConcepts.id, intoId), eq(knowledgeConcepts.userId, userId)) }),
  ]);
  if (!from || !into) return null;
  await db.update(knowledgeRelations).set({ fromId: intoId }).where(and(eq(knowledgeRelations.userId, userId), eq(knowledgeRelations.fromId, id)));
  await db.update(knowledgeRelations).set({ toId: intoId }).where(and(eq(knowledgeRelations.userId, userId), eq(knowledgeRelations.toId, id)));
  // Drop self-relations produced by the merge.
  await db.delete(knowledgeRelations).where(and(eq(knowledgeRelations.userId, userId), eq(knowledgeRelations.fromId, intoId), eq(knowledgeRelations.toId, intoId)));
  const notes = await db.select().from(readingNotes).where(eq(readingNotes.userId, userId));
  for (const n of notes) {
    const ids = n.conceptIds as string[];
    if (ids.includes(id)) await db.update(readingNotes).set({ conceptIds: [...new Set(ids.map((x) => (x === id ? intoId : x)))] }).where(eq(readingNotes.id, n.id));
  }
  const items = await db.select().from(reviewItems).where(eq(reviewItems.userId, userId));
  for (const it of items) {
    const ids = it.conceptIds as string[];
    if (ids.includes(id)) await db.update(reviewItems).set({ conceptIds: [...new Set(ids.map((x) => (x === id ? intoId : x)))] }).where(eq(reviewItems.id, it.id));
  }
  const aliases = [...new Set([...(into.aliases as string[]), from.name, ...(from.aliases as string[])])].slice(0, 10);
  const [row] = await db.update(knowledgeConcepts).set({ aliases, updatedAt: new Date() }).where(eq(knowledgeConcepts.id, intoId)).returning();
  await db.delete(knowledgeConcepts).where(eq(knowledgeConcepts.id, id));
  return rowToConcept(row!);
}

export async function deleteConcept(db: Db, userId: string, id: string): Promise<boolean> {
  const rows = await db.delete(knowledgeConcepts).where(and(eq(knowledgeConcepts.id, id), eq(knowledgeConcepts.userId, userId))).returning({ id: knowledgeConcepts.id });
  return rows.length > 0;
}

export async function createRelation(db: Db, userId: string, input: { fromId: string; toId: string; kind: RelationKind; note?: string; origin?: "user" | "ai_suggested" }): Promise<KnowledgeRelation> {
  const concepts = await db
    .select({ id: knowledgeConcepts.id })
    .from(knowledgeConcepts)
    .where(and(eq(knowledgeConcepts.userId, userId), or(eq(knowledgeConcepts.id, input.fromId), eq(knowledgeConcepts.id, input.toId))));
  if (concepts.length !== 2 && input.fromId !== input.toId) throw new ApiHttpError("not_found", "Concept not found");
  const existing = await listRelations(db, userId);
  const problem = validateRelation(existing, input.fromId, input.toId, input.kind);
  if (problem) throw invalid(problem);
  const origin = input.origin ?? "user";
  const [row] = await db
    .insert(knowledgeRelations)
    .values({ id: newId("rel"), userId, fromId: input.fromId, toId: input.toId, kind: input.kind, note: input.note ?? "", provenance: { origin, confirmed: origin === "user" } })
    .returning();
  return rowToRelation(row!);
}

export async function deleteRelation(db: Db, userId: string, id: string): Promise<boolean> {
  const rows = await db.delete(knowledgeRelations).where(and(eq(knowledgeRelations.id, id), eq(knowledgeRelations.userId, userId))).returning({ id: knowledgeRelations.id });
  return rows.length > 0;
}
