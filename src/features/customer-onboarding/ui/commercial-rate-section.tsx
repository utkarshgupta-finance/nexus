"use client"

import { useMemo, useState } from "react"
import { PlusIcon, XIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { getActiveOptions, resolveOption } from "@/features/reference-data"
import { componentTableCells, formatAmount, mugUnitCode, unitLabel } from "../domain/commercial-rate-summary"
import {
  calculateMugValue,
  createComponent,
  createDesignationRow,
  createMilestone,
  createSlabRow,
  defaultPricingModelFor,
  isComponentComplete,
  recalculateSlabFroms,
} from "../domain/commercial-rate"
import type {
  CommercialComponentDraft,
  CommercialNature,
  CommercialRateDraft,
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
        <OptionSelect
          listKey="invoice_timing"
          value={component.invoiceTerms.invoiceTiming}
          onChange={(value) => onChange({ ...component, invoiceTerms: { ...component.invoiceTerms, invoiceTiming: value } })}
        />
      </div>
    </div>
  )
}

function MugFields({
  mug,
  pricingUnitCode,
  calculatedValue,
  currencyCode,
  onChange,
}: {
  mug: MugOverlay
  pricingUnitCode: string | null
  /** Derived preview only, never a separately editable/stored field (task correction §1): null when it cannot be reliably calculated (e.g. Designation Based). */
  calculatedValue: number | null
  currencyCode: string | null
  onChange: (next: MugOverlay) => void
}) {
  const unitWord = `${unitLabel(pricingUnitCode)}s`
  return (
    <div className="flex flex-col gap-2">
      <label className="flex items-center gap-2 text-xs text-foreground">
        <input
          type="checkbox"
          className="size-3.5 accent-foreground"
          checked={mug.enabled}
          onChange={(event) => onChange(event.target.checked ? { enabled: true, minimumUnits: null } : { enabled: false })}
        />
        Minimum Usage Guarantee (MUG)
      </label>
      {mug.enabled ? (
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
              <span className="text-xs text-muted-foreground">{formatAmount(calculatedValue, currencyCode)} / Month</span>
            </div>
          ) : null}
        </div>
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

function MilestoneRowsEditor({ milestones, onChangeMilestones }: { milestones: Milestone[]; onChangeMilestones: (milestones: Milestone[]) => void }) {
  const total = milestones.reduce((sum, milestone) => sum + (milestone.recognitionPercent ?? 0), 0)
  const totalIsValid = Math.abs(total - 100) < 0.001

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-foreground">Milestones</span>
      <div className="flex flex-col gap-2">
        {milestones.map((milestone) => (
          <div key={milestone.id} className="grid grid-cols-[1fr_auto_auto] items-end gap-2">
            <div className="flex flex-col gap-1">
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
        ))}
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
  onChange,
}: {
  recognition: RevenueRecognition
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
        <MilestoneRowsEditor milestones={recognition.milestones} onChangeMilestones={(milestones) => onChange({ method: "milestone_based", milestones })} />
      ) : null}
    </div>
  )
}

/**
 * Rebuilds a component for a new Nature, resetting Pricing Model to that
 * Nature's own default (Recurring -> Per Unit, Non-Recurring/On-Demand ->
 * Flat Fee), matching "the user can change the model after defaulting."
 * Preserves name/notes/effective dates; Invoice Terms reset since
 * Non-Recurring's own frequency is fixed automatically.
 */
