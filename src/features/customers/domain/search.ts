import { resolveBrandName, resolveBusinessUnitCode, resolveCountryCode, resolveSegmentCode } from "./display-fields"
import type { CustomerMasterListEntry } from "../read-models/customer-master-mapping"

/**
 * Pure Customer Master filtering (Customer Search, task Phase B): no
 * fuzzy matching, no ranking, just plain substring/exact-code matches
 * over whatever the Customers page already fetched. The dataset this
 * runs against is Nexus's own governed customer base, not a
 * general-purpose search index, so a simple in-memory filter is the
 * right amount of engineering (docs/ARCHITECTURE.md's Scale-ready, not
 * scale-heavy principle).
 */

type CustomerStatusFilter = "all" | "active" | "inactive"

type CustomerSearchFilters = {
  query: string
  segment: string | null
  businessUnit: string | null
  country: string | null
  status: CustomerStatusFilter
}

const EMPTY_FILTERS: CustomerSearchFilters = { query: "", segment: null, businessUnit: null, country: null, status: "all" }

function matchesQuery(entry: CustomerMasterListEntry, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const brand = resolveBrandName(entry.record, entry.enrichment)
  return (
    entry.record.name.toLowerCase().includes(q) ||
    entry.record.key.toLowerCase().includes(q) ||
    (brand?.toLowerCase().includes(q) ?? false)
  )
}

function filterCustomerMasterEntries(entries: CustomerMasterListEntry[], filters: CustomerSearchFilters): CustomerMasterListEntry[] {
  return entries.filter((entry) => {
    if (filters.status === "active" && !entry.record.isActive) return false
    if (filters.status === "inactive" && entry.record.isActive) return false
    if (filters.segment && resolveSegmentCode(entry.record, entry.enrichment) !== filters.segment) return false
    if (filters.businessUnit && resolveBusinessUnitCode(entry.record, entry.enrichment) !== filters.businessUnit) return false
    if (filters.country && resolveCountryCode(entry.record, entry.enrichment) !== filters.country) return false
    return matchesQuery(entry, filters.query)
  })
}

export { filterCustomerMasterEntries, EMPTY_FILTERS }
export type { CustomerSearchFilters, CustomerStatusFilter }
