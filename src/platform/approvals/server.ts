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
import { listAllGoLiveRequests, formatGoLiveRequestId } from "@/features/go-live/server"
import { getCustomersByIds } from "@/features/customers/server"
import { commercialConfigurationService } from "@/features/commercial/server"
import { getVisibleCustomerIds, getVisibleBusinessUnits } from "@/platform/permissions/server"
import { resolveActorLabels } from "@/platform/audit/server"
import { getResponsibleTeamIdsByNode } from "@/platform/workflow-builder/server"
import { getActiveTeamIdsForUser, listTeams, countActiveMembersByTeam, listActiveUserTeamGrants } from "@/platform/team/server"
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
/** Resolves a `teamIdsByNodeKey` lookup (keyed `${workflowVersionId}::${nodeKey}`, see the batched fetch below) for one entry's current position; null current node (no workflow bound, or between Send Back and resubmit) always resolves to "no team restriction" without a lookup. */
function resolveResponsibleTeamId(
  teamIdsByNodeKey: Map<string, string | null>,
  workflowVersionId: string | null,
  currentNodeKey: string | null
): string | null {
  if (!workflowVersionId || !currentNodeKey) return null
  return teamIdsByNodeKey.get(`${workflowVersionId}::${currentNodeKey}`) ?? null
}

