/**
 * The one restrained, shared error-code vocabulary for Nexus (Platform
 * Scale Program, Phase A). A code here answers "what class of failure is
 * this," never "what exact thing broke": use the code to distinguish
 * failure classes a caller (a human, a support engineer, or a future API
 * consumer) needs to react to differently, and let the human-readable
 * message carry the specific detail.
 *
 * Deliberately small. A new code is added only when an existing one
 * genuinely does not fit, never speculatively for a failure mode nothing
 * has hit yet. Feature-level error parsers (case-errors.ts,
 * commercial/domain/errors.ts, and similar) may keep their own richer,
 * feature-specific token vocabulary for internal classification; this is
 * the smaller, shared vocabulary a cross-feature caller (an API response,
 * a structured log line) can rely on without knowing every feature's own
 * tokens.
 */
type NexusErrorCode =
  | "AUTH_REQUIRED"
  | "AUTH_UNPROVISIONED"
  | "AUTH_INACTIVE"
  | "AUTH_PERMISSION_DENIED"
  | "VALIDATION_FAILED"
  | "RESOURCE_NOT_FOUND"
  | "STALE_VERSION"
  | "CONFLICT"
  | "DOCUMENT_UPLOAD_INVALID"
  | "DOCUMENT_UPLOAD_FAILED"
  | "DATABASE_UNAVAILABLE"
  | "COMMERCIAL_EFFECTIVE_DATE_CONFLICT"
  | "UNEXPECTED"

/**
 * A short, human-readable default per code, used only when a caller has
 * no more specific message of its own. Real callers almost always have a
 * better message (a parsed Postgres error, a validation detail); this is
 * the honest fallback for the rare case that isn't further known.
 */
const DEFAULT_ERROR_MESSAGES: Record<NexusErrorCode, string> = {
  AUTH_REQUIRED: "Sign in to continue.",
  AUTH_UNPROVISIONED: "Your account is authenticated but has not been granted access to Nexus.",
  AUTH_INACTIVE: "Your Nexus account is no longer active.",
  AUTH_PERMISSION_DENIED: "You do not have permission to do this.",
  VALIDATION_FAILED: "Some information is missing or invalid.",
  RESOURCE_NOT_FOUND: "That record could not be found.",
  STALE_VERSION: "Another change was made after you loaded this record. Refresh and try again.",
  CONFLICT: "This action could not be completed because of a conflicting state.",
  DOCUMENT_UPLOAD_INVALID: "This file cannot be uploaded.",
  DOCUMENT_UPLOAD_FAILED: "The document could not be uploaded. Try again.",
  DATABASE_UNAVAILABLE: "Nexus could not reach the database right now.",
  COMMERCIAL_EFFECTIVE_DATE_CONFLICT: "This effective date conflicts with an existing commercial period.",
  UNEXPECTED: "An unexpected error occurred.",
}

function defaultMessageForCode(code: NexusErrorCode): string {
  return DEFAULT_ERROR_MESSAGES[code]
}

export type { NexusErrorCode }
export { defaultMessageForCode }
