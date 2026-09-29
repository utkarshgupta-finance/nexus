import "server-only"

import { listChangeRequestsForCustomer, listCustomerFieldHistory } from "@/features/customer-change/server"
import type { CustomerChangeRequest, CustomerFieldHistoryEntry } from "@/features/customer-change"
import { getOnboardingOriginForCustomer, listVersionsForConfiguration } from "@/features/customer-onboarding/server"
import { commercialConfigurationService } from "@/features/commercial/server"
import { listAuditLogForRow, listAuditLogForRows, resolveActorLabels } from "@/platform/audit/server"
import type { AuditLogRow } from "@/platform/audit/server"
import { emptySnapshot, loadReferenceMasterSnapshot } from "@/features/reference-data/server"
import { buildCustomerActivityTimeline, collectActorIds, buildAuditIndex, historicalActorLabel } from "../domain/activity"
import type { CustomerActivityEvent } from "../domain/activity"
import type { OnboardingOrigin } from "@/features/customer-onboarding/server"
import type { ReferenceMasterSnapshot } from "@/features/reference-data"

type CustomerDetailContext = {
  onboardingOrigin: OnboardingOrigin | null
  changeRequests: Awaited<ReturnType<typeof listChangeRequestsForCustomer>>
  fieldHistory: Awaited<ReturnType<typeof listCustomerFieldHistory>>
  commercialConfigurations: Awaited<ReturnType<typeof commercialConfigurationService.listCommercialConfigurationsByCustomer>>
  commercialVersions: Awaited<ReturnType<typeof listVersionsForConfiguration>>
  referenceMasterSnapshot: ReferenceMasterSnapshot
}

/**
 * The one place the Customer detail route's shared data (Change Requests,
 * Field History, the onboarding origin, Commercial Configurations/
 * Versions, the Reference Master snapshot) is fetched, so the page and
 * the Activity timeline builder below stop each independently re-running
 * the same queries (Platform Scale Closure, Phase V: the prior shape had
 * `page.tsx` and `loadCustomerActivityTimeline` each fetching Change
 * Requests, Field History, onboarding origin, and the Reference Master
 * snapshot separately, doubling every one of those round trips). Each
 * field keeps the same independent failure fallback the callers already
 * relied on, so a single source failing still degrades gracefully rather
 * than taking down the whole page.
 */
async function loadCustomerDetailContext(customerId: string): Promise<CustomerDetailContext> {
  const [onboardingOrigin, changeRequests, fieldHistory, commercialConfigurations] = await Promise.all([
    getOnboardingOriginForCustomer(customerId).catch((): OnboardingOrigin | null => null),
    listChangeRequestsForCustomer(customerId),
    listCustomerFieldHistory(customerId),
    commercialConfigurationService.listCommercialConfigurationsByCustomer(customerId).catch(() => []),
  ])

  const commercialVersions = (
    await Promise.all(commercialConfigurations.map((configuration) => listVersionsForConfiguration(configuration.id)))
  ).flat()

  let referenceMasterSnapshot: ReferenceMasterSnapshot
  try {
    referenceMasterSnapshot = await loadReferenceMasterSnapshot()
  } catch {
    referenceMasterSnapshot = emptySnapshot()
  }

  return { onboardingOrigin, changeRequests, fieldHistory, commercialConfigurations, commercialVersions, referenceMasterSnapshot }
}

/**
 * Customer Activity timeline (task Phase C): resolves actor ids to
 * emails in one batched lookup and hands off to the pure builder, given
 * a context already fetched once by the caller (or fetches it itself if
 * the caller only wants the timeline in isolation).
 */
/**
 * PG-058: every `audit_log` row for the domain-table rows a customer's
 * Activity/History could ever reference, batch-fetched once. Used both
 * to build the point-in-time correlation index (`buildAuditIndex`) for
 * the Activity timeline, and reused directly by
 * `resolveFieldHistoryActorLabels` below for the History tab's own
 * separate Field History table, so both surfaces agree by construction
 * (one shared source of point-in-time truth, never two divergent
 * resolutions of the same historical fact).
 */
