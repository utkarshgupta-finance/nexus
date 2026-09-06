function WorkSummaryStrip({
  items,
}: {
  items: { label: string; value: number }[]
}) {
  return (
    <div className="flex items-center gap-4 border-b px-6 py-2.5">
      {items.map((item, index) => (
        <div key={item.label} className="flex items-center gap-4">
          {index > 0 ? <span className="h-3 w-px bg-border" aria-hidden /> : null}
          <div className="flex items-baseline gap-1.5">
            <span className="text-xs text-muted-foreground">{item.label}</span>
            <span className="text-xs font-semibold tabular-nums text-foreground">
              {item.value}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

export { WorkSummaryStrip }
