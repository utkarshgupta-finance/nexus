/**
 * Typed Commercial error model.
 *
 * Every Commercial RPC (Migrations 8-10) raises named, stable errors as
 * `raise exception 'TOKEN: human message', ...` (SQLSTATE P0001), or lets
 * a database constraint raise its own SQLSTATE (unique_violation,
 * check_violation, not_null_violation, foreign_key_violation) when no
 * named token wraps it. Supabase's client surfaces both as a
 * PostgrestError-shaped object: { message, code, details, hint }.
 *
 * This module is the one place that understands that shape. Everything
 * above features/commercial/data/ (services, read models, UI) sees only
 * CommercialError, never a raw Postgres error string or SQLSTATE.
 */

/**
 * One stable token per named exception actually raised by the Commercial
 * RPCs, plus a small set of generic constraint-level kinds for
 * violations no RPC wraps in a named token. "unknown" is the honest
 * fallback for anything this parser does not recognize; callers must not
 * assume the kind list below is exhaustive of every possible Postgres
 * failure.
 */
type CommercialErrorKind =
  // Named tokens raised by M9 RPCs
  | "usage_configuration_not_found"
  | "measurement_definition_not_found"
  | "usage_fact_event_conflict"
  | "usage_fact_not_found"
  | "usage_fact_already_corrected"
  | "usage_fact_invalid_origin"
  | "usage_fact_override_incomplete"
  | "earned_result_id_conflict"
  | "earned_result_not_found"
  // Named tokens raised by M10 RPCs
  | "billing_component_not_found"
  | "billing_calculation_id_conflict"
  | "billing_calculation_grain_conflict"
  | "billing_calculation_not_found"
  | "invoice_evidence_identity_conflict"
  | "invoice_evidence_item_target_invalid"
  | "reconciliation_adjustment_not_found"
  | "reconciliation_already_superseded"
  // Generic constraint-level SQLSTATEs, for a violation no RPC names
  | "invalid_input"
  | "conflict"
  | "not_found"
  // Adapter-raised, never database-raised: the RPC responded successfully
  // but with a row shape this adapter's own contract assumptions rule
  // out (see data/rpc.ts#callTableRpc).
  | "unexpected_result_shape"
  // Everything else
  | "unknown"

type CommercialError = {
  kind: CommercialErrorKind
  /** Human-safe summary, derived from the database message but not a verbatim passthrough of internal detail. */
  message: string
  /** The original Postgres SQLSTATE, kept for logging only; UI code should switch on `kind`, not this. */
  sqlState: string | null
  /** The raw database message, kept for logging only. Do not render this directly in UI. */
  cause: string
}

const NAMED_TOKEN_KINDS: Record<string, CommercialErrorKind> = {
  USAGE_CONFIGURATION_NOT_FOUND: "usage_configuration_not_found",
  MEASUREMENT_DEFINITION_NOT_FOUND: "measurement_definition_not_found",
  USAGE_FACT_EVENT_CONFLICT: "usage_fact_event_conflict",
  USAGE_FACT_NOT_FOUND: "usage_fact_not_found",
  USAGE_FACT_ALREADY_CORRECTED: "usage_fact_already_corrected",
  USAGE_FACT_INVALID_ORIGIN: "usage_fact_invalid_origin",
  USAGE_FACT_OVERRIDE_INCOMPLETE: "usage_fact_override_incomplete",
  EARNED_RESULT_ID_CONFLICT: "earned_result_id_conflict",
  EARNED_RESULT_NOT_FOUND: "earned_result_not_found",
  BILLING_COMPONENT_NOT_FOUND: "billing_component_not_found",
  BILLING_CALCULATION_ID_CONFLICT: "billing_calculation_id_conflict",
  BILLING_CALCULATION_GRAIN_CONFLICT: "billing_calculation_grain_conflict",
  BILLING_CALCULATION_NOT_FOUND: "billing_calculation_not_found",
  INVOICE_EVIDENCE_IDENTITY_CONFLICT: "invoice_evidence_identity_conflict",
  INVOICE_EVIDENCE_ITEM_TARGET_INVALID: "invoice_evidence_item_target_invalid",
  RECONCILIATION_ADJUSTMENT_NOT_FOUND: "reconciliation_adjustment_not_found",
  RECONCILIATION_ALREADY_SUPERSEDED: "reconciliation_already_superseded",
}

/** Postgres SQLSTATEs for constraint violations no RPC wraps in a named token. */
const SQLSTATE_KINDS: Record<string, CommercialErrorKind> = {
  "23505": "conflict", // unique_violation
  "23514": "invalid_input", // check_violation
  "23502": "invalid_input", // not_null_violation
  "23503": "invalid_input", // foreign_key_violation
}

/**
 * Shape of the error object Supabase's `.rpc()` call rejects with
 * (PostgrestError). Declared locally, not imported from
 * @supabase/supabase-js, so this module has zero dependency on the
 * Supabase SDK: parseCommercialError is pure and independently testable.
 */
type PostgrestLikeError = {
  message: string
  code?: string | null
  details?: string | null
  hint?: string | null
}

/**
 * Translates a raw Postgres/PostgREST error into a typed CommercialError.
 * Pure function: no I/O, safe to unit test directly.
 */
function parseCommercialError(error: PostgrestLikeError): CommercialError {
  const sqlState = error.code ?? null
  const rawMessage = error.message ?? ""

  // [\s\S]* instead of a dotAll-flagged .*: this project's tsconfig
  // targets ES2017, which predates the 's' regex flag.
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

  return { kind: "unknown", message: rawMessage || "An unexpected error occurred.", sqlState, cause: rawMessage }
}

/** Thrown by the data/service layers so callers can `catch` a single, typed error class. */
class CommercialOperationError extends Error {
  readonly commercialError: CommercialError

  constructor(commercialError: CommercialError) {
    super(commercialError.message)
    this.name = "CommercialOperationError"
    this.commercialError = commercialError
  }
}

export { parseCommercialError, CommercialOperationError }
export type { CommercialErrorKind, CommercialError, PostgrestLikeError }
