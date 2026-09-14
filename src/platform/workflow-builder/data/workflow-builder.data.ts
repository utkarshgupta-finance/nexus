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
  actorUserId: string
): Promise<WorkflowVersionRow> {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc("save_workflow_version_graph", {
    p_version_id: versionId,
    p_nodes: nodes,
    p_edges: edges,
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

export {
  listDefinitions,
  getDefinition,
  listVersionsForDefinition,
  getVersion,
  listNodesForVersion,
  listEdgesForVersion,
  createDefinition,
  createVersion,
  saveVersionGraph,
  publishVersion,
}
export type { WorkflowDefinitionRow, WorkflowVersionRow, WorkflowNodeRow, WorkflowEdgeRow }
