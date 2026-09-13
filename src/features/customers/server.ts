import "server-only"

/**
 * TRUSTED, SERVER-ONLY Customer Master entry point. Same `server-only`
 * double guard as src/features/commercial/server.ts (also enforced by
 * src/lib/supabase/server-client.ts itself): every function reachable
 * from here authenticates as service_role, so the calling route is
 * responsible for its own AuthGate/`customer.read` check before
 * rendering what these return (docs/AUTHORIZATION_MODEL.md, now
 * IMPLEMENTED via `platform/auth` and `platform/permissions`).
 *
 * `customers` now holds real, governed customer rows created through
 * Customer Onboarding approval (docs/CUSTOMER_LIFECYCLE.md), alongside
 * exactly one legacy fixture row (`domain/demo-enrichment.ts`'s
 * `DEMO_CUSTOMER_KEY`) still used to illustrate fields the schema does
 * not persist yet (state/city, GSTIN/PAN/TAN detail, billing currency).
 * `read-models/customer-master-mapping.ts` only attaches that
 * enrichment to the one demo key; every other customer renders from
 * real columns alone, with no fabricated data.
 */

export { listCustomerMaster, getCustomerMasterDetailByKey } from "./read-models/customer-master"
export type { CustomerMasterListEntry, CustomerMasterDetail } from "./read-models/customer-master"
export { insertCustomer, getCustomerByKey, getCustomerById, setCustomerActive } from "./data/customers.data"
export type { InsertCustomerInput } from "./data/customers.data"
export { getCustomerDeletionEligibility } from "./server/deletion"
export { findCustomersByFormerName } from "./server/former-name-search"
export type { FormerNameSearchResult } from "./server/former-name-search"
export { filterCustomerMasterEntries, EMPTY_FILTERS } from "./domain/search"
export type { CustomerSearchFilters, CustomerStatusFilter } from "./domain/search"
