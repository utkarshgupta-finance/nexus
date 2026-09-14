import { describe, expect, it } from "vitest"

import { buildCommercialVersionTimeline, collectCommercialVersionTimelineActorIds } from "./commercial-version-timeline"

const ACTOR_EMAILS = new Map<string, string | null>([
  ["actor-requester", "requester@example.com"],
  ["actor-approver", "approver@example.com"],
])

describe("buildCommercialVersionTimeline", () => {
  it("builds created -> submitted -> approved, oldest first", () => {
    const timeline = buildCommercialVersionTimeline({
      createdAt: "2026-01-01T00:00:00.000Z",
      createdBy: "actor-requester",
      submittedAt: "2026-01-02T00:00:00.000Z",
      submittedBy: "actor-requester",
      decidedAt: "2026-01-05T00:00:00.000Z",
      decidedBy: "actor-approver",
      decisionStatus: "approved",
      decisionReason: null,
      actorEmails: ACTOR_EMAILS,
    })
    expect(timeline.map((e) => e.summary)).toEqual(["Version created", "Submitted for review", "Approved"])
  })

  it("includes the decision reason for a rejection", () => {
    const timeline = buildCommercialVersionTimeline({
      createdAt: "2026-01-01T00:00:00.000Z",
      createdBy: "actor-requester",
      submittedAt: "2026-01-02T00:00:00.000Z",
      submittedBy: "actor-requester",
      decidedAt: "2026-01-05T00:00:00.000Z",
      decidedBy: "actor-approver",
      decisionStatus: "rejected",
      decisionReason: "Rate does not match the approved commercial proposal",
      actorEmails: ACTOR_EMAILS,
    })
    expect(timeline.at(-1)?.summary).toBe("Rejected: Rate does not match the approved commercial proposal")
  })

  it("never invents a submitted or decided event for a version still in draft", () => {
    const timeline = buildCommercialVersionTimeline({
      createdAt: "2026-01-01T00:00:00.000Z",
      createdBy: "actor-requester",
      submittedAt: null,
      submittedBy: null,
      decidedAt: null,
      decidedBy: null,
      decisionStatus: null,
      decisionReason: null,
      actorEmails: ACTOR_EMAILS,
    })
    expect(timeline.map((e) => e.summary)).toEqual(["Version created"])
  })
})

describe("collectCommercialVersionTimelineActorIds", () => {
  it("collects every actor id referenced anywhere in the inputs", () => {
    const ids = collectCommercialVersionTimelineActorIds({
      createdAt: "2026-01-01T00:00:00.000Z",
      createdBy: "actor-requester",
      submittedAt: "2026-01-02T00:00:00.000Z",
      submittedBy: "actor-requester",
      decidedAt: "2026-01-05T00:00:00.000Z",
      decidedBy: "actor-approver",
      decisionStatus: "approved",
      decisionReason: null,
    })
    expect(new Set(ids)).toEqual(new Set(["actor-requester", "actor-approver"]))
  })
})
