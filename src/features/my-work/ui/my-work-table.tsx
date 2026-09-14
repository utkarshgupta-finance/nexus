import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { labelForItemType, labelForCaseStatus } from "@/platform/approvals/domain/inbox"
import type { MyWorkItem } from "@/platform/approvals/domain/my-work"

/** One "Needs My Action" section (task spec): Sent Back to Me, or Pending My Approval. */
function MyWorkTable({ title, items }: { title: string; items: MyWorkItem[] }) {
  if (items.length === 0) return null
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {title} ({items.length})
      </h2>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Type</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>What I need to do</TableHead>
              <TableHead>Age</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Open</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={`${item.type}-${item.requestId}`} className="hover:bg-transparent">
                <TableCell className="text-foreground">{labelForItemType(item.type)}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{item.displayId}</TableCell>
                <TableCell className="font-medium text-foreground">{item.customerName}</TableCell>
                <TableCell className="text-muted-foreground">{item.whatINeedToDo}</TableCell>
                <TableCell className="text-muted-foreground">
                  {item.ageDays} day{item.ageDays === 1 ? "" : "s"}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="ghost"
                    className={item.reason === "sent_back_to_me" ? "bg-warning/10 text-warning" : "bg-muted text-muted-foreground"}
                  >
                    {labelForCaseStatus(item.status)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button variant="outline" size="sm" render={<Link href={item.href} />}>
                    Open
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

export { MyWorkTable }
