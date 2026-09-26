import { z } from "zod";

/** ISO-8601 timestamp. All persisted and transported timestamps are strings. */
export const IsoTimestamp = z.iso.datetime({ offset: true });
export type IsoTimestamp = z.infer<typeof IsoTimestamp>;

/** Firestore-safe document id: no slashes, bounded length. */
export const DocumentId = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/, "ids may contain letters, digits, _ and -");
export type DocumentId = z.infer<typeof DocumentId>;

/** Fields shared by every persisted document. */
export const PersistedMeta = z.object({
  schemaVersion: z.number().int().min(1),
  createdAt: IsoTimestamp,
  updatedAt: IsoTimestamp,
});
export type PersistedMeta = z.infer<typeof PersistedMeta>;

/** 0..1 inclusive. Used for confidence, estimates and rubric scores. */
export const UnitInterval = z.number().min(0).max(1);

export const ShortText = z.string().trim().min(1).max(280);
export const MediumText = z.string().trim().min(1).max(2_000);
export const LongText = z.string().trim().min(1).max(12_000);

export const nowIso = (): IsoTimestamp => new Date().toISOString();
