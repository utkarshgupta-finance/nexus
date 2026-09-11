"use client"

import { useState } from "react"
import { CheckCircle2Icon, CircleSlashIcon, PlusIcon, SearchIcon } from "lucide-react"

import { PageHeader } from "@/components/product/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { getAllOptions } from "@/features/reference-data"
import type { ReferenceListKey, ReferenceOption } from "@/features/reference-data"

/**
 * Minimal Reference Master management for the lists Customer Onboarding
 * Stage 1 depends on. No live, safe write path exists yet (no per-user
 * authorization boundary in Nexus, see src/features/commercial/server.ts's
 * own header comment for the same constraint), so this screen holds its
 * own local copy of the fixture and never writes back to
 * features/reference-data's shared module state: changes here are scoped
 * to this page's session only, exactly like `nexus-dev`'s other
 * fixture-backed screens.
 *
 * No delete action by design: a Reference Master value is deactivated,
 * never removed, so historical resolution keeps working.
 *
 * Country now carries the full canonical catalogue (~250 rows), so this
 * screen needs search and a status filter to stay usable; it still
 * renders the list as one plain client-side array (docs/UI_SYSTEM.md §9's
 * "tables are first-class"), not a paginated or virtualized grid, since
 * a few hundred rows is not enough to need either.
 */

const REFERENCE_LISTS: { key: ReferenceListKey; label: string }[] = [
  { key: "country", label: "Country" },
  { key: "industry", label: "Industry / Category" },
  { key: "segment", label: "Segment" },
  { key: "business_unit", label: "Business Unit" },
  { key: "phone_country_code", label: "Phone Country Code" },
  { key: "currency", label: "Currency" },
]

type StatusFilter = "all" | "active" | "inactive"

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "inactive", label: "Inactive" },
]

function matchesQuery(option: ReferenceOption, query: string): boolean {
  if (!query) return true
  return (
    option.value.toLowerCase().includes(query) ||
    option.label.toLowerCase().includes(query) ||
    (option.dialCode?.toLowerCase().includes(query) ?? false)
  )
}

