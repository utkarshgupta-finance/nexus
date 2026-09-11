import { CheckCircle2Icon, CircleDashedIcon, CircleSlashIcon, type LucideIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

/**
 * Compact, semantic, icon-paired state indicator for a Commercial
 * Component, matching docs/UI_SYSTEM.md §12: never colour-only, rendered
 * identically wherever it appears. Not the shared NexusStatus badge
 * (@/components/product/status-badge): Commercial Component state
 * (current/superseded/closed) is a different concept from workflow
 * status (draft/review/approved/...), and forcing it into that union
 * would misrepresent it.
 */

type CommercialComponentState = "current" | "superseded" | "closed"

const STATE_CONFIG: Record<CommercialComponentState, { label: string; icon: LucideIcon; className: string }> = {
  current: {
    label: "Current",
    icon: CheckCircle2Icon,
    className: "bg-success/10 text-success dark:bg-success/15",
  },
  superseded: {
    label: "Superseded",
    icon: CircleDashedIcon,
    className: "bg-muted text-muted-foreground",
  },
  closed: {
    label: "Closed",
    icon: CircleSlashIcon,
    className: "bg-muted text-muted-foreground",
  },
}

function CommercialComponentStateBadge({ state, className }: { state: CommercialComponentState; className?: string }) {
  const config = STATE_CONFIG[state]
  const Icon = config.icon
  return (
    <Badge variant="ghost" className={cn("gap-1 rounded-md px-1.5 font-normal", config.className, className)}>
      <Icon data-icon="inline-start" className="size-3" />
      {config.label}
    </Badge>
  )
}

/** Derives display state structurally: a Component is "superseded" when some other Component's supersedesComponentId points at it, "closed" when it has an end date but was not superseded, otherwise "current". */
function deriveComponentState(
  componentId: string,
  effectiveTo: string | null,
  supersededComponentIds: ReadonlySet<string>
): CommercialComponentState {
  if (supersededComponentIds.has(componentId)) return "superseded"
  if (effectiveTo) return "closed"
  return "current"
}

export { CommercialComponentStateBadge, deriveComponentState }
export type { CommercialComponentState }
