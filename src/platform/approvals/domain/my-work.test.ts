import { describe, expect, it } from "vitest"

import { buildMyWorkItems } from "./my-work"
import type { ApprovalInboxItem } from "./types"

const NOW = new Date("2026-01-10T00:00:00.000Z")

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
    ...overrides,
  }
}

describe("buildMyWorkItems", () => {
  it("includes a sent-back item only when this user is the one it was sent back to", () => {
    const items = [item({ createdBy: "actor-requester" })]
    expect(buildMyWorkItems(items, "actor-requester", false, NOW)).toHaveLength(1)
    expect(buildMyWorkItems(items, "someone-else", false, NOW)).toHaveLength(0)
  })

  it("excludes a completed or draft-origin item entirely, regardless of who created it", () => {
    const items = [item({ bucket: "completed", status: "approved" })]
    expect(buildMyWorkItems(items, "actor-requester", true, NOW)).toHaveLength(0)
  })

  it("includes every needs_action item once the user holds the approve permission, since approval is not per-person routed", () => {
    const items = [
      item({ requestId: "req-2", bucket: "needs_action", status: "submitted", createdBy: "someone-else" }),
    ]
    expect(buildMyWorkItems(items, "actor-approver", false, NOW)).toHaveLength(0)
    const withApprove = buildMyWorkItems(items, "actor-approver", true, NOW)
    expect(withApprove).toHaveLength(1)
    expect(withApprove[0].reason).toBe("pending_my_approval")
  })

  it("computes age in whole days from updatedAt", () => {
    const items = [item({ updatedAt: "2026-01-08T00:00:00.000Z" })]
    const result = buildMyWorkItems(items, "actor-requester", false, NOW)
    expect(result[0].ageDays).toBe(2)
  })

  it("sorts oldest (largest age) first", () => {
    const items = [
      item({ requestId: "req-a", updatedAt: "2026-01-09T00:00:00.000Z" }),
      item({ requestId: "req-b", updatedAt: "2026-01-05T00:00:00.000Z" }),
    ]
    const result = buildMyWorkItems(items, "actor-requester", false, NOW)
    expect(result.map((r) => r.requestId)).toEqual(["req-b", "req-a"])
  })
})
