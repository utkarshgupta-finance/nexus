import "server-only"

import * as workflowData from "../data/workflow-builder.data"
import { toWorkflowDefinition, toWorkflowDefinitionVersion, toWorkflowNode, toWorkflowEdge } from "../domain/mappers"
import { validateWorkflowGraph } from "../domain/validation"
import { listActiveTeams } from "@/platform/team/server"
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server-client"
import type { WorkflowDefinition, WorkflowDefinitionVersion, WorkflowNode, WorkflowEdge, WorkflowNodeDraft, WorkflowEdgeDraft, WorkflowAppliesTo } from "../domain/types"
import type { WorkflowGraphValidationResult } from "../domain/validation"

/**
 * Application service for the Workflow Builder module (task Phase N/O).
 * Thin orchestration over ../data/workflow-builder.data.ts, matching
 * every other service in this codebase, plus the one piece of real
 * business logic this module owns: resolving the current, real
 * team/permission catalog so the pure graph validator
 * (../domain/validation.ts) never has to read the database itself.
 */

async function listDefinitions(): Promise<WorkflowDefinition[]> {
  const rows = await workflowData.listDefinitions()
  return rows.map(toWorkflowDefinition)
}

async function getDefinition(id: string): Promise<WorkflowDefinition | null> {
  const row = await workflowData.getDefinition(id)
  return row ? toWorkflowDefinition(row) : null
}

async function listVersionsForDefinition(definitionId: string): Promise<WorkflowDefinitionVersion[]> {
  const rows = await workflowData.listVersionsForDefinition(definitionId)
  return rows.map(toWorkflowDefinitionVersion)
}

type WorkflowGraph = { version: WorkflowDefinitionVersion; nodes: WorkflowNode[]; edges: WorkflowEdge[] }

async function loadWorkflowGraph(versionId: string): Promise<WorkflowGraph | null> {
  const versionRow = await workflowData.getVersion(versionId)
  if (!versionRow) return null
  const [nodeRows, edgeRows] = await Promise.all([workflowData.listNodesForVersion(versionId), workflowData.listEdgesForVersion(versionId)])
  return {
    version: toWorkflowDefinitionVersion(versionRow),
    nodes: nodeRows.map(toWorkflowNode),
    edges: edgeRows.map(toWorkflowEdge),
  }
}

async function createDefinition(code: string, name: string, appliesTo: WorkflowAppliesTo, actorUserId: string): Promise<WorkflowDefinition> {
  const row = await workflowData.createDefinition(code, name, appliesTo, actorUserId)
  return toWorkflowDefinition(row)
}

async function createVersion(definitionId: string, actorUserId: string): Promise<WorkflowDefinitionVersion> {
  const row = await workflowData.createVersion(definitionId, actorUserId)
  return toWorkflowDefinitionVersion(row)
}

function toNodeRpcPayload(node: WorkflowNodeDraft): Record<string, unknown> {
  return {
    node_key: node.nodeKey,
    node_type: node.nodeType,
    name: node.name,
    responsible_team_id: node.responsibleTeamId,
    required_resource: node.requiredResource,
    required_action: node.requiredAction,
    config: node.config,
    position_x: node.positionX,
    position_y: node.positionY,
  }
}

function toEdgeRpcPayload(edge: WorkflowEdgeDraft): Record<string, unknown> {
  return { from_node_key: edge.fromNodeKey, to_node_key: edge.toNodeKey, label: edge.label, condition: edge.condition }
}

async function saveVersionGraph(
  versionId: string,
  nodes: WorkflowNodeDraft[],
  edges: WorkflowEdgeDraft[],
  expectedRowVersion: number,
  actorUserId: string
): Promise<WorkflowDefinitionVersion> {
  const row = await workflowData.saveVersionGraph(versionId, nodes.map(toNodeRpcPayload), edges.map(toEdgeRpcPayload), expectedRowVersion, actorUserId)
  return toWorkflowDefinitionVersion(row)
}

/** Real permission catalog resolution (task spec: "referenced teams/permissions exist"): reads directly from `permissions`, the same table `requirePermission` itself checks against, never a hardcoded list this module could drift from. */
async function listValidPermissionKeys(): Promise<Set<string>> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase.from("permissions").select("resource, action").eq("is_active", true)
  if (error) throw error
  return new Set((data ?? []).map((row) => `${row.resource}.${row.action}`))
}

/** Runs the full, authoritative graph validator (../domain/validation.ts) against this draft's current graph, resolving the real team/permission catalog first. Never mutates anything; a caller decides whether to proceed to `publishVersion` based on the result. */
async function validateVersionForPublish(versionId: string): Promise<WorkflowGraphValidationResult> {
  const graph = await loadWorkflowGraph(versionId)
  if (!graph) return { valid: false, errors: ["This workflow version could not be found."] }

  const [teams, validPermissions] = await Promise.all([listActiveTeams(), listValidPermissionKeys()])
  const validTeamIds = new Set(teams.map((team) => team.id))

  const nodeDrafts: WorkflowNodeDraft[] = graph.nodes.map((node) => ({
    nodeKey: node.nodeKey,
    nodeType: node.nodeType,
    name: node.name,
    responsibleTeamId: node.responsibleTeamId,
    requiredResource: node.requiredResource,
    requiredAction: node.requiredAction,
    config: node.config,
    positionX: node.positionX,
    positionY: node.positionY,
  }))
  const edgeDrafts: WorkflowEdgeDraft[] = graph.edges.map((edge) => ({
    fromNodeKey: edge.fromNodeKey,
    toNodeKey: edge.toNodeKey,
    label: edge.label,
    condition: edge.condition,
  }))

  return validateWorkflowGraph(nodeDrafts, edgeDrafts, { validTeamIds, validPermissions })
}

/** Re-validates before publishing (never trusts a stale client-side validation result), throwing a clear error if the graph is not actually valid, so `publish_workflow_definition_version`'s own cheaper server-side check is defense in depth, not the only check. */
async function publishVersion(versionId: string, actorUserId: string): Promise<WorkflowDefinitionVersion> {
  const validation = await validateVersionForPublish(versionId)
  if (!validation.valid) {
    throw new Error(`Cannot publish an invalid workflow: ${validation.errors.join(" ")}`)
  }
  const row = await workflowData.publishVersion(versionId, actorUserId)
  return toWorkflowDefinitionVersion(row)
}

/** Permanently discards a draft version (task Phase V: without this, an abandoned draft was a hard dead end since at most one draft may exist per definition). Never callable on a published version, enforced by the RPC itself. */
async function discardVersion(versionId: string, actorUserId: string): Promise<void> {
  await workflowData.discardVersion(versionId, actorUserId)
}

export {
  listDefinitions,
  getDefinition,
  listVersionsForDefinition,
  loadWorkflowGraph,
  createDefinition,
  createVersion,
  saveVersionGraph,
  validateVersionForPublish,
  publishVersion,
  discardVersion,
}
export type { WorkflowGraph }
