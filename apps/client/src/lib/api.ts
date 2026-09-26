import type { z } from "zod";
import type { ApiErrorCode } from "@lunara/schemas";
import { apiBaseUrl, getTokenSync } from "./platform";

export class ApiError extends Error {
  constructor(
    readonly code: ApiErrorCode | "network",
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface RequestOptions<S extends z.ZodType | undefined> {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  schema?: S;
  signal?: AbortSignal;
}

type Parsed<S> = S extends z.ZodType ? z.infer<S> : unknown;

/** Typed fetch against the API with bearer auth, cookies and response validation. */
export async function api<S extends z.ZodType | undefined = undefined>(
  path: string,
  options: RequestOptions<S> = {},
): Promise<Parsed<S>> {
  const headers: Record<string, string> = {};
  const token = getTokenSync();
  if (token) headers.authorization = `Bearer ${token}`;
  if (options.body !== undefined) headers["content-type"] = "application/json";

  let res: Response;
  try {
    res = await fetch(`${apiBaseUrl}${path}`, {
      method: options.method ?? "GET",
      headers,
      credentials: "include",
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
      ...(options.signal ? { signal: options.signal } : {}),
    });
  } catch (err) {
    throw new ApiError("network", "Could not reach the server", 0, err);
  }

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  if (!res.ok) {
    const e = (data as { error?: { code?: ApiErrorCode; message?: string; details?: unknown } } | null)?.error;
    throw new ApiError(e?.code ?? "internal", e?.message ?? `Request failed (${res.status})`, res.status, e?.details);
  }
  if (options.schema) {
    const r = options.schema.safeParse(data);
    if (!r.success) throw new ApiError("internal", "Unexpected response shape", res.status, r.error.issues);
    return r.data as Parsed<S>;
  }
  return data as Parsed<S>;
}
