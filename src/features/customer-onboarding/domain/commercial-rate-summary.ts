import { resolveOption } from "@/features/reference-data"
import {
  calculateDesignationMugSummary,
  calculateMilestoneAmount,
  calculateMugValue,
  designationMinimumUnitsFor,
  nonRecurringMilestoneBasisAmount,
} from "./commercial-rate"
import type { CommercialComponentDraft, CommercialNature, InvoiceTerms, Milestone, MugOverlay, PricingModel, RevenueRecognition } from "./commercial-rate"
import { isForeignCurrency, toInr } from "./commercial-rate-fx"

/**
 * Human-readable calculation-preview strings: illustrative display
 * summaries only, never a real invoice calculation. Every value here comes
 * straight from what the user typed into this component, plus (task
 * correction, "ADDITIONAL COMMERCIAL RATE TABLE STRUCTURE/FX CORRECTION")
 * a read-only INR equivalent wherever Billing Currency is not already INR,
 * resolved from Reference Master's own governed rate (`commercial-rate-fx.ts`).
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

/**
 * One line for the transaction (Billing Currency) amount, plus a second
 * line for its INR equivalent whenever Billing Currency is foreign and a
 * governed rate is configured (task correction §9-10, §17, §19-20): never
 * shown for INR itself (nothing to convert), and never a second line at
 * all when the rate is not configured (§15's validation state is the place
 * that surfaces that gap, not a silently-dropped or invented conversion
 * here). `formatter` lets callers choose full precision (`formatAmount`,
 * for Rate cells) or compact (`formatCompactAmount`, for MUG's monetary
 * total) without duplicating this branching twice.
 */
