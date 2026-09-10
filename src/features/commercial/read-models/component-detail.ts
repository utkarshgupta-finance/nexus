import * as billingService from "../services/billing.service"
import * as configurationService from "../services/configuration.service"
import * as invoiceService from "../services/invoice.service"
import * as reconciliationService from "../services/reconciliation.service"
import * as usageEarnedService from "../services/usage-earned.service"
import {
  billingCadenceLabel,
  billingQuantityBasisLabel,
  billingQuantityBasisUsedLabel,
  billingTimingLabel,
  commercialComponentLabel,
  pricingRuleKindLabel,
} from "../domain/labels"
import type { EarnedResult, ReconciliationAdjustment } from "../domain/types"
import { toCommitmentSummary } from "./configuration-overview-helpers"
import type { CommitmentSummary } from "./configuration-overview-helpers"
import { latestEligibilityByBillingCalculationId, withCurrentFlag } from "./component-detail-helpers"

/**
 * Read model for the second Commercial screen: everything about one
 * Commercial Component. Batches every child collection by the
 * Component's own id (and, for allocation lookups, by the ids just
 * fetched), so this stays a fixed small number of queries.
 */

type EarnedResultSummary = {
  id: string
  periodStart: string
  periodEnd: string
  resultVersion: number
  supersedesEarnedResultId: string | null
  /** True for the one version per period that nothing else supersedes yet. */
  isCurrentForPeriod: boolean
  calculatedAmount: number
  transactionCurrency: string
  status: EarnedResult["status"]
  finalizedAt: string | null
}

type BillingCalculationSummary = {
  id: string
  billingPeriodStart: string
  billingPeriodEnd: string
  billingQuantityBasisUsedLabel: string
  calculatedAmount: number
  transactionCurrency: string
  /** Most recent invoice_eligibility_events row for this Billing Calculation, or null if none exist yet. */
  latestEligibility: { eligible: boolean; reason: string; createdAt: string } | null
  /** Sum of invoice_evidence_items.allocated_amount already recorded against this Billing Calculation. */
  invoicedAmount: number
}

type ReconciliationAdjustmentSummary = {
  id: string
  windowStart: string
  windowEnd: string
  direction: ReconciliationAdjustment["direction"]
  monetaryDifference: number
  transactionCurrency: string
  reason: string
  status: ReconciliationAdjustment["status"]
  supersedesAdjustmentId: string | null
  /** Derived from invoice_evidence_items linkage, never a stored flag: true once at least one item references this row. */
  resolved: boolean
}

type CommercialComponentDetail = {
  component: {
    id: string
    label: string
    pricingRuleKindLabel: string
    measurementLabel: string | null
    billingCadenceLabel: string
    billingTimingLabel: string
    billingQuantityBasisLabel: string
    reconciliationCadenceLabel: string
    transactionCurrency: string
    effectiveFrom: string
    effectiveTo: string | null
    supersedesComponentId: string | null
  }
  commitments: CommitmentSummary[]
  earnedResults: EarnedResultSummary[]
  billingCalculations: BillingCalculationSummary[]
  reconciliationAdjustments: ReconciliationAdjustmentSummary[]
}

