/**
 * Public, client-safe surface of the Customer Change Request feature:
 * types and pure domain functions only. Server-only reads/mutations live
 * in ./server.ts / ./actions.ts instead, matching
 * src/features/customer-onboarding/index.ts's identical split.
 */

export type { CustomerChangeRequestStatus, CustomerChangeRequirement, CustomerChangeRequest, CustomerFieldHistoryEntry } from "./domain/types"
export { formatChangeRequestId } from "./domain/types"
export { GOVERNED_FIELDS, GOVERNED_FIELD_KEYS, labelForGovernedField } from "./domain/governed-fields"
export type { GovernedFieldKey } from "./domain/governed-fields"
export { buildFieldDiff } from "./domain/diff"
export type { FieldDiffRow } from "./domain/diff"
export { CUSTOMER_CHANGE_WORKFLOW_RULES, evaluateCustomerChangeRequirements } from "./domain/workflow-rules"
