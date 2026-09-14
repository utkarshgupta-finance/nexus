/**
 * Workflow Builder domain types (task Phase N/O): a node-graph process
 * model (Start/Form Step/Approval/Decision/End), distinct from the
 * existing flat, condition-triggered rule evaluator in
 * `src/platform/workflow/domain/types.ts` (still the only workflow
 * mechanism Customer Change actually runs today, unchanged by this
 * module). Matches
 * supabase/migrations/20260916090000_workflow_builder_foundation.sql
 * column-for-column.
 */

type WorkflowAppliesTo = "customer_onboarding" | "customer_change" | "commercial_configuration" | "go_live" | "agreement"

type WorkflowNodeType = "start" | "form_step" | "approval" | "decision" | "end"

type WorkflowVersionStatus = "draft" | "published"

type WorkflowDefinition = {
  id: string
  code: string
  name: string
  appliesTo: WorkflowAppliesTo
  isActive: boolean
  createdAt: string
  updatedAt: string
  updatedBy: string | null
}

type WorkflowDefinitionVersion = {
  id: string
  workflowDefinitionId: string
  versionNumber: number
  status: WorkflowVersionStatus
  publishedAt: string | null
  publishedBy: string | null
  createdAt: string
  updatedAt: string
  updatedBy: string | null
}

/**
 * Required fields/attachments/conditions (task spec) live in `config`,
 * a small, closed shape this module validates, never arbitrary code.
 * `conditions` reuses `WorkflowCondition` from the existing rule
 * evaluator's own vocabulary (src/platform/workflow) rather than
 * redeclaring a second one.
 */
type WorkflowNodeConfig = {
  requiredFields?: string[]
  requiredAttachments?: string[]
}

type WorkflowNode = {
  id: string
  workflowVersionId: string
  nodeKey: string
  nodeType: WorkflowNodeType
  name: string
  responsibleTeamId: string | null
  requiredResource: string | null
  requiredAction: string | null
  config: WorkflowNodeConfig
  positionX: number
  positionY: number
}

type WorkflowEdge = {
  id: string
  workflowVersionId: string
  fromNodeKey: string
  toNodeKey: string
  label: string | null
  condition: unknown | null
}

/** The shape `save_workflow_version_graph` accepts: a plain node/edge draft, never a row id (the RPC replaces the whole graph and mints fresh rows every save). */
type WorkflowNodeDraft = {
  nodeKey: string
  nodeType: WorkflowNodeType
  name: string
  responsibleTeamId: string | null
  requiredResource: string | null
  requiredAction: string | null
  config: WorkflowNodeConfig
  positionX: number
  positionY: number
}

type WorkflowEdgeDraft = {
  fromNodeKey: string
  toNodeKey: string
  label: string | null
  condition: unknown | null
}

export type {
  WorkflowAppliesTo,
  WorkflowNodeType,
  WorkflowVersionStatus,
  WorkflowDefinition,
  WorkflowDefinitionVersion,
  WorkflowNodeConfig,
  WorkflowNode,
  WorkflowEdge,
  WorkflowNodeDraft,
  WorkflowEdgeDraft,
}
