import type { NexusErrorCode } from "./codes"
import { defaultMessageForCode } from "./codes"

/**
 * The one shared, typed application error (Platform Scale Program, Phase
 * A). Carries exactly what a caller needs to react safely: a restrained
 * code, a message already safe to show a user, and an optional
 * correlation id a support engineer can use to find the matching log
 * line. It deliberately never carries a raw Postgres error, a stack a
 * user shouldn't see, or any field wide enough to accidentally hold a
 * secret.
 *
 * This does not replace a feature's own richer error parsing
 * (case-errors.ts and similar already turn a raw Postgres message into a
 * specific, feature-scoped token); it is the shared shape a cross-feature
 * boundary (an API route, a structured log call) can rely on regardless
 * of which feature raised the failure.
 */
class ApplicationError extends Error {
  readonly code: NexusErrorCode
  readonly correlationId: string | null

  constructor(code: NexusErrorCode, message?: string, correlationId?: string | null) {
    super(message ?? defaultMessageForCode(code))
    this.name = "ApplicationError"
    this.code = code
    this.correlationId = correlationId ?? null
  }
}

/** The shape an API error response (or any future cross-boundary error surface) returns: never a raw stack, never internal Postgres detail. */
type ApplicationErrorResponse = {
  code: NexusErrorCode
  message: string
  correlationId: string | null
}

function toApplicationErrorResponse(error: ApplicationError): ApplicationErrorResponse {
  return { code: error.code, message: error.message, correlationId: error.correlationId }
}

/** For a caught value of unknown shape (anything not already an ApplicationError), the safe, non-leaking fallback: never the raw error's own message, since that may be a Postgres detail never meant for a user. */
function toUnexpectedErrorResponse(correlationId: string | null): ApplicationErrorResponse {
  return { code: "UNEXPECTED", message: defaultMessageForCode("UNEXPECTED"), correlationId }
}

/**
 * Appends "Reference: NX-..." to a message, for a Server Action's
 * plain-string error contract (unlike the API layer's structured
 * ApplicationErrorResponse, a Server Action returns `{ ok: false, error:
 * string }`, so the correlation id has nowhere else to go). Only meant
 * for an already-safe, already-generic message (an "unknown"-kind
 * failure); a specific, already-actionable business-rule message does
 * not need a support reference cluttering it (Platform Scale Closure,
 * Phase T: "do not clutter normal success/expected-failure paths").
 * `withLoggedOperation` (`platform/observability/server.ts`) is what
 * attaches `correlationId` to the error in the first place; this is a
 * no-op if that never ran (the id is simply absent).
 */
function withCorrelationReference(message: string, error: unknown): string {
  const correlationId = error instanceof Error ? (error as Error & { correlationId?: string }).correlationId : undefined
  return correlationId ? `${message} Reference: ${correlationId}` : message
}

export { ApplicationError, toApplicationErrorResponse, toUnexpectedErrorResponse, withCorrelationReference }
export type { ApplicationErrorResponse }
