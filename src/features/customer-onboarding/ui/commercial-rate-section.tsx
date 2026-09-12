"use client"

import { useMemo, useState } from "react"
import { PlusIcon, XIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { getActiveOptions, resolveOption } from "@/features/reference-data"
import { mugUnitCode, summarizeComponent, unitLabel } from "../domain/commercial-rate-summary"
import {
  createComponent,
  createDesignationRow,
  createMilestone,
  createSlabRow,
  defaultPricingModelFor,
  isComponentComplete,
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
  onChange,
}: {
  mug: MugOverlay
  pricingUnitCode: string | null
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
              <Input
                type="number"
                min={0}
                value={row.from ?? ""}
                onChange={(event) =>
                  onChangeRows(rows.map((entry) => (entry.id === row.id ? { ...entry, from: event.target.value ? Number(event.target.value) : null } : entry)))
                }
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[0.7rem] text-muted-foreground">To {index === rows.length - 1 ? "(optional, open-ended)" : ""}</span>
              <Input
                type="number"
                min={0}
                value={row.to ?? ""}
                onChange={(event) =>
                  onChangeRows(rows.map((entry) => (entry.id === row.id ? { ...entry, to: event.target.value ? Number(event.target.value) : null } : entry)))
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
                  onChangeRows(rows.map((entry) => (entry.id === row.id ? { ...entry, rate: event.target.value ? Number(event.target.value) : null } : entry)))
                }
              />
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Delete slab row"
              disabled={rows.length <= 1}
              onClick={() => onChangeRows(rows.filter((entry) => entry.id !== row.id))}
            >
              <XIcon className="size-3.5" />
            </Button>
          </div>
        ))}
      </div>
      <Button variant="outline" size="sm" className="w-fit" onClick={() => onChangeRows([...rows, createSlabRow()])}>
        <PlusIcon data-icon="inline-start" className="size-3.5" />
        Add Row
      </Button>
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
  onChange,
  onCommit,
  onCancel,
  commitLabel,
}: {
  component: CommercialComponentDraft
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

function natureLabel(nature: CommercialNature): string {
  return resolveOption("commercial_nature", nature)?.label ?? nature
}

function modelLabel(pricingModel: PricingModel): string {
  return resolveOption("pricing_model", pricingModel)?.label ?? pricingModel
}

function ComponentSummaryCard({
  component,
  currencyCode,
  onEdit,
  onDelete,
  disabled,
}: {
  component: CommercialComponentDraft
  currencyCode: string | null
  onEdit: () => void
  onDelete: () => void
  disabled?: boolean
}) {
  const complete = isComponentComplete(component)
  const summaryLines = summarizeComponent(component, currencyCode)

  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-foreground">{component.description || "Untitled component"}</span>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="ghost" className="bg-muted text-muted-foreground">
              {natureLabel(component.nature)}
            </Badge>
            <Badge variant="ghost" className="bg-muted text-muted-foreground">
              {modelLabel(component.pricingModel)}
            </Badge>
            {!complete ? (
              <Badge variant="ghost" className="bg-warning/10 text-warning">
                Incomplete
              </Badge>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={onEdit} disabled={disabled}>
            Edit
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Delete component" onClick={onDelete} disabled={disabled}>
            <XIcon className="size-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-0.5">
        {summaryLines.map((line, index) => (
          <span key={index} className="text-xs text-muted-foreground">
            {line}
          </span>
        ))}
      </div>
    </div>
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

  function updateComponent(id: string, next: CommercialComponentDraft) {
    onChange({ ...value, components: value.components.map((component) => (component.id === id ? next : component)) })
  }

  function deleteComponent(id: string) {
    onChange({ ...value, components: value.components.filter((component) => component.id !== id) })
    if (openEditor?.mode === "edit" && openEditor.id === id) setOpenEditor(null)
  }

  function startAdding() {
    setOpenEditor({ mode: "add", draft: createComponent("recurring", "per_unit") })
  }

  function commitAdd() {
    if (openEditor?.mode !== "add") return
    onChange({ ...value, components: [...value.components, openEditor.draft] })
    setOpenEditor(null)
  }

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

        <div className="flex flex-col gap-3">
          {value.components.map((component) =>
            openEditor?.mode === "edit" && openEditor.id === component.id ? (
              <ComponentEditor
                key={component.id}
                component={component}
                onChange={(next) => updateComponent(component.id, next)}
                onCommit={() => setOpenEditor(null)}
                commitLabel="Save Component"
              />
            ) : openEditor === null ? (
              <ComponentSummaryCard
                key={component.id}
                component={component}
                currencyCode={value.billingCurrency}
                onEdit={() => setOpenEditor({ mode: "edit", id: component.id })}
                onDelete={() => deleteComponent(component.id)}
              />
            ) : (
              <ComponentSummaryCard
                key={component.id}
                component={component}
                currencyCode={value.billingCurrency}
                onEdit={() => {}}
                onDelete={() => {}}
                disabled
              />
            )
          )}
        </div>

        {openEditor?.mode === "add" ? (
          <ComponentEditor
            component={openEditor.draft}
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
