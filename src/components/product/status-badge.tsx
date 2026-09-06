import {
  FileEditIcon,
  EyeIcon,
  CheckCircle2Icon,
  AlertTriangleIcon,
  BanIcon,
  type LucideIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export type NexusStatus = "draft" | "review" | "approved" | "attention" | "blocked"

const STATUS_CONFIG: Record<
  NexusStatus,
  { label: string; icon: LucideIcon; className: string }
> = {
  draft: {
    label: "Draft",
    icon: FileEditIcon,
    className: "bg-muted text-muted-foreground",
  },
  review: {
    label: "In Review",
    icon: EyeIcon,
    className: "bg-info/10 text-info dark:bg-info/15",
  },
  approved: {
    label: "Approved",
    icon: CheckCircle2Icon,
    className: "bg-success/10 text-success dark:bg-success/15",
  },
  attention: {
    label: "Attention",
    icon: AlertTriangleIcon,
    className: "bg-warning/10 text-warning dark:bg-warning/15",
  },
  blocked: {
    label: "Blocked",
    icon: BanIcon,
    className: "bg-destructive/10 text-destructive dark:bg-destructive/15",
  },
}

function StatusBadge({
  status,
  label,
  className,
}: {
  status: NexusStatus
  label?: string
  className?: string
}) {
  const config = STATUS_CONFIG[status]
  const Icon = config.icon

  return (
    <Badge
      variant="ghost"
      className={cn(
        "gap-1 rounded-md px-1.5 font-normal",
        config.className,
        className
      )}
    >
      <Icon data-icon="inline-start" className="size-3" />
      {label ?? config.label}
    </Badge>
  )
}

export { StatusBadge }
