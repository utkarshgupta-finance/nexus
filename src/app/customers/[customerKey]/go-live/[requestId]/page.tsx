import { notFound } from "next/navigation"

import { AuthGate } from "@/components/product/auth-gate"
import { getCurrentNexusSession } from "@/platform/auth/server"
import { hasPermission } from "@/platform/permissions/server"
import { getCustomerByKey } from "@/features/customers/server"
import {
  getGoLiveRequestById,
  listSendBacksForGoLiveRequest,
  resolveGoLiveActorLabels,
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

  const [sendBacks, documents, lineItems, canSubmit, canApprove] = await Promise.all([
    listSendBacksForGoLiveRequest(request.id),
    listGoLiveDocuments(request.id),
    listCurrentLineItemsForCustomer(customer.id),
    hasPermission("go_live", "submit"),
    hasPermission("go_live", "approve"),
  ])

  const actorLabels = await resolveGoLiveActorLabels([request])
  const timelineEvents = buildGoLiveTimeline(request, sendBacks, actorLabels)
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
