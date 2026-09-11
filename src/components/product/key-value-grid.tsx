/**
 * Compact structured metadata display with strong label/value alignment,
 * matching the KeyValueGrid behavioural contract in docs/UI_SYSTEM.md
 * §19. Promoted here from src/features/commercial/ui/ once a second
 * feature (Customers) needed the identical shape, per CLAUDE.md's
 * promotion rule ("only move something into platform/ or
 * components/product/ once it's actually needed by more than one
 * feature").
 */

type KeyValueItem = {
  label: string
  value: React.ReactNode
}

function KeyValueGrid({ items, columns = 4 }: { items: KeyValueItem[]; columns?: 2 | 3 | 4 }) {
  const columnClass = columns === 2 ? "sm:grid-cols-2" : columns === 3 ? "sm:grid-cols-3" : "sm:grid-cols-4"
  return (
    <dl className={`grid grid-cols-2 gap-x-6 gap-y-3 ${columnClass}`}>
      {items.map((item) => (
        <div key={item.label} className="flex flex-col gap-0.5">
          <dt className="text-[0.7rem] text-muted-foreground">{item.label}</dt>
          <dd className="text-xs font-medium text-foreground">{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}

export { KeyValueGrid }
export type { KeyValueItem }