async function loadApprovalInbox(): Promise<ApprovalInboxItem[]> {
  const [rawOnboardingEntries, rawChangeRequestEntries, rawVersionEntries, rawGoLiveEntries] = await Promise.all([
    listAllOnboardingEntries(),
    listAllChangeRequestEntries(),
    listAllVersionEntries(),
    listAllGoLiveRequests(),
  ])

  // Batched, not one round trip per entry: this composer runs on every
  // Approvals/My Work page load, and its round-trip count previously grew
  // linearly with the number of onboarding/change-request/version entries.
  const rawVersionConfigurations = await Promise.all(
    rawVersionEntries.map((entry) => commercialConfigurationService.getCommercialConfiguration(entry.commercialConfigurationId))
  )

  // PD-005 follow-up (Product Decision Closure): this is the shared read
  // path behind Approvals inbox, My Work, and Operational Queue, so it is
  // the one place a scoped user's cross-customer list leak would show up
  // regardless of which of those three pages they visited. Onboarding
  // entries scope by customerId once approved, or businessUnit before
  // that (mirroring the single-case read in /reviews/[requestId]); change
  // requests and commercial versions always have a resolved customer.
  //
  // Go-live entries were originally left unfiltered here (PD-005 named
  // exactly five domains and go-live was not one of them). A follow-up
  // authorization check (Product Decision Closure, PD-005 go-live
  // verification, 2026-09-21) found this left a real customer-identifying
  // information disclosure in this shared composer, not harmless tech
  // debt, though the underlying go-live record itself stayed protected by
  // its own separate, already-correct route-level authorization. Fixed by
  // scoping go-live entries the same way version/change-request entries
  // already are, reusing the exact same getVisibleCustomerIds mechanism,
  // no new authorization model. Full detail in
  // docs/journey-runs/OVERNIGHT_PENDING_APPROVALS.md's PD-005 entry.
  const [visibleCustomerIdsForCustomerRead, visibleBusinessUnitsForCustomerRead, visibleCustomerIdsForCommercialRead, visibleCustomerIdsForGoLiveRead] =
    await Promise.all([
      getVisibleCustomerIds("customer", "read"),
      getVisibleBusinessUnits("customer", "read"),
      getVisibleCustomerIds("commercial_configuration", "read"),
      getVisibleCustomerIds("go_live", "read"),
    ])

  const onboardingEntries =
    visibleCustomerIdsForCustomerRead === null
      ? rawOnboardingEntries
      : rawOnboardingEntries.filter((entry) => {
          if (entry.customerId) return visibleCustomerIdsForCustomerRead.has(entry.customerId)
          if (entry.businessUnit) return visibleBusinessUnitsForCustomerRead === null || visibleBusinessUnitsForCustomerRead.has(entry.businessUnit)
          return false
        })

  const changeRequestEntries =
    visibleCustomerIdsForCustomerRead === null
      ? rawChangeRequestEntries
      : rawChangeRequestEntries.filter((entry) => visibleCustomerIdsForCustomerRead.has(entry.customerId))

  const goLiveEntries =
    visibleCustomerIdsForGoLiveRead === null
      ? rawGoLiveEntries
      : rawGoLiveEntries.filter((entry) => visibleCustomerIdsForGoLiveRead.has(entry.customerId))

  const versionEntries: typeof rawVersionEntries = []
  const versionConfigurations: typeof rawVersionConfigurations = []
  rawVersionEntries.forEach((entry, index) => {
    const configuration = rawVersionConfigurations[index]
    const isVisible =
      visibleCustomerIdsForCommercialRead === null || (configuration ? visibleCustomerIdsForCommercialRead.has(configuration.customerId) : false)
    if (!isVisible) return
    versionEntries.push(entry)
    versionConfigurations.push(configuration)
  })

  // Workflow Runtime V1 Sequential Execution: which team is currently
  // responsible, resolved from each entry's own stored current node
  // (never re-walked from Start), batched across every distinct
  // workflow version these entries touch.
  const workflowVersionIds = [
    ...onboardingEntries.map((entry) => entry.workflowVersionId),
    ...changeRequestEntries.map((entry) => entry.workflowVersionId),
    ...versionEntries.map((entry) => entry.workflowVersionId),
    ...goLiveEntries.map((entry) => entry.workflowVersionId),
  ].filter((id): id is string => Boolean(id))
  const teamIdsByNodeKey = await getResponsibleTeamIdsByNode(workflowVersionIds)

  const customerIds = [
    ...changeRequestEntries.map((entry) => entry.customerId),
    ...versionConfigurations.map((configuration) => configuration?.customerId).filter((id): id is string => Boolean(id)),
    ...goLiveEntries.map((entry) => entry.customerId),
  ]
  const customersById = new Map((await getCustomersByIds([...new Set(customerIds)])).map((customer) => [customer.id, customer]))
  const changeRequestCustomers = changeRequestEntries.map((entry) => customersById.get(entry.customerId) ?? null)
  const versionCustomers = versionConfigurations.map((configuration) => (configuration ? (customersById.get(configuration.customerId) ?? null) : null))
  const goLiveCustomers = goLiveEntries.map((entry) => customersById.get(entry.customerId) ?? null)

  const actorLabels = await resolveActorLabels([
    ...onboardingEntries.map((entry) => entry.createdBy),
    ...changeRequestEntries.map((entry) => entry.createdBy),
    ...versionEntries.map((entry) => entry.createdBy),
    ...goLiveEntries.map((entry) => entry.createdBy),
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
      responsibleTeamId: resolveResponsibleTeamId(teamIdsByNodeKey, entry.workflowVersionId, entry.currentWorkflowNodeKey),
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
      responsibleTeamId: resolveResponsibleTeamId(teamIdsByNodeKey, entry.workflowVersionId, entry.currentWorkflowNodeKey),
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
      responsibleTeamId: resolveResponsibleTeamId(teamIdsByNodeKey, entry.workflowVersionId, entry.currentWorkflowNodeKey),
    })
  })

  goLiveEntries.forEach((entry, index) => {
    const bucket = bucketForStatus(entry.status)
    if (!bucket) return
    const customer = goLiveCustomers[index]
    items.push({
      type: "go_live",
      requestId: entry.id,
      displayId: formatGoLiveRequestId(entry.requestNumber),
      status: entry.status,
      bucket,
      customerName: customer?.name ?? "(unknown customer)",
      customerKey: customer?.key ?? null,
      createdBy: entry.createdBy,
      requestedByEmail: entry.createdBy ? (actorLabels.get(entry.createdBy) ?? null) : null,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
      href: `/customers/${customer?.key ?? ""}/go-live/${entry.id}`,
      responsibleTeamId: resolveResponsibleTeamId(teamIdsByNodeKey, entry.workflowVersionId, entry.currentWorkflowNodeKey),
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
  const [changeRequestEntries, versionEntries, goLiveEntries] = await Promise.all([
    listAllChangeRequestEntries(),
    listAllVersionEntries(),
    listAllGoLiveRequests(),
  ])
  const myChangeRequestDrafts = changeRequestEntries.filter((entry) => entry.status === "draft" && entry.createdBy === appUserId)
  const myVersionDrafts = versionEntries.filter((entry) => entry.status === "draft" && entry.createdBy === appUserId)
  const myGoLiveDrafts = goLiveEntries.filter((entry) => entry.status === "draft" && entry.createdBy === appUserId)

  const versionConfigurations = await Promise.all(
    myVersionDrafts.map((entry) => commercialConfigurationService.getCommercialConfiguration(entry.commercialConfigurationId))
  )
  const customerIds = [
    ...myChangeRequestDrafts.map((entry) => entry.customerId),
    ...versionConfigurations.map((configuration) => configuration?.customerId).filter((id): id is string => Boolean(id)),
    ...myGoLiveDrafts.map((entry) => entry.customerId),
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
    ...myGoLiveDrafts.map((entry) => ({
      type: "go_live" as const,
      requestId: entry.id,
      displayId: formatGoLiveRequestId(entry.requestNumber),
      customerName: customersById.get(entry.customerId)?.name ?? "(unknown customer)",
      status: entry.status,
      href: `/customers/${customersById.get(entry.customerId)?.key ?? ""}/go-live/${entry.id}`,
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
  const [items, drafts, viewerTeamIds] = await Promise.all([loadApprovalInbox(), loadMyDraftsToContinue(appUserId), getActiveTeamIdsForUser(appUserId)])
  return [...buildMyWorkItems(items, appUserId, canApprove, viewerTeamIds, new Date()), ...drafts]
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

  const [onboardingSendBackCounts, changeRequestSendBackCounts, activeMemberCountsByTeamId, teams] = await Promise.all([
    getOnboardingSendBackCounts(onboardingIds),
    getChangeRequestSendBackCounts(changeRequestIds),
    countActiveMembersByTeam(),
    listTeams(),
  ])
  const sentBackCountsByRequestId = new Map([...onboardingSendBackCounts, ...changeRequestSendBackCounts])
  const teamNamesById = new Map(teams.map((team) => [team.id, team.name]))

  return buildOperationalQueue(items, sentBackCountsByRequestId, activeMemberCountsByTeamId, teamNamesById, new Date())
}

type TeamRemovalImpact = {
  teamId: string | null
  teamName: string | null
  remainingActiveMembers: number
  pendingApprovalCount: number
}

/**
 * Pre-removal impact check (Product Gap Closure, O-018): computed before
 * a team membership removal is confirmed, so an admin sees a real,
 * current number, not a guess, when the removal would leave pending
 * governed work with no eligible approver. `pendingApprovalCount` is
 * only ever non-zero when `remainingActiveMembers` would be zero: a team
 * that keeps at least one other active member after this removal has no
 * orphaned-work risk to warn about. Reuses the exact same
 * `loadApprovalInbox` read every other operational surface already
 * shares, no new query shape.
 */
async function checkTeamRemovalImpact(userTeamId: string): Promise<TeamRemovalImpact> {
  const [grants, teams, items] = await Promise.all([listActiveUserTeamGrants(), listTeams(), loadApprovalInbox()])
  const grant = grants.find((candidate) => candidate.id === userTeamId)
  if (!grant) return { teamId: null, teamName: null, remainingActiveMembers: 0, pendingApprovalCount: 0 }

  const remainingActiveMembers = grants.filter((candidate) => candidate.team_id === grant.team_id && candidate.id !== userTeamId).length
  const pendingApprovalCount =
    remainingActiveMembers === 0 ? items.filter((item) => item.bucket === "needs_action" && item.responsibleTeamId === grant.team_id).length : 0
  const teamName = teams.find((team) => team.id === grant.team_id)?.name ?? null

  return { teamId: grant.team_id, teamName, remainingActiveMembers, pendingApprovalCount }
}

export { loadApprovalInbox, loadMyWork, loadOperationalQueue, checkTeamRemovalImpact }
export type { TeamRemovalImpact }
