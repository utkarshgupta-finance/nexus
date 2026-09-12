"use client"

import { Fragment, useMemo, useState } from "react"
import { PlusIcon, XIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { getActiveOptions, resolveOption } from "@/features/reference-data"
import { componentTableCells, dualCurrencyLines, formatAmount, formatQuantity, mugUnitCode, unitLabel } from "../domain/commercial-rate-summary"
import type { ComponentTableCells } from "../domain/commercial-rate-summary"
import { inrConversionRateFor, isForeignCurrency } from "../domain/commercial-rate-fx"
import {
  calculateDesignationMugSummary,
  calculateMilestoneAmount,
  calculateMugValue,
  createComponent,
  createDesignationRow,
  createMilestone,
  createSlabRow,
  defaultPricingModelFor,
  designationMinimumUnitsFor,
  nonRecurringMilestoneBasisAmount,
  recalculateSlabFroms,
  syncDesignationMinimums,
  validateCommercialComponent,
} from "../domain/commercial-rate"
import type {
  CommercialComponentDraft,
  CommercialNature,
  CommercialRateDraft,
  ComponentValidationIssue,
  DesignationRow,
  Milestone,
  MugOverlay,
  PricingModel,
  RevenueRecognition,
  SlabMethod,
  SlabRow,
} from "../domain/commercial-rate"

/**
 * Commercial Rate stage UI: Billing Currency at the header, then repeatable
 * Commercial Components. Each component is authored through an explicit
 * Add/Edit -> Save flow (never a permanently-open flat form): a saved
 * component collapses to a summary card until Edit is clicked again. A
 * pure display/edit surface: nothing here calculates a real bill, and
 * nothing here writes to Commercial Configuration; see
 * ../domain/commercial-rate.ts's header for the draft-capture design.
 */

function selectLabel(listKey: Parameters<typeof getActiveOptions>[0], value: string | null): string {
  if (!value) return "Select..."
  return resolveOption(listKey, value)?.label ?? value
}

function OptionSelect({
  listKey,
  value,
  onChange,
  className,
}: {
  listKey: Parameters<typeof getActiveOptions>[0]
  value: string | null
  onChange: (value: string) => void
  className?: string
}) {
  const options = useMemo(() => getActiveOptions(listKey), [listKey])
  return (
    // `value` is passed straight through, including `null`: base-ui's Select
    // treats an explicit `null` as "controlled, nothing selected" but treats
    // `undefined` as "uncontrolled", so `value ?? undefined` here would
    // silently flip this Select from uncontrolled to controlled the moment
    // a user made a first selection, which base-ui does not support.
    <Select value={value} onValueChange={(next) => onChange(next as string)}>
      <SelectTrigger className={className ?? "w-full"}>
        <SelectValue placeholder="Select...">{() => selectLabel(listKey, value)}</SelectValue>
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

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-xs font-medium text-foreground">{children}</span>
}

function InvoiceTermsFields({
  component,
  onChange,
}: {
  component: CommercialComponentDraft
  onChange: (next: CommercialComponentDraft) => void
}) {
  /** Once Milestone Based recognition is chosen, Invoice Timing lives per milestone instead (task correction §6): a single component-level Timing cannot express a mix like "50% Advance, 25% Postpaid". */
  const timingLivesOnMilestones = component.nature === "non_recurring" && component.revenueRecognition.method === "milestone_based"
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="flex flex-col gap-1.5">
        <FieldLabel>Invoice Frequency{component.nature === "on_demand" ? " (optional)" : ""}</FieldLabel>
        {component.nature === "non_recurring" ? (
          <Badge variant="ghost" className="w-fit bg-muted text-muted-foreground">
            {selectLabel("invoice_frequency", component.invoiceTerms.invoiceFrequency)}
          </Badge>
        ) : (
          <OptionSelect
            listKey="invoice_frequency"
            value={component.invoiceTerms.invoiceFrequency}
            onChange={(value) => onChange({ ...component, invoiceTerms: { ...component.invoiceTerms, invoiceFrequency: value } })}
          />
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <FieldLabel>Invoice Timing</FieldLabel>
        {timingLivesOnMilestones ? (
          <span className="pt-2 text-[0.7rem] text-muted-foreground">Set per milestone below (Milestone Based recognition).</span>
        ) : (
          <OptionSelect
            listKey="invoice_timing"
            value={component.invoiceTerms.invoiceTiming}
            onChange={(value) => onChange({ ...component, invoiceTerms: { ...component.invoiceTerms, invoiceTiming: value } })}
          />
        )}
      </div>
    </div>
  )
}

/**
 * Designation Based's own MUG area (task correction §2-3): Designation,
 * Rate, and Unit are read-only, mirrored live from the pricing designation
 * rows above; only Minimum Units is editable, per designation. Adding or
 * removing a pricing designation row automatically adds or removes its
 * mirrored row here (the `onChangeRows` call site in `ComponentEditor`
 * keeps `designationMinimums` in sync via `syncDesignationMinimums`); a
 * rename or rate edit needs no separate sync at all, since this component
 * always reads the current designation/rate live from `designationRows`.
 */
function DesignationMugRowsEditor({
  mug,
  designationRows,
  designationSummary,
  currencyCode,
  onChange,
}: {
  mug: Extract<MugOverlay, { enabled: true }>
  designationRows: DesignationRow[]
  designationSummary: { totalUnits: number; totalValue: number } | null
  currencyCode: string | null
  onChange: (next: MugOverlay) => void
}) {
  function updateMinimum(designationRowId: string, minimumUnits: number | null) {
    const exists = mug.designationMinimums.some((entry) => entry.designationRowId === designationRowId)
    const next = exists
      ? mug.designationMinimums.map((entry) => (entry.designationRowId === designationRowId ? { ...entry, minimumUnits } : entry))
      : [...mug.designationMinimums, { designationRowId, minimumUnits }]
    onChange({ ...mug, designationMinimums: next })
  }

  return (
    <div className="flex flex-col gap-2 pl-5.5">
      <span className="text-[0.7rem] text-muted-foreground">
        Designation, Rate, and Unit are mirrored from Pricing above and read-only here; only Minimum Units is editable.
      </span>
      <div className="flex flex-col gap-1.5">
        <div className="grid grid-cols-3 gap-2 text-[0.7rem] text-muted-foreground">
          <span>Designation</span>
          <span>Rate</span>
          <span>Minimum Units</span>
        </div>
        {designationRows.map((row) => (
          <div key={row.id} className="grid grid-cols-3 items-center gap-2">
            <span className="truncate text-xs text-foreground">{row.designation || "Designation"}</span>
            <span className="text-xs text-muted-foreground">
              {formatAmount(row.rate, currencyCode)} / {unitLabel(row.per)}
            </span>
            <Input
              type="number"
              min={0}
              value={designationMinimumUnitsFor(mug, row.id) ?? ""}
              onChange={(event) => updateMinimum(row.id, event.target.value ? Number(event.target.value) : null)}
              placeholder="e.g. 500"
            />
          </div>
        ))}
      </div>
      {designationSummary ? (
        <div className="mt-1 flex flex-col gap-0.5 rounded-md border border-dashed px-2.5 py-2">
          <span className="text-[0.7rem] font-medium text-foreground">Calculated MUG Value (reference only)</span>
          <span className="text-xs text-muted-foreground">Total {formatQuantity(designationSummary.totalUnits)} Units</span>
          {dualCurrencyLines(designationSummary.totalValue, currencyCode, " / Month", formatAmount).map((line) => (
            <span key={line} className="text-xs text-muted-foreground">
              {line}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function MugFields({
  mug,
  pricingModel,
  pricingUnitCode,
  designationRows,
  designationSummary,
  calculatedValue,
  currencyCode,
  onChange,
}: {
  mug: MugOverlay
  pricingModel: PricingModel
  pricingUnitCode: string | null
  /** Non-null only for Designation Based (task correction §2). */
  designationRows: DesignationRow[] | null
  designationSummary: { totalUnits: number; totalValue: number } | null
  /** Derived preview only, never a separately editable/stored field (task correction §1). Used only outside the Designation Based case, which has its own summary above. */
  calculatedValue: number | null
  currencyCode: string | null
  onChange: (next: MugOverlay) => void
}) {
  const unitWord = `${unitLabel(pricingUnitCode)}s`

  function toggle(enabled: boolean) {
    if (!enabled) {
      onChange({ enabled: false })
      return
    }
    const designationMinimums = pricingModel === "designation_based" && designationRows ? syncDesignationMinimums([], designationRows) : []
    onChange({ enabled: true, minimumUnits: null, designationMinimums })
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="flex items-center gap-2 text-xs text-foreground">
        <input type="checkbox" className="size-3.5 accent-foreground" checked={mug.enabled} onChange={(event) => toggle(event.target.checked)} />
        Minimum Usage Guarantee (MUG)
      </label>
      {mug.enabled ? (
        pricingModel === "designation_based" && designationRows ? (
          <DesignationMugRowsEditor mug={mug} designationRows={designationRows} designationSummary={designationSummary} currencyCode={currencyCode} onChange={onChange} />
        ) : (
          <div className="flex flex-col gap-1.5 pl-5.5 sm:max-w-xs">
            <FieldLabel>Minimum {unitWord}</FieldLabel>
            <Input
              type="number"
              min={0}
              value={mug.minimumUnits ?? ""}
              onChange={(event) => onChange({ ...mug, minimumUnits: event.target.value ? Number(event.target.value) : null })}
              placeholder="e.g. 5000"
            />
            <span className="text-[0.7rem] text-muted-foreground">Assessed monthly, applied before pricing.</span>
            {calculatedValue !== null ? (
              <div className="mt-1 flex flex-col gap-0.5 rounded-md border border-dashed px-2.5 py-2">
                <span className="text-[0.7rem] font-medium text-foreground">Calculated MUG Value (reference only)</span>
                {dualCurrencyLines(calculatedValue, currencyCode, " / Month", formatAmount).map((line) => (
                  <span key={line} className="text-xs text-muted-foreground">
                    {line}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        )
      ) : null}
    </div>
  )
}

function SlabRowsEditor({
  pricingUnit,
  slabMethod,
  rows,
  onChangeUnit,
  onChangeMethod,
  onChangeRows,
}: {
  pricingUnit: string | null
  slabMethod: SlabMethod
  rows: SlabRow[]
  onChangeUnit: (value: string) => void
  onChangeMethod: (value: SlabMethod) => void
  onChangeRows: (rows: SlabRow[]) => void
}) {
  /** Every row mutation goes through this so From always stays derived and in sync (task correction §2-3: never a value the user types). */
  function updateRows(nextRows: SlabRow[]) {
    onChangeRows(recalculateSlabFroms(nextRows))
  }
  const lastRow = rows[rows.length - 1]
  const canAddRow = lastRow ? lastRow.to !== null : true
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <FieldLabel>Unit</FieldLabel>
          <OptionSelect listKey="pricing_unit" value={pricingUnit} onChange={onChangeUnit} />
        </div>
        <div className="flex flex-col gap-1.5">
          <FieldLabel>Slab Method</FieldLabel>
          <ToggleGroup
            value={[slabMethod]}
            onValueChange={(value) => {
              if (value[0]) onChangeMethod(value[0] as SlabMethod)
            }}
            variant="outline"
            size="sm"
            className="w-fit"
          >
            <ToggleGroupItem value="whole_quantity">Whole Quantity</ToggleGroupItem>
            <ToggleGroupItem value="progressive">Progressive</ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      <span className="text-[0.7rem] text-muted-foreground">
        {slabMethod === "progressive"
          ? "Progressive: each band is priced separately and summed (e.g. first 100 at this band's rate, the next band at its own rate)."
          : "Whole Quantity: the entire quantity is priced at the single band it falls into, not band by band."}
      </span>

      <div className="flex flex-col gap-2">
        {rows.map((row, index) => (
          <div key={row.id} className="grid grid-cols-[1fr_1fr_1fr_auto] items-end gap-2">
            <div className="flex flex-col gap-1">
              <span className="text-[0.7rem] text-muted-foreground">From</span>
              <Input type="number" readOnly disabled value={row.from ?? ""} className="bg-muted text-muted-foreground" />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[0.7rem] text-muted-foreground">To {index === rows.length - 1 ? "(optional, open-ended)" : ""}</span>
              <Input
                type="number"
                min={0}
                value={row.to ?? ""}
                onChange={(event) =>
                  updateRows(rows.map((entry) => (entry.id === row.id ? { ...entry, to: event.target.value ? Number(event.target.value) : null } : entry)))
                }
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[0.7rem] text-muted-foreground">Rate</span>
              <Input
                type="number"
                min={0}
                value={row.rate ?? ""}
                onChange={(event) =>
                  updateRows(rows.map((entry) => (entry.id === row.id ? { ...entry, rate: event.target.value ? Number(event.target.value) : null } : entry)))
                }
              />
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Delete slab row"
              disabled={rows.length <= 1}
              onClick={() => updateRows(rows.filter((entry) => entry.id !== row.id))}
            >
              <XIcon className="size-3.5" />
            </Button>
          </div>
        ))}
      </div>
      <Button variant="outline" size="sm" className="w-fit" disabled={!canAddRow} onClick={() => updateRows([...rows, createSlabRow(lastRow ?? null)])}>
        <PlusIcon data-icon="inline-start" className="size-3.5" />
        Add Row
      </Button>
      {!canAddRow ? (
        <span className="text-[0.7rem] text-muted-foreground">Set an upper limit on the last row before adding another.</span>
      ) : null}
    </div>
  )
}

function DesignationRowsEditor({ rows, onChangeRows }: { rows: DesignationRow[]; onChangeRows: (rows: DesignationRow[]) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-foreground">Designation rows</span>
      <div className="flex flex-col gap-2">
        {rows.map((row) => (
          <div key={row.id} className="grid grid-cols-[1fr_1fr_1fr_auto] items-end gap-2">
            <div className="flex flex-col gap-1">
              <span className="text-[0.7rem] text-muted-foreground">Designation</span>
              <Input
                value={row.designation}
                onChange={(event) => onChangeRows(rows.map((entry) => (entry.id === row.id ? { ...entry, designation: event.target.value } : entry)))}
                placeholder="e.g. Sales Rep"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[0.7rem] text-muted-foreground">Rate</span>
              <Input
                type="number"
                min={0}
                value={row.rate ?? ""}
                onChange={(event) =>
                  onChangeRows(rows.map((entry) => (entry.id === row.id ? { ...entry, rate: event.target.value ? Number(event.target.value) : null } : entry)))
                }
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[0.7rem] text-muted-foreground">Per</span>
              <OptionSelect
                listKey="pricing_unit"
                value={row.per}
                onChange={(value) => onChangeRows(rows.map((entry) => (entry.id === row.id ? { ...entry, per: value } : entry)))}
                className="w-full"
              />
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Delete designation row"
              disabled={rows.length <= 1}
              onClick={() => onChangeRows(rows.filter((entry) => entry.id !== row.id))}
            >
              <XIcon className="size-3.5" />
            </Button>
          </div>
        ))}
      </div>
      <Button variant="outline" size="sm" className="w-fit" onClick={() => onChangeRows([...rows, createDesignationRow()])}>
        <PlusIcon data-icon="inline-start" className="size-3.5" />
        Add Row
      </Button>
    </div>
  )
}

/**
 * Each milestone carries its own Invoice Timing and a calculated (never
 * separately typed) Recognition Amount (task correction §4-6: "Invoice
 * Timing applies PER MILESTONE... one Non-Recurring Commercial may contain
 * a mix", "Recognition Amount should preferably be calculated from Total
 * Commercial Amount x Recognition %"). `basisAmount` is `null` whenever
 * this component's Pricing Model has no single total to allocate against
 * (see `nonRecurringMilestoneBasisAmount`); the Recognition Amount then
 * honestly shows "-" rather than a fabricated figure, and only Recognition
 * % remains meaningful.
 */
function MilestoneRowsEditor({
  milestones,
  basisAmount,
  currencyCode,
  onChangeMilestones,
}: {
  milestones: Milestone[]
  basisAmount: number | null
  currencyCode: string | null
  onChangeMilestones: (milestones: Milestone[]) => void
}) {
  const total = milestones.reduce((sum, milestone) => sum + (milestone.recognitionPercent ?? 0), 0)
  const totalIsValid = Math.abs(total - 100) < 0.001

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-foreground">Milestones</span>
      {basisAmount === null ? (
        <span className="text-[0.7rem] text-muted-foreground">
          Recognition Amount cannot be calculated for this Pricing Model; enter Recognition % for each milestone.
        </span>
      ) : null}
      <div className="flex flex-col gap-2">
        {milestones.map((milestone) => {
          const amount = calculateMilestoneAmount(basisAmount, milestone.recognitionPercent)
          return (
            <div key={milestone.id} className="grid grid-cols-2 items-end gap-2 rounded-md border p-2.5 sm:grid-cols-[1fr_auto_auto_auto_auto]">
              <div className="col-span-2 flex flex-col gap-1 sm:col-span-1">
                <span className="text-[0.7rem] text-muted-foreground">Milestone Name / Description</span>
                <Input
                  value={milestone.name}
                  onChange={(event) =>
                    onChangeMilestones(milestones.map((entry) => (entry.id === milestone.id ? { ...entry, name: event.target.value } : entry)))
                  }
                  placeholder="e.g. Go-Live"
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[0.7rem] text-muted-foreground">Recognition %</span>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  className="w-24"
                  value={milestone.recognitionPercent ?? ""}
                  onChange={(event) =>
                    onChangeMilestones(
                      milestones.map((entry) =>
                        entry.id === milestone.id ? { ...entry, recognitionPercent: event.target.value ? Number(event.target.value) : null } : entry
                      )
                    )
                  }
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[0.7rem] text-muted-foreground">Recognition Amount</span>
                <span className="flex h-9 items-center text-xs text-muted-foreground">{amount !== null ? formatAmount(amount, currencyCode) : "-"}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[0.7rem] text-muted-foreground">Invoice Timing</span>
                <OptionSelect
                  listKey="invoice_timing"
                  value={milestone.invoiceTiming}
                  onChange={(value) => onChangeMilestones(milestones.map((entry) => (entry.id === milestone.id ? { ...entry, invoiceTiming: value } : entry)))}
                  className="w-32"
                />
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Delete milestone"
                disabled={milestones.length <= 1}
                onClick={() => onChangeMilestones(milestones.filter((entry) => entry.id !== milestone.id))}
              >
                <XIcon className="size-3.5" />
              </Button>
            </div>
          )
        })}
      </div>
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" className="w-fit" onClick={() => onChangeMilestones([...milestones, createMilestone()])}>
          <PlusIcon data-icon="inline-start" className="size-3.5" />
          Add Milestone
        </Button>
        <span className={`text-[0.7rem] ${totalIsValid ? "text-muted-foreground" : "text-destructive"}`}>Total: {total}% (must equal 100%)</span>
      </div>
    </div>
  )
}

function RevenueRecognitionFields({
  recognition,
  basisAmount,
  currencyCode,
  onChange,
}: {
  recognition: RevenueRecognition
  basisAmount: number | null
  currencyCode: string | null
  onChange: (next: RevenueRecognition) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <FieldLabel>Revenue Recognition Method</FieldLabel>
      <ToggleGroup
        value={[recognition.method]}
        onValueChange={(value) => {
          if (!value[0]) return
          if (value[0] === "milestone_based") {
            onChange({ method: "milestone_based", milestones: [createMilestone()] })
          } else {
            onChange({ method: "full_recognition" })
          }
        }}
        variant="outline"
        size="sm"
        className="w-fit"
      >
        <ToggleGroupItem value="full_recognition">Full Recognition</ToggleGroupItem>
        <ToggleGroupItem value="milestone_based">Milestone Based</ToggleGroupItem>
      </ToggleGroup>
      {recognition.method === "milestone_based" ? (
        <MilestoneRowsEditor
          milestones={recognition.milestones}
          basisAmount={basisAmount}
          currencyCode={currencyCode}
          onChangeMilestones={(milestones) => onChange({ method: "milestone_based", milestones })}
        />
      ) : null}
    </div>
  )
}

/**
 * A component's Commercial Nature is fixed by the section it was created in
 * (Recurring / Non-Recurring / On-Demand) and never changes afterward (task
 * correction: "editing a row from a section preserves its Commercial
 * Nature... nature conversion should be an explicit business action, not
 * a silent Edit-time switch"). Only the Pricing Model remains editable.
 */

/** Rebuilds a component for a new Pricing Model, preserving name/notes/effective dates/invoice terms (Nature is unchanged). */
function changePricingModel(component: CommercialComponentDraft, pricingModel: PricingModel): CommercialComponentDraft {
  const fresh = createComponent(component.nature, pricingModel)
  return {
    ...fresh,
    id: component.id,
    description: component.description,
    notes: component.notes,
    effectiveFrom: component.effectiveFrom,
    effectiveTo: component.effectiveTo,
    invoiceTerms: component.invoiceTerms,
  }
}

function ComponentEditor({
  component,
  currencyCode,
  onChange,
  onCommit,
  onCancel,
  commitLabel,
}: {
  component: CommercialComponentDraft
  currencyCode: string | null
  onChange: (next: CommercialComponentDraft) => void
  onCommit: () => void
  onCancel?: () => void
  commitLabel: string
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex flex-col gap-1.5">
        <FieldLabel>Component Name</FieldLabel>
        <Input value={component.description} onChange={(event) => onChange({ ...component, description: event.target.value })} placeholder="e.g. SFA" />
      </div>

      <div className="sm:max-w-xs">
        <div className="flex flex-col gap-1.5">
          <FieldLabel>Pricing Model</FieldLabel>
          <OptionSelect listKey="pricing_model" value={component.pricingModel} onChange={(value) => onChange(changePricingModel(component, value as PricingModel))} />
        </div>
      </div>

      <Separator />

      {component.pricingModel === "per_unit" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <FieldLabel>Rate</FieldLabel>
            <Input type="number" min={0} value={component.rate ?? ""} onChange={(event) => onChange({ ...component, rate: event.target.value ? Number(event.target.value) : null })} placeholder="e.g. 50" />
          </div>
          <div className="flex flex-col gap-1.5">
            <FieldLabel>Per</FieldLabel>
            <OptionSelect listKey="pricing_unit" value={component.pricingUnit} onChange={(value) => onChange({ ...component, pricingUnit: value })} />
          </div>
        </div>
      ) : null}

      {component.pricingModel === "flat_fee" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <FieldLabel>{component.nature === "recurring" ? "Recurring Amount (monthly)" : "Amount"}</FieldLabel>
            <Input
              type="number"
              min={0}
              value={component.amount ?? ""}
              onChange={(event) => onChange({ ...component, amount: event.target.value ? Number(event.target.value) : null })}
              placeholder="e.g. 200000"
            />
          </div>
        </div>
      ) : null}

      {component.pricingModel === "slab" ? (
        <SlabRowsEditor
          pricingUnit={component.pricingUnit}
          slabMethod={component.slabMethod}
          rows={component.slabRows}
          onChangeUnit={(value) => onChange({ ...component, pricingUnit: value })}
          onChangeMethod={(value) => onChange({ ...component, slabMethod: value })}
          onChangeRows={(rows) => onChange({ ...component, slabRows: rows })}
        />
      ) : null}

      {component.pricingModel === "designation_based" ? (
        <DesignationRowsEditor
          rows={component.designationRows}
          onChangeRows={(rows) => {
            const next = { ...component, designationRows: rows } as CommercialComponentDraft
            if ("mug" in next && next.mug.enabled) {
              onChange({ ...next, mug: { ...next.mug, designationMinimums: syncDesignationMinimums(next.mug.designationMinimums, rows) } } as CommercialComponentDraft)
              return
            }
            onChange(next)
          }}
        />
      ) : null}

      <Separator />

      <InvoiceTermsFields component={component} onChange={onChange} />

      {"mug" in component ? (
        <>
          <Separator />
          <MugFields
            mug={component.mug}
            pricingModel={component.pricingModel}
            pricingUnitCode={mugUnitCode(component)}
            designationRows={component.pricingModel === "designation_based" ? component.designationRows : null}
            designationSummary={component.pricingModel === "designation_based" ? calculateDesignationMugSummary(component) : null}
            calculatedValue={calculateMugValue(component)}
            currencyCode={currencyCode}
            onChange={(mug) => onChange({ ...component, mug } as CommercialComponentDraft)}
          />
        </>
      ) : null}

      {component.nature === "non_recurring" ? (
        <>
          <Separator />
          <RevenueRecognitionFields
            recognition={component.revenueRecognition}
            basisAmount={nonRecurringMilestoneBasisAmount(component)}
            currencyCode={currencyCode}
            onChange={(revenueRecognition) => onChange({ ...component, revenueRecognition })}
          />
        </>
      ) : null}

      <Separator />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <FieldLabel>Effective From</FieldLabel>
          <Input type="date" value={component.effectiveFrom ?? ""} onChange={(event) => onChange({ ...component, effectiveFrom: event.target.value || null })} />
        </div>
        <div className="flex flex-col gap-1.5">
          <FieldLabel>Effective To (optional)</FieldLabel>
          <Input type="date" value={component.effectiveTo ?? ""} onChange={(event) => onChange({ ...component, effectiveTo: event.target.value || null })} />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <FieldLabel>Notes (optional)</FieldLabel>
        <Input value={component.notes} onChange={(event) => onChange({ ...component, notes: event.target.value })} placeholder="Optional context for Finance" />
      </div>

      <div className="flex items-center gap-2">
        <Button size="sm" onClick={onCommit}>
          {commitLabel}
        </Button>
        {onCancel ? (
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
    </div>
  )
}

/**
 * A Commercial Nature section (Recurring / Non-Recurring / On-Demand) shows
 * only the columns that mean something for it: MUG never applies to
 * Non-Recurring, Revenue Recognition is never captured for On-Demand, and
 * Nature itself is never its own column anywhere, since the section a
 * table lives in already says what Nature it is (task correction §1).
 */
type ColumnKey = "pricing" | "rate" | "mug" | "invoiceCycle" | "revenueRecognition" | "effectiveFrom"

const COLUMN_LABELS: Record<ColumnKey, string> = {
  pricing: "Pricing",
  rate: "Rate",
  mug: "MUG",
  invoiceCycle: "Invoice Cycle",
  revenueRecognition: "Revenue Recognition",
  effectiveFrom: "Effective From",
}

/**
 * Rate, MUG, and Revenue Recognition are always one-or-more lines now
 * (task correction §7-9, §13-15: actual Slab/Designation rates, the full
 * milestone schedule, dual-currency amounts, all fully visible rather
 * than truncated), never a single collapsed string; every other column
 * stays a single value. Revenue Recognition's blank lines (the spacer
 * between milestones) render as an empty line for visual separation.
 */
function ColumnValue({ column, cells }: { column: ColumnKey; cells: ComponentTableCells }) {
  if (column === "mug") {
    return (
      <div className="flex flex-col gap-0.5">
        {cells.mugQuantityLines.map((line, index) => (
          <span key={index}>{line}</span>
        ))}
        {cells.mugCalculatedLines.map((line, index) => (
          <span key={`calc-${index}`} className="text-muted-foreground">
            {line}
          </span>
        ))}
      </div>
    )
  }
  if (column === "rate") {
    return (
      <div className="flex flex-col gap-0.5">
        {cells.rateLines.map((line, index) => (
          <span key={index}>{line}</span>
        ))}
      </div>
    )
  }
  if (column === "revenueRecognition") {
    return (
      <div className="flex flex-col gap-0.5">
        {cells.revenueRecognitionLines.map((line, index) => (
          <span key={index} className={line === "" ? "h-1.5" : undefined}>
            {line}
          </span>
        ))}
      </div>
    )
  }
  return <>{cells[column]}</>
}

/**
 * Explains WHY a component is incomplete, not only that it is (task
 * correction: "Incomplete state must explain what is missing"): every
 * unmet requirement from `validateCommercialComponent`, shown compactly
 * right in the table so the user never has to click Edit just to
 * discover what is missing.
 */
function IncompleteDetail({ issues }: { issues: ComponentValidationIssue[] }) {
  return (
    <div className="flex flex-col gap-0.5">
      <Badge variant="ghost" className="w-fit bg-warning/10 text-warning">
        Incomplete
      </Badge>
      <ul className="flex flex-col gap-0.5 text-[0.7rem] text-warning">
        {issues.map((issue, index) => (
          <li key={index}>{issue.message}</li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Edit / Delete, shared identically by the desktop table row and the mobile
 * card (task correction §10: "the underlying information and actions must
 * remain identical"). Delete asks for confirmation before it actually
 * removes anything (task correction §9).
 */
function ComponentActions({
  onEdit,
  onDeleteClick,
  onConfirmDelete,
  onCancelDelete,
  confirmingDelete,
  disabled,
}: {
  onEdit: () => void
  onDeleteClick: () => void
  onConfirmDelete: () => void
  onCancelDelete: () => void
  confirmingDelete: boolean
  disabled?: boolean
}) {
  if (confirmingDelete) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[0.7rem] text-muted-foreground">Delete this component?</span>
        <Button variant="destructive" size="sm" onClick={onConfirmDelete}>
          Delete
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancelDelete}>
          Cancel
        </Button>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-1">
      <Button variant="outline" size="sm" onClick={onEdit} disabled={disabled}>
        Edit
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label="Delete component" onClick={onDeleteClick} disabled={disabled}>
        <XIcon className="size-3.5" />
      </Button>
    </div>
  )
}

function ComponentsTable({
  columns,
  components,
  currencyCode,
  confirmingDeleteId,
  onEdit,
  onDeleteClick,
  onConfirmDelete,
  onCancelDelete,
  disabled,
}: {
  columns: ColumnKey[]
  components: CommercialComponentDraft[]
  currencyCode: string | null
  confirmingDeleteId: string | null
  onEdit: (id: string) => void
  onDeleteClick: (id: string) => void
  onConfirmDelete: (id: string) => void
  onCancelDelete: () => void
  disabled: boolean
}) {
  return (
    <>
      <div className="hidden overflow-x-auto rounded-lg border sm:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Component</TableHead>
              {columns.map((column) => (
                <TableHead key={column}>{COLUMN_LABELS[column]}</TableHead>
              ))}
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {components.map((component) => {
              const cells = componentTableCells(component, currencyCode)
              const validation = validateCommercialComponent(component)
              return (
                <TableRow key={component.id}>
                  <TableCell className="font-medium text-foreground">
                    <div className="flex flex-col gap-0.5">
                      <span>{cells.name}</span>
                      {!validation.isComplete ? <IncompleteDetail issues={validation.issues} /> : null}
                    </div>
                  </TableCell>
                  {columns.map((column) => (
                    <TableCell key={column} className={column === "mug" || column === "revenueRecognition" ? "whitespace-normal" : undefined}>
                      <ColumnValue column={column} cells={cells} />
                    </TableCell>
                  ))}
                  <TableCell>
                    <ComponentActions
                      onEdit={() => onEdit(component.id)}
                      onDeleteClick={() => onDeleteClick(component.id)}
                      onConfirmDelete={() => onConfirmDelete(component.id)}
                      onCancelDelete={onCancelDelete}
                      confirmingDelete={confirmingDeleteId === component.id}
                      disabled={disabled}
                    />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-3 sm:hidden">
        {components.map((component) => {
          const cells = componentTableCells(component, currencyCode)
          const validation = validateCommercialComponent(component)
          return (
            <div key={component.id} className="flex flex-col gap-2 rounded-lg border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-foreground">{cells.name}</span>
                  {!validation.isComplete ? <IncompleteDetail issues={validation.issues} /> : null}
                </div>
              </div>
              <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-xs">
                {columns.map((column) => (
                  <Fragment key={column}>
                    <dt className="text-muted-foreground">{COLUMN_LABELS[column]}</dt>
                    <dd className="text-foreground">
                      <ColumnValue column={column} cells={cells} />
                    </dd>
                  </Fragment>
                ))}
              </dl>
              <ComponentActions
                onEdit={() => onEdit(component.id)}
                onDeleteClick={() => onDeleteClick(component.id)}
                onConfirmDelete={() => onConfirmDelete(component.id)}
                onCancelDelete={onCancelDelete}
                confirmingDelete={confirmingDeleteId === component.id}
                disabled={disabled}
              />
            </div>
          )
        })}
      </div>
    </>
  )
}

type OpenEditor = { mode: "add"; draft: CommercialComponentDraft } | { mode: "edit"; id: string } | null

const RECURRING_COLUMNS: ColumnKey[] = ["pricing", "rate", "mug", "invoiceCycle", "effectiveFrom"]
const NON_RECURRING_COLUMNS: ColumnKey[] = ["pricing", "rate", "revenueRecognition", "invoiceCycle", "effectiveFrom"]
const ON_DEMAND_COLUMNS: ColumnKey[] = ["pricing", "rate", "mug", "invoiceCycle", "effectiveFrom"]

/**
 * Three separate sections, one per Commercial Nature (task correction §1):
 * each section's own Add action creates a component with that Nature
 * already fixed, so the editor never asks the user to choose Nature again,
 * and each section's table only shows the columns that mean something for
 * it (Revenue Recognition never for On-Demand, MUG never for Non-Recurring).
 */
const NATURE_SECTIONS: {
  nature: CommercialNature
  title: string
  addLabel: string
  emptyMessage: string
  columns: ColumnKey[]
}[] = [
  {
    nature: "recurring",
    title: "Recurring Commercials",
    addLabel: "Add Recurring Component",
    emptyMessage: "No recurring commercials added yet.",
    columns: RECURRING_COLUMNS,
  },
  {
    nature: "non_recurring",
    title: "Non-Recurring Commercials",
    addLabel: "Add Non-Recurring Component",
    emptyMessage: "No non-recurring commercials added yet.",
    columns: NON_RECURRING_COLUMNS,
  },
  {
    nature: "on_demand",
    title: "On-Demand Commercials",
    addLabel: "Add On-Demand Component",
    emptyMessage: "No on-demand commercials added yet.",
    columns: ON_DEMAND_COLUMNS,
  },
]

function NatureSection({
  nature,
  title,
  addLabel,
  emptyMessage,
  columns,
  components,
  currencyCode,
  openEditor,
  onStartAdd,
  onEditorChange,
  onCommitAdd,
  onCancelAdd,
  onCommitEdit,
  onEditComponent,
  confirmingDeleteId,
  onDeleteClick,
  onConfirmDelete,
  onCancelDelete,
}: {
  nature: CommercialNature
  title: string
  addLabel: string
  emptyMessage: string
  columns: ColumnKey[]
  /** Every saved component of this Nature, unfiltered by editing state (this section derives that itself). */
  components: CommercialComponentDraft[]
  currencyCode: string | null
  openEditor: OpenEditor
  onStartAdd: (nature: CommercialNature) => void
  onEditorChange: (next: CommercialComponentDraft) => void
  onCommitAdd: () => void
  onCancelAdd: () => void
  onCommitEdit: () => void
  onEditComponent: (id: string) => void
  confirmingDeleteId: string | null
  onDeleteClick: (id: string) => void
  onConfirmDelete: (id: string) => void
  onCancelDelete: () => void
}) {
  const editingComponent = openEditor?.mode === "edit" ? (components.find((component) => component.id === openEditor.id) ?? null) : null
  const isAddingHere = openEditor?.mode === "add" && openEditor.draft.nature === nature
  const tableComponents = editingComponent ? components.filter((component) => component.id !== editingComponent.id) : components

  return (
    <div className="flex flex-col gap-3">
      <span className="text-sm font-semibold text-foreground">{title}</span>

      {tableComponents.length === 0 && !editingComponent && !isAddingHere ? <p className="text-xs text-muted-foreground">{emptyMessage}</p> : null}

      {editingComponent ? (
        <ComponentEditor component={editingComponent} currencyCode={currencyCode} onChange={onEditorChange} onCommit={onCommitEdit} commitLabel="Save Component" />
      ) : null}

      {tableComponents.length > 0 ? (
        <ComponentsTable
          columns={columns}
          components={tableComponents}
          currencyCode={currencyCode}
          confirmingDeleteId={confirmingDeleteId}
          onEdit={onEditComponent}
          onDeleteClick={onDeleteClick}
          onConfirmDelete={onConfirmDelete}
          onCancelDelete={onCancelDelete}
          disabled={openEditor !== null}
        />
      ) : null}

      {isAddingHere && openEditor?.mode === "add" ? (
        <ComponentEditor component={openEditor.draft} currencyCode={currencyCode} onChange={onEditorChange} onCommit={onCommitAdd} onCancel={onCancelAdd} commitLabel={addLabel} />
      ) : null}

      {openEditor === null ? (
        <Button variant="outline" size="sm" className="w-fit" onClick={() => onStartAdd(nature)}>
          <PlusIcon data-icon="inline-start" className="size-3.5" />
          {addLabel}
        </Button>
      ) : null}
    </div>
  )
}

/**
 * A compact, read-only INR Conversion Rate readout next to Billing
 * Currency (task correction §14): fetched from Reference Master, never a
 * field the user can type into or override from Commercial Rate (§13). If
 * no active rate is configured for this currency, this shows an
 * actionable validation message instead of inventing a value (§15); the
 * stage's own completeness check (`isCommercialRateDraftComplete`) already
 * refuses to mark the stage Complete in that state.
 */
function FxRateDisplay({ currencyCode }: { currencyCode: string }) {
  const rate = inrConversionRateFor(currencyCode)
  return (
    <div className="sm:max-w-xs sm:flex-1">
      <div className="flex flex-col gap-1.5">
        <FieldLabel>INR Conversion Rate</FieldLabel>
        {rate !== null ? (
          <span className="flex h-9 items-center rounded-md border bg-muted px-3 text-xs text-muted-foreground">
            1 {currencyCode} = INR {rate.toFixed(2)}
          </span>
        ) : (
          <span className="flex flex-col gap-1 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-[0.7rem] text-destructive">
            INR conversion rate is not configured for {currencyCode}. Configure it in Settings.
          </span>
        )}
      </div>
    </div>
  )
}

function CommercialRateSection({
  value,
  onChange,
  onPrevious,
  onSaveDraft,
  onNext,
}: {
  value: CommercialRateDraft
  onChange: (next: CommercialRateDraft) => void
  onPrevious: () => void
  onSaveDraft: () => void
  onNext: () => void
}) {
  const [openEditor, setOpenEditor] = useState<OpenEditor>(null)
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null)

  function updateComponent(id: string, next: CommercialComponentDraft) {
    onChange({ ...value, components: value.components.map((component) => (component.id === id ? next : component)) })
  }

  function deleteComponent(id: string) {
    onChange({ ...value, components: value.components.filter((component) => component.id !== id) })
    if (openEditor?.mode === "edit" && openEditor.id === id) setOpenEditor(null)
    setConfirmingDeleteId(null)
  }

  function startAdding(nature: CommercialNature) {
    setOpenEditor({ mode: "add", draft: createComponent(nature, defaultPricingModelFor(nature)) })
  }

  function commitAdd() {
    if (openEditor?.mode !== "add") return
    onChange({ ...value, components: [...value.components, openEditor.draft] })
    setOpenEditor(null)
  }

  function handleEditorChange(next: CommercialComponentDraft) {
    if (openEditor?.mode === "add") setOpenEditor({ mode: "add", draft: next })
    else if (openEditor?.mode === "edit") updateComponent(openEditor.id, next)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Commercial Rate</span>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="sm:max-w-xs sm:flex-1">
            <div className="flex flex-col gap-1.5">
              <FieldLabel>Billing Currency</FieldLabel>
              <OptionSelect listKey="currency" value={value.billingCurrency} onChange={(billingCurrency) => onChange({ ...value, billingCurrency })} className="w-full" />
            </div>
          </div>
          {isForeignCurrency(value.billingCurrency) ? <FxRateDisplay currencyCode={value.billingCurrency} /> : null}
        </div>
      </div>

      {NATURE_SECTIONS.map((section) => (
        <div key={section.nature} className="contents">
          <Separator />
          <NatureSection
            nature={section.nature}
            title={section.title}
            addLabel={section.addLabel}
            emptyMessage={section.emptyMessage}
            columns={section.columns}
            components={value.components.filter((component) => component.nature === section.nature)}
            currencyCode={value.billingCurrency}
            openEditor={openEditor}
            onStartAdd={startAdding}
            onEditorChange={handleEditorChange}
            onCommitAdd={commitAdd}
            onCancelAdd={() => setOpenEditor(null)}
            onCommitEdit={() => setOpenEditor(null)}
            onEditComponent={(id) => setOpenEditor({ mode: "edit", id })}
            confirmingDeleteId={confirmingDeleteId}
            onDeleteClick={(id) => setConfirmingDeleteId(id)}
            onConfirmDelete={deleteComponent}
            onCancelDelete={() => setConfirmingDeleteId(null)}
          />
        </div>
      ))}

      <Separator />

      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" size="sm" onClick={onPrevious}>
          Previous
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onSaveDraft}>
            Save Draft
          </Button>
          <Button size="sm" onClick={onNext}>
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}

export { CommercialRateSection }
