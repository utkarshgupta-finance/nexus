import { CustomersPage } from "@/features/customers/ui/customers-page"
import { listCustomerMaster } from "@/features/customers/server"
import type { CustomerMasterListEntry } from "@/features/customers/server"

/**
 * Customer Master reads the real backend (task spec: "Customer Master
 * UI -> customer feature read model/service -> server-side Supabase
 * access -> customers table"). This is safe to call directly from a
 * Server Component today specifically because `customers` currently
 * holds at most one row and it is entirely synthetic demo data (see
 * features/customers/server.ts's header for the full reasoning and the
 * caveat once this table holds a real customer).
 *
 * The read is wrapped: this environment may not have
 * SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY configured (no `.env.local` in
 * a fresh checkout), and a missing credential must show an honest
 * unavailable state, never crash the page.
 */
export default async function CustomersRoute() {
  let customerMasterEntries: CustomerMasterListEntry[] = []
  let customerMasterUnavailable = false
  try {
    customerMasterEntries = await listCustomerMaster()
  } catch {
    customerMasterUnavailable = true
  }

  return <CustomersPage customerMasterEntries={customerMasterEntries} customerMasterUnavailable={customerMasterUnavailable} />
}
