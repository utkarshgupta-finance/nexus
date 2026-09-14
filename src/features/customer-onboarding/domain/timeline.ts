/**
 * A single onboarding request's own readable Timeline (task spec: "full
 * readable activity/timeline per request with real actors/timestamps").
 * Built entirely from data already persisted (the case row, its
 * submission_revisions, and its customer_onboarding_send_backs history),
 * never raw audit_log JSON. Pure composition only, matching
 * ../../customers/domain/activity.ts's own shape: no I/O, unit-testable
 * without Supabase.
 */

type OnboardingTimelineEvent = {
  id: string
  occurredAt: string
  actorEmail: string | null
  summary: string
}

type OnboardingTimelineRevisionInput = { revisionNumber: number; submittedAt: string | null; submittedBy: string | null }

type OnboardingTimelineSendBackInput = { revisionNumber: number; reason: string; sentBackBy: string | null; sentBackAt: string }

type BuildOnboardingTimelineInput = {
  createdAt: string
  createdBy: string | null
  approvedAt: string | null
  approvedBy: string | null
  revisions: OnboardingTimelineRevisionInput[]
  sendBacks: OnboardingTimelineSendBackInput[]
  actorEmails: Map<string, string | null>
}

function actorLabel(actorId: string | null, actorEmails: Map<string, string | null>): string | null {
  if (!actorId) return null
  return actorEmails.get(actorId) ?? null
}

/** Oldest first: a single request's own history reads naturally top-to-bottom as "what happened, in order", unlike the newest-first Customer Activity feed. */
function buildOnboardingTimeline(input: BuildOnboardingTimelineInput): OnboardingTimelineEvent[] {
  const events: OnboardingTimelineEvent[] = [
    {
      id: "created",
      occurredAt: input.createdAt,
      actorEmail: actorLabel(input.createdBy, input.actorEmails),
      summary: "Request created",
    },
  ]

  for (const revision of input.revisions) {
    if (!revision.submittedAt) continue
    events.push({
      id: `submitted-${revision.revisionNumber}`,
      occurredAt: revision.submittedAt,
      actorEmail: actorLabel(revision.submittedBy, input.actorEmails),
      summary: revision.revisionNumber === 1 ? "Submitted for review" : `Resubmitted for review (Revision ${revision.revisionNumber})`,
    })
  }

  for (const sendBack of input.sendBacks) {
    events.push({
      id: `sent-back-${sendBack.revisionNumber}-${sendBack.sentBackAt}`,
      occurredAt: sendBack.sentBackAt,
      actorEmail: actorLabel(sendBack.sentBackBy, input.actorEmails),
      summary: `Sent back: ${sendBack.reason}`,
    })
  }

  if (input.approvedAt) {
    events.push({
      id: "approved",
      occurredAt: input.approvedAt,
      actorEmail: actorLabel(input.approvedBy, input.actorEmails),
      summary: "Approved",
    })
  }

  return events.sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime())
}

/** Every actor id referenced anywhere in the timeline inputs, so the caller can resolve them all in one batched lookup before building the timeline. */
function collectOnboardingTimelineActorIds(input: Omit<BuildOnboardingTimelineInput, "actorEmails">): (string | null)[] {
  const ids: (string | null)[] = [input.createdBy, input.approvedBy]
  for (const revision of input.revisions) ids.push(revision.submittedBy)
  for (const sendBack of input.sendBacks) ids.push(sendBack.sentBackBy)
  return ids
}

export { buildOnboardingTimeline, collectOnboardingTimelineActorIds }
export type { OnboardingTimelineEvent, BuildOnboardingTimelineInput, OnboardingTimelineRevisionInput, OnboardingTimelineSendBackInput }