function ReferenceMasterSettings() {
  const [optionsByList, setOptionsByList] = useState<Record<ReferenceListKey, ReferenceOption[]>>(() => {
    const initial = {} as Record<ReferenceListKey, ReferenceOption[]>
    for (const list of REFERENCE_LISTS) initial[list.key] = getAllOptions(list.key)
    return initial
  })
  const [selectedList, setSelectedList] = useState<ReferenceListKey>("country")
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [newValue, setNewValue] = useState("")
  const [newLabel, setNewLabel] = useState("")
  const [addError, setAddError] = useState<string | null>(null)

  const options = optionsByList[selectedList]
  const activeCount = options.filter((option) => option.active).length
  const inactiveCount = options.length - activeCount

  const normalizedQuery = searchQuery.trim().toLowerCase()
  const visibleOptions = options.filter((option) => {
    if (statusFilter === "active" && !option.active) return false
    if (statusFilter === "inactive" && option.active) return false
    return matchesQuery(option, normalizedQuery)
  })

  function resetListFilters() {
    setSearchQuery("")
    setStatusFilter("all")
    setAddError(null)
  }

  function toggleActive(value: string) {
    setOptionsByList((current) => ({
      ...current,
      [selectedList]: current[selectedList].map((option) =>
        option.value === value ? { ...option, active: !option.active } : option
      ),
    }))
  }

  function handleAdd() {
    const value = newValue.trim().toLowerCase().replace(/\s+/g, "_")
    const label = newLabel.trim()
    if (!value || !label) {
      setAddError("Enter both a value and a label.")
      return
    }
    if (options.some((option) => option.value === value)) {
      setAddError(`"${value}" already exists in this list.`)
      return
    }
    setOptionsByList((current) => ({
      ...current,
      [selectedList]: [...current[selectedList], { value, label, active: true }],
    }))
    setNewValue("")
    setNewLabel("")
    setAddError(null)
  }

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        title="Customer Onboarding Reference Master"
        description="Local development only. Changes here are not saved and do not affect other sessions."
      />

      <div className="flex flex-col gap-4 px-4 py-4 sm:px-6 sm:py-4">
        <div className="-mx-1 overflow-x-auto px-1">
          <ToggleGroup
            value={[selectedList]}
            onValueChange={(value) => {
              if (value[0]) {
                setSelectedList(value[0] as ReferenceListKey)
                resetListFilters()
              }
            }}
            variant="outline"
            size="sm"
            className="w-max"
          >
            {REFERENCE_LISTS.map((list) => (
              <ToggleGroupItem key={list.key} value={list.key}>
                {list.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search value, label, or code"
                className="w-full pl-7 sm:w-64"
                aria-label="Search Reference Master values"
              />
            </div>
            <div className="-mx-1 overflow-x-auto px-1">
              <ToggleGroup
                value={[statusFilter]}
                onValueChange={(value) => {
                  if (value[0]) setStatusFilter(value[0] as StatusFilter)
                }}
                variant="outline"
                size="sm"
                className="w-max"
              >
                {STATUS_FILTERS.map((filter) => (
                  <ToggleGroupItem key={filter.key} value={filter.key}>
                    {filter.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          </div>
          <span className="text-xs text-muted-foreground tabular-nums">
            {activeCount} Active &#183; {inactiveCount} Inactive
          </span>
        </div>

        <Table className="table-fixed sm:table-auto">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="hidden sm:table-cell">Value</TableHead>
              <TableHead>Label</TableHead>
              {selectedList === "phone_country_code" ? (
                <TableHead className="hidden sm:table-cell">Dial code</TableHead>
              ) : null}
              <TableHead className="w-20 sm:w-auto">Status</TableHead>
              <TableHead className="w-24 text-right sm:w-auto">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleOptions.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={selectedList === "phone_country_code" ? 5 : 4}
                  className="py-8 text-center text-xs text-muted-foreground"
                >
                  No values match this search and filter.
                </TableCell>
              </TableRow>
            ) : (
              visibleOptions.map((option) => (
                <TableRow key={option.value} className="hover:bg-transparent">
                  <TableCell className="hidden font-mono text-[0.7rem] text-muted-foreground sm:table-cell">
                    {option.value}
                  </TableCell>
                  <TableCell className="font-medium text-foreground">
                    <div className="flex flex-col gap-0.5">
                      <span>{option.label}</span>
                      <span className="font-mono text-[0.65rem] font-normal text-muted-foreground sm:hidden">
                        {option.value}
                      </span>
                    </div>
                  </TableCell>
                  {selectedList === "phone_country_code" ? (
                    <TableCell className="hidden text-foreground sm:table-cell">{option.dialCode}</TableCell>
                  ) : null}
                  <TableCell>
                    <Badge
                      variant="ghost"
                      className={
                        option.active ? "gap-1 bg-success/10 text-success" : "gap-1 bg-muted text-muted-foreground"
                      }
                    >
                      {option.active ? (
                        <CheckCircle2Icon data-icon="inline-start" className="size-3" />
                      ) : (
                        <CircleSlashIcon data-icon="inline-start" className="size-3" />
                      )}
                      {option.active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => toggleActive(option.value)}>
                      {option.active ? "Deactivate" : "Activate"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        <div className="flex flex-col gap-2 rounded-md border border-dashed px-3 py-3">
          <span className="text-xs font-medium text-muted-foreground">Add value</span>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="flex flex-col gap-1">
              <label htmlFor="new-option-value" className="text-[0.7rem] text-muted-foreground">
                Value (key)
              </label>
              <Input
                id="new-option-value"
                value={newValue}
                onChange={(event) => setNewValue(event.target.value)}
                placeholder="e.g. logistics"
                className="w-full sm:w-40"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="new-option-label" className="text-[0.7rem] text-muted-foreground">
                Label
              </label>
              <Input
                id="new-option-label"
                value={newLabel}
                onChange={(event) => setNewLabel(event.target.value)}
                placeholder="e.g. Logistics"
                className="w-full sm:w-48"
              />
            </div>
            <Button variant="outline" size="sm" onClick={handleAdd} className="sm:w-auto">
              <PlusIcon data-icon="inline-start" />
              Add
            </Button>
          </div>
          {addError ? <p className="text-[0.7rem] text-destructive">{addError}</p> : null}
        </div>
      </div>
    </div>
  )
}

export { ReferenceMasterSettings }
