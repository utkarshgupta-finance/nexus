/**
 * Hand-authored row shape for `customers`, matching the applied
 * migration exactly:
 *   supabase/migrations/20260908013210_master_data_foundation.sql
 *   supabase/migrations/20260913060000_customer_change_request_foundation.sql
 *     (segment/business_unit/country/industry/brand_name)
 *   supabase/migrations/20260916020000_customer_master_governed_fields.sql
 *     (address/contact/tax/billing currency, task Phase H)
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
  segment: string | null
  business_unit: string | null
  country: string | null
  industry: string | null
  brand_name: string | null
  address: string | null
  state: string | null
  city: string | null
  postal_code: string | null
  website: string | null
  primary_contact_name: string | null
  primary_contact_email: string | null
  primary_contact_phone_country_code: string | null
  primary_contact_phone_number: string | null
  primary_contact_designation: string | null
  gst_number: string | null
  pan: string | null
  tan: string | null
  tax_identifier_type: string | null
  tax_identifier_name: string | null
  tax_registration_number: string | null
  company_document_type: string | null
  company_document_type_other: string | null
  billing_currency: string | null
  is_active: boolean
  row_version: number
  created_at: string
  created_by: string | null
  updated_at: string
  updated_by: string | null
}

export type { CustomerRow }
