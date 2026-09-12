"use server"

import { requirePermission } from "@/platform/permissions/server"
import { AuthorizationError } from "@/platform/permissions"
import { loadReferenceMasterSnapshot } from "@/features/reference-data/server"

import { promoteOnboardingDraftAsNewConfiguration, promoteOnboardingDraftAsNewVersion } from "./server/commercial-configuration-promotion"
import type { CommercialRateDraft } from "./domain/commercial-rate"

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

export { promoteCommercialRateDraftAsNewConfigurationAction, promoteCommercialRateDraftAsNewVersionAction }
export type { PromotionActionResult }
