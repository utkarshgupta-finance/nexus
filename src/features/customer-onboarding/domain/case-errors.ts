import { defaultMessageForCode } from "@/platform/errors"

/**
 * Typed Customer Onboarding Case error model, mirroring
 * src/features/commercial/domain/errors.ts's own shape exactly: every new
 * RPC in supabase/migrations/20260913040000_customer_lifecycle_onboarding_foundation.sql
 * raises named tokens via `raise exception 'TOKEN: message', ...`
 * (SQLSTATE P0001), and this is the one place that understands that
 * shape. Everything above data/case.data.ts sees only CaseOperationError.
 */

type CaseErrorKind =
  | "onboarding_case_not_found"
  | "onboarding_case_not_submittable"
  | "onboarding_case_not_sendbackable"
  | "onboarding_case_not_approvable"
  | "onboarding_case_not_cancellable"
  | "onboarding_case_cancel_not_owner"
  | "onboarding_case_self_approval_not_allowed"
  | "onboarding_no_draft_revision"
  | "onboarding_no_submitted_revision"
  | "onboarding_send_back_reason_required"
  | "workflow_team_required"
  | "workflow_decision_no_match"
  | "onboarding_draft_stale"
  | "invalid_input"
  | "conflict"
  | "not_found"
  | "unexpected_result_shape"
  | "unknown"

type CaseError = {
  kind: CaseErrorKind
  message: string
  sqlState: string | null
  cause: string
}

const NAMED_TOKEN_KINDS: Record<string, CaseErrorKind> = {
  ONBOARDING_CASE_NOT_FOUND: "onboarding_case_not_found",
  ONBOARDING_CASE_NOT_SUBMITTABLE: "onboarding_case_not_submittable",
  ONBOARDING_CASE_NOT_SENDBACKABLE: "onboarding_case_not_sendbackable",
  ONBOARDING_CASE_NOT_APPROVABLE: "onboarding_case_not_approvable",
  ONBOARDING_NO_DRAFT_REVISION: "onboarding_no_draft_revision",
  ONBOARDING_NO_SUBMITTED_REVISION: "onboarding_no_submitted_revision",
  ONBOARDING_SEND_BACK_REASON_REQUIRED: "onboarding_send_back_reason_required",
  ONBOARDING_CASE_NOT_CANCELLABLE: "onboarding_case_not_cancellable",
  ONBOARDING_CASE_CANCEL_NOT_OWNER: "onboarding_case_cancel_not_owner",
  SELF_APPROVAL_NOT_ALLOWED: "onboarding_case_self_approval_not_allowed",
  WORKFLOW_TEAM_REQUIRED: "workflow_team_required",
  WORKFLOW_DECISION_NO_MATCH: "workflow_decision_no_match",
  ONBOARDING_DRAFT_STALE: "onboarding_draft_stale",
}

const SQLSTATE_KINDS: Record<string, CaseErrorKind> = {
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

function parseCaseError(error: PostgrestLikeError): CaseError {
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

  // Platform Scale Closure, Phase T: an unrecognized error never carries a
  // curated message, so rawMessage here is raw Postgres/RPC detail (a
  // SQLSTATE, a function name, sometimes a stack fragment). Never surface
  // it to a user; `cause` keeps it for logs/support.
  return { kind: "unknown", message: defaultMessageForCode("UNEXPECTED"), sqlState, cause: rawMessage }
}

class CaseOperationError extends Error {
  readonly caseError: CaseError

  constructor(caseError: CaseError) {
    super(caseError.message)
    this.name = "CaseOperationError"
    this.caseError = caseError
  }
}

export { parseCaseError, CaseOperationError }
export type { CaseErrorKind, CaseError, PostgrestLikeError }
