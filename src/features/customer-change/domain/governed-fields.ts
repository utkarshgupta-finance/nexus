import { GOVERNED_FIELDS as CUSTOMER_GOVERNED_FIELDS, GOVERNED_FIELD_KEYS as CUSTOMER_GOVERNED_FIELD_KEYS, labelForGovernedField as labelForCustomerGovernedField } from "@/features/customers"
import type { GovernedField as CustomerGovernedField } from "@/features/customers"

/**
 * The fixed, closed set of Customer Master fields a Customer Change
 * Request may ever propose a value for, matching
 * approve_customer_change_request's own hardcoded field list exactly
 * (supabase/migrations/20260913060000_customer_change_request_foundation.sql,
 * 20260916020000_customer_master_governed_fields.sql: "never dynamic SQL
 * against arbitrary field names").
 *
 * Task Phase H: this is no longer its own field list. It re-exports the
 * ONE authoritative Customer Master governed-field registry
 * (src/features/customers/domain/governed-field-registry.ts) so this
 * feature, the Customer Master detail screen, field history labels, and
 * any future consumer all read the same fieldKey/label/editor metadata,
 * never four separate maps.
 */

type GovernedFieldKey = string
type GovernedField = CustomerGovernedField

const GOVERNED_FIELDS: GovernedField[] = CUSTOMER_GOVERNED_FIELDS
const GOVERNED_FIELD_KEYS: GovernedFieldKey[] = CUSTOMER_GOVERNED_FIELD_KEYS

function labelForGovernedField(key: string): string {
  return labelForCustomerGovernedField(key)
}

export { GOVERNED_FIELDS, GOVERNED_FIELD_KEYS, labelForGovernedField }
export type { GovernedFieldKey, GovernedField }
