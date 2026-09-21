import { notFound } from "next/navigation"

import { AuthGate } from "@/components/product/auth-gate"
import { getCurrentNexusSession } from "@/platform/auth/server"
import { hasPermission, hasPermissionForCustomer } from "@/platform/permissions/server"
import { loadChangeRequest, getCurrentGovernedValues, loadChangeRequestTimeline } from "@/features/customer-change/server"
import { ChangeRequestReviewPage } from "@/features/customer-change/ui/change-request-review-page"
import { getCustomerById } from "@/features/customers/server"
import { resolveActorLabels } from "@/platform/audit/server"
import { emptySnapshot, loadReferenceMasterSnapshot } from "@/features/reference-data/server"
import { ReferenceMasterSnapshotProvider } from "@/features/reference-data/ui/snapshot-context"
import type { ReferenceMasterSnapshot } from "@/features/reference-data"

/**
 * Reviewer detail screen for one Customer Change Request, mirroring
 * /reviews/[requestId]/page.tsx's own shape for the equivalent onboarding
 * case review.
 */
export const dynamic = "force-dynamic"

const CUSTOMER_READ = { resource: "customer", action: "read" }

export default async function ChangeRequestReviewRoute({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params
  const session = await getCurrentNexusSession()

  const changeRequest = await loadChangeRequest(requestId)
  if (!changeRequest) notFound()

  const customer = await getCustomerById(changeRequest.customerId)
  if (!customer) notFound()

  const currentValues = await getCurrentGovernedValues(customer.id)
  const canDecide = await hasPermission("customer", "approve")
  const canAccessThisChangeRequest = await hasPermissionForCustomer("customer", "read", customer.id)
  const timeline = await loadChangeRequestTimeline(requestId)

  let snapshot: ReferenceMasterSnapshot
  try {
    snapshot = await loadReferenceMasterSnapshot()
  } catch {
    snapshot = emptySnapshot()
  }

  /** Task Phase M: the "Previously sent back" banner needs its own resolved actor label, independent of the Timeline's own resolution. */
  const sentBackByLabels = await resolveActorLabels([changeRequest.sentBack?.sentBackBy ?? null])
  const sentBackByLabel = changeRequest.sentBack?.sentBackBy ? (sentBackByLabels.get(changeRequest.sentBack.sentBackBy) ?? null) : null

  return (
    <AuthGate
      session={session}
      requiredPermission={CUSTOMER_READ}
      loginRedirectTo={`/reviews/change-requests/${requestId}`}
      additionalAccessGranted={canAccessThisChangeRequest}
    >
      <ReferenceMasterSnapshotProvider snapshot={snapshot}>
        <ChangeRequestReviewPage
          requestId={requestId}
          customerName={customer.name}
          customerKey={customer.key}
          currentValues={currentValues}
          changeRequest={changeRequest}
          canDecide={canDecide}
          timeline={timeline}
          sentBackByLabel={sentBackByLabel}
        />
      </ReferenceMasterSnapshotProvider>
    </AuthGate>
  )
}
