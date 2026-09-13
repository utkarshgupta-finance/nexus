"use server"

import { requirePermission } from "@/platform/permissions/server"
import { AuthorizationError } from "@/platform/permissions"
import { loadReferenceMasterSnapshot } from "@/features/reference-data/server"
import { getCustomerById } from "@/features/customers/server"

import {
  createOnboardingCase,
  saveOnboardingDraft,
  submitOnboardingCase,
  sendBackOnboardingCase,
  approveOnboardingCase,
} from "./services/case.service"
import {
  createVersionFromActive,
  saveVersionDraft,
  submitVersion,
  rejectVersion,
  approveVersion,
} from "./services/commercial-version.service"
import type { CommercialRateDraft } from "./domain/commercial-rate"
import type { CustomerOnboardingCase } from "./domain/types"
import type { CommercialConfigurationVersion, CommercialVersionChangeCategory } from "./domain/commercial-version-types"

/**
 * Real, database-backed Customer Onboarding Case lifecycle actions
 * (Customer Lifecycle V1). Each derives the authenticated actor
 * server-side via `requirePermission`, exactly like the promotion actions
 * above; none accepts a client-supplied actor id. `customer.create`
 * gates the requester-side actions (create/save/submit, since editing
 * one's own onboarding case is a creation activity), `customer.approve`
 * gates the reviewer-side actions (send back/approve), matching
 * docs/AUTHORIZATION_MODEL.md's resource+action convention.
 */

type CaseActionResult = { ok: true; onboardingCase: CustomerOnboardingCase } | { ok: false; error: string }

function toCaseActionError(error: unknown): { ok: false; error: string } {
  if (error instanceof AuthorizationError) return { ok: false, error: error.message }
  if (error instanceof Error) return { ok: false, error: error.message }
  return { ok: false, error: "An unexpected error occurred while updating this Customer Onboarding case." }
}

async function createOnboardingCaseAction(): Promise<CaseActionResult> {
  try {
    const actor = await requirePermission("customer", "create")
    const onboardingCase = await createOnboardingCase(actor.appUserId)
    return { ok: true, onboardingCase }
  } catch (error) {
    return toCaseActionError(error)
  }
}

async function saveOnboardingDraftAction(
  requestId: string,
  rawData: Record<string, unknown>,
  currentStageKey: string
): Promise<CaseActionResult> {
  try {
    const actor = await requirePermission("customer", "create")
    const onboardingCase = await saveOnboardingDraft(requestId, rawData, currentStageKey, actor.appUserId)
    return { ok: true, onboardingCase }
  } catch (error) {
    return toCaseActionError(error)
  }
}

/** Serves both a first Submit and a post-send-back Resubmit; see services/case.service.ts's own comment. */
async function submitOnboardingCaseAction(requestId: string): Promise<CaseActionResult> {
  try {
    const actor = await requirePermission("customer", "create")
    const onboardingCase = await submitOnboardingCase(requestId, actor.appUserId)
    return { ok: true, onboardingCase }
  } catch (error) {
    return toCaseActionError(error)
  }
}

async function sendBackOnboardingCaseAction(requestId: string, reason: string, targetStageKey: string | null): Promise<CaseActionResult> {
  try {
    const actor = await requirePermission("customer", "approve")
    const onboardingCase = await sendBackOnboardingCase(requestId, reason, targetStageKey, actor.appUserId)
    return { ok: true, onboardingCase }
  } catch (error) {
    return toCaseActionError(error)
  }
}

/** Same shape as CaseActionResult, plus the identities the Approve success screen links to (Customer Lifecycle V1 UX pass: "do not require the user to manually find the newly created Customer"). Both are null only if something prevented resolving the just-created customer's key, never fabricated. */
type ApproveCaseActionResult =
  | { ok: true; onboardingCase: CustomerOnboardingCase; customerKey: string | null; commercialConfigurationId: string | null }
  | { ok: false; error: string }

