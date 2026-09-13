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

type CustomerChangeRequestStatus = "draft" | "submitted" | "sent_back" | "resubmitted" | "approved" | "rejected"

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
  customerId: string
  status: CustomerChangeRequestStatus
  reason: string | null
  effectiveDate: string | null
  baseCustomerRowVersion: number
  proposedValues: Record<string, unknown>
  requirements: CustomerChangeRequirement[]
  sentBack: { reason: string; sentBackBy: string | null; sentBackAt: string } | null
  decidedBy: string | null
  decidedAt: string | null
  decisionReason: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
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

export type { CustomerChangeRequestStatus, CustomerChangeRequirement, CustomerChangeRequest, CustomerFieldHistoryEntry }
