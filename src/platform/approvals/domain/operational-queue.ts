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
 */
function buildOperationalQueue(items: ApprovalInboxItem[], sentBackCountsByRequestId: Map<string, number>, now: Date): OperationalQueueEntry[] {
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
    }))
    .sort((a, b) => b.ageDays - a.ageDays)
}

export { buildOperationalQueue }
export type { OperationalQueueEntry }
