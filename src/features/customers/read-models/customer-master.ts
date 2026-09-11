import { getCustomerByKey, listCustomers } from "../data/customers.data"
import { toCustomerMasterDetail, toCustomerMasterListEntry } from "./customer-master-mapping"
import type { CustomerMasterDetail, CustomerMasterListEntry } from "./customer-master-mapping"

/**
 * Customer Master read models: the I/O layer only. Pure composition
 * (merging the real backend record with demo enrichment) lives in
 * ./customer-master-mapping.ts so it stays unit-testable without
 * Supabase; see that file's header for why.
 */

async function listCustomerMaster(): Promise<CustomerMasterListEntry[]> {
  const rows = await listCustomers()
  return rows.map(toCustomerMasterListEntry)
}

async function getCustomerMasterDetailByKey(key: string): Promise<CustomerMasterDetail | null> {
  const row = await getCustomerByKey(key)
  return row ? toCustomerMasterDetail(row) : null
}

export { listCustomerMaster, getCustomerMasterDetailByKey }
export type { CustomerMasterListEntry, CustomerMasterDetail }
