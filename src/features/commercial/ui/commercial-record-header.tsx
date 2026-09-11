import { Badge } from "@/components/ui/badge"
import { commercialChangeCategoryLabel } from "@/features/commercial"
import type { CommercialConfigurationOverview } from "@/features/commercial"

/**
 * Record header: identity, current state, and structured properties
 * (docs/UI_SYSTEM.md §13 "Header" + "Properties"). No primary action
 * yet: this screen is read-only until a write path exists behind a real
 * authorization boundary.
 *
 * The metadata row uses the same compact, divider-separated inline
 * strip already proven by WorkSummaryStrip
 * (features/my-work/components/work-summary-strip.tsx), not a
 * full-width grid: a grid stretched across the whole record width would
 * scatter a handful of short facts across a lot of empty space, which
 * is exactly the "unused whitespace" anti-pattern docs/UI_SYSTEM.md §6
 * warns against.
 */

function CommercialRecordHeader({ overview }: { overview: CommercialConfigurationOverview }) {
  const { configuration, components, commitments, changes } = overview

  const currencies = [...new Set(components.map((component) => component.transactionCurrency))]
  const earliestChange = changes.reduce<CommercialConfigurationOverview["changes"][number] | null>(
    (earliest, change) => (!earliest || change.effectiveDate < earliest.effectiveDate ? change : earliest),
    null
  )
  const mostRecentChange = changes.reduce<CommercialConfigurationOverview["changes"][number] | null>(
    (latest, change) => (!latest || change.effectiveDate > latest.effectiveDate ? change : latest),
    null
  )

  const metadata = [
    { label: "Active since", value: earliestChange ? earliestChange.effectiveDate : "-" },
    { label: "Components", value: String(components.length) },
    { label: "Commitments", value: String(commitments.length) },
    { label: "Currency", value: currencies.length > 0 ? currencies.join(", ") : "-" },
    {
      label: "Last change",
      value: mostRecentChange
        ? `${mostRecentChange.effectiveDate} · ${commercialChangeCategoryLabel(mostRecentChange.category)}`
        : "-",
    },
  ]

  return (
    <div className="flex flex-col gap-3 border-b px-6 py-4">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <h1 className="text-base font-semibold text-foreground">{configuration.name}</h1>
          <Badge
            variant="ghost"
            className={
              configuration.isActive
                ? "bg-success/10 text-success dark:bg-success/15"
                : "bg-muted text-muted-foreground"
            }
          >
            {configuration.isActive ? "Active" : "Inactive"}
          </Badge>
        </div>
        <p className="font-mono text-[0.7rem] text-muted-foreground">{configuration.key}</p>
      </div>

      {configuration.relationshipNote ? (
        <p className="text-xs text-muted-foreground">{configuration.relationshipNote}</p>
      ) : null}

      <div className="flex flex-wrap items-center gap-4">
        {metadata.map((item, index) => (
          <div key={item.label} className="flex items-center gap-4">
            {index > 0 ? <span className="h-3 w-px bg-border" aria-hidden /> : null}
            <div className="flex items-baseline gap-1.5">
              <span className="text-xs text-muted-foreground">{item.label}</span>
              <span className="text-xs font-semibold tabular-nums text-foreground">{item.value}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export { CommercialRecordHeader }
