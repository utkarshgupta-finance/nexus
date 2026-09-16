import type { CustomerOnboardingCaseRow, SubmissionRevisionRow } from "../data/case-row-types"
import type { CustomerOnboardingCase, CustomerOnboardingRevision } from "./types"

/**
 * Pure row -> domain mappers for the persisted onboarding case (the
 * inverse of the RPCs in
 * supabase/migrations/20260913040000_customer_lifecycle_onboarding_foundation.sql).
 * A submitted revision's real field data lives inside
 * `effective_data.values` (the platform-wide submission_revisions
 * contract, see submit_customer_onboarding_case's own migration comment
 * for why "values"/"applicability" wraps it); this is the one place that
 * unwraps it back into the flat `Record<string, unknown>` shape
 * ./case.ts's pure functions and the onboarding UI already expect, so
 * nothing above this module needs to know the wrapper exists.
 */

function toRevision(row: SubmissionRevisionRow): CustomerOnboardingRevision {
  return {
    revisionNumber: row.revision_number,
    status: row.status,
    data: row.status === "submitted" && row.effective_data ? row.effective_data.values : row.raw_data,
    rowVersion: row.row_version,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
    submittedBy: row.submitted_by,
    submittedAt: row.submitted_at,
  }
}

/** `revisions` must be ordered oldest-first (as data/case.data.ts's listRevisionsForRequest already returns them); the last element is the current revision regardless of case status. */
function toCustomerOnboardingCase(row: CustomerOnboardingCaseRow, revisions: SubmissionRevisionRow[]): CustomerOnboardingCase {
  const latest = revisions[revisions.length - 1]
  return {
    requestId: row.request_id,
    caseNumber: row.case_number,
    status: row.status,
    currentStageKey: row.current_stage_key,
    currentRevision: toRevision(latest),
    sentBack:
      row.sent_back_reason && row.sent_back_at
        ? { reason: row.sent_back_reason, sentBackBy: row.sent_back_by, sentBackAt: row.sent_back_at, targetStageKey: row.sent_back_target_stage_key }
        : null,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    cancelledBy: row.cancelled_by,
    cancelledAt: row.cancelled_at,
    cancelledReason: row.cancelled_reason,
    customerId: row.customer_id,
    commercialConfigurationId: row.commercial_configuration_id,
    createdAt: row.created_at,
    createdBy: row.created_by,
    updatedAt: row.updated_at,
    workflowVersionId: row.workflow_version_id,
    currentWorkflowNodeKey: row.current_workflow_node_key,
  }
}

/**
 * Groups a flat, multi-request revision read (data/case.data.ts's
 * `listRevisionsForRequests`, one `.in("request_id", ...)` query) back
 * into oldest-first per-request arrays, the same shape every single-request
 * caller already expects. Exists so a list of N cases can resolve their
 * revisions in one query instead of N (the exact N+1 `getLatestRevisionForRequest`
 * loop `toReviewQueueEntries`/`listOnboardingCasesCreatedBy`/
 * `listApprovedCaseTaxIdentity` used to run per row).
 */
function groupRevisionsByRequestId(revisions: SubmissionRevisionRow[]): Map<string, SubmissionRevisionRow[]> {
  const grouped = new Map<string, SubmissionRevisionRow[]>()
  for (const revision of revisions) {
    const existing = grouped.get(revision.request_id)
    if (existing) existing.push(revision)
    else grouped.set(revision.request_id, [revision])
  }
  return grouped
}

export { toRevision, toCustomerOnboardingCase, groupRevisionsByRequestId }
