/**
 * Workflow Builder domain types: a node-graph process model (Start/Form
 * Step/Approval/Decision/End). Matches
 * supabase/migrations/20260916090000_workflow_builder_foundation.sql
 * column-for-column.
 *
 * `WorkflowEdge.condition`/`WorkflowEdgeDraft.condition` reuse
 * `WorkflowCondition` from `src/platform/workflow/domain/types.ts` (the
 * separate, older flat rule evaluator Customer Change's own hardcoded
 * rule array runs, unchanged by this module) for field/operator/value
 * vocabulary only, not its evaluator: Workflow Runtime V1
 * (supabase/migrations/20260921000000_workflow_runtime_v1.sql,
 * src/platform/workflow-builder/domain/runtime.ts) evaluates a
 * Decision-node edge's condition against a static per-domain context
 * bag (there is no current/proposed distinction for approval routing),
 * restricted to "equals"/"not_equals"; "changed" is rejected at publish
 * time since it is not meaningful here.
 */
import type { WorkflowCondition } from "@/platform/workflow/domain/types"

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
  /** Optimistic-lock token every Save Draft (whole-graph replace) call must echo back as expectedRowVersion (Nexus Foundational Hardening, Phase 4): two Workflow Admins editing the same draft no longer silently overwrite each other. */
  rowVersion: number
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
  condition: WorkflowCondition | null
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
  condition: WorkflowCondition | null
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
