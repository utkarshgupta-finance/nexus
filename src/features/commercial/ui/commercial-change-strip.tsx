import { commercialChangeCategoryLabel } from "@/features/commercial"
import type { ChangeSummary } from "@/features/commercial"

/**
 * Compact chronological Change/supersession context (docs/UI_SYSTEM.md
 * §14: "what happened, who, when," progressive disclosure for detail).
 * Deliberately not the full Finance Activity feed, which is a later
 * stage; this shows only Commercial Changes, newest first.
 */

function CommercialChangeStrip({ changes }: { changes: ChangeSummary[] }) {
  const sorted = [...changes].sort((a, b) => (a.effectiveDate < b.effectiveDate ? 1 : -1))

  return (
    <div className="flex flex-col gap-2">
      <h2 className="px-6 text-[0.7rem] font-medium tracking-wide text-muted-foreground uppercase">
        Recent changes
      </h2>
      {sorted.length === 0 ? (
        <p className="px-6 pb-4 text-xs text-muted-foreground">No commercial changes recorded yet.</p>
      ) : (
        <ol className="relative flex flex-col gap-3 px-6 pb-4">
          {sorted.map((change) => (
            <li key={change.id} className="relative flex items-baseline gap-2 border-l border-border/70 pl-4">
              <span className="absolute top-1 -left-[3px] size-1.5 rounded-full bg-muted-foreground/40" />
              <span className="w-24 shrink-0 text-[0.7rem] tabular-nums text-muted-foreground">
                {change.effectiveDate}
              </span>
              <span className="text-xs font-medium text-foreground">
                {commercialChangeCategoryLabel(change.category)}
              </span>
              {change.reason ? <span className="text-xs text-muted-foreground">{change.reason}</span> : null}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

export { CommercialChangeStrip }
