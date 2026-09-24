import { describe, expect, it } from "vitest"

import { buildReferenceOptionActivityTimeline, collectAuditActorIds } from "./activity"
import type { AuditLogRow } from "@/platform/audit/server"

function makeRow(overrides: Partial<AuditLogRow>): AuditLogRow {
  return {
    id: "audit-1",
    resource_id: null,
    table_name: "reference_options",
    row_id: "option-1",
    action: "INSERT",
    before_value: null,
    after_value: null,
    occurred_at: "2026-09-20T09:18:00.000Z",
    actor_user_id: null,
    request_id: null,
    actor_context: null,
    actor_display_name_snapshot: null,
    actor_email_snapshot: null,
    ...overrides,
  }
}

const CREATED = makeRow({
  id: "audit-created",
  action: "INSERT",
  after_value: { id: "option-1", list_key: "industry", code: "retail", label: "Retail", is_active: true },
  occurred_at: "2026-09-20T09:18:00.000Z",
  actor_user_id: null,
})

const DEACTIVATED = makeRow({
  id: "audit-deactivated",
  action: "UPDATE",
  before_value: { id: "option-1", label: "Retail", is_active: true },
  after_value: { id: "option-1", label: "Retail", is_active: false },
  occurred_at: "2026-09-23T11:04:00.000Z",
  actor_user_id: "admin-1",
  actor_display_name_snapshot: "Nexus Test Admin",
})

const REACTIVATED = makeRow({
  id: "audit-reactivated",
  action: "UPDATE",
  before_value: { id: "option-1", label: "Retail", is_active: false },
  after_value: { id: "option-1", label: "Retail", is_active: true },
  occurred_at: "2026-09-24T14:32:00.000Z",
  actor_user_id: "admin-1",
  actor_display_name_snapshot: "Nexus Test Admin",
})

describe("buildReferenceOptionActivityTimeline", () => {
  it("renders Created for an INSERT row", () => {
    const events = buildReferenceOptionActivityTimeline([CREATED], new Map())
    expect(events).toHaveLength(1)
    expect(events[0].action).toBe("Created")
    expect(events[0].change).toBeNull()
  })

  it("renders Deactivated / Reactivated from is_active flips, never fabricating a change detail for them", () => {
    const events = buildReferenceOptionActivityTimeline([DEACTIVATED, REACTIVATED], new Map())
    expect(events.map((e) => e.action)).toEqual(["Reactivated", "Deactivated"])
    expect(events.every((e) => e.change === null)).toBe(true)
  })

  it("orders newest first regardless of input order", () => {
    const events = buildReferenceOptionActivityTimeline([REACTIVATED, CREATED, DEACTIVATED], new Map())
    expect(events.map((e) => e.action)).toEqual(["Reactivated", "Deactivated", "Created"])
  })

  it("resolves actor from the display_name_snapshot first, matching the permanent Actor Identity rule", () => {
    const events = buildReferenceOptionActivityTimeline([DEACTIVATED], new Map([["admin-1", "Some Current Name"]]))
    expect(events[0].actorLabel).toBe("Nexus Test Admin")
  })

  it("falls back to the actor's current resolved label when no snapshot exists", () => {
    const row = makeRow({
      action: "UPDATE",
      before_value: { id: "option-1", label: "Retail", is_active: true },
      after_value: { id: "option-1", label: "Retail", is_active: false },
      actor_user_id: "admin-2",
      actor_display_name_snapshot: null,
    })
    const events = buildReferenceOptionActivityTimeline([row], new Map([["admin-2", "Current Label"]]))
    expect(events[0].actorLabel).toBe("Current Label")
  })

  it("falls back to System when no actor is attributable at all, never a blank or raw id", () => {
    const events = buildReferenceOptionActivityTimeline([CREATED], new Map())
    expect(events[0].actorLabel).toBe("System")
  })

  it("renders a label change as Renamed with old -> new", () => {
    const row = makeRow({
      action: "UPDATE",
      before_value: { id: "option-1", label: "Retial" },
      after_value: { id: "option-1", label: "Retail" },
    })
    const events = buildReferenceOptionActivityTimeline([row], new Map())
    expect(events[0].action).toBe("Renamed")
    expect(events[0].change).toEqual({ from: "Retial", to: "Retail" })
  })

  it("renders an INR Conversion Rate change with old -> new, distinguishing not-configured from a real value", () => {
    const row = makeRow({
      action: "UPDATE",
      before_value: { id: "option-1", inr_conversion_rate: null },
      after_value: { id: "option-1", inr_conversion_rate: 83.2 },
    })
    const events = buildReferenceOptionActivityTimeline([row], new Map())
    expect(events[0].action).toBe("INR Conversion Rate changed")
    expect(events[0].change).toEqual({ from: "Not configured", to: "83.2" })
  })

  it("renders an Invoice Cadence change with old -> new, formatting null as One-Time", () => {
    const row = makeRow({
      action: "UPDATE",
      before_value: { id: "option-1", cadence_months: null },
      after_value: { id: "option-1", cadence_months: 3 },
    })
    const events = buildReferenceOptionActivityTimeline([row], new Map())
    expect(events[0].action).toBe("Invoice Cadence changed")
    expect(events[0].change).toEqual({ from: "One-Time", to: "Every 3 months" })
  })

  it("emits one event per changed field when a single row changes more than one", () => {
    const row = makeRow({
      action: "UPDATE",
      before_value: { id: "option-1", label: "Old Label", is_active: true },
      after_value: { id: "option-1", label: "New Label", is_active: false },
    })
    const events = buildReferenceOptionActivityTimeline([row], new Map())
    expect(events.map((e) => e.action).sort()).toEqual(["Deactivated", "Renamed"])
  })

  it("never fabricates history: an unresolvable/empty row set produces an empty timeline, not a synthetic Created event", () => {
    expect(buildReferenceOptionActivityTimeline([], new Map())).toEqual([])
  })
})

describe("collectAuditActorIds", () => {
  it("collects every row's actor id, including nulls", () => {
    expect(collectAuditActorIds([CREATED, DEACTIVATED])).toEqual([null, "admin-1"])
  })
})
