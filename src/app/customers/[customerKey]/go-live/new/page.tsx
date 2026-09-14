import { notFound } from "next/navigation"

import { AuthGate } from "@/components/product/auth-gate"
import { getCurrentNexusSession } from "@/platform/auth/server"
import { getCustomerByKey } from "@/features/customers/server"
import { listCurrentLineItemsForCustomer } from "@/features/go-live/server"
import { GoLiveCreateForm } from "@/features/go-live/ui/go-live-create-form"

/**
 * Go Live creation route (Phase E). `stableComponentKey` arrives as a
 * query param from the Go Live list page's own "Create Go Live" link,
 * but is only ever used to look the line item back up from real,
 * server-resolved data (`listCurrentLineItemsForCustomer`): nothing
 * about the locked Commercial context is ever trusted from the URL
 * itself, only the identity used to re-fetch it.
 */
export const dynamic = "force-dynamic"

const GO_LIVE_CREATE = { resource: "go_live", action: "create" }

export default async function CreateGoLiveRoute({
  params,
  searchParams,
}: {
  params: Promise<{ customerKey: string }>
  searchParams: Promise<{ stableComponentKey?: string }>
}) {
  const { customerKey } = await params
  const { stableComponentKey } = await searchParams
  const session = await getCurrentNexusSession()

  const customer = await getCustomerByKey(customerKey)
  if (!customer) notFound()

  const lineItems = await listCurrentLineItemsForCustomer(customer.id)
  const lineItem = lineItems.find((item) => item.stableComponentKey === stableComponentKey)
  if (!lineItem || !lineItem.isRecurring) notFound()
  // A line item with any non-cancelled Go Live request already existing
  // is not eligible for a second one (see the concurrency note in
  // docs/GO_LIVE_ENTITLEMENT_ARCHITECTURE.md: this is a route-level
  // guard, not yet a database constraint).
  if (lineItem.currentRequest) notFound()

  return (
    <AuthGate session={session} requiredPermission={GO_LIVE_CREATE} loginRedirectTo={`/customers/${customerKey}/go-live/new?stableComponentKey=${stableComponentKey ?? ""}`}>
      <GoLiveCreateForm customerKey={customerKey} lineItem={lineItem} />
    </AuthGate>
  )
}
