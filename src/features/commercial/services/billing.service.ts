import * as billingData from "../data/billing.data"
import { toBillingCalculation, toInvoiceEligibilityEvent } from "../data/mappers"
import type { BillingCalculation, InvoiceEligibilityEvent } from "../domain/types"
import type { RecordBillingCalculationInput, RecordInvoiceEligibilityEventInput } from "../data/billing.data"

/**
 * Application service for Billing Calculation and Invoice Eligibility
 * Event (M10).
 *
 * Every write function takes `actorUserId` as its own explicit
 * parameter, never as a field inside the business-payload object; see
 * configuration.service.ts's own header comment for why.
 */

async function recordBillingCalculation(
  input: Omit<RecordBillingCalculationInput, "actorUserId">,
  actorUserId: string
): Promise<BillingCalculation> {
  const row = await billingData.recordBillingCalculation({ ...input, actorUserId })
  return toBillingCalculation(row)
}

async function recordInvoiceEligibilityEvent(
  input: Omit<RecordInvoiceEligibilityEventInput, "actorUserId">,
  actorUserId: string
): Promise<InvoiceEligibilityEvent> {
  const row = await billingData.recordInvoiceEligibilityEvent({ ...input, actorUserId })
  return toInvoiceEligibilityEvent(row)
}

async function listBillingCalculations(commercialComponentId: string): Promise<BillingCalculation[]> {
  const rows = await billingData.listBillingCalculationsByComponentId(commercialComponentId)
  return rows.map(toBillingCalculation)
}

async function listEligibilityEventsForBillingCalculations(
  billingCalculationIds: string[]
): Promise<InvoiceEligibilityEvent[]> {
  const rows = await billingData.listInvoiceEligibilityEventsByBillingCalculationIds(billingCalculationIds)
  return rows.map(toInvoiceEligibilityEvent)
}

async function listBillingCalculationsForComponents(commercialComponentIds: string[]): Promise<BillingCalculation[]> {
  const rows = await billingData.listBillingCalculationsByComponentIds(commercialComponentIds)
  return rows.map(toBillingCalculation)
}

export {
  recordBillingCalculation,
  recordInvoiceEligibilityEvent,
  listBillingCalculations,
  listEligibilityEventsForBillingCalculations,
  listBillingCalculationsForComponents,
}
