/**
 * Customer Master domain types: the REAL backend shape only.
 *
 * Matches `customers` exactly as created by
 * `supabase/migrations/20260908013210_master_data_foundation.sql` and
 * confirmed against the live table (`docs/MASTER_DATA_FOUNDATION_DESIGN.md`
 * §5.2). This table is deliberately a minimal stable identity, not a
 * CRM record: it has no country, industry, segment, business unit,
 * contact, or tax field. Anything Customer Master shows beyond
 * id/key/name/isActive/audit columns is demo/read-model enrichment (see
 * ./demo-enrichment.ts), never presented as this type.
 */
type CustomerMasterRecord = {
  id: string
  key: string
  name: string
  isActive: boolean
  rowVersion: number
  createdAt: string
  createdBy: string | null
  updatedAt: string
  updatedBy: string | null
}

export type { CustomerMasterRecord }
