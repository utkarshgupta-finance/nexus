import "server-only"

import {
  listAllOnboardingEntries,
  listAllVersionEntries,
  formatOnboardingCaseId,
  formatCommercialVersionId,
  getSendBackCountsForRequests as getOnboardingSendBackCounts,
} from "@/features/customer-onboarding/server"
import { listAllChangeRequestEntries, getSendBackCountsForRequests as getChangeRequestSendBackCounts } from "@/features/customer-change/server"
import { formatChangeRequestId } from "@/features/customer-change"
import { getCustomersByIds } from "@/features/customers/server"
import { commercialConfigurationService } from "@/features/commercial/server"
import { resolveActorLabels } from "@/platform/audit/server"
import { bucketForStatus, sortByUpdatedAtDesc } from "./domain/inbox"
import { buildMyWorkItems, buildDraftWorkItems } from "./domain/my-work"
import { buildOperationalQueue } from "./domain/operational-queue"
import type { ApprovalInboxItem } from "./domain/types"
import type { MyWorkItem } from "./domain/my-work"
import type { OperationalQueueEntry } from "./domain/operational-queue"

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

  const actorLabels = await resolveActorLabels([
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
      requestedByEmail: entry.createdBy ? (actorLabels.get(entry.createdBy) ?? null) : null,
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
      requestedByEmail: entry.createdBy ? (actorLabels.get(entry.createdBy) ?? null) : null,
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
      requestedByEmail: entry.createdBy ? (actorLabels.get(entry.createdBy) ?? null) : null,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
      href: `/reviews/commercial-versions/${entry.requestId}`,
    })
  })

  return sortByUpdatedAtDesc(items)
}

/**
 * "Drafts I should continue" (Platform Scale Closure, Phase K): only for
 * Customer Change and Commercial Version, which have no other home for a
 * draft (unlike Onboarding, whose own My Requests page already covers
 * this, so it is deliberately not duplicated here, per the "no
 * duplicates" rule). Refetches listAllChangeRequestEntries/
 * listAllVersionEntries rather than reusing loadApprovalInbox's own
 * fetch, since that composer's own contract deliberately excludes drafts
 * entirely; accepted as a small, known extra pair of queries on a
 * personal, low-traffic page rather than widening ApprovalInboxBucket's
 * type (and its documented "a draft never appears here" invariant) just
 * to save it.
 */
async function loadMyDraftsToContinue(appUserId: string): Promise<MyWorkItem[]> {
  const [changeRequestEntries, versionEntries] = await Promise.all([listAllChangeRequestEntries(), listAllVersionEntries()])
  const myChangeRequestDrafts = changeRequestEntries.filter((entry) => entry.status === "draft" && entry.createdBy === appUserId)
  const myVersionDrafts = versionEntries.filter((entry) => entry.status === "draft" && entry.createdBy === appUserId)

  const versionConfigurations = await Promise.all(
    myVersionDrafts.map((entry) => commercialConfigurationService.getCommercialConfiguration(entry.commercialConfigurationId))
  )
  const customerIds = [
    ...myChangeRequestDrafts.map((entry) => entry.customerId),
    ...versionConfigurations.map((configuration) => configuration?.customerId).filter((id): id is string => Boolean(id)),
  ]
  const customersById = new Map((await getCustomersByIds([...new Set(customerIds)])).map((customer) => [customer.id, customer]))

  const draftSources = [
    ...myChangeRequestDrafts.map((entry) => ({
      type: "change_request" as const,
      requestId: entry.requestId,
      displayId: formatChangeRequestId(entry.requestNumber),
      customerName: customersById.get(entry.customerId)?.name ?? "(unknown customer)",
      status: entry.status,
      href: `/customers/${customersById.get(entry.customerId)?.key ?? ""}/change-requests/${entry.requestId}`,
      updatedAt: entry.updatedAt,
    })),
    ...myVersionDrafts.map((entry, index) => ({
      type: "commercial_version" as const,
      requestId: entry.requestId,
      displayId: formatCommercialVersionId(entry.versionNumber),
      customerName: (() => {
        const configuration = versionConfigurations[index]
        return (configuration ? customersById.get(configuration.customerId)?.name : null) ?? "(unknown customer)"
      })(),
      status: entry.status,
      href: `/commercials/${entry.commercialConfigurationId}/versions/${entry.requestId}`,
      updatedAt: entry.updatedAt,
    })),
  ]

  return buildDraftWorkItems(draftSources, new Date())
}

/**
 * My Work (task spec): a personal, actionable summary for the current
 * user, scoped server-side to their own `appUserId` (never a
 * client-supplied id). Re-scopes the same Approvals inbox items, never a
 * second read of the underlying tables (see ./domain/my-work.ts's own
 * header for the exact scoping rules).
 */
async function loadMyWork(appUserId: string, canApprove: boolean): Promise<MyWorkItem[]> {
  const [items, drafts] = await Promise.all([loadApprovalInbox(), loadMyDraftsToContinue(appUserId)])
  return [...buildMyWorkItems(items, appUserId, canApprove, new Date()), ...drafts]
}

/**
 * Operational queue (Platform Scale Closure, Phase L): "what is
 * currently stuck, and with whom" across all three lifecycles, for
 * whoever holds broad read access, not scoped to one person's own work.
 * Not a dashboard: no charts, no aggregation beyond the plain list
 * ./domain/operational-queue.ts's own header describes. Reuses
 * loadApprovalInbox's fetch (no new base query) and adds send-back
 * counts in two more batched calls, one per lifecycle that has a
 * send-back concept at all (Commercial Version does not, see
 * docs/CUSTOMER_LIFECYCLE.md §19).
 */
async function loadOperationalQueue(): Promise<OperationalQueueEntry[]> {
  const items = await loadApprovalInbox()
  const onboardingIds = items.filter((item) => item.type === "onboarding").map((item) => item.requestId)
  const changeRequestIds = items.filter((item) => item.type === "change_request").map((item) => item.requestId)

  const [onboardingSendBackCounts, changeRequestSendBackCounts] = await Promise.all([
    getOnboardingSendBackCounts(onboardingIds),
    getChangeRequestSendBackCounts(changeRequestIds),
  ])
  const sentBackCountsByRequestId = new Map([...onboardingSendBackCounts, ...changeRequestSendBackCounts])

  return buildOperationalQueue(items, sentBackCountsByRequestId, new Date())
}

export { loadApprovalInbox, loadMyWork, loadOperationalQueue }
