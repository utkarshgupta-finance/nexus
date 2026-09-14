"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type FilterSelectOption = { value: string; label: string }

/** Pure, independently testable: the exact computation that closes the "__all__" leak, kept out of the component body so it can be tested without a DOM-rendering harness (this project has none). */
function resolveFilterLabel(value: string, options: FilterSelectOption[], allValue: string, allLabel: string): string {
  if (value === allValue) return allLabel
  return options.find((option) => option.value === value)?.label ?? value
}

/**
 * A "filter by X, or All" select (Platform Operating Expansion, Phase
 * F): the one shared place this shape is built, so the internal
 * "__all__"-style sentinel never again leaks as a visible trigger label
 * on any screen-specific filter bar. Base UI's `SelectValue` resolves
 * its displayed text by looking the current value up against a
 * lazily-populated items registry (populated only once the dropdown has
 * been opened at least once); on first paint, before any interaction,
 * it falls through to rendering the raw value string. Passing an
 * explicit render-function child computes the label directly instead,
 * the same safe pattern `option-select.tsx`/`commercial-rate-section.tsx`
 * already use for governed-field selects.
 */
function FilterSelect({
  value,
  onValueChange,
  options,
  allValue,
  allLabel,
  placeholder,
  className,
}: {
  value: string
  onValueChange: (value: string) => void
  options: FilterSelectOption[]
  allValue: string
  allLabel: string
  placeholder?: string
  className?: string
}) {
  const currentLabel = resolveFilterLabel(value, options, allValue, allLabel)
  return (
    <Select value={value} onValueChange={(next) => onValueChange(String(next))}>
      <SelectTrigger size="sm" className={className}>
        <SelectValue placeholder={placeholder}>{() => currentLabel}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={allValue}>{allLabel}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export { FilterSelect, resolveFilterLabel }
export type { FilterSelectOption }
