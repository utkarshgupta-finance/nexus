import { resolveOption } from "@/features/reference-data"
import type { CommercialComponentDraft, InvoiceTerms, MugOverlay, RevenueRecognition } from "./commercial-rate"

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
  }

  const invoiceLine = invoiceSummaryLine(component.invoiceTerms)
  if (invoiceLine) lines.push(invoiceLine)

  if (component.nature === "non_recurring") {
    lines.push(recognitionSummaryLine(component.revenueRecognition))
  }

  return lines
}

export {
  formatAmount,
  formatQuantity,
  unitLabel,
  unitLabelForQuantity,
  invoiceSummaryLine,
  mugSummaryLine,
  mugUnitCode,
  recognitionSummaryLine,
  summarizeComponent,
}
