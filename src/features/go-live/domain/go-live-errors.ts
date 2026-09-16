import { defaultMessageForCode } from "@/platform/errors"

/**
 * Typed Go Live error model, mirroring
 * src/features/customer-onboarding/domain/case-errors.ts's own shape
 * exactly: every RPC in
 * supabase/migrations/20260918010000_go_live_domain.sql raises named
 * tokens via `raise exception 'TOKEN: message', ...` (SQLSTATE P0001),
 * and this is the one place that understands that shape.
 */

type GoLiveErrorKind =
  | "go_live_request_not_found"
  | "go_live_commercial_version_not_found"
  | "go_live_commercial_version_not_approved"
  | "go_live_request_not_editable"
  | "go_live_request_not_submittable"
  | "go_live_request_not_sendbackable"
  | "go_live_request_not_approvable"
  | "go_live_request_not_cancellable"
  | "go_live_request_cancel_not_owner"
  | "go_live_send_back_reason_required"
  | "go_live_confirmation_required"
  | "go_live_self_approval_not_allowed"
  | "workflow_team_required"
  | "workflow_decision_no_match"
  | "workflow_node_already_advanced"
  | "go_live_draft_stale"
  | "invalid_input"
  | "conflict"
  | "not_found"
  | "unexpected_result_shape"
  | "unknown"

type GoLiveError = {
  kind: GoLiveErrorKind
  message: string
  sqlState: string | null
  cause: string
}

const NAMED_TOKEN_KINDS: Record<string, GoLiveErrorKind> = {
  GO_LIVE_REQUEST_NOT_FOUND: "go_live_request_not_found",
  GO_LIVE_COMMERCIAL_VERSION_NOT_FOUND: "go_live_commercial_version_not_found",
  GO_LIVE_COMMERCIAL_VERSION_NOT_APPROVED: "go_live_commercial_version_not_approved",
  GO_LIVE_REQUEST_NOT_EDITABLE: "go_live_request_not_editable",
  GO_LIVE_REQUEST_NOT_SUBMITTABLE: "go_live_request_not_submittable",
  GO_LIVE_REQUEST_NOT_SENDBACKABLE: "go_live_request_not_sendbackable",
  GO_LIVE_REQUEST_NOT_APPROVABLE: "go_live_request_not_approvable",
  GO_LIVE_REQUEST_NOT_CANCELLABLE: "go_live_request_not_cancellable",
  GO_LIVE_REQUEST_CANCEL_NOT_OWNER: "go_live_request_cancel_not_owner",
  GO_LIVE_SEND_BACK_REASON_REQUIRED: "go_live_send_back_reason_required",
  GO_LIVE_CONFIRMATION_REQUIRED: "go_live_confirmation_required",
  SELF_APPROVAL_NOT_ALLOWED: "go_live_self_approval_not_allowed",
  WORKFLOW_TEAM_REQUIRED: "workflow_team_required",
  WORKFLOW_DECISION_NO_MATCH: "workflow_decision_no_match",
  WORKFLOW_NODE_ALREADY_ADVANCED: "workflow_node_already_advanced",
  GO_LIVE_DRAFT_STALE: "go_live_draft_stale",
}

const SQLSTATE_KINDS: Record<string, GoLiveErrorKind> = {
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

function parseGoLiveError(error: PostgrestLikeError): GoLiveError {
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

class GoLiveOperationError extends Error {
  readonly goLiveError: GoLiveError

  constructor(goLiveError: GoLiveError) {
    super(goLiveError.message)
    this.name = "GoLiveOperationError"
    this.goLiveError = goLiveError
  }
}

export { parseGoLiveError, GoLiveOperationError }
export type { GoLiveErrorKind, GoLiveError, PostgrestLikeError }
