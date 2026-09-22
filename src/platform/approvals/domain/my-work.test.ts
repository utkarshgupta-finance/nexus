import { describe, expect, it } from "vitest"

import { buildMyWorkItems, buildDraftWorkItems } from "./my-work"
import type { ApprovalInboxItem } from "./types"
import type { CanApproveByType } from "./my-work"

const NOW = new Date("2026-01-10T00:00:00.000Z")

const NO_TEAMS = new Set<string>()

function approveNone(): CanApproveByType {
  return { onboarding: false, change_request: false, commercial_version: false, go_live: false }
}

function approveAll(): CanApproveByType {
  return { onboarding: true, change_request: true, commercial_version: true, go_live: true }
}

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
    expect(buildMyWorkItems(items, "actor-requester", approveNone(), NO_TEAMS, NOW)).toHaveLength(1)
    expect(buildMyWorkItems(items, "someone-else", approveNone(), NO_TEAMS, NOW)).toHaveLength(0)
  })

  it("excludes a completed or draft-origin item entirely, regardless of who created it", () => {
    const items = [item({ bucket: "completed", status: "approved" })]
    expect(buildMyWorkItems(items, "actor-requester", approveAll(), NO_TEAMS, NOW)).toHaveLength(0)
  })

  it("includes a needs_action item with no responsible team once the user holds the approve permission (no workflow bound, or a graph with no Approval node routing)", () => {
    const items = [
      item({ requestId: "req-2", bucket: "needs_action", status: "submitted", createdBy: "someone-else", responsibleTeamId: null }),
    ]
    expect(buildMyWorkItems(items, "actor-approver", approveNone(), NO_TEAMS, NOW)).toHaveLength(0)
    const withApprove = buildMyWorkItems(items, "actor-approver", approveAll(), NO_TEAMS, NOW)
    expect(withApprove).toHaveLength(1)
    expect(withApprove[0].reason).toBe("pending_my_approval")
  })

  it("Workflow Runtime V1 Sequential Execution: excludes a needs_action item from pending_my_approval when the user holds the approve permission but is not a member of the item's current responsible team", () => {
    const items = [item({ bucket: "needs_action", status: "submitted", createdBy: "someone-else", responsibleTeamId: "team-legal" })]
    const result = buildMyWorkItems(items, "actor-finance-approver", approveAll(), new Set(["team-finance"]), NOW)
    expect(result).toHaveLength(0)
  })

  it("includes a needs_action item as pending_my_approval when the user is an active member of the item's current responsible team", () => {
    const items = [item({ bucket: "needs_action", status: "submitted", createdBy: "someone-else", responsibleTeamId: "team-legal" })]
    const result = buildMyWorkItems(items, "actor-legal-approver", approveAll(), new Set(["team-legal"]), NOW)
    expect(result).toHaveLength(1)
    expect(result[0].reason).toBe("pending_my_approval")
  })

  it("shows a requester their own submitted item as waiting_on_others when they cannot decide it themselves", () => {
    const items = [item({ bucket: "needs_action", status: "submitted", createdBy: "actor-requester" })]
    const result = buildMyWorkItems(items, "actor-requester", approveNone(), NO_TEAMS, NOW)
    expect(result).toHaveLength(1)
    expect(result[0].reason).toBe("waiting_on_others")
  })

  it("shows a requester their own submitted item as waiting_on_others when it is sitting at a node their team does not cover, even though they hold the approve permission", () => {
    const items = [item({ bucket: "needs_action", status: "submitted", createdBy: "actor-requester", responsibleTeamId: "team-legal" })]
    const result = buildMyWorkItems(items, "actor-requester", approveAll(), new Set(["team-finance"]), NOW)
    expect(result).toHaveLength(1)
    expect(result[0].reason).toBe("waiting_on_others")
  })

  it("M-011 (Pre-Batch-21 closure): never classifies a self-created item as pending_my_approval, even when the requester otherwise holds the permission and covers the responsible team, since self-approval is blocked server-side", () => {
    const items = [item({ bucket: "needs_action", status: "submitted", createdBy: "actor-requester", responsibleTeamId: "team-finance" })]
    const result = buildMyWorkItems(items, "actor-requester", approveAll(), new Set(["team-finance"]), NOW)
    expect(result).toHaveLength(1)
    expect(result[0].reason).toBe("waiting_on_others")
  })

  it("M-011: the same item shows as pending_my_approval for a different, non-creator eligible approver", () => {
    const items = [item({ bucket: "needs_action", status: "submitted", createdBy: "actor-requester", responsibleTeamId: "team-finance" })]
    const result = buildMyWorkItems(items, "actor-finance-approver", approveAll(), new Set(["team-finance"]), NOW)
    expect(result).toHaveLength(1)
    expect(result[0].reason).toBe("pending_my_approval")
  })

  it("M-011: a self-created item with no responsible team restriction also falls to waiting_on_others, not pending_my_approval", () => {
    const items = [item({ bucket: "needs_action", status: "submitted", createdBy: "actor-requester" })]
    const result = buildMyWorkItems(items, "actor-requester", approveAll(), NO_TEAMS, NOW)
    expect(result[0].reason).toBe("waiting_on_others")
  })

  it("M-021 fix (pre-Batch-22): a needs_action onboarding item is not pending_my_approval for a viewer who only holds a DIFFERENT domain's approve permission, even when coincidentally on the responsible team", () => {
    const items = [item({ type: "onboarding", bucket: "needs_action", status: "submitted", createdBy: "someone-else", responsibleTeamId: "team-finance" })]
    const onlyApprovesGoLive: CanApproveByType = { onboarding: false, change_request: false, commercial_version: false, go_live: true }
    const result = buildMyWorkItems(items, "actor-finance-member-wrong-permission", onlyApprovesGoLive, new Set(["team-finance"]), NOW)
    expect(result).toHaveLength(0)
  })

  it("M-021 fix: the same onboarding item IS pending_my_approval for a viewer who holds the onboarding domain's own approve permission (customer) and covers the team", () => {
    const items = [item({ type: "onboarding", bucket: "needs_action", status: "submitted", createdBy: "someone-else", responsibleTeamId: "team-finance" })]
    const onlyApprovesCustomer: CanApproveByType = { onboarding: true, change_request: true, commercial_version: false, go_live: false }
    const result = buildMyWorkItems(items, "actor-finance-member-right-permission", onlyApprovesCustomer, new Set(["team-finance"]), NOW)
    expect(result).toHaveLength(1)
    expect(result[0].reason).toBe("pending_my_approval")
  })

  it("computes age in whole days from updatedAt", () => {
    const items = [item({ updatedAt: "2026-01-08T00:00:00.000Z" })]
    const result = buildMyWorkItems(items, "actor-requester", approveNone(), NO_TEAMS, NOW)
    expect(result[0].ageDays).toBe(2)
  })

  it("sorts oldest (largest age) first", () => {
    const items = [
      item({ requestId: "req-a", updatedAt: "2026-01-09T00:00:00.000Z" }),
      item({ requestId: "req-b", updatedAt: "2026-01-05T00:00:00.000Z" }),
    ]
    const result = buildMyWorkItems(items, "actor-requester", approveNone(), NO_TEAMS, NOW)
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

describe("M-027: multi-domain aggregation, exact seeded counts, no cross-domain contamination", () => {
  it("merges a precisely-seeded portfolio (2 onboarding pending, 1 change sent-back, 3 commercial-version pending, 1 go-live waiting-on-others) into exactly the right buckets with no loss or duplication", () => {
    const VIEWER = "power-approver"
    const seeded: ApprovalInboxItem[] = [
      // 2 onboarding items pending my approval
      item({ type: "onboarding", requestId: "onb-1", displayId: "CO-000001", status: "submitted", bucket: "needs_action", createdBy: "other-requester", responsibleTeamId: "team-onb" }),
      item({ type: "onboarding", requestId: "onb-2", displayId: "CO-000002", status: "resubmitted", bucket: "needs_action", createdBy: "other-requester", responsibleTeamId: "team-onb" }),
      // 1 change request sent back to the viewer (viewer is the creator)
      item({ type: "change_request", requestId: "cr-1", displayId: "CCR-000001", status: "sent_back", bucket: "sent_back", createdBy: VIEWER }),
      // 3 commercial-version items pending my approval
      item({ type: "commercial_version", requestId: "cv-1", displayId: "CC-000001", status: "submitted", bucket: "needs_action", createdBy: "other-requester", responsibleTeamId: "team-cc" }),
      item({ type: "commercial_version", requestId: "cv-2", displayId: "CC-000002", status: "submitted", bucket: "needs_action", createdBy: "other-requester", responsibleTeamId: "team-cc" }),
      item({ type: "commercial_version", requestId: "cv-3", displayId: "CC-000003", status: "submitted", bucket: "needs_action", createdBy: "other-requester", responsibleTeamId: "team-cc" }),
      // 1 go-live item the viewer created but cannot decide (waiting on others)
      item({ type: "go_live", requestId: "gl-1", displayId: "GLR-000001", status: "submitted", bucket: "needs_action", createdBy: VIEWER, responsibleTeamId: "team-gl" }),
    ]
    const canApprove: CanApproveByType = { onboarding: true, change_request: true, commercial_version: true, go_live: false }
    const viewerTeams = new Set(["team-onb", "team-cc"])

    const result = buildMyWorkItems(seeded, VIEWER, canApprove, viewerTeams, NOW)

    const pending = result.filter((r) => r.reason === "pending_my_approval")
    const sentBack = result.filter((r) => r.reason === "sent_back_to_me")
    const waiting = result.filter((r) => r.reason === "waiting_on_others")

    expect(pending).toHaveLength(5)
    expect(sentBack).toHaveLength(1)
    expect(waiting).toHaveLength(1)
    expect(result).toHaveLength(7) // no loss, no duplication: exactly the 7 seeded items, each classified once

    expect(pending.map((r) => r.type).sort()).toEqual(["commercial_version", "commercial_version", "commercial_version", "onboarding", "onboarding"])
    expect(sentBack[0].requestId).toBe("cr-1")
    expect(waiting[0].requestId).toBe("gl-1")
  })
})

describe("M-028: empty-state data (rendering itself is a UI concern, tooling-blocked without a browser)", () => {
  it("returns a clean empty array, not an error or undefined, for a viewer with genuinely zero eligible items in every bucket", () => {
    const items = [
      item({ type: "onboarding", requestId: "o-1", bucket: "needs_action", status: "submitted", createdBy: "someone-else", responsibleTeamId: "team-x" }),
      item({ type: "go_live", requestId: "g-1", bucket: "completed", status: "approved", createdBy: "someone-else" }),
    ]
    const result = buildMyWorkItems(items, "brand-new-viewer", approveNone(), NO_TEAMS, NOW)
    expect(result).toEqual([])
    expect(Array.isArray(result)).toBe(true)
  })
})

describe("M-029: correctness holds at volume (PARTIAL automation feasibility per the journey's own definition)", () => {
  it("classifies 500 mixed-domain items with no drops, no duplicates, and the exact expected split", () => {
    const VOLUME = 500
    const viewerTeams = new Set(["team-broad"])
    const seeded: ApprovalInboxItem[] = Array.from({ length: VOLUME }, (_, i) => {
      const isEligible = i % 2 === 0
      return item({
        type: "onboarding",
        requestId: `vol-${i}`,
        displayId: `CO-${String(i).padStart(6, "0")}`,
        status: "submitted",
        bucket: "needs_action",
        createdBy: "someone-else",
        responsibleTeamId: isEligible ? "team-broad" : "team-other",
        updatedAt: new Date(NOW.getTime() - i * 1000).toISOString(),
      })
    })
    const result = buildMyWorkItems(seeded, "high-volume-approver", approveAll(), viewerTeams, NOW)
    expect(result).toHaveLength(VOLUME / 2)
    expect(new Set(result.map((r) => r.requestId)).size).toBe(VOLUME / 2) // no duplicates
    const ageDaysDescending = result.every((r, i) => i === 0 || result[i - 1].ageDays >= r.ageDays)
    expect(ageDaysDescending).toBe(true)
  })
})

describe("M-030: waiting-on-others survives a real before/after team-membership change (not just static code structure)", () => {
  it("stays waiting-on-others for the creator even after they gain the item's own responsible team (M-011 interaction, exercised not just cited)", () => {
    const CREATOR = "requestor-who-later-joins-the-team"
    const selfCreatedItem = item({
      type: "onboarding",
      requestId: "self-1",
      bucket: "needs_action",
      status: "submitted",
      createdBy: CREATOR,
      responsibleTeamId: "team-that-creator-later-joins",
    })
    const canApprove: CanApproveByType = { onboarding: true, change_request: true, commercial_version: true, go_live: true }

    // Before: creator has no team membership at all.
    const before = buildMyWorkItems([selfCreatedItem], CREATOR, canApprove, new Set(), NOW)
    expect(before).toHaveLength(1)
    expect(before[0].reason).toBe("waiting_on_others")

    // After: creator is added to the item's own responsible team (a real
    // mid-lifecycle team-membership change, not a hypothetical).
    const after = buildMyWorkItems([selfCreatedItem], CREATOR, canApprove, new Set(["team-that-creator-later-joins"]), NOW)
    expect(after).toHaveLength(1)
    expect(after[0].reason).toBe("waiting_on_others") // still not pending_my_approval: self-approval stays blocked (M-011)
  })
})
