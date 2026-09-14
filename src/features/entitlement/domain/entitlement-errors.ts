import { defaultMessageForCode } from "@/platform/errors"

/**
 * Typed Entitlement Ledger error model, mirroring
 * src/features/go-live/domain/go-live-errors.ts's own shape exactly:
 * every RPC in
 * supabase/migrations/20260919010000_entitlement_ledger_foundation.sql
 * raises named tokens via `raise exception 'TOKEN: message', ...`.
 */

type EntitlementErrorKind =
  | "entitlement_source_not_found"
  | "entitlement_source_not_active"
  | "monthly_usage_not_found"
  | "monthly_usage_not_current"
  | "usage_before_go_live"
  | "settlement_invalid_ledger_entry_type"
  | "settlement_ledger_entry_not_found"
  | "invalid_input"
  | "conflict"
  | "not_found"
  | "unexpected_result_shape"
  | "unknown"

type EntitlementError = {
  kind: EntitlementErrorKind
  message: string
  sqlState: string | null
  cause: string
}

const NAMED_TOKEN_KINDS: Record<string, EntitlementErrorKind> = {
  ENTITLEMENT_SOURCE_NOT_FOUND: "entitlement_source_not_found",
  ENTITLEMENT_SOURCE_NOT_ACTIVE: "entitlement_source_not_active",
  MONTHLY_USAGE_NOT_FOUND: "monthly_usage_not_found",
  MONTHLY_USAGE_NOT_CURRENT: "monthly_usage_not_current",
  USAGE_BEFORE_GO_LIVE: "usage_before_go_live",
  SETTLEMENT_INVALID_LEDGER_ENTRY_TYPE: "settlement_invalid_ledger_entry_type",
  SETTLEMENT_LEDGER_ENTRY_NOT_FOUND: "settlement_ledger_entry_not_found",
}

const SQLSTATE_KINDS: Record<string, EntitlementErrorKind> = {
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

function parseEntitlementError(error: PostgrestLikeError): EntitlementError {
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

  return { kind: "unknown", message: defaultMessageForCode("UNEXPECTED"), sqlState, cause: rawMessage }
}

class EntitlementOperationError extends Error {
  readonly entitlementError: EntitlementError

  constructor(entitlementError: EntitlementError) {
    super(entitlementError.message)
    this.name = "EntitlementOperationError"
    this.entitlementError = entitlementError
  }
}

export { parseEntitlementError, EntitlementOperationError }
export type { EntitlementErrorKind, EntitlementError, PostgrestLikeError }
