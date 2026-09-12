"use client"

import { useState } from "react"
import { CheckCircle2Icon, CircleSlashIcon, PlusIcon, SearchIcon } from "lucide-react"

import { PageHeader } from "@/components/product/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { getAllOptions, isValidIsoCurrencyCode } from "@/features/reference-data"
import type { ReferenceListKey, ReferenceOption } from "@/features/reference-data"

/**
 * Customer Onboarding Settings: the governed administrative workspace for
 * every configurable value Customer Onboarding and Commercial Rate select
 * from (`docs/SETTINGS_ARCHITECTURE.md` is the authoritative document for
 * this screen's own structure and the three configuration levels below;
 * this header only summarizes it).
 *
 * No live, safe write path exists yet (no per-user authorization boundary
 * in Nexus, see src/features/commercial/server.ts's own header comment
 * for the same constraint), so this screen holds its own local copy of
 * the fixture and never writes back to features/reference-data's shared
 * module state: changes here are scoped to this page's session only,
 * exactly like `nexus-dev`'s other fixture-backed screens. This is a
 * deliberate honesty boundary, not an oversight: the UI and domain
 * behavior below are real, but "Settings edits persist forever" is not
 * true yet.
 *
 * No delete action anywhere: a Reference Master value is deactivated,
 * never removed, so historical resolution keeps working.
 *
 * Country and Phone Country Code are deliberately not part of this
 * workspace's navigation: geography stays governed by its own canonical
 * dataset (../domain/countries.ts) and the /api/geography/* services, not
 * a hand-curated Settings list.
 */

type SettingsGroup = "customer" | "commercial" | "system"
type ConfigLevel = "configurable" | "governed" | "system"

/** How a list's own stable code is derived when adding a new value: Currency uses a validated ISO code the user types directly; every other addable list suggests a code from the label, editable before creation. */
type AddMode = "disabled" | "standard" | "currency" | "invoice_frequency"

type ListConfig = {
  key: ReferenceListKey
  label: string
  group: SettingsGroup
  level: ConfigLevel
  usedBy: string
  /** Shown once per list, above its table; carries the concise System Rule description for Level 3 lists (task correction: "avoid explanatory paragraphs everywhere... compact helper text only where necessary"). */
  helpText?: string
  addMode: AddMode
  /** Uppercase codes (Pricing Unit: "DEVICE") vs lowercase snake_case (Industry/Segment/Business Unit/Tax Identifier Type: "logistics"), only meaningful for `addMode: "standard"`. */
  codeCase?: "upper" | "lower"
}

