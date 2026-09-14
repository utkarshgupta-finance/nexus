import type { ApprovalInboxItem, ApprovalInboxItemType } from "./types"
import { labelForItemType } from "./inbox"

type MyWorkReason = "sent_back_to_me" | "pending_my_approval" | "draft_to_continue" | "waiting_on_others"

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
  if (reason === "sent_back_to_me") return `Address reviewer feedback and resubmit this ${labelForItemType(type)}`
  if (reason === "draft_to_continue") return `Finish and submit this draft ${labelForItemType(type)}`
  if (reason === "waiting_on_others") return `Nothing to do yet, still pending Finance approval`
  return `Review and decide this ${labelForItemType(type)}`
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
 *
 * "Waiting on others" (Platform Scale Closure, Phase K): the flip side
 * of "sent back to me", for a requester checking on their own submitted
 * work: an item they created that is `needs_action` but they cannot
 * decide themselves. Checked only after "pending my approval" so a
 * request its own creator can also approve shows as actionable to them,
 * not merely as "waiting."
 */
function buildMyWorkItems(items: ApprovalInboxItem[], appUserId: string, canApprove: boolean, now: Date): MyWorkItem[] {
  const result: MyWorkItem[] = []
  for (const item of items) {
    let reason: MyWorkReason | null = null
    if (item.bucket === "sent_back" && item.createdBy === appUserId) reason = "sent_back_to_me"
    else if (item.bucket === "needs_action" && canApprove) reason = "pending_my_approval"
    else if (item.bucket === "needs_action" && item.createdBy === appUserId) reason = "waiting_on_others"
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

/**
 * "Drafts I should continue" (Platform Scale Closure, Phase K): a
 * Customer Change or Commercial Version draft has nowhere else in the
 * product a person can find it again (unlike Onboarding, which already
 * has its own dedicated My Requests page for exactly this, so its drafts
 * are deliberately not duplicated here). Takes draft-status entries
 * already scoped to `createdBy === appUserId` by the caller: this
 * function only shapes them, it does not decide who created what.
 */
type DraftWorkSource = Pick<ApprovalInboxItem, "type" | "requestId" | "displayId" | "customerName" | "status" | "href" | "updatedAt">

function buildDraftWorkItems(draftEntries: DraftWorkSource[], now: Date): MyWorkItem[] {
  return draftEntries
    .map((entry) => ({
      type: entry.type,
      requestId: entry.requestId,
      displayId: entry.displayId,
      customerName: entry.customerName,
      whatINeedToDo: whatINeedToDo("draft_to_continue", entry.type),
      ageDays: ageInDays(entry.updatedAt, now),
      status: entry.status,
      href: entry.href,
      reason: "draft_to_continue" as const,
    }))
    .sort((a, b) => b.ageDays - a.ageDays)
}

export { buildMyWorkItems, buildDraftWorkItems }
export type { MyWorkItem, MyWorkReason }
