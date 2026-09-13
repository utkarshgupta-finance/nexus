import { Loader2Icon } from "lucide-react"

/**
 * Shared route-transition loading state, rendered by each route's own
 * `loading.tsx` (Next.js App Router convention: shown automatically
 * while a Server Component route navigation is in flight, no per-route
 * hand-rolled loader). Deliberately restrained: an inline row, never a
 * full-screen blocking overlay, since most navigations here resolve in
 * well under a second and an aggressive takeover would be jarring for
 * something this brief.
 */
function RouteLoading({ label }: { label: string }) {
  return (
    <div className="flex flex-1 items-center justify-center py-24">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2Icon className="size-3.5 animate-spin" />
        <span>{label}</span>
      </div>
    </div>
  )
}

export { RouteLoading }
