import * as invoiceData from "../data/invoice.data"
import { toInvoiceEvidence, toInvoiceEvidenceItem } from "../data/mappers"
import type { InvoiceEvidence, InvoiceEvidenceItem } from "../domain/types"
import type { RecordInvoiceEvidenceInput, RecordInvoiceEvidenceItemInput } from "../data/invoice.data"

/**
 * Application service for Invoice Evidence and Invoice Evidence Item
 * (M10).
 *
 * Every write function takes `actorUserId` as its own explicit
 * parameter, never as a field inside the business-payload object; see
 * configuration.service.ts's own header comment for why.
 */

async function recordInvoiceEvidence(
  input: Omit<RecordInvoiceEvidenceInput, "actorUserId">,
  actorUserId: string
): Promise<InvoiceEvidence> {
  const row = await invoiceData.recordInvoiceEvidence({ ...input, actorUserId })
  return toInvoiceEvidence(row)
}

async function recordInvoiceEvidenceItem(
  input: Omit<RecordInvoiceEvidenceItemInput, "actorUserId">,
  actorUserId: string
): Promise<InvoiceEvidenceItem> {
  const row = await invoiceData.recordInvoiceEvidenceItem({ ...input, actorUserId })
  return toInvoiceEvidenceItem(row)
}

async function listInvoiceEvidenceItemsForBillingCalculations(
  billingCalculationIds: string[]
): Promise<InvoiceEvidenceItem[]> {
  const rows = await invoiceData.listInvoiceEvidenceItemsByBillingCalculationIds(billingCalculationIds)
  return rows.map(toInvoiceEvidenceItem)
}

async function listInvoiceEvidenceItemsForReconciliationAdjustments(
  reconciliationAdjustmentIds: string[]
): Promise<InvoiceEvidenceItem[]> {
  const rows = await invoiceData.listInvoiceEvidenceItemsByReconciliationAdjustmentIds(reconciliationAdjustmentIds)
  return rows.map(toInvoiceEvidenceItem)
}

async function listInvoiceEvidenceByIds(ids: string[]): Promise<InvoiceEvidence[]> {
  const rows = await invoiceData.listInvoiceEvidenceByIds(ids)
  return rows.map(toInvoiceEvidence)
}

export {
  recordInvoiceEvidence,
  recordInvoiceEvidenceItem,
  listInvoiceEvidenceItemsForBillingCalculations,
  listInvoiceEvidenceItemsForReconciliationAdjustments,
  listInvoiceEvidenceByIds,
}
