import { describe, expect, it } from "vitest"

import { buildOperationalQueue } from "./operational-queue"
import type { ApprovalInboxItem } from "./types"

const NOW = new Date("2026-01-10T00:00:00.000Z")

function item(overrides: Partial<ApprovalInboxItem>): ApprovalInboxItem {
  return {
    type: "onboarding",
    requestId: "req-1",
    displayId: "CO-000001",
    status: "submitted",
    bucket: "needs_action",
    customerName: "Acme",
    customerKey: null,
    createdBy: "actor-requester",
    requestedByEmail: "requester@example.com",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-05T00:00:00.000Z",
    href: "/reviews/req-1",
    ...overrides,
  }
}

describe("buildOperationalQueue (Platform Scale Closure, Phase L)", () => {
  it("excludes completed items entirely: this is a stuck-work view, not a history report", () => {
    const entries = buildOperationalQueue([item({ bucket: "completed", status: "approved" })], new Map(), NOW)
    expect(entries).toHaveLength(0)
  })

  it("names a role, never a fabricated person, for current responsibility", () => {
    const entries = buildOperationalQueue([item({ status: "submitted" })], new Map(), NOW)
    expect(entries[0].currentResponsibility).toBe("Pending Finance Approval")
  })

  it("falls back to zero sent-back count when the request has no entry in the lookup, rather than throwing", () => {
    const entries = buildOperationalQueue([item({ requestId: "req-unknown" })], new Map(), NOW)
    expect(entries[0].sentBackCount).toBe(0)
  })

  it("carries through a real sent-back count when one exists", () => {
    const entries = buildOperationalQueue([item({ requestId: "req-1" })], new Map([["req-1", 3]]), NOW)
    expect(entries[0].sentBackCount).toBe(3)
  })

  it("sorts oldest (most stuck) first", () => {
    const entries = buildOperationalQueue(
      [
        item({ requestId: "newer", updatedAt: "2026-01-09T00:00:00.000Z" }),
        item({ requestId: "older", updatedAt: "2026-01-02T00:00:00.000Z" }),
      ],
      new Map(),
      NOW
    )
    expect(entries.map((entry) => entry.requestId)).toEqual(["older", "newer"])
  })
})
