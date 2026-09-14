import type { WorkflowNode } from "./types"

/**
 * Minimal, reusable Workflow Runtime (Go Live + Entitlement Ledger,
 * Phase D). Workflow Builder itself is authoring/publishing-only today
 * (no instance/execution tracking, no per-record "current node"); a
 * full stateful graph-execution engine is out of proportion to what Go
 * Live actually needs. This is the smallest genuine "consumption" of a
 * published graph as real, live configuration: given a bound version's
 * nodes, resolve which team/permission an Approval step names as
 * responsible, for DISPLAY (an Operational Queue "Responsible Team"
 * style column). This is never the actual authorization gate: the real
 * `requirePermission` check stays a fixed, hardcoded resource+action in
 * every calling Server Action, so a database-configured graph can never
 * redirect what permission is actually enforced.
 *
 * Deliberately NOT a full runtime: no current-node persistence, no edge
 * traversal, no Decision-node condition evaluation. Go Live's own
 * governed-decision RPCs (draft/submit/send-back/approve/cancel) are
 * the actual state machine; this only asks the bound graph "what does
 * the Approval step name," once, at approval time.
 */

type ResolvedApprovalStep = { resource: string; action: string; responsibleTeamId: string | null }

/** The graceful-degradation default when no workflow graph is published for this applies_to yet, or a bound version has no Approval node: Go Live must keep working even before an admin authors a graph. */
const DEFAULT_APPROVAL_STEP: ResolvedApprovalStep = { resource: "go_live", action: "approve", responsibleTeamId: null }

/** Picks the first Approval node (by nodeKey, for determinism) in a bound workflow version's graph. A Go Live V1 graph is expected to have at most one; multiple is a future authoring concern, not a runtime one. */
function resolveApprovalStep(nodes: WorkflowNode[]): ResolvedApprovalStep {
  const approvalNodes = nodes.filter((node) => node.nodeType === "approval").sort((a, b) => a.nodeKey.localeCompare(b.nodeKey))
  const node = approvalNodes[0]
  if (!node || !node.requiredResource || !node.requiredAction) return DEFAULT_APPROVAL_STEP
  return { resource: node.requiredResource, action: node.requiredAction, responsibleTeamId: node.responsibleTeamId }
}

export { resolveApprovalStep, DEFAULT_APPROVAL_STEP }
export type { ResolvedApprovalStep }
