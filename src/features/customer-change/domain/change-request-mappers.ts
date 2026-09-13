import type { CustomerChangeRequestRow, CustomerChangeRequestRequirementRow, SubmissionRevisionRow, CustomerFieldHistoryRow } from "../data/change-request-row-types"
import type { CustomerChangeRequest, CustomerChangeRequirement, CustomerFieldHistoryEntry } from "./types"

/**
 * Pure row -> domain mappers for the persisted Change Request, the
 * inverse of the RPCs in
 * supabase/migrations/20260913060000_customer_change_request_foundation.sql.
 * Mirrors src/features/customer-onboarding/domain/case-mappers.ts's own
 * unwrap-effective_data.values shape exactly.
 */

function toProposedValues(revision: SubmissionRevisionRow | null): Record<string, unknown> {
  if (!revision) return {}
  return revision.status === "submitted" && revision.effective_data ? revision.effective_data.values : revision.raw_data
}

function toRequirement(row: CustomerChangeRequestRequirementRow): CustomerChangeRequirement {
  return {
    kind: row.kind,
    roleCode: row.role_code,
    scopeLabel: row.scope_label,
    evidenceType: row.evidence_type,
    reason: row.reason,
    matchedRuleKeys: row.matched_rule_keys,
  }
}

function toCustomerChangeRequest(
  row: CustomerChangeRequestRow,
  latestRevision: SubmissionRevisionRow | null,
  requirementRows: CustomerChangeRequestRequirementRow[]
): CustomerChangeRequest {
  return {
    requestId: row.request_id,
    customerId: row.customer_id,
    status: row.status,
    reason: row.reason,
    effectiveDate: row.effective_date,
    baseCustomerRowVersion: row.base_customer_row_version,
    proposedValues: toProposedValues(latestRevision),
    requirements: requirementRows.map(toRequirement),
    sentBack: row.sent_back_reason && row.sent_back_at ? { reason: row.sent_back_reason, sentBackBy: row.sent_back_by, sentBackAt: row.sent_back_at } : null,
    decidedBy: row.decided_by,
    decidedAt: row.decided_at,
    decisionReason: row.decision_reason,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toFieldHistoryEntry(row: CustomerFieldHistoryRow): CustomerFieldHistoryEntry {
  return {
    id: row.id,
    fieldKey: row.field_key,
    oldValue: row.old_value,
    newValue: row.new_value,
    effectiveDate: row.effective_date,
    changeRequestId: row.customer_change_request_id,
    requestedBy: row.requested_by,
    approvedBy: row.approved_by,
    changedAt: row.changed_at,
  }
}

export { toCustomerChangeRequest, toProposedValues, toFieldHistoryEntry }
