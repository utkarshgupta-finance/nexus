"use client"

import { useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getActiveOptions, resolveOption } from "@/features/reference-data"
import { useReferenceMasterSnapshot } from "@/features/reference-data/ui/snapshot-context"
import { buildFieldDiff } from "../domain/diff"
import { GOVERNED_FIELDS } from "../domain/governed-fields"

/**
 * Current vs Proposed table (task spec §14-15): hides unchanged fields
 * by default, "Show All" reveals every governed field regardless of
 * whether this Change Request touches it. Resolves Reference Master
 * codes (segment/business_unit/country/industry) to their real display
 * label when one exists, falling back to the raw code otherwise; Legal
 * Entity Name and Brand Name have no Reference Master list, so they
 * render as-is.
 */

const REFERENCE_LIST_FIELD_KEYS = new Set<string>(GOVERNED_FIELDS.filter((field) => field.key !== "name" && field.key !== "brand_name").map((field) => field.key))

function FieldDiffTable({ currentValues, proposedValues }: { currentValues: Record<string, unknown>; proposedValues: Record<string, unknown> }) {
  const snapshot = useReferenceMasterSnapshot()
  const [showAll, setShowAll] = useState(false)
  const rows = useMemo(() => buildFieldDiff(currentValues, proposedValues), [currentValues, proposedValues])
  const visibleRows = showAll ? rows : rows.filter((row) => row.changed)

  function displayValue(key: string, value: unknown): string {
    if (value === null || value === undefined || value === "") return "-"
    if (REFERENCE_LIST_FIELD_KEYS.has(key)) {
      return resolveOption(snapshot, key as Parameters<typeof getActiveOptions>[1], String(value))?.label ?? String(value)
    }
    return String(value)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {rows.filter((row) => row.changed).length} of {rows.length} governed field{rows.length === 1 ? "" : "s"} changed
        </span>
        <Button variant="outline" size="sm" onClick={() => setShowAll((value) => !value)}>
          {showAll ? "Hide Unchanged" : "Show All"}
        </Button>
      </div>
      {visibleRows.length === 0 ? (
        <p className="text-xs text-muted-foreground">No fields are proposed to change yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Field</TableHead>
                <TableHead>Current</TableHead>
                <TableHead>Proposed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleRows.map((row) => (
                <TableRow key={row.key}>
                  <TableCell className="font-medium text-foreground">{row.label}</TableCell>
                  <TableCell className="whitespace-normal text-muted-foreground">{displayValue(row.key, row.current)}</TableCell>
                  <TableCell className={row.changed ? "whitespace-normal font-medium text-foreground" : "whitespace-normal text-muted-foreground"}>
                    {displayValue(row.key, row.proposed)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

export { FieldDiffTable }
