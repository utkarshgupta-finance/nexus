import type { ApprovalInboxBucket, ApprovalInboxItem, ApprovalInboxItemType } from "./types"

const ITEM_TYPE_LABELS: Record<ApprovalInboxItemType, string> = {
  onboarding: "Customer Onboarding",
  change_request: "Customer Change Request",
  commercial_version: "Commercial Version",
}

function labelForItemType(type: ApprovalInboxItemType): string {
  return ITEM_TYPE_LABELS[type]
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

export { bucketForStatus, sortByUpdatedAtDesc, filterByBucket, labelForItemType }
