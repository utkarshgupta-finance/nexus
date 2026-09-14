"use server"

import { requirePermission } from "@/platform/permissions/server"
import { AuthorizationError } from "@/platform/permissions"
import { withCorrelationReference } from "@/platform/errors"
import { EntitlementOperationError } from "./domain/entitlement-errors"
import {
  createEntitlementSource,
  cancelEntitlementSource,
  generateScheduleForSource,
  submitMonthlyUsage,
  finalizeMonthlyUsage,
  recordSettlement,
} from "./services/entitlement.service"
import type { EntitlementSource, MonthlyUsage, SettlementRecord } from "./domain/types"
import type { CreateEntitlementSourceInput } from "./data/entitlement.data"
import type { MonthlyAllocationEntry } from "./domain/allocation"

/**
 * Real, database-backed Entitlement Ledger Server Actions. Each derives
 * the authenticated actor server-side via `requirePermission`, never
 * accepts a client-supplied actor id. `entitlement.write` gates
 * Invoice Entitlement/allocation actions (Finance); `usage.write`/
 * `usage.finalize` are distinct permissions, matching the task's own
 * "monthly usage entry permission should be distinct from settlement
 * permission"; `entitlement_settlement.write` gates settlement.
 */

type EntitlementSourceActionResult = { ok: true; source: EntitlementSource } | { ok: false; error: string }

function toEntitlementActionError(error: unknown, fallback: string): { ok: false; error: string } {
  if (error instanceof AuthorizationError) return { ok: false, error: error.message }
  if (error instanceof EntitlementOperationError && error.entitlementError.kind === "unknown") {
    return { ok: false, error: withCorrelationReference(error.message, error) }
  }
  if (error instanceof Error) return { ok: false, error: error.message }
  return { ok: false, error: fallback }
}

async function createEntitlementSourceAction(input: Omit<CreateEntitlementSourceInput, "id" | "actorUserId">): Promise<EntitlementSourceActionResult> {
  try {
    const actor = await requirePermission("entitlement", "write")
    const source = await createEntitlementSource({ ...input, actorUserId: actor.appUserId })
    return { ok: true, source }
  } catch (error) {
    return toEntitlementActionError(error, "An unexpected error occurred while creating this Entitlement Source.")
  }
}

async function cancelEntitlementSourceAction(id: string, reason: string): Promise<EntitlementSourceActionResult> {
  try {
    const actor = await requirePermission("entitlement", "write")
    const source = await cancelEntitlementSource(id, reason, actor.appUserId)
    return { ok: true, source }
  } catch (error) {
    return toEntitlementActionError(error, "An unexpected error occurred while cancelling this Entitlement Source.")
  }
}

type GenerateScheduleActionResult = { ok: true } | { ok: false; error: string }

async function generateScheduleForSourceAction(entitlementSourceId: string, entries: MonthlyAllocationEntry[]): Promise<GenerateScheduleActionResult> {
  try {
    const actor = await requirePermission("entitlement", "write")
    await generateScheduleForSource(entitlementSourceId, entries, actor.appUserId)
    return { ok: true }
  } catch (error) {
    return toEntitlementActionError(error, "An unexpected error occurred while generating the allocation schedule.")
  }
}

type SubmitMonthlyUsageActionResult = { ok: true; usage: MonthlyUsage } | { ok: false; error: string }

async function submitMonthlyUsageAction(input: {
  customerId: string
  stableComponentKey: string
  usageMonth: string
  metric: string
  quantity: number
  notes: string | null
}): Promise<SubmitMonthlyUsageActionResult> {
  try {
    const actor = await requirePermission("usage", "write")
    const usage = await submitMonthlyUsage({ ...input, source: "MANUAL", actorUserId: actor.appUserId })
    return { ok: true, usage }
  } catch (error) {
    return toEntitlementActionError(error, "An unexpected error occurred while submitting monthly usage.")
  }
}

async function finalizeMonthlyUsageAction(id: string): Promise<SubmitMonthlyUsageActionResult> {
  try {
    const actor = await requirePermission("usage", "finalize")
    const usage = await finalizeMonthlyUsage(id, actor.appUserId)
    return { ok: true, usage }
  } catch (error) {
    return toEntitlementActionError(error, "An unexpected error occurred while finalizing this monthly usage record.")
  }
}

type RecordSettlementActionResult = { ok: true; settlement: SettlementRecord } | { ok: false; error: string }

async function recordSettlementAction(
  ledgerEntryType: "unbilled" | "unearned",
  ledgerEntryId: string,
  settlementReference: string,
  settledQuantity: number,
  settlementDate: string
): Promise<RecordSettlementActionResult> {
  try {
    const actor = await requirePermission("entitlement_settlement", "write")
    const settlement = await recordSettlement(ledgerEntryType, ledgerEntryId, settlementReference, settledQuantity, settlementDate, actor.appUserId)
    return { ok: true, settlement }
  } catch (error) {
    return toEntitlementActionError(error, "An unexpected error occurred while recording this settlement.")
  }
}

export {
  createEntitlementSourceAction,
  cancelEntitlementSourceAction,
  generateScheduleForSourceAction,
  submitMonthlyUsageAction,
  finalizeMonthlyUsageAction,
  recordSettlementAction,
}
export type { EntitlementSourceActionResult, GenerateScheduleActionResult, SubmitMonthlyUsageActionResult, RecordSettlementActionResult }
