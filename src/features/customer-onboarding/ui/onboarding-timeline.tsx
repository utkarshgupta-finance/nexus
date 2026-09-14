import type { OnboardingTimelineEvent } from "../domain/timeline"

/**
 * One onboarding request's readable Timeline (task spec): real actors and
 * timestamps, oldest first, never raw audit_log JSON. Shared by both the
 * requester's own request view and the reviewer's Review screen, so the
 * same history reads identically on either side.
 */
function OnboardingTimeline({ events }: { events: OnboardingTimelineEvent[] }) {
  if (events.length === 0) return null
  return (
    <section className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm sm:p-6">
      <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Timeline</h2>
      <ol className="flex flex-col gap-3">
        {events.map((event) => (
          <li key={event.id} className="flex flex-col gap-0.5 border-l-2 border-muted pl-3">
            <span className="text-xs text-foreground">{event.summary}</span>
            <span className="text-[11px] text-muted-foreground">
              {new Date(event.occurredAt).toLocaleString()}
              {event.actorEmail ? ` · ${event.actorEmail}` : ""}
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}

export { OnboardingTimeline }
