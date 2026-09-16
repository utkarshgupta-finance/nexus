import { getSupabaseServiceRoleClient } from "@/lib/supabase/server-client"

/**
 * Repository for the Workflow Builder module (task Phase N/O),
 * reusing the exact RPC/table shape
 * supabase/migrations/20260916090000_workflow_builder_foundation.sql
 * created. Plain PostgREST reads plus the governed RPCs for every
 * write, matching every other platform capability's data.ts.
 */

type WorkflowDefinitionRow = {
  id: string
  code: string
  name: string
  applies_to: string
  is_active: boolean
  created_at: string
  updated_at: string
  updated_by: string | null
}

async function listDefinitions(): Promise<WorkflowDefinitionRow[]> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase.from("workflow_definitions").select("*").order("name", { ascending: true })
  if (error) throw error
  return data ?? []
}

async function getDefinition(id: string): Promise<WorkflowDefinitionRow | null> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase.from("workflow_definitions").select("*").eq("id", id).maybeSingle()
  if (error) throw error
  return data
}

type WorkflowVersionRow = {
  id: string
  workflow_definition_id: string
  version_number: number
  status: string
  published_at: string | null
  published_by: string | null
  row_version: number
  created_at: string
  updated_at: string
  updated_by: string | null
}

async function listVersionsForDefinition(definitionId: string): Promise<WorkflowVersionRow[]> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("workflow_definition_versions")
    .select("*")
    .eq("workflow_definition_id", definitionId)
    .order("version_number", { ascending: false })
  if (error) throw error
  return data ?? []
}

async function getVersion(id: string): Promise<WorkflowVersionRow | null> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase.from("workflow_definition_versions").select("*").eq("id", id).maybeSingle()
  if (error) throw error
  return data
}

type WorkflowNodeRow = {
  id: string
  workflow_version_id: string
  node_key: string
  node_type: string
  name: string
  responsible_team_id: string | null
  required_resource: string | null
  required_action: string | null
  config: Record<string, unknown>
  position_x: number
  position_y: number
}

async function listNodesForVersion(versionId: string): Promise<WorkflowNodeRow[]> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase.from("workflow_nodes").select("*").eq("workflow_version_id", versionId)
  if (error) throw error
  return data ?? []
}

/** Batched across every distinct workflow version an inbox/My Work read touches (Workflow Runtime V1 Sequential Execution), never one query per business row: the same "batched, not per-entry" rule every other Approvals inbox read already follows. */
async function listNodesForVersions(versionIds: string[]): Promise<WorkflowNodeRow[]> {
  if (versionIds.length === 0) return []
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase.from("workflow_nodes").select("*").in("workflow_version_id", versionIds)
  if (error) throw error
  return data ?? []
}

/** Raw shape of a workflow_node_transitions row (Workflow Runtime V1 Sequential Execution, supabase/migrations/20260925000000_workflow_runtime_v1_sequential_execution.sql). Append-only; never updated or deleted. */
type WorkflowNodeTransitionRow = {
  id: string
  domain: string
  resource_id: string
  workflow_version_id: string
  cycle_number: number
  from_node_key: string | null
  to_node_key: string | null
  action: string
  actor_user_id: string
  comment: string | null
  occurred_at: string
}

/** Every transition ever recorded for one request, oldest first: a Timeline reads its own history top to bottom, same convention as every other Timeline data source in this codebase. */
async function listTransitionsForResource(domain: string, resourceId: string): Promise<WorkflowNodeTransitionRow[]> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("workflow_node_transitions")
    .select("*")
    .eq("domain", domain)
    .eq("resource_id", resourceId)
    .order("occurred_at", { ascending: true })
  if (error) throw error
  return data ?? []
}

type WorkflowEdgeRow = {
  id: string
  workflow_version_id: string
  from_node_key: string
  to_node_key: string
  label: string | null
  condition: unknown | null
}

async function listEdgesForVersion(versionId: string): Promise<WorkflowEdgeRow[]> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase.from("workflow_edges").select("*").eq("workflow_version_id", versionId)
  if (error) throw error
  return data ?? []
}

async function createDefinition(code: string, name: string, appliesTo: string, actorUserId: string): Promise<WorkflowDefinitionRow> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc("create_workflow_definition", {
    p_code: code,
    p_name: name,
    p_applies_to: appliesTo,
    p_actor_user_id: actorUserId,
  })
  if (error) throw error
  return data
}

/** Activates or deactivates one workflow definition. Raises WORKFLOW_DEFINITION_CONTEXT_ALREADY_ACTIVE (via the RPC) rather than silently picking one if another definition already holds this applies_to's active slot. */
async function setDefinitionActive(definitionId: string, isActive: boolean, actorUserId: string): Promise<WorkflowDefinitionRow> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc("set_workflow_definition_active", {
    p_definition_id: definitionId,
    p_is_active: isActive,
    p_actor_user_id: actorUserId,
  })
  if (error) throw error
  return data
}

/** The governed replacement path: atomically deactivates whichever other definition currently holds this applies_to's active slot (if any) and activates p_new_definition_id. */
async function replaceActiveDefinition(newDefinitionId: string, actorUserId: string): Promise<WorkflowDefinitionRow> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc("replace_active_workflow_definition", {
    p_new_definition_id: newDefinitionId,
    p_actor_user_id: actorUserId,
  })
  if (error) throw error
  return data
}

async function createVersion(definitionId: string, actorUserId: string): Promise<WorkflowVersionRow> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc("create_workflow_definition_version", {
    p_workflow_definition_id: definitionId,
    p_actor_user_id: actorUserId,
  })
  if (error) throw error
  return data
}

async function saveVersionGraph(
  versionId: string,
  nodes: Record<string, unknown>[],
  edges: Record<string, unknown>[],
  expectedRowVersion: number,
  actorUserId: string
): Promise<WorkflowVersionRow> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc("save_workflow_version_graph", {
    p_version_id: versionId,
    p_nodes: nodes,
    p_edges: edges,
    p_expected_row_version: expectedRowVersion,
    p_actor_user_id: actorUserId,
  })
  if (error) throw error
  return data
}

async function publishVersion(versionId: string, actorUserId: string): Promise<WorkflowVersionRow> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc("publish_workflow_definition_version", { p_version_id: versionId, p_actor_user_id: actorUserId })
  if (error) throw error
  return data
}

/** Permanently removes a draft version (never a published one); `workflow_nodes`/`workflow_edges` cascade automatically on `workflow_version_id`. */
async function discardVersion(versionId: string, actorUserId: string): Promise<void> {
  const supabase = getSupabaseServiceRoleClient()
  const { error } = await supabase.rpc("discard_workflow_definition_version", { p_version_id: versionId, p_actor_user_id: actorUserId })
  if (error) throw error
}

export {
  listDefinitions,
  getDefinition,
  listVersionsForDefinition,
  getVersion,
  listNodesForVersion,
  listNodesForVersions,
  listEdgesForVersion,
  listTransitionsForResource,
  createDefinition,
  setDefinitionActive,
  replaceActiveDefinition,
  createVersion,
  saveVersionGraph,
  publishVersion,
  discardVersion,
}
export type { WorkflowDefinitionRow, WorkflowVersionRow, WorkflowNodeRow, WorkflowEdgeRow, WorkflowNodeTransitionRow }
