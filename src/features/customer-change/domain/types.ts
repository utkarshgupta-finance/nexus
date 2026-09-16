/**
 * Customer Change Request domain types (Customer Lifecycle V1, Phase
 * 3-9). Mirrors src/features/customer-onboarding/domain/types.ts's own
 * shape for the case-level lifecycle concept, applied to a Customer
 * Master field change instead of a new-customer onboarding.
 *
 * `currentRevisionData` (a draft's raw_data, or a submitted revision's
 * effective_data.values) is always a SPARSE map: only the fields the
 * requester actually intends to change, keyed by the same names
 * `customers` itself uses (name, brand_name, segment, business_unit,
 * country, industry: see ./governed-fields.ts), never display labels.
 */

type CustomerChangeRequestStatus = "draft" | "submitted" | "sent_back" | "resubmitted" | "approved" | "rejected" | "cancelled"

type CustomerChangeRequirement = {
  kind: "approval" | "evidence"
  roleCode: string | null
  scopeLabel: string | null
  evidenceType: string | null
  reason: string
  matchedRuleKeys: string[]
}

type CustomerChangeRequest = {
  requestId: string
  /** Human-Friendly ID (task Phase L): render with `formatChangeRequestId`, never this raw number alone. */
  requestNumber: number
  customerId: string
  status: CustomerChangeRequestStatus
  reason: string | null
  effectiveDate: string | null
  baseCustomerRowVersion: number
  /** submission_revisions.row_version of the current draft/submitted revision: the optimistic-lock token every Save Draft call must echo back as expectedRowVersion, so a stale save is rejected (CUSTOMER_CHANGE_DRAFT_STALE) instead of silently overwriting a concurrent edit. */
  revisionRowVersion: number
  proposedValues: Record<string, unknown>
  requirements: CustomerChangeRequirement[]
  sentBack: { reason: string; sentBackBy: string | null; sentBackAt: string } | null
  decidedBy: string | null
  decidedAt: string | null
  decisionReason: string | null
  /** Set only once, when a draft is cancelled (task Phase G); a cancelled request is terminal and never re-enters review. */
  cancelledBy: string | null
  cancelledAt: string | null
  cancelledReason: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
  /** Workflow Runtime V1 Sequential Execution: the workflow version this request is bound to (resolved once at creation, never re-resolved) and which Approval node it is currently sitting at. Null current node means no workflow is bound, the graph has no Approval node, or the request is between Send Back and resubmit. */
  workflowVersionId: string | null
  currentWorkflowNodeKey: string | null
}

type CustomerFieldHistoryEntry = {
  id: string
  fieldKey: string
  oldValue: string | null
  newValue: string | null
  effectiveDate: string | null
  changeRequestId: string | null
  requestedBy: string | null
  approvedBy: string | null
  changedAt: string
}

/** One former name/brand match from Customer Search (task Phase B): which customer, which field, and what it used to be called. */
type FormerNameMatch = {
  customerId: string
  fieldKey: string
  oldValue: string
  changedAt: string
}

/** Human-Friendly ID (task Phase L): "CCR-000045". Never renumbered; the underlying `requestId` UUID remains the real identity everywhere. */
function formatChangeRequestId(requestNumber: number): string {
  return `CCR-${String(requestNumber).padStart(6, "0")}`
}

export type { CustomerChangeRequestStatus, CustomerChangeRequirement, CustomerChangeRequest, CustomerFieldHistoryEntry, FormerNameMatch }
export { formatChangeRequestId }
