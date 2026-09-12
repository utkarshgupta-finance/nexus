/**
 * Hand-authored row shapes for `reference_lists`/`reference_options`,
 * matching the applied migration exactly:
 *   supabase/migrations/20260912080000_reference_master_foundation.sql
 *
 * Same "no `supabase gen types` output yet" caveat as
 * `src/features/customers/data/row-types.ts`. Internal to
 * features/reference-data/data/ only; see domain/types.ts for the shape
 * the rest of the app is allowed to see.
 */
type ReferenceListRow = {
  list_key: string
  description: string
  created_at: string
}

type ReferenceOptionRow = {
  id: string
  list_key: string
  code: string
  label: string
  is_active: boolean
  sort_order: number
  inr_conversion_rate: number | null
  cadence_months: number | null
  created_at: string
  created_by: string | null
  updated_at: string
  updated_by: string | null
}

export type { ReferenceListRow, ReferenceOptionRow }
