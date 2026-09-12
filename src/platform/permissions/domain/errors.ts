/**
 * Deny-by-default authorization failure, distinguishing every state the
 * task's own auth error states require (task correction §26):
 * unauthenticated, authenticated-but-unprovisioned, inactive, and
 * missing-permission are never collapsed into one generic "denied"
 * message, so a caller can show the honest reason without leaking
 * database/permission internals.
 */
type AuthorizationDenialReason = "unauthenticated" | "unavailable" | "unprovisioned" | "inactive" | "missing_permission"

class AuthorizationError extends Error {
  readonly reason: AuthorizationDenialReason

  constructor(reason: AuthorizationDenialReason, message: string) {
    super(message)
    this.name = "AuthorizationError"
    this.reason = reason
  }
}

export { AuthorizationError }
export type { AuthorizationDenialReason }
