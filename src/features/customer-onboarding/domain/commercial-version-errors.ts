import { defaultMessageForCode } from "@/platform/errors"

/**
 * Typed Commercial Configuration Version error model, mirroring
 * ./case-errors.ts's own shape exactly: every RPC in
 * supabase/migrations/20260913070000_commercial_configuration_version_lifecycle.sql
 * raises named tokens via `raise exception 'TOKEN: message', ...`
 * (SQLSTATE P0001), and this is the one place that understands that
 * shape.
 */

type CommercialVersionErrorKind =
  | "commercial_version_not_found"
  | "commercial_version_configuration_not_found"
  | "commercial_version_invalid_category"
  | "commercial_version_not_submittable"
  | "commercial_version_not_approvable"
  | "commercial_version_not_rejectable"
  | "commercial_version_not_cancellable"
  | "commercial_version_cancel_not_owner"
  | "commercial_version_self_approval_not_allowed"
  | "commercial_version_no_draft_revision"
  | "commercial_version_reject_reason_required"
  | "commercial_version_already_open"
  | "workflow_team_required"
  | "workflow_decision_no_match"
  | "invalid_input"
  | "conflict"
  | "not_found"
  | "unexpected_result_shape"
  | "unknown"

type CommercialVersionError = {
  kind: CommercialVersionErrorKind
  message: string
  sqlState: string | null
  cause: string
}

const NAMED_TOKEN_KINDS: Record<string, CommercialVersionErrorKind> = {
  COMMERCIAL_VERSION_NOT_FOUND: "commercial_version_not_found",
  COMMERCIAL_VERSION_CONFIGURATION_NOT_FOUND: "commercial_version_configuration_not_found",
  COMMERCIAL_VERSION_INVALID_CATEGORY: "commercial_version_invalid_category",
  COMMERCIAL_VERSION_NOT_SUBMITTABLE: "commercial_version_not_submittable",
  COMMERCIAL_VERSION_NOT_APPROVABLE: "commercial_version_not_approvable",
  COMMERCIAL_VERSION_NOT_REJECTABLE: "commercial_version_not_rejectable",
  COMMERCIAL_VERSION_NO_DRAFT_REVISION: "commercial_version_no_draft_revision",
  COMMERCIAL_VERSION_REJECT_REASON_REQUIRED: "commercial_version_reject_reason_required",
  COMMERCIAL_VERSION_NOT_CANCELLABLE: "commercial_version_not_cancellable",
  COMMERCIAL_VERSION_CANCEL_NOT_OWNER: "commercial_version_cancel_not_owner",
  SELF_APPROVAL_NOT_ALLOWED: "commercial_version_self_approval_not_allowed",
  WORKFLOW_TEAM_REQUIRED: "workflow_team_required",
  WORKFLOW_DECISION_NO_MATCH: "workflow_decision_no_match",
}

const SQLSTATE_KINDS: Record<string, CommercialVersionErrorKind> = {
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

function parseCommercialVersionError(error: PostgrestLikeError): CommercialVersionError {
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

  // A real bug found via live retest: this specific 23505 (one open version
  // per configuration, uq_commercial_configuration_versions_one_open_per_config)
  // used to fall through to the generic "conflict" kind below, which shows
  // the raw Postgres constraint text verbatim. Caught here first so the page
  // that creates a version can redirect straight to the already-open one
  // instead of surfacing a database error.
  if (sqlState === "23505" && /uq_commercial_configuration_versions_one_open_per_config/.test(rawMessage)) {
    return {
      kind: "commercial_version_already_open",
      message: "There is already an open Commercial Version for this configuration. Continue that one instead of starting a new change.",
      sqlState,
      cause: rawMessage,
    }
  }

  if (sqlState && SQLSTATE_KINDS[sqlState]) {
    return { kind: SQLSTATE_KINDS[sqlState], message: rawMessage, sqlState, cause: rawMessage }
  }

  // Platform Scale Closure, Phase T: never surface raw Postgres/RPC detail
  // to a user; `cause` keeps it for logs/support.
  return { kind: "unknown", message: defaultMessageForCode("UNEXPECTED"), sqlState, cause: rawMessage }
}

class CommercialVersionOperationError extends Error {
  readonly commercialVersionError: CommercialVersionError

  constructor(commercialVersionError: CommercialVersionError) {
    super(commercialVersionError.message)
    this.name = "CommercialVersionOperationError"
    this.commercialVersionError = commercialVersionError
  }
}

export { parseCommercialVersionError, CommercialVersionOperationError }
export type { CommercialVersionErrorKind, CommercialVersionError, PostgrestLikeError }
