import Link from "next/link"

import { AuthGate } from "@/components/product/auth-gate"
import { PageHeader } from "@/components/product/page-header"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getCurrentNexusSession } from "@/platform/auth/server"
import { listVersionReviewQueue, formatCommercialVersionId } from "@/features/customer-onboarding/server"
import { commercialConfigurationService } from "@/features/commercial/server"
import { getCustomerById } from "@/features/customers/server"

/**
 * Commercial Configuration Version review queue (Customer Lifecycle V1,
 * task §12): every version currently awaiting a decision (status
 * submitted), oldest first. Mirrors /reviews/change-requests/page.tsx's
 * own shape for the equivalent Change Request queue.
 */
export const dynamic = "force-dynamic"

const COMMERCIAL_CONFIGURATION_READ = { resource: "commercial_configuration", action: "read" }

export default async function CommercialVersionReviewsRoute() {
  const session = await getCurrentNexusSession()
  const entries = await listVersionReviewQueue()
  const withCustomers = await Promise.all(
    entries.map(async (entry) => {
      const configuration = await commercialConfigurationService.getCommercialConfiguration(entry.commercialConfigurationId)
      const customer = configuration ? await getCustomerById(configuration.customerId) : null
      return { ...entry, customerName: customer?.name ?? "(unknown customer)" }
    })
  )

  return (
    <AuthGate session={session} requiredPermission={COMMERCIAL_CONFIGURATION_READ} loginRedirectTo="/reviews/commercial-versions">
      <div className="flex flex-1 flex-col">
        <PageHeader
          title="Commercial Version Reviews"
          description="Commercial Configuration Versions awaiting a decision."
          actions={
            <Link href="/reviews" className="text-xs font-medium text-foreground underline underline-offset-2">
              Onboarding Reviews
            </Link>
          }
        />

        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-4 sm:px-6 sm:py-6">
          {withCustomers.length === 0 ? (
            <p className="text-xs text-muted-foreground">No Commercial Configuration Versions are currently awaiting review.</p>
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
                      <TableCell className="font-mono text-xs text-muted-foreground">{formatCommercialVersionId(entry.versionNumber)}</TableCell>
                      <TableCell className="font-medium text-foreground">{entry.customerName}</TableCell>
                      <TableCell>
                        <Badge variant="ghost" className="bg-muted text-muted-foreground">
                          {entry.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(entry.updatedAt).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Link href={`/reviews/commercial-versions/${entry.requestId}`} className="text-xs font-medium text-foreground underline underline-offset-2">
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
