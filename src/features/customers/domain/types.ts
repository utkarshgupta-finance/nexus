/**
 * Customer Master domain types: the REAL backend shape only.
 *
 * Matches `customers` exactly as created by
 * `supabase/migrations/20260908013210_master_data_foundation.sql` and
 * extended by
 * `supabase/migrations/20260913060000_customer_change_request_foundation.sql`,
 * which added segment/businessUnit/country/industry/brandName as real,
 * governed columns (changed only via an approved Customer Change
 * Request, see src/features/customer-change/). Contact and tax fields
 * still have no real column; anything beyond this type is demo/read-model
 * enrichment (see ./demo-enrichment.ts), never presented as backend truth.
 */
type CustomerMasterRecord = {
  id: string
  key: string
  name: string
  segment: string | null
  businessUnit: string | null
  country: string | null
  industry: string | null
  brandName: string | null
  isActive: boolean
  rowVersion: number
  createdAt: string
  createdBy: string | null
  updatedAt: string
  updatedBy: string | null
}

export type { CustomerMasterRecord }
