import type { WorkflowCondition, WorkflowRule } from "./types"

/**
 * Pure Nexus Workflow rule evaluator (task spec §61). Given the current
 * and proposed state of a change, and a set of rules, this calculates
 * which rules match and what they require in aggregate. It performs no
 * database writes, no approval execution, no notifications, and no state
 * transitions: it only calculates requirements. Nothing here is async,
 * nothing here has a side effect, and calling it twice with the same
 * input always returns an equivalent result.
 */

type ResolvedApprovalRequirement = {
  role: string
  scopeValue: unknown
  /** Every matched rule's own explanation, preserved for audit (task spec §55: "what requirements were created" must be answerable). */
  reasons: string[]
  matchedRuleKeys: string[]
}

type ResolvedEvidenceRequirement = {
  evidenceType: string
  reasons: string[]
  matchedRuleKeys: string[]
}

type WorkflowEvaluationResult = {
  matchedRuleKeys: string[]
  approvals: ResolvedApprovalRequirement[]
  evidence: ResolvedEvidenceRequirement[]
}

type WorkflowEvaluationInput = {
  currentValues: Record<string, unknown>
  proposedValues: Record<string, unknown>
  rules: WorkflowRule[]
  /** Additional read-only facts a condition may reference (task spec §61); resolved only when a field is absent from both `proposedValues` and `currentValues`. */
  context?: Record<string, unknown>
}

/**
 * A field only counts as "changed" if the change actually supplies a
 * value for it: a `proposedValues` that omits a field is read as "not
 * part of this change", never as an implicit change to `undefined`. This
 * lets a caller pass either a sparse diff or a full snapshot and get the
 * same, correct answer for fields it did not intend to touch.
 */
function hasChanged(field: string, currentValues: Record<string, unknown>, proposedValues: Record<string, unknown>): boolean {
  if (!(field in proposedValues)) return false
  return currentValues[field] !== proposedValues[field]
}

/**
 * Resolves a field's comparison value for `equals`/`not_equals`:
 * proposed side first (a field the change actually sets), then current
 * (a stable fact the change leaves alone, for example an existing
 * Country used to gate a GST-specific rule), then context.
 */
function resolveFieldValue(
  field: string,
  currentValues: Record<string, unknown>,
  proposedValues: Record<string, unknown>,
  context: Record<string, unknown>
): unknown {
  if (field in proposedValues) return proposedValues[field]
  if (field in currentValues) return currentValues[field]
  return context[field]
}

function evaluateCondition(
  condition: WorkflowCondition,
  currentValues: Record<string, unknown>,
  proposedValues: Record<string, unknown>,
  context: Record<string, unknown>
): boolean {
  switch (condition.operator) {
    case "changed":
      return hasChanged(condition.field, currentValues, proposedValues)
    case "equals":
      return resolveFieldValue(condition.field, currentValues, proposedValues, context) === condition.value
    case "not_equals":
      return resolveFieldValue(condition.field, currentValues, proposedValues, context) !== condition.value
  }
}

function ruleMatches(
  rule: WorkflowRule,
  currentValues: Record<string, unknown>,
  proposedValues: Record<string, unknown>,
  context: Record<string, unknown>
): boolean {
  if (rule.conditions.length === 0) return false
  return rule.conditions.every((condition) => evaluateCondition(condition, currentValues, proposedValues, context))
}

function resolveScopeValue(
  scope: { source: "current" | "proposed"; field: string } | undefined,
  currentValues: Record<string, unknown>,
  proposedValues: Record<string, unknown>
): unknown {
  if (!scope) return undefined
  return (scope.source === "current" ? currentValues : proposedValues)[scope.field]
}

function evaluateWorkflowRules(input: WorkflowEvaluationInput): WorkflowEvaluationResult {
  const { currentValues, proposedValues, rules, context = {} } = input

  const matchedRules = rules.filter((rule) => ruleMatches(rule, currentValues, proposedValues, context))

  const approvalsByKey = new Map<string, ResolvedApprovalRequirement>()
  const evidenceByType = new Map<string, ResolvedEvidenceRequirement>()

  for (const rule of matchedRules) {
    for (const requirement of rule.requirements) {
      if (requirement.kind === "approval") {
        const scopeValue = resolveScopeValue(requirement.role.scope, currentValues, proposedValues)
        // Same role code with a different resolved scope value stays a
        // distinct approval (task spec: Old BU Head and New BU Head never
        // merge even though both are role "BU_HEAD").
        const dedupeKey = `${requirement.role.role}::${JSON.stringify(scopeValue)}`
        const existing = approvalsByKey.get(dedupeKey)
        if (existing) {
          existing.reasons.push(requirement.reason)
          existing.matchedRuleKeys.push(rule.key)
        } else {
          approvalsByKey.set(dedupeKey, {
            role: requirement.role.role,
            scopeValue,
            reasons: [requirement.reason],
            matchedRuleKeys: [rule.key],
          })
        }
      } else {
        const existing = evidenceByType.get(requirement.evidenceType)
        if (existing) {
          existing.reasons.push(requirement.reason)
          existing.matchedRuleKeys.push(rule.key)
        } else {
          evidenceByType.set(requirement.evidenceType, {
            evidenceType: requirement.evidenceType,
            reasons: [requirement.reason],
            matchedRuleKeys: [rule.key],
          })
        }
      }
    }
  }

  return {
    matchedRuleKeys: matchedRules.map((rule) => rule.key),
    approvals: [...approvalsByKey.values()],
    evidence: [...evidenceByType.values()],
  }
}

export { evaluateWorkflowRules }
export type { WorkflowEvaluationInput, WorkflowEvaluationResult, ResolvedApprovalRequirement, ResolvedEvidenceRequirement }
