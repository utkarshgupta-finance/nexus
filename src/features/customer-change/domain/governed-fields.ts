/**
 * The fixed, closed set of Customer Master fields a Customer Change
 * Request may ever propose a value for, matching
 * approve_customer_change_request's own hardcoded field list exactly
 * (supabase/migrations/20260913060000_customer_change_request_foundation.sql:
 * "never dynamic SQL against arbitrary field names"). Field KEYS are the
 * governance identity (task spec: "use stable field keys not display
 * labels"); `label` is presentation-only.
 */

type GovernedFieldKey = "name" | "brand_name" | "segment" | "business_unit" | "country" | "industry"

const GOVERNED_FIELDS: { key: GovernedFieldKey; label: string }[] = [
  { key: "name", label: "Legal Entity Name" },
  { key: "brand_name", label: "Brand Name" },
  { key: "segment", label: "Segment" },
  { key: "business_unit", label: "Business Unit" },
  { key: "country", label: "Country" },
  { key: "industry", label: "Industry" },
]

const GOVERNED_FIELD_KEYS: GovernedFieldKey[] = GOVERNED_FIELDS.map((field) => field.key)

function labelForGovernedField(key: string): string {
  return GOVERNED_FIELDS.find((field) => field.key === key)?.label ?? key
}

export { GOVERNED_FIELDS, GOVERNED_FIELD_KEYS, labelForGovernedField }
export type { GovernedFieldKey }
