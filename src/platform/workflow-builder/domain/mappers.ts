import type { WorkflowDefinitionRow, WorkflowVersionRow, WorkflowNodeRow, WorkflowEdgeRow } from "../data/workflow-builder.data"
import type {
  WorkflowDefinition,
  WorkflowDefinitionVersion,
  WorkflowNode,
  WorkflowEdge,
  WorkflowAppliesTo,
  WorkflowNodeType,
  WorkflowVersionStatus,
  WorkflowNodeConfig,
} from "./types"
import type { WorkflowCondition } from "@/platform/workflow/domain/types"

/** Pure row -> domain mappers, no I/O, safe to unit test directly. */

function toWorkflowDefinition(row: WorkflowDefinitionRow): WorkflowDefinition {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    appliesTo: row.applies_to as WorkflowAppliesTo,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  }
}

function toWorkflowDefinitionVersion(row: WorkflowVersionRow): WorkflowDefinitionVersion {
  return {
    id: row.id,
    workflowDefinitionId: row.workflow_definition_id,
    versionNumber: row.version_number,
    status: row.status as WorkflowVersionStatus,
    publishedAt: row.published_at,
    publishedBy: row.published_by,
    rowVersion: row.row_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  }
}

function toWorkflowNode(row: WorkflowNodeRow): WorkflowNode {
  return {
    id: row.id,
    workflowVersionId: row.workflow_version_id,
    nodeKey: row.node_key,
    nodeType: row.node_type as WorkflowNodeType,
    name: row.name,
    responsibleTeamId: row.responsible_team_id,
    requiredResource: row.required_resource,
    requiredAction: row.required_action,
    config: (row.config ?? {}) as WorkflowNodeConfig,
    positionX: row.position_x,
    positionY: row.position_y,
  }
}

function toWorkflowEdge(row: WorkflowEdgeRow): WorkflowEdge {
  return {
    id: row.id,
    workflowVersionId: row.workflow_version_id,
    fromNodeKey: row.from_node_key,
    toNodeKey: row.to_node_key,
    label: row.label,
    condition: (row.condition ?? null) as WorkflowCondition | null,
  }
}

export { toWorkflowDefinition, toWorkflowDefinitionVersion, toWorkflowNode, toWorkflowEdge }
