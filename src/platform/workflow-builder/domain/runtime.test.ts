import { describe, expect, it } from "vitest"

import { resolveApprovalStep, resolveWorkflowApprovalStep, DEFAULT_APPROVAL_STEP } from "./runtime"
import type { WorkflowNode, WorkflowEdge } from "./types"

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

function edge(overrides: Partial<WorkflowEdge> & Pick<WorkflowEdge, "fromNodeKey" | "toNodeKey">): WorkflowEdge {
  return {
    id: `${overrides.fromNodeKey}->${overrides.toNodeKey}`,
    workflowVersionId: "ver-1",
    label: null,
    condition: null,
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

describe("resolveWorkflowApprovalStep (Workflow Runtime V1: real graph traversal, mirrors fn_resolve_workflow_responsible_team in SQL)", () => {
  it("returns null when there is no Start node", () => {
    const nodes = [node({ nodeType: "approval", nodeKey: "a" })]
    expect(resolveWorkflowApprovalStep(nodes, [])).toBeNull()
  })

  it("walks Start -> Approval directly (no Decision node)", () => {
    const nodes = [
      node({ nodeType: "start", nodeKey: "start" }),
      node({ nodeType: "approval", nodeKey: "approve", requiredResource: "go_live", requiredAction: "approve", responsibleTeamId: "team-finance" }),
      node({ nodeType: "end", nodeKey: "end" }),
    ]
    const edges = [edge({ fromNodeKey: "start", toNodeKey: "approve" }), edge({ fromNodeKey: "approve", toNodeKey: "end" })]
    expect(resolveWorkflowApprovalStep(nodes, edges)).toEqual({ resource: "go_live", action: "approve", responsibleTeamId: "team-finance" })
  })

  it("returns null when Start leads straight to End with no Approval node", () => {
    const nodes = [node({ nodeType: "start", nodeKey: "start" }), node({ nodeType: "end", nodeKey: "end" })]
    const edges = [edge({ fromNodeKey: "start", toNodeKey: "end" })]
    expect(resolveWorkflowApprovalStep(nodes, edges)).toBeNull()
  })

  it("follows the matching Decision branch by equals", () => {
    const nodes = [
      node({ nodeType: "start", nodeKey: "start" }),
      node({ nodeType: "decision", nodeKey: "decide" }),
      node({ nodeType: "approval", nodeKey: "approve_enterprise", requiredResource: "commercial_configuration", requiredAction: "approve", responsibleTeamId: "team-enterprise" }),
      node({ nodeType: "approval", nodeKey: "approve_sme", requiredResource: "commercial_configuration", requiredAction: "approve", responsibleTeamId: "team-sme" }),
      node({ nodeType: "end", nodeKey: "end" }),
    ]
    const edges = [
      edge({ fromNodeKey: "start", toNodeKey: "decide" }),
      edge({ fromNodeKey: "decide", toNodeKey: "approve_enterprise", condition: { field: "segment", operator: "equals", value: "enterprise" } }),
      edge({ fromNodeKey: "decide", toNodeKey: "approve_sme", condition: null }),
      edge({ fromNodeKey: "approve_enterprise", toNodeKey: "end" }),
      edge({ fromNodeKey: "approve_sme", toNodeKey: "end" }),
    ]
    expect(resolveWorkflowApprovalStep(nodes, edges, { segment: "enterprise" })?.responsibleTeamId).toBe("team-enterprise")
    expect(resolveWorkflowApprovalStep(nodes, edges, { segment: "sme" })?.responsibleTeamId).toBe("team-sme")
    expect(resolveWorkflowApprovalStep(nodes, edges, {})?.responsibleTeamId).toBe("team-sme")
  })

  it("follows the matching Decision branch by not_equals", () => {
    const nodes = [
      node({ nodeType: "start", nodeKey: "start" }),
      node({ nodeType: "decision", nodeKey: "decide" }),
      node({ nodeType: "approval", nodeKey: "approve_not_enterprise", requiredResource: "commercial_configuration", requiredAction: "approve", responsibleTeamId: "team-general" }),
      node({ nodeType: "approval", nodeKey: "approve_enterprise", requiredResource: "commercial_configuration", requiredAction: "approve", responsibleTeamId: "team-enterprise" }),
    ]
    const edges = [
      edge({ fromNodeKey: "start", toNodeKey: "decide" }),
      edge({ fromNodeKey: "decide", toNodeKey: "approve_not_enterprise", condition: { field: "segment", operator: "not_equals", value: "enterprise" } }),
      edge({ fromNodeKey: "decide", toNodeKey: "approve_enterprise", condition: null }),
    ]
    expect(resolveWorkflowApprovalStep(nodes, edges, { segment: "sme" })?.responsibleTeamId).toBe("team-general")
    expect(resolveWorkflowApprovalStep(nodes, edges, { segment: "enterprise" })?.responsibleTeamId).toBe("team-enterprise")
  })

  it("returns null when a Decision node has no matching branch and no default", () => {
    const nodes = [
      node({ nodeType: "start", nodeKey: "start" }),
      node({ nodeType: "decision", nodeKey: "decide" }),
      node({ nodeType: "approval", nodeKey: "approve_enterprise", requiredResource: "commercial_configuration", requiredAction: "approve" }),
    ]
    const edges = [
      edge({ fromNodeKey: "start", toNodeKey: "decide" }),
      edge({ fromNodeKey: "decide", toNodeKey: "approve_enterprise", condition: { field: "segment", operator: "equals", value: "enterprise" } }),
    ]
    expect(resolveWorkflowApprovalStep(nodes, edges, { segment: "sme" })).toBeNull()
  })

  it("returns null for an Approval node missing required resource/action, even if reached", () => {
    const nodes = [node({ nodeType: "start", nodeKey: "start" }), node({ nodeType: "approval", nodeKey: "approve" })]
    const edges = [edge({ fromNodeKey: "start", toNodeKey: "approve" })]
    expect(resolveWorkflowApprovalStep(nodes, edges)).toBeNull()
  })
})
