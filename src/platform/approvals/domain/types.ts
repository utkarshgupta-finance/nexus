/**
 * Unified Approvals inbox (task Phase E): one operational surface over
 * three independently governed lifecycles (Customer Onboarding, Customer
 * Change Request, Commercial Configuration Version). Each keeps its own
 * RPCs, permissions, and detail/decision screen; this only unifies the
 * "what needs attention" list.
 */

type ApprovalInboxItemType = "onboarding" | "change_request" | "commercial_version"

/** A draft is not yet anyone's concern but its own author's, so it never appears in this inbox at all (see ../domain/inbox.ts's `bucketForStatus`). */
type ApprovalInboxBucket = "needs_action" | "sent_back" | "completed"

type ApprovalInboxItem = {
  type: ApprovalInboxItemType
  requestId: string
  status: string
  bucket: ApprovalInboxBucket
  customerName: string
  customerKey: string | null
  requestedByEmail: string | null
  createdAt: string
  updatedAt: string
  href: string
}

export type { ApprovalInboxItemType, ApprovalInboxBucket, ApprovalInboxItem }
