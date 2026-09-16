import "server-only"

import { resolveActorLabels } from "@/platform/audit/server"
import { getWorkflowTransitionTimelineInputs, buildWorkflowTransitionEvents } from "@/platform/workflow-builder/server"
import type { RequestTimelineEvent } from "@/components/product/request-timeline"
import { loadChangeRequest, listChangeRequestSendBacks, listChangeRequestRevisionSummaries } from "../services/change-request.service"
import { buildChangeRequestTimeline, collectChangeRequestTimelineActorIds } from "../domain/timeline"

/**
 * One Customer Change Request's own Timeline (Platform Scale Program,
 * Phase I; extended by Workflow Runtime V1 UX + Audit Closure to also
 * surface its workflow node transitions): mirrors
 * ../../customer-onboarding/server/timeline.ts's exact shape.
 */
async function loadChangeRequestTimeline(requestId: string): Promise<RequestTimelineEvent[]> {
  const changeRequest = await loadChangeRequest(requestId)
  if (!changeRequest) return []

  const [revisions, sendBacks, transitionInputs] = await Promise.all([
    listChangeRequestRevisionSummaries(requestId),
    listChangeRequestSendBacks(requestId),
    getWorkflowTransitionTimelineInputs("customer_change", requestId),
  ])

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

  const actorLabels = await resolveActorLabels([...collectChangeRequestTimelineActorIds(input), ...transitionInputs.actorIds])
  const workflowTransitionEvents = buildWorkflowTransitionEvents(transitionInputs.transitions, transitionInputs.nodeDisplayByKey, actorLabels)
  return buildChangeRequestTimeline({ ...input, actorLabels, workflowTransitionEvents })
}

export { loadChangeRequestTimeline }
