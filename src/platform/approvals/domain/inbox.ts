import type { ApprovalInboxBucket, ApprovalInboxItem, ApprovalInboxItemType } from "./types"

const ITEM_TYPE_LABELS: Record<ApprovalInboxItemType, string> = {
  onboarding: "Customer Onboarding",
  change_request: "Customer Change Request",
  commercial_version: "Commercial Version",
  go_live: "Go Live",
}

function labelForItemType(type: ApprovalInboxItemType): string {
  return ITEM_TYPE_LABELS[type]
}

/**
 * The one canonical case-status label map, shared by every surface that
 * renders an onboarding/change-request/commercial-version status: My
 * Requests, My Work, the Approvals inbox, and the onboarding review page.
 * Never scattered as ad hoc `replace('_',' ')`/title-case calls per
 * component (task spec). Falls back to a generic humanizer only for a
 * status this map does not yet know about, so a future status never
 * renders as a raw, un-humanized code.
 */
const CASE_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  resubmitted: "Resubmitted",
  sent_back: "Sent Back",
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled",
}

function labelForCaseStatus(status: string): string {
  return CASE_STATUS_LABELS[status] ?? status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " ")
}

/**
 * The one canonical "current responsibility" label (Platform Scale
 * Closure, Phase J): every governed request header should say plainly
 * who needs to act next, without ever fabricating an individual owner.
 * Nexus's approval model is role-based, not per-person (no routing to a
 * named reviewer exists), so this names a role/state
 * ("Pending Finance Approval"), never a person ("Pending with John").
 * `canDecide` is whichever permission check the caller already made
 * (`commercial_configuration.approve`, `customer.approve`, etc.), so the
 * same submitted/resubmitted state reads as "Needs Your Attention" for a
 * reviewer and "Pending Finance Approval" for anyone else, including the
 * requester checking on their own request.
 */
function currentResponsibilityLabel(status: string, canDecide: boolean): string {
  if (status === "draft" || status === "sent_back") return "Waiting on Requester"
  if (status === "submitted" || status === "resubmitted") return canDecide ? "Needs Your Attention" : "Pending Finance Approval"
  return labelForCaseStatus(status)
}

/** A `draft` belongs only to its own author and is deliberately excluded from this inbox entirely: nobody else needs to see it yet. */
function bucketForStatus(status: string): ApprovalInboxBucket | null {
  if (status === "submitted" || status === "resubmitted") return "needs_action"
  if (status === "sent_back") return "sent_back"
  if (status === "approved" || status === "rejected") return "completed"
  return null
}

function sortByUpdatedAtDesc(items: ApprovalInboxItem[]): ApprovalInboxItem[] {
  return [...items].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
}

function filterByBucket(items: ApprovalInboxItem[], bucket: ApprovalInboxBucket | "all"): ApprovalInboxItem[] {
  return bucket === "all" ? items : items.filter((item) => item.bucket === bucket)
}

export { bucketForStatus, sortByUpdatedAtDesc, filterByBucket, labelForItemType, labelForCaseStatus, currentResponsibilityLabel }
