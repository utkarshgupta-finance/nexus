import "server-only"

import * as workflowData from "../data/workflow-builder.data"
import { toWorkflowDefinition, toWorkflowDefinitionVersion, toWorkflowNode, toWorkflowEdge } from "../domain/mappers"
import { validateWorkflowGraph } from "../domain/validation"
import { listActiveTeams, listTeams } from "@/platform/team/server"
import { getSupabaseServiceRoleClient } from "@/lib/supabase/server-client"
import type { WorkflowDefinition, WorkflowDefinitionVersion, WorkflowNode, WorkflowEdge, WorkflowNodeDraft, WorkflowEdgeDraft, WorkflowAppliesTo } from "../domain/types"
import type { WorkflowGraphValidationResult } from "../domain/validation"
import type { WorkflowTransitionRecord, WorkflowNodeDisplay, WorkflowTransitionAction } from "../domain/transition-events"

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

/**
 * The responsible_team_id of every (workflowVersionId, nodeKey) pair
 * across a batch of distinct workflow versions, keyed
 * `${workflowVersionId}::${nodeKey}` (Workflow Runtime V1 Sequential
 * Execution: the Approvals inbox/My Work read this to decide whether the
 * viewer is the current node's responsible team, not only whether they
 * hold the domain's fixed approve permission). One query per distinct
 * version in the batch, never one per business row.
 */
async function getResponsibleTeamIdsByNode(versionIds: string[]): Promise<Map<string, string | null>> {
  const distinctVersionIds = [...new Set(versionIds)]
  const nodeRows = await workflowData.listNodesForVersions(distinctVersionIds)
  return new Map(nodeRows.map((row) => [`${row.workflow_version_id}::${row.node_key}`, row.responsible_team_id]))
}

type WorkflowTransitionTimelineInputs = {
  transitions: WorkflowTransitionRecord[]
  nodeDisplayByKey: Map<string, WorkflowNodeDisplay>
  actorIds: string[]
}

/**
 * Everything one request's Timeline needs to render its workflow
 * transitions (Workflow Runtime V1 UX + Audit Closure): the raw
 * transition rows mapped to the pure domain shape, plus a node_key ->
 * {nodeName, teamName} display map (never a raw node_key or team UUID
 * reaching the UI) and the list of actor ids the caller must fold into
 * its own batched `resolveActorLabels` call. All transitions for one
 * request share one workflow_version_id (resolved once at creation,
 * never re-resolved), so node display only needs one version's worth of
 * nodes, not a cross-request batch like `getResponsibleTeamIdsByNode`.
 */
async function getWorkflowTransitionTimelineInputs(domain: string, resourceId: string): Promise<WorkflowTransitionTimelineInputs> {
  const rows = await workflowData.listTransitionsForResource(domain, resourceId)
  if (rows.length === 0) return { transitions: [], nodeDisplayByKey: new Map(), actorIds: [] }

  const workflowVersionId = rows[0].workflow_version_id
  const [nodeRows, teams] = await Promise.all([workflowData.listNodesForVersion(workflowVersionId), listTeams()])
  const teamNameById = new Map(teams.map((team) => [team.id, team.name]))
  const nodeDisplayByKey = new Map(
    nodeRows.map((node) => [node.node_key, { nodeName: node.name, teamName: node.responsible_team_id ? (teamNameById.get(node.responsible_team_id) ?? null) : null }])
  )

  const transitions: WorkflowTransitionRecord[] = rows.map((row) => ({
    fromNodeKey: row.from_node_key,
    toNodeKey: row.to_node_key,
    action: row.action as WorkflowTransitionAction,
    actorUserId: row.actor_user_id,
    comment: row.comment,
    occurredAt: row.occurred_at,
    cycleNumber: row.cycle_number,
  }))

  return { transitions, nodeDisplayByKey, actorIds: transitions.map((transition) => transition.actorUserId) }
}

async function createDefinition(code: string, name: string, appliesTo: WorkflowAppliesTo, actorUserId: string): Promise<WorkflowDefinition> {
  const row = await workflowData.createDefinition(code, name, appliesTo, actorUserId)
  return toWorkflowDefinition(row)
}

async function createVersion(definitionId: string, actorUserId: string): Promise<WorkflowDefinitionVersion> {
  const row = await workflowData.createVersion(definitionId, actorUserId)
  return toWorkflowDefinitionVersion(row)
}

/** Task 3 (Workflow Runtime V1): activate/deactivate one workflow definition. Raises a named conflict, never silently picks one, if activating would leave two active definitions for the same binding context. */
async function setDefinitionActive(definitionId: string, isActive: boolean, actorUserId: string): Promise<WorkflowDefinition> {
  const row = await workflowData.setDefinitionActive(definitionId, isActive, actorUserId)
  return toWorkflowDefinition(row)
}

/** The governed replacement path: swap which definition is active for a binding context in one transaction, so an admin never has to deactivate the old one and activate the new one as two separate, racy steps. */
async function replaceActiveDefinition(newDefinitionId: string, actorUserId: string): Promise<WorkflowDefinition> {
  const row = await workflowData.replaceActiveDefinition(newDefinitionId, actorUserId)
  return toWorkflowDefinition(row)
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
  getResponsibleTeamIdsByNode,
  getWorkflowTransitionTimelineInputs,
  createDefinition,
  setDefinitionActive,
  replaceActiveDefinition,
  createVersion,
  saveVersionGraph,
  validateVersionForPublish,
  publishVersion,
  discardVersion,
}
export type { WorkflowGraph }
