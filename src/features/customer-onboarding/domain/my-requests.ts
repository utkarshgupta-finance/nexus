import type { CustomerOnboardingCaseStatus, CustomerOnboardingStageKey } from "./types"
import { CUSTOMER_ONBOARDING_STAGES } from "./process"

type MyRequestRow = {
  requestId: string
  caseNumber: number
  legalName: string
  brandName: string
  status: CustomerOnboardingCaseStatus
  currentStageKey: CustomerOnboardingStageKey
  revisionNumber: number
  sentBackCount: number
  createdAt: string
  updatedAt: string
  /** Only set once approved (task spec: Approved -> Open Customer). */
  customerKey: string | null
}

function stageLabel(stageKey: CustomerOnboardingStageKey): string {
  return CUSTOMER_ONBOARDING_STAGES.find((stage) => stage.key === stageKey)?.label ?? stageKey
}

/**
 * The friendly, derived workflow state shown next to the raw status
 * (task spec: "optional derived workflow state"). Never stored as
 * authoritative; recomputed fresh every time from `status` +
 * `currentStageKey`.
 */
function reviewState(status: CustomerOnboardingCaseStatus, stageKey: CustomerOnboardingStageKey): string {
  switch (status) {
    case "draft":
      return `Working on ${stageLabel(stageKey)}`
    case "submitted":
    case "resubmitted":
      return "Pending Approval"
    case "sent_back":
      return "Needs Your Attention"
    case "approved":
      return "Completed"
    case "cancelled":
      return "Cancelled"
    default:
      return ""
  }
}

/** Draft -> Continue, Sent Back -> Review & Resubmit, Submitted/Resubmitted -> View, Approved -> Open Customer (task spec: Action by Status). */
function primaryAction(row: MyRequestRow): { label: string; href: string } {
  switch (row.status) {
    case "draft":
      return { label: "Continue", href: `/forms/customer-onboarding/${row.requestId}` }
    case "sent_back":
      return { label: "Review & Resubmit", href: `/forms/customer-onboarding/${row.requestId}` }
    case "approved":
      return row.customerKey
        ? { label: "Open Customer", href: `/customers/${row.customerKey}` }
        : { label: "View", href: `/forms/customer-onboarding/${row.requestId}` }
    default:
      return { label: "View", href: `/forms/customer-onboarding/${row.requestId}` }
  }
}

/** Draft and Sent Back need action now; Submitted/Resubmitted are waiting; Approved is done. Lower sorts first (task spec: "default prioritizes actionable/in-progress work"). */
const STATUS_PRIORITY: Record<string, number> = { sent_back: 0, draft: 1, submitted: 2, resubmitted: 2, approved: 3, cancelled: 4 }

/** My Requests' default ordering: actionable work first, ties broken by most recently updated. Never mutates the input array. */
function sortMyRequestRows(rows: MyRequestRow[]): MyRequestRow[] {
  return [...rows].sort((a, b) => {
    const priorityDiff = (STATUS_PRIORITY[a.status] ?? 9) - (STATUS_PRIORITY[b.status] ?? 9)
    if (priorityDiff !== 0) return priorityDiff
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  })
}

/** Send Back count per request (task spec: derived from history, never a manually incremented counter), grouped client-side from a flat batch read since this only ever backs a small operational list. */
function countSendBacksByRequestId(rows: { request_id: string }[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const row of rows) {
    counts.set(row.request_id, (counts.get(row.request_id) ?? 0) + 1)
  }
  return counts
}

export { stageLabel, reviewState, primaryAction, sortMyRequestRows, countSendBacksByRequestId }
export type { MyRequestRow }
