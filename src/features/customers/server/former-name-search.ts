import "server-only"

import { searchFormerCustomerNames } from "@/features/customer-change/server"
import { getCustomerById } from "../data/customers.data"
import { toCustomerMasterListEntry } from "../read-models/customer-master-mapping"
import type { CustomerMasterListEntry } from "../read-models/customer-master-mapping"

/**
 * Customer Search's former-name resolution (task Phase B): a search term
 * that does not match any customer's CURRENT name/brand/key may still
 * match a name it used to carry, recorded permanently in
 * `customer_field_history` by the Customer Change Request lifecycle
 * (docs/CUSTOMER_LIFECYCLE.md §3a/§10). This never invents a second
 * alias architecture: it reads the same field history the History tab
 * already renders.
 */

type FormerNameSearchResult = { entry: CustomerMasterListEntry; fieldKey: string; oldValue: string }

async function findCustomersByFormerName(term: string): Promise<FormerNameSearchResult[]> {
  const matches = await searchFormerCustomerNames(term)
  const resolved = await Promise.all(
    matches.map(async (match) => {
      const row = await getCustomerById(match.customerId)
      if (!row) return null
      return { entry: toCustomerMasterListEntry(row), fieldKey: match.fieldKey, oldValue: match.oldValue }
    })
  )
  return resolved.filter((result): result is FormerNameSearchResult => result !== null)
}

export { findCustomersByFormerName }
export type { FormerNameSearchResult }
