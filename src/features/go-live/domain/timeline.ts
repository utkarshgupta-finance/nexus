import type { RequestTimelineEvent } from "@/components/product/request-timeline"
import type { GoLiveRequest, GoLiveSendBackEntry } from "./types"

/**
 * Go Live request timeline (Phase R: every governed action shows a
 * human actor and a timestamp, never a raw id). Reuses the shared,
 * domain-agnostic `RequestTimeline` renderer exactly as Customer
 * Change/Commercial Version already do; only event composition is
 * feature-specific.
 *
 * `workflowTransitionEvents` (Workflow Runtime V1 UX + Audit Closure):
 * see ../../customer-change/domain/timeline.ts's own
 * BuildChangeRequestTimelineInput.workflowTransitionEvents for the full
 * contract. When non-empty, replaces the send-back/approved events
 * below (built from go_live_send_backs/approved_by, the same moments
 * the workflow transitions now describe with a node name and per-step
 * attribution); the final approval line still carries Go Live's own
 * "line item is now Live" detail, folded into the last transition event
 * itself rather than as a second line.
 */
function buildGoLiveTimeline(
  request: GoLiveRequest,
  sendBacks: GoLiveSendBackEntry[],
  actorLabels: Map<string, string | null>,
  workflowTransitionEvents: RequestTimelineEvent[] = []
): RequestTimelineEvent[] {
  const label = (id: string | null) => (id ? (actorLabels.get(id) ?? null) : null)
  const hasWorkflowHistory = workflowTransitionEvents.length > 0

  const events: RequestTimelineEvent[] = [
    { id: "created", occurredAt: request.createdAt, actorEmail: label(request.createdBy), summary: "Go Live request created" },
  ]

  if (request.submittedAt) {
    // Only a single latest submission is tracked (no per-cycle revisions
    // table, see the migration's own comment on this file's shape), so
    // "resubmission" cannot be read off any status/count alone: it must
    // compare timestamps against send-back history. Testing this live
    // caught a real bug where every submission was mislabeled
    // "Resubmitted" the moment ANY send-back existed, even retroactively
    // relabeling the very first submission that preceded it.
    const isResubmission = sendBacks.some((sendBack) => new Date(sendBack.sentBackAt).getTime() < new Date(request.submittedAt!).getTime())
    events.push({
      id: "submitted",
      occurredAt: request.submittedAt,
      actorEmail: label(request.submittedBy),
      summary: isResubmission ? "Resubmitted for review" : "Submitted for review",
    })
  }

  if (hasWorkflowHistory) {
    events.push(...workflowTransitionEvents)
  } else {
    for (const sendBack of sendBacks) {
      events.push({
        id: `sent-back-${sendBack.id}`,
        occurredAt: sendBack.sentBackAt,
        actorEmail: label(sendBack.sentBackBy),
        summary: `Sent back: ${sendBack.reason}`,
      })
    }

    if (request.approvedAt) {
      events.push({ id: "approved", occurredAt: request.approvedAt, actorEmail: label(request.approvedBy), summary: "Approved: line item is now Live" })
    }
  }

  if (request.cancelledAt) {
    events.push({
      id: "cancelled",
      occurredAt: request.cancelledAt,
      actorEmail: label(request.cancelledBy),
      summary: request.cancelledReason ? `Cancelled: ${request.cancelledReason}` : "Cancelled",
    })
  }

  return events.sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime())
}

export { buildGoLiveTimeline }
