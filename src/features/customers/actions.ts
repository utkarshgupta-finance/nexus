"use server"

import { requirePermission } from "@/platform/permissions/server"
import { AuthorizationError } from "@/platform/permissions"

import { setCustomerActive } from "./data/customers.data"
import { deleteCustomerPermanently } from "./data/deletion.data"
import { toCustomerDeletionAudit } from "./domain/deletion-mappers"
import { getCustomerDeletionEligibility } from "./server/deletion"
import type { CustomerDeletionAudit, DeletionEligibility } from "./domain/deletion-types"

/**
 * Real, database-backed Permanent Customer Deletion action (Customer
 * Lifecycle V1, Phase 14-16), gated on `customer.delete_permanent`, the
 * one permission seeded specifically for this and held only by
 * `Customer Lifecycle Admin` (never granted broadly). Derives the
 * authenticated actor server-side via `requirePermission`, the same
 * pattern every other governed mutation in this codebase follows;
 * `delete_customer_permanently` itself re-checks eligibility, so a
 * stale client-side read can never cause an unsafe delete.
 */

type EligibilityActionResult = { ok: true; eligibility: DeletionEligibility } | { ok: false; error: string }

/** Computed lazily, only when the "Permanently Delete Customer" panel is opened: gated the same as the delete itself, since eligibility detail (Commercial Configuration counts, approved Change Request counts) is only meaningful to someone who could actually act on it. */
async function checkCustomerDeletionEligibilityAction(customerId: string): Promise<EligibilityActionResult> {
  try {
    await requirePermission("customer", "delete_permanent")
    const eligibility = await getCustomerDeletionEligibility(customerId)
    return { ok: true, eligibility }
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: error.message }
    if (error instanceof Error) return { ok: false, error: error.message }
    return { ok: false, error: "An unexpected error occurred while checking deletion eligibility." }
  }
}

type DeletionActionResult = { ok: true; audit: CustomerDeletionAudit } | { ok: false; error: string }

function toDeletionActionError(error: unknown): DeletionActionResult {
  if (error instanceof AuthorizationError) return { ok: false, error: error.message }
  if (error instanceof Error) return { ok: false, error: error.message }
  return { ok: false, error: "An unexpected error occurred while permanently deleting this customer." }
}

async function deleteCustomerPermanentlyAction(customerId: string, reason: string): Promise<DeletionActionResult> {
  try {
    const actor = await requirePermission("customer", "delete_permanent")
    const row = await deleteCustomerPermanently(customerId, reason, actor.appUserId)
    return { ok: true, audit: toCustomerDeletionAudit(row) }
  } catch (error) {
    return toDeletionActionError(error)
  }
}

type DeactivateActionResult = { ok: true } | { ok: false; error: string }

/** Offered as the alternative when permanent deletion is blocked by real business history: the customer stays fully intact, just marked inactive. Gated on `customer.delete_permanent` too, since offering it only alongside the delete flow, not as a general customer-editing capability. */
async function deactivateCustomerAction(customerId: string): Promise<DeactivateActionResult> {
  try {
    const actor = await requirePermission("customer", "delete_permanent")
    await setCustomerActive(customerId, false, actor.appUserId)
    return { ok: true }
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: error.message }
    if (error instanceof Error) return { ok: false, error: error.message }
    return { ok: false, error: "An unexpected error occurred while deactivating this customer." }
  }
}

export { checkCustomerDeletionEligibilityAction, deleteCustomerPermanentlyAction, deactivateCustomerAction }
export type { EligibilityActionResult, DeletionActionResult, DeactivateActionResult }
