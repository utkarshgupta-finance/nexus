import { describe, expect, it } from "vitest"

import { buildChangeRequestTimeline, collectChangeRequestTimelineActorIds } from "./timeline"

const ACTOR_EMAILS = new Map<string, string | null>([
  ["actor-requester", "requester@example.com"],
  ["actor-approver", "approver@example.com"],
])

describe("buildChangeRequestTimeline", () => {
  it("builds the full created -> submitted -> sent back -> resubmitted -> approved sequence, oldest first", () => {
    const timeline = buildChangeRequestTimeline({
      createdAt: "2026-01-01T00:00:00.000Z",
      createdBy: "actor-requester",
      decidedAt: "2026-01-10T00:00:00.000Z",
      decidedBy: "actor-approver",
      decisionStatus: "approved",
      decisionReason: null,
      revisions: [
        { revisionNumber: 1, submittedAt: "2026-01-02T00:00:00.000Z", submittedBy: "actor-requester" },
        { revisionNumber: 2, submittedAt: "2026-01-05T00:00:00.000Z", submittedBy: "actor-requester" },
      ],
      sendBacks: [{ revisionNumber: 1, reason: "Effective date is missing", sentBackBy: "actor-approver", sentBackAt: "2026-01-03T00:00:00.000Z" }],
      actorEmails: ACTOR_EMAILS,
    })

    expect(timeline.map((event) => event.summary)).toEqual([
      "Change Request created",
      "Submitted for review",
      "Sent back: Effective date is missing",
      "Resubmitted for review (Revision 2)",
      "Approved",
    ])
  })

  it("includes the decision reason for a rejection, never a blank summary", () => {
    const timeline = buildChangeRequestTimeline({
      createdAt: "2026-01-01T00:00:00.000Z",
      createdBy: "actor-requester",
      decidedAt: "2026-01-05T00:00:00.000Z",
      decidedBy: "actor-approver",
      decisionStatus: "rejected",
      decisionReason: "Duplicate of an already-approved change",
      revisions: [{ revisionNumber: 1, submittedAt: "2026-01-02T00:00:00.000Z", submittedBy: "actor-requester" }],
      sendBacks: [],
      actorEmails: ACTOR_EMAILS,
    })
    expect(timeline.at(-1)?.summary).toBe("Rejected: Duplicate of an already-approved change")
  })

  it("never invents a submitted or decided event for a draft that was never submitted", () => {
    const timeline = buildChangeRequestTimeline({
      createdAt: "2026-01-01T00:00:00.000Z",
      createdBy: "actor-requester",
      decidedAt: null,
      decidedBy: null,
      decisionStatus: null,
      decisionReason: null,
      revisions: [{ revisionNumber: 1, submittedAt: null, submittedBy: null }],
      sendBacks: [],
      actorEmails: ACTOR_EMAILS,
    })
    expect(timeline.map((event) => event.summary)).toEqual(["Change Request created"])
  })
})

describe("collectChangeRequestTimelineActorIds", () => {
  it("collects every actor id referenced anywhere in the inputs", () => {
    const ids = collectChangeRequestTimelineActorIds({
      createdAt: "2026-01-01T00:00:00.000Z",
      createdBy: "actor-requester",
      decidedAt: "2026-01-10T00:00:00.000Z",
      decidedBy: "actor-approver",
      decisionStatus: "approved",
      decisionReason: null,
      revisions: [{ revisionNumber: 1, submittedAt: "2026-01-02T00:00:00.000Z", submittedBy: "actor-requester" }],
      sendBacks: [{ revisionNumber: 1, reason: "reason", sentBackBy: "actor-approver", sentBackAt: "2026-01-03T00:00:00.000Z" }],
    })
    expect(new Set(ids)).toEqual(new Set(["actor-requester", "actor-approver"]))
  })
})
