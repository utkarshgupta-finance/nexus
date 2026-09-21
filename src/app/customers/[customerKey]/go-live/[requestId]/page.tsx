import { notFound } from "next/navigation"

import { AuthGate } from "@/components/product/auth-gate"
import { getCurrentNexusSession } from "@/platform/auth/server"
import { hasPermission } from "@/platform/permissions/server"
import { resolveActorLabels } from "@/platform/audit/server"
import { getWorkflowTransitionTimelineInputs, buildWorkflowTransitionEvents } from "@/platform/workflow-builder/server"
import { getCustomerByKey } from "@/features/customers/server"
import {
  getGoLiveRequestById,
  listSendBacksForGoLiveRequest,
  listGoLiveDocuments,
  buildGoLiveTimeline,
  listCurrentLineItemsForCustomer,
} from "@/features/go-live/server"
import { GoLiveDetailPage } from "@/features/go-live/ui/go-live-detail-page"

export const dynamic = "force-dynamic"

const GO_LIVE_READ = { resource: "go_live", action: "read" }

export default async function GoLiveDetailRoute({ params }: { params: Promise<{ customerKey: string; requestId: string }> }) {
  const { customerKey, requestId } = await params
  const session = await getCurrentNexusSession()

  const customer = await getCustomerByKey(customerKey)
  if (!customer) notFound()

  const request = await getGoLiveRequestById(requestId)
  if (!request || request.customerId !== customer.id) notFound()

  const [sendBacks, documents, lineItems, canSubmit, canApprove, transitionInputs] = await Promise.all([
    listSendBacksForGoLiveRequest(request.id),
    listGoLiveDocuments(request.id),
    listCurrentLineItemsForCustomer(customer.id),
    hasPermission("go_live", "submit"),
    hasPermission("go_live", "approve"),
    getWorkflowTransitionTimelineInputs("go_live", request.id),
  ])

  const actorLabels = await resolveActorLabels([
    request.createdBy,
    request.sentBackBy,
    request.approvedBy,
    request.cancelledBy,
    ...transitionInputs.actorIds,
  ])
  const workflowTransitionEvents = buildWorkflowTransitionEvents(
    transitionInputs.transitions,
    transitionInputs.nodeDisplayByKey,
    actorLabels,
    "line item is now Live",
    request.status === "approved"
  )
  const timelineEvents = buildGoLiveTimeline(request, sendBacks, actorLabels, workflowTransitionEvents)
  const lineItem = lineItems.find((item) => item.stableComponentKey === request.stableComponentKey) ?? null

  return (
    <AuthGate session={session} requiredPermission={GO_LIVE_READ} loginRedirectTo={`/customers/${customerKey}/go-live/${requestId}`}>
      <GoLiveDetailPage
        customerKey={customerKey}
        request={request}
        lineItem={lineItem}
        documents={documents}
        timelineEvents={timelineEvents}
        canSubmit={canSubmit}
        canApprove={canApprove}
      />
    </AuthGate>
  )
}
