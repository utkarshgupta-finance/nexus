import type { AuditLogRow } from "@/platform/audit/server"

/**
 * Reference Master Activity (P-021 Product Decision: "I am looking at
 * this Reference Master value. Show me what happened to this value.").
 * Reuses the existing generic `audit_log` capture already attached to
 * `reference_options` (`trg_audit_reference_options`,
 * supabase/migrations/20260912080000_reference_master_foundation.sql):
 * this module only shapes those rows into a readable event stream,
 * mirroring `src/features/customers/domain/activity.ts`'s exact
 * "genuine audit rows in, one field's own before/after out" pattern.
 * Pure and synchronous: no I/O, unit-testable without Supabase.
 */

type ReferenceOptionActivityEvent = {
  id: string
  occurredAt: string
  actorLabel: string
  action: string
  change: { from: string; to: string } | null
}

/**
 * Same historical-actor-identity fallback chain as
 * `src/features/customers/domain/activity.ts`'s `auditRowActorLabel`:
 * the name as it was at the time, then the actor's current name (covers
 * rows written before the snapshot columns existed), then an email,
 * falling back to "System" only when no actor is attributable at all
 * (a migration-seeded row, or a genuinely system-originated write),
 * never a raw id and never a blank label.
 */
function auditRowActorLabel(row: AuditLogRow, actorLabels: Map<string, string | null>): string {
  if (row.actor_display_name_snapshot) return row.actor_display_name_snapshot
  if (row.actor_user_id) {
    const currentLabel = actorLabels.get(row.actor_user_id)
    if (currentLabel) return currentLabel
  }
  return row.actor_email_snapshot ?? "System"
}

function formatRate(value: unknown): string {
  if (value === null || value === undefined) return "Not configured"
  return String(value)
}

function formatCadence(value: unknown): string {
  if (value === null || value === undefined) return "One-Time"
  return `Every ${value} month${value === 1 ? "" : "s"}`
}

/**
 * One `audit_log` row may represent several distinct user-visible
 * changes at once (e.g. a hypothetical combined edit); each becomes its
 * own event, sharing the row's timestamp and actor, matching the same
 * one-event-per-changed-field decomposition
 * `src/features/customers/domain/activity.ts` already uses for `is_active`.
 * Never renders raw audit JSON: only the specific fields this feature's
 * own governed actions can actually change
 * (`src/features/reference-data/actions.ts`) are interpreted.
 */
function eventsForRow(row: AuditLogRow, actorLabels: Map<string, string | null>): ReferenceOptionActivityEvent[] {
  const actorLabel = auditRowActorLabel(row, actorLabels)
  const occurredAt = row.occurred_at

  if (row.action === "INSERT") {
    return [{ id: `${row.id}-created`, occurredAt, actorLabel, action: "Created", change: null }]
  }

  if (row.action !== "UPDATE" || !row.before_value || !row.after_value) return []

  const events: ReferenceOptionActivityEvent[] = []
  const before = row.before_value
  const after = row.after_value

  if (before.label !== after.label && typeof before.label === "string" && typeof after.label === "string") {
    events.push({
      id: `${row.id}-label`,
      occurredAt,
      actorLabel,
      action: "Renamed",
      change: { from: before.label, to: after.label },
    })
  }

  if (before.is_active !== after.is_active && typeof after.is_active === "boolean") {
    events.push({
      id: `${row.id}-active`,
      occurredAt,
      actorLabel,
      action: after.is_active ? "Reactivated" : "Deactivated",
      change: null,
    })
  }

  if (before.inr_conversion_rate !== after.inr_conversion_rate) {
    events.push({
      id: `${row.id}-rate`,
      occurredAt,
      actorLabel,
      action: "INR Conversion Rate changed",
      change: { from: formatRate(before.inr_conversion_rate), to: formatRate(after.inr_conversion_rate) },
    })
  }

  if (before.cadence_months !== after.cadence_months) {
    events.push({
      id: `${row.id}-cadence`,
      occurredAt,
      actorLabel,
      action: "Invoice Cadence changed",
      change: { from: formatCadence(before.cadence_months), to: formatCadence(after.cadence_months) },
    })
  }

  return events
}

/** Newest first (task spec: "chronological ordering, newest first in the UI"). */
function buildReferenceOptionActivityTimeline(auditRows: AuditLogRow[], actorLabels: Map<string, string | null>): ReferenceOptionActivityEvent[] {
  return auditRows
    .flatMap((row) => eventsForRow(row, actorLabels))
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
}

/** Every actor id referenced by these audit rows, so the caller can resolve them all in one batched lookup before building the timeline. */
function collectAuditActorIds(auditRows: AuditLogRow[]): (string | null)[] {
  return auditRows.map((row) => row.actor_user_id)
}

export { buildReferenceOptionActivityTimeline, collectAuditActorIds }
export type { ReferenceOptionActivityEvent }
