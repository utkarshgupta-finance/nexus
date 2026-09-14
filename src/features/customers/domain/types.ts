/**
 * Customer Master domain types: the REAL backend shape only.
 *
 * Matches `customers` exactly as created by
 * `supabase/migrations/20260908013210_master_data_foundation.sql` and
 * extended by
 * `supabase/migrations/20260913060000_customer_change_request_foundation.sql`
 * (segment/businessUnit/country/industry/brandName) and
 * `supabase/migrations/20260916020000_customer_master_governed_fields.sql`
 * (address/contact/tax/billing currency, task Phase H): changed only via
 * an approved Customer Change Request or Onboarding Approval, never
 * directly (src/features/customer-change/,
 * src/features/customer-onboarding/). Anything beyond this type is
 * demo/read-model enrichment (see ./demo-enrichment.ts), used only as a
 * fallback for the one legacy fixture customer that predates this
 * schema, never presented as backend truth for a real customer.
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
  address: string | null
  state: string | null
  city: string | null
  postalCode: string | null
  website: string | null
  primaryContactName: string | null
  primaryContactEmail: string | null
  primaryContactPhoneCountryCode: string | null
  primaryContactPhoneNumber: string | null
  primaryContactDesignation: string | null
  gstNumber: string | null
  pan: string | null
  tan: string | null
  taxIdentifierType: string | null
  taxIdentifierName: string | null
  taxRegistrationNumber: string | null
  companyDocumentType: string | null
  companyDocumentTypeOther: string | null
  billingCurrency: string | null
  isActive: boolean
  rowVersion: number
  createdAt: string
  createdBy: string | null
  updatedAt: string
  updatedBy: string | null
}

export type { CustomerMasterRecord }
