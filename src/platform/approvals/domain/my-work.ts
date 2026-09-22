import type { ApprovalInboxItem, ApprovalInboxItemType } from "./types"
import { labelForItemType } from "./inbox"

/**
 * M-021 fix (Batch 21 finding, closed as a bounded defect against the
 * already-settled "Pending My Approval means this user can actually
 * approve this item now" invariant, pre-Batch-22): the domain's real
 * approve permission resource per item type. `onboarding` and
 * `change_request` legitimately share the same `customer` resource (they
 * are not separately permissioned in this product); `commercial_version`
 * and `go_live` each have their own. A single OR'd boolean across
 * `customer`/`go_live` (with `commercial_configuration` never even
 * included) let a user who held only one domain's approve permission and
 * coincidentally shared a team with a DIFFERENT domain's node see that
 * item as actionable, even though the real approve RPC would reject them.
 */
const APPROVE_PERMISSION_RESOURCE_BY_TYPE: Record<ApprovalInboxItemType, string> = {
  onboarding: "customer",
  change_request: "customer",
  commercial_version: "commercial_configuration",
  go_live: "go_live",
}

type CanApproveByType = Record<ApprovalInboxItemType, boolean>

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
 * "Pending my approval": Workflow Runtime V1 Sequential Execution added
 * real per-node team routing, replacing Customer Lifecycle V1's older
 * "any customer.approve holder may decide any of them"
 * (docs/CUSTOMER_LIFECYCLE.md). A `needs_action` item qualifies only if
 * this user holds THIS ITEM'S OWN DOMAIN's approve permission (M-021 fix,
 * pre-Batch-22: previously a single OR'd boolean across only
 * customer/go_live, which could cosmetically list an item as actionable
 * for a user who held a different domain's approve permission and merely
 * happened to share a team with the item's node) AND either the
 * item names no responsible team (no workflow bound, or a graph with no
 * Approval node routing) or this user is an active member of that team
 * AND this user did not create the item themselves (self-approval is
 * blocked server-side on every approve_* RPC via SELF_APPROVAL_NOT_ALLOWED;
 * Batch 20's M-011 found the inbox listed a self-created, otherwise-eligible
 * item as actionable here even though clicking Approve would always fail,
 * so the self-created case is excluded from this reason and falls through
 * to "waiting on others" instead, decided and closed pre-Batch-21). This is
 * what makes Finance's task disappear and Legal's appear the moment a
 * sequential Approval node advances, instead of every approve-permission
 * holder seeing every submitted item forever.
 *
 * "Waiting on others" (Platform Scale Closure, Phase K; extended pre-Batch-21
 * per M-011): the flip side of "sent back to me", for a requester checking
 * on their own submitted work: an item they created that is `needs_action`
 * but they cannot decide themselves, whether for lacking the permission
 * entirely, not covering the item's current node's team, or (as of the
 * M-011 closure) being blocked from approving their own request by the
 * self-approval rule even though they would otherwise be eligible.
 */
function buildMyWorkItems(items: ApprovalInboxItem[], appUserId: string, canApproveByType: CanApproveByType, viewerTeamIds: Set<string>, now: Date): MyWorkItem[] {
  const result: MyWorkItem[] = []
  for (const item of items) {
    const isResponsibleTeam = item.responsibleTeamId === null || viewerTeamIds.has(item.responsibleTeamId)
    const isSelfCreated = item.createdBy === appUserId
    const canApproveThisItem = canApproveByType[item.type]
    let reason: MyWorkReason | null = null
    if (item.bucket === "sent_back" && isSelfCreated) reason = "sent_back_to_me"
    else if (item.bucket === "needs_action" && canApproveThisItem && isResponsibleTeam && !isSelfCreated) reason = "pending_my_approval"
    else if (item.bucket === "needs_action" && isSelfCreated) reason = "waiting_on_others"
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

export { buildMyWorkItems, buildDraftWorkItems, ageInDays, APPROVE_PERMISSION_RESOURCE_BY_TYPE }
export type { MyWorkItem, MyWorkReason, CanApproveByType }
