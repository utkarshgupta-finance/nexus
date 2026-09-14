import { notFound } from "next/navigation"

import { AuthGate } from "@/components/product/auth-gate"
import { getCurrentNexusSession } from "@/platform/auth/server"
import { hasPermission } from "@/platform/permissions/server"
import { getCustomerByKey } from "@/features/customers/server"
import { listCurrentLineItemsForCustomer } from "@/features/go-live/server"
import {
  listEntitlementSourcesForComponent,
  listScheduleMonthsForComponent,
  listMonthlyUsageForComponent,
  listLedgerRowsForComponent,
  listUnbilledEntriesForComponent,
  listUnearnedEntriesForComponent,
} from "@/features/entitlement/server"
import { EntitlementDetailPage } from "@/features/entitlement/ui/entitlement-detail-page"

/**
 * Customer -> Entitlement & Usage detail (Go Live + Entitlement Ledger,
 * Phases G-N). One recurring line item shows its full Entitlement Source
 * / Monthly Schedule / Monthly Usage / Ledger / Unbilled / Unearned
 * picture; an on-demand line item shows only Monthly Usage (no
 * entitlement pool exists for it, so every unit of usage lands directly
 * in Unbilled, which is the correct outcome of the same math with zero
 * entitlement, not a special case). `dynamic = "force-dynamic"` matches
 * every other route reading live backend data in this app.
 */
export const dynamic = "force-dynamic"

const ENTITLEMENT_READ = { resource: "entitlement", action: "read" }

export default async function EntitlementDetailRoute({ params }: { params: Promise<{ customerKey: string; stableComponentKey: string }> }) {
  const { customerKey, stableComponentKey } = await params
  const session = await getCurrentNexusSession()

  const customer = await getCustomerByKey(customerKey)
  if (!customer) notFound()

  const lineItems = await listCurrentLineItemsForCustomer(customer.id)
  const lineItem = lineItems.find((item) => item.stableComponentKey === stableComponentKey)
  if (!lineItem) notFound()

  const [sources, scheduleMonths, usageRows, ledgerRows, unbilledEntries, unearnedEntries, canWriteEntitlement, canWriteUsage, canFinalizeUsage, canSettle] =
    await Promise.all([
      listEntitlementSourcesForComponent(stableComponentKey),
      listScheduleMonthsForComponent(stableComponentKey),
      listMonthlyUsageForComponent(stableComponentKey),
      listLedgerRowsForComponent(stableComponentKey),
      listUnbilledEntriesForComponent(stableComponentKey),
      listUnearnedEntriesForComponent(stableComponentKey),
      hasPermission("entitlement", "write"),
      hasPermission("usage", "write"),
      hasPermission("usage", "finalize"),
      hasPermission("entitlement_settlement", "write"),
    ])

  return (
    <AuthGate session={session} requiredPermission={ENTITLEMENT_READ} loginRedirectTo={`/customers/${customerKey}/entitlement/${stableComponentKey}`}>
      <EntitlementDetailPage
        customerKey={customerKey}
        lineItem={lineItem}
        sources={sources}
        scheduleMonths={scheduleMonths}
        usageRows={usageRows}
        ledgerRows={ledgerRows}
        unbilledEntries={unbilledEntries}
        unearnedEntries={unearnedEntries}
        canWriteEntitlement={canWriteEntitlement}
        canWriteUsage={canWriteUsage}
        canFinalizeUsage={canFinalizeUsage}
        canSettle={canSettle}
      />
    </AuthGate>
  )
}
