import { z } from "zod";
import { DocumentId, IsoTimestamp, MediumText, PersistedMeta, ShortText, UnitInterval } from "./common";
import { TrainingMode } from "./exercise";
import { SkillId } from "./skills";

/**
 * Reading companion, knowledge graph and spaced repetition. All content here
 * is user-authored or user-imported and private to the user.
 */

export const DocumentKind = z.enum(["note", "text", "markdown", "pdf", "excerpt", "link"]);
export type DocumentKind = z.infer<typeof DocumentKind>;

export const READING_DOC_SCHEMA_VERSION = 1;

/** Metadata only; the extracted text is served separately and paged. */
export const ReadingDocument = PersistedMeta.extend({
  id: DocumentId,
  uid: z.string().min(1).max(128),
  projectId: DocumentId.nullable().default(null),
  kind: DocumentKind,
  title: ShortText,
  author: z.string().max(200).default(""),
  sourceUrl: z.string().max(1000).nullable().default(null),
  /** Character count of the stored text; pages for PDFs. */
  length: z.number().int().min(0),
  pageCount: z.number().int().min(0).nullable().default(null),
  /** 0..1 reading progress as set by the user. */
  progress: UnitInterval.default(0),
  tags: z.array(z.string().max(40)).max(12).default([]),
  /** Whether the user allowed AI features on this document. */
  aiAllowed: z.boolean().default(true),
});
export type ReadingDocument = z.infer<typeof ReadingDocument>;

export const ReadingProject = PersistedMeta.extend({
  id: DocumentId,
  uid: z.string().min(1).max(128),
  title: ShortText,
  description: z.string().max(1000).default(""),
  goal: z.string().max(500).default(""),
});
export type ReadingProject = z.infer<typeof ReadingProject>;

export const NoteKind = z.enum(["note", "excerpt", "reflection", "question"]);

export const ReadingNote = PersistedMeta.extend({
  id: DocumentId,
  uid: z.string().min(1).max(128),
  documentId: DocumentId.nullable().default(null),
  projectId: DocumentId.nullable().default(null),
  kind: NoteKind,
  content: z.string().min(1).max(20_000),
  /** Page number or location string for excerpts. */
  locator: z.string().max(120).nullable().default(null),
  /** Character offsets into the document text, when the note was made from a selection. */
  range: z.object({ start: z.number().int().min(0), end: z.number().int().min(0) }).nullable().default(null),
  conceptIds: z.array(DocumentId).max(20).default([]),
  /** How the text got here: typed, dictated (transcribed in-browser), captured (OCR). */
  origin: z.enum(["typed", "dictated", "captured", "imported"]).default("typed"),
});
export type ReadingNote = z.infer<typeof ReadingNote>;

// ── Knowledge graph ─────────────────────────────────────────────────────────

export const ConceptKind = z.enum(["concept", "technique", "principle", "person", "strategy", "framework", "mistake_pattern"]);

export const KnowledgeConcept = PersistedMeta.extend({
  id: DocumentId,
  uid: z.string().min(1).max(128),
  /** Canonical, unique per user; used for deduplication. */
  slug: z.string().regex(/^[a-z0-9-]+$/).max(80),
  name: ShortText,
  kind: ConceptKind,
  summary: z.string().max(2000).default(""),
  /** Where this concept came from. */
  provenance: z.object({
    origin: z.enum(["user", "ai_suggested", "curriculum"]),
    documentId: DocumentId.nullable().default(null),
    sessionId: DocumentId.nullable().default(null),
    /** AI suggestions stay unconfirmed until the user accepts them. */
    confirmed: z.boolean().default(true),
  }),
  aliases: z.array(z.string().max(80)).max(10).default([]),
});
export type KnowledgeConcept = z.infer<typeof KnowledgeConcept>;

export const RelationKind = z.enum(["supports", "contradicts", "explains", "applies_to", "derived_from", "similar_to", "depends_on"]);
export type RelationKind = z.infer<typeof RelationKind>;

export const KnowledgeRelation = PersistedMeta.extend({
  id: DocumentId,
  uid: z.string().min(1).max(128),
  fromId: DocumentId,
  toId: DocumentId,
  kind: RelationKind,
  note: z.string().max(500).default(""),
  provenance: z.object({ origin: z.enum(["user", "ai_suggested"]), confirmed: z.boolean().default(true) }),
});
export type KnowledgeRelation = z.infer<typeof KnowledgeRelation>;

// ── Spaced repetition ───────────────────────────────────────────────────────

export const ReviewItemKind = z.enum(["concept", "technique", "principle", "mistake_pattern", "framework", "vocabulary", "lesson"]);

/** FSRS card state persisted verbatim so the scheduler is replaceable. */
export const FsrsCard = z.object({
  due: IsoTimestamp,
  stability: z.number(),
  difficulty: z.number(),
  elapsed_days: z.number(),
  scheduled_days: z.number(),
  learning_steps: z.number().int().default(0),
  reps: z.number().int(),
  lapses: z.number().int(),
  state: z.number().int(),
  last_review: IsoTimestamp.nullable().default(null),
});
export type FsrsCard = z.infer<typeof FsrsCard>;

export const ReviewItem = PersistedMeta.extend({
  id: DocumentId,
  uid: z.string().min(1).max(128),
  kind: ReviewItemKind,
  /** The prompt shown at review time. */
  prompt: MediumText,
  /** What the user should be able to recall or explain. */
  answer: z.string().max(4000),
  /** Learning objective this item serves. */
  objective: z.string().max(300).default(""),
  source: z.object({
    type: z.enum(["document", "session", "investigation", "simulation", "concept", "manual"]),
    refId: DocumentId.nullable().default(null),
    label: z.string().max(200).default(""),
  }),
  conceptIds: z.array(DocumentId).max(10).default([]),
  skill: SkillId.nullable().default(null),
  card: FsrsCard,
  /** Bounded history for trend display. */
  history: z.array(z.object({ at: IsoTimestamp, rating: z.number().int().min(1).max(4), explanation: z.string().max(2000).nullable() })).max(30).default([]),
  suspended: z.boolean().default(false),
});
export type ReviewItem = z.infer<typeof ReviewItem>;

export const ReviewRating = z.enum(["again", "hard", "good", "easy"]);
export type ReviewRating = z.infer<typeof ReviewRating>;

/** AI-generated question set from a document excerpt; validated before it becomes review items. */
export const GeneratedQuestions = z.object({
  comprehension: z.array(z.object({ prompt: MediumText, answer: z.string().max(2000) })).min(1).max(6),
  application: z.array(z.object({ prompt: MediumText, guidance: z.string().max(2000), mode: TrainingMode })).max(3).default([]),
  concepts: z.array(z.object({ name: ShortText, kind: ConceptKind, summary: z.string().max(600) })).max(6).default([]),
});
export type GeneratedQuestions = z.infer<typeof GeneratedQuestions>;
