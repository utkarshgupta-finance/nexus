import "server-only"

import * as entitlementData from "../data/entitlement.data"
import {
  toEntitlementSource,
  toEntitlementScheduleMonth,
  toMonthlyUsage,
  toMonthlyEntitlementLedgerRow,
  toUnbilledLedgerEntry,
  toUnearnedLedgerEntry,
  toSettlementRecord,
} from "../domain/mappers"
import { allocateEvenly } from "../domain/allocation"
import { computeMonthlyLedger } from "../domain/consumption"
import { classifyPricingRecognition } from "../domain/pricing-classification"
import { monthKeyToBusinessDate, addMonths, compareMonthKeys } from "@/lib/month"
import { commercialConfigurationService } from "@/features/commercial/server"
import { listCurrentLineItemsForCustomer } from "@/features/go-live/server"
import type {
  EntitlementSource,
  EntitlementScheduleMonth,
  MonthlyUsage,
  MonthlyEntitlementLedgerRow,
  UnbilledLedgerEntry,
  UnearnedLedgerEntry,
  SettlementRecord,
  AllocationTreatment,
} from "../domain/types"
import type { CreateEntitlementSourceInput } from "../data/entitlement.data"
import type { MonthlyAllocationEntry } from "../domain/allocation"

/**
 * Application service for the Entitlement Ledger. Composes the pure
 * domain math (allocation.ts, consumption.ts, pricing-classification.ts)
 * with real Commercial context (MUG, pricing model, Go Live status),
 * resolved fresh every time rather than cached or trusted from a
 * client, then persists via the governed RPCs. Manual Finance entry and
 * a future API/import caller both invoke these exact same functions
 * (task spec's own interface-independence requirement): no business
 * logic is duplicated in a route or a React component.
 */

async function createEntitlementSource(input: Omit<CreateEntitlementSourceInput, "id">): Promise<EntitlementSource> {
  const row = await entitlementData.createEntitlementSource({ ...input, id: crypto.randomUUID() })
  return toEntitlementSource(row)
}

async function cancelEntitlementSource(id: string, reason: string, actorUserId: string): Promise<EntitlementSource> {
  const row = await entitlementData.cancelEntitlementSource(id, reason, actorUserId)
  return toEntitlementSource(row)
}

async function listEntitlementSourcesForComponent(stableComponentKey: string): Promise<EntitlementSource[]> {
  const rows = await entitlementData.listEntitlementSourcesForComponent(stableComponentKey)
  return rows.map(toEntitlementSource)
}

async function listScheduleMonthsForComponent(stableComponentKey: string): Promise<EntitlementScheduleMonth[]> {
  const rows = await entitlementData.listScheduleMonthsForComponent(stableComponentKey)
  return rows.map(toEntitlementScheduleMonth)
}

type AllocationPreview = {
  entries: MonthlyAllocationEntry[]
  startMonth: string
  endMonth: string
  overlapsExistingSchedule: boolean
}

/**
 * "Before save show: Invoice Quantity, Metric, Allocation Treatment,
 * Start Month, End Month, Number of Months, Monthly Allocation... warn
 * + require conscious confirmation rather than blindly blocking" on
 * overlap. CREATE_NEW anchors at the line item's own Go Live month
 * (never the invoice date: "invoice creates the pool, allocation starts
 * at Go Live"); ADD_TO_EXISTING anchors at the month after the latest
 * month any existing schedule already covers for this component, so a
 * top-up naturally covers only the remaining, not-yet-allocated months.
 */
async function previewAllocationSchedule(input: {
  stableComponentKey: string
  invoiceQuantity: number
  durationMonths: number
  treatment: AllocationTreatment
  goLiveMonth: string
}): Promise<AllocationPreview> {
  const existingSchedule = await listScheduleMonthsForComponent(input.stableComponentKey)
  const existingMonths = existingSchedule.map((entry) => entry.month)

  const startMonth =
    input.treatment === "ADD_TO_EXISTING_ENTITLEMENT_PERIOD" && existingMonths.length > 0
      ? addMonths(existingMonths.sort(compareMonthKeys)[existingMonths.length - 1], 1)
      : input.goLiveMonth

  const entries = allocateEvenly(input.invoiceQuantity, startMonth, input.durationMonths)
  const endMonth = entries.length > 0 ? entries[entries.length - 1].month : startMonth
  const overlapsExistingSchedule = entries.some((entry) => existingMonths.includes(entry.month))

  return { entries, startMonth, endMonth, overlapsExistingSchedule }
}

