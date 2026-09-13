import "server-only"

import { listAllOnboardingEntries, listAllVersionEntries } from "@/features/customer-onboarding/server"
import { listAllChangeRequestEntries } from "@/features/customer-change/server"
import { getCustomerById } from "@/features/customers/server"
import { commercialConfigurationService } from "@/features/commercial/server"
import { resolveActorEmails } from "@/platform/audit/server"
import { bucketForStatus, sortByUpdatedAtDesc } from "./domain/inbox"
import type { ApprovalInboxItem } from "./domain/types"

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

  const [changeRequestCustomers, versionConfigurations] = await Promise.all([
    Promise.all(changeRequestEntries.map((entry) => getCustomerById(entry.customerId))),
    Promise.all(versionEntries.map((entry) => commercialConfigurationService.getCommercialConfiguration(entry.commercialConfigurationId))),
  ])
  const versionCustomers = await Promise.all(
    versionConfigurations.map((configuration) => (configuration ? getCustomerById(configuration.customerId) : null))
  )

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
      status: entry.status,
      bucket,
      customerName: entry.customerLegalName,
      customerKey: null,
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
      status: entry.status,
      bucket,
      customerName: customer?.name ?? "(unknown customer)",
      customerKey: customer?.key ?? null,
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
      status: entry.status,
      bucket,
      customerName: customer?.name ?? "(unknown customer)",
      customerKey: customer?.key ?? null,
      requestedByEmail: entry.createdBy ? (actorEmails.get(entry.createdBy) ?? null) : null,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
      href: `/reviews/commercial-versions/${entry.requestId}`,
    })
  })

  return sortByUpdatedAtDesc(items)
}

export { loadApprovalInbox }
