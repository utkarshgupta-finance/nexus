/**
 * Hand-authored row shape for `customers`, matching the applied
 * migration exactly:
 *   supabase/migrations/20260908013210_master_data_foundation.sql
 *
 * Same "no `supabase gen types` output yet" caveat as
 * `src/features/commercial/data/row-types.ts`. Internal to
 * features/customers/data/ only; see domain/types.ts for the shape the
 * rest of the app is allowed to see.
 */
type CustomerRow = {
  id: string
  key: string
  name: string
  is_active: boolean
  row_version: number
  created_at: string
  created_by: string | null
  updated_at: string
  updated_by: string | null
}

export type { CustomerRow }
