import { AlertTriangleIcon, ArrowRightIcon } from "lucide-react"

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/product/status-badge"
import { formatCurrency } from "@/lib/format"
import type { WorkItem } from "../types"

function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[0.7rem] text-muted-foreground">{label}</span>
      <span className="text-xs text-foreground">{value}</span>
    </div>
  )
}

function WorkItemDetailSheet({
  item,
  open,
  onOpenChange,
}: {
  item: WorkItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md">
        {item ? (
          <div className="flex h-full flex-col">
            <SheetHeader>
              <SheetTitle>{item.item}</SheetTitle>
              <SheetDescription>
                {item.id} · {item.customer}
              </SheetDescription>
            </SheetHeader>

            <div className="flex flex-col gap-4 overflow-y-auto px-6 pb-6">
              {item.exceptionNote ? (
                <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/5 px-3 py-2">
                  <AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0 text-warning" />
                  <p className="text-xs text-foreground">{item.exceptionNote}</p>
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <DetailField label="Customer" value={item.customer} />
                <DetailField label="Module" value={item.module} />
                <DetailField
                  label="Status"
                  value={<StatusBadge status={item.status} />}
                />
                <DetailField label="Owner" value={item.owner.name} />
                <DetailField label="Created" value={item.createdAt} />
                <DetailField label="Submitted" value={item.submittedAt} />
                <DetailField
                  label="Value"
                  value={
                    <span className="tabular-nums">
                      {formatCurrency(item.value)}
                    </span>
                  }
                />
                <DetailField label="Age" value={`${item.ageDays}d`} />
              </div>

              <Separator />

              <div className="flex items-start gap-2 rounded-md bg-muted/40 px-3 py-2">
                <ArrowRightIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                <div className="flex flex-col gap-0.5">
                  <span className="text-[0.7rem] text-muted-foreground">
                    Next action
                  </span>
                  <span className="text-xs font-medium text-foreground">
                    {item.nextAction}
                  </span>
                </div>
              </div>

              <Separator />

              <div className="flex flex-col gap-3">
                <span className="text-[0.7rem] font-medium text-muted-foreground">
                  Activity
                </span>
                <ol className="relative flex flex-col gap-4 border-l border-border/70 pl-4">
                  {item.activity.map((event, index) => (
                    <li key={index} className="relative flex flex-col gap-0.5">
                      <span className="absolute top-1 -left-[1.1rem] size-1.5 rounded-full bg-muted-foreground/40" />
                      <span className="text-xs text-foreground">{event.label}</span>
                      <span className="text-[0.7rem] text-muted-foreground">
                        {event.actor} · {event.when}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>

            <SheetFooter className="flex-row gap-2 border-t">
              <Button variant="outline" className="flex-1" disabled>
                Send back
              </Button>
              <Button className="flex-1" disabled>
                Approve
              </Button>
            </SheetFooter>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

export { WorkItemDetailSheet }