async function approveOnboardingCaseAction(requestId: string, effectiveDate: string): Promise<ApproveCaseActionResult> {
  try {
    const actor = await requirePermission("customer", "approve")
    const snapshot = await loadReferenceMasterSnapshot()
    const onboardingCase = await approveOnboardingCase(requestId, actor.appUserId, snapshot, effectiveDate)
    const customer = onboardingCase.customerId ? await getCustomerById(onboardingCase.customerId) : null
    return { ok: true, onboardingCase, customerKey: customer?.key ?? null, commercialConfigurationId: onboardingCase.commercialConfigurationId }
  } catch (error) {
    return toCaseActionError(error)
  }
}

/**
 * Real, database-backed Commercial Configuration Version lifecycle
 * actions (Customer Lifecycle V1, Phase 10-13), mirroring the Customer
 * Onboarding Case actions above exactly: each derives the authenticated
 * actor server-side via `requirePermission`, never accepts a
 * client-supplied actor id. `commercial_configuration.write` gates the
 * draft-authoring actions (create/save/submit), matching every other
 * Commercial Configuration write in this codebase;
 * `commercial_configuration.approve` gates the reviewer-side decision
 * (reject/approve).
 */

type CommercialVersionActionResult = { ok: true; version: CommercialConfigurationVersion } | { ok: false; error: string }

function toCommercialVersionActionError(error: unknown): CommercialVersionActionResult {
  if (error instanceof AuthorizationError) return { ok: false, error: error.message }
  if (error instanceof Error) return { ok: false, error: error.message }
  return { ok: false, error: "An unexpected error occurred while updating this Commercial Configuration Version." }
}

async function createCommercialVersionAction(commercialConfigurationId: string, changeCategory: CommercialVersionChangeCategory): Promise<CommercialVersionActionResult> {
  try {
    const actor = await requirePermission("commercial_configuration", "write")
    const version = await createVersionFromActive(commercialConfigurationId, changeCategory, actor.appUserId)
    return { ok: true, version }
  } catch (error) {
    return toCommercialVersionActionError(error)
  }
}

async function saveCommercialVersionDraftAction(requestId: string, commercialRate: CommercialRateDraft): Promise<CommercialVersionActionResult> {
  try {
    const actor = await requirePermission("commercial_configuration", "write")
    const version = await saveVersionDraft(requestId, commercialRate, actor.appUserId)
    return { ok: true, version }
  } catch (error) {
    return toCommercialVersionActionError(error)
  }
}

async function submitCommercialVersionAction(requestId: string, reason: string, effectiveDate: string): Promise<CommercialVersionActionResult> {
  try {
    const actor = await requirePermission("commercial_configuration", "write")
    const version = await submitVersion(requestId, reason, effectiveDate, actor.appUserId)
    return { ok: true, version }
  } catch (error) {
    return toCommercialVersionActionError(error)
  }
}

async function rejectCommercialVersionAction(requestId: string, reason: string): Promise<CommercialVersionActionResult> {
  try {
    const actor = await requirePermission("commercial_configuration", "approve")
    const version = await rejectVersion(requestId, reason, actor.appUserId)
    return { ok: true, version }
  } catch (error) {
    return toCommercialVersionActionError(error)
  }
}

async function approveCommercialVersionAction(requestId: string): Promise<CommercialVersionActionResult> {
  try {
    const actor = await requirePermission("commercial_configuration", "approve")
    const snapshot = await loadReferenceMasterSnapshot()
    const version = await approveVersion(requestId, actor.appUserId, snapshot)
    return { ok: true, version }
  } catch (error) {
    return toCommercialVersionActionError(error)
  }
}

export {
  createOnboardingCaseAction,
  saveOnboardingDraftAction,
  submitOnboardingCaseAction,
  sendBackOnboardingCaseAction,
  approveOnboardingCaseAction,
  createCommercialVersionAction,
  saveCommercialVersionDraftAction,
  submitCommercialVersionAction,
  rejectCommercialVersionAction,
  approveCommercialVersionAction,
}
export type { CaseActionResult, ApproveCaseActionResult, CommercialVersionActionResult }
