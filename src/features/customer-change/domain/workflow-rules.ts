import { evaluateWorkflowRules } from "@/platform/workflow"
import type { WorkflowRule } from "@/platform/workflow"

import type { CustomerChangeRequirement } from "./types"

/**
 * Wires the existing, pure Nexus Workflow rule evaluator
 * (src/platform/workflow/domain/evaluator.ts) into Customer Change
 * Requests (task spec §61-63: "wire the existing workflow rule
 * evaluator... persist resulting requirements"). Demo rule set matching
 * the task's own worked examples exactly: a Segment change needs Finance
 * Head approval; a Business Unit change needs BOTH the outgoing and the
 * incoming Business Unit Head's approval (kept distinct because
 * evaluateWorkflowRules dedupes by role+resolved-scope-value, and "old
 * BU_HEAD" and "new BU_HEAD" resolve to different scope values); a Legal
 * Entity Name change needs updated registration evidence. No ad hoc
 * UI-only rules exist anywhere else.
 */

const CUSTOMER_CHANGE_WORKFLOW_RULES: WorkflowRule[] = [
  {
    key: "segment_change_requires_finance_approval",
    description: "A Segment change requires Finance Head approval.",
    conditions: [{ field: "segment", operator: "changed" }],
    requirements: [{ kind: "approval", role: { role: "FINANCE_HEAD" }, reason: "Segment change requires Finance Head approval." }],
  },
  {
    key: "business_unit_change_requires_old_bu_head_approval",
    description: "A Business Unit change requires the outgoing Business Unit Head's approval.",
    conditions: [{ field: "business_unit", operator: "changed" }],
    requirements: [
      {
        kind: "approval",
        role: { role: "BU_HEAD", scope: { source: "current", field: "business_unit" } },
        reason: "Business Unit change requires the outgoing Business Unit Head's approval.",
      },
    ],
  },
  {
    key: "business_unit_change_requires_new_bu_head_approval",
    description: "A Business Unit change requires the incoming Business Unit Head's approval.",
    conditions: [{ field: "business_unit", operator: "changed" }],
    requirements: [
      {
        kind: "approval",
        role: { role: "BU_HEAD", scope: { source: "proposed", field: "business_unit" } },
        reason: "Business Unit change requires the incoming Business Unit Head's approval.",
      },
    ],
  },
  {
    key: "legal_name_change_requires_registration_evidence",
    description: "A Legal Entity Name change requires updated registration evidence.",
    conditions: [{ field: "name", operator: "changed" }],
    requirements: [
      { kind: "evidence", evidenceType: "company_registration", reason: "Legal Entity Name change requires updated registration evidence." },
    ],
  },
]

/** Scope descriptor lookup by rule key, since evaluateWorkflowRules's resolved output preserves only the resolved scope VALUE, not which side (current/proposed) or field it came from. */
function findScopeDescriptor(ruleKey: string): { source: "current" | "proposed"; field: string } | undefined {
  for (const rule of CUSTOMER_CHANGE_WORKFLOW_RULES) {
    if (rule.key !== ruleKey) continue
    for (const requirement of rule.requirements) {
      if (requirement.kind === "approval" && requirement.role.scope) return requirement.role.scope
    }
  }
  return undefined
}

function scopeLabelFor(matchedRuleKeys: string[]): string | null {
  for (const ruleKey of matchedRuleKeys) {
    const scope = findScopeDescriptor(ruleKey)
    if (scope) return `${scope.source} ${scope.field}`
  }
  return null
}

/**
 * Runs the pure evaluator over a Change Request's current-vs-proposed
 * values and shapes the result into the persisted row structure
 * submit_customer_change_request expects for its `p_requirements` jsonb
 * array parameter (kind/role_code/scope_label/evidence_type/reason/
 * matched_rule_keys).
 */
function evaluateCustomerChangeRequirements(currentValues: Record<string, unknown>, proposedValues: Record<string, unknown>): CustomerChangeRequirement[] {
  const result = evaluateWorkflowRules({ currentValues, proposedValues, rules: CUSTOMER_CHANGE_WORKFLOW_RULES })

  const requirements: CustomerChangeRequirement[] = []

  for (const approval of result.approvals) {
    requirements.push({
      kind: "approval",
      roleCode: approval.role,
      scopeLabel: scopeLabelFor(approval.matchedRuleKeys),
      evidenceType: null,
      reason: approval.reasons.join(" "),
      matchedRuleKeys: approval.matchedRuleKeys,
    })
  }

  for (const evidence of result.evidence) {
    requirements.push({
      kind: "evidence",
      roleCode: null,
      scopeLabel: null,
      evidenceType: evidence.evidenceType,
      reason: evidence.reasons.join(" "),
      matchedRuleKeys: evidence.matchedRuleKeys,
    })
  }

  return requirements
}

/** Row shape the submit_customer_change_request RPC's p_requirements jsonb array expects. */
function toRequirementRpcRows(requirements: CustomerChangeRequirement[]): Record<string, unknown>[] {
  return requirements.map((requirement) => ({
    kind: requirement.kind,
    role_code: requirement.roleCode,
    scope_label: requirement.scopeLabel,
    evidence_type: requirement.evidenceType,
    reason: requirement.reason,
    matched_rule_keys: requirement.matchedRuleKeys,
  }))
}

export { CUSTOMER_CHANGE_WORKFLOW_RULES, evaluateCustomerChangeRequirements, toRequirementRpcRows }
