"use client"

import { useEffect, useState } from "react"
import { CheckCircle2Icon, CircleSlashIcon, ClockIcon, Loader2Icon } from "lucide-react"

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { getReferenceOptionActivityAction } from "../actions"
import type { ReferenceOptionActivityEvent } from "../domain/activity"

/**
 * P-021 Product Decision: "I am looking at this Reference Master value.
 * Show me what happened to this value." A per-row Activity drawer, never
 * a separate global audit-log product. Fetches on open (not pre-loaded
 * for every row, matching this table's own Level 1/2/3 lists totaling
 * hundreds of rows across the workspace) via the same `../actions.ts`
 * Server Action boundary every other mutation on this page already uses,
 * so History visibility gets the same real, server-side
 * `reference_master.read` check, never a client-trusted one.
 */

type ActivityTarget = { listKey: string; code: string; label: string; active: boolean }

type ActivityState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; events: ReferenceOptionActivityEvent[] }

/**
 * Mounted fresh (via a `key` keyed on the target's identity, see the
 * parent below) each time a different row's Activity is opened, so
 * `useState`'s own initial value is the loading reset: the effect below
 * only ever transitions to a final `error`/`ready` state, never
 * synchronously resets to `loading` itself.
 */
function ActivityContent({ target }: { target: ActivityTarget }) {
  const [state, setState] = useState<ActivityState>({ status: "loading" })

  useEffect(() => {
    let cancelled = false
    getReferenceOptionActivityAction(target.listKey, target.code).then((result) => {
      if (cancelled) return
      setState(result.ok ? { status: "ready", events: result.events } : { status: "error", message: result.error })
    })
    return () => {
      cancelled = true
    }
  }, [target.listKey, target.code])

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <SheetHeader>
        <SheetTitle>{target.label}</SheetTitle>
        <SheetDescription>Activity</SheetDescription>
      </SheetHeader>

      <div className="flex flex-col gap-4 px-6 pb-6">
        <div>
          <Badge variant="ghost" className={target.active ? "gap-1 bg-success/10 text-success" : "gap-1 bg-muted text-muted-foreground"}>
            {target.active ? <CheckCircle2Icon data-icon="inline-start" className="size-3" /> : <CircleSlashIcon data-icon="inline-start" className="size-3" />}
            {target.active ? "Active" : "Inactive"}
          </Badge>
        </div>

        <Separator />

        {state.status === "loading" ? (
          <div className="flex items-center gap-2 py-6 text-xs text-muted-foreground">
            <Loader2Icon className="size-3.5 animate-spin" />
            <span>Loading activity...</span>
          </div>
        ) : state.status === "error" ? (
          <div className="flex items-start gap-2 py-2">
            <ClockIcon className="mt-0.5 size-3.5 shrink-0 text-destructive" />
            <p className="text-xs text-destructive">{state.message}</p>
          </div>
        ) : state.events.length === 0 ? (
          <div className="flex items-start gap-2 py-2">
            <ClockIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">No activity recorded yet.</p>
          </div>
        ) : (
          <ol className="flex flex-col gap-4">
            {state.events.map((event) => (
              <li key={event.id} className="flex gap-3">
                <div className="mt-1 size-1.5 shrink-0 rounded-full bg-muted-foreground" />
                <div className="flex flex-col gap-0.5">
                  <p className="text-xs font-medium text-foreground">{event.action}</p>
                  {event.change ? (
                    <p className="text-xs text-muted-foreground">
                      {event.change.from} &rarr; {event.change.to}
                    </p>
                  ) : null}
                  <p className="text-[0.7rem] text-muted-foreground">
                    {new Date(event.occurredAt).toLocaleString()} &middot; {event.actorLabel}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}

function ReferenceOptionActivitySheet({
  target,
  open,
  onOpenChange,
}: {
  target: ActivityTarget | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md">
        {target ? <ActivityContent key={`${target.listKey}:${target.code}`} target={target} /> : null}
      </SheetContent>
    </Sheet>
  )
}

export { ReferenceOptionActivitySheet }
export type { ActivityTarget }
