import { describe, expect, it } from "vitest"

import { buildGoLiveTimeline } from "./timeline"
import type { GoLiveRequest, GoLiveRequestStatus, GoLiveSendBackEntry } from "./types"

const ACTOR_EMAILS = new Map<string, string | null>([
  ["actor-maker", "maker@example.com"],
  ["actor-checker", "checker@example.com"],
])

function request(overrides: Partial<GoLiveRequest> & { status: GoLiveRequestStatus }): GoLiveRequest {
  return {
    id: "req-1",
    requestNumber: 1,
    customerId: "cust-1",
    commercialConfigurationId: "cc-1",
    commercialVersionId: "cv-1",
    stableComponentKey: "key-1",
    goLiveDate: "2026-07-01",
    prorateFirstMonth: false,
    customerConfirmationStatus: "pending",
    workflowVersionId: null,
    comment: null,
    sentBackReason: null,
    sentBackBy: null,
    sentBackAt: null,
    submittedBy: null,
    submittedAt: null,
    approvedBy: null,
    approvedAt: null,
    cancelledBy: null,
    cancelledAt: null,
    cancelledReason: null,
    createdBy: "actor-maker",
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedBy: null,
    updatedAt: "2026-06-01T00:00:00.000Z",
    ...overrides,
  }
}

describe("buildGoLiveTimeline", () => {
  it("includes a Submitted event with the real actor and timestamp, not only the created event (real defect found via a genuinely different-checker E2E test)", () => {
    const timeline = buildGoLiveTimeline(
      request({ status: "submitted", submittedBy: "actor-maker", submittedAt: "2026-06-02T00:00:00.000Z" }),
      [],
      ACTOR_EMAILS
    )
    expect(timeline.map((event) => event.summary)).toEqual(["Go Live request created", "Submitted for review"])
    expect(timeline[1].actorEmail).toBe("maker@example.com")
  })

  it("builds the full created -> submitted -> sent back -> resubmitted -> approved sequence, oldest first", () => {
    const sendBacks: GoLiveSendBackEntry[] = [
      { id: "sb-1", goLiveRequestId: "req-1", reason: "Go Live Date is before the commercial effective date", sentBackBy: "actor-checker", sentBackAt: "2026-06-03T00:00:00.000Z" },
    ]
    const timeline = buildGoLiveTimeline(
      request({
        status: "approved",
        submittedBy: "actor-maker",
        submittedAt: "2026-06-04T00:00:00.000Z",
        approvedBy: "actor-checker",
        approvedAt: "2026-06-05T00:00:00.000Z",
      }),
      sendBacks,
      ACTOR_EMAILS
    )
    expect(timeline.map((event) => event.summary)).toEqual([
      "Go Live request created",
      "Sent back: Go Live Date is before the commercial effective date",
      "Resubmitted for review",
      "Approved: line item is now Live",
    ])
  })

  it("has no Submitted event at all while the request is still an unsubmitted Draft", () => {
    const timeline = buildGoLiveTimeline(request({ status: "draft" }), [], ACTOR_EMAILS)
    expect(timeline.map((event) => event.summary)).toEqual(["Go Live request created"])
  })
})
