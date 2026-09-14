import type { NexusErrorCode } from "../../errors"
import type { AuthorizationDenialReason } from "../../permissions"

/**
 * Pure API-layer mapping (Platform Scale Program, Phase B), kept out of
 * `../server.ts` so it stays directly unit-testable: which HTTP status a
 * given `NexusErrorCode` returns, and which code an authorization denial
 * reason maps to. The same `requirePermission` denial reasons the UI
 * already distinguishes (docs/AUTHORIZATION_MODEL.md §12) map onto the
 * shared error taxonomy here, so an API caller gets the same honest
 * distinction a human user does, never a collapsed generic 403.
 */

const CODE_BY_DENIAL_REASON: Record<AuthorizationDenialReason, NexusErrorCode> = {
  unauthenticated: "AUTH_REQUIRED",
  unavailable: "DATABASE_UNAVAILABLE",
  unprovisioned: "AUTH_UNPROVISIONED",
  inactive: "AUTH_INACTIVE",
  missing_permission: "AUTH_PERMISSION_DENIED",
}

function codeForDenialReason(reason: AuthorizationDenialReason): NexusErrorCode {
  return CODE_BY_DENIAL_REASON[reason]
}

function httpStatusForCode(code: NexusErrorCode): number {
  switch (code) {
    case "AUTH_REQUIRED":
      return 401
    case "AUTH_UNPROVISIONED":
    case "AUTH_INACTIVE":
    case "AUTH_PERMISSION_DENIED":
      return 403
    case "RESOURCE_NOT_FOUND":
      return 404
    case "VALIDATION_FAILED":
    case "DOCUMENT_UPLOAD_INVALID":
      return 400
    case "STALE_VERSION":
    case "CONFLICT":
    case "COMMERCIAL_EFFECTIVE_DATE_CONFLICT":
      return 409
    case "DOCUMENT_UPLOAD_FAILED":
      return 502
    case "DATABASE_UNAVAILABLE":
      return 503
    case "UNEXPECTED":
    default:
      return 500
  }
}

export { codeForDenialReason, httpStatusForCode }
