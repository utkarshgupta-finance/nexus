import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { StatusBadge } from "@/components/product/status-badge"
import { formatCurrency } from "@/lib/format"
import type { WorkItem } from "../types"

function WorkQueueTable({
  items,
  onSelect,
}: {
  items: WorkItem[]
  onSelect: (item: WorkItem) => void
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Work item</TableHead>
          <TableHead>Module</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Owner</TableHead>
          <TableHead className="text-right">Age</TableHead>
          <TableHead className="text-right">Value</TableHead>
          <TableHead>Next action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.length === 0 ? (
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={7} className="py-10 text-center text-xs text-muted-foreground">
              No work items match the current filters.
            </TableCell>
          </TableRow>
        ) : (
          items.map((item) => (
            <TableRow
              key={item.id}
              className="cursor-pointer"
              onClick={() => onSelect(item)}
            >
              <TableCell>
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium text-foreground">{item.item}</span>
                  <span className="text-[0.7rem] text-muted-foreground">
                    {item.customer}
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">{item.module}</TableCell>
              <TableCell>
                <StatusBadge status={item.status} />
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Avatar size="sm">
                    <AvatarFallback>{item.owner.initials}</AvatarFallback>
                  </Avatar>
                  <span className="text-foreground">{item.owner.name}</span>
                </div>
              </TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">
                {item.ageDays}d
              </TableCell>
              <TableCell className="text-right tabular-nums text-foreground">
                {formatCurrency(item.value)}
              </TableCell>
              <TableCell className="max-w-52 truncate text-foreground">
                {item.nextAction}
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  )
}

export { WorkQueueTable }
