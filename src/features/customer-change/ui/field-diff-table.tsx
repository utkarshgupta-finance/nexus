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
 * whether this Change Request touches it. Resolves a Reference Master
 * code to its real display label when the field's own registry entry
 * says it is one (task Phase H: driven by each field's `editor`
 * metadata, never a second locally-guessed list of "which fields are
 * codes"); every other field renders as-is.
 */

const REFERENCE_SELECT_LIST_KEYS = new Map<string, Parameters<typeof getActiveOptions>[1]>(
  GOVERNED_FIELDS.filter((field) => field.editor.kind === "reference_select").map((field) => [
    field.key,
    (field.editor as Extract<typeof field.editor, { kind: "reference_select" }>).listKey,
  ])
)

function FieldDiffTable({ currentValues, proposedValues }: { currentValues: Record<string, unknown>; proposedValues: Record<string, unknown> }) {
  const snapshot = useReferenceMasterSnapshot()
  const [showAll, setShowAll] = useState(false)
  const rows = useMemo(() => buildFieldDiff(currentValues, proposedValues), [currentValues, proposedValues])
  const visibleRows = showAll ? rows : rows.filter((row) => row.changed)

  function displayValue(key: string, value: unknown): string {
    if (value === null || value === undefined || value === "") return "-"
    const listKey = REFERENCE_SELECT_LIST_KEYS.get(key)
    if (listKey) {
      return resolveOption(snapshot, listKey, String(value))?.label ?? String(value)
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
