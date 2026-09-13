import { labelForGovernedField } from "@/features/customer-change"
import type { CustomerChangeRequest, CustomerFieldHistoryEntry } from "@/features/customer-change"
import type { OnboardingOrigin, CommercialConfigurationVersion } from "@/features/customer-onboarding/server"
import type { AuditLogRow } from "@/platform/audit/server"

/**
 * Customer Activity timeline (task Phase C): one readable event stream
 * built from data Nexus already persists (onboarding approval, Customer
 * Field History, Customer Change Requests, Commercial Configuration
 * Versions, and `customers`' own `is_active` audit trail), never a
 * fabricated feed and never raw `audit_log` JSON rendered directly.
 * Pure composition only: no I/O, so this stays unit-testable without
 * Supabase, matching every other read-model in this codebase.
 */

type CustomerActivityEvent = {
  id: string
  occurredAt: string
  actorEmail: string | null
  summary: string
  relatedRequestId: string | null
}

function actorLabel(actorId: string | null, actorEmails: Map<string, string | null>): string | null {
  if (!actorId) return null
  return actorEmails.get(actorId) ?? null
}

function fieldChangeEvents(entries: CustomerFieldHistoryEntry[], actorEmails: Map<string, string | null>): CustomerActivityEvent[] {
  return entries.map((entry) => {
    const label = labelForGovernedField(entry.fieldKey)
    const from = entry.oldValue ?? "(not set)"
    const to = entry.newValue ?? "(not set)"
    return {
      id: `field-${entry.id}`,
      occurredAt: entry.changedAt,
      actorEmail: actorLabel(entry.approvedBy, actorEmails),
      summary: `${label} changed from "${from}" to "${to}"`,
      relatedRequestId: entry.changeRequestId,
    }
  })
}

function changeRequestEvents(requests: CustomerChangeRequest[], actorEmails: Map<string, string | null>): CustomerActivityEvent[] {
  const events: CustomerActivityEvent[] = []
  for (const request of requests) {
    events.push({
      id: `cr-created-${request.requestId}`,
      occurredAt: request.createdAt,
      actorEmail: actorLabel(request.createdBy, actorEmails),
      summary: "Customer Change Request created",
      relatedRequestId: request.requestId,
    })
    if (request.sentBack) {
      events.push({
        id: `cr-sentback-${request.requestId}`,
        occurredAt: request.sentBack.sentBackAt,
        actorEmail: actorLabel(request.sentBack.sentBackBy, actorEmails),
        summary: `Customer Change Request sent back: ${request.sentBack.reason}`,
        relatedRequestId: request.requestId,
      })
    }
    if (request.decidedAt && (request.status === "approved" || request.status === "rejected")) {
      events.push({
        id: `cr-decided-${request.requestId}`,
        occurredAt: request.decidedAt,
        actorEmail: actorLabel(request.decidedBy, actorEmails),
        summary: request.status === "approved" ? "Customer Change Request approved" : `Customer Change Request rejected: ${request.decisionReason ?? "no reason given"}`,
        relatedRequestId: request.requestId,
      })
    }
  }
  return events
}

function commercialVersionEvents(versions: CommercialConfigurationVersion[], actorEmails: Map<string, string | null>): CustomerActivityEvent[] {
  const events: CustomerActivityEvent[] = []
  for (const version of versions) {
    events.push({
      id: `cv-created-${version.requestId}`,
      occurredAt: version.createdAt,
      actorEmail: actorLabel(version.createdBy, actorEmails),
      summary: "Commercial Version created",
      relatedRequestId: version.requestId,
    })
    if (version.decidedAt && (version.status === "approved" || version.status === "rejected")) {
      events.push({
        id: `cv-decided-${version.requestId}`,
        occurredAt: version.decidedAt,
        actorEmail: actorLabel(version.decidedBy, actorEmails),
        summary: version.status === "approved" ? "Commercial Version approved" : `Commercial Version rejected: ${version.decisionReason ?? "no reason given"}`,
        relatedRequestId: version.requestId,
      })
    }
  }
  return events
}

function onboardingOriginEvent(origin: OnboardingOrigin | null, actorEmails: Map<string, string | null>): CustomerActivityEvent[] {
  if (!origin || !origin.approvedAt) return []
  return [
    {
      id: `onboarding-approved-${origin.requestId}`,
      occurredAt: origin.approvedAt,
      actorEmail: actorLabel(origin.approvedBy, actorEmails),
      summary: "Customer Onboarding approved: Customer Master created",
      relatedRequestId: origin.requestId,
    },
  ]
}

/** Reads only `is_active`'s own before/after out of a generic mutation audit row; never renders the rest of the JSON. */
function statusChangeEvents(auditRows: AuditLogRow[], actorEmails: Map<string, string | null>): CustomerActivityEvent[] {
  const events: CustomerActivityEvent[] = []
  for (const row of auditRows) {
    if (row.action !== "UPDATE" || !row.before_value || !row.after_value) continue
    const before = row.before_value.is_active
    const after = row.after_value.is_active
    if (typeof before !== "boolean" || typeof after !== "boolean" || before === after) continue
    events.push({
      id: `status-${row.id}`,
      occurredAt: row.occurred_at,
      actorEmail: actorLabel(row.actor_user_id, actorEmails),
      summary: after ? "Customer reactivated" : "Customer deactivated",
      relatedRequestId: row.request_id,
    })
  }
  return events
}

type BuildCustomerActivityTimelineInput = {
  onboardingOrigin: OnboardingOrigin | null
  changeRequests: CustomerChangeRequest[]
  fieldHistory: CustomerFieldHistoryEntry[]
  commercialVersions: CommercialConfigurationVersion[]
  statusAuditRows: AuditLogRow[]
  actorEmails: Map<string, string | null>
}

function buildCustomerActivityTimeline(input: BuildCustomerActivityTimelineInput): CustomerActivityEvent[] {
  const events = [
    ...onboardingOriginEvent(input.onboardingOrigin, input.actorEmails),
    ...fieldChangeEvents(input.fieldHistory, input.actorEmails),
    ...changeRequestEvents(input.changeRequests, input.actorEmails),
    ...commercialVersionEvents(input.commercialVersions, input.actorEmails),
    ...statusChangeEvents(input.statusAuditRows, input.actorEmails),
  ]
  return events.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
}

/** Every actor id referenced anywhere in the timeline inputs, so the caller can resolve them all in one batched lookup before building the timeline. */
function collectActorIds(input: Omit<BuildCustomerActivityTimelineInput, "actorEmails">): (string | null)[] {
  const ids: (string | null)[] = []
  if (input.onboardingOrigin) ids.push(input.onboardingOrigin.approvedBy)
  for (const entry of input.fieldHistory) ids.push(entry.approvedBy)
  for (const request of input.changeRequests) {
    ids.push(request.createdBy, request.decidedBy)
    if (request.sentBack) ids.push(request.sentBack.sentBackBy)
  }
  for (const version of input.commercialVersions) ids.push(version.createdBy, version.decidedBy)
  for (const row of input.statusAuditRows) ids.push(row.actor_user_id)
  return ids
}

export { buildCustomerActivityTimeline, collectActorIds }
export type { CustomerActivityEvent, BuildCustomerActivityTimelineInput }
