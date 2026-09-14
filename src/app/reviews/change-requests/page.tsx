import Link from "next/link"

import { AuthGate } from "@/components/product/auth-gate"
import { PageHeader } from "@/components/product/page-header"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getCurrentNexusSession } from "@/platform/auth/server"
import { listChangeRequestReviewQueue } from "@/features/customer-change/server"
import { formatChangeRequestId } from "@/features/customer-change"
import { getCustomerById } from "@/features/customers/server"

/**
 * Customer Change Request review queue (Customer Lifecycle V1, task
 * §7): every Change Request currently awaiting a decision (status
 * submitted or resubmitted), oldest first. Mirrors /reviews/page.tsx's
 * own shape for the equivalent onboarding queue.
 */
export const dynamic = "force-dynamic"

const CUSTOMER_READ = { resource: "customer", action: "read" }

export default async function ChangeRequestReviewsRoute() {
  const session = await getCurrentNexusSession()
  const entries = await listChangeRequestReviewQueue()
  const withCustomers = await Promise.all(
    entries.map(async (entry) => ({ ...entry, customer: await getCustomerById(entry.customerId) }))
  )

  return (
    <AuthGate session={session} requiredPermission={CUSTOMER_READ} loginRedirectTo="/reviews/change-requests">
      <div className="flex flex-1 flex-col">
        <PageHeader
          title="Change Request Reviews"
          description="Customer Change Requests awaiting a decision."
          actions={
            <Link href="/reviews" className="text-xs font-medium text-foreground underline underline-offset-2">
              Onboarding Reviews
            </Link>
          }
        />

        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-4 sm:px-6 sm:py-6">
          {withCustomers.length === 0 ? (
            <p className="text-xs text-muted-foreground">No Change Requests are currently awaiting review.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Request</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {withCustomers.map((entry) => (
                    <TableRow key={entry.requestId}>
                      <TableCell className="font-mono text-xs text-muted-foreground">{formatChangeRequestId(entry.requestNumber)}</TableCell>
                      <TableCell className="font-medium text-foreground">{entry.customer?.name ?? "(unknown customer)"}</TableCell>
                      <TableCell>
                        <Badge variant="ghost" className="bg-muted text-muted-foreground">
                          {entry.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(entry.updatedAt).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Link href={`/reviews/change-requests/${entry.requestId}`} className="text-xs font-medium text-foreground underline underline-offset-2">
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
