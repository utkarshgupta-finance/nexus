import { AuthGate } from "@/components/product/auth-gate"
import { getCurrentNexusSession } from "@/platform/auth/server"
import { CustomersPage } from "@/features/customers/ui/customers-page"
import { listCustomerMaster, findCustomersByFormerName, filterCustomerMasterEntries, EMPTY_FILTERS } from "@/features/customers/server"
import type { CustomerMasterListEntry, FormerNameSearchResult, CustomerSearchFilters, CustomerStatusFilter } from "@/features/customers/server"
import { emptySnapshot, loadReferenceMasterSnapshot } from "@/features/reference-data/server"
import type { ReferenceMasterSnapshot } from "@/features/reference-data"

/**
 * Customer Master reads the real backend (task spec: "Customer Master
 * UI -> customer feature read model/service -> server-side Supabase
 * access -> customers table"). See features/customers/server.ts's header
 * for the current Customer Master/demo-enrichment split.
 *
 * `dynamic = "force-dynamic"` is required: this route reads `searchParams`
 * (Customer Search, task Phase B) and live backend data, so it must never
 * be statically prerendered (a build-time read baked into static HTML
 * caused the original "Session unavailable" incident this codebase has
 * already fixed once for this exact reason).
 *
 * The read is wrapped: this environment may not have
 * SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY configured (no `.env.local` in
 * a fresh checkout), and a missing credential must show an honest
 * unavailable state, never crash the page.
 */
export const dynamic = "force-dynamic"

const CUSTOMER_READ = { resource: "customer", action: "read" }

function toFilters(searchParams: Record<string, string | string[] | undefined>): CustomerSearchFilters {
  const get = (key: string): string => {
    const raw = searchParams[key]
    return (Array.isArray(raw) ? raw[0] : raw) ?? ""
  }
  const status = get("status")
  return {
    query: get("q"),
    segment: get("segment") || null,
    businessUnit: get("businessUnit") || null,
    country: get("country") || null,
    status: (status === "active" || status === "inactive" ? status : "all") as CustomerStatusFilter,
  }
}

export default async function CustomersRoute({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await getCurrentNexusSession()
  const resolvedSearchParams = await searchParams
  const filters = toFilters(resolvedSearchParams)
  const hasActiveFilters = JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS)

  const queryString = new URLSearchParams(
    Object.entries(resolvedSearchParams).flatMap(([key, value]) =>
      value === undefined ? [] : (Array.isArray(value) ? value : [value]).map((v) => [key, v] as [string, string])
    )
  ).toString()
  const loginRedirectTo = queryString ? `/customers?${queryString}` : "/customers"

  let allEntries: CustomerMasterListEntry[] = []
  let customerMasterUnavailable = false
  try {
    allEntries = await listCustomerMaster()
  } catch {
    customerMasterUnavailable = true
  }

  const customerMasterEntries = filterCustomerMasterEntries(allEntries, filters)

  let formerNameMatches: FormerNameSearchResult[] = []
  if (!customerMasterUnavailable && filters.query.trim()) {
    try {
      const shownIds = new Set(customerMasterEntries.map((entry) => entry.record.id))
      const rawMatches = await findCustomersByFormerName(filters.query)
      formerNameMatches = filterCustomerMasterEntries(
        rawMatches.map((match) => match.entry),
        { ...filters, query: "" }
      )
        .filter((entry) => !shownIds.has(entry.record.id))
        .map((entry) => rawMatches.find((match) => match.entry.record.id === entry.record.id))
        .filter((match): match is FormerNameSearchResult => match !== undefined)
    } catch {
      formerNameMatches = []
    }
  }

  let snapshot: ReferenceMasterSnapshot
  try {
    snapshot = await loadReferenceMasterSnapshot()
  } catch {
    snapshot = emptySnapshot()
  }

  return (
    <AuthGate session={session} requiredPermission={CUSTOMER_READ} loginRedirectTo={loginRedirectTo}>
      <CustomersPage
        customerMasterEntries={customerMasterEntries}
        customerMasterUnavailable={customerMasterUnavailable}
        snapshot={snapshot}
        formerNameMatches={formerNameMatches}
        hasActiveFilters={hasActiveFilters}
      />
    </AuthGate>
  )
}
