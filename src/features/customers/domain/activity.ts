import { labelForGovernedField } from "@/features/customer-change"
import type { CustomerChangeRequest, CustomerFieldHistoryEntry } from "@/features/customer-change"
import type { OnboardingOrigin, CommercialConfigurationVersion } from "@/features/customer-onboarding/server"
import type { AuditLogRow } from "@/platform/audit/server"
import { resolveOption } from "@/features/reference-data"
import type { ReferenceMasterSnapshot, ReferenceListKey } from "@/features/reference-data"

/** Only these Field History keys are Reference-Master-governed lists; the rest (Legal Entity Name, Brand Name) are free text and are never passed through `resolveOption`. */
const GOVERNED_LIST_FIELD_KEYS: Record<string, ReferenceListKey> = {
  segment: "segment",
  business_unit: "business_unit",
  country: "country",
  industry: "industry",
}

/** Canonical Reference Master label resolution (task spec: one resolver, never a scattered code-to-label hack): historical/inactive values must still resolve, which `resolveOption` already guarantees. */
function governedValueLabel(fieldKey: string, value: string, snapshot: ReferenceMasterSnapshot): string {
  const listKey = GOVERNED_LIST_FIELD_KEYS[fieldKey]
  if (!listKey) return value
  return resolveOption(snapshot, listKey, value)?.label ?? value
}

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

function actorLabel(actorId: string | null, actorLabels: Map<string, string | null>): string | null {
  if (!actorId) return null
  return actorLabels.get(actorId) ?? null
}

/**
 * Program 4 Hardening: historical actor identity fallback chain for an
 * `audit_log`-sourced event specifically, the one place a point-in-time
 * snapshot actually exists today. Order matches the permanent rule
 * exactly: the name as it was at the time, then the actor's current
 * name (covers rows written before the snapshot columns existed), then
 * an email (snapshot preferred, current as a last resort), never a raw
 * id.
 */
function auditRowActorLabel(row: AuditLogRow, actorLabels: Map<string, string | null>): string | null {
  if (row.actor_display_name_snapshot) return row.actor_display_name_snapshot
  const currentLabel = actorLabel(row.actor_user_id, actorLabels)
  if (currentLabel) return currentLabel
  return row.actor_email_snapshot ?? null
}

function auditIndexKey(tableName: string, rowId: string, actorId: string, occurredAt: string): string {
  return `${tableName}|${rowId}|${actorId}|${occurredAt}`
}

/** Indexes a batch of `audit_log` rows (however many domain tables they came from) for point-in-time lookup by (table, row, actor, timestamp). Rows with no actor are never a correlation target and are skipped. */
function buildAuditIndex(rows: AuditLogRow[]): Map<string, AuditLogRow> {
  const index = new Map<string, AuditLogRow>()
  for (const row of rows) {
    if (!row.actor_user_id) continue
    index.set(auditIndexKey(row.table_name, row.row_id, row.actor_user_id, row.occurred_at), row)
  }
  return index
}

/**
 * PG-058: Customer Master's Activity/History is documented elsewhere in
 * this codebase as immutable historical evidence ("this ... is
 * historical evidence and can no longer be changed"), so a later change
 * to an actor's own display name must never rewrite who a past event
 * here appears to have been performed by. Finds the exact `audit_log`
 * row the domain-table mutation behind this event itself produced,
 * matched by (table, row id, actor id, timestamp): both timestamps are
 * set by the same `now()` call inside the same transaction as the
 * mutation, so an exact match is a reliable correlation, not a
 * heuristic (verified empirically against real data before this was
 * built). Prefers that row's point-in-time snapshot via
 * `auditRowActorLabel`'s own fallback chain; falls back to the actor's
 * CURRENT label only when no correlating row exists (a legacy row
 * predating this mechanism, or an event with no audited source table),
 * never fabricating a historical value.
 */
function historicalActorLabel(
  tableName: string,
  rowId: string | null,
  actorId: string | null,
  occurredAt: string,
  auditIndex: Map<string, AuditLogRow>,
  actorLabels: Map<string, string | null>
): string | null {
  if (!actorId) return null
  if (rowId) {
    const row = auditIndex.get(auditIndexKey(tableName, rowId, actorId, occurredAt))
    if (row) return auditRowActorLabel(row, actorLabels)
  }
  return actorLabel(actorId, actorLabels)
}

function fieldChangeEvents(
  entries: CustomerFieldHistoryEntry[],
  actorLabels: Map<string, string | null>,
  snapshot: ReferenceMasterSnapshot,
  auditIndex: Map<string, AuditLogRow>
): CustomerActivityEvent[] {
  return entries.map((entry) => {
    const label = labelForGovernedField(entry.fieldKey)
    const from = entry.oldValue ? governedValueLabel(entry.fieldKey, entry.oldValue, snapshot) : "(not set)"
    const to = entry.newValue ? governedValueLabel(entry.fieldKey, entry.newValue, snapshot) : "(not set)"
    return {
      id: `field-${entry.id}`,
      occurredAt: entry.changedAt,
      actorEmail: historicalActorLabel("customer_change_requests", entry.changeRequestId, entry.approvedBy, entry.changedAt, auditIndex, actorLabels),
      summary: `${label} changed from "${from}" to "${to}"`,
      relatedRequestId: entry.changeRequestId,
    }
  })
}

