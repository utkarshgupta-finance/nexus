import type { RequestTimelineEvent } from "@/components/product/request-timeline"

/**
 * A single onboarding request's own readable Timeline (task spec: "full
 * readable activity/timeline per request with real actors/timestamps").
 * Built entirely from data already persisted (the case row, its
 * submission_revisions, and its customer_onboarding_send_backs history),
 * never raw audit_log JSON. Pure composition only, matching
 * ../../customers/domain/activity.ts's own shape: no I/O, unit-testable
 * without Supabase.
 */

/** Same shape every other domain's own Timeline already uses (../../customer-change/domain/timeline.ts etc); kept as its own name here only because this feature's existing exports already use it, not because the shape actually differs. */
type OnboardingTimelineEvent = RequestTimelineEvent

type OnboardingTimelineRevisionInput = { revisionNumber: number; submittedAt: string | null; submittedBy: string | null }

type OnboardingTimelineSendBackInput = { revisionNumber: number; reason: string; sentBackBy: string | null; sentBackAt: string }

type BuildOnboardingTimelineInput = {
  createdAt: string
  createdBy: string | null
  approvedAt: string | null
  approvedBy: string | null
  revisions: OnboardingTimelineRevisionInput[]
  sendBacks: OnboardingTimelineSendBackInput[]
  actorLabels: Map<string, string | null>
  /** Workflow Runtime V1 UX + Audit Closure: see ../../customer-change/domain/timeline.ts's own BuildChangeRequestTimelineInput.workflowTransitionEvents for the full contract. When non-empty, replaces the send-back/approved events below. */
  workflowTransitionEvents?: RequestTimelineEvent[]
}

function actorLabel(actorId: string | null, actorLabels: Map<string, string | null>): string | null {
  if (!actorId) return null
  return actorLabels.get(actorId) ?? null
}

/** Oldest first: a single request's own history reads naturally top-to-bottom as "what happened, in order", unlike the newest-first Customer Activity feed. */
function buildOnboardingTimeline(input: BuildOnboardingTimelineInput): OnboardingTimelineEvent[] {
  const hasWorkflowHistory = (input.workflowTransitionEvents?.length ?? 0) > 0

  const events: OnboardingTimelineEvent[] = [
    {
      id: "created",
      occurredAt: input.createdAt,
      actorEmail: actorLabel(input.createdBy, input.actorLabels),
      summary: "Request created",
    },
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

  if (hasWorkflowHistory) {
    events.push(...(input.workflowTransitionEvents ?? []))
  } else {
    for (const sendBack of input.sendBacks) {
      events.push({
        id: `sent-back-${sendBack.revisionNumber}-${sendBack.sentBackAt}`,
        occurredAt: sendBack.sentBackAt,
        actorEmail: actorLabel(sendBack.sentBackBy, input.actorLabels),
        summary: `Sent back: ${sendBack.reason}`,
      })
    }

    if (input.approvedAt) {
      events.push({
        id: "approved",
        occurredAt: input.approvedAt,
        actorEmail: actorLabel(input.approvedBy, input.actorLabels),
        summary: "Approved",
      })
    }
  }

  return events.sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime())
}

/** Every actor id referenced anywhere in the timeline inputs, so the caller can resolve them all in one batched lookup before building the timeline. */
function collectOnboardingTimelineActorIds(input: Omit<BuildOnboardingTimelineInput, "actorLabels" | "workflowTransitionEvents">): (string | null)[] {
  const ids: (string | null)[] = [input.createdBy, input.approvedBy]
  for (const revision of input.revisions) ids.push(revision.submittedBy)
  for (const sendBack of input.sendBacks) ids.push(sendBack.sentBackBy)
  return ids
}

export { buildOnboardingTimeline, collectOnboardingTimelineActorIds }
export type { OnboardingTimelineEvent, BuildOnboardingTimelineInput, OnboardingTimelineRevisionInput, OnboardingTimelineSendBackInput }
