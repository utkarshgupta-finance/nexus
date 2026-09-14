import type { RequestTimelineEvent } from "@/components/product/request-timeline"

/**
 * A single Customer Change Request's own readable Timeline (Platform
 * Scale Program, Phase I / CFO lens: "explain six months later who sent
 * this back, when, and why"), mirroring
 * ../../customer-onboarding/domain/timeline.ts's exact shape. Built
 * entirely from data already persisted: the request row, its
 * submission_revisions, its customer_change_send_backs history, and its
 * decision (approved/rejected). Never raw audit_log JSON.
 */

type ChangeTimelineRevisionInput = { revisionNumber: number; submittedAt: string | null; submittedBy: string | null }

type ChangeTimelineSendBackInput = { revisionNumber: number; reason: string; sentBackBy: string | null; sentBackAt: string }

type BuildChangeRequestTimelineInput = {
  createdAt: string
  createdBy: string | null
  decidedAt: string | null
  decidedBy: string | null
  decisionStatus: "approved" | "rejected" | null
  decisionReason: string | null
  revisions: ChangeTimelineRevisionInput[]
  sendBacks: ChangeTimelineSendBackInput[]
  actorLabels: Map<string, string | null>
}

function actorLabel(actorId: string | null, actorLabels: Map<string, string | null>): string | null {
  if (!actorId) return null
  return actorLabels.get(actorId) ?? null
}

/** Oldest first: a single request's own history reads naturally top-to-bottom as "what happened, in order." */
function buildChangeRequestTimeline(input: BuildChangeRequestTimelineInput): RequestTimelineEvent[] {
  const events: RequestTimelineEvent[] = [
    { id: "created", occurredAt: input.createdAt, actorEmail: actorLabel(input.createdBy, input.actorLabels), summary: "Change Request created" },
  ]

  for (const revision of input.revisions) {
    if (!revision.submittedAt) continue
    events.push({
      id: `submitted-${revision.revisionNumber}`,
      occurredAt: revision.submittedAt,
      actorEmail: actorLabel(revision.submittedBy, input.actorLabels),
      summary: revision.revisionNumber === 1 ? "Submitted for review" : `Resubmitted for review (Revision ${revision.revisionNumber})`,
    })
  }

  for (const sendBack of input.sendBacks) {
    events.push({
      id: `sent-back-${sendBack.revisionNumber}-${sendBack.sentBackAt}`,
      occurredAt: sendBack.sentBackAt,
      actorEmail: actorLabel(sendBack.sentBackBy, input.actorLabels),
      summary: `Sent back: ${sendBack.reason}`,
    })
  }

  if (input.decidedAt && input.decisionStatus) {
    events.push({
      id: "decided",
      occurredAt: input.decidedAt,
      actorEmail: actorLabel(input.decidedBy, input.actorLabels),
      summary: input.decisionStatus === "approved" ? "Approved" : `Rejected: ${input.decisionReason ?? "no reason given"}`,
    })
  }

  return events.sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime())
}

function collectChangeRequestTimelineActorIds(input: Omit<BuildChangeRequestTimelineInput, "actorLabels">): (string | null)[] {
  const ids: (string | null)[] = [input.createdBy, input.decidedBy]
  for (const revision of input.revisions) ids.push(revision.submittedBy)
  for (const sendBack of input.sendBacks) ids.push(sendBack.sentBackBy)
  return ids
}

export { buildChangeRequestTimeline, collectChangeRequestTimelineActorIds }
export type { BuildChangeRequestTimelineInput, ChangeTimelineRevisionInput, ChangeTimelineSendBackInput }
