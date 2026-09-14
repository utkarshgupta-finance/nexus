import { notFound } from "next/navigation"

import { AuthGate } from "@/components/product/auth-gate"
import { getCurrentNexusSession } from "@/platform/auth/server"
import { hasPermission } from "@/platform/permissions/server"
import { getCustomerByKey } from "@/features/customers/server"
import { listCurrentLineItemsForCustomer } from "@/features/go-live/server"
import { GoLiveListPage } from "@/features/go-live/ui/go-live-list-page"

/**
 * Customer -> Go Live tab (Go Live + Entitlement Ledger, Phase E).
 * `dynamic = "force-dynamic"` matching every other route reading live
 * backend/session data in this app.
 */
export const dynamic = "force-dynamic"

const GO_LIVE_READ = { resource: "go_live", action: "read" }

export default async function CustomerGoLiveRoute({ params }: { params: Promise<{ customerKey: string }> }) {
  const { customerKey } = await params
  const session = await getCurrentNexusSession()

  const customer = await getCustomerByKey(customerKey)
  if (!customer) notFound()

  const [lineItems, canCreate] = await Promise.all([listCurrentLineItemsForCustomer(customer.id), hasPermission("go_live", "create")])

  return (
    <AuthGate session={session} requiredPermission={GO_LIVE_READ} loginRedirectTo={`/customers/${customerKey}/go-live`}>
      <GoLiveListPage customerKey={customerKey} canCreate={canCreate} lineItems={lineItems} />
    </AuthGate>
  )
}
