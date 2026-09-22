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
    responsibleTeamId: null,
    ...overrides,
  }
}

describe("buildOperationalQueue (Platform Scale Closure, Phase L)", () => {
  it("excludes completed items entirely: this is a stuck-work view, not a history report", () => {
    const entries = buildOperationalQueue([item({ bucket: "completed", status: "approved" })], new Map(), new Map(), new Map(), NOW)
    expect(entries).toHaveLength(0)
  })

  it("names a role, never a fabricated person, for current responsibility", () => {
    const entries = buildOperationalQueue([item({ status: "submitted" })], new Map(), new Map(), new Map(), NOW)
    expect(entries[0].currentResponsibility).toBe("Pending Approval")
  })

  it("never names a specific team in currentResponsibility, across all four domains, even though the Team column is separately real (M-017)", () => {
    // Regression for a real bug found live: currentResponsibility used to
    // hardcode "Pending Finance Approval" regardless of the item's actual
    // domain or team, so a real Legal- or Ops-owned item would show
    // "Pending Finance Approval" right next to a correct "Team: Legal"
    // badge. The label must stay domain-neutral instead.
    const types: ApprovalInboxItem["type"][] = ["onboarding", "change_request", "commercial_version", "go_live"]
    const entries = buildOperationalQueue(
      types.map((type, i) => item({ type, requestId: `req-${i}`, status: "submitted", responsibleTeamId: `team-${i}` })),
      new Map(),
      new Map(),
      new Map([
        ["team-0", "WF-TEST Legal"],
        ["team-1", "WF-TEST Ops"],
        ["team-2", "WF-TEST Leadership"],
        ["team-3", "WF-TEST Finance"],
      ]),
      NOW
    )
    for (const entry of entries) {
      expect(entry.currentResponsibility).toBe("Pending Approval")
      expect(entry.currentResponsibility).not.toMatch(/Finance|Legal|Ops|Leadership|@|actor-/i)
    }
    // The real team name is carried separately and correctly, confirming
    // the two fields are genuinely independent, not silently duplicating
    // the (buggy) hardcoded string.
    expect(entries.map((e) => e.responsibleTeamName)).toEqual(["WF-TEST Legal", "WF-TEST Ops", "WF-TEST Leadership", "WF-TEST Finance"])
  })

  it("falls back to zero sent-back count when the request has no entry in the lookup, rather than throwing", () => {
    const entries = buildOperationalQueue([item({ requestId: "req-unknown" })], new Map(), new Map(), new Map(), NOW)
    expect(entries[0].sentBackCount).toBe(0)
  })

  it("carries through a real sent-back count when one exists", () => {
    const entries = buildOperationalQueue([item({ requestId: "req-1" })], new Map([["req-1", 3]]), new Map(), new Map(), NOW)
    expect(entries[0].sentBackCount).toBe(3)
  })

  it("sorts oldest (most stuck) first", () => {
    const entries = buildOperationalQueue(
      [
        item({ requestId: "newer", updatedAt: "2026-01-09T00:00:00.000Z" }),
        item({ requestId: "older", updatedAt: "2026-01-02T00:00:00.000Z" }),
      ],
      new Map(),
      new Map(),
      new Map(),
      NOW
    )
    expect(entries.map((entry) => entry.requestId)).toEqual(["older", "newer"])
  })

  it("has an eligible approver when the item names no responsible team at all", () => {
    const entries = buildOperationalQueue([item({ responsibleTeamId: null })], new Map(), new Map(), new Map(), NOW)
    expect(entries[0].hasEligibleApprover).toBe(true)
    expect(entries[0].responsibleTeamName).toBeNull()
  })

  it("has an eligible approver when the responsible team still has at least one active member (Product Gap Closure, O-018)", () => {
    const entries = buildOperationalQueue(
      [item({ responsibleTeamId: "team-1" })],
      new Map(),
      new Map([["team-1", 2]]),
      new Map([["team-1", "Legal"]]),
      NOW
    )
    expect(entries[0].hasEligibleApprover).toBe(true)
    expect(entries[0].responsibleTeamName).toBe("Legal")
  })

  it("has no eligible approver when the responsible team has zero active members (Product Gap Closure, O-018)", () => {
    const entries = buildOperationalQueue(
      [item({ responsibleTeamId: "team-1" })],
      new Map(),
      new Map([["team-1", 0]]),
      new Map([["team-1", "Legal"]]),
      NOW
    )
    expect(entries[0].hasEligibleApprover).toBe(false)
    expect(entries[0].responsibleTeamName).toBe("Legal")
  })

  it("has no eligible approver when the responsible team is entirely absent from the active-member-count map (never had a member, not merely emptied)", () => {
    const entries = buildOperationalQueue([item({ responsibleTeamId: "team-1" })], new Map(), new Map(), new Map(), NOW)
    expect(entries[0].hasEligibleApprover).toBe(false)
  })
})
