import { resolveOption } from "@/features/reference-data"
import type { CommercialComponentDraft, MugOverlay } from "./commercial-rate"

/**
 * Human-readable calculation-preview strings (task spec §31): "these are
 * display summaries only... do not imply actual invoices are being
 * calculated." No amount here is ever computed against real usage; every
 * value comes straight from what the user typed into this component.
 */

function formatAmount(value: number | null, currencyCode: string | null): string {
  if (value === null) return "-"
  const formatted = value.toLocaleString("en-IN")
  return currencyCode ? `${currencyCode} ${formatted}` : formatted
}

function unitLabel(pricingUnitCode: string | null): string {
  if (!pricingUnitCode) return "Unit"
  return resolveOption("pricing_unit", pricingUnitCode)?.label ?? pricingUnitCode
}

function cycleLabel(billingCycleCode: string | null): string {
  if (!billingCycleCode) return ""
  return resolveOption("billing_cycle", billingCycleCode)?.label ?? billingCycleCode
}

function mugSummaryLine(mug: MugOverlay, currencyCode: string | null): string | null {
  if (!mug.enabled) return null
  return `MUG: ${formatAmount(mug.amount, currencyCode)} / ${cycleLabel(mug.frequency)}`
}

/**
 * One or more lines describing a single component, in the same shape as
 * the task's own worked examples ("₹50 / User / Monthly", "101-250 Users:
 * ₹90 / User", "MUG: ₹2,00,000 / Month").
 */
function summarizeComponent(component: CommercialComponentDraft, currencyCode: string | null): string[] {
  const lines: string[] = []

  if (component.nature === "non_recurring") {
    lines.push(`${formatAmount(component.amount, currencyCode)} one-time`)
    return lines
  }

  if (component.nature === "on_demand" && component.pricingType === "fixed_fee") {
    lines.push(`${formatAmount(component.amount, currencyCode)} fixed fee, on demand`)
  } else if (component.nature === "on_demand") {
    lines.push(`${formatAmount(component.rate, currencyCode)} / ${unitLabel(component.pricingUnit)}, on demand`)
  } else if (component.pricingModel === "flat_fee") {
    lines.push(`${formatAmount(component.recurringAmount, currencyCode)} / ${cycleLabel(component.billingTerms.billingCycle)} flat fee`)
  } else if (component.pricingModel === "per_unit") {
    lines.push(`${formatAmount(component.rate, currencyCode)} / ${unitLabel(component.pricingUnit)} / ${cycleLabel(component.billingTerms.billingCycle)}`)
  } else if (component.pricingModel === "slab") {
    const unit = unitLabel(component.pricingUnit)
    for (const row of component.slabRows) {
      const range = row.to === null ? `${row.from ?? "-"}+` : `${row.from ?? "-"}-${row.to}`
      lines.push(`${range} ${unit}: ${formatAmount(row.rate, currencyCode)} / ${unit}`)
    }
  } else if (component.pricingModel === "designation_based") {
    for (const row of component.designationRows) {
      lines.push(`${row.designation || "Designation"}: ${formatAmount(row.rate, currencyCode)} / ${unitLabel(row.per)}`)
    }
  }

  if ("mug" in component) {
    const mugLine = mugSummaryLine(component.mug, currencyCode)
    if (mugLine) lines.push(mugLine)
  }

  return lines
}

export { formatAmount, unitLabel, cycleLabel, mugSummaryLine, summarizeComponent }
