import { describe, expect, it } from "vitest"

import { validateWorkflowGraph } from "./validation"
import type { WorkflowNodeDraft, WorkflowEdgeDraft } from "./types"

function node(overrides: Partial<WorkflowNodeDraft> & Pick<WorkflowNodeDraft, "nodeKey" | "nodeType">): WorkflowNodeDraft {
  return {
    name: overrides.nodeKey,
    responsibleTeamId: null,
    requiredResource: null,
    requiredAction: null,
    config: {},
    positionX: 0,
    positionY: 0,
    ...overrides,
  }
}

const NO_CONTEXT = { validTeamIds: new Set<string>(), validPermissions: new Set<string>() }

describe("validateWorkflowGraph", () => {
  it("accepts a minimal valid graph: Start -> Approval -> End", () => {
    const nodes: WorkflowNodeDraft[] = [
      node({ nodeKey: "start", nodeType: "start" }),
      node({ nodeKey: "approve", nodeType: "approval" }),
      node({ nodeKey: "end", nodeType: "end" }),
    ]
    const edges: WorkflowEdgeDraft[] = [
      { fromNodeKey: "start", toNodeKey: "approve", label: null, condition: null },
      { fromNodeKey: "approve", toNodeKey: "end", label: "Approve", condition: null },
    ]
    expect(validateWorkflowGraph(nodes, edges, NO_CONTEXT)).toEqual({ valid: true })
  })

  it("rejects zero or multiple start nodes", () => {
    const noStart = validateWorkflowGraph([node({ nodeKey: "end", nodeType: "end" })], [], NO_CONTEXT)
    expect(noStart.valid).toBe(false)
    if (!noStart.valid) expect(noStart.errors.some((error) => error.includes("Exactly one Start"))).toBe(true)

    const twoStarts = validateWorkflowGraph(
      [node({ nodeKey: "start1", nodeType: "start" }), node({ nodeKey: "start2", nodeType: "start" }), node({ nodeKey: "end", nodeType: "end" })],
      [],
      NO_CONTEXT
    )
    expect(twoStarts.valid).toBe(false)
  })

  it("rejects a graph with no End node", () => {
    const result = validateWorkflowGraph(
      [node({ nodeKey: "start", nodeType: "start" }), node({ nodeKey: "approve", nodeType: "approval" })],
      [{ fromNodeKey: "start", toNodeKey: "approve", label: null, condition: null }],
      NO_CONTEXT
    )
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.errors.some((error) => error.includes("At least one End"))).toBe(true)
  })

  it("rejects a disconnected node with no incoming transition", () => {
    const result = validateWorkflowGraph(
      [node({ nodeKey: "start", nodeType: "start" }), node({ nodeKey: "end", nodeType: "end" }), node({ nodeKey: "orphan", nodeType: "approval" })],
      [{ fromNodeKey: "start", toNodeKey: "end", label: null, condition: null }],
      NO_CONTEXT
    )
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.errors.some((error) => error.includes("disconnected"))).toBe(true)
  })

  it("rejects a dead-end node that is not an End node", () => {
    const result = validateWorkflowGraph(
      [node({ nodeKey: "start", nodeType: "start" }), node({ nodeKey: "approve", nodeType: "approval" }), node({ nodeKey: "end", nodeType: "end" })],
      [{ fromNodeKey: "start", toNodeKey: "approve", label: null, condition: null }],
      NO_CONTEXT
    )
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.errors.some((error) => error.includes("dead end"))).toBe(true)
  })

  it("rejects an End node that has an outgoing transition (Batch 1, K-025)", () => {
    const result = validateWorkflowGraph(
      [node({ nodeKey: "start", nodeType: "start" }), node({ nodeKey: "approve", nodeType: "approval" }), node({ nodeKey: "end", nodeType: "end" })],
      [
        { fromNodeKey: "start", toNodeKey: "approve", label: null, condition: null },
        { fromNodeKey: "approve", toNodeKey: "end", label: null, condition: null },
        { fromNodeKey: "end", toNodeKey: "approve", label: null, condition: null },
      ],
      NO_CONTEXT
    )
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.errors.some((error) => error.includes("terminal"))).toBe(true)
  })

  it("rejects a Start node that has an incoming transition (Batch 2, K-026)", () => {
    const result = validateWorkflowGraph(
      [node({ nodeKey: "start", nodeType: "start" }), node({ nodeKey: "approve", nodeType: "approval" }), node({ nodeKey: "end", nodeType: "end" })],
      [
        { fromNodeKey: "start", toNodeKey: "approve", label: null, condition: null },
        { fromNodeKey: "approve", toNodeKey: "end", label: null, condition: null },
        { fromNodeKey: "approve", toNodeKey: "start", label: null, condition: null },
      ],
      NO_CONTEXT
    )
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.errors.some((error) => error.includes("entry point"))).toBe(true)
  })

  it("rejects a node unreachable from Start even if it has some incoming edge from another unreachable node", () => {
    const result = validateWorkflowGraph(
      [
        node({ nodeKey: "start", nodeType: "start" }),
        node({ nodeKey: "end", nodeType: "end" }),
        node({ nodeKey: "island_a", nodeType: "approval" }),
        node({ nodeKey: "island_b", nodeType: "approval" }),
      ],
      [
        { fromNodeKey: "start", toNodeKey: "end", label: null, condition: null },
        { fromNodeKey: "island_a", toNodeKey: "island_b", label: null, condition: null },
        { fromNodeKey: "island_b", toNodeKey: "island_a", label: null, condition: null },
      ],
      NO_CONTEXT
    )
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.errors.some((error) => error.includes("unreachable"))).toBe(true)
  })

  it("rejects a node referencing a team that does not exist", () => {
    const result = validateWorkflowGraph(
      [
        node({ nodeKey: "start", nodeType: "start" }),
        node({ nodeKey: "approve", nodeType: "approval", responsibleTeamId: "missing-team" }),
        node({ nodeKey: "end", nodeType: "end" }),
      ],
      [
        { fromNodeKey: "start", toNodeKey: "approve", label: null, condition: null },
        { fromNodeKey: "approve", toNodeKey: "end", label: null, condition: null },
      ],
      NO_CONTEXT
    )
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.errors.some((error) => error.includes("team"))).toBe(true)
  })

  it("accepts a node referencing a team that does exist", () => {
    const result = validateWorkflowGraph(
      [
        node({ nodeKey: "start", nodeType: "start" }),
        node({ nodeKey: "approve", nodeType: "approval", responsibleTeamId: "team-1" }),
        node({ nodeKey: "end", nodeType: "end" }),
      ],
      [
        { fromNodeKey: "start", toNodeKey: "approve", label: null, condition: null },
        { fromNodeKey: "approve", toNodeKey: "end", label: null, condition: null },
      ],
      { validTeamIds: new Set(["team-1"]), validPermissions: new Set() }
    )
    expect(result.valid).toBe(true)
  })

  it("rejects a node referencing a permission that does not exist", () => {
    const result = validateWorkflowGraph(
      [
        node({ nodeKey: "start", nodeType: "start" }),
        node({ nodeKey: "approve", nodeType: "approval", requiredResource: "customer", requiredAction: "approve" }),
        node({ nodeKey: "end", nodeType: "end" }),
      ],
      [
        { fromNodeKey: "start", toNodeKey: "approve", label: null, condition: null },
        { fromNodeKey: "approve", toNodeKey: "end", label: null, condition: null },
      ],
      NO_CONTEXT
    )
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.errors.some((error) => error.includes("permission"))).toBe(true)
  })

  it("rejects a node with only one of resource/action set", () => {
    const result = validateWorkflowGraph(
      [node({ nodeKey: "start", nodeType: "start", requiredResource: "customer" }), node({ nodeKey: "end", nodeType: "end" })],
      [{ fromNodeKey: "start", toNodeKey: "end", label: null, condition: null }],
      NO_CONTEXT
    )
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.errors.some((error) => error.includes("incomplete"))).toBe(true)
  })

  it("rejects duplicate node keys", () => {
    const result = validateWorkflowGraph(
      [node({ nodeKey: "start", nodeType: "start" }), node({ nodeKey: "start", nodeType: "end" })],
      [],
      NO_CONTEXT
    )
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.errors.some((error) => error.includes("Duplicate"))).toBe(true)
  })

  it("rejects an edge referencing a node key that does not exist", () => {
    const result = validateWorkflowGraph(
      [node({ nodeKey: "start", nodeType: "start" }), node({ nodeKey: "end", nodeType: "end" })],
      [{ fromNodeKey: "start", toNodeKey: "ghost", label: null, condition: null }],
      NO_CONTEXT
    )
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.errors.some((error) => error.includes("does not exist"))).toBe(true)
  })
})

