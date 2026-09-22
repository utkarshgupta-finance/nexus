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
  listSettlementRecords,
  listSettlementAdjustments,
} from "@/features/entitlement/server"
import { EntitlementDetailPage } from "@/features/entitlement/ui/entitlement-detail-page"
import type { SettlementRecord, SettlementAdjustment } from "@/features/entitlement/server"

type SettlementHistoryEntry = { record: SettlementRecord; adjustments: SettlementAdjustment[] }

async function loadSettlementHistory(
  entries: { id: string }[],
  ledgerEntryType: "unbilled" | "unearned"
): Promise<Record<string, SettlementHistoryEntry[]>> {
  const perEntry = await Promise.all(
    entries.map(async (entry) => {
      const records = await listSettlementRecords(ledgerEntryType, entry.id)
      const withAdjustments = await Promise.all(
        records.map(async (record) => ({ record, adjustments: await listSettlementAdjustments(record.id) }))
      )
      return [entry.id, withAdjustments] as const
    })
  )
  return Object.fromEntries(perEntry)
}

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
const USAGE_READ = { resource: "usage", action: "read" }
const ENTITLEMENT_SETTLEMENT_READ = { resource: "entitlement_settlement", action: "read" }

export default async function EntitlementDetailRoute({ params }: { params: Promise<{ customerKey: string; stableComponentKey: string }> }) {
  const { customerKey, stableComponentKey } = await params
  const session = await getCurrentNexusSession()

  const customer = await getCustomerByKey(customerKey)
  if (!customer) notFound()

  const lineItems = await listCurrentLineItemsForCustomer(customer.id)
  const lineItem = lineItems.find((item) => item.stableComponentKey === stableComponentKey)
  if (!lineItem) notFound()

  const [
    sources,
    scheduleMonths,
    usageRows,
    ledgerRows,
    unbilledEntries,
    unearnedEntries,
    canReadEntitlement,
    canReadUsage,
    canReadSettlement,
    canWriteEntitlement,
    canWriteUsage,
    canFinalizeUsage,
    canSettle,
  ] = await Promise.all([
    listEntitlementSourcesForComponent(stableComponentKey),
    listScheduleMonthsForComponent(stableComponentKey),
    listMonthlyUsageForComponent(stableComponentKey),
    listLedgerRowsForComponent(stableComponentKey),
    listUnbilledEntriesForComponent(stableComponentKey),
    listUnearnedEntriesForComponent(stableComponentKey),
    hasPermission("entitlement", "read"),
    hasPermission("usage", "read"),
    hasPermission("entitlement_settlement", "read"),
    hasPermission("entitlement", "write"),
    hasPermission("usage", "write"),
    hasPermission("usage", "finalize"),
    hasPermission("entitlement_settlement", "write"),
  ])

  const canReadAnySettlement = canReadEntitlement || canReadSettlement
  const [unbilledSettlementHistory, unearnedSettlementHistory] = canReadAnySettlement
    ? await Promise.all([loadSettlementHistory(unbilledEntries, "unbilled"), loadSettlementHistory(unearnedEntries, "unearned")])
    : [{}, {}]

  return (
    <AuthGate
      session={session}
      requiredPermission={[ENTITLEMENT_READ, USAGE_READ, ENTITLEMENT_SETTLEMENT_READ]}
      loginRedirectTo={`/customers/${customerKey}/entitlement/${stableComponentKey}`}
    >
      <EntitlementDetailPage
        customerKey={customerKey}
        lineItem={lineItem}
        sources={sources}
        scheduleMonths={scheduleMonths}
        usageRows={usageRows}
        ledgerRows={ledgerRows}
        unbilledEntries={unbilledEntries}
        unearnedEntries={unearnedEntries}
        unbilledSettlementHistory={unbilledSettlementHistory}
        unearnedSettlementHistory={unearnedSettlementHistory}
        canViewEntitlement={canReadEntitlement}
        canViewUsage={canReadEntitlement || canReadUsage}
        canViewSettlement={canReadEntitlement || canReadSettlement}
        canWriteEntitlement={canWriteEntitlement}
        canWriteUsage={canWriteUsage}
        canFinalizeUsage={canFinalizeUsage}
        canSettle={canSettle}
      />
    </AuthGate>
  )
}