function changeRequestEvents(
  requests: CustomerChangeRequest[],
  actorLabels: Map<string, string | null>,
  auditIndex: Map<string, AuditLogRow>
): CustomerActivityEvent[] {
  const events: CustomerActivityEvent[] = []
  for (const request of requests) {
    events.push({
      id: `cr-created-${request.requestId}`,
      occurredAt: request.createdAt,
      actorEmail: historicalActorLabel("customer_change_requests", request.requestId, request.createdBy, request.createdAt, auditIndex, actorLabels),
      summary: "Customer Change Request created",
      relatedRequestId: request.requestId,
    })
    if (request.sentBack) {
      events.push({
        id: `cr-sentback-${request.requestId}`,
        occurredAt: request.sentBack.sentBackAt,
        actorEmail: historicalActorLabel(
          "customer_change_requests",
          request.requestId,
          request.sentBack.sentBackBy,
          request.sentBack.sentBackAt,
          auditIndex,
          actorLabels
        ),
        summary: `Customer Change Request sent back: ${request.sentBack.reason}`,
        relatedRequestId: request.requestId,
      })
    }
    if (request.decidedAt && (request.status === "approved" || request.status === "rejected")) {
      events.push({
        id: `cr-decided-${request.requestId}`,
        occurredAt: request.decidedAt,
        actorEmail: historicalActorLabel("customer_change_requests", request.requestId, request.decidedBy, request.decidedAt, auditIndex, actorLabels),
        summary: request.status === "approved" ? "Customer Change Request approved" : `Customer Change Request rejected: ${request.decisionReason ?? "no reason given"}`,
        relatedRequestId: request.requestId,
      })
    }
  }
  return events
}

function commercialVersionEvents(
  versions: CommercialConfigurationVersion[],
  actorLabels: Map<string, string | null>,
  auditIndex: Map<string, AuditLogRow>
): CustomerActivityEvent[] {
  const events: CustomerActivityEvent[] = []
  for (const version of versions) {
    events.push({
      id: `cv-created-${version.requestId}`,
      occurredAt: version.createdAt,
      actorEmail: historicalActorLabel("commercial_configuration_versions", version.requestId, version.createdBy, version.createdAt, auditIndex, actorLabels),
      summary: "Commercial Version created",
      relatedRequestId: version.requestId,
    })
    if (version.decidedAt && (version.status === "approved" || version.status === "rejected")) {
      events.push({
        id: `cv-decided-${version.requestId}`,
        occurredAt: version.decidedAt,
        actorEmail: historicalActorLabel(
          "commercial_configuration_versions",
          version.requestId,
          version.decidedBy,
          version.decidedAt,
          auditIndex,
          actorLabels
        ),
        summary: version.status === "approved" ? "Commercial Version approved" : `Commercial Version rejected: ${version.decisionReason ?? "no reason given"}`,
        relatedRequestId: version.requestId,
      })
    }
  }
  return events
}

function onboardingOriginEvent(
  origin: OnboardingOrigin | null,
  actorLabels: Map<string, string | null>,
  auditIndex: Map<string, AuditLogRow>
): CustomerActivityEvent[] {
  if (!origin || !origin.approvedAt) return []
  return [
    {
      id: `onboarding-approved-${origin.requestId}`,
      occurredAt: origin.approvedAt,
      actorEmail: historicalActorLabel("customer_onboarding_cases", origin.requestId, origin.approvedBy, origin.approvedAt, auditIndex, actorLabels),
      summary: "Customer Onboarding approved: Customer Master created",
      relatedRequestId: origin.requestId,
    },
  ]
}

/** Reads only `is_active`'s own before/after out of a generic mutation audit row; never renders the rest of the JSON. */
function statusChangeEvents(auditRows: AuditLogRow[], actorLabels: Map<string, string | null>): CustomerActivityEvent[] {
  const events: CustomerActivityEvent[] = []
  for (const row of auditRows) {
    if (row.action !== "UPDATE" || !row.before_value || !row.after_value) continue
    const before = row.before_value.is_active
    const after = row.after_value.is_active
    if (typeof before !== "boolean" || typeof after !== "boolean" || before === after) continue
    const reason = typeof row.actor_context?.reason === "string" ? row.actor_context.reason : null
    events.push({
      id: `status-${row.id}`,
      occurredAt: row.occurred_at,
      actorEmail: auditRowActorLabel(row, actorLabels),
      summary: reason ? `${after ? "Customer reactivated" : "Customer deactivated"}: ${reason}` : after ? "Customer reactivated" : "Customer deactivated",
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
  actorLabels: Map<string, string | null>
  referenceMasterSnapshot: ReferenceMasterSnapshot
  /** PG-058: audit_log rows for every changeRequests/commercialVersions/onboardingOrigin row this customer's history touches, indexed via buildAuditIndex, for point-in-time actor resolution. Does NOT include the `customers` table's own status-change rows (statusAuditRows already carries those, and statusChangeEvents already resolves them via auditRowActorLabel directly). */
  auditIndex: Map<string, AuditLogRow>
}

function buildCustomerActivityTimeline(input: BuildCustomerActivityTimelineInput): CustomerActivityEvent[] {
  const events = [
    ...onboardingOriginEvent(input.onboardingOrigin, input.actorLabels, input.auditIndex),
    ...fieldChangeEvents(input.fieldHistory, input.actorLabels, input.referenceMasterSnapshot, input.auditIndex),
    ...changeRequestEvents(input.changeRequests, input.actorLabels, input.auditIndex),
    ...commercialVersionEvents(input.commercialVersions, input.actorLabels, input.auditIndex),
    ...statusChangeEvents(input.statusAuditRows, input.actorLabels),
  ]
  return events.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
}

/** Every actor id referenced anywhere in the timeline inputs, so the caller can resolve them all in one batched lookup before building the timeline. */
function collectActorIds(input: Omit<BuildCustomerActivityTimelineInput, "actorLabels" | "referenceMasterSnapshot" | "auditIndex">): (string | null)[] {
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

export { buildCustomerActivityTimeline, collectActorIds, buildAuditIndex, historicalActorLabel }
export type { CustomerActivityEvent, BuildCustomerActivityTimelineInput }
