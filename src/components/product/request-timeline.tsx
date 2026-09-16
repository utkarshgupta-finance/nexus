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
import { formatTimestamp } from "@/lib/date"

type RequestTimelineEvent = {
  id: string
  occurredAt: string
  actorEmail: string | null
  summary: string
  /** Progressive disclosure (Workflow Runtime V1 UX + Audit Closure): a Send Back/Reject comment or reason, shown as its own secondary line rather than folded into `summary`. Omit when there is nothing worth a second line. */
  detail?: string
  /** "marker" is a subtle, de-emphasized grouping label (currently only "Approval cycle N", shown only when a request has been sent back and restarted at least once) rather than a real actor/action event: no border accent, no actor line, smaller and muted. */
  variant?: "marker"
}

function RequestTimeline({ events }: { events: RequestTimelineEvent[] }) {
  if (events.length === 0) return null
  return (
    <section className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm sm:p-6">
      <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Timeline</h2>
      <ol className="flex flex-col gap-3">
        {events.map((event) =>
          event.variant === "marker" ? (
            <li key={event.id} className="pt-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              {event.summary}
            </li>
          ) : (
            <li key={event.id} className="flex flex-col gap-0.5 border-l-2 border-muted pl-3">
              <span className="text-xs text-foreground">{event.summary}</span>
              <span className="text-[11px] text-muted-foreground">
                {formatTimestamp(event.occurredAt)}
                {event.actorEmail ? ` · ${event.actorEmail}` : ""}
              </span>
              {event.detail ? <span className="text-[11px] text-muted-foreground italic">&ldquo;{event.detail}&rdquo;</span> : null}
            </li>
          )
        )}
      </ol>
    </section>
  )
}

export { RequestTimeline }
export type { RequestTimelineEvent }