async function generateScheduleForSource(entitlementSourceId: string, entries: MonthlyAllocationEntry[], actorUserId: string): Promise<EntitlementScheduleMonth[]> {
  const rows = await entitlementData.generateAllocationSchedule(entitlementSourceId, entries, actorUserId)
  return rows.map(toEntitlementScheduleMonth)
}

/** Resolves the real, current Commercial context for a stable line item: pricing model, MUG threshold, recurring-ness, and the version context, all fresh from Commercial, never trusted from a caller. */
async function resolveLineItemContext(customerId: string, stableComponentKey: string) {
  const lineItems = await listCurrentLineItemsForCustomer(customerId)
  const lineItem = lineItems.find((item) => item.stableComponentKey === stableComponentKey)
  if (!lineItem) return null

  const components = await commercialConfigurationService.listCommercialComponents(lineItem.commercialConfigurationId)
  const component = components.find((candidate) => candidate.id === lineItem.commercialComponentId)
  if (!component) return null

  const commitments = await commercialConfigurationService.listCommitmentsForComponent(component.id)
  const quantityCommitment = commitments.find((commitment) => commitment.kind === "quantity")
  const mugQuantity = quantityCommitment && quantityCommitment.kind === "quantity" ? quantityCommitment.thresholdValue : null

  return {
    lineItem,
    pricingRuleKind: component.pricingRuleKind,
    mugQuantity,
    isRecurring: component.isRecurring,
  }
}

async function submitMonthlyUsage(input: {
  customerId: string
  stableComponentKey: string
  usageMonth: string
  metric: string
  quantity: number
  source: string
  notes: string | null
  actorUserId: string
}): Promise<MonthlyUsage> {
  const context = await resolveLineItemContext(input.customerId, input.stableComponentKey)
  if (!context) throw new Error("This Commercial line item could not be found.")

  const row = await entitlementData.submitMonthlyUsage({
    id: crypto.randomUUID(),
    customerId: input.customerId,
    stableComponentKey: input.stableComponentKey,
    commercialVersionId: context.lineItem.commercialVersionId,
    usageMonth: monthKeyToBusinessDate(input.usageMonth),
    metric: input.metric,
    quantity: input.quantity,
    source: input.source,
    notes: input.notes,
    isRecurring: context.isRecurring,
    actorUserId: input.actorUserId,
  })

  await recomputeMonthlyLedger(input.customerId, input.stableComponentKey, input.usageMonth, input.actorUserId)

  return toMonthlyUsage(row)
}

async function finalizeMonthlyUsage(id: string, actorUserId: string): Promise<MonthlyUsage> {
  const row = await entitlementData.finalizeMonthlyUsage(id, actorUserId)
  return toMonthlyUsage(row)
}

async function listMonthlyUsageForComponent(stableComponentKey: string): Promise<MonthlyUsage[]> {
  const rows = await entitlementData.listMonthlyUsageForComponent(stableComponentKey)
  return rows.map(toMonthlyUsage)
}

/**
 * Recomputes the one (customer, component, month) ledger row from the
 * current schedule + usage facts, idempotently. Called after every
 * usage submission and every schedule generation for the affected
 * month(s); never a bulk/batch job in this program (usage/schedule
 * changes are always scoped to specific months already).
 */
