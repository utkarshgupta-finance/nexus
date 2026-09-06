import { cn } from "@/lib/utils"

function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string
  description?: string
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 border-b px-6 py-3.5",
        className
      )}
    >
      <div className="flex flex-col gap-0.5">
        <h1 className="text-sm font-semibold text-foreground">{title}</h1>
        {description ? (
          <p className="text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  )
}

export { PageHeader }
