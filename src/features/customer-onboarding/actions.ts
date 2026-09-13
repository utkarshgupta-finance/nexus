"use server"

import { requirePermission } from "@/platform/permissions/server"
import { AuthorizationError } from "@/platform/permissions"
import { loadReferenceMasterSnapshot } from "@/features/reference-data/server"

import { promoteOnboardingDraftAsNewConfiguration, promoteOnboardingDraftAsNewVersion } from "./server/commercial-configuration-promotion"
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
 * Server Action for promoting a Commercial Rate onboarding draft into the
 * real, persistent, versioned Commercial Configuration (docs/
 * COMMERCIAL_DOMAIN_ARCHITECTURE.md §22, "a real approved-case ->
 * Commercial Configuration promotion path is future work").
 *
 * `requirePermission("commercial_configuration", "write")` derives the
 * current authenticated Nexus user from the request's own session,
 * server-side, and denies before any database write is attempted if that
 * session is missing, unprovisioned, inactive, or lacks the permission
 * (the exact same pattern as ../reference-data/actions.ts). The resolved
 * session's real `appUserId` is what gets passed as `actorUserId` into
 * every promotion write and, from there, into audit; there is no
 * `actorUserId` parameter anywhere a browser could substitute.
 *
 * The Reference Master snapshot used to freeze the FX rate is loaded
 * fresh, here, server-side (`loadReferenceMasterSnapshot`), never
 * accepted from the client: a client-supplied snapshot could otherwise
 * let a caller choose which FX rate gets frozen into a real financial
 * record, the one input this action does not trust from its caller.
 *
 * Customer Onboarding has no live approval workflow yet; see
 * ./server/commercial-configuration-promotion.ts's own header for why
 * this is an honest, controlled development/test promotion path, not a
 * faked approval.
 */

type PromotionActionResult = { ok: true; commercialConfigurationId: string } | { ok: false; error: string }

function toPromotionActionError(error: unknown): PromotionActionResult {
  if (error instanceof AuthorizationError) return { ok: false, error: error.message }
  if (error instanceof Error) return { ok: false, error: error.message }
  return { ok: false, error: "An unexpected error occurred while promoting this Commercial Rate draft." }
}

/** First promotion for a customer: a brand new Commercial Configuration. */
async function promoteCommercialRateDraftAsNewConfigurationAction(input: {
  customerId: string
  configurationKey: string
  configurationName: string
  draft: CommercialRateDraft
  effectiveDate: string
}): Promise<PromotionActionResult> {
  try {
    const actor = await requirePermission("commercial_configuration", "write")
    const snapshot = await loadReferenceMasterSnapshot()
    const result = await promoteOnboardingDraftAsNewConfiguration({
      customerId: input.customerId,
      configurationKey: input.configurationKey,
      configurationName: input.configurationName,
      draft: input.draft,
      snapshot,
      effectiveDate: input.effectiveDate,
      actorUserId: actor.appUserId,
    })
    return { ok: true, commercialConfigurationId: result.commercialConfiguration.id }
  } catch (error) {
    return toPromotionActionError(error)
  }
}

/** Every later promotion for the same customer: a new version (Commercial Change) against the EXISTING configuration. */
async function promoteCommercialRateDraftAsNewVersionAction(input: {
  commercialConfigurationId: string
  draft: CommercialRateDraft
  effectiveDate: string
  changeCategory: "renewal" | "amendment" | "correction" | "other"
  reason?: string | null
}): Promise<PromotionActionResult> {
  try {
    const actor = await requirePermission("commercial_configuration", "write")
    const snapshot = await loadReferenceMasterSnapshot()
    await promoteOnboardingDraftAsNewVersion({
      commercialConfigurationId: input.commercialConfigurationId,
      draft: input.draft,
      snapshot,
      effectiveDate: input.effectiveDate,
      changeCategory: input.changeCategory,
      actorUserId: actor.appUserId,
      reason: input.reason ?? null,
    })
    return { ok: true, commercialConfigurationId: input.commercialConfigurationId }
  } catch (error) {
    return toPromotionActionError(error)
  }
}

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

function toCaseActionError(error: unknown): CaseActionResult {
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

async function approveOnboardingCaseAction(requestId: string, effectiveDate: string): Promise<CaseActionResult> {
  try {
    const actor = await requirePermission("customer", "approve")
    const snapshot = await loadReferenceMasterSnapshot()
    const onboardingCase = await approveOnboardingCase(requestId, actor.appUserId, snapshot, effectiveDate)
    return { ok: true, onboardingCase }
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
  promoteCommercialRateDraftAsNewConfigurationAction,
  promoteCommercialRateDraftAsNewVersionAction,
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
export type { PromotionActionResult, CaseActionResult, CommercialVersionActionResult }
