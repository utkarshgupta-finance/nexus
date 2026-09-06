import { cn } from "@/lib/utils"

function FilterBar({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 border-b bg-muted/20 px-4 py-2",
        className
      )}
    >
      {children}
    </div>
  )
}

export { FilterBar }
