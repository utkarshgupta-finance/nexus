"use server"

import { revalidatePath } from "next/cache"

import { requirePermission } from "@/platform/permissions/server"
import { AuthorizationError } from "@/platform/permissions"
import { addReferenceOption, setReferenceOptionActive, updateCurrencyInrConversionRate } from "./server"
import { ReferenceMasterOperationError } from "./domain/errors"
import { isValidIsoCurrencyCode } from "./domain/currency-codes"
import type { ReferenceOption } from "./domain/types"

/**
 * Server Actions for the Customer Onboarding Settings screen
 * (../ui/reference-master-settings.tsx). Each one writes through
 * ../server.ts (service_role, server-only) and revalidates every route
 * that reads a Reference Master snapshot, so a change made here is
 * visible on the next request anywhere in the app, not only inside this
 * one page's own session (task correction §18: "No component-state-only
 * illusion").
 *
 * Every mutating action calls `requirePermission("reference_master",
 * "write")` first (`src/platform/permissions/server.ts`): this derives
 * the current authenticated Nexus user from the request's own session,
 * server-side, and denies before any database write is attempted if that
 * session is missing, unprovisioned, inactive, or lacks the permission.
 * The resolved session's real `appUserId` is what gets passed as the
 * audit actor, never a client-supplied value. There is no `actorUserId`
 * parameter anywhere in this file a browser could substitute; a client
 * cannot claim to be a different Nexus user by calling this action
 * differently.
 */

type ActionResult = { ok: true; option: ReferenceOption } | { ok: false; error: string }

function revalidateReferenceMasterConsumers() {
  revalidatePath("/settings/customer-onboarding")
  revalidatePath("/forms/customer-onboarding")
  revalidatePath("/customers")
}

function toActionError(error: unknown): ActionResult {
  if (error instanceof AuthorizationError) return { ok: false, error: error.message }
  if (error instanceof ReferenceMasterOperationError) {
    if (error.kind === "conflict") return { ok: false, error: "This value already exists in this list." }
    return { ok: false, error: error.message }
  }
  return { ok: false, error: "An unexpected error occurred while saving. Please try again." }
}

/** Add flow for every Level 1 "standard" list (Industry, Segment, Business Unit, Tax Identifier Type, Pricing Unit). */
async function addStandardOptionAction(
  listKey: "industry" | "segment" | "business_unit" | "tax_identifier_type" | "pricing_unit",
  code: string,
  label: string
): Promise<ActionResult> {
  if (!code.trim() || !label.trim()) return { ok: false, error: "Enter a label (a code is suggested automatically)." }
  try {
    const actor = await requirePermission("reference_master", "write")
    const option = await addReferenceOption({ listKey, code: code.trim(), label: label.trim() }, actor.appUserId)
    revalidateReferenceMasterConsumers()
    return { ok: true, option }
  } catch (error) {
    return toActionError(error)
  }
}

/** Currency Add validates against the real ISO 4217 catalogue (task correction §9), same rule the client already checks, re-checked server-side since this is the actual write boundary. */
async function addCurrencyOptionAction(code: string, name: string): Promise<ActionResult> {
  const upperCode = code.trim().toUpperCase()
  const trimmedName = name.trim()
  if (!upperCode || !trimmedName) return { ok: false, error: "Enter both a currency code and a name." }
  if (!isValidIsoCurrencyCode(upperCode)) return { ok: false, error: `"${upperCode}" is not a recognized ISO 4217 currency code.` }
  try {
    const actor = await requirePermission("reference_master", "write")
    const option = await addReferenceOption(
      { listKey: "currency", code: upperCode, label: `${upperCode} - ${trimmedName}`, inrConversionRate: null },
      actor.appUserId
    )
    revalidateReferenceMasterConsumers()
    return { ok: true, option }
  } catch (error) {
    return toActionError(error)
  }
}

/** A new recurring Invoice Frequency always requires a positive whole-number cadence (task correction §14): this is what protects the reserved "one_time" null-cadence row from being impersonated. */
async function addInvoiceFrequencyOptionAction(code: string, label: string, cadenceMonths: number): Promise<ActionResult> {
  const trimmedLabel = label.trim()
  if (!trimmedLabel) return { ok: false, error: "Enter a name for the new frequency." }
  if (!Number.isFinite(cadenceMonths) || !Number.isInteger(cadenceMonths) || cadenceMonths <= 0) {
    return { ok: false, error: "Enter a whole number cadence in months (e.g. 2 for Every 2 Months)." }
  }
  try {
    const actor = await requirePermission("reference_master", "write")
    const option = await addReferenceOption(
      { listKey: "invoice_frequency", code: code.trim(), label: trimmedLabel, cadenceMonths },
      actor.appUserId
    )
    revalidateReferenceMasterConsumers()
    return { ok: true, option }
  } catch (error) {
    return toActionError(error)
  }
}

async function setOptionActiveAction(
  listKey: Parameters<typeof setReferenceOptionActive>[0],
  code: string,
  isActive: boolean
): Promise<ActionResult> {
  try {
    const actor = await requirePermission("reference_master", "write")
    const option = await setReferenceOptionActive(listKey, code, isActive, actor.appUserId)
    revalidateReferenceMasterConsumers()
    return { ok: true, option }
  } catch (error) {
    return toActionError(error)
  }
}

async function updateCurrencyRateAction(code: string, rate: number | null): Promise<ActionResult> {
  if (rate !== null && (!Number.isFinite(rate) || rate <= 0)) {
    return { ok: false, error: "Enter a positive INR conversion rate, or leave it blank if not yet configured." }
  }
  try {
    const actor = await requirePermission("reference_master", "write")
    const option = await updateCurrencyInrConversionRate(code, rate, actor.appUserId)
    revalidateReferenceMasterConsumers()
    return { ok: true, option }
  } catch (error) {
    return toActionError(error)
  }
}

export { addStandardOptionAction, addCurrencyOptionAction, addInvoiceFrequencyOptionAction, setOptionActiveAction, updateCurrencyRateAction }
export type { ActionResult }
