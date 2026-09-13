import { notFound } from "next/navigation"

import { AuthGate } from "@/components/product/auth-gate"
import { getCurrentNexusSession } from "@/platform/auth/server"
import { getCustomerByKey } from "@/features/customers/server"
import { loadChangeRequest, getCurrentGovernedValues } from "@/features/customer-change/server"
import { ChangeRequestPage } from "@/features/customer-change/ui/change-request-page"
import { emptySnapshot, loadReferenceMasterSnapshot } from "@/features/reference-data/server"
import { ReferenceMasterSnapshotProvider } from "@/features/reference-data/ui/snapshot-context"
import type { ReferenceMasterSnapshot } from "@/features/reference-data"

/**
 * The real Customer Change Request screen: reads one real, persisted
 * Change Request by its stable request id, the same "bare create route
 * redirects here" shape as
 * /forms/customer-onboarding/[requestId]/page.tsx.
 */
export const dynamic = "force-dynamic"

const CUSTOMER_CHANGE_REQUEST = { resource: "customer", action: "change_request" }

export default async function CustomerChangeRequestRoute({ params }: { params: Promise<{ customerKey: string; requestId: string }> }) {
  const { customerKey, requestId } = await params
  const session = await getCurrentNexusSession()

  const customer = await getCustomerByKey(customerKey)
  if (!customer) notFound()

  const changeRequest = await loadChangeRequest(requestId)
  if (!changeRequest || changeRequest.customerId !== customer.id) notFound()

  const currentValues = await getCurrentGovernedValues(customer.id)

  let snapshot: ReferenceMasterSnapshot
  try {
    snapshot = await loadReferenceMasterSnapshot()
  } catch {
    snapshot = emptySnapshot()
  }

  return (
    <AuthGate session={session} requiredPermission={CUSTOMER_CHANGE_REQUEST} loginRedirectTo={`/customers/${customerKey}/change-requests/${requestId}`}>
      <ReferenceMasterSnapshotProvider snapshot={snapshot}>
        <ChangeRequestPage
          requestId={requestId}
          customerName={customer.name}
          currentValues={currentValues as Record<string, string | null>}
          initialChangeRequest={changeRequest}
        />
      </ReferenceMasterSnapshotProvider>
    </AuthGate>
  )
}
