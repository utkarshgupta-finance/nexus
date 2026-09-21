import { describe, expect, it } from "vitest"

import { buildWorkflowTransitionEvents } from "./transition-events"
import type { WorkflowTransitionRecord, WorkflowNodeDisplay } from "./transition-events"

const NODE_DISPLAY = new Map<string, WorkflowNodeDisplay>([
  ["node_finance", { nodeName: "Finance Approval", teamName: "WF-TEST Finance" }],
  ["node_legal", { nodeName: "Legal Approval", teamName: "WF-TEST Legal" }],
  ["node_leadership", { nodeName: "Leadership Approval", teamName: "WF-TEST Leadership" }],
])

const ACTOR_LABELS = new Map<string, string | null>([
  ["finance-user", "Ananya Rao"],
  ["legal-user", "Vikram Shah"],
  ["leadership-user", "Priya Mehta"],
])

function transition(overrides: Partial<WorkflowTransitionRecord>): WorkflowTransitionRecord {
  return {
    fromNodeKey: "node_finance",
    toNodeKey: "node_legal",
    action: "approve",
    actorUserId: "finance-user",
    comment: null,
    occurredAt: "2026-09-16T10:42:00.000Z",
    cycleNumber: 1,
    ...overrides,
  }
}

describe("buildWorkflowTransitionEvents", () => {
  it("returns no events for a request never actually routed through an Approval node (only a submit transition, or none at all)", () => {
    expect(buildWorkflowTransitionEvents([], NODE_DISPLAY, ACTOR_LABELS)).toEqual([])
    expect(
      buildWorkflowTransitionEvents([transition({ action: "submit", fromNodeKey: null, toNodeKey: "node_finance" })], NODE_DISPLAY, ACTOR_LABELS)
    ).toEqual([])
  })

  it("never renders a raw node_key or actor UUID: every event uses the real node name and the real actor label", () => {
    const events = buildWorkflowTransitionEvents(
      [transition({ fromNodeKey: "node_finance", actorUserId: "finance-user" })],
      NODE_DISPLAY,
      ACTOR_LABELS
    )
    expect(events).toHaveLength(1)
    expect(events[0].summary).toBe("Finance Approval approved")
    expect(events[0].summary).not.toMatch(/node_finance|finance-user/)
    expect(events[0].actorEmail).toBe("Ananya Rao")
  })

  it("falls back to a generic step name if a node was since removed from the graph, never a raw key", () => {
    const events = buildWorkflowTransitionEvents([transition({ fromNodeKey: "node_deleted" })], NODE_DISPLAY, ACTOR_LABELS)
    expect(events[0].summary).toBe("Approval step approved")
  })

  it("renders a send_back event with the node name in the headline and the reason as a secondary detail", () => {
    const events = buildWorkflowTransitionEvents(
      [
        transition({
          action: "send_back",
          fromNodeKey: "node_legal",
          toNodeKey: null,
          actorUserId: "legal-user",
          comment: "Please update the commercial effective date.",
        }),
      ],
      NODE_DISPLAY,
      ACTOR_LABELS
    )
    expect(events[0].summary).toBe("Legal Approval sent back")
    expect(events[0].actorEmail).toBe("Vikram Shah")
    expect(events[0].detail).toBe("Please update the commercial effective date.")
  })

  it("renders a reject event with the node name in the headline and the reason as a secondary detail", () => {
    const events = buildWorkflowTransitionEvents(
      [transition({ action: "reject", fromNodeKey: "node_leadership", toNodeKey: null, actorUserId: "leadership-user", comment: "Budget concerns." })],
      NODE_DISPLAY,
      ACTOR_LABELS
    )
    expect(events[0].summary).toBe("Leadership Approval rejected")
    expect(events[0].detail).toBe("Budget concerns.")
  })

  it("folds a terminal detail into the final approval line instead of adding a second 'Approved' line", () => {
    const events = buildWorkflowTransitionEvents(
      [transition({ fromNodeKey: "node_leadership", toNodeKey: "node_end", actorUserId: "leadership-user" })],
      NODE_DISPLAY,
      ACTOR_LABELS,
      "line item is now Live",
      true
    )
    expect(events).toHaveLength(1)
    expect(events[0].summary).toBe("Leadership Approval approved: line item is now Live")
  })

  it("does not fold the terminal detail into a non-final approval", () => {
    const events = buildWorkflowTransitionEvents(
      [
        transition({ fromNodeKey: "node_finance", toNodeKey: "node_legal", actorUserId: "finance-user" }),
        transition({ fromNodeKey: "node_legal", toNodeKey: "node_end", actorUserId: "legal-user", occurredAt: "2026-09-16T11:00:00.000Z" }),
      ],
      NODE_DISPLAY,
      ACTOR_LABELS,
      "line item is now Live",
      true
    )
    expect(events[0].summary).toBe("Finance Approval approved")
    expect(events[1].summary).toBe("Legal Approval approved: line item is now Live")
  })

  it("never folds the terminal detail onto an intermediate node advance just because it is the only transition recorded so far, even though its to_node_key looks like any other node key (real defect found via live H-020/H-021 multi-node testing: a mid-workflow advance was mislabeled 'line item is now Live' while the request was still status=submitted)", () => {
    const events = buildWorkflowTransitionEvents(
      [transition({ fromNodeKey: "node_finance", toNodeKey: "node_legal", actorUserId: "finance-user" })],
      NODE_DISPLAY,
      ACTOR_LABELS,
      "line item is now Live"
      // isRequestFinalized omitted: the request has not actually reached status=approved yet.
    )
    expect(events).toHaveLength(1)
    expect(events[0].summary).toBe("Finance Approval approved")
    expect(events[0].summary).not.toContain("line item is now Live")
  })

  it("orders events chronologically regardless of input order", () => {
    const events = buildWorkflowTransitionEvents(
      [
        transition({ fromNodeKey: "node_legal", occurredAt: "2026-09-16T11:00:00.000Z", actorUserId: "legal-user" }),
        transition({ fromNodeKey: "node_finance", occurredAt: "2026-09-16T10:00:00.000Z", actorUserId: "finance-user" }),
      ],
      NODE_DISPLAY,
      ACTOR_LABELS
    )
    expect(events.map((event) => event.actorEmail)).toEqual(["Ananya Rao", "Vikram Shah"])
  })

  it("shows no cycle markers at all for a request approved in a single cycle (no clutter for the common case)", () => {
    const events = buildWorkflowTransitionEvents(
      [transition({ cycleNumber: 1 }), transition({ fromNodeKey: "node_legal", cycleNumber: 1, occurredAt: "2026-09-16T11:00:00.000Z" })],
      NODE_DISPLAY,
      ACTOR_LABELS
    )
    expect(events.every((event) => event.variant !== "marker")).toBe(true)
  })

  it("groups a Send Back restart into distinct, human-readable 'Approval cycle N' markers, never a raw cycle number alone in the primary summary", () => {
    const events = buildWorkflowTransitionEvents(
      [
        transition({ cycleNumber: 1, occurredAt: "2026-09-16T09:00:00.000Z" }),
        transition({ action: "send_back", fromNodeKey: "node_legal", toNodeKey: null, cycleNumber: 1, actorUserId: "legal-user", occurredAt: "2026-09-16T09:30:00.000Z" }),
        transition({ cycleNumber: 2, occurredAt: "2026-09-16T10:00:00.000Z" }),
        transition({ fromNodeKey: "node_legal", cycleNumber: 2, actorUserId: "legal-user", occurredAt: "2026-09-16T10:30:00.000Z" }),
        transition({ fromNodeKey: "node_leadership", toNodeKey: "node_end", cycleNumber: 2, actorUserId: "leadership-user", occurredAt: "2026-09-16T11:00:00.000Z" }),
      ],
      NODE_DISPLAY,
      ACTOR_LABELS
    )
    const markers = events.filter((event) => event.variant === "marker")
    expect(markers.map((marker) => marker.summary)).toEqual(["Approval cycle 1", "Approval cycle 2"])
    // Cycle 1: Finance approved, Legal sent back. Cycle 2: Finance approved, Legal approved, Leadership approved.
    expect(events.filter((event) => event.variant !== "marker")).toHaveLength(5)
  })
})
