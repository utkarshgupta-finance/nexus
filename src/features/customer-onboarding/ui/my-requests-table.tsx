import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { labelForCaseStatus } from "@/platform/approvals/domain/inbox"
import { formatOnboardingCaseId } from "../domain/types"
import { reviewState, primaryAction } from "../domain/my-requests"
import type { MyRequestRow } from "../domain/my-requests"

function MyRequestsTable({ rows }: { rows: MyRequestRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-md border border-dashed px-4 py-8">
        <p className="text-xs font-medium text-foreground">No customer onboarding requests yet.</p>
        <Button size="sm" render={<Link href="/forms/customer-onboarding/new" />}>
          Create Customer Onboarding
        </Button>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Request</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead className="hidden md:table-cell">Brand</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden lg:table-cell">Review State</TableHead>
            <TableHead className="hidden sm:table-cell">Revision</TableHead>
            <TableHead className="hidden sm:table-cell">Sent Back</TableHead>
            <TableHead className="hidden md:table-cell">Last Updated</TableHead>
            <TableHead className="hidden lg:table-cell">Created At</TableHead>
            <TableHead>Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const action = primaryAction(row)
            return (
              <TableRow key={row.requestId} className="hover:bg-transparent">
                <TableCell className="font-mono text-xs text-muted-foreground">{formatOnboardingCaseId(row.caseNumber)}</TableCell>
                <TableCell className="font-medium text-foreground">{row.legalName || "(untitled)"}</TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">{row.brandName || "-"}</TableCell>
                <TableCell>
                  <Badge
                    variant="ghost"
                    className={row.status === "sent_back" ? "bg-warning/10 text-warning" : "bg-muted text-muted-foreground"}
                  >
                    {labelForCaseStatus(row.status)}
                  </Badge>
                </TableCell>
                <TableCell className="hidden text-muted-foreground lg:table-cell">{reviewState(row.status, row.currentStageKey)}</TableCell>
                <TableCell className="hidden text-muted-foreground sm:table-cell">{row.revisionNumber}</TableCell>
                <TableCell className="hidden text-muted-foreground sm:table-cell">{row.sentBackCount}</TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">{new Date(row.updatedAt).toLocaleDateString()}</TableCell>
                <TableCell className="hidden text-muted-foreground lg:table-cell">{new Date(row.createdAt).toLocaleDateString()}</TableCell>
                <TableCell>
                  <Button variant="outline" size="sm" render={<Link href={action.href} />}>
                    {action.label}
                  </Button>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

export { MyRequestsTable }
export type { MyRequestRow }
