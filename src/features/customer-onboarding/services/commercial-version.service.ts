import "server-only"

import { commercialConfigurationService } from "@/features/commercial/server"
import type { ReferenceMasterSnapshot } from "@/features/reference-data"

import * as versionData from "../data/commercial-version.data"
import { toCommercialConfigurationVersion } from "../domain/commercial-version-mappers"
import { toDraftComponent } from "../domain/commercial-configuration-view"
import { mapOnboardingComponentToCommercialComponentInsert } from "../domain/commercial-configuration-promotion"
import { newId, isCommercialRateDraftComplete } from "../domain/commercial-rate"
import type { CommercialRateDraft } from "../domain/commercial-rate"
import type { CommercialConfigurationVersion, CommercialVersionChangeCategory } from "../domain/commercial-version-types"

/**
 * Application service for the real, database-backed Commercial
 * Configuration Version lifecycle (Customer Lifecycle V1, Phase 10-13),
 * mirroring ../services/case.service.ts's own shape. Reuses the existing
 * Commercial Rate editor's own domain/mapping modules directly (same
 * feature, not a cross-feature reach-in): `toDraftComponent` to seed a
 * new draft from the current active version, and
 * `mapOnboardingComponentToCommercialComponentInsert` to map the
 * finished draft into the RPC's expected insert shape at Approve time,
 * exactly like ../services/case.service.ts's own approveOnboardingCase
 * already does for the initial Commercial Configuration.
 */

async function loadVersion(requestId: string): Promise<CommercialConfigurationVersion | null> {
  const [row, revision] = await Promise.all([versionData.getVersionByRequestId(requestId), versionData.getLatestRevisionForRequest(requestId)])
  if (!row) return null
  return toCommercialConfigurationVersion(row, revision)
}

/** "Create New Version copies current Active into Version 2 Draft" (task spec): reconstructs a CommercialRateDraft from the configuration's currently-active Components, using the exact inverse mapper the Customer Commercials view already relies on. */
async function createVersionFromActive(
  commercialConfigurationId: string,
  changeCategory: CommercialVersionChangeCategory,
  actorUserId: string
): Promise<CommercialConfigurationVersion> {
  const components = await commercialConfigurationService.listCommercialComponents(commercialConfigurationId)
  const activeComponents = components.filter((component) => component.effectiveTo === null)

  const draft: CommercialRateDraft = {
    billingCurrency: activeComponents[0]?.transactionCurrency ?? null,
    components: activeComponents.map(toDraftComponent),
  }

  const requestId = newId()
  await versionData.createVersion({
    newRequestId: requestId,
    commercialConfigurationId,
    changeCategory,
    initialRawData: { commercial_rate: draft },
    actorUserId,
  })

  const version = await loadVersion(requestId)
  if (!version) throw new Error("Failed to load the Commercial Configuration Version immediately after creating it.")
  return version
}

async function saveVersionDraft(requestId: string, commercialRate: CommercialRateDraft, actorUserId: string): Promise<CommercialConfigurationVersion> {
  await versionData.saveDraft(requestId, { commercial_rate: commercialRate }, actorUserId)
  const version = await loadVersion(requestId)
  if (!version) throw new Error(`Commercial Configuration Version ${requestId} not found after saving draft.`)
  return version
}

async function submitVersion(requestId: string, reason: string, effectiveDate: string, actorUserId: string): Promise<CommercialConfigurationVersion> {
  await versionData.submitVersion({ requestId, reason, effectiveDate, actorUserId })
  const version = await loadVersion(requestId)
  if (!version) throw new Error(`Commercial Configuration Version ${requestId} not found after submitting.`)
  return version
}

async function rejectVersion(requestId: string, reason: string, actorUserId: string): Promise<CommercialConfigurationVersion> {
  await versionData.rejectVersion(requestId, reason, actorUserId)
  const version = await loadVersion(requestId)
  if (!version) throw new Error(`Commercial Configuration Version ${requestId} not found after rejecting.`)
  return version
}

/** The atomic apply/activate: maps the version's submitted Commercial Rate draft through the exact same promotion mapper used everywhere else, then calls the single atomic approve_commercial_configuration_version RPC, which closes the prior version's Components and materializes every new one in one transaction. */
async function approveVersion(requestId: string, actorUserId: string, snapshot: ReferenceMasterSnapshot): Promise<CommercialConfigurationVersion> {
  const version = await loadVersion(requestId)
  if (!version) throw new Error(`Commercial Configuration Version ${requestId} not found.`)
  if (!version.effectiveDate) throw new Error("Cannot approve a version with no effective date recorded.")

  const draft = version.commercialRate
  if (!draft || !isCommercialRateDraftComplete(snapshot, draft) || !draft.billingCurrency) {
    throw new Error("Cannot approve a version with no complete Commercial Rate recorded.")
  }

  const components = draft.components.map((component) => {
    const mapped = mapOnboardingComponentToCommercialComponentInsert(component, snapshot, draft.billingCurrency as string, version.effectiveDate as string)
    return {
      is_recurring: mapped.isRecurring,
      pricing_rule_kind: mapped.pricingRuleKind,
      pricing_rule_parameters: mapped.pricingRuleParameters,
      billing_cadence: mapped.billingCadence,
      billing_timing: mapped.billingTiming,
      billing_quantity_basis: mapped.billingQuantityBasis,
      reconciliation_cadence: mapped.reconciliationCadence,
      transaction_currency: mapped.transactionCurrency,
      fx_snapshot_rate: mapped.fxSnapshotRate,
      effective_from: mapped.effectiveFrom,
      mug_threshold_value: mapped.mugThresholdValue,
    }
  })

  await versionData.approveVersion(requestId, components, actorUserId)
  const approved = await loadVersion(requestId)
  if (!approved) throw new Error(`Commercial Configuration Version ${requestId} not found after approving.`)
  return approved
}

type ReviewQueueEntry = {
  requestId: string
  commercialConfigurationId: string
  status: CommercialConfigurationVersion["status"]
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

function toReviewQueueEntry(row: { request_id: string; commercial_configuration_id: string; status: CommercialConfigurationVersion["status"]; created_by: string | null; created_at: string; updated_at: string }): ReviewQueueEntry {
  return {
    requestId: row.request_id,
    commercialConfigurationId: row.commercial_configuration_id,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

async function listVersionReviewQueue(): Promise<ReviewQueueEntry[]> {
  const rows = await versionData.listVersionsAwaitingReview()
  return rows.map(toReviewQueueEntry)
}

/** Every version regardless of status: the unified Approvals inbox's data source (task Phase E). */
async function listAllVersionEntries(): Promise<ReviewQueueEntry[]> {
  const rows = await versionData.listAllVersions()
  return rows.map(toReviewQueueEntry)
}

async function listVersionsForConfiguration(commercialConfigurationId: string): Promise<CommercialConfigurationVersion[]> {
  const rows = await versionData.listVersionsForConfiguration(commercialConfigurationId)
  const loaded = await Promise.all(rows.map((row) => loadVersion(row.request_id)))
  return loaded.filter((entry): entry is CommercialConfigurationVersion => entry !== null)
}

export {
  loadVersion,
  createVersionFromActive,
  saveVersionDraft,
  submitVersion,
  rejectVersion,
  approveVersion,
  listVersionReviewQueue,
  listAllVersionEntries,
  listVersionsForConfiguration,
}
export type { ReviewQueueEntry }
