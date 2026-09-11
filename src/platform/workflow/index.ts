/**
 * Public surface of the Nexus Workflow platform capability. Everything
 * here is pure and unpersisted today; see ./domain/types.ts's header for
 * status. No feature is wired to this yet.
 */

export type {
  ScopeReference,
  RoleReference,
  WorkflowConditionOperator,
  WorkflowCondition,
  ApprovalRequirement,
  EvidenceRequirement,
  WorkflowRequirement,
  WorkflowRule,
  WorkflowDefinition,
  WorkflowVersionStatus,
  WorkflowVersionDefinition,
  WorkflowInstance,
} from "./domain/types"
export { evaluateWorkflowRules } from "./domain/evaluator"
export type {
  WorkflowEvaluationInput,
  WorkflowEvaluationResult,
  ResolvedApprovalRequirement,
  ResolvedEvidenceRequirement,
} from "./domain/evaluator"
