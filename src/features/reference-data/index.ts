/**
 * Public surface of the Reference Master feature. `./domain/service.ts`
 * is pure and synchronous: every function takes a `ReferenceMasterSnapshot`
 * as an explicit parameter, so it works identically whether that
 * snapshot came from a test fixture or (in production) from
 * `./server.ts`'s `loadReferenceMasterSnapshot`, which is the real,
 * database-backed read path (supabase/migrations/
 * 20260912080000_reference_master_foundation.sql). `./server.ts` itself
 * is never re-exported from here: it is `server-only` and imported
 * directly by the Server Components/Server Actions that need it,
 * matching the same split already established by
 * `src/features/commercial/server.ts` and `src/features/customers/server.ts`.
 */

export type { ReferenceListKey, ReferenceOption, ReferenceMasterSnapshot } from "./domain/types"
export { getActiveOptions, getAllOptions, resolveOption, getInrConversionRate, getInvoiceFrequencyCadence } from "./domain/service"
export { isValidIsoCurrencyCode } from "./domain/currency-codes"