async function recomputeMonthlyLedger(customerId: string, stableComponentKey: string, month: string, actorUserId: string): Promise<MonthlyEntitlementLedgerRow> {
  const context = await resolveLineItemContext(customerId, stableComponentKey)
  if (!context) throw new Error("This Commercial line item could not be found.")

  const [scheduleMonths, currentUsage] = await Promise.all([
    listScheduleMonthsForComponent(stableComponentKey),
    entitlementData.getCurrentMonthlyUsage(customerId, stableComponentKey, monthKeyToBusinessDate(month)),
  ])

  const monthlyEntitlementQuantity = scheduleMonths.filter((entry) => entry.month === month).reduce((sum, entry) => sum + entry.monthlyQuantity, 0)
  const actualUsageQuantity = currentUsage?.quantity ?? 0
  const recognitionClass = classifyPricingRecognition(context.pricingRuleKind)

  const computation = computeMonthlyLedger({
    recognitionClass,
    entitlementQuantity: monthlyEntitlementQuantity,
    actualUsageQuantity,
    mugQuantity: context.mugQuantity,
  })

  const row = await entitlementData.upsertMonthlyEntitlementLedger({
    customerId,
    stableComponentKey,
    commercialVersionId: context.lineItem.commercialVersionId,
    month: monthKeyToBusinessDate(month),
    metric: currentUsage?.metric ?? context.lineItem.pricingModelLabel,
    monthlyEntitlementQuantity,
    actualUsageQuantity,
    mugQuantity: context.mugQuantity,
    consumptionQuantity: computation.consumptionQuantity,
    unbilledQuantity: computation.unbilledQuantity,
    unearnedQuantity: computation.unearnedQuantity,
    recognitionStatus: computation.recognitionStatus,
    goLiveRequestId: context.lineItem.currentRequest?.status === "approved" ? context.lineItem.currentRequest.id : null,
    actorUserId,
  })

  return toMonthlyEntitlementLedgerRow(row)
}

async function listLedgerRowsForComponent(stableComponentKey: string): Promise<MonthlyEntitlementLedgerRow[]> {
  const rows = await entitlementData.listLedgerRowsForComponent(stableComponentKey)
  return rows.map(toMonthlyEntitlementLedgerRow)
}

async function listUnbilledEntriesForComponent(stableComponentKey: string): Promise<UnbilledLedgerEntry[]> {
  const rows = await entitlementData.listUnbilledEntriesForComponent(stableComponentKey)
  return rows.map(toUnbilledLedgerEntry)
}

async function listUnearnedEntriesForComponent(stableComponentKey: string): Promise<UnearnedLedgerEntry[]> {
  const rows = await entitlementData.listUnearnedEntriesForComponent(stableComponentKey)
  return rows.map(toUnearnedLedgerEntry)
}

async function listOpenUnbilledEntriesForCustomer(customerId: string): Promise<UnbilledLedgerEntry[]> {
  const rows = await entitlementData.listOpenUnbilledEntriesForCustomer(customerId)
  return rows.map(toUnbilledLedgerEntry)
}

async function listOpenUnearnedEntriesForCustomer(customerId: string): Promise<UnearnedLedgerEntry[]> {
  const rows = await entitlementData.listOpenUnearnedEntriesForCustomer(customerId)
  return rows.map(toUnearnedLedgerEntry)
}

async function recordSettlement(
  ledgerEntryType: "unbilled" | "unearned",
  ledgerEntryId: string,
  settlementReference: string,
  settledQuantity: number,
  settlementDate: string,
  actorUserId: string
): Promise<SettlementRecord> {
  const row = await entitlementData.recordSettlement(ledgerEntryType, ledgerEntryId, settlementReference, settledQuantity, settlementDate, actorUserId)
  return toSettlementRecord(row)
}

async function listSettlementRecords(ledgerEntryType: "unbilled" | "unearned", ledgerEntryId: string): Promise<SettlementRecord[]> {
  const rows = await entitlementData.listSettlementRecords(ledgerEntryType, ledgerEntryId)
  return rows.map(toSettlementRecord)
}

export {
  createEntitlementSource,
  cancelEntitlementSource,
  listEntitlementSourcesForComponent,
  listScheduleMonthsForComponent,
  previewAllocationSchedule,
  generateScheduleForSource,
  submitMonthlyUsage,
  finalizeMonthlyUsage,
  listMonthlyUsageForComponent,
  recomputeMonthlyLedger,
  listLedgerRowsForComponent,
  listUnbilledEntriesForComponent,
  listUnearnedEntriesForComponent,
  listOpenUnbilledEntriesForCustomer,
  listOpenUnearnedEntriesForCustomer,
  recordSettlement,
  listSettlementRecords,
}
export type { AllocationPreview }