function dualCurrencyLines(amount: number | null, currencyCode: string | null, suffix: string, formatter: (value: number | null, currencyCode: string | null) => string): string[] {
  if (amount === null) return []
  const primary = `${formatter(amount, currencyCode)}${suffix}`
  if (!isForeignCurrency(currencyCode)) return [primary]
  const inrAmount = toInr(amount, currencyCode)
  return inrAmount === null ? [primary] : [primary, `${formatter(inrAmount, "INR")}${suffix}`]
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

/** "MUG: 5,000 Users": a unit quantity floor, never money. Not meaningful for Designation Based, which has one Minimum Units per designation instead (see `designationMugQuantityLines`). */
function mugSummaryLine(mug: MugOverlay, pricingUnitCode: string | null): string | null {
  if (!mug.enabled) return null
  return `MUG: ${formatQuantity(mug.minimumUnits)} ${unitLabelForQuantity(pricingUnitCode, mug.minimumUnits)}`
}

/**
 * "Calculated MUG Value: INR 2,50,000 / Month": a separate line from
 * `mugSummaryLine`, never merged into it, since the contractual MUG line
 * must stay demonstrably money-free while this one is explicitly the
 * derived monetary reference (task correction §1). Returns `null` when the
 * value cannot be reliably calculated (missing rate/rows), rather than
 * showing a fabricated amount.
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
 * Concise Pricing column label ("Per Unit", "Flat Fee", "Slab - Whole
 * Quantity", "Slab - Progressive", "Designation Based"). Slab's own Method
 * lives here, in the Pricing column, never folded into Rate: Rate is
 * reserved for the component's actual, real rates (task correction §7-8:
 * "do not show only Progressive / User... the Pricing column already
 * communicates the model").
 */
function pricingColumnSummary(component: CommercialComponentDraft): string {
  if (component.pricingModel === "slab") {
    const methodLabel = component.slabMethod === "progressive" ? "Progressive" : "Whole Quantity"
    return `Slab - ${methodLabel}`
  }
  return modelLabel(component.pricingModel)
}

/**
 * One line per Slab band, the component's actual contracted rate, never a
 * generic "Whole Quantity / User" placeholder (task correction §7, §19):
 * "1-100: INR 500 / User", or with an INR equivalent appended in
 * parentheses once Billing Currency is foreign and a rate is configured:
 * "1-100: USD 10 / User (INR 910 / User)". One line per band keeps this
 * compact even with several bands, rather than a separate INR line per
 * band, which would double the cell's height for no added clarity (a
 * single band has only one value to disambiguate).
 */
function slabRateLines(component: Extract<CommercialComponentDraft, { pricingModel: "slab" }>, currencyCode: string | null): string[] {
  const unit = unitLabel(component.pricingUnit)
  return component.slabRows.map((row) => {
    const range = row.to === null ? `${row.from ?? "-"}+` : `${row.from ?? "-"}-${row.to}`
    const primary = `${formatAmount(row.rate, currencyCode)} / ${unit}`
    if (row.rate === null || !isForeignCurrency(currencyCode)) return `${range}: ${primary}`
    const inrAmount = toInr(row.rate, currencyCode)
    return inrAmount === null ? `${range}: ${primary}` : `${range}: ${primary} (${formatAmount(inrAmount, "INR")} / ${unit})`
  })
}

/**
 * One line per designation, the component's actual contracted rate, never
 * a generic "N Designation Rates" placeholder (task correction §8, §20).
 * Every row is shown, never collapsed behind a "+N more" line (task
 * correction: "the user explicitly wants all visible"): "Sales Rep: INR
 * 100 / User", or with an INR equivalent in parentheses for a foreign
 * Billing Currency.
 */
function designationRateLines(component: Extract<CommercialComponentDraft, { pricingModel: "designation_based" }>, currencyCode: string | null): string[] {
  return component.designationRows.map((row) => {
    const unit = unitLabel(row.per)
    const primary = `${formatAmount(row.rate, currencyCode)} / ${unit}`
    const label = row.designation || "Designation"
    if (row.rate === null || !isForeignCurrency(currencyCode)) return `${label}: ${primary}`
    const inrAmount = toInr(row.rate, currencyCode)
    return inrAmount === null ? `${label}: ${primary}` : `${label}: ${primary} (${formatAmount(inrAmount, "INR")} / ${unit})`
  })
}

/**
 * The Commercial Components table's own Rate column: the component's
 * actual, real contracted rate(s), one line per Slab band or Designation
 * row, never a row-count or method-name placeholder (task correction §7-9,
 * §19-20: "do not show only Progressive / User", "do NOT show 4
 * Designation Rates"). Per Unit and Flat Fee are a single value, so a
 * single (or, for a foreign Billing Currency, dual-currency) line.
 */
function rateColumnLines(component: CommercialComponentDraft, currencyCode: string | null): string[] {
  if (component.pricingModel === "flat_fee") return dualCurrencyLines(component.amount, currencyCode, "", formatAmount)
  if (component.pricingModel === "per_unit") return dualCurrencyLines(component.rate, currencyCode, ` / ${unitLabel(component.pricingUnit)}`, formatAmount)
  if (component.pricingModel === "slab") return slabRateLines(component, currencyCode)
  return designationRateLines(component, currencyCode)
}

/** "01-Oct-2026", or "-" once no Effective From has been chosen yet. Never a raw ISO date string in a table cell. */
function formatEffectiveDate(value: string | null): string {
  if (!value) return "-"
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return "-"
  const day = String(date.getDate()).padStart(2, "0")
  const month = date.toLocaleString("en-US", { month: "short" })
  return `${day}-${month}-${date.getFullYear()}`
}

/**
 * "Monthly Advance", "Quarterly Postpaid", or "-" once neither half is
 * chosen yet. A Non-Recurring component whose Revenue Recognition Method is
 * Milestone Based shows Invoice Frequency alone ("One-Time"): Invoice
 * Timing lives per milestone in that case (task correction §6), so the
 * component-level Timing no longer applies and would be misleading here.
 */
function invoiceCycleColumnSummary(component: CommercialComponentDraft): string {
  const usesMilestoneTiming = component.nature === "non_recurring" && component.revenueRecognition.method === "milestone_based"
  const parts = [
    component.invoiceTerms.invoiceFrequency ? invoiceFrequencyLabel(component.invoiceTerms.invoiceFrequency) : null,
    !usesMilestoneTiming && component.invoiceTerms.invoiceTiming ? invoiceTimingLabel(component.invoiceTerms.invoiceTiming) : null,
  ].filter((part): part is string => part !== null)
  return parts.length > 0 ? parts.join(" ") : "-"
}

/**
 * One milestone's own detail block: Name, Recognition %, Recognition
 * Amount (dual currency for a foreign Billing Currency), Invoice Timing
 * (task correction §8-9: "do not show only Milestone Based... show each
 * milestone with Name/%/Amount/Timing"). Returns 4-5 lines depending on
 * whether an INR equivalent applies.
 */
function milestoneDetailLines(milestone: Milestone, basisAmount: number | null, currencyCode: string | null): string[] {
  const amount = calculateMilestoneAmount(basisAmount, milestone.recognitionPercent)
  const amountLines = dualCurrencyLines(amount, currencyCode, "", formatAmount)
  return [
    milestone.name || "Milestone",
    milestone.recognitionPercent !== null ? `${milestone.recognitionPercent}%` : "-",
    ...(amountLines.length > 0 ? amountLines : ["-"]),
    milestone.invoiceTiming ? invoiceTimingLabel(milestone.invoiceTiming) : "-",
  ]
}

/**
 * Recurring is always Monthly revenue (docs §22); On-Demand has no
 * recognition concept captured in this model at all, so this honestly
 * shows "-" rather than inventing one. Non-Recurring Full Recognition
 * stays a single concise line (task correction §10). Non-Recurring
 * Milestone Based shows the ENTIRE milestone schedule (task correction
 * §8-9, §15): every milestone's own Name/%/Amount/Timing, never a bare
 * "Milestone Based" label and never collapsed behind a "+N more" line, so
 * Finance can read the whole revenue structure straight from the table.
 */
function recognitionColumnLines(component: CommercialComponentDraft, currencyCode: string | null): string[] {
  if (component.nature !== "non_recurring") return component.nature === "recurring" ? ["Monthly"] : ["-"]
  if (component.revenueRecognition.method === "full_recognition") return ["Full Recognition"]

  const basisAmount = nonRecurringMilestoneBasisAmount(component)
  const lines: string[] = []
  component.revenueRecognition.milestones.forEach((milestone, index) => {
    if (index > 0) lines.push("")
    lines.push(...milestoneDetailLines(milestone, basisAmount, currencyCode))
  })
  return lines
}

/**
 * MUG column's quantity lines (task correction §11): a single line for Per
 * Unit/Slab ("5,000 Users"), or one line per designation plus a final
 * "Total: N Units" line for Designation Based ("Sales Rep: 500", "Manager:
 * 50", "Total: 550 Users"), or `["-"]` once MUG is off or not applicable.
 */
function mugQuantityLines(component: CommercialComponentDraft): string[] {
  if (!("mug" in component) || !component.mug.enabled) return ["-"]

  if (component.pricingModel === "designation_based") {
    const mug = component.mug
    const lines = component.designationRows.map((row) => `${row.designation || "Designation"}: ${formatQuantity(designationMinimumUnitsFor(mug, row.id))}`)
    const summary = calculateDesignationMugSummary(component)
    const totalUnits = summary?.totalUnits ?? null
    lines.push(`Total: ${formatQuantity(totalUnits)} ${unitLabelForQuantity(mugUnitCode(component), totalUnits)}`)
    return lines
  }

  const line = mugSummaryLine(component.mug, mugUnitCode(component))
  return line ? [line.replace("MUG: ", "")] : ["-"]
}

/**
 * MUG column's calculated monetary lines (task correction §3, §11, §17):
 * the component's own transaction-currency total, plus its INR equivalent
 * for a foreign Billing Currency, both compact ("USD 50,000 / Month",
 * "INR 45,50,000 / Month"). Empty when the value cannot be reliably
 * calculated yet (no fabricated amount, matching `calculateMugValue`'s own
 * "do not fake" rule).
 */
function mugCalculatedLines(component: CommercialComponentDraft, currencyCode: string | null): string[] {
  return dualCurrencyLines(calculateMugValue(component), currencyCode, " / Month", formatCompactAmount)
}

type ComponentTableCells = {
  name: string
  nature: string
  pricing: string
  rateLines: string[]
  mugQuantityLines: string[]
  mugCalculatedLines: string[]
  invoiceCycle: string
  revenueRecognitionLines: string[]
  effectiveFrom: string
}

/**
 * Every value a Commercial Nature section's table (and its mobile card
 * fallback) needs for one row, computed once so both layouts render
 * identically from the same source. Nature itself is still computed here
 * for callers that need it (tests, a future cross-section view), even
 * though no table currently renders it as its own column: the section a
 * component's table lives in already communicates its Nature.
 */
function componentTableCells(component: CommercialComponentDraft, currencyCode: string | null): ComponentTableCells {
  return {
    name: component.description || "Untitled component",
    nature: natureLabel(component.nature),
    pricing: pricingColumnSummary(component),
    rateLines: rateColumnLines(component, currencyCode),
    mugQuantityLines: mugQuantityLines(component),
    mugCalculatedLines: mugCalculatedLines(component, currencyCode),
    invoiceCycle: invoiceCycleColumnSummary(component),
    revenueRecognitionLines: recognitionColumnLines(component, currencyCode),
    effectiveFrom: formatEffectiveDate(component.effectiveFrom),
  }
}

export {
  formatAmount,
  formatQuantity,
  formatCompactAmount,
  dualCurrencyLines,
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
  pricingColumnSummary,
  rateColumnLines,
  mugQuantityLines,
  mugCalculatedLines,
  invoiceCycleColumnSummary,
  recognitionColumnLines,
  formatEffectiveDate,
  componentTableCells,
}
export type { ComponentTableCells }
