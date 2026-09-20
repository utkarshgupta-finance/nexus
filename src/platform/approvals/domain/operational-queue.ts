import type { ApprovalInboxItem } from "./types"
import { currentResponsibilityLabel } from "./inbox"
import { ageInDays } from "./my-work"

type OperationalQueueEntry = {
  type: ApprovalInboxItem["type"]
  requestId: string
  displayId: string
  customerName: string
  status: string
  /** Role/stage, never a fabricated named person: see currentResponsibilityLabel. Always computed as if the viewer cannot decide it themselves, since this is a cross-request operational view, not "what can I personally do." */
  currentResponsibility: string
  ageDays: number
  sentBackCount: number
  href: string
  /** The team currently responsible for this item, resolved from its own current node (null if no workflow is bound or no team is named for that node). */
  responsibleTeamName: string | null
  /** False when responsibleTeamName is set but that team currently has zero active members (Product Gap Closure, O-018): this item cannot be acted on by anyone until an admin restores an eligible member. True whenever no specific team is required at all. */
  hasEligibleApprover: boolean
}

/**
 * Operational queue read model (Platform Scale Closure, Phase L): not a
 * dashboard, not analytics, no charts. Answers the plain operational
 * questions a manager actually has: what is pending, what type, how
 * old, how many times sent back, and which role needs to act, built
 * entirely from the same Approvals inbox items already fetched (no new
 * table, no duplicated read). Excludes `completed` items: this is a
 * "what is currently stuck" view, not a history report (the Approvals
 * inbox's own Completed tab already covers that).
 *
 * `sentBackCountsByRequestId` is intentionally a plain lookup rather
 * than a field this function fetches itself: Commercial Version has no
 * send-back concept at all (always 0, simply absent from the map),
 * Onboarding and Customer Change each source theirs from a different
 * table, and this function should not need to know that.
 *
 * `activeMemberCountsByTeamId`/`teamNamesById` (Product Gap Closure,
 * O-018) surface which pending items currently have zero eligible
 * approvers, the same "what is currently stuck, and why" this view
 * already exists for, rather than a new dashboard: a team dropping to
 * zero active members while work is pending was previously invisible
 * anywhere in the product.
 */
function buildOperationalQueue(
  items: ApprovalInboxItem[],
  sentBackCountsByRequestId: Map<string, number>,
  activeMemberCountsByTeamId: Map<string, number>,
  teamNamesById: Map<string, string>,
  now: Date
): OperationalQueueEntry[] {
  return items
    .filter((item) => item.bucket !== "completed")
    .map((item) => ({
      type: item.type,
      requestId: item.requestId,
      displayId: item.displayId,
      customerName: item.customerName,
      status: item.status,
      currentResponsibility: currentResponsibilityLabel(item.status, false),
      ageDays: ageInDays(item.updatedAt, now),
      sentBackCount: sentBackCountsByRequestId.get(item.requestId) ?? 0,
      href: item.href,
      responsibleTeamName: item.responsibleTeamId ? (teamNamesById.get(item.responsibleTeamId) ?? null) : null,
      hasEligibleApprover: !item.responsibleTeamId || (activeMemberCountsByTeamId.get(item.responsibleTeamId) ?? 0) > 0,
    }))
    .sort((a, b) => b.ageDays - a.ageDays)
}

export { buildOperationalQueue }
export type { OperationalQueueEntry }
