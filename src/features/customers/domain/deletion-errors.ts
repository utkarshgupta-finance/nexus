import { defaultMessageForCode } from "@/platform/errors"

/**
 * Typed Permanent Customer Deletion error model, mirroring
 * src/features/customer-change/domain/change-errors.ts's own shape
 * exactly: `delete_customer_permanently`
 * (supabase/migrations/20260913080000_permanent_customer_deletion.sql,
 * fixed by 20260913081000_fix_delete_customer_permanently_eligibility.sql)
 * raises named tokens via `raise exception 'TOKEN: message', ...`
 * (SQLSTATE P0001), and this is the one place that understands that
 * shape.
 */

type DeletionErrorKind =
  | "customer_delete_not_found"
  | "customer_delete_reason_required"
  | "customer_delete_has_commercial_history"
  | "customer_delete_has_approved_change_history"
  | "invalid_input"
  | "conflict"
  | "not_found"
  | "unexpected_result_shape"
  | "unknown"

type DeletionError = {
  kind: DeletionErrorKind
  message: string
  sqlState: string | null
  cause: string
}

const NAMED_TOKEN_KINDS: Record<string, DeletionErrorKind> = {
  CUSTOMER_DELETE_NOT_FOUND: "customer_delete_not_found",
  CUSTOMER_DELETE_REASON_REQUIRED: "customer_delete_reason_required",
  CUSTOMER_DELETE_HAS_COMMERCIAL_HISTORY: "customer_delete_has_commercial_history",
  CUSTOMER_DELETE_HAS_APPROVED_CHANGE_HISTORY: "customer_delete_has_approved_change_history",
}

const SQLSTATE_KINDS: Record<string, DeletionErrorKind> = {
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

function parseDeletionError(error: PostgrestLikeError): DeletionError {
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

class DeletionOperationError extends Error {
  readonly deletionError: DeletionError

  constructor(deletionError: DeletionError) {
    super(deletionError.message)
    this.name = "DeletionOperationError"
    this.deletionError = deletionError
  }
}

export { parseDeletionError, DeletionOperationError }
export type { DeletionErrorKind, DeletionError, PostgrestLikeError }
