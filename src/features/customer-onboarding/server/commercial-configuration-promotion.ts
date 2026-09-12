import "server-only"

import { commercialConfigurationService } from "@/features/commercial/server"
import type { CommercialChange, CommercialCommitment, CommercialComponent, CommercialConfiguration } from "@/features/commercial"
import type { ReferenceMasterSnapshot } from "@/features/reference-data"

import { isCommercialRateDraftComplete, newId } from "../domain/commercial-rate"
import type { CommercialRateDraft } from "../domain/commercial-rate"
import { mapOnboardingComponentToCommercialComponentInsert } from "../domain/commercial-configuration-promotion"

/**
 * Server-only orchestration: promotes a complete Commercial Rate
 * onboarding draft into the real, persistent, versioned Commercial
 * Configuration (docs/COMMERCIAL_DOMAIN_ARCHITECTURE.md §22, "a real
 * approved-case -> Commercial Configuration promotion path is future
 * work"). Reached only through
 * ../actions.ts's `promoteCommercialRateDraftAction`, never directly
 * from a Client Component: this module accepts `actorUserId` as an
 * explicit, already-authorized parameter, never derives or trusts a
 * client-supplied one (see that file's own header).
 *
 * Customer Onboarding has no live approval workflow yet (docs/
 * COMMERCIAL_DOMAIN_ARCHITECTURE.md §21: "if Customer Onboarding's full
 * approval workflow is not yet live, do not fake approval... allow a
 * controlled development/test promotion path only if necessary").
 * `createSystemCommercialRequest` (called here, for every promoted
 * version) mints one real, permanent `requests` row backing each
 * Commercial Change; this is a genuine, audited database write, not a
 * faked approval, but it is an honest stand-in for a future dedicated
 * Commercial Change Request business form with its own task/comment/
 * approval UI, which does not exist yet. See that RPC's own migration
 * comment (supabase/migrations/20260912210000_commercial_configuration_persistence.sql).
 */

type PromoteAsNewConfigurationInput = {
  customerId: string
  configurationKey: string
  configurationName: string
  draft: CommercialRateDraft
  snapshot: ReferenceMasterSnapshot
  effectiveDate: string
  actorUserId: string
  relationshipNote?: string | null
}

type PromoteAsNewVersionInput = {
  commercialConfigurationId: string
  draft: CommercialRateDraft
  snapshot: ReferenceMasterSnapshot
  effectiveDate: string
  changeCategory: "renewal" | "amendment" | "correction" | "other"
  actorUserId: string
  reason?: string | null
}

type PromotionResult = {
  commercialChange: CommercialChange
  components: CommercialComponent[]
  commitments: CommercialCommitment[]
}

/** Refuses to promote anything but a fully complete, valid draft: promotion is never a way to "save an incomplete draft into the real tables" (that stays local to onboarding until it is genuinely ready). */
function assertDraftPromotable(snapshot: ReferenceMasterSnapshot, draft: CommercialRateDraft): asserts draft is CommercialRateDraft & { billingCurrency: string } {
  if (!isCommercialRateDraftComplete(snapshot, draft)) {
    throw new Error("Cannot promote an incomplete or invalid Commercial Rate draft.")
  }
  if (!draft.billingCurrency) {
    throw new Error("Billing Currency is required to promote a Commercial Rate draft.")
  }
}

/** Adds one commercial_components row (plus its MUG commitment, if any) per onboarding component, all tied to the same, already-created Commercial Change. */
async function addComponentsForChange(
  draft: CommercialRateDraft & { billingCurrency: string },
  snapshot: ReferenceMasterSnapshot,
  effectiveDate: string,
  commercialConfigurationId: string,
  commercialChangeId: string,
  actorUserId: string
): Promise<{ components: CommercialComponent[]; commitments: CommercialCommitment[] }> {
  const components: CommercialComponent[] = []
  const commitments: CommercialCommitment[] = []

  for (const draftComponent of draft.components) {
    const mapped = mapOnboardingComponentToCommercialComponentInsert(draftComponent, snapshot, draft.billingCurrency, effectiveDate)
    const component = await commercialConfigurationService.addCommercialComponent({
      newCommercialComponentId: newId(),
      commercialConfigurationId,
      commercialChangeId,
      isRecurring: mapped.isRecurring,
      pricingRuleKind: mapped.pricingRuleKind,
      pricingRuleParameters: mapped.pricingRuleParameters,
      billingCadence: mapped.billingCadence,
      billingTiming: mapped.billingTiming,
      billingQuantityBasis: mapped.billingQuantityBasis,
      reconciliationCadence: mapped.reconciliationCadence,
      transactionCurrency: mapped.transactionCurrency,
      fxSnapshotRate: mapped.fxSnapshotRate,
      effectiveFrom: mapped.effectiveFrom,
      actorUserId,
    })
    components.push(component)

    if (mapped.mugThresholdValue !== null) {
      const commitment = await commercialConfigurationService.addCommercialCommitment({
        newCommercialCommitmentId: newId(),
        commercialChangeId,
        commercialComponentId: component.id,
        thresholdValue: mapped.mugThresholdValue,
        effectiveFrom: mapped.effectiveFrom,
        actorUserId,
      })
      commitments.push(commitment)
    }
  }

  return { components, commitments }
}

/** First promotion for a customer: creates a brand new Commercial Configuration, its initial_setup Change, and every Component. */
async function promoteOnboardingDraftAsNewConfiguration(
  input: PromoteAsNewConfigurationInput
): Promise<{ commercialConfiguration: CommercialConfiguration } & PromotionResult> {
  assertDraftPromotable(input.snapshot, input.draft)

  const requestId = newId()
  await commercialConfigurationService.createSystemCommercialRequest({ newRequestId: requestId, actorUserId: input.actorUserId })

  const { commercialChange, commercialConfiguration } = await commercialConfigurationService.createCommercialConfiguration(
    {
      newCommercialConfigurationId: newId(),
      requestId,
      customerId: input.customerId,
      key: input.configurationKey,
      name: input.configurationName,
      effectiveDate: input.effectiveDate,
      relationshipNote: input.relationshipNote ?? null,
    },
    input.actorUserId
  )

  const { components, commitments } = await addComponentsForChange(
    input.draft,
    input.snapshot,
    input.effectiveDate,
    commercialConfiguration.id,
    commercialChange.id,
    input.actorUserId
  )

  return { commercialConfiguration, commercialChange, components, commitments }
}

/** Every later promotion for the same customer: a new Commercial Change against the EXISTING configuration, closing every currently-open component. */
async function promoteOnboardingDraftAsNewVersion(input: PromoteAsNewVersionInput): Promise<PromotionResult> {
  assertDraftPromotable(input.snapshot, input.draft)

  const requestId = newId()
  await commercialConfigurationService.createSystemCommercialRequest({ newRequestId: requestId, actorUserId: input.actorUserId })

  const commercialChange = await commercialConfigurationService.createCommercialChangeForConfiguration({
    commercialConfigurationId: input.commercialConfigurationId,
    requestId,
    changeCategory: input.changeCategory,
    effectiveDate: input.effectiveDate,
    actorUserId: input.actorUserId,
    reason: input.reason ?? null,
  })

  const { components, commitments } = await addComponentsForChange(
    input.draft,
    input.snapshot,
    input.effectiveDate,
    input.commercialConfigurationId,
    commercialChange.id,
    input.actorUserId
  )

  return { commercialChange, components, commitments }
}

export { promoteOnboardingDraftAsNewConfiguration, promoteOnboardingDraftAsNewVersion }
