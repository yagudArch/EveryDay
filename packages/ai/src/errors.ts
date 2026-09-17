/**
 * Typed error surface of @everyday/ai (FND-004).
 *
 * Every failure that crosses the package boundary is an AIServiceError with a stable
 * machine-readable `code` and an HTTP `statusCode` so that BACKEND can map it directly
 * into the shared ErrorResponseSchema without inspecting messages.
 */

export type AIServiceErrorCode =
  /** No configured provider: the AI feature is honestly unavailable (HTTP 503). */
  | 'AI_UNAVAILABLE'
  /** Configured provider, but the user did not grant AI consent (HTTP 403). */
  | 'AI_CONSENT_REQUIRED'
  /** Configured provider that does not expose a capability required by the call (HTTP 503). */
  | 'AI_CAPABILITY_UNSUPPORTED'
  /** Caller supplied data that violates the input contract (HTTP 400). */
  | 'AI_INVALID_INPUT'
  /** Provider output violated the strict ActionPreview contract; nothing was applied (HTTP 502). */
  | 'AI_INVALID_OUTPUT'
  /** Provider request exceeded the request timeout budget (HTTP 504). */
  | 'AI_TIMEOUT'
  /** Provider request was aborted by the caller (HTTP 499, client closed request). */
  | 'AI_ABORTED'
  /** Provider threw a non-typed failure (HTTP 502). */
  | 'AI_PROVIDER_FAILURE'
  /** Provider reported a status that violates AIStatusSchema (HTTP 500). */
  | 'AI_PROVIDER_INVALID';

export interface AIServiceErrorOptions {
  /** Underlying failure, kept for server-side logging only. Never returned to the client. */
  readonly providerCause?: unknown;
  /** Structured, non-sensitive diagnostics (issue paths, method names). Never user content. */
  readonly details?: unknown;
}

export class AIServiceError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly details: unknown;
  readonly providerCause?: unknown;

  constructor(code: string, message: string, statusCode: number, options: AIServiceErrorOptions = {}) {
    super(message);
    this.name = 'AIServiceError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = options.details ?? null;
    this.providerCause = options.providerCause;
  }

  /** Safe, serializable projection (message + code + status), suitable for logging. */
  toJSON(): { code: string; message: string; statusCode: number } {
    return { code: this.code, message: this.message, statusCode: this.statusCode };
  }
}

/** Narrow an unknown thrown value to AIServiceError. */
export function isAIServiceError(value: unknown): value is AIServiceError {
  return value instanceof AIServiceError;
}

/** Build the honest "no provider configured" failure (HTTP 503, code AI_UNAVAILABLE). */
export function unavailableError(operation: string): AIServiceError {
  return new AIServiceError(
    'AI_UNAVAILABLE',
    'AI provider is not configured; this operation is unavailable',
    503,
    { details: { operation } },
  );
}
