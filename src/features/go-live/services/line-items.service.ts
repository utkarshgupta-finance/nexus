import "server-only"

import { commercialConfigurationService, getCommercialConfigurationOverview } from "@/features/commercial/server"
import { listVersionsForConfiguration } from "@/features/customer-onboarding/server"
import { deriveLineItemGoLiveStatus, currentGoLiveRequestForLineItem } from "../domain/types"
import { listGoLiveRequestsForStableComponentKeys } from "../data/go-live.data"
import { toGoLiveRequest } from "../domain/mappers"
import type { GoLiveLineItem } from "../domain/line-items"
import type { GoLiveRequest } from "../domain/types"
import type { ComponentSummary } from "@/features/commercial"

/** A quantity-kind MUG commitment's own threshold, for display context only ("Minimum Usage Guarantee: 500 per month"); the exact metric/unit label is not yet a resolvable Commercial column (see docs/GO_LIVE_ENTITLEMENT_ARCHITECTURE.md), so this shows the number, never a fabricated unit name. */
function mugSummaryForComponent(component: ComponentSummary): string | null {
  const quantityCommitment = component.commitments.find((commitment) => commitment.kind === "quantity")
  if (!quantityCommitment) return null
  return `${quantityCommitment.thresholdValue} per month`
}

/**
 * Read model for the Customer -> Go Live tab: every CURRENT Commercial
 * line item (recurring and on-demand alike), each resolved against the
 * Go Live requests that exist for its stable identity. Composed
 * entirely from already-existing Commercial/Onboarding services (no new
 * Commercial data access): a Configuration's overview already carries
 * current components with labels; Version identity is resolved by
 * matching each component's originating Change against
 * commercial_configuration_versions.commercial_change_id, falling back
 * to "Version 1, no version row" for the never-versioned original setup
 * (a real, confirmed state for several live configurations).
 */
async function listCurrentLineItemsForCustomer(customerId: string): Promise<GoLiveLineItem[]> {
  const configurations = await commercialConfigurationService.listCommercialConfigurationsByCustomer(customerId)

  const perConfiguration = await Promise.all(
    configurations.map(async (configuration) => {
      const [overview, versions] = await Promise.all([
        getCommercialConfigurationOverview(configuration.id),
        listVersionsForConfiguration(configuration.id),
      ])
      if (!overview) return []

      const versionByChangeId = new Map(versions.filter((version) => version.commercialChangeId).map((version) => [version.commercialChangeId as string, version]))
      const versionNumberByChangeId = new Map(overview.versions.map((version) => [version.changeId, version.versionNumber]))

      return overview.components
        .filter((component) => component.effectiveTo === null)
        .map((component) => {
          const versionSummary = overview.versions.find((version) => version.componentIds.includes(component.id))
          const changeId = versionSummary?.changeId ?? null
          const matchedVersion = changeId ? (versionByChangeId.get(changeId) ?? null) : null
          return {
            customerId: configuration.customerId,
            stableComponentKey: component.stableComponentKey,
            commercialComponentId: component.id,
            commercialConfigurationId: configuration.id,
            commercialVersionId: matchedVersion?.requestId ?? null,
            versionNumber: changeId ? (versionNumberByChangeId.get(changeId) ?? 1) : 1,
            componentLabel: component.label,
            pricingModelLabel: component.pricingRuleKindLabel,
            billingCadenceLabel: component.billingCadenceLabel,
            mugSummary: mugSummaryForComponent(component),
            isRecurring: component.isRecurring,
            billingCurrency: component.transactionCurrency,
            effectiveFrom: component.effectiveFrom,
          }
        })
    })
  )

  const lineItemsWithoutGoLive = perConfiguration.flat()
  const stableComponentKeys = lineItemsWithoutGoLive.map((item) => item.stableComponentKey)
  const goLiveRows = await listGoLiveRequestsForStableComponentKeys(stableComponentKeys)
  const goLiveRequests: GoLiveRequest[] = goLiveRows.map(toGoLiveRequest)
  const requestsByStableKey = new Map<string, GoLiveRequest[]>()
  for (const request of goLiveRequests) {
    const existing = requestsByStableKey.get(request.stableComponentKey) ?? []
    existing.push(request)
    requestsByStableKey.set(request.stableComponentKey, existing)
  }

  return lineItemsWithoutGoLive.map((item) => {
    const requestsForItem = requestsByStableKey.get(item.stableComponentKey) ?? []
    return {
      ...item,
      goLiveStatus: item.isRecurring ? deriveLineItemGoLiveStatus(requestsForItem) : "NO_GO_LIVE",
      currentRequest: item.isRecurring ? currentGoLiveRequestForLineItem(requestsForItem) : null,
    }
  })
}

export { listCurrentLineItemsForCustomer }
