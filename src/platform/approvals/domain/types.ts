/**
 * Unified Approvals inbox (task Phase E): one operational surface over
 * three independently governed lifecycles (Customer Onboarding, Customer
 * Change Request, Commercial Configuration Version). Each keeps its own
 * RPCs, permissions, and detail/decision screen; this only unifies the
 * "what needs attention" list.
 */

type ApprovalInboxItemType = "onboarding" | "change_request" | "commercial_version" | "go_live"

/** A draft is not yet anyone's concern but its own author's, so it never appears in this inbox at all (see ../domain/inbox.ts's `bucketForStatus`). */
type ApprovalInboxBucket = "needs_action" | "sent_back" | "completed"

type ApprovalInboxItem = {
  type: ApprovalInboxItemType
  requestId: string
  /** Human-Friendly ID (task Phase L): "CO-000123" / "CCR-000045" / "CC-000078", already formatted. Never the raw UUID. */
  displayId: string
  status: string
  bucket: ApprovalInboxBucket
  customerName: string
  customerKey: string | null
  /** Raw requester actor id, distinct from `requestedByEmail` (already resolved to a display string): My Work's own domain logic (../domain/my-work.ts) scopes "sent back to me" against this, never against an email string. */
  createdBy: string | null
  requestedByEmail: string | null
  createdAt: string
  updatedAt: string
  href: string
}

export type { ApprovalInboxItemType, ApprovalInboxBucket, ApprovalInboxItem }
