import { resolveOption } from "@/features/reference-data"
import { calculateMugValue } from "./commercial-rate"
import type { CommercialComponentDraft, CommercialNature, InvoiceTerms, MugOverlay, PricingModel, RevenueRecognition } from "./commercial-rate"

/**
 * Human-readable calculation-preview strings: illustrative display
 * summaries only, never a real invoice calculation. Every value here comes
 * straight from what the user typed into this component.
 */

function formatAmount(value: number | null, currencyCode: string | null): string {
  if (value === null) return "-"
  const formatted = value.toLocaleString("en-IN")
  return currencyCode ? `${currencyCode} ${formatted}` : formatted
}

function formatQuantity(value: number | null): string {
  if (value === null) return "-"
  return value.toLocaleString("en-IN")
}

/** Trims a decimal to at most one place, dropping a trailing ".0" (2.5, not 2.50; 5, not 5.0). */
function trimToOneDecimal(value: number): string {
  const rounded = Math.round(value * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

/**
 * A space-saving amount for table cells (e.g. "2.5L" for 2,50,000), never
 * used for the full, precise amounts shown in the component editor or the
 * calculation-preview lines. Lakh/thousand grouping matches the "en-IN"
 * digit grouping already used everywhere else in this stage, applied here as
 * a magnitude abbreviation rather than full digits, purely for column width.
 */
function formatCompactAmount(value: number | null, currencyCode: string | null): string {
  if (value === null) return "-"
  const magnitude = Math.abs(value)
  const compact =
    magnitude >= 100000 ? `${trimToOneDecimal(value / 100000)}L` : magnitude >= 1000 ? `${trimToOneDecimal(value / 1000)}K` : value.toLocaleString("en-IN")
  return currencyCode ? `${currencyCode} ${compact}` : compact
}

function unitLabel(pricingUnitCode: string | null): string {
  if (!pricingUnitCode) return "Unit"
  return resolveOption("pricing_unit", pricingUnitCode)?.label ?? pricingUnitCode
}

/** "Minimum Users", "Minimum Messages": pluralizes the unit label for a MUG quantity other than exactly one. */
function unitLabelForQuantity(pricingUnitCode: string | null, quantity: number | null): string {
  const label = unitLabel(pricingUnitCode)
  return quantity === 1 ? label : `${label}s`
}

function invoiceFrequencyLabel(code: string | null): string {
  if (!code) return ""
  return resolveOption("invoice_frequency", code)?.label ?? code
}

function invoiceTimingLabel(code: string | null): string {
  if (!code) return ""
  return resolveOption("invoice_timing", code)?.label ?? code
}

/** "Invoice: Half-Yearly Advance". Omits either half that has not been chosen yet (On-Demand's frequency is optional). */
function invoiceSummaryLine(terms: InvoiceTerms): string | null {
  const parts = [terms.invoiceFrequency ? invoiceFrequencyLabel(terms.invoiceFrequency) : null, terms.invoiceTiming ? invoiceTimingLabel(terms.invoiceTiming) : null].filter(
    (part): part is string => part !== null
  )
  if (parts.length === 0) return null
  return `Invoice: ${parts.join(" ")}`
}

/** "MUG: 5,000 Users": a unit quantity floor, never money. */
function mugSummaryLine(mug: MugOverlay, pricingUnitCode: string | null): string | null {
  if (!mug.enabled) return null
  return `MUG: ${formatQuantity(mug.minimumUnits)} ${unitLabelForQuantity(pricingUnitCode, mug.minimumUnits)}`
}

/**
 * "Calculated MUG Value: INR 2,50,000 / Month": a separate line from
 * `mugSummaryLine`, never merged into it, since the contractual MUG line
 * must stay demonstrably money-free while this one is explicitly the
 * derived monetary reference (task correction §1). Returns `null` when the
 * value cannot be reliably calculated (Designation Based, or missing
 * rate/rows), rather than showing a fabricated amount.
 */
function calculatedMugValueLine(component: CommercialComponentDraft, currencyCode: string | null): string | null {
  const amount = calculateMugValue(component)
  if (amount === null) return null
  return `Calculated MUG Value: ${formatAmount(amount, currencyCode)} / Month`
}

function natureLabel(nature: CommercialNature): string {
  return resolveOption("commercial_nature", nature)?.label ?? nature
}

function modelLabel(pricingModel: PricingModel): string {
  return resolveOption("pricing_model", pricingModel)?.label ?? pricingModel
}

/** "Revenue Recognition: Milestone Based (3 milestones)". */
function recognitionSummaryLine(recognition: RevenueRecognition): string {
  if (recognition.method === "full_recognition") return "Revenue Recognition: Full Recognition"
  const count = recognition.milestones.length
  return `Revenue Recognition: Milestone Based (${count} milestone${count === 1 ? "" : "s"})`
}

/** The Pricing Unit a component's MUG floors, resolved per Pricing Model (Designation Based uses its first row's Per, normally User). */
function mugUnitCode(component: Extract<CommercialComponentDraft, { nature: "recurring" | "on_demand" }>): string | null {
  if (component.pricingModel === "per_unit" || component.pricingModel === "slab") return component.pricingUnit
  if (component.pricingModel === "designation_based") return component.designationRows[0]?.per ?? "USER"
  return null
}

/**
 * One or more lines describing a single component: a pricing line (or one
 * per Slab row / Designation row), an optional MUG line, an Invoice line,
 * and, for Non-Recurring, a Revenue Recognition line.
 */
function summarizeComponent(component: CommercialComponentDraft, currencyCode: string | null): string[] {
  const lines: string[] = []

  if (component.pricingModel === "flat_fee") {
    const suffix = component.nature === "recurring" ? " / Month" : component.nature === "non_recurring" ? " one-time" : " per activity"
    lines.push(`${formatAmount(component.amount, currencyCode)}${suffix}`)
  } else if (component.pricingModel === "per_unit") {
    const suffix = component.nature === "recurring" ? " / Month" : ""
    lines.push(`${formatAmount(component.rate, currencyCode)} / ${unitLabel(component.pricingUnit)}${suffix}`)
  } else if (component.pricingModel === "slab") {
    const unit = unitLabel(component.pricingUnit)
    const methodLabel = component.slabMethod === "progressive" ? "Progressive" : "Whole Quantity"
    lines.push(`Slab (${methodLabel})`)
    for (const row of component.slabRows) {
      const range = row.to === null ? `${row.from ?? "-"}+` : `${row.from ?? "-"}-${row.to}`
      lines.push(`${range} ${unit}: ${formatAmount(row.rate, currencyCode)} / ${unit}`)
    }
  } else {
    for (const row of component.designationRows) {
      lines.push(`${row.designation || "Designation"}: ${formatAmount(row.rate, currencyCode)} / ${unitLabel(row.per)}`)
    }
  }

  if (component.nature !== "non_recurring" && "mug" in component) {
    const mugLine = mugSummaryLine(component.mug, mugUnitCode(component))
    if (mugLine) lines.push(mugLine)
    const calculatedLine = calculatedMugValueLine(component, currencyCode)
    if (calculatedLine) lines.push(calculatedLine)
  }

  const invoiceLine = invoiceSummaryLine(component.invoiceTerms)
  if (invoiceLine) lines.push(invoiceLine)

  if (component.nature === "non_recurring") {
    lines.push(recognitionSummaryLine(component.revenueRecognition))
  }

  return lines
}

/**
 * Concise, single-value rate summary for the Commercial Components table's
 * own Rate column ("₹50 / User", "₹2,00,000", "Whole Quantity / User", "3
 * Designation Rates"). Deliberately not the full multi-line
 * `summarizeComponent`, which stays for the open editor's own preview: a
 * table row has one line to work with per column.
 */
function rateColumnSummary(component: CommercialComponentDraft, currencyCode: string | null): string {
  if (component.pricingModel === "flat_fee") return formatAmount(component.amount, currencyCode)
  if (component.pricingModel === "per_unit") return `${formatAmount(component.rate, currencyCode)} / ${unitLabel(component.pricingUnit)}`
  if (component.pricingModel === "slab") {
    const methodLabel = component.slabMethod === "progressive" ? "Progressive" : "Whole Quantity"
    return `${methodLabel} / ${unitLabel(component.pricingUnit)}`
  }
  const count = component.designationRows.length
  return `${count} Designation Rate${count === 1 ? "" : "s"}`
}

/** "Monthly Advance", "Quarterly Postpaid", or "-" once neither half is chosen yet. */
function invoiceCycleColumnSummary(terms: InvoiceTerms): string {
  const parts = [terms.invoiceFrequency ? invoiceFrequencyLabel(terms.invoiceFrequency) : null, terms.invoiceTiming ? invoiceTimingLabel(terms.invoiceTiming) : null].filter(
    (part): part is string => part !== null
  )
  return parts.length > 0 ? parts.join(" ") : "-"
}

/**
 * Recurring is always Monthly revenue (docs §22); Non-Recurring shows its
 * own chosen method; On-Demand has no recognition concept captured in this
 * model at all, so this honestly shows "-" rather than inventing one.
 */
function recognitionColumnSummary(component: CommercialComponentDraft): string {
  if (component.nature === "recurring") return "Monthly"
  if (component.nature === "non_recurring") {
    return component.revenueRecognition.method === "milestone_based" ? "Milestone Based" : "Full Recognition"
  }
  return "-"
}

type ComponentTableCells = {
  name: string
  nature: string
  pricing: string
  rate: string
  mugQuantity: string
  mugCalculated: string | null
  invoiceCycle: string
  revenueRecognition: string
}

/**
 * Every value the Commercial Components table (and its mobile card
 * fallback) needs for one row, computed once so both layouts render
 * identically from the same source (task correction §10: "the underlying
 * information and actions must remain identical").
 */
function componentTableCells(component: CommercialComponentDraft, currencyCode: string | null): ComponentTableCells {
  const base = {
    name: component.description || "Untitled component",
    nature: natureLabel(component.nature),
    pricing: modelLabel(component.pricingModel),
    rate: rateColumnSummary(component, currencyCode),
    invoiceCycle: invoiceCycleColumnSummary(component.invoiceTerms),
    revenueRecognition: recognitionColumnSummary(component),
  }

  if (!("mug" in component) || !component.mug.enabled) {
    return { ...base, mugQuantity: "-", mugCalculated: null }
  }

  const quantityLine = mugSummaryLine(component.mug, mugUnitCode(component))
  const calculatedValue = calculateMugValue(component)
  return {
    ...base,
    mugQuantity: quantityLine ? quantityLine.replace("MUG: ", "") : "-",
    mugCalculated: calculatedValue !== null ? formatCompactAmount(calculatedValue, currencyCode) : null,
  }
}

export {
  formatAmount,
  formatQuantity,
  formatCompactAmount,
  unitLabel,
  unitLabelForQuantity,
  invoiceSummaryLine,
  mugSummaryLine,
  calculatedMugValueLine,
  mugUnitCode,
  natureLabel,
  modelLabel,
  recognitionSummaryLine,
  summarizeComponent,
  rateColumnSummary,
  invoiceCycleColumnSummary,
  recognitionColumnSummary,
  componentTableCells,
}
export type { ComponentTableCells }
