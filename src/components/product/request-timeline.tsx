/**
 * The one shared, chronological request-history renderer (Platform Scale
 * Program, Phase I / `docs/UI_SYSTEM.md` §19's `WorkflowTimeline`):
 * real actors and timestamps, oldest first, never raw audit_log JSON.
 * Promoted here from what was `customer-onboarding/ui/onboarding-timeline.tsx`
 * once Customer Change and Commercial Version needed the identical
 * rendering: the event SHAPE was already fully domain-agnostic
 * (`id`/`occurredAt`/`actorEmail`/`summary`), only where it lived was
 * onboarding-specific. Building the actual event list stays in each
 * feature's own `domain/timeline.ts` (what counts as an event is
 * business-specific and genuinely differs per lifecycle); only the
 * rendering is shared.
 */
type RequestTimelineEvent = {
  id: string
  occurredAt: string
  actorEmail: string | null
  summary: string
}

function RequestTimeline({ events }: { events: RequestTimelineEvent[] }) {
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

export { RequestTimeline }
export type { RequestTimelineEvent }
