import "server-only"

/**
 * TRUSTED, SERVER-ONLY Workflow Builder entry point (task Phase N/O).
 * Every function reachable from here authenticates as service_role; the
 * calling route/action is responsible for its own
 * `workflow_definition.read`/`write`/`publish` check before rendering or
 * mutating what these return.
 */

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
} from "./services/workflow-builder.service"
export type { WorkflowGraph } from "./services/workflow-builder.service"
export type {
  WorkflowDefinition,
  WorkflowDefinitionVersion,
  WorkflowNode,
  WorkflowEdge,
  WorkflowNodeDraft,
  WorkflowEdgeDraft,
  WorkflowAppliesTo,
  WorkflowNodeType,
  WorkflowVersionStatus,
} from "./domain/types"
export type { WorkflowGraphValidationResult } from "./domain/validation"
export { resolveApprovalStep, DEFAULT_APPROVAL_STEP } from "./domain/runtime"
export type { ResolvedApprovalStep } from "./domain/runtime"
