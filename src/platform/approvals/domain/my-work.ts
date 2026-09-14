import type { ApprovalInboxItem, ApprovalInboxItemType } from "./types"
import { labelForItemType } from "./inbox"

type MyWorkReason = "sent_back_to_me" | "pending_my_approval"

type MyWorkItem = {
  type: ApprovalInboxItemType
  requestId: string
  displayId: string
  customerName: string
  whatINeedToDo: string
  ageDays: number
  status: string
  href: string
  reason: MyWorkReason
}

function ageInDays(updatedAt: string, now: Date): number {
  const diffMs = now.getTime() - new Date(updatedAt).getTime()
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)))
}

function whatINeedToDo(reason: MyWorkReason, type: ApprovalInboxItemType): string {
  return reason === "sent_back_to_me"
    ? `Address reviewer feedback and resubmit this ${labelForItemType(type)}`
    : `Review and decide this ${labelForItemType(type)}`
}

/**
 * My Work (task spec): a personal, actionable summary, never a
 * duplicated business record, built by re-scoping the same Approvals
 * inbox items (../server.ts's loadApprovalInbox), never a second read of
 * the underlying tables.
 *
 * "Sent back to me": scoped to requests THIS user created (their own
 * onboarding/change-request/commercial-version came back to them). Uses
 * the item's raw `createdBy` id, never the resolved email string.
 *
 * "Pending my approval": Customer Lifecycle V1 has no per-person
 * approval routing yet (docs/CUSTOMER_LIFECYCLE.md: any customer.approve
 * holder may decide any of them), so every `needs_action` item qualifies
 * once this user holds that permission at all, not a subset assigned to
 * them specifically.
 */
function buildMyWorkItems(items: ApprovalInboxItem[], appUserId: string, canApprove: boolean, now: Date): MyWorkItem[] {
  const result: MyWorkItem[] = []
  for (const item of items) {
    let reason: MyWorkReason | null = null
    if (item.bucket === "sent_back" && item.createdBy === appUserId) reason = "sent_back_to_me"
    else if (item.bucket === "needs_action" && canApprove) reason = "pending_my_approval"
    if (!reason) continue
    result.push({
      type: item.type,
      requestId: item.requestId,
      displayId: item.displayId,
      customerName: item.customerName,
      whatINeedToDo: whatINeedToDo(reason, item.type),
      ageDays: ageInDays(item.updatedAt, now),
      status: item.status,
      href: item.href,
      reason,
    })
  }
  return result.sort((a, b) => b.ageDays - a.ageDays)
}

export { buildMyWorkItems }
export type { MyWorkItem, MyWorkReason }
