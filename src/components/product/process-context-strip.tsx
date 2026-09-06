type ProcessContext = {
  current: string
  next?: string
  waitingWith?: string
  yourAction: string
}

type ProcessContextStripProps = {
  context: ProcessContext
}

/**
 * Compact answer to the four questions every material Finance request
 * should make obvious: where is it, what happens next, who currently has
 * to act, and does the viewer need to do anything. Deliberately a single
 * dense row, not four cards; this is a supporting strip, not a dashboard.
 */
function ProcessContextStrip({ context }: ProcessContextStripProps) {
  const items: { label: string; value: string }[] = [
    { label: "Current", value: context.current },
    { label: "Next", value: context.next ?? "Not yet determined" },
    { label: "Waiting with", value: context.waitingWith ?? "Unassigned" },
    { label: "Your action", value: context.yourAction },
  ]

  return (
    <div className="flex flex-wrap gap-x-6 gap-y-1 rounded-md border bg-muted/30 px-3 py-2 text-sm">
      {items.map((item) => (
        <div key={item.label} className="flex items-baseline gap-1.5">
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {item.label}
          </span>
          <span className="font-medium text-foreground">{item.value}</span>
        </div>
      ))}
    </div>
  )
}

export { ProcessContextStrip }
export type { ProcessContext }
