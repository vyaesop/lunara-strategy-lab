export type AIErrorCode =
  | "provider_unavailable"
  | "provider_error"
  | "rate_limited"
  | "timeout"
  | "invalid_response"
  | "structured_output_invalid"
  | "not_configured"
  | "unsupported_capability"
  | "user_content_not_allowed";

export class AIError extends Error {
  readonly code: AIErrorCode;
  readonly status: number | undefined;
  readonly retryable: boolean;

  constructor(
    code: AIErrorCode,
    message: string,
    options?: { status?: number; retryable?: boolean; cause?: unknown },
  ) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "AIError";
    this.code = code;
    this.status = options?.status;
    this.retryable = options?.retryable ?? false;
  }
}

export function isAIError(e: unknown): e is AIError {
  return e instanceof AIError;
}

/** Map an HTTP status to an AIError. Response bodies are never included. */
export function errorFromStatus(status: number, providerName: string): AIError {
  if (status === 429) {
    return new AIError("rate_limited", `${providerName} rate limit reached`, { status, retryable: true });
  }
  if (status === 408 || status === 504) {
    return new AIError("timeout", `${providerName} timed out`, { status, retryable: true });
  }
  if (status >= 500) {
    return new AIError("provider_unavailable", `${providerName} unavailable (${status})`, { status, retryable: true });
  }
  if (status === 401 || status === 403) {
    return new AIError("not_configured", `${providerName} rejected credentials`, { status });
  }
  return new AIError("provider_error", `${providerName} error (${status})`, { status });
}
