import type { RequestTimelineEvent } from "@/components/product/request-timeline"

/**
 * A single Commercial Configuration Version's own readable Timeline
 * (Platform Scale Program, Phase I / CFO lens). Unlike Onboarding and
 * Customer Change, a Commercial Version has no send-back state at all
 * (only a terminal Reject, per docs/COMMERCIAL_DOMAIN_ARCHITECTURE.md's
 * own status model: draft/submitted/approved/rejected, no "resubmitted"),
 * so there is only ever one submission and one decision to record; no
 * new table was needed for this Timeline, only this read-model
 * composition.
 */
type BuildCommercialVersionTimelineInput = {
  createdAt: string
  createdBy: string | null
  submittedAt: string | null
  submittedBy: string | null
  decidedAt: string | null
  decidedBy: string | null
  decisionStatus: "approved" | "rejected" | null
  decisionReason: string | null
  actorEmails: Map<string, string | null>
}

function actorLabel(actorId: string | null, actorEmails: Map<string, string | null>): string | null {
  if (!actorId) return null
  return actorEmails.get(actorId) ?? null
}

function buildCommercialVersionTimeline(input: BuildCommercialVersionTimelineInput): RequestTimelineEvent[] {
  const events: RequestTimelineEvent[] = [
    { id: "created", occurredAt: input.createdAt, actorEmail: actorLabel(input.createdBy, input.actorEmails), summary: "Version created" },
  ]

  if (input.submittedAt) {
    events.push({ id: "submitted", occurredAt: input.submittedAt, actorEmail: actorLabel(input.submittedBy, input.actorEmails), summary: "Submitted for review" })
  }

  if (input.decidedAt && input.decisionStatus) {
    events.push({
      id: "decided",
      occurredAt: input.decidedAt,
      actorEmail: actorLabel(input.decidedBy, input.actorEmails),
      summary: input.decisionStatus === "approved" ? "Approved" : `Rejected: ${input.decisionReason ?? "no reason given"}`,
    })
  }

  return events.sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime())
}

function collectCommercialVersionTimelineActorIds(input: Omit<BuildCommercialVersionTimelineInput, "actorEmails">): (string | null)[] {
  return [input.createdBy, input.submittedBy, input.decidedBy]
}

export { buildCommercialVersionTimeline, collectCommercialVersionTimelineActorIds }
export type { BuildCommercialVersionTimelineInput }