function changeNature(component: CommercialComponentDraft, nature: CommercialNature): CommercialComponentDraft {
  const fresh = createComponent(nature, defaultPricingModelFor(nature))
  return { ...fresh, id: component.id, description: component.description, notes: component.notes, effectiveFrom: component.effectiveFrom, effectiveTo: component.effectiveTo }
}

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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <FieldLabel>Commercial Nature</FieldLabel>
          <OptionSelect listKey="commercial_nature" value={component.nature} onChange={(value) => onChange(changeNature(component, value as CommercialNature))} />
        </div>
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
        <DesignationRowsEditor rows={component.designationRows} onChangeRows={(rows) => onChange({ ...component, designationRows: rows })} />
      ) : null}

      <Separator />

      <InvoiceTermsFields component={component} onChange={onChange} />

      {"mug" in component ? (
        <>
          <Separator />
          <MugFields
            mug={component.mug}
            pricingUnitCode={mugUnitCode(component)}
            calculatedValue={calculateMugValue(component)}
            currencyCode={currencyCode}
            onChange={(mug) => onChange({ ...component, mug } as CommercialComponentDraft)}
          />
        </>
      ) : null}

      {component.nature === "non_recurring" ? (
        <>
          <Separator />
          <RevenueRecognitionFields recognition={component.revenueRecognition} onChange={(revenueRecognition) => onChange({ ...component, revenueRecognition })} />
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

const TABLE_COLUMNS = ["Component", "Nature", "Pricing", "Rate", "MUG", "Invoice Cycle", "Revenue Recognition", "Actions"]

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
  components,
  currencyCode,
  confirmingDeleteId,
  onEdit,
  onDeleteClick,
  onConfirmDelete,
  onCancelDelete,
  disabled,
}: {
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
              {TABLE_COLUMNS.map((column) => (
                <TableHead key={column}>{column}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {components.map((component) => {
              const cells = componentTableCells(component, currencyCode)
              const complete = isComponentComplete(component)
              return (
                <TableRow key={component.id}>
                  <TableCell className="font-medium text-foreground">
                    <div className="flex flex-col gap-0.5">
                      <span>{cells.name}</span>
                      {!complete ? (
                        <Badge variant="ghost" className="w-fit bg-warning/10 text-warning">
                          Incomplete
                        </Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>{cells.nature}</TableCell>
                  <TableCell>{cells.pricing}</TableCell>
                  <TableCell>{cells.rate}</TableCell>
                  <TableCell className="whitespace-normal">
                    <div className="flex flex-col gap-0.5">
                      <span>{cells.mugQuantity}</span>
                      {cells.mugCalculated ? <span className="text-muted-foreground">{cells.mugCalculated}</span> : null}
                    </div>
                  </TableCell>
                  <TableCell>{cells.invoiceCycle}</TableCell>
                  <TableCell>{cells.revenueRecognition}</TableCell>
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
          const complete = isComponentComplete(component)
          return (
            <div key={component.id} className="flex flex-col gap-2 rounded-lg border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-foreground">{cells.name}</span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="ghost" className="bg-muted text-muted-foreground">
                      {cells.nature}
                    </Badge>
                    <Badge variant="ghost" className="bg-muted text-muted-foreground">
                      {cells.pricing}
                    </Badge>
                    {!complete ? (
                      <Badge variant="ghost" className="bg-warning/10 text-warning">
                        Incomplete
                      </Badge>
                    ) : null}
                  </div>
                </div>
              </div>
              <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-xs">
                <dt className="text-muted-foreground">Rate</dt>
                <dd className="text-foreground">{cells.rate}</dd>
                <dt className="text-muted-foreground">MUG</dt>
                <dd className="text-foreground">
                  {cells.mugQuantity}
                  {cells.mugCalculated ? <span className="block text-muted-foreground">{cells.mugCalculated}</span> : null}
                </dd>
                <dt className="text-muted-foreground">Invoice Cycle</dt>
                <dd className="text-foreground">{cells.invoiceCycle}</dd>
                <dt className="text-muted-foreground">Revenue Recognition</dt>
                <dd className="text-foreground">{cells.revenueRecognition}</dd>
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

  function startAdding() {
    setOpenEditor({ mode: "add", draft: createComponent("recurring", "per_unit") })
  }

  function commitAdd() {
    if (openEditor?.mode !== "add") return
    onChange({ ...value, components: [...value.components, openEditor.draft] })
    setOpenEditor(null)
  }

  const editingComponent =
    openEditor?.mode === "edit" ? (value.components.find((component) => component.id === openEditor.id) ?? null) : null
  const tableComponents = editingComponent ? value.components.filter((component) => component.id !== editingComponent.id) : value.components

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Commercial Rate</span>
        <div className="sm:max-w-xs">
          <div className="flex flex-col gap-1.5">
            <FieldLabel>Billing Currency</FieldLabel>
            <OptionSelect listKey="currency" value={value.billingCurrency} onChange={(billingCurrency) => onChange({ ...value, billingCurrency })} className="w-full" />
          </div>
        </div>
      </div>

      <Separator />

      <div className="flex flex-col gap-3">
        <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Commercial Components</span>

        {value.components.length === 0 && openEditor === null ? <p className="text-xs text-muted-foreground">No commercial components yet. Add one below.</p> : null}

        {editingComponent ? (
          <ComponentEditor
            component={editingComponent}
            currencyCode={value.billingCurrency}
            onChange={(next) => updateComponent(editingComponent.id, next)}
            onCommit={() => setOpenEditor(null)}
            commitLabel="Save Component"
          />
        ) : null}

        {tableComponents.length > 0 ? (
          <ComponentsTable
            components={tableComponents}
            currencyCode={value.billingCurrency}
            confirmingDeleteId={confirmingDeleteId}
            onEdit={(id) => setOpenEditor({ mode: "edit", id })}
            onDeleteClick={(id) => setConfirmingDeleteId(id)}
            onConfirmDelete={deleteComponent}
            onCancelDelete={() => setConfirmingDeleteId(null)}
            disabled={openEditor !== null}
          />
        ) : null}

        {openEditor?.mode === "add" ? (
          <ComponentEditor
            component={openEditor.draft}
            currencyCode={value.billingCurrency}
            onChange={(next) => setOpenEditor({ mode: "add", draft: next })}
            onCommit={commitAdd}
            onCancel={() => setOpenEditor(null)}
            commitLabel="Add Component"
          />
        ) : null}

        {openEditor === null ? (
          <Button variant="outline" size="sm" className="w-fit" onClick={startAdding}>
            <PlusIcon data-icon="inline-start" className="size-3.5" />
            {value.components.length === 0 ? "Add Component" : "Add Another Component"}
          </Button>
        ) : null}
      </div>

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