async function loadCorrelatingAuditRows(context: CustomerDetailContext): Promise<AuditLogRow[]> {
  const [changeRequestRows, commercialVersionRows, onboardingRows] = await Promise.all([
    listAuditLogForRows(
      "customer_change_requests",
      context.changeRequests.map((request) => request.requestId)
    ),
    listAuditLogForRows(
      "commercial_configuration_versions",
      context.commercialVersions.map((version) => version.requestId)
    ),
    context.onboardingOrigin ? listAuditLogForRows("customer_onboarding_cases", [context.onboardingOrigin.requestId]) : Promise.resolve([]),
  ])
  return [...changeRequestRows, ...commercialVersionRows, ...onboardingRows]
}

async function buildActivityTimelineFromContext(customerId: string, context: CustomerDetailContext): Promise<CustomerActivityEvent[]> {
  const [statusAuditRows, correlatingAuditRows] = await Promise.all([listAuditLogForRow("customers", customerId), loadCorrelatingAuditRows(context)])
  const auditIndex = buildAuditIndex(correlatingAuditRows)
  const actorLabels = await resolveActorLabels(
    collectActorIds({
      onboardingOrigin: context.onboardingOrigin,
      changeRequests: context.changeRequests,
      fieldHistory: context.fieldHistory,
      commercialVersions: context.commercialVersions,
      statusAuditRows,
    })
  )

  return buildCustomerActivityTimeline({ ...context, statusAuditRows, actorLabels, auditIndex })
}

async function loadCustomerActivityTimeline(customerId: string): Promise<CustomerActivityEvent[]> {
  const context = await loadCustomerDetailContext(customerId)
  return buildActivityTimelineFromContext(customerId, context)
}

/**
 * PG-058: point-in-time "Requested By"/"Approved By" labels for the
 * Customer Master History tab's own Field History table, keyed by field
 * history entry id (never by actor id: the same actor can appear at
 * different points in time under different display names, so a label
 * keyed only by actor id could not represent both correctly at once).
 * "Requested By" correlates to the same change request's own creation
 * audit row (its timestamp is the request's own `createdAt`, not this
 * field's `changedAt`); "Approved By" correlates to the approval that
 * actually applied this specific field change, at `changedAt` itself.
 */
async function resolveFieldHistoryActorLabels(
  fieldHistory: CustomerFieldHistoryEntry[],
  changeRequests: CustomerChangeRequest[]
): Promise<Map<string, { requestedBy: string | null; approvedBy: string | null }>> {
  const changeRequestIds = Array.from(new Set(fieldHistory.map((entry) => entry.changeRequestId).filter((id): id is string => id !== null)))
  const [auditRows, actorLabels] = await Promise.all([
    listAuditLogForRows("customer_change_requests", changeRequestIds),
    resolveActorLabels(fieldHistory.flatMap((entry) => [entry.requestedBy, entry.approvedBy])),
  ])
  const auditIndex = buildAuditIndex(auditRows)
  const changeRequestsById = new Map(changeRequests.map((request) => [request.requestId, request]))

  const labels = new Map<string, { requestedBy: string | null; approvedBy: string | null }>()
  for (const entry of fieldHistory) {
    const createdAt = entry.changeRequestId ? (changeRequestsById.get(entry.changeRequestId)?.createdAt ?? entry.changedAt) : entry.changedAt
    labels.set(entry.id, {
      requestedBy: historicalActorLabel("customer_change_requests", entry.changeRequestId, entry.requestedBy, createdAt, auditIndex, actorLabels),
      approvedBy: historicalActorLabel("customer_change_requests", entry.changeRequestId, entry.approvedBy, entry.changedAt, auditIndex, actorLabels),
    })
  }
  return labels
}

export { loadCustomerActivityTimeline, loadCustomerDetailContext, buildActivityTimelineFromContext, resolveFieldHistoryActorLabels }
export type { CustomerDetailContext }