describe("validateWorkflowGraph: Decision node branches (Workflow Runtime V1)", () => {
  function decisionGraph(edgesFromDecision: WorkflowEdgeDraft[]): { nodes: WorkflowNodeDraft[]; edges: WorkflowEdgeDraft[] } {
    return {
      nodes: [
        node({ nodeKey: "start", nodeType: "start" }),
        node({ nodeKey: "decide", nodeType: "decision" }),
        node({ nodeKey: "approve_a", nodeType: "approval" }),
        node({ nodeKey: "approve_b", nodeType: "approval" }),
        node({ nodeKey: "end", nodeType: "end" }),
      ],
      edges: [
        { fromNodeKey: "start", toNodeKey: "decide", label: null, condition: null },
        ...edgesFromDecision,
        { fromNodeKey: "approve_a", toNodeKey: "end", label: null, condition: null },
        { fromNodeKey: "approve_b", toNodeKey: "end", label: null, condition: null },
      ],
    }
  }

  it("accepts a Decision node with one conditioned branch and one default branch", () => {
    const { nodes, edges } = decisionGraph([
      { fromNodeKey: "decide", toNodeKey: "approve_a", label: null, condition: { field: "segment", operator: "equals", value: "enterprise" } },
      { fromNodeKey: "decide", toNodeKey: "approve_b", label: "Default", condition: null },
    ])
    expect(validateWorkflowGraph(nodes, edges, NO_CONTEXT)).toEqual({ valid: true })
  })

  it("rejects a Decision node with fewer than two outgoing branches", () => {
    const { nodes, edges } = decisionGraph([{ fromNodeKey: "decide", toNodeKey: "approve_a", label: null, condition: null }])
    // approve_b is now unreachable/disconnected in this shape; drop it to isolate the "too few branches" error.
    const trimmedNodes = nodes.filter((n) => n.nodeKey !== "approve_b")
    const trimmedEdges = edges.filter((e) => e.fromNodeKey !== "approve_b" && e.toNodeKey !== "approve_b")
    const result = validateWorkflowGraph(trimmedNodes, trimmedEdges, NO_CONTEXT)
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.errors.some((error) => error.includes("at least two outgoing branches"))).toBe(true)
  })

  it("rejects a Decision node with two default (unconditioned) branches", () => {
    const { nodes, edges } = decisionGraph([
      { fromNodeKey: "decide", toNodeKey: "approve_a", label: null, condition: null },
      { fromNodeKey: "decide", toNodeKey: "approve_b", label: null, condition: null },
    ])
    const result = validateWorkflowGraph(nodes, edges, NO_CONTEXT)
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.errors.some((error) => error.includes("more than one default"))).toBe(true)
  })

  it("rejects a Decision branch with an unsupported operator", () => {
    const { nodes, edges } = decisionGraph([
      { fromNodeKey: "decide", toNodeKey: "approve_a", label: null, condition: { field: "segment", operator: "changed", value: "enterprise" } },
      { fromNodeKey: "decide", toNodeKey: "approve_b", label: null, condition: null },
    ])
    const result = validateWorkflowGraph(nodes, edges, NO_CONTEXT)
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.errors.some((error) => error.includes("unsupported operator"))).toBe(true)
  })

  it("rejects a Decision branch with an empty field", () => {
    const { nodes, edges } = decisionGraph([
      { fromNodeKey: "decide", toNodeKey: "approve_a", label: null, condition: { field: "", operator: "equals", value: "enterprise" } },
      { fromNodeKey: "decide", toNodeKey: "approve_b", label: null, condition: null },
    ])
    const result = validateWorkflowGraph(nodes, edges, NO_CONTEXT)
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.errors.some((error) => error.includes("no field set"))).toBe(true)
  })
})