async function getCommercialComponentDetail(commercialComponentId: string): Promise<CommercialComponentDetail | null> {
  const component = await configurationService.getCommercialComponent(commercialComponentId)
  if (!component) return null

  const [measurementDefinitions, commitments, earnedResults, billingCalculations, reconciliationAdjustments] =
    await Promise.all([
      component.measurementDefinitionId
        ? configurationService.listMeasurementDefinitions([component.measurementDefinitionId])
        : Promise.resolve([]),
      configurationService.listCommitmentsForComponent(commercialComponentId),
      usageEarnedService.listEarnedResults(commercialComponentId),
      billingService.listBillingCalculations(commercialComponentId),
      reconciliationService.listReconciliationAdjustments(commercialComponentId),
    ])

  const billingCalculationIds = billingCalculations.map((calculation) => calculation.id)
  const reconciliationAdjustmentIds = reconciliationAdjustments.map((adjustment) => adjustment.id)

  const [eligibilityEvents, billingInvoiceItems, reconciliationInvoiceItems] = await Promise.all([
    billingService.listEligibilityEventsForBillingCalculations(billingCalculationIds),
    invoiceService.listInvoiceEvidenceItemsForBillingCalculations(billingCalculationIds),
    invoiceService.listInvoiceEvidenceItemsForReconciliationAdjustments(reconciliationAdjustmentIds),
  ])

  const latestEligibility = latestEligibilityByBillingCalculationId(eligibilityEvents)

  const invoicedAmountByBillingCalculationId = new Map<string, number>()
  for (const item of billingInvoiceItems) {
    if (item.target.kind !== "billing_calculation") continue
    const current = invoicedAmountByBillingCalculationId.get(item.target.billingCalculationId) ?? 0
    invoicedAmountByBillingCalculationId.set(item.target.billingCalculationId, current + item.allocatedAmount)
  }

  const resolvedReconciliationAdjustmentIds = new Set(
    reconciliationInvoiceItems
      .filter((item) => item.target.kind === "reconciliation_adjustment")
      .map((item) => (item.target as { reconciliationAdjustmentId: string }).reconciliationAdjustmentId)
  )

  const measurementLabel = component.measurementDefinitionId
    ? commercialComponentLabel(component, measurementDefinitions[0] ?? null)
    : null

  return {
    component: {
      id: component.id,
      label: measurementLabel ?? pricingRuleKindLabel(component.pricingRuleKind),
      pricingRuleKindLabel: pricingRuleKindLabel(component.pricingRuleKind),
      measurementLabel,
      billingCadenceLabel: billingCadenceLabel(component.billingCadence),
      billingTimingLabel: billingTimingLabel(component.billingTiming),
      billingQuantityBasisLabel: billingQuantityBasisLabel(component.billingQuantityBasis),
      reconciliationCadenceLabel: billingCadenceLabel(component.reconciliationCadence),
      transactionCurrency: component.transactionCurrency,
      effectiveFrom: component.effectiveFrom,
      effectiveTo: component.effectiveTo,
      supersedesComponentId: component.supersedesComponentId,
    },
    commitments: commitments.map(toCommitmentSummary),
    earnedResults: withCurrentFlag(earnedResults),
    billingCalculations: billingCalculations.map((calculation) => ({
      id: calculation.id,
      billingPeriodStart: calculation.billingPeriodStart,
      billingPeriodEnd: calculation.billingPeriodEnd,
      billingQuantityBasisUsedLabel: billingQuantityBasisUsedLabel(calculation.billingQuantityBasisUsed),
      calculatedAmount: calculation.calculatedAmount,
      transactionCurrency: calculation.transactionCurrency,
      latestEligibility: (() => {
        const event = latestEligibility.get(calculation.id)
        return event ? { eligible: event.eligible, reason: event.reason, createdAt: event.createdAt } : null
      })(),
      invoicedAmount: invoicedAmountByBillingCalculationId.get(calculation.id) ?? 0,
    })),
    reconciliationAdjustments: reconciliationAdjustments.map((adjustment) => ({
      id: adjustment.id,
      windowStart: adjustment.windowStart,
      windowEnd: adjustment.windowEnd,
      direction: adjustment.direction,
      monetaryDifference: adjustment.monetaryDifference,
      transactionCurrency: adjustment.transactionCurrency,
      reason: adjustment.reason,
      status: adjustment.status,
      supersedesAdjustmentId: adjustment.supersedesAdjustmentId,
      resolved: resolvedReconciliationAdjustmentIds.has(adjustment.id),
    })),
  }
}

export { getCommercialComponentDetail, withCurrentFlag, latestEligibilityByBillingCalculationId }
export type { CommercialComponentDetail, EarnedResultSummary, BillingCalculationSummary, ReconciliationAdjustmentSummary }
