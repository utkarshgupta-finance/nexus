"use client"

import { Input } from "@/components/ui/input"
import { OptionSelect } from "./option-select"
import { GOVERNED_FIELDS } from "../domain/governed-fields"
import type { GovernedFieldKey } from "../domain/governed-fields"

/**
 * Editable form for the six governed Customer Master fields a Change
 * Request may propose (task spec: "user edits only proposed values").
 * `values` is always initialized from the customer's real current
 * values (see ui/change-request-page.tsx), so every field the requester
 * does not touch stays identical to today's Customer Master, and
 * approve_customer_change_request's own equality check already treats an
 * untouched field as a no-op (no history row, no write).
 */

const SELECT_FIELD_KEYS = new Set<GovernedFieldKey>(["segment", "business_unit", "country", "industry"])

function GovernedFieldsForm({ values, onChange }: { values: Record<string, string | null>; onChange: (key: GovernedFieldKey, value: string) => void }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {GOVERNED_FIELDS.map((field) => (
        <div key={field.key} className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-foreground" htmlFor={`governed-field-${field.key}`}>
            {field.label}
          </label>
          {SELECT_FIELD_KEYS.has(field.key) ? (
            <OptionSelect
              listKey={field.key as "segment" | "business_unit" | "country" | "industry"}
              value={values[field.key] ?? null}
              onChange={(value) => onChange(field.key, value)}
            />
          ) : (
            <Input
              id={`governed-field-${field.key}`}
              value={values[field.key] ?? ""}
              onChange={(event) => onChange(field.key, event.target.value)}
            />
          )}
        </div>
      ))}
    </div>
  )
}

export { GovernedFieldsForm }
