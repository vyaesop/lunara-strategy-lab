import type { Context } from "hono";
import type { z } from "zod";
import { invalid } from "./errors";

/** Parse and validate a JSON body; 400 with issue details on failure. */
export async function parseBody<S extends z.ZodType>(c: Context, schema: S): Promise<z.infer<S>> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    throw invalid("Body must be valid JSON");
  }
  const r = schema.safeParse(raw);
  if (!r.success) {
    throw invalid(
      "Request validation failed",
      r.error.issues.slice(0, 10).map((i) => ({ path: i.path.join("."), message: i.message })),
    );
  }
  return r.data;
}
