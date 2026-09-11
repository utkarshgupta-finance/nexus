import "server-only"

/**
 * TRUSTED, SERVER-ONLY Customer Master entry point. Same `server-only`
 * double guard as src/features/commercial/server.ts (also enforced by
 * src/lib/supabase/server-client.ts itself); same trust boundary
 * caveat: every function reachable from here authenticates as
 * service_role, and Nexus has no per-user authorization boundary yet
 * (docs/AUTHORIZATION_MODEL.md, locked design, not implemented). See
 * that file's own header for the full "fine to call from / not fine to
 * wire to" reasoning; it applies here unchanged for any FUTURE real
 * customer this table eventually holds.
 *
 * This task's one difference: the customer this module currently
 * returns is entirely synthetic demo data, clearly labeled `source:
 * "demo"` on every enrichment field (domain/demo-enrichment.ts). Reading
 * it from a Server Component that is not parameterized by an arbitrary
 * browser-supplied id is safe today specifically because there is
 * nothing privileged behind it yet, not because the general trust
 * boundary problem has been solved. The moment this table holds a real
 * customer, the same authorization gap `commercial/server.ts` already
 * documents applies here too, and must be closed before a real
 * customer's data is read through this path.
 */

export { listCustomerMaster, getCustomerMasterDetailByKey } from "./read-models/customer-master"
export type { CustomerMasterListEntry, CustomerMasterDetail } from "./read-models/customer-master"
export { insertCustomer, getCustomerByKey } from "./data/customers.data"
export type { InsertCustomerInput } from "./data/customers.data"