const LIST_CONFIGS: ListConfig[] = [
  {
    key: "industry",
    label: "Industry / Category",
    group: "customer",
    level: "configurable",
    usedBy: "Used by Customer Details",
    addMode: "standard",
    codeCase: "lower",
  },
  {
    key: "segment",
    label: "Segment",
    group: "customer",
    level: "configurable",
    usedBy: "Used by Customer Details",
    addMode: "standard",
    codeCase: "lower",
  },
  {
    key: "business_unit",
    label: "Business Unit",
    group: "customer",
    level: "configurable",
    usedBy: "Used by Customer Details",
    addMode: "standard",
    codeCase: "lower",
  },
  {
    key: "tax_identifier_type",
    label: "Tax Identifier Type",
    group: "customer",
    level: "configurable",
    usedBy: "Used by Customer Details (Tax & Registration, non-India)",
    addMode: "standard",
    codeCase: "lower",
  },
  {
    key: "currency",
    label: "Currency",
    group: "commercial",
    level: "governed",
    usedBy: "Used by Commercial Rate and future Revenue",
    addMode: "currency",
  },
  {
    key: "pricing_unit",
    label: "Pricing Units",
    group: "commercial",
    level: "configurable",
    usedBy: "Used by Commercial Rate",
    addMode: "standard",
    codeCase: "upper",
  },
  {
    key: "invoice_frequency",
    label: "Invoice Frequency",
    group: "commercial",
    level: "governed",
    usedBy: "Used by Commercial Rate",
    addMode: "invoice_frequency",
  },
  {
    key: "commercial_nature",
    label: "Commercial Nature",
    group: "system",
    level: "system",
    usedBy: "Used by Commercial Rate",
    helpText: "Recurring, Non-Recurring, and On-Demand are the supported Commercial Natures; each drives distinct real Commercial Rate behavior.",
    addMode: "disabled",
  },
  {
    key: "pricing_model",
    label: "Pricing Models",
    group: "system",
    level: "system",
    usedBy: "Used by Commercial Rate",
    helpText:
      "Per Unit, Flat Fee, Slab, and Designation Based are the pricing calculations Nexus's Pricing Kernel supports. A new model needs new calculation logic before it means anything.",
    addMode: "disabled",
  },
  {
    key: "invoice_timing",
    label: "Invoice Timing",
    group: "system",
    level: "system",
    usedBy: "Used by Commercial Rate",
    helpText: "Advance and Postpaid are the supported Invoice Timing values.",
    addMode: "disabled",
  },
  {
    key: "slab_method",
    label: "Slab Methods",
    group: "system",
    level: "system",
    usedBy: "Used by Commercial Rate (Slab pricing)",
    helpText:
      "Whole Quantity: the applicable slab rate applies to the complete quantity. Progressive: each slab rate applies only to units falling within that slab.",
    addMode: "disabled",
  },
  {
    key: "revenue_recognition_method",
    label: "Revenue Recognition Methods",
    group: "system",
    level: "system",
    usedBy: "Used by Commercial Rate (Non-Recurring)",
    helpText: "Full Recognition and Milestone Based are the supported Non-Recurring revenue recognition methods.",
    addMode: "disabled",
  },
]

/** Every `ReferenceListKey` this screen needs a fixture copy of, including the two excluded from navigation (still loaded so a future re-inclusion needs no reshaping of the state object). */
const ALL_LIST_KEYS: ReferenceListKey[] = [
  "country",
  "industry",
  "segment",
  "business_unit",
  "tax_identifier_type",
  "phone_country_code",
  "currency",
  "pricing_unit",
  "invoice_frequency",
  "invoice_timing",
  "commercial_nature",
  "pricing_model",
  "slab_method",
  "revenue_recognition_method",
]

const GROUPS: { key: SettingsGroup; label: string }[] = [
  { key: "customer", label: "Customer Setup" },
  { key: "commercial", label: "Commercial Setup" },
  { key: "system", label: "System Rules" },
]

const LEVEL_LABELS: Record<ConfigLevel, string> = {
  configurable: "Configurable",
  governed: "Governed Parameter",
  system: "System Rule",
}

const LEVEL_BADGE_CLASSES: Record<ConfigLevel, string> = {
  configurable: "bg-success/10 text-success",
  governed: "bg-primary/10 text-primary",
  system: "bg-muted text-muted-foreground",
}

type StatusFilter = "all" | "active" | "inactive"

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "inactive", label: "Inactive" },
]

function matchesQuery(option: ReferenceOption, query: string): boolean {
  if (!query) return true
  return option.value.toLowerCase().includes(query) || option.label.toLowerCase().includes(query)
}

/** Derives a stable code from a display label ("Device" -> "DEVICE" or "device"), a starting suggestion the user may still edit before creating the value (task correction: "prefer deriving/suggesting a stable code from the label... allow safe review before creation"). */
function suggestCode(label: string, codeCase: "upper" | "lower"): string {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
  return codeCase === "upper" ? slug.toUpperCase() : slug
}

/** "Every 1 month", "Every 3 months", or "One-Time" for the reserved non-recurring row. Never derived from the label alone (task correction §12). */
function formatCadence(cadenceMonths: number | null | undefined): string {
  if (cadenceMonths === null || cadenceMonths === undefined) return "One-Time"
  return `Every ${cadenceMonths} month${cadenceMonths === 1 ? "" : "s"}`
}

