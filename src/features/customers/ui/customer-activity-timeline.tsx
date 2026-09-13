import { ClockIcon } from "lucide-react"

import { Separator } from "@/components/ui/separator"
import type { CustomerActivityEvent } from "../domain/activity"

/** Customer Activity timeline (task Phase C): a readable operational history, never raw audit JSON. */
function CustomerActivityTimeline({ events }: { events: CustomerActivityEvent[] }) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm sm:p-6">
      <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Activity</h2>
      <Separator />
      {events.length === 0 ? (
        <div className="flex items-start gap-2 py-2">
          <ClockIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">No activity recorded for this customer yet.</p>
        </div>
      ) : (
        <ol className="flex flex-col gap-4">
          {events.map((event) => (
            <li key={event.id} className="flex gap-3">
              <div className="mt-1 size-1.5 shrink-0 rounded-full bg-muted-foreground" />
              <div className="flex flex-col gap-0.5">
                <p className="text-xs font-medium text-foreground">{event.summary}</p>
                <p className="text-[0.7rem] text-muted-foreground">
                  {new Date(event.occurredAt).toLocaleString()}
                  {event.actorEmail ? ` · ${event.actorEmail}` : ""}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

export { CustomerActivityTimeline }
