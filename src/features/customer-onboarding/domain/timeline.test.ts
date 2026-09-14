import { describe, expect, it } from "vitest"

import { buildOnboardingTimeline, collectOnboardingTimelineActorIds } from "./timeline"

const ACTOR_EMAILS = new Map<string, string | null>([
  ["actor-requester", "requester@example.com"],
  ["actor-approver", "approver@example.com"],
])

describe("buildOnboardingTimeline", () => {
  it("builds the full created -> submitted -> sent back -> resubmitted -> sent back -> resubmitted -> approved sequence, oldest first", () => {
    const timeline = buildOnboardingTimeline({
      createdAt: "2026-01-01T00:00:00.000Z",
      createdBy: "actor-requester",
      approvedAt: "2026-01-10T00:00:00.000Z",
      approvedBy: "actor-approver",
      revisions: [
        { revisionNumber: 1, submittedAt: "2026-01-02T00:00:00.000Z", submittedBy: "actor-requester" },
        { revisionNumber: 2, submittedAt: "2026-01-05T00:00:00.000Z", submittedBy: "actor-requester" },
        { revisionNumber: 3, submittedAt: "2026-01-08T00:00:00.000Z", submittedBy: "actor-requester" },
      ],
      sendBacks: [
        { revisionNumber: 1, reason: "GST number looks incorrect", sentBackBy: "actor-approver", sentBackAt: "2026-01-03T00:00:00.000Z" },
        { revisionNumber: 2, reason: "Registered address is incomplete", sentBackBy: "actor-approver", sentBackAt: "2026-01-06T00:00:00.000Z" },
      ],
      actorEmails: ACTOR_EMAILS,
    })

    expect(timeline.map((event) => event.summary)).toEqual([
      "Request created",
      "Submitted for review",
      "Sent back: GST number looks incorrect",
      "Resubmitted for review (Revision 2)",
      "Sent back: Registered address is incomplete",
      "Resubmitted for review (Revision 3)",
      "Approved",
    ])
    expect(timeline.every((event) => event.actorEmail === "requester@example.com" || event.actorEmail === "approver@example.com")).toBe(true)
  })

  it("never invents a submitted or approved event for a draft that was never submitted", () => {
    const timeline = buildOnboardingTimeline({
      createdAt: "2026-01-01T00:00:00.000Z",
      createdBy: "actor-requester",
      approvedAt: null,
      approvedBy: null,
      revisions: [{ revisionNumber: 1, submittedAt: null, submittedBy: null }],
      sendBacks: [],
      actorEmails: ACTOR_EMAILS,
    })

    expect(timeline.map((event) => event.summary)).toEqual(["Request created"])
  })

  it("never fabricates an actor email for an unresolved id", () => {
    const timeline = buildOnboardingTimeline({
      createdAt: "2026-01-01T00:00:00.000Z",
      createdBy: "actor-unknown",
      approvedAt: null,
      approvedBy: null,
      revisions: [],
      sendBacks: [],
      actorEmails: new Map(),
    })
    expect(timeline[0].actorEmail).toBeNull()
  })
})

describe("collectOnboardingTimelineActorIds", () => {
  it("collects every actor id referenced anywhere in the inputs", () => {
    const ids = collectOnboardingTimelineActorIds({
      createdAt: "2026-01-01T00:00:00.000Z",
      createdBy: "actor-requester",
      approvedAt: "2026-01-10T00:00:00.000Z",
      approvedBy: "actor-approver",
      revisions: [{ revisionNumber: 1, submittedAt: "2026-01-02T00:00:00.000Z", submittedBy: "actor-requester" }],
      sendBacks: [{ revisionNumber: 1, reason: "reason", sentBackBy: "actor-approver", sentBackAt: "2026-01-03T00:00:00.000Z" }],
    })
    expect(new Set(ids)).toEqual(new Set(["actor-requester", "actor-approver"]))
  })
})
