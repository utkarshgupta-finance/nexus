import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { labelForItemType, labelForCaseStatus } from "@/platform/approvals/domain/inbox"
import type { OperationalQueueEntry } from "@/platform/approvals/domain/operational-queue"

/**
 * Operational queue (Platform Scale Closure, Phase L): a plain
 * operational list, not a dashboard. One row per pending request across
 * all three lifecycles, oldest first, so the most-stuck work is always
 * at the top without anyone needing to sort for it.
 */
function OperationalQueueTable({ entries }: { entries: OperationalQueueEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-start gap-1 rounded-md border border-dashed px-4 py-8">
        <p className="text-xs font-medium text-foreground">Nothing is currently pending.</p>
      </div>
    )
  }
  const stuckEntries = entries.filter((entry) => !entry.hasEligibleApprover)
  return (
    <div className="flex flex-col gap-3">
      {stuckEntries.length > 0 ? (
        <div className="flex flex-col gap-1 rounded-md border border-warning/40 bg-warning/10 px-4 py-3">
          <p className="text-xs font-medium text-foreground">
            {stuckEntries.length} item{stuckEntries.length === 1 ? "" : "s"} {stuckEntries.length === 1 ? "has" : "have"} no eligible approver.
          </p>
          <p className="text-xs text-muted-foreground">
            The team responsible has zero active members. To recover: add an active member back to the team, or reassign the item if a governed
            reassignment path exists for its type, in Team Master.
          </p>
        </div>
      ) : null}
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Type</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Current Responsibility</TableHead>
              <TableHead>Team</TableHead>
              <TableHead>Age</TableHead>
              <TableHead>Sent Back</TableHead>
              <TableHead>Open</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => (
              <TableRow key={`${entry.type}-${entry.requestId}`} className="hover:bg-transparent">
                <TableCell className="text-foreground">{labelForItemType(entry.type)}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{entry.displayId}</TableCell>
                <TableCell className="font-medium text-foreground">{entry.customerName}</TableCell>
                <TableCell>
                  <Badge variant="ghost" className="bg-muted text-muted-foreground">
                    {labelForCaseStatus(entry.status)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="ghost" className="bg-primary/10 text-primary">
                    {entry.currentResponsibility}
                  </Badge>
                </TableCell>
                <TableCell>
                  {entry.responsibleTeamName ? (
                    <div className="flex flex-col gap-1">
                      <span className="text-muted-foreground">{entry.responsibleTeamName}</span>
                      {!entry.hasEligibleApprover ? (
                        <Badge variant="ghost" className="w-fit bg-destructive/10 text-destructive">
                          No eligible approver
                        </Badge>
                      ) : null}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {entry.ageDays} day{entry.ageDays === 1 ? "" : "s"}
                </TableCell>
                <TableCell className="text-muted-foreground">{entry.sentBackCount}</TableCell>
                <TableCell>
                  <Button variant="outline" size="sm" render={<Link href={entry.href} />}>
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

export { OperationalQueueTable }
