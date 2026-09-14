import { describe, expect, it } from "vitest"

import { toWorkflowDefinition, toWorkflowDefinitionVersion, toWorkflowNode, toWorkflowEdge } from "./mappers"
import type { WorkflowDefinitionRow, WorkflowVersionRow, WorkflowNodeRow, WorkflowEdgeRow } from "../data/workflow-builder.data"

describe("toWorkflowDefinition", () => {
  it("maps every snake_case row column to its camelCase domain field", () => {
    const row: WorkflowDefinitionRow = {
      id: "def-1",
      code: "customer_onboarding_v1",
      name: "Customer Onboarding Approval",
      applies_to: "customer_onboarding",
      is_active: true,
      created_at: "2026-09-16T00:00:00.000Z",
      updated_at: "2026-09-16T01:00:00.000Z",
      updated_by: "user-1",
    }

    expect(toWorkflowDefinition(row)).toEqual({
      id: "def-1",
      code: "customer_onboarding_v1",
      name: "Customer Onboarding Approval",
      appliesTo: "customer_onboarding",
      isActive: true,
      createdAt: "2026-09-16T00:00:00.000Z",
      updatedAt: "2026-09-16T01:00:00.000Z",
      updatedBy: "user-1",
    })
  })
})

describe("toWorkflowDefinitionVersion", () => {
  it("maps a draft version, preserving null publishedAt/publishedBy", () => {
    const row: WorkflowVersionRow = {
      id: "ver-1",
      workflow_definition_id: "def-1",
      version_number: 1,
      status: "draft",
      published_at: null,
      published_by: null,
      created_at: "2026-09-16T00:00:00.000Z",
      updated_at: "2026-09-16T00:00:00.000Z",
      updated_by: "user-1",
    }

    expect(toWorkflowDefinitionVersion(row)).toEqual({
      id: "ver-1",
      workflowDefinitionId: "def-1",
      versionNumber: 1,
      status: "draft",
      publishedAt: null,
      publishedBy: null,
      createdAt: "2026-09-16T00:00:00.000Z",
      updatedAt: "2026-09-16T00:00:00.000Z",
      updatedBy: "user-1",
    })
  })

  it("maps a published version's publishedAt/publishedBy through", () => {
    const row: WorkflowVersionRow = {
      id: "ver-1",
      workflow_definition_id: "def-1",
      version_number: 2,
      status: "published",
      published_at: "2026-09-16T02:00:00.000Z",
      published_by: "user-2",
      created_at: "2026-09-16T00:00:00.000Z",
      updated_at: "2026-09-16T02:00:00.000Z",
      updated_by: "user-2",
    }

    const mapped = toWorkflowDefinitionVersion(row)
    expect(mapped.status).toBe("published")
    expect(mapped.publishedAt).toBe("2026-09-16T02:00:00.000Z")
    expect(mapped.publishedBy).toBe("user-2")
  })
})

describe("toWorkflowNode", () => {
  it("maps a fully-populated node row", () => {
    const row: WorkflowNodeRow = {
      id: "node-1",
      workflow_version_id: "ver-1",
      node_key: "node_1",
      node_type: "approval",
      name: "Finance Approval",
      responsible_team_id: "team-1",
      required_resource: "customer",
      required_action: "approve",
      config: { requiredFields: ["gst_number"] },
      position_x: 100,
      position_y: 200,
    }

    expect(toWorkflowNode(row)).toEqual({
      id: "node-1",
      workflowVersionId: "ver-1",
      nodeKey: "node_1",
      nodeType: "approval",
      name: "Finance Approval",
      responsibleTeamId: "team-1",
      requiredResource: "customer",
      requiredAction: "approve",
      config: { requiredFields: ["gst_number"] },
      positionX: 100,
      positionY: 200,
    })
  })

  it("defaults a null config to an empty object rather than passing null through", () => {
    const row: WorkflowNodeRow = {
      id: "node-1",
      workflow_version_id: "ver-1",
      node_key: "node_1",
      node_type: "start",
      name: "Start",
      responsible_team_id: null,
      required_resource: null,
      required_action: null,
      config: null as unknown as Record<string, unknown>,
      position_x: 0,
      position_y: 0,
    }

    expect(toWorkflowNode(row).config).toEqual({})
  })
})

describe("toWorkflowEdge", () => {
  it("maps an edge with a label and condition", () => {
    const row: WorkflowEdgeRow = {
      id: "edge-1",
      workflow_version_id: "ver-1",
      from_node_key: "node_1",
      to_node_key: "node_2",
      label: "Approve",
      condition: { field: "amount", operator: "gt", value: 1000 },
    }

    expect(toWorkflowEdge(row)).toEqual({
      id: "edge-1",
      workflowVersionId: "ver-1",
      fromNodeKey: "node_1",
      toNodeKey: "node_2",
      label: "Approve",
      condition: { field: "amount", operator: "gt", value: 1000 },
    })
  })

  it("preserves a null label and null condition for an unconditional, unlabeled transition", () => {
    const row: WorkflowEdgeRow = {
      id: "edge-1",
      workflow_version_id: "ver-1",
      from_node_key: "node_1",
      to_node_key: "node_2",
      label: null,
      condition: null,
    }

    const mapped = toWorkflowEdge(row)
    expect(mapped.label).toBeNull()
    expect(mapped.condition).toBeNull()
  })
})
