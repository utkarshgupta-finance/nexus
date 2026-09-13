/** Hand-authored row shape matching supabase/migrations/20260913080000_permanent_customer_deletion.sql exactly. */
type CustomerDeletionAuditRow = {
  id: string
  customer_id: string
  customer_key: string
  customer_name: string
  segment: string | null
  business_unit: string | null
  country: string | null
  industry: string | null
  brand_name: string | null
  was_active: boolean
  reason: string
  deleted_by: string | null
  deleted_at: string
}

export type { CustomerDeletionAuditRow }
