/**
 * Public, client-safe surface of the Customers feature: types and pure
 * fixture/demo data only. Safe to import from a Client Component.
 * Server-only reads (Supabase, service_role) live in ./server.ts
 * instead, deliberately not re-exported here, matching
 * src/features/commercial/index.ts's identical split.
 */

export type { CustomerMasterRecord } from "./domain/types"
export { DEMO_CUSTOMER_KEY, DEMO_CUSTOMER_ENRICHMENT } from "./domain/demo-enrichment"
export type { DemoCustomerEnrichment } from "./domain/demo-enrichment"
export { DEMO_DOCUMENTS, DEMO_CUSTOMER_NAME } from "./domain/demo-documents"
export type { DemoDocumentType, DemoDocumentDefinition } from "./domain/demo-documents"
