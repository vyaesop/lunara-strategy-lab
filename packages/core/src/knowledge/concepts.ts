import type { KnowledgeConcept, KnowledgeRelation } from "@lunara/schemas";

/** Canonical slug for deduplication: lowercase, ascii, hyphenated. */
export function slugify(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "concept";
}

/** Find an existing concept matching a name by slug or alias. */
export function findDuplicateConcept(concepts: Pick<KnowledgeConcept, "id" | "slug" | "aliases">[], name: string): string | null {
  const slug = slugify(name);
  for (const c of concepts) {
    if (c.slug === slug) return c.id;
    if (c.aliases.some((a) => slugify(a) === slug)) return c.id;
  }
  return null;
}

/** Relations that would be redundant or invalid. */
export function validateRelation(relations: Pick<KnowledgeRelation, "fromId" | "toId" | "kind">[], fromId: string, toId: string, kind: KnowledgeRelation["kind"]): string | null {
  if (fromId === toId) return "A concept cannot relate to itself.";
  if (relations.some((r) => r.fromId === fromId && r.toId === toId && r.kind === kind)) return "That relation already exists.";
  if (kind === "similar_to" && relations.some((r) => r.fromId === toId && r.toId === fromId && r.kind === "similar_to")) return "That similarity is already recorded in the other direction.";
  return null;
}

/** Simple degree-based ranking for the graph view and recommendations. */
export function conceptDegrees(concepts: Pick<KnowledgeConcept, "id">[], relations: Pick<KnowledgeRelation, "fromId" | "toId">[]): Map<string, number> {
  const deg = new Map(concepts.map((c) => [c.id, 0]));
  for (const r of relations) {
    deg.set(r.fromId, (deg.get(r.fromId) ?? 0) + 1);
    deg.set(r.toId, (deg.get(r.toId) ?? 0) + 1);
  }
  return deg;
}
