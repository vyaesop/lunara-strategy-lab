import type { ApiErrorCode } from "@lunara/schemas";

const STATUS: Record<ApiErrorCode, number> = {
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  invalid_request: 400,
  conflict: 409,
  rate_limited: 429,
  budget_exceeded: 429,
  ai_unavailable: 503,
  internal: 500,
};

export class ApiHttpError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly details: unknown;

  constructor(code: ApiErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "ApiHttpError";
    this.code = code;
    this.status = STATUS[code];
    this.details = details;
  }

  toBody() {
    return { error: { code: this.code, message: this.message, ...(this.details !== undefined ? { details: this.details } : {}) } };
  }
}

export const notFound = (what = "Resource") => new ApiHttpError("not_found", `${what} not found`);
export const invalid = (message: string, details?: unknown) => new ApiHttpError("invalid_request", message, details);
