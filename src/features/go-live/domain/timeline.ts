import type { RequestTimelineEvent } from "@/components/product/request-timeline"
import type { GoLiveRequest, GoLiveSendBackEntry } from "./types"

/**
 * Go Live request timeline (Phase R: every governed action shows a
 * human actor and a timestamp, never a raw id). Reuses the shared,
 * domain-agnostic `RequestTimeline` renderer exactly as Customer
 * Change/Commercial Version already do; only event composition is
 * feature-specific.
 */
function buildGoLiveTimeline(request: GoLiveRequest, sendBacks: GoLiveSendBackEntry[], actorLabels: Map<string, string | null>): RequestTimelineEvent[] {
  const label = (id: string | null) => (id ? (actorLabels.get(id) ?? null) : null)
  const events: RequestTimelineEvent[] = [
    { id: "created", occurredAt: request.createdAt, actorEmail: label(request.createdBy), summary: "Go Live request created" },
  ]

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
