import { describe, expect, it } from "vitest"

import { bucketForStatus, sortByUpdatedAtDesc, filterByBucket } from "./inbox"
import type { ApprovalInboxItem } from "./types"

describe("bucketForStatus", () => {
  it("buckets submitted and resubmitted as needing action", () => {
    expect(bucketForStatus("submitted")).toBe("needs_action")
    expect(bucketForStatus("resubmitted")).toBe("needs_action")
  })

  it("buckets sent_back distinctly from needs_action", () => {
    expect(bucketForStatus("sent_back")).toBe("sent_back")
  })

  it("buckets approved and rejected as completed", () => {
    expect(bucketForStatus("approved")).toBe("completed")
    expect(bucketForStatus("rejected")).toBe("completed")
  })

  it("excludes draft entirely: it is nobody else's concern yet", () => {
    expect(bucketForStatus("draft")).toBeNull()
  })
})

function item(overrides: Partial<ApprovalInboxItem>): ApprovalInboxItem {
  return {
    type: "onboarding",
    requestId: "r1",
    status: "submitted",
    bucket: "needs_action",
    customerName: "Aurora Consumer Labs Pvt Ltd",
    customerKey: null,
    requestedByEmail: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    href: "/reviews/r1",
    ...overrides,
  }
}

describe("sortByUpdatedAtDesc", () => {
  it("sorts newest first without mutating the input array", () => {
    const older = item({ requestId: "older", updatedAt: "2026-01-01T00:00:00.000Z" })
    const newer = item({ requestId: "newer", updatedAt: "2026-01-05T00:00:00.000Z" })
    const input = [older, newer]
    const sorted = sortByUpdatedAtDesc(input)
    expect(sorted.map((entry) => entry.requestId)).toEqual(["newer", "older"])
    expect(input).toEqual([older, newer])
  })
})

describe("filterByBucket", () => {
  const needsAction = item({ requestId: "a", bucket: "needs_action" })
  const sentBack = item({ requestId: "b", bucket: "sent_back" })
  const completed = item({ requestId: "c", bucket: "completed" })
  const all = [needsAction, sentBack, completed]

  it("returns everything for 'all'", () => {
    expect(filterByBucket(all, "all")).toEqual(all)
  })

  it("filters to exactly one bucket otherwise", () => {
    expect(filterByBucket(all, "sent_back")).toEqual([sentBack])
  })
})
