import { GOVERNED_FIELDS, labelForGovernedField } from "./governed-fields"

/**
 * Current vs Proposed diff for the Customer Change Request review/submit
 * screens (task spec §14-15: "Field/Current/Proposed table, hide
 * unchanged fields by default, allow Show All, use stable field KEYS not
 * display labels as governance identity"). Pure, synchronous, no I/O.
 */

type FieldDiffRow = {
  key: string
  label: string
  current: unknown
  proposed: unknown
  changed: boolean
}

/** `proposedValues` is always sparse (only fields actually being changed); a key absent from it is read as "not part of this change", matching src/platform/workflow/domain/evaluator.ts's own hasChanged semantics exactly. */
function buildFieldDiff(currentValues: Record<string, unknown>, proposedValues: Record<string, unknown>): FieldDiffRow[] {
  return GOVERNED_FIELDS.filter((field) => field.key in proposedValues).map((field) => ({
    key: field.key,
    label: field.label,
    current: currentValues[field.key] ?? null,
    proposed: proposedValues[field.key],
    changed: currentValues[field.key] !== proposedValues[field.key],
  }))
}

export { buildFieldDiff, labelForGovernedField }
export type { FieldDiffRow }
