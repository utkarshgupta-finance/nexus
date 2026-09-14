import "server-only"

import { listChangeRequestsForCustomer, listCustomerFieldHistory } from "@/features/customer-change/server"
import { getOnboardingOriginForCustomer, listVersionsForConfiguration } from "@/features/customer-onboarding/server"
import { commercialConfigurationService } from "@/features/commercial/server"
import { listAuditLogForRow, resolveActorEmails } from "@/platform/audit/server"
import { emptySnapshot, loadReferenceMasterSnapshot } from "@/features/reference-data/server"
import { buildCustomerActivityTimeline, collectActorIds } from "../domain/activity"
import type { CustomerActivityEvent } from "../domain/activity"

/**
 * Customer Activity timeline (task Phase C): gathers every real event
 * source for one customer, resolves actor ids to emails in one batched
 * lookup, and hands off to the pure builder. Read-only, additive: no new
 * table, reuses Field History, Change Requests, Commercial Configuration
 * Versions, the onboarding case that created this customer, and the
 * `customers` row's own `audit_log` trail.
 */
async function loadCustomerActivityTimeline(customerId: string): Promise<CustomerActivityEvent[]> {
  const [onboardingOrigin, changeRequests, fieldHistory, commercialConfigurations, statusAuditRows] = await Promise.all([
    getOnboardingOriginForCustomer(customerId),
    listChangeRequestsForCustomer(customerId),
    listCustomerFieldHistory(customerId),
    commercialConfigurationService.listCommercialConfigurationsByCustomer(customerId),
    listAuditLogForRow("customers", customerId),
  ])

  const commercialVersions = (
    await Promise.all(commercialConfigurations.map((configuration) => listVersionsForConfiguration(configuration.id)))
  ).flat()

  const actorEmails = await resolveActorEmails(
    collectActorIds({ onboardingOrigin, changeRequests, fieldHistory, commercialVersions, statusAuditRows })
  )

  let referenceMasterSnapshot
  try {
    referenceMasterSnapshot = await loadReferenceMasterSnapshot()
  } catch {
    referenceMasterSnapshot = emptySnapshot()
  }

  return buildCustomerActivityTimeline({
    onboardingOrigin,
    changeRequests,
    fieldHistory,
    commercialVersions,
    statusAuditRows,
    actorEmails,
    referenceMasterSnapshot,
  })
}

export { loadCustomerActivityTimeline }
