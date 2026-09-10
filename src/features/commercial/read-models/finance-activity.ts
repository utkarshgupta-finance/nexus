import * as billingService from "../services/billing.service"
import * as configurationService from "../services/configuration.service"
import * as invoiceService from "../services/invoice.service"
import * as reconciliationService from "../services/reconciliation.service"
import * as usageEarnedService from "../services/usage-earned.service"

/**
 * Read model for the third Commercial screen: a chronological activity
 * feed across Commercial Changes, Usage Fact corrections, Earned Result
 * versions/finalization, Billing Calculations, Invoice Eligibility
 * Events, Invoice Evidence, and Reconciliation Adjustments, scoped to one
 * Commercial Configuration.
 *
 * This is application-side read composition only, per design: there is
 * no database event table backing this, and none should be added. Each
 * entry is built directly from the entity it describes; the union below
 * is closed and entity-typed, not a generic `{type, payload}` envelope.
 */

type FinanceActivityEntry =
  | { kind: "commercial_change"; occurredAt: string; id: string; category: string; reason: string | null }
  | {
      kind: "usage_correction"
      occurredAt: string
      id: string
      origin: "correction" | "finance_override"
      quantity: number
      overrideReason: string | null
    }
  | {
      kind: "earned_result_recorded"
      occurredAt: string
      id: string
      resultVersion: number
      calculatedAmount: number
      transactionCurrency: string
    }
  | { kind: "earned_result_finalized"; occurredAt: string; id: string; finalizedBy: string | null }
  | {
      kind: "billing_calculation_recorded"
      occurredAt: string
      id: string
      calculatedAmount: number
      transactionCurrency: string
    }
  | { kind: "invoice_eligibility_event"; occurredAt: string; id: string; eligible: boolean; reason: string }
  | {
      kind: "invoice_evidence_recorded"
      occurredAt: string
      id: string
      evidenceKind: "invoice" | "credit_note"
      amount: number
      currency: string
    }
  | {
      kind: "reconciliation_adjustment_recorded"
      occurredAt: string
      id: string
      direction: "additional_billing" | "credit_note"
      monetaryDifference: number
      transactionCurrency: string
    }
  | { kind: "reconciliation_adjustment_finalized"; occurredAt: string; id: string; finalizedBy: string | null }

/**
 * `createdAt`/`updatedAt` (Finalized events) is the timeline field used
 * throughout: the same "the row's own timestamp is the timeline
 * position" convention every entity in this schema already follows,
 * never a separately invented ordering column.
 */
async function getFinanceActivity(commercialConfigurationId: string): Promise<FinanceActivityEntry[]> {
  const components = await configurationService.listCommercialComponents(commercialConfigurationId)
  const componentIds = components.map((component) => component.id)

  const [changes, usageFacts, earnedResults, billingCalculations, reconciliationAdjustments] = await Promise.all([
    configurationService.listCommercialChanges(commercialConfigurationId),
    usageEarnedService.listUsageFacts(commercialConfigurationId),
    usageEarnedService.listEarnedResultsForComponents(componentIds),
    billingService.listBillingCalculationsForComponents(componentIds),
    reconciliationService.listReconciliationAdjustmentsForComponents(componentIds),
  ])

  const billingCalculationIds = billingCalculations.map((calculation) => calculation.id)
  const reconciliationAdjustmentIds = reconciliationAdjustments.map((adjustment) => adjustment.id)

  const [eligibilityEvents, billingInvoiceItems, reconciliationInvoiceItems] = await Promise.all([
    billingService.listEligibilityEventsForBillingCalculations(billingCalculationIds),
    invoiceService.listInvoiceEvidenceItemsForBillingCalculations(billingCalculationIds),
    invoiceService.listInvoiceEvidenceItemsForReconciliationAdjustments(reconciliationAdjustmentIds),
  ])

  const invoiceEvidenceIds = [
    ...new Set([...billingInvoiceItems, ...reconciliationInvoiceItems].map((item) => item.invoiceEvidenceId)),
  ]
  const invoiceEvidence = await invoiceService.listInvoiceEvidenceByIds(invoiceEvidenceIds)

  const entries: FinanceActivityEntry[] = []

  for (const change of changes) {
    entries.push({
      kind: "commercial_change",
      occurredAt: change.effectiveDate,
      id: change.id,
      category: change.category,
      reason: change.reason,
    })
  }

  for (const fact of usageFacts) {
    if (fact.origin === "source") continue
    entries.push({
      kind: "usage_correction",
      occurredAt: fact.createdAt,
      id: fact.id,
      origin: fact.origin,
      quantity: fact.quantity,
      overrideReason: fact.overrideReason,
    })
  }

  for (const result of earnedResults) {
    entries.push({
      kind: "earned_result_recorded",
      occurredAt: result.createdAt,
      id: result.id,
      resultVersion: result.resultVersion,
      calculatedAmount: result.calculatedAmount,
      transactionCurrency: result.transactionCurrency,
    })
    if (result.finalizedAt) {
      entries.push({
        kind: "earned_result_finalized",
        occurredAt: result.finalizedAt,
        id: result.id,
        finalizedBy: result.finalizedBy,
      })
    }
  }

  for (const calculation of billingCalculations) {
    entries.push({
      kind: "billing_calculation_recorded",
      occurredAt: calculation.createdAt,
      id: calculation.id,
      calculatedAmount: calculation.calculatedAmount,
      transactionCurrency: calculation.transactionCurrency,
    })
  }

  for (const event of eligibilityEvents) {
    entries.push({
      kind: "invoice_eligibility_event",
      occurredAt: event.createdAt,
      id: event.id,
      eligible: event.eligible,
      reason: event.reason,
    })
  }

  for (const evidence of invoiceEvidence) {
    entries.push({
      kind: "invoice_evidence_recorded",
      occurredAt: evidence.createdAt,
      id: evidence.id,
      evidenceKind: evidence.evidenceKind,
      amount: evidence.amount,
      currency: evidence.currency,
    })
  }

  for (const adjustment of reconciliationAdjustments) {
    entries.push({
      kind: "reconciliation_adjustment_recorded",
      occurredAt: adjustment.createdAt,
      id: adjustment.id,
      direction: adjustment.direction,
      monetaryDifference: adjustment.monetaryDifference,
      transactionCurrency: adjustment.transactionCurrency,
    })
    if (adjustment.finalizedAt) {
      entries.push({
        kind: "reconciliation_adjustment_finalized",
        occurredAt: adjustment.finalizedAt,
        id: adjustment.id,
        finalizedBy: adjustment.finalizedBy,
      })
    }
  }

  return entries.sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : a.occurredAt > b.occurredAt ? -1 : 0))
}

export { getFinanceActivity }
export type { FinanceActivityEntry }