function ReferenceMasterSettings() {
  const [optionsByList, setOptionsByList] = useState<Record<ReferenceListKey, ReferenceOption[]>>(() => {
    const initial = {} as Record<ReferenceListKey, ReferenceOption[]>
    for (const key of ALL_LIST_KEYS) initial[key] = getAllOptions(key)
    return initial
  })
  const [selectedGroup, setSelectedGroup] = useState<SettingsGroup>("customer")
  const [selectedList, setSelectedList] = useState<ReferenceListKey>("industry")
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [confirmingDeactivateValue, setConfirmingDeactivateValue] = useState<string | null>(null)

  // Generic "standard" Add form state (auto-suggested code, editable).
  const [newLabel, setNewLabel] = useState("")
  const [newValue, setNewValue] = useState("")
  const [valueTouched, setValueTouched] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  // Currency's own Add form state.
  const [newCurrencyCode, setNewCurrencyCode] = useState("")
  const [newCurrencyName, setNewCurrencyName] = useState("")

  // Invoice Frequency's own Add form state.
  const [newFrequencyLabel, setNewFrequencyLabel] = useState("")
  const [newFrequencyCadence, setNewFrequencyCadence] = useState("")

  const listsInGroup = LIST_CONFIGS.filter((list) => list.group === selectedGroup)
  const activeList = LIST_CONFIGS.find((list) => list.key === selectedList) ?? listsInGroup[0]
  const options = optionsByList[activeList.key]
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
    setConfirmingDeactivateValue(null)
    setNewLabel("")
    setNewValue("")
    setValueTouched(false)
    setNewCurrencyCode("")
    setNewCurrencyName("")
    setNewFrequencyLabel("")
    setNewFrequencyCadence("")
  }

  function selectGroup(group: SettingsGroup) {
    setSelectedGroup(group)
    const firstList = LIST_CONFIGS.find((list) => list.group === group)
    if (firstList) setSelectedList(firstList.key)
    resetListFilters()
  }

  function selectList(key: ReferenceListKey) {
    setSelectedList(key)
    resetListFilters()
  }

  function requestDeactivate(value: string) {
    setConfirmingDeactivateValue(value)
  }

  function confirmDeactivate(value: string) {
    setOptionsByList((current) => ({
      ...current,
      [activeList.key]: current[activeList.key].map((option) => (option.value === value ? { ...option, active: false } : option)),
    }))
    setConfirmingDeactivateValue(null)
  }

  /** Activating needs no confirmation: it only ever expands what is selectable, never removes anything from a historical record. */
  function activate(value: string) {
    setOptionsByList((current) => ({
      ...current,
      [activeList.key]: current[activeList.key].map((option) => (option.value === value ? { ...option, active: true } : option)),
    }))
  }

  /**
   * INR Conversion Rate is "1 unit of this currency = X INR" (task
   * correction §7), editable here only: Commercial Rate itself only ever
   * reads this value, never writes it. INR's own row is not editable,
   * since its rate is always exactly 1 by definition, not a configurable
   * business choice.
   */
  function updateInrConversionRate(value: string, rawInput: string) {
    const parsed = rawInput.trim() === "" ? null : Number(rawInput)
    const nextRate = parsed !== null && Number.isFinite(parsed) && parsed > 0 ? parsed : null
    setOptionsByList((current) => ({
      ...current,
      currency: current.currency.map((option) => (option.value === value ? { ...option, inrConversionRate: nextRate } : option)),
    }))
  }

  function handleAddStandard() {
    const value = valueTouched ? newValue.trim().toLowerCase().replace(/\s+/g, "_") : suggestCode(newLabel, activeList.codeCase ?? "lower")
    const label = newLabel.trim()
    if (!value || !label) {
      setAddError("Enter a label (a code is suggested automatically).")
      return
    }
    if (options.some((option) => option.value === value)) {
      setAddError(`"${value}" already exists in this list.`)
      return
    }
    setOptionsByList((current) => ({
      ...current,
      [activeList.key]: [...current[activeList.key], { value, label, active: true }],
    }))
    setNewLabel("")
    setNewValue("")
    setValueTouched(false)
    setAddError(null)
  }

  /** Currency Add validates against the real ISO 4217 code catalogue (task correction §9): never an invented or malformed code. */
  function handleAddCurrency() {
    const code = newCurrencyCode.trim().toUpperCase()
    const name = newCurrencyName.trim()
    if (!code || !name) {
      setAddError("Enter both a currency code and a name.")
      return
    }
    if (!isValidIsoCurrencyCode(code)) {
      setAddError(`"${code}" is not a recognized ISO 4217 currency code.`)
      return
    }
    if (options.some((option) => option.value === code)) {
      setAddError(`"${code}" already exists in this list.`)
      return
    }
    setOptionsByList((current) => ({
      ...current,
      currency: [...current.currency, { value: code, label: `${code} - ${name}`, active: true, inrConversionRate: null }],
    }))
    setNewCurrencyCode("")
    setNewCurrencyName("")
    setAddError(null)
  }

  /** A new recurring Invoice Frequency requires a positive, machine-readable cadence (task correction §14): never arbitrary text with no cadence, and never the reserved "One-Time" shape (`cadenceMonths: null`). */
  function handleAddInvoiceFrequency() {
    const label = newFrequencyLabel.trim()
    const value = suggestCode(label, "lower")
    const cadence = Number(newFrequencyCadence)
    if (!label) {
      setAddError("Enter a name for the new frequency.")
      return
    }
    if (!Number.isFinite(cadence) || !Number.isInteger(cadence) || cadence <= 0) {
      setAddError("Enter a whole number cadence in months (e.g. 2 for Every 2 Months).")
      return
    }
    if (options.some((option) => option.value === value)) {
      setAddError(`"${value}" already exists in this list.`)
      return
    }
    setOptionsByList((current) => ({
      ...current,
      invoice_frequency: [...current.invoice_frequency, { value, label, active: true, cadenceMonths: cadence }],
    }))
    setNewFrequencyLabel("")
    setNewFrequencyCadence("")
    setAddError(null)
  }

  const showCadenceColumn = activeList.key === "invoice_frequency"
  const showCurrencyColumn = activeList.key === "currency"
  const extraColumnCount = (showCadenceColumn ? 1 : 0) + (showCurrencyColumn ? 1 : 0)

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        title="Customer Onboarding Settings"
        description="Local development only. Changes here are not saved and do not affect other sessions."
      />

      <div className="flex flex-col gap-4 px-4 py-4 sm:px-6 sm:py-4">
        <div className="-mx-1 overflow-x-auto px-1">
          <ToggleGroup
            value={[selectedGroup]}
            onValueChange={(value) => {
              if (value[0]) selectGroup(value[0] as SettingsGroup)
            }}
            variant="outline"
            className="w-max"
          >
            {GROUPS.map((group) => (
              <ToggleGroupItem key={group.key} value={group.key}>
                {group.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        <div className="-mx-1 overflow-x-auto px-1">
          <ToggleGroup
            value={[activeList.key]}
            onValueChange={(value) => {
              if (value[0]) selectList(value[0] as ReferenceListKey)
            }}
            variant="outline"
            size="sm"
            className="w-max"
          >
            {listsInGroup.map((list) => (
              <ToggleGroupItem key={list.key} value={list.key}>
                {list.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-foreground">{activeList.label}</span>
            <Badge variant="ghost" className={LEVEL_BADGE_CLASSES[activeList.level]}>
              {LEVEL_LABELS[activeList.level]}
            </Badge>
          </div>
          <span className="text-[0.7rem] text-muted-foreground">{activeList.usedBy}</span>
          {activeList.helpText ? <p className="max-w-2xl text-[0.7rem] text-muted-foreground">{activeList.helpText}</p> : null}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search value or label"
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
              <TableHead className="hidden sm:table-cell">Code</TableHead>
              <TableHead>Label</TableHead>
              {showCurrencyColumn ? <TableHead>INR Conversion Rate</TableHead> : null}
              {showCadenceColumn ? <TableHead>Cadence</TableHead> : null}
              <TableHead className="w-20 sm:w-auto">Status</TableHead>
              <TableHead className="w-24 text-right sm:w-auto">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleOptions.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={4 + extraColumnCount} className="py-8 text-center text-xs text-muted-foreground">
                  No values match this search and filter.
                </TableCell>
              </TableRow>
            ) : (
              visibleOptions.map((option) => (
                <TableRow key={option.value} className="hover:bg-transparent">
                  <TableCell className="hidden font-mono text-[0.7rem] text-muted-foreground sm:table-cell">{option.value}</TableCell>
                  <TableCell className="font-medium text-foreground">
                    <div className="flex flex-col gap-0.5">
                      <span>{option.label}</span>
                      <span className="font-mono text-[0.65rem] font-normal text-muted-foreground sm:hidden">{option.value}</span>
                    </div>
                  </TableCell>
                  {showCurrencyColumn ? (
                    <TableCell>
                      {option.value === "INR" ? (
                        <span className="text-xs text-muted-foreground">1 (fixed)</span>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-muted-foreground">1 {option.value} =</span>
                          <Input
                            type="number"
                            min={0}
                            step="any"
                            value={option.inrConversionRate ?? ""}
                            onChange={(event) => updateInrConversionRate(option.value, event.target.value)}
                            placeholder="Not configured"
                            className="h-8 w-28"
                            aria-label={`INR conversion rate for ${option.value}`}
                          />
                          <span className="text-xs text-muted-foreground">INR</span>
                        </div>
                      )}
                    </TableCell>
                  ) : null}
                  {showCadenceColumn ? <TableCell className="text-foreground">{formatCadence(option.cadenceMonths)}</TableCell> : null}
                  <TableCell>
                    <Badge variant="ghost" className={option.active ? "gap-1 bg-success/10 text-success" : "gap-1 bg-muted text-muted-foreground"}>
                      {option.active ? <CheckCircle2Icon data-icon="inline-start" className="size-3" /> : <CircleSlashIcon data-icon="inline-start" className="size-3" />}
                      {option.active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {confirmingDeactivateValue === option.value ? (
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-[0.65rem] text-muted-foreground">
                          Deactivate &quot;{option.label}&quot;? It will no longer be available for new selections. Existing historical records will remain
                          unchanged.
                        </span>
                        <div className="flex items-center gap-1.5">
                          <Button variant="destructive" size="sm" onClick={() => confirmDeactivate(option.value)}>
                            Confirm
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setConfirmingDeactivateValue(null)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button variant="outline" size="sm" onClick={() => (option.active ? requestDeactivate(option.value) : activate(option.value))}>
                        {option.active ? "Deactivate" : "Activate"}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {activeList.addMode === "disabled" ? (
          <div className="flex flex-col gap-1 rounded-md border border-dashed px-3 py-3">
            <span className="text-xs font-medium text-muted-foreground">Adding is not available for this list</span>
            <p className="text-[0.7rem] text-muted-foreground">
              {activeList.label} is System-Supported Logic: a new value needs matching application/calculation code before it means anything, so only
              Activate/Deactivate is available here.
            </p>
          </div>
        ) : null}

        {activeList.addMode === "standard" ? (
          <div className="flex flex-col gap-2 rounded-md border border-dashed px-3 py-3">
            <span className="text-xs font-medium text-muted-foreground">Add value</span>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
              <div className="flex flex-col gap-1">
                <label htmlFor="new-option-label" className="text-[0.7rem] text-muted-foreground">
                  Label
                </label>
                <Input
                  id="new-option-label"
                  value={newLabel}
                  onChange={(event) => {
                    setNewLabel(event.target.value)
                    if (!valueTouched) setNewValue(suggestCode(event.target.value, activeList.codeCase ?? "lower"))
                  }}
                  placeholder="e.g. Device"
                  className="w-full sm:w-48"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="new-option-value" className="text-[0.7rem] text-muted-foreground">
                  Code (suggested, editable)
                </label>
                <Input
                  id="new-option-value"
                  value={newValue}
                  onChange={(event) => {
                    setValueTouched(true)
                    setNewValue(event.target.value)
                  }}
                  placeholder="e.g. DEVICE"
                  className="w-full font-mono sm:w-40"
                />
              </div>
              <Button variant="outline" size="sm" onClick={handleAddStandard} className="sm:w-auto">
                <PlusIcon data-icon="inline-start" />
                Add
              </Button>
            </div>
            {addError ? <p className="text-[0.7rem] text-destructive">{addError}</p> : null}
          </div>
        ) : null}

        {activeList.addMode === "currency" ? (
          <div className="flex flex-col gap-2 rounded-md border border-dashed px-3 py-3">
            <span className="text-xs font-medium text-muted-foreground">Add currency</span>
            <p className="text-[0.7rem] text-muted-foreground">Code must be a recognized ISO 4217 currency code. The INR Conversion Rate is configured separately, after adding.</p>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
              <div className="flex flex-col gap-1">
                <label htmlFor="new-currency-code" className="text-[0.7rem] text-muted-foreground">
                  ISO Currency Code
                </label>
                <Input
                  id="new-currency-code"
                  value={newCurrencyCode}
                  onChange={(event) => setNewCurrencyCode(event.target.value)}
                  placeholder="e.g. JPY"
                  className="w-full font-mono uppercase sm:w-28"
                  maxLength={3}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="new-currency-name" className="text-[0.7rem] text-muted-foreground">
                  Currency Name
                </label>
                <Input
                  id="new-currency-name"
                  value={newCurrencyName}
                  onChange={(event) => setNewCurrencyName(event.target.value)}
                  placeholder="e.g. Japanese Yen"
                  className="w-full sm:w-56"
                />
              </div>
              <Button variant="outline" size="sm" onClick={handleAddCurrency} className="sm:w-auto">
                <PlusIcon data-icon="inline-start" />
                Add
              </Button>
            </div>
            {addError ? <p className="text-[0.7rem] text-destructive">{addError}</p> : null}
          </div>
        ) : null}

        {activeList.addMode === "invoice_frequency" ? (
          <div className="flex flex-col gap-2 rounded-md border border-dashed px-3 py-3">
            <span className="text-xs font-medium text-muted-foreground">Add recurring Invoice Frequency</span>
            <p className="text-[0.7rem] text-muted-foreground">
              A cadence in months is required; One-Time is a reserved system frequency and cannot be recreated here.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
              <div className="flex flex-col gap-1">
                <label htmlFor="new-frequency-label" className="text-[0.7rem] text-muted-foreground">
                  Name
                </label>
                <Input
                  id="new-frequency-label"
                  value={newFrequencyLabel}
                  onChange={(event) => setNewFrequencyLabel(event.target.value)}
                  placeholder="e.g. Every 2 Months"
                  className="w-full sm:w-48"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="new-frequency-cadence" className="text-[0.7rem] text-muted-foreground">
                  Cadence (months)
                </label>
                <Input
                  id="new-frequency-cadence"
                  type="number"
                  min={1}
                  value={newFrequencyCadence}
                  onChange={(event) => setNewFrequencyCadence(event.target.value)}
                  placeholder="e.g. 2"
                  className="w-full sm:w-28"
                />
              </div>
              <Button variant="outline" size="sm" onClick={handleAddInvoiceFrequency} className="sm:w-auto">
                <PlusIcon data-icon="inline-start" />
                Add
              </Button>
            </div>
            {addError ? <p className="text-[0.7rem] text-destructive">{addError}</p> : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export { ReferenceMasterSettings }
