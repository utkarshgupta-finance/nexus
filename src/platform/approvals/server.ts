import "server-only"

import { listAllOnboardingEntries, listAllVersionEntries, formatOnboardingCaseId, formatCommercialVersionId } from "@/features/customer-onboarding/server"
import { listAllChangeRequestEntries } from "@/features/customer-change/server"
import { formatChangeRequestId } from "@/features/customer-change"
import { getCustomersByIds } from "@/features/customers/server"
import { commercialConfigurationService } from "@/features/commercial/server"
import { resolveActorEmails } from "@/platform/audit/server"
import { bucketForStatus, sortByUpdatedAtDesc } from "./domain/inbox"
import { buildMyWorkItems } from "./domain/my-work"
import type { ApprovalInboxItem } from "./domain/types"
import type { MyWorkItem } from "./domain/my-work"

/**
 * Unified Approvals inbox (task Phase E): gathers every real request
 * type's own "all entries" read (never a new table, never a duplicated
 * workflow), resolves each to its customer name and requester email in
 * batched lookups, and returns one merged, newest-first list. The
 * calling route is responsible for its own `customer.read`/
 * `commercial_configuration.read` AuthGate; this itself trusts nothing
 * about who is asking, same as every other platform capability's own
 * server.ts entry point.
 */
async function loadApprovalInbox(): Promise<ApprovalInboxItem[]> {
  const [onboardingEntries, changeRequestEntries, versionEntries] = await Promise.all([
    listAllOnboardingEntries(),
    listAllChangeRequestEntries(),
    listAllVersionEntries(),
  ])

  // Batched, not one round trip per entry: this composer runs on every
  // Approvals/My Work page load, and its round-trip count previously grew
  // linearly with the number of onboarding/change-request/version entries.
  const versionConfigurations = await Promise.all(
    versionEntries.map((entry) => commercialConfigurationService.getCommercialConfiguration(entry.commercialConfigurationId))
  )
  const customerIds = [
    ...changeRequestEntries.map((entry) => entry.customerId),
    ...versionConfigurations.map((configuration) => configuration?.customerId).filter((id): id is string => Boolean(id)),
  ]
  const customersById = new Map((await getCustomersByIds([...new Set(customerIds)])).map((customer) => [customer.id, customer]))
  const changeRequestCustomers = changeRequestEntries.map((entry) => customersById.get(entry.customerId) ?? null)
  const versionCustomers = versionConfigurations.map((configuration) => (configuration ? (customersById.get(configuration.customerId) ?? null) : null))

  const actorEmails = await resolveActorEmails([
    ...onboardingEntries.map((entry) => entry.createdBy),
    ...changeRequestEntries.map((entry) => entry.createdBy),
    ...versionEntries.map((entry) => entry.createdBy),
  ])

  const items: ApprovalInboxItem[] = []

  for (const entry of onboardingEntries) {
    const bucket = bucketForStatus(entry.status)
    if (!bucket) continue
    items.push({
      type: "onboarding",
      requestId: entry.requestId,
      displayId: formatOnboardingCaseId(entry.caseNumber),
      status: entry.status,
      bucket,
      customerName: entry.customerLegalName,
      customerKey: null,
      createdBy: entry.createdBy,
      requestedByEmail: entry.createdBy ? (actorEmails.get(entry.createdBy) ?? null) : null,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
      href: `/reviews/${entry.requestId}`,
    })
  }

  changeRequestEntries.forEach((entry, index) => {
    const bucket = bucketForStatus(entry.status)
    if (!bucket) return
    const customer = changeRequestCustomers[index]
    items.push({
      type: "change_request",
      requestId: entry.requestId,
      displayId: formatChangeRequestId(entry.requestNumber),
      status: entry.status,
      bucket,
      customerName: customer?.name ?? "(unknown customer)",
      customerKey: customer?.key ?? null,
      createdBy: entry.createdBy,
      requestedByEmail: entry.createdBy ? (actorEmails.get(entry.createdBy) ?? null) : null,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
      href: `/reviews/change-requests/${entry.requestId}`,
    })
  })

  versionEntries.forEach((entry, index) => {
    const bucket = bucketForStatus(entry.status)
    if (!bucket) return
    const customer = versionCustomers[index]
    items.push({
      type: "commercial_version",
      requestId: entry.requestId,
      displayId: formatCommercialVersionId(entry.versionNumber),
      status: entry.status,
      bucket,
      customerName: customer?.name ?? "(unknown customer)",
      customerKey: customer?.key ?? null,
      createdBy: entry.createdBy,
      requestedByEmail: entry.createdBy ? (actorEmails.get(entry.createdBy) ?? null) : null,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
      href: `/reviews/commercial-versions/${entry.requestId}`,
    })
  })

  return sortByUpdatedAtDesc(items)
}

/**
 * My Work (task spec): a personal, actionable summary for the current
 * user, scoped server-side to their own `appUserId` (never a
 * client-supplied id). Re-scopes the same Approvals inbox items, never a
 * second read of the underlying tables (see ./domain/my-work.ts's own
 * header for the exact scoping rules).
 */
async function loadMyWork(appUserId: string, canApprove: boolean): Promise<MyWorkItem[]> {
  const items = await loadApprovalInbox()
  return buildMyWorkItems(items, appUserId, canApprove, new Date())
}

export { loadApprovalInbox, loadMyWork }
