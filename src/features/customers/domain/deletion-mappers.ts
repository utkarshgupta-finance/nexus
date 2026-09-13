import type { CustomerDeletionAuditRow } from "../data/deletion-row-types"
import type { CustomerDeletionAudit, DeletionBlocker } from "./deletion-types"

function toCustomerDeletionAudit(row: CustomerDeletionAuditRow): CustomerDeletionAudit {
  return {
    id: row.id,
    customerId: row.customer_id,
    customerKey: row.customer_key,
    customerName: row.customer_name,
    segment: row.segment,
    businessUnit: row.business_unit,
    country: row.country,
    industry: row.industry,
    brandName: row.brand_name,
    wasActive: row.was_active,
    reason: row.reason,
    deletedBy: row.deleted_by,
    deletedAt: row.deleted_at,
  }
}

/** Pure composition of the two eligibility counts into the domain shape; kept separate from the I/O (../server.ts) so it stays directly unit-testable, matching this codebase's established read-model split. */
function toDeletionEligibility(customerId: string, commercialConfigurationCount: number, approvedChangeRequestCount: number) {
  const blockers: DeletionBlocker[] = []
  if (commercialConfigurationCount > 0) {
    blockers.push({
      kind: "commercial_configuration",
      count: commercialConfigurationCount,
      reason: `This customer has ${commercialConfigurationCount} Commercial Configuration(s). Once a customer has a real Commercial Configuration, even an empty one, it is permanent business history and cannot be removed.`,
    })
  }
  if (approvedChangeRequestCount > 0) {
    blockers.push({
      kind: "approved_change_request",
      count: approvedChangeRequestCount,
      reason: `This customer has ${approvedChangeRequestCount} approved Customer Change Request(s). Approved governance decisions are protected history.`,
    })
  }
  return { customerId, eligible: blockers.length === 0, blockers }
}

export { toCustomerDeletionAudit, toDeletionEligibility }
