import "server-only"

import { resolveActorEmails } from "@/platform/audit/server"
import type { RequestTimelineEvent } from "@/components/product/request-timeline"
import { loadChangeRequest, listChangeRequestSendBacks, listChangeRequestRevisionSummaries } from "../services/change-request.service"
import { buildChangeRequestTimeline, collectChangeRequestTimelineActorIds } from "../domain/timeline"

/**
 * One Customer Change Request's own Timeline (Platform Scale Program,
 * Phase I): mirrors ../../customer-onboarding/server/timeline.ts's exact
 * shape.
 */
async function loadChangeRequestTimeline(requestId: string): Promise<RequestTimelineEvent[]> {
  const changeRequest = await loadChangeRequest(requestId)
  if (!changeRequest) return []

  const [revisions, sendBacks] = await Promise.all([listChangeRequestRevisionSummaries(requestId), listChangeRequestSendBacks(requestId)])

  const decisionStatus = changeRequest.status === "approved" || changeRequest.status === "rejected" ? changeRequest.status : null

  const input = {
    createdAt: changeRequest.createdAt,
    createdBy: changeRequest.createdBy,
    decidedAt: changeRequest.decidedAt,
    decidedBy: changeRequest.decidedBy,
    decisionStatus,
    decisionReason: changeRequest.decisionReason,
    revisions,
    sendBacks,
  }

  const actorEmails = await resolveActorEmails(collectChangeRequestTimelineActorIds(input))
  return buildChangeRequestTimeline({ ...input, actorEmails })
}

export { loadChangeRequestTimeline }
