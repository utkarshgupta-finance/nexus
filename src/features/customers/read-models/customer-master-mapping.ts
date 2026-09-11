import { toCustomerMasterRecord } from "../domain/mappers"
import { DEMO_CUSTOMER_ENRICHMENT, DEMO_CUSTOMER_KEY } from "../domain/demo-enrichment"
import { DEMO_DOCUMENTS } from "../domain/demo-documents"
import type { CustomerRow } from "../data/row-types"
import type { CustomerMasterRecord } from "../domain/types"
import type { DemoCustomerEnrichment } from "../domain/demo-enrichment"
import type { DemoDocumentDefinition } from "../domain/demo-documents"

/**
 * Pure composition only: no Supabase import, so this module (unlike
 * ./customer-master.ts) never touches the `server-only` guard and stays
 * directly unit-testable in a plain Vitest environment, the same split
 * src/features/commercial/read-models/configuration-overview-helpers.ts
 * already established for the identical reason.
 */

type CustomerMasterListEntry = {
  record: CustomerMasterRecord
  enrichment: DemoCustomerEnrichment | null
}

type CustomerMasterDetail = {
  record: CustomerMasterRecord
  enrichment: DemoCustomerEnrichment | null
  documents: DemoDocumentDefinition[]
}

function enrichmentForKey(key: string): DemoCustomerEnrichment | null {
  return key === DEMO_CUSTOMER_KEY ? DEMO_CUSTOMER_ENRICHMENT : null
}

function toCustomerMasterListEntry(row: CustomerRow): CustomerMasterListEntry {
  const record = toCustomerMasterRecord(row)
  return { record, enrichment: enrichmentForKey(record.key) }
}

function toCustomerMasterDetail(row: CustomerRow): CustomerMasterDetail {
  const record = toCustomerMasterRecord(row)
  const enrichment = enrichmentForKey(record.key)
  return { record, enrichment, documents: enrichment ? DEMO_DOCUMENTS : [] }
}

export { toCustomerMasterListEntry, toCustomerMasterDetail }
export type { CustomerMasterListEntry, CustomerMasterDetail }
