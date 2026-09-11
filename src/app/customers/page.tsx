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
 * `dynamic = "force-dynamic"` is required, not optional: this route has
 * no dynamic API (no cookies/headers/searchParams) to signal it away
 * from static optimization, so without this export Next.js prerenders
 * it once at BUILD time and serves that frozen result to every request
 * afterward. That is exactly what happened on the first Preview
 * deployment of this feature: the build-time read result (whatever the
 * backend/env state was at that moment) got baked into static HTML, so
 * no later data change, env var fix, or seeded row would ever show up
 * without a fresh deployment. A page that reads live backend data must
 * never be statically prerendered.
 *
 * The read is wrapped: this environment may not have
 * SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY configured (no `.env.local` in
 * a fresh checkout), and a missing credential must show an honest
 * unavailable state, never crash the page.
 */
export const dynamic = "force-dynamic"

export default async function CustomersRoute() {
  let customerMasterEntries: CustomerMasterListEntry[] = []
  let customerMasterUnavailable = false
  try {
    customerMasterEntries = await listCustomerMaster()
  } catch (error) {
    // TEMPORARY diagnostic log, to be removed once the Preview backend
    // read is confirmed working. Logs only the error's own message/name,
    // never any credential value.
    console.error(
      "[customers] listCustomerMaster failed:",
      error instanceof Error ? `${error.name}: ${error.message}` : String(error)
    )
    customerMasterUnavailable = true
  }

  return <CustomersPage customerMasterEntries={customerMasterEntries} customerMasterUnavailable={customerMasterUnavailable} />
}
