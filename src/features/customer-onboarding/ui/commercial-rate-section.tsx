"use client"

import { useMemo, useState } from "react"
import { PlusIcon, XIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { getActiveOptions, resolveOption } from "@/features/reference-data"
import { summarizeComponent } from "../domain/commercial-rate-summary"
import { createComponent, createDesignationRow, createSlabRow, isComponentComplete } from "../domain/commercial-rate"
import type {
  BillingTerms,
  CommercialComponentDraft,
  CommercialNature,
  CommercialRateDraft,
  DesignationRow,
  MugOverlay,
  OnDemandPricingType,
  RecurringPricingModel,
  SlabRow,
} from "../domain/commercial-rate"

/**
 * Commercial Rate stage UI (task spec §26): progressive disclosure over
 * Commercial Scope + Billing Currency, then repeatable Commercial
 * Components, each showing only the pricing fields its own Nature/Pricing
 * Model actually needs. A pure display/edit surface: nothing here
 * calculates a real bill (task spec §31 - the pricing summary lines are
 * illustrative only), and nothing here writes to Commercial Configuration;
 * see ../domain/commercial-rate.ts's header for the draft-capture design.
 */

/** The `pricing_model` Reference Master list holds both Recurring's four models and On-Demand's two, since they are the same system-supported concept; each context only offers its own subset. */
const RECURRING_PRICING_MODEL_VALUES = ["per_unit", "flat_fee", "slab", "designation_based"]
const ON_DEMAND_PRICING_TYPE_VALUES = ["per_unit", "fixed_fee"]

function selectLabel(listKey: Parameters<typeof getActiveOptions>[0], value: string | null): string {
  if (!value) return "Select..."
  return resolveOption(listKey, value)?.label ?? value
}

function OptionSelect({
  listKey,
  value,
  onChange,
  className,
  filterValues,
}: {
  listKey: Parameters<typeof getActiveOptions>[0]
  value: string | null
  onChange: (value: string) => void
  className?: string
  /** Restricts the offered choices to this subset (e.g. Pricing Model differs for Recurring vs On-Demand), without needing a second Reference Master list. */
  filterValues?: string[]
}) {
  const filterKey = filterValues?.join(",")
  const options = useMemo(() => {
    const all = getActiveOptions(listKey)
    return filterValues ? all.filter((option) => filterValues.includes(option.value)) : all
    // eslint-disable-next-line react-hooks/exhaustive-deps -- depends on filterKey (a stable string), not the filterValues array identity, which is a fresh literal on every render at call sites.
  }, [listKey, filterKey])
  return (
    // `value` is passed straight through, including `null`: base-ui's Select
    // treats an explicit `null` as "controlled, nothing selected" but treats
    // `undefined` as "uncontrolled", so `value ?? undefined` here would have
    // silently flipped this Select from uncontrolled to controlled the
    // moment a user made a first selection (null -> a real string), which
    // React (and base-ui) both warn against and do not support switching
    // mid-lifetime; every OptionSelect must be controlled from its very
    // first render.
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

function BillingTermsFields({
  terms,
  onChange,
  editableBillingCycle,
}: {
  terms: BillingTerms
  onChange: (next: BillingTerms) => void
  /** Non-Recurring and On-Demand fix their own Billing Cycle automatically (task spec §13/§14): shown read-only there, never user-editable. */
  editableBillingCycle: boolean
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <div className="flex flex-col gap-1.5">
        <FieldLabel>Billing Cycle</FieldLabel>
        {editableBillingCycle ? (
          <OptionSelect listKey="billing_cycle" value={terms.billingCycle} onChange={(value) => onChange({ ...terms, billingCycle: value })} />
        ) : (
          <Badge variant="ghost" className="w-fit bg-muted text-muted-foreground">
            {selectLabel("billing_cycle", terms.billingCycle)}
          </Badge>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <FieldLabel>Billing Timing</FieldLabel>
        <OptionSelect listKey="billing_timing" value={terms.billingTiming} onChange={(value) => onChange({ ...terms, billingTiming: value })} />
      </div>
      <div className="flex flex-col gap-1.5">
        <FieldLabel>Payment Terms</FieldLabel>
        <OptionSelect
          listKey="payment_terms"
          value={terms.paymentTerms.paymentTermsCode}
          onChange={(value) => onChange({ ...terms, paymentTerms: { paymentTermsCode: value, customPaymentDays: terms.paymentTerms.customPaymentDays } })}
        />
      </div>
      {terms.paymentTerms.paymentTermsCode === "custom" ? (
        <div className="flex flex-col gap-1.5">
          <FieldLabel>Payment Days</FieldLabel>
          <Input
            type="number"
            min={1}
            value={terms.paymentTerms.customPaymentDays ?? ""}
            onChange={(event) =>
              onChange({
                ...terms,
                paymentTerms: { ...terms.paymentTerms, customPaymentDays: event.target.value ? Number(event.target.value) : null },
              })
            }
            placeholder="e.g. 21"
          />
        </div>
      ) : null}
    </div>
  )
}

function MugFields({ mug, onChange }: { mug: MugOverlay; onChange: (next: MugOverlay) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <label className="flex items-center gap-2 text-xs text-foreground">
        <input
          type="checkbox"
          className="size-3.5 accent-foreground"
          checked={mug.enabled}
          onChange={(event) =>
            onChange(event.target.checked ? { enabled: true, amount: null, frequency: null } : { enabled: false })
          }
        />
        Minimum Usage Guarantee (MUG)
      </label>
      {mug.enabled ? (
        <div className="grid grid-cols-1 gap-3 pl-5.5 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <FieldLabel>MUG Amount</FieldLabel>
            <Input
              type="number"
              min={0}
              value={mug.amount ?? ""}
              onChange={(event) => onChange({ ...mug, amount: event.target.value ? Number(event.target.value) : null })}
              placeholder="e.g. 200000"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <FieldLabel>MUG Frequency</FieldLabel>
            <OptionSelect listKey="billing_cycle" value={mug.frequency} onChange={(value) => onChange({ ...mug, frequency: value })} />
          </div>
        </div>
      ) : null}
    </div>
  )
}

function componentNatureLabel(nature: CommercialNature): string {
  return resolveOption("commercial_nature", nature)?.label ?? nature
}

function componentModelLabel(component: CommercialComponentDraft): string {
  if (component.nature === "non_recurring") return "One-time charge"
  const code = component.nature === "on_demand" ? component.pricingType : component.pricingModel
  return resolveOption("pricing_model", code)?.label ?? code
}

function ComponentCard({
  component,
  currencyCode,
  onChange,
  onDelete,
}: {
  component: CommercialComponentDraft
  currencyCode: string | null
  onChange: (next: CommercialComponentDraft) => void
  onDelete: () => void
}) {
  const complete = isComponentComplete(component)
  const summaryLines = summarizeComponent(component, currencyCode)

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-1 flex-col gap-1.5">
          <FieldLabel>Component / Description</FieldLabel>
          <Input
            value={component.description}
            onChange={(event) => onChange({ ...component, description: event.target.value })}
            placeholder="e.g. SFA"
          />
        </div>
        <Button variant="ghost" size="icon-sm" aria-label="Delete component" onClick={onDelete} className="mt-5">
          <XIcon className="size-3.5" />
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="ghost" className="bg-muted text-muted-foreground">
          {componentNatureLabel(component.nature)}
        </Badge>
        <Badge variant="ghost" className="bg-muted text-muted-foreground">
          {componentModelLabel(component)}
        </Badge>
        {!complete ? (
          <Badge variant="ghost" className="bg-warning/10 text-warning">
            Incomplete
          </Badge>
        ) : null}
      </div>

      {component.nature === "recurring" && component.pricingModel === "per_unit" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <FieldLabel>Rate</FieldLabel>
            <Input type="number" min={0} value={component.rate ?? ""} onChange={(event) => onChange({ ...component, rate: event.target.value ? Number(event.target.value) : null })} placeholder="e.g. 50" />
          </div>
          <div className="flex flex-col gap-1.5">
            <FieldLabel>Per / Unit</FieldLabel>
            <OptionSelect listKey="pricing_unit" value={component.pricingUnit} onChange={(value) => onChange({ ...component, pricingUnit: value })} />
          </div>
        </div>
      ) : null}

      {component.nature === "recurring" && component.pricingModel === "flat_fee" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <FieldLabel>Recurring Amount</FieldLabel>
            <Input
              type="number"
              min={0}
              value={component.recurringAmount ?? ""}
              onChange={(event) => onChange({ ...component, recurringAmount: event.target.value ? Number(event.target.value) : null })}
              placeholder="e.g. 200000"
            />
          </div>
        </div>
      ) : null}

      {component.nature === "recurring" && component.pricingModel === "slab" ? (
        <SlabRowsEditor
          pricingUnit={component.pricingUnit}
          rows={component.slabRows}
          onChangeUnit={(value) => onChange({ ...component, pricingUnit: value })}
          onChangeRows={(rows) => onChange({ ...component, slabRows: rows })}
        />
      ) : null}

      {component.nature === "recurring" && component.pricingModel === "designation_based" ? (
        <DesignationRowsEditor rows={component.designationRows} onChangeRows={(rows) => onChange({ ...component, designationRows: rows })} />
      ) : null}

      {component.nature === "non_recurring" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <FieldLabel>Amount</FieldLabel>
            <Input type="number" min={0} value={component.amount ?? ""} onChange={(event) => onChange({ ...component, amount: event.target.value ? Number(event.target.value) : null })} placeholder="e.g. 500000" />
          </div>
          <div className="flex flex-col gap-1.5">
            <FieldLabel>Effective / Charge Date</FieldLabel>
            <Input type="date" value={component.chargeDate ?? ""} onChange={(event) => onChange({ ...component, chargeDate: event.target.value || null })} />
          </div>
        </div>
      ) : null}

      {component.nature === "on_demand" && component.pricingType === "per_unit" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <FieldLabel>Rate</FieldLabel>
            <Input type="number" min={0} value={component.rate ?? ""} onChange={(event) => onChange({ ...component, rate: event.target.value ? Number(event.target.value) : null })} placeholder="e.g. 0.15" />
          </div>
          <div className="flex flex-col gap-1.5">
            <FieldLabel>Per / Unit</FieldLabel>
            <OptionSelect listKey="pricing_unit" value={component.pricingUnit} onChange={(value) => onChange({ ...component, pricingUnit: value })} />
          </div>
        </div>
      ) : null}

      {component.nature === "on_demand" && component.pricingType === "fixed_fee" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <FieldLabel>Amount</FieldLabel>
            <Input type="number" min={0} value={component.amount ?? ""} onChange={(event) => onChange({ ...component, amount: event.target.value ? Number(event.target.value) : null })} placeholder="e.g. 100000" />
          </div>
        </div>
      ) : null}

      <Separator />

      <BillingTermsFields
        terms={component.billingTerms}
        onChange={(terms) => onChange({ ...component, billingTerms: terms })}
        editableBillingCycle={component.nature === "recurring"}
      />

      {"mug" in component ? (
        <>
          <Separator />
          <MugFields mug={component.mug} onChange={(mug) => onChange({ ...component, mug })} />
        </>
      ) : null}

      {component.nature !== "non_recurring" ? (
        <>
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
        </>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <FieldLabel>Notes (optional)</FieldLabel>
        <Input value={component.notes} onChange={(event) => onChange({ ...component, notes: event.target.value })} placeholder="Optional context for Finance" />
      </div>

      {summaryLines.length > 0 ? (
        <div className="flex flex-col gap-0.5 rounded-md border border-dashed px-3 py-2">
          {summaryLines.map((line, index) => (
            <span key={index} className="text-[0.7rem] text-muted-foreground">
              {line}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function SlabRowsEditor({
  pricingUnit,
  rows,
  onChangeUnit,
  onChangeRows,
}: {
  pricingUnit: string | null
  rows: SlabRow[]
  onChangeUnit: (value: string) => void
  onChangeRows: (rows: SlabRow[]) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-1.5 sm:max-w-xs">
        <FieldLabel>Per / Unit</FieldLabel>
        <OptionSelect listKey="pricing_unit" value={pricingUnit} onChange={onChangeUnit} />
      </div>

      <span className="text-xs font-medium text-foreground">
        Slab rows (the whole quantity is priced at the one slab it falls into, not progressively)
      </span>
      <div className="flex flex-col gap-2">
        {rows.map((row, index) => (
          <div key={row.id} className="grid grid-cols-[1fr_1fr_1fr_auto] items-end gap-2">
            <div className="flex flex-col gap-1">
              <span className="text-[0.7rem] text-muted-foreground">From</span>
              <Input type="number" min={0} value={row.from ?? ""} onChange={(event) => onChangeRows(rows.map((entry) => (entry.id === row.id ? { ...entry, from: event.target.value ? Number(event.target.value) : null } : entry)))} />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[0.7rem] text-muted-foreground">To {index === rows.length - 1 ? "(optional, open-ended)" : ""}</span>
              <Input type="number" min={0} value={row.to ?? ""} onChange={(event) => onChangeRows(rows.map((entry) => (entry.id === row.id ? { ...entry, to: event.target.value ? Number(event.target.value) : null } : entry)))} />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[0.7rem] text-muted-foreground">Rate</span>
              <Input type="number" min={0} value={row.rate ?? ""} onChange={(event) => onChangeRows(rows.map((entry) => (entry.id === row.id ? { ...entry, rate: event.target.value ? Number(event.target.value) : null } : entry)))} />
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

function DesignationRowsEditor({
  rows,
  onChangeRows,
}: {
  rows: DesignationRow[]
  onChangeRows: (rows: DesignationRow[]) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-foreground">Designation rows</span>
      <div className="flex flex-col gap-2">
        {rows.map((row) => (
          <div key={row.id} className="grid grid-cols-[1fr_1fr_1fr_auto] items-end gap-2">
            <div className="flex flex-col gap-1">
              <span className="text-[0.7rem] text-muted-foreground">Designation</span>
              <Input value={row.designation} onChange={(event) => onChangeRows(rows.map((entry) => (entry.id === row.id ? { ...entry, designation: event.target.value } : entry)))} placeholder="e.g. Sales Rep" />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[0.7rem] text-muted-foreground">Rate</span>
              <Input type="number" min={0} value={row.rate ?? ""} onChange={(event) => onChangeRows(rows.map((entry) => (entry.id === row.id ? { ...entry, rate: event.target.value ? Number(event.target.value) : null } : entry)))} />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[0.7rem] text-muted-foreground">Per</span>
              <OptionSelect listKey="pricing_unit" value={row.per} onChange={(value) => onChangeRows(rows.map((entry) => (entry.id === row.id ? { ...entry, per: value } : entry)))} className="w-full" />
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

function AddComponentForm({ onAdd }: { onAdd: (nature: CommercialNature, model?: RecurringPricingModel | OnDemandPricingType) => void }) {
  const [nature, setNature] = useState<CommercialNature>("recurring")
  const [recurringModel, setRecurringModel] = useState<RecurringPricingModel>("per_unit")
  const [onDemandType, setOnDemandType] = useState<OnDemandPricingType>("per_unit")

  return (
    <div className="flex flex-col gap-2 rounded-md border border-dashed px-3 py-3">
      <span className="text-xs font-medium text-muted-foreground">Add Commercial Component</span>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="flex flex-col gap-1">
          <span className="text-[0.7rem] text-muted-foreground">Commercial Nature</span>
          <OptionSelect listKey="commercial_nature" value={nature} onChange={(value) => setNature(value as CommercialNature)} className="w-full sm:w-40" />
        </div>
        {nature === "recurring" ? (
          <div className="flex flex-col gap-1">
            <span className="text-[0.7rem] text-muted-foreground">Pricing Model</span>
            <OptionSelect
              listKey="pricing_model"
              value={recurringModel}
              onChange={(value) => setRecurringModel(value as RecurringPricingModel)}
              className="w-full sm:w-44"
              filterValues={RECURRING_PRICING_MODEL_VALUES}
            />
          </div>
        ) : null}
        {nature === "on_demand" ? (
          <div className="flex flex-col gap-1">
            <span className="text-[0.7rem] text-muted-foreground">Pricing Type</span>
            <OptionSelect
              listKey="pricing_model"
              value={onDemandType}
              onChange={(value) => setOnDemandType(value as OnDemandPricingType)}
              className="w-full sm:w-44"
              filterValues={ON_DEMAND_PRICING_TYPE_VALUES}
            />
          </div>
        ) : null}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onAdd(nature, nature === "recurring" ? recurringModel : nature === "on_demand" ? onDemandType : undefined)}
        >
          <PlusIcon data-icon="inline-start" className="size-3.5" />
          Add Component
        </Button>
      </div>
    </div>
  )
}

function ApplyTermsToAllBar({ onApply, onClose }: { onApply: (terms: Partial<BillingTerms>) => void; onClose: () => void }) {
  const [billingCycle, setBillingCycle] = useState<string | null>(null)
  const [billingTiming, setBillingTiming] = useState<string | null>(null)
  const [paymentTerms, setPaymentTerms] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-2 rounded-md border border-dashed px-3 py-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          Apply Billing Terms to All (convenience only, applies once, each component still stores its own value)
        </span>
        <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={onClose}>
          <XIcon className="size-3.5" />
        </Button>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="flex flex-col gap-1">
          <span className="text-[0.7rem] text-muted-foreground">Billing Cycle</span>
          <OptionSelect listKey="billing_cycle" value={billingCycle} onChange={setBillingCycle} className="w-full sm:w-40" />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[0.7rem] text-muted-foreground">Billing Timing</span>
          <OptionSelect listKey="billing_timing" value={billingTiming} onChange={setBillingTiming} className="w-full sm:w-40" />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[0.7rem] text-muted-foreground">Payment Terms</span>
          <OptionSelect listKey="payment_terms" value={paymentTerms} onChange={setPaymentTerms} className="w-full sm:w-40" />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const patch: Partial<BillingTerms> = {}
            if (billingCycle) patch.billingCycle = billingCycle
            if (billingTiming) patch.billingTiming = billingTiming
            if (paymentTerms) patch.paymentTerms = { paymentTermsCode: paymentTerms, customPaymentDays: null }
            onApply(patch)
            onClose()
          }}
        >
          Apply to All
        </Button>
      </div>
    </div>
  )
}

function CommercialRateSection({ value, onChange }: { value: CommercialRateDraft; onChange: (next: CommercialRateDraft) => void }) {
  const [applyToAllOpen, setApplyToAllOpen] = useState(false)

  function updateComponent(id: string, next: CommercialComponentDraft) {
    onChange({ ...value, components: value.components.map((component) => (component.id === id ? next : component)) })
  }

  function deleteComponent(id: string) {
    onChange({ ...value, components: value.components.filter((component) => component.id !== id) })
  }

  function addComponent(nature: CommercialNature, model?: RecurringPricingModel | OnDemandPricingType) {
    const next =
      nature === "recurring"
        ? createComponent("recurring", (model as RecurringPricingModel) ?? "per_unit")
        : nature === "on_demand"
          ? createComponent("on_demand", (model as OnDemandPricingType) ?? "per_unit")
          : createComponent("non_recurring")
    onChange({ ...value, components: [...value.components, next] })
  }

  function applyTermsToAll(patch: Partial<BillingTerms>) {
    onChange({
      ...value,
      components: value.components.map((component) => ({
        ...component,
        billingTerms: {
          ...component.billingTerms,
          ...(patch.billingCycle && component.nature === "recurring" ? { billingCycle: patch.billingCycle } : {}),
          ...(patch.billingTiming ? { billingTiming: patch.billingTiming } : {}),
          ...(patch.paymentTerms ? { paymentTerms: patch.paymentTerms } : {}),
        },
      })),
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Commercial Rate</span>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <FieldLabel>Commercial Scope / Package Name</FieldLabel>
            <Input
              value={value.commercialScope}
              onChange={(event) => onChange({ ...value, commercialScope: event.target.value })}
              placeholder="e.g. SFA + DMS"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <FieldLabel>Billing Currency</FieldLabel>
            <OptionSelect listKey="currency" value={value.billingCurrency} onChange={(billingCurrency) => onChange({ ...value, billingCurrency })} className="w-full" />
          </div>
        </div>
      </div>

      <Separator />

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Commercial Components</span>
          {value.components.length > 1 ? (
            <Button variant="outline" size="sm" onClick={() => setApplyToAllOpen((open) => !open)}>
              Apply Billing Terms to All
            </Button>
          ) : null}
        </div>

        {applyToAllOpen ? <ApplyTermsToAllBar onApply={applyTermsToAll} onClose={() => setApplyToAllOpen(false)} /> : null}

        {value.components.length === 0 ? (
          <p className="text-xs text-muted-foreground">No commercial components yet. Add one below.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {value.components.map((component) => (
              <ComponentCard
                key={component.id}
                component={component}
                currencyCode={value.billingCurrency}
                onChange={(next) => updateComponent(component.id, next)}
                onDelete={() => deleteComponent(component.id)}
              />
            ))}
          </div>
        )}

        <AddComponentForm onAdd={addComponent} />
      </div>
    </div>
  )
}

export { CommercialRateSection }
