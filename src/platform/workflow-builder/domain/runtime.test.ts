import { describe, expect, it } from "vitest"

import { resolveApprovalStep, DEFAULT_APPROVAL_STEP } from "./runtime"
import type { WorkflowNode } from "./types"

function node(overrides: Partial<WorkflowNode>): WorkflowNode {
  return {
    id: "node-row-1",
    workflowVersionId: "ver-1",
    nodeKey: "node_1",
    nodeType: "form_step",
    name: "Step",
    responsibleTeamId: null,
    requiredResource: null,
    requiredAction: null,
    config: {},
    positionX: 0,
    positionY: 0,
    ...overrides,
  }
}

describe("resolveApprovalStep", () => {
  it("falls back to the default when there are no nodes at all", () => {
    expect(resolveApprovalStep([])).toEqual(DEFAULT_APPROVAL_STEP)
  })

  it("falls back to the default when no node is an approval node", () => {
    const nodes = [node({ nodeType: "start", nodeKey: "node_1" }), node({ nodeType: "end", nodeKey: "node_2" })]
    expect(resolveApprovalStep(nodes)).toEqual(DEFAULT_APPROVAL_STEP)
  })

  it("resolves the approval node's own required resource/action/team", () => {
    const nodes = [
      node({ nodeType: "start", nodeKey: "node_1" }),
      node({ nodeType: "approval", nodeKey: "node_2", requiredResource: "go_live", requiredAction: "approve", responsibleTeamId: "team-finance" }),
    ]
    expect(resolveApprovalStep(nodes)).toEqual({ resource: "go_live", action: "approve", responsibleTeamId: "team-finance" })
  })

  it("falls back to the default when the approval node is missing required resource/action", () => {
    const nodes = [node({ nodeType: "approval", nodeKey: "node_1", requiredResource: null, requiredAction: null })]
    expect(resolveApprovalStep(nodes)).toEqual(DEFAULT_APPROVAL_STEP)
  })

  it("picks the first approval node by nodeKey when more than one exists, deterministically", () => {
    const nodes = [
      node({ nodeType: "approval", nodeKey: "node_9", requiredResource: "go_live", requiredAction: "approve", responsibleTeamId: "team-b" }),
      node({ nodeType: "approval", nodeKey: "node_2", requiredResource: "go_live", requiredAction: "approve", responsibleTeamId: "team-a" }),
    ]
    expect(resolveApprovalStep(nodes).responsibleTeamId).toBe("team-a")
  })
})
