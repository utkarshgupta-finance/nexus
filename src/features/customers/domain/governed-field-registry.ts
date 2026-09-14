import type { ReferenceListKey } from "@/features/reference-data"

/**
 * The ONE authoritative registry of every Customer Master field that may
 * ever be governed (proposed via a Customer Change Request, shown on a
 * Current vs Proposed diff, labeled in field history, or referenced by a
 * future workflow rule or API DTO): task Phase H, "reuse this registry
 * everywhere, do not create four separate field maps."
 *
 * Every key here is a real `customers` column
 * (supabase/migrations/20260908013210_master_data_foundation.sql,
 * 20260913060000_customer_change_request_foundation.sql,
 * 20260916020000_customer_master_governed_fields.sql). Excluded,
 * deliberately: `id`/`key` (stable identity, never a proposed value),
 * `is_active` (a lifecycle action, not a field edit), `row_version` and
 * every `created_*`/`updated_*` column (audit/concurrency metadata, not
 * business data).
 *
 * `approve_customer_change_request`'s own field loop
 * (supabase/migrations/20260913060000_customer_change_request_foundation.sql)
 * must list the exact same field keys as this registry's `key`s: that SQL
 * loop is the only place actually allowed to write to `customers`, so it
 * is the enforcement boundary this registry describes, not a second
 * source of truth for which fields exist.
 */

type GovernedFieldEditor =
  | { kind: "text" }
  | { kind: "reference_select"; listKey: ReferenceListKey }

type GovernedField = {
  key: string
  label: string
  editor: GovernedFieldEditor
}

const GOVERNED_FIELDS: GovernedField[] = [
  { key: "name", label: "Legal Entity Name", editor: { kind: "text" } },
  { key: "brand_name", label: "Brand Name", editor: { kind: "text" } },
  { key: "segment", label: "Segment", editor: { kind: "reference_select", listKey: "segment" } },
  { key: "business_unit", label: "Business Unit", editor: { kind: "reference_select", listKey: "business_unit" } },
  { key: "country", label: "Country", editor: { kind: "reference_select", listKey: "country" } },
  { key: "industry", label: "Industry", editor: { kind: "reference_select", listKey: "industry" } },
  { key: "address", label: "Address", editor: { kind: "text" } },
  { key: "state", label: "State", editor: { kind: "text" } },
  { key: "city", label: "City", editor: { kind: "text" } },
  { key: "postal_code", label: "Postal Code", editor: { kind: "text" } },
  { key: "website", label: "Website", editor: { kind: "text" } },
  { key: "primary_contact_name", label: "Primary Contact Name", editor: { kind: "text" } },
  { key: "primary_contact_email", label: "Primary Contact Email", editor: { kind: "text" } },
  { key: "primary_contact_phone_country_code", label: "Primary Contact Phone Country Code", editor: { kind: "reference_select", listKey: "phone_country_code" } },
  { key: "primary_contact_phone_number", label: "Primary Contact Phone Number", editor: { kind: "text" } },
  { key: "primary_contact_designation", label: "Primary Contact Designation", editor: { kind: "text" } },
  { key: "gst_number", label: "GST Number", editor: { kind: "text" } },
  { key: "pan", label: "PAN", editor: { kind: "text" } },
  { key: "tan", label: "TAN", editor: { kind: "text" } },
  { key: "tax_identifier_type", label: "Tax Identifier Type", editor: { kind: "reference_select", listKey: "tax_identifier_type" } },
  { key: "tax_identifier_name", label: "Tax Identifier Name", editor: { kind: "text" } },
  { key: "tax_registration_number", label: "Tax Registration Number", editor: { kind: "text" } },
  { key: "company_document_type", label: "Company Document Type", editor: { kind: "text" } },
  { key: "company_document_type_other", label: "Company Document Type Name", editor: { kind: "text" } },
  { key: "billing_currency", label: "Billing Currency", editor: { kind: "reference_select", listKey: "currency" } },
]

const GOVERNED_FIELD_KEYS: string[] = GOVERNED_FIELDS.map((field) => field.key)

function labelForGovernedField(key: string): string {
  return GOVERNED_FIELDS.find((field) => field.key === key)?.label ?? key
}

function governedFieldByKey(key: string): GovernedField | undefined {
  return GOVERNED_FIELDS.find((field) => field.key === key)
}

export { GOVERNED_FIELDS, GOVERNED_FIELD_KEYS, labelForGovernedField, governedFieldByKey }
export type { GovernedField, GovernedFieldEditor }
