/**
 * Permanent Customer Deletion domain types (Customer Lifecycle V1, Phase
 * 14-16). `DeletionEligibility` is computed fresh, read-only, against
 * the real M9/M10-adjacent schema (never invented tables); the RPC
 * re-checks the same facts server-side before ever deleting anything, so
 * this eligibility read is informational/UX-only, never the actual gate.
 */

type DeletionBlockerKind = "commercial_configuration" | "approved_change_request"

type DeletionBlocker = {
  kind: DeletionBlockerKind
  count: number
  reason: string
}

type DeletionEligibility = {
  customerId: string
  eligible: boolean
  blockers: DeletionBlocker[]
}

type CustomerDeletionAudit = {
  id: string
  customerId: string
  customerKey: string
  customerName: string
  segment: string | null
  businessUnit: string | null
  country: string | null
  industry: string | null
  brandName: string | null
  wasActive: boolean
  reason: string
  deletedBy: string | null
  deletedAt: string
}

export type { DeletionBlockerKind, DeletionBlocker, DeletionEligibility, CustomerDeletionAudit }
