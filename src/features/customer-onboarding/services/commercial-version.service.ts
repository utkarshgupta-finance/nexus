import "server-only"

import { commercialConfigurationService } from "@/features/commercial/server"
import type { ReferenceMasterSnapshot } from "@/features/reference-data"
import { withLoggedOperation } from "@/platform/observability/server"
import { resolveActorLabels } from "@/platform/audit/server"
import type { RequestTimelineEvent } from "@/components/product/request-timeline"
import { buildCommercialVersionTimeline, collectCommercialVersionTimelineActorIds } from "../domain/commercial-version-timeline"

import * as versionData from "../data/commercial-version.data"
import { toCommercialConfigurationVersion } from "../domain/commercial-version-mappers"
import { toDraftComponent } from "../domain/commercial-configuration-view"
import { mapOnboardingComponentToCommercialComponentInsert } from "../domain/commercial-configuration-promotion"
import { newId, isCommercialRateDraftComplete } from "../domain/commercial-rate"
import type { CommercialRateDraft } from "../domain/commercial-rate"
import { diffCommercialRate } from "../domain/commercial-rate-diff"
import type { CommercialRateDiff } from "../domain/commercial-rate-diff"
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

/** Reconstructs a CommercialRateDraft from a Commercial Configuration's currently-active Components, using the exact inverse mapper the Customer Commercials view already relies on. Shared by "Create New Version copies current Active into Version 2 Draft" (task spec) and the Commercial Version review page's Current vs Proposed diff (task Phase G): both need the identical "what is current, right now" reconstruction, never two divergent ones. */
async function getCurrentCommercialRateDraft(commercialConfigurationId: string): Promise<CommercialRateDraft> {
  const components = await commercialConfigurationService.listCommercialComponents(commercialConfigurationId)
  const activeComponents = components.filter((component) => component.effectiveTo === null)
  return {
    billingCurrency: activeComponents[0]?.transactionCurrency ?? null,
    components: activeComponents.map(toDraftComponent),
  }
}

async function createVersionFromActive(
  commercialConfigurationId: string,
  changeCategory: CommercialVersionChangeCategory,
  actorUserId: string
): Promise<CommercialConfigurationVersion> {
  const draft = await getCurrentCommercialRateDraft(commercialConfigurationId)

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

/** Task Phase C: only a draft version may be discarded, and only by its own creator (both enforced server-side by cancel_commercial_configuration_version, not only here). */
async function cancelVersion(requestId: string, reason: string | null, actorUserId: string): Promise<CommercialConfigurationVersion> {
  await versionData.cancelVersion(requestId, reason, actorUserId)
  const version = await loadVersion(requestId)
  if (!version) throw new Error(`Commercial Configuration Version ${requestId} not found after cancelling.`)
  return version
}

/** The atomic apply/activate: maps the version's submitted Commercial Rate draft through the exact same promotion mapper used everywhere else, then calls the single atomic approve_commercial_configuration_version RPC, which closes the prior version's Components and materializes every new one in one transaction. Logged (Platform Scale Program, Phase A): this is the one operation that revalues a customer's live commercial terms, so a failure here must be traceable without reproducing it manually. */
async function approveVersion(requestId: string, actorUserId: string, snapshot: ReferenceMasterSnapshot): Promise<CommercialConfigurationVersion> {
  return withLoggedOperation(
    { eventCode: "commercial.version_approve", operation: "approveVersion", resourceType: "commercial_configuration_version", resourceId: requestId, actorUserId },
    async () => {
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
          // Stable Commercial Component Identity: a component reconstructed
          // from the currently active row (getCurrentCommercialRateDraft ->
          // toDraftComponent) carries that row's own stableComponentKey
          // forward unchanged. A genuinely new component added in this
          // version has none (createComponent seeds null), so
          // approve_commercial_configuration_version's own
          // coalesce(p_stable_component_key, p_new_commercial_component_id)
          // mints a fresh identity for it, exactly once.
          stable_component_key: component.stableComponentKey,
        }
      })

      await versionData.approveVersion(requestId, components, actorUserId)
      const approved = await loadVersion(requestId)
      if (!approved) throw new Error(`Commercial Configuration Version ${requestId} not found after approving.`)
      return approved
    }
  )
}

/**
 * One Commercial Configuration Version's own Timeline (Platform Scale
 * Program, Phase I): unlike Onboarding/Customer Change, there is only
 * ever one revision (no send-back/resubmit cycle exists for a Commercial
 * Version, see ../domain/commercial-version-timeline.ts's own header),
 * so this reads straight off the version's own row plus its one
 * submission_revisions row, never a history table.
 */
async function loadCommercialVersionTimeline(requestId: string): Promise<RequestTimelineEvent[]> {
  const version = await loadVersion(requestId)
  if (!version) return []

  const revision = await versionData.getLatestRevisionForRequest(requestId)
  const decisionStatus = version.status === "approved" || version.status === "rejected" ? version.status : null

  const input = {
    createdAt: version.createdAt,
    createdBy: version.createdBy,
    submittedAt: revision?.submitted_at ?? null,
    submittedBy: revision?.submitted_by ?? null,
    decidedAt: version.decidedAt,
    decidedBy: version.decidedBy,
    decisionStatus,
    decisionReason: version.decisionReason,
  }

  const actorLabels = await resolveActorLabels(collectCommercialVersionTimelineActorIds(input))
  return buildCommercialVersionTimeline({ ...input, actorLabels })
}

type ReviewQueueEntry = {
  requestId: string
  /** Human-Friendly ID (task Phase L): render with `formatCommercialVersionId`. */
  versionNumber: number
  commercialConfigurationId: string
  status: CommercialConfigurationVersion["status"]
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

function toReviewQueueEntry(row: {
  request_id: string
  version_number: number
  commercial_configuration_id: string
  status: CommercialConfigurationVersion["status"]
  created_by: string | null
  created_at: string
  updated_at: string
}): ReviewQueueEntry {
  return {
    requestId: row.request_id,
    versionNumber: row.version_number,
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
  // One batched revision query instead of one query per row (Platform
  // Scale Closure, Phase V): `rows` already carries the full version row,
  // so re-fetching it per row via loadVersion (as the previous shape did)
  // was also a redundant read, not only an unbatched revision lookup.
  const revisionsByRequestId = await versionData.getLatestRevisionsForRequests(rows.map((row) => row.request_id))
  return rows.map((row) => toCommercialConfigurationVersion(row, revisionsByRequestId.get(row.request_id) ?? null))
}

/** Commercial Current vs Proposed diff (task Phase G): null only when the version has no saved draft yet (nothing to compare against). */
async function getCommercialVersionDiff(requestId: string): Promise<CommercialRateDiff | null> {
  const version = await loadVersion(requestId)
  if (!version || !version.commercialRate) return null
  const current = await getCurrentCommercialRateDraft(version.commercialConfigurationId)
  return diffCommercialRate(current, version.commercialRate)
}

export {
  loadVersion,
  createVersionFromActive,
  getCurrentCommercialRateDraft,
  getCommercialVersionDiff,
  saveVersionDraft,
  submitVersion,
  rejectVersion,
  approveVersion,
  cancelVersion,
  listVersionReviewQueue,
  listAllVersionEntries,
  listVersionsForConfiguration,
  loadCommercialVersionTimeline,
}
export type { ReviewQueueEntry }
