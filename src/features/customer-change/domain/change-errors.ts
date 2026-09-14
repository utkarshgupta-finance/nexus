import { defaultMessageForCode } from "@/platform/errors"

/**
 * Typed Customer Change Request error model, mirroring
 * src/features/customer-onboarding/domain/case-errors.ts's own shape
 * exactly: every RPC in
 * supabase/migrations/20260913060000_customer_change_request_foundation.sql
 * raises named tokens via `raise exception 'TOKEN: message', ...`
 * (SQLSTATE P0001), and this is the one place that understands that
 * shape. Everything above data/change-request.data.ts sees only
 * ChangeRequestOperationError.
 */

type ChangeErrorKind =
  | "change_request_not_found"
  | "change_request_customer_not_found"
  | "change_request_not_submittable"
  | "change_request_not_sendbackable"
  | "change_request_not_rejectable"
  | "change_request_not_approvable"
  | "change_request_not_cancellable"
  | "change_request_cancel_not_owner"
  | "change_request_no_draft_revision"
  | "change_request_no_submitted_revision"
  | "change_request_send_back_reason_required"
  | "change_request_reject_reason_required"
  | "change_request_stale_base"
  | "invalid_input"
  | "conflict"
  | "not_found"
  | "unexpected_result_shape"
  | "unknown"

type ChangeError = {
  kind: ChangeErrorKind
  message: string
  sqlState: string | null
  cause: string
}

const NAMED_TOKEN_KINDS: Record<string, ChangeErrorKind> = {
  CUSTOMER_CHANGE_NOT_FOUND: "change_request_not_found",
  CUSTOMER_CHANGE_CUSTOMER_NOT_FOUND: "change_request_customer_not_found",
  CUSTOMER_CHANGE_NOT_SUBMITTABLE: "change_request_not_submittable",
  CUSTOMER_CHANGE_NOT_SENDBACKABLE: "change_request_not_sendbackable",
  CUSTOMER_CHANGE_NOT_REJECTABLE: "change_request_not_rejectable",
  CUSTOMER_CHANGE_NOT_APPROVABLE: "change_request_not_approvable",
  CUSTOMER_CHANGE_NO_DRAFT_REVISION: "change_request_no_draft_revision",
  CUSTOMER_CHANGE_NO_SUBMITTED_REVISION: "change_request_no_submitted_revision",
  CUSTOMER_CHANGE_SEND_BACK_REASON_REQUIRED: "change_request_send_back_reason_required",
  CUSTOMER_CHANGE_REJECT_REASON_REQUIRED: "change_request_reject_reason_required",
  CUSTOMER_CHANGE_STALE_BASE: "change_request_stale_base",
  CUSTOMER_CHANGE_NOT_CANCELLABLE: "change_request_not_cancellable",
  CUSTOMER_CHANGE_CANCEL_NOT_OWNER: "change_request_cancel_not_owner",
}

const SQLSTATE_KINDS: Record<string, ChangeErrorKind> = {
  "23505": "conflict",
  "23514": "invalid_input",
  "23502": "invalid_input",
  "23503": "invalid_input",
}

type PostgrestLikeError = {
  message: string
  code?: string | null
  details?: string | null
  hint?: string | null
}

function parseChangeError(error: PostgrestLikeError): ChangeError {
  const sqlState = error.code ?? null
  const rawMessage = error.message ?? ""

  const tokenMatch = /^([A-Z][A-Z0-9_]*):\s*([\s\S]*)$/.exec(rawMessage)
  if (tokenMatch) {
    const [, token, detail] = tokenMatch
    const kind = NAMED_TOKEN_KINDS[token]
    if (kind) {
      return { kind, message: detail || rawMessage, sqlState, cause: rawMessage }
    }
  }

  if (sqlState && SQLSTATE_KINDS[sqlState]) {
    return { kind: SQLSTATE_KINDS[sqlState], message: rawMessage, sqlState, cause: rawMessage }
  }

  // Platform Scale Closure, Phase T: never surface raw Postgres/RPC detail
  // to a user; `cause` keeps it for logs/support.
  return { kind: "unknown", message: defaultMessageForCode("UNEXPECTED"), sqlState, cause: rawMessage }
}

class ChangeRequestOperationError extends Error {
  readonly changeError: ChangeError

  constructor(changeError: ChangeError) {
    super(changeError.message)
    this.name = "ChangeRequestOperationError"
    this.changeError = changeError
  }
}

export { parseChangeError, ChangeRequestOperationError }
export type { ChangeErrorKind, ChangeError, PostgrestLikeError }
