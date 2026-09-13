import "server-only"

import { countCommercialConfigurations, countApprovedChangeRequests } from "../data/deletion.data"
import { toDeletionEligibility } from "../domain/deletion-mappers"
import type { DeletionEligibility } from "../domain/deletion-types"

/**
 * TRUSTED, SERVER-ONLY read: Permanent Customer Deletion eligibility
 * (Customer Lifecycle V1, Phase 14-16). Computed fresh from the real
 * schema every call, never cached: this is shown to the requester before
 * enabling the "Permanently Delete Customer" action, but
 * `delete_customer_permanently` re-checks the same facts server-side
 * before ever deleting anything, so a stale read here can never cause an
 * unsafe delete.
 */
async function getCustomerDeletionEligibility(customerId: string): Promise<DeletionEligibility> {
  const [commercialConfigurationCount, approvedChangeRequestCount] = await Promise.all([
    countCommercialConfigurations(customerId),
    countApprovedChangeRequests(customerId),
  ])
  return toDeletionEligibility(customerId, commercialConfigurationCount, approvedChangeRequestCount)
}

export { getCustomerDeletionEligibility }
