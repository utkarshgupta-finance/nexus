import { describe, expect, it } from "vitest"

import { buildMyWorkItems, buildDraftWorkItems } from "./my-work"
import type { ApprovalInboxItem } from "./types"

const NOW = new Date("2026-01-10T00:00:00.000Z")

const NO_TEAMS = new Set<string>()

function item(overrides: Partial<ApprovalInboxItem>): ApprovalInboxItem {
  return {
    type: "onboarding",
    requestId: "req-1",
    displayId: "CO-000001",
    status: "sent_back",
    bucket: "sent_back",
    customerName: "Acme",
    customerKey: null,
    createdBy: "actor-requester",
    requestedByEmail: "requester@example.com",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-08T00:00:00.000Z",
    href: "/reviews/req-1",
    responsibleTeamId: null,
    ...overrides,
  }
}

describe("buildMyWorkItems", () => {
  it("includes a sent-back item only when this user is the one it was sent back to", () => {
    const items = [item({ createdBy: "actor-requester" })]
    expect(buildMyWorkItems(items, "actor-requester", false, NO_TEAMS, NOW)).toHaveLength(1)
    expect(buildMyWorkItems(items, "someone-else", false, NO_TEAMS, NOW)).toHaveLength(0)
  })

  it("excludes a completed or draft-origin item entirely, regardless of who created it", () => {
    const items = [item({ bucket: "completed", status: "approved" })]
    expect(buildMyWorkItems(items, "actor-requester", true, NO_TEAMS, NOW)).toHaveLength(0)
  })

  it("includes a needs_action item with no responsible team once the user holds the approve permission (no workflow bound, or a graph with no Approval node routing)", () => {
    const items = [
      item({ requestId: "req-2", bucket: "needs_action", status: "submitted", createdBy: "someone-else", responsibleTeamId: null }),
    ]
    expect(buildMyWorkItems(items, "actor-approver", false, NO_TEAMS, NOW)).toHaveLength(0)
    const withApprove = buildMyWorkItems(items, "actor-approver", true, NO_TEAMS, NOW)
    expect(withApprove).toHaveLength(1)
    expect(withApprove[0].reason).toBe("pending_my_approval")
  })

  it("Workflow Runtime V1 Sequential Execution: excludes a needs_action item from pending_my_approval when the user holds the approve permission but is not a member of the item's current responsible team", () => {
    const items = [item({ bucket: "needs_action", status: "submitted", createdBy: "someone-else", responsibleTeamId: "team-legal" })]
    const result = buildMyWorkItems(items, "actor-finance-approver", true, new Set(["team-finance"]), NOW)
    expect(result).toHaveLength(0)
  })

  it("includes a needs_action item as pending_my_approval when the user is an active member of the item's current responsible team", () => {
    const items = [item({ bucket: "needs_action", status: "submitted", createdBy: "someone-else", responsibleTeamId: "team-legal" })]
    const result = buildMyWorkItems(items, "actor-legal-approver", true, new Set(["team-legal"]), NOW)
    expect(result).toHaveLength(1)
    expect(result[0].reason).toBe("pending_my_approval")
  })

  it("shows a requester their own submitted item as waiting_on_others when they cannot decide it themselves", () => {
    const items = [item({ bucket: "needs_action", status: "submitted", createdBy: "actor-requester" })]
    const result = buildMyWorkItems(items, "actor-requester", false, NO_TEAMS, NOW)
    expect(result).toHaveLength(1)
    expect(result[0].reason).toBe("waiting_on_others")
  })

  it("shows a requester their own submitted item as waiting_on_others when it is sitting at a node their team does not cover, even though they hold the approve permission", () => {
    const items = [item({ bucket: "needs_action", status: "submitted", createdBy: "actor-requester", responsibleTeamId: "team-legal" })]
    const result = buildMyWorkItems(items, "actor-requester", true, new Set(["team-finance"]), NOW)
    expect(result).toHaveLength(1)
    expect(result[0].reason).toBe("waiting_on_others")
  })

  it("prefers pending_my_approval over waiting_on_others when the requester can also decide their own item", () => {
    const items = [item({ bucket: "needs_action", status: "submitted", createdBy: "actor-requester" })]
    const result = buildMyWorkItems(items, "actor-requester", true, NO_TEAMS, NOW)
    expect(result[0].reason).toBe("pending_my_approval")
  })

  it("computes age in whole days from updatedAt", () => {
    const items = [item({ updatedAt: "2026-01-08T00:00:00.000Z" })]
    const result = buildMyWorkItems(items, "actor-requester", false, NO_TEAMS, NOW)
    expect(result[0].ageDays).toBe(2)
  })

  it("sorts oldest (largest age) first", () => {
    const items = [
      item({ requestId: "req-a", updatedAt: "2026-01-09T00:00:00.000Z" }),
      item({ requestId: "req-b", updatedAt: "2026-01-05T00:00:00.000Z" }),
    ]
    const result = buildMyWorkItems(items, "actor-requester", false, NO_TEAMS, NOW)
    expect(result.map((r) => r.requestId)).toEqual(["req-b", "req-a"])
  })
})

describe("buildDraftWorkItems (Platform Scale Closure, Phase K)", () => {
  it("shapes a draft entry with a finish-and-submit action and the draft_to_continue reason", () => {
    const result = buildDraftWorkItems(
      [
        {
          type: "change_request",
          requestId: "cr-1",
          displayId: "CCR-000001",
          customerName: "Acme",
          status: "draft",
          href: "/customers/acme/change-requests/cr-1",
          updatedAt: "2026-01-08T00:00:00.000Z",
        },
      ],
      NOW
    )
    expect(result).toHaveLength(1)
    expect(result[0].reason).toBe("draft_to_continue")
    expect(result[0].whatINeedToDo).toBe("Finish and submit this draft Customer Change Request")
    expect(result[0].ageDays).toBe(2)
  })

  it("sorts oldest first, same as every other My Work section", () => {
    const result = buildDraftWorkItems(
      [
        { type: "commercial_version", requestId: "v-a", displayId: "CC-000001", customerName: "Acme", status: "draft", href: "/a", updatedAt: "2026-01-09T00:00:00.000Z" },
        { type: "commercial_version", requestId: "v-b", displayId: "CC-000002", customerName: "Acme", status: "draft", href: "/b", updatedAt: "2026-01-05T00:00:00.000Z" },
      ],
      NOW
    )
    expect(result.map((r) => r.requestId)).toEqual(["v-b", "v-a"])
  })
})
