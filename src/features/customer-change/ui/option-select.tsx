"use client"

import { useMemo } from "react"

import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getActiveOptions, resolveOption } from "@/features/reference-data"
import { useReferenceMasterSnapshot } from "@/features/reference-data/ui/snapshot-context"

/**
 * Same OptionSelect shape as
 * src/features/customer-onboarding/ui/commercial-rate-section.tsx's own
 * (not imported directly: one feature never imports another feature's
 * UI internals, docs/ARCHITECTURE.md). See that file's own comment for
 * why `value` is passed straight through including `null`.
 */

function selectLabel(snapshot: ReturnType<typeof useReferenceMasterSnapshot>, listKey: Parameters<typeof getActiveOptions>[1], value: string | null): string {
  if (!value) return "Select..."
  return resolveOption(snapshot, listKey, value)?.label ?? value
}

function OptionSelect({
  listKey,
  value,
  onChange,
  className,
}: {
  listKey: Parameters<typeof getActiveOptions>[1]
  value: string | null
  onChange: (value: string) => void
  className?: string
}) {
  const snapshot = useReferenceMasterSnapshot()
  const options = useMemo(() => getActiveOptions(snapshot, listKey), [snapshot, listKey])
  return (
    <Select value={value} onValueChange={(next) => onChange(next as string)}>
      <SelectTrigger className={className ?? "w-full"}>
        <SelectValue placeholder="Select...">{() => selectLabel(snapshot, listKey, value)}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

export { OptionSelect, selectLabel }
