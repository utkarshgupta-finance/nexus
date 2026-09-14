import "server-only"

import { listChangeRequestsForCustomer, listCustomerFieldHistory } from "@/features/customer-change/server"
import { getOnboardingOriginForCustomer, listVersionsForConfiguration } from "@/features/customer-onboarding/server"
import { commercialConfigurationService } from "@/features/commercial/server"
import { listAuditLogForRow, resolveActorLabels } from "@/platform/audit/server"
import { emptySnapshot, loadReferenceMasterSnapshot } from "@/features/reference-data/server"
import { buildCustomerActivityTimeline, collectActorIds } from "../domain/activity"
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
async function buildActivityTimelineFromContext(customerId: string, context: CustomerDetailContext): Promise<CustomerActivityEvent[]> {
  const statusAuditRows = await listAuditLogForRow("customers", customerId)
  const actorLabels = await resolveActorLabels(
    collectActorIds({
      onboardingOrigin: context.onboardingOrigin,
      changeRequests: context.changeRequests,
      fieldHistory: context.fieldHistory,
      commercialVersions: context.commercialVersions,
      statusAuditRows,
    })
  )

  return buildCustomerActivityTimeline({ ...context, statusAuditRows, actorLabels })
}

async function loadCustomerActivityTimeline(customerId: string): Promise<CustomerActivityEvent[]> {
  const context = await loadCustomerDetailContext(customerId)
  return buildActivityTimelineFromContext(customerId, context)
}

export { loadCustomerActivityTimeline, loadCustomerDetailContext, buildActivityTimelineFromContext }
export type { CustomerDetailContext }
