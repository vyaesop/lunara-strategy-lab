import { randomBytes } from "node:crypto";

const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

/** Short, URL-safe, prefixed ids (e.g. `ses_k3j9...`). Matches the DocumentId schema. */
export function newId(prefix: string, length = 20): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i]! % ALPHABET.length];
  return `${prefix}_${out}`;
}
