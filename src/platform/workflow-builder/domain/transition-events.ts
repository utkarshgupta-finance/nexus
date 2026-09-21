import type { RequestTimelineEvent } from "@/components/product/request-timeline"

/**
 * Workflow Runtime V1 UX + Audit Closure: the one shared mapper from a
 * request's raw `workflow_node_transitions` rows (Sequential Execution,
 * supabase/migrations/20260925000000_workflow_runtime_v1_sequential_execution.sql)
 * to the same `RequestTimelineEvent` shape every domain's own Timeline
 * already renders. Built once here, called from each of the four
 * governed domains' own `domain/timeline.ts`, never reimplemented four
 * times: what differs per domain is only which raw event sources exist
 * (send-back history table shape, decided vs approved column names), not
 * how a workflow transition itself reads.
 *
 * Actor identity is resolved live via the same `resolveActorLabels`
 * batched lookup every other event in these same Timelines already
 * uses (created/submitted/sent-back/decided), never a separate
 * snapshot mechanism: `workflow_node_transitions` carries no actor
 * snapshot columns, and every other actor reference in this exact
 * feature already reads live, so adding one only for this new event
 * type would make a single Timeline internally inconsistent about
 * whether history is a snapshot or a live lookup. See this migration's
 * own note in docs/WORKFLOW_ENGINE_ARCHITECTURE.md for the reasoning.
 *
 * `submit` transitions are never rendered: they record "entered the
 * first Approval node," the same moment the domain's own "Submitted for
 * review" event already marks, so a second line would only duplicate it.
 * A transition with no `fromNodeKey` (a workflow bound with no Approval
 * node in it at all, or no workflow bound) is skipped for the same
 * reason: it carries no information the domain's own generic decision
 * event does not already show.
 */

type WorkflowTransitionAction = "submit" | "approve" | "send_back" | "reject"

type WorkflowTransitionRecord = {
  fromNodeKey: string | null
  toNodeKey: string | null
  action: WorkflowTransitionAction
  actorUserId: string
  comment: string | null
  occurredAt: string
  cycleNumber: number
}

/** A node's real, authored display name, and its responsible team's real name (or null: the node names no team, meaning no restriction). Never the raw node_key or a team UUID. */
type WorkflowNodeDisplay = { nodeName: string; teamName: string | null }

/**
 * Builds the Timeline events for one request's workflow transitions.
 * `terminalApprovalDetail`, when given, is folded into the single final
 * approval line instead of adding a second "Approved" line (Go Live's
 * own domain-specific nuance: approval also means the line item is now
 * Live). Folding requires `isRequestFinalized` to be true: a real defect
 * found via live H-020/H-021 multi-node testing had this folded onto the
 * chronologically-last transition fetched so far even when that
 * transition only advanced to the next Approval node (request still
 * `submitted`), since `to_node_key` looks identical in shape whether it
 * names an intermediate node or the terminal End node. Returns `[]` if
 * this request was never actually routed through an Approval node (no
 * workflow bound, or a workflow with none) so the caller falls back to
 * its own pre-existing decided/sent-back events exactly as before
 * Workflow Runtime V1 Sequential Execution.
 */
function buildWorkflowTransitionEvents(
  transitions: WorkflowTransitionRecord[],
  nodeDisplayByKey: Map<string, WorkflowNodeDisplay>,
  actorLabels: Map<string, string | null>,
  terminalApprovalDetail?: string,
  isRequestFinalized?: boolean
): RequestTimelineEvent[] {
  const decidable = transitions.filter((transition) => transition.action !== "submit" && transition.fromNodeKey !== null)
  if (decidable.length === 0) return []

  const sorted = [...decidable].sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime())
  const maxCycle = Math.max(...sorted.map((transition) => transition.cycleNumber))

  const events: RequestTimelineEvent[] = []
  let lastCycleShown: number | null = null

  sorted.forEach((transition, index) => {
    if (maxCycle > 1 && transition.cycleNumber !== lastCycleShown) {
      events.push({
        id: `workflow-cycle-${transition.cycleNumber}`,
        occurredAt: transition.occurredAt,
        actorEmail: null,
        summary: `Approval cycle ${transition.cycleNumber}`,
        variant: "marker",
      })
      lastCycleShown = transition.cycleNumber
    }

    const nodeName = nodeDisplayByKey.get(transition.fromNodeKey as string)?.nodeName ?? "Approval step"
    const actorEmail = actorLabels.get(transition.actorUserId) ?? null
    const isFinalEvent = index === sorted.length - 1 && Boolean(isRequestFinalized)

    if (transition.action === "approve") {
      events.push({
        id: `workflow-transition-${index}`,
        occurredAt: transition.occurredAt,
        actorEmail,
        summary: isFinalEvent && terminalApprovalDetail ? `${nodeName} approved: ${terminalApprovalDetail}` : `${nodeName} approved`,
      })
    } else if (transition.action === "send_back") {
      events.push({
        id: `workflow-transition-${index}`,
        occurredAt: transition.occurredAt,
        actorEmail,
        summary: `${nodeName} sent back`,
        detail: transition.comment ?? undefined,
      })
    } else {
      events.push({
        id: `workflow-transition-${index}`,
        occurredAt: transition.occurredAt,
        actorEmail,
        summary: `${nodeName} rejected`,
        detail: transition.comment ?? undefined,
      })
    }
  })

  return events
}

export { buildWorkflowTransitionEvents }
export type { WorkflowTransitionRecord, WorkflowNodeDisplay, WorkflowTransitionAction }
