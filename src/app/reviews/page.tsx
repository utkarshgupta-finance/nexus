import Link from "next/link"

import { AuthGate } from "@/components/product/auth-gate"
import { PageHeader } from "@/components/product/page-header"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getCurrentNexusSession } from "@/platform/auth/server"
import { listOnboardingReviewQueue, formatOnboardingCaseId } from "@/features/customer-onboarding/server"

/**
 * Review queue (Customer Lifecycle V1, task §7): every Customer
 * Onboarding Case currently awaiting a decision (status submitted or
 * resubmitted), oldest first. `customer.read` gates visibility; the
 * actual Approve/Send Back actions are independently re-checked against
 * `customer.approve` on the detail page and inside the Server Actions
 * themselves.
 */
export const dynamic = "force-dynamic"

const CUSTOMER_READ = { resource: "customer", action: "read" }

export default async function ReviewsRoute() {
  const session = await getCurrentNexusSession()
  const entries = await listOnboardingReviewQueue()

  return (
    <AuthGate session={session} requiredPermission={CUSTOMER_READ} loginRedirectTo="/reviews">
      <div className="flex flex-1 flex-col">
        <PageHeader
          title="Reviews"
          description="Customer Onboarding cases awaiting a decision."
          actions={
            <div className="flex items-center gap-4">
              <Link href="/reviews/change-requests" className="text-xs font-medium text-foreground underline underline-offset-2">
                Change Request Reviews
              </Link>
              <Link href="/reviews/commercial-versions" className="text-xs font-medium text-foreground underline underline-offset-2">
                Commercial Version Reviews
              </Link>
            </div>
          }
        />

        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-4 sm:px-6 sm:py-6">
          {entries.length === 0 ? (
            <p className="text-xs text-muted-foreground">No onboarding cases are currently awaiting review.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Request</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Revision</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => (
                    <TableRow key={entry.requestId}>
                      <TableCell className="font-mono text-xs text-muted-foreground">{formatOnboardingCaseId(entry.caseNumber)}</TableCell>
                      <TableCell className="font-medium text-foreground">{entry.customerLegalName}</TableCell>
                      <TableCell>
                        <Badge variant="ghost" className="bg-muted text-muted-foreground">
                          {entry.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{entry.currentRevisionNumber}</TableCell>
                      <TableCell>{new Date(entry.updatedAt).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Link href={`/reviews/${entry.requestId}`} className="text-xs font-medium text-foreground underline underline-offset-2">
                          Open
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </AuthGate>
  )
}
