import type { WorkflowCondition } from "@/platform/workflow/domain/types"
import type { WorkflowEdge, WorkflowNode } from "./types"

/**
 * Workflow Runtime V1 (Nexus Foundational Hardening, Phase 2). Earlier
 * (Go Live + Entitlement Ledger) this function only picked "the first
 * Approval node by nodeKey," ignoring the graph's actual edges, and was
 * documented as deliberately display-only: "no edge traversal, no
 * Decision-node condition evaluation... never the actual authorization
 * gate." That is no longer accurate. `approve_go_live_request` /
 * `approve_commercial_configuration_version` /
 * `approve_customer_onboarding_case` / `approve_customer_change_request`
 * (see supabase/migrations/20260921000000_workflow_runtime_v1.sql) now
 * run this exact same walk in SQL (`fn_resolve_workflow_responsible_team`)
 * as the real enforcement gate. This TS function is kept as the
 * identical algorithm for pre-approval DISPLAY (so a reviewer sees the
 * responsible team before opening an approval, not only after), not a
 * second, divergent implementation: the RPC's own SQL walk is the
 * ultimate authority at the moment of approval, since only it runs
 * inside the same transaction as the decision.
 *
 * Bounded on purpose: Start -> optional Decision branches -> the first
 * Approval node reached. Not a general BPM engine. The REQUIRED
 * PERMISSION stays fixed and domain-owned regardless of what a graph's
 * Approval node names (see the migration's own header): only the
 * responsible TEAM is real, graph-controlled routing. `resource`/
 * `action` below are still surfaced for display (showing the graph's own
 * authored intent honestly), but are never used to decide what
 * `requirePermission` call a Server Action makes.
 */

type ResolvedApprovalStep = { resource: string; action: string; responsibleTeamId: string | null }

/** Graceful-degradation default: no workflow graph published yet, no Start node, or no Approval node ever reached along the path taken. */
const DEFAULT_APPROVAL_STEP: ResolvedApprovalStep = { resource: "go_live", action: "approve", responsibleTeamId: null }

const MAX_HOPS = 10

function evaluateDecisionCondition(condition: WorkflowCondition, context: Record<string, string | null | undefined>): boolean {
  const actual = context[condition.field] ?? null
  const expected = condition.value === undefined || condition.value === null ? null : String(condition.value)
  if (condition.operator === "equals") return actual === expected
  if (condition.operator === "not_equals") return actual !== expected
  // "changed" has no current/proposed distinction in a static approval-routing context; publish-time validation (see workflow_runtime_v1 migration) never allows it on a Decision edge, so this is unreachable for a published graph.
  return false
}

/**
 * Walks a bound workflow version's graph from Start, following a
 * Decision node's branches (first matching non-null condition, else the
 * single unconditioned fallback edge, exactly like the SQL walk), until
 * an Approval node is reached. Returns `null` (not `DEFAULT_APPROVAL_STEP`)
 * only when the walk cannot be completed at all (missing Start, dead
 * end, or an unresolvable Decision with no fallback); callers that want
 * the graceful default should do `resolveWorkflowApprovalStep(...) ??
 * DEFAULT_APPROVAL_STEP`.
 */
function resolveWorkflowApprovalStep(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  context: Record<string, string | null | undefined> = {}
): ResolvedApprovalStep | null {
  const nodeByKey = new Map(nodes.map((node) => [node.nodeKey, node]))
  const edgesFrom = new Map<string, WorkflowEdge[]>()
  for (const edge of edges) {
    const existing = edgesFrom.get(edge.fromNodeKey)
    if (existing) existing.push(edge)
    else edgesFrom.set(edge.fromNodeKey, [edge])
  }

  const start = nodes.find((node) => node.nodeType === "start")
  if (!start) return null

  let currentKey = start.nodeKey
  for (let hop = 0; hop < MAX_HOPS; hop++) {
    const current = nodeByKey.get(currentKey)
    if (!current) return null

    if (current.nodeType === "approval") {
      if (!current.requiredResource || !current.requiredAction) return null
      return { resource: current.requiredResource, action: current.requiredAction, responsibleTeamId: current.responsibleTeamId }
    }
    if (current.nodeType === "end") return null

    const outgoing = [...(edgesFrom.get(currentKey) ?? [])].sort((a, b) => a.toNodeKey.localeCompare(b.toNodeKey))

    if (current.nodeType === "decision") {
      const fallback = outgoing.find((edge) => !edge.condition)
      const match = outgoing.find((edge) => edge.condition && evaluateDecisionCondition(edge.condition as WorkflowCondition, context))
      const next = match ?? fallback
      if (!next) return null
      currentKey = next.toNodeKey
    } else {
      const next = outgoing[0]
      if (!next) return null
      currentKey = next.toNodeKey
    }
  }

  return null
}

/** @deprecated kept only for existing callers mid-migration to `resolveWorkflowApprovalStep`; picks the first Approval node by nodeKey with no regard for graph structure. Prefer `resolveWorkflowApprovalStep`, which is what actually gets enforced. */
function resolveApprovalStep(nodes: WorkflowNode[]): ResolvedApprovalStep {
  const approvalNodes = nodes.filter((node) => node.nodeType === "approval").sort((a, b) => a.nodeKey.localeCompare(b.nodeKey))
  const node = approvalNodes[0]
  if (!node || !node.requiredResource || !node.requiredAction) return DEFAULT_APPROVAL_STEP
  return { resource: node.requiredResource, action: node.requiredAction, responsibleTeamId: node.responsibleTeamId }
}

export { resolveApprovalStep, resolveWorkflowApprovalStep, DEFAULT_APPROVAL_STEP }
export type { ResolvedApprovalStep }
