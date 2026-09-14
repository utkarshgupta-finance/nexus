import Link from "next/link"

import { AuthGate } from "@/components/product/auth-gate"
import { PageHeader } from "@/components/product/page-header"
import { Button } from "@/components/ui/button"
import { getCurrentNexusSession } from "@/platform/auth/server"
import { listMyOnboardingRequests, getSendBackCountsForRequests } from "@/features/customer-onboarding/server"
import { getCustomersByIds } from "@/features/customers/server"
import { MyRequestsTable } from "@/features/customer-onboarding/ui/my-requests-table"
import { sortMyRequestRows } from "@/features/customer-onboarding/domain/my-requests"
import type { MyRequestRow } from "@/features/customer-onboarding/domain/my-requests"

/**
 * Customer Onboarding landing page (task spec, "critical: No Duplicate
 * Request Creation"): visiting this route never creates anything. The
 * only way to start a new request is the "+ New Customer Onboarding"
 * button below, which links to ./new (a separate route that does the
 * actual create-and-redirect). Below it, My Requests: every onboarding
 * request this signed-in user created, never anyone else's, and never
 * client-suppliable (the requester identity comes from the session).
 */
export const dynamic = "force-dynamic"

const CUSTOMER_CREATE = { resource: "customer", action: "create" }

export default async function CustomerOnboardingLandingRoute() {
  const session = await getCurrentNexusSession()
  const appUserId = session.status === "active" ? session.appUserId : null

  let rows: MyRequestRow[] = []
  let unavailable = false

  if (appUserId) {
    try {
      const requests = await listMyOnboardingRequests(appUserId)
      const sendBackCounts = await getSendBackCountsForRequests(requests.map((r) => r.requestId))

      const approvedCustomerIds = requests.map((r) => r.customerId).filter((id): id is string => Boolean(id))
      const customers = await getCustomersByIds([...new Set(approvedCustomerIds)])
      const customerKeyByCustomerId = new Map(customers.map((customer) => [customer.id, customer.key]))

      rows = sortMyRequestRows(
        requests.map((request) => ({
          requestId: request.requestId,
          caseNumber: request.caseNumber,
          legalName: request.legalName,
          brandName: request.brandName,
          status: request.status,
          currentStageKey: request.currentStageKey,
          revisionNumber: request.revisionNumber,
          sentBackCount: sendBackCounts.get(request.requestId) ?? 0,
          createdAt: request.createdAt,
          updatedAt: request.updatedAt,
          customerKey: request.customerId ? (customerKeyByCustomerId.get(request.customerId) ?? null) : null,
        }))
      )
    } catch {
      unavailable = true
    }
  }

  return (
    <AuthGate session={session} requiredPermission={CUSTOMER_CREATE} loginRedirectTo="/forms/customer-onboarding">
      <div className="flex flex-1 flex-col">
        <PageHeader
          title="Customer Onboarding"
          description="Create and track customer onboarding requests."
          actions={
            <Button size="sm" render={<Link href="/forms/customer-onboarding/new" />}>
              + New Customer Onboarding
            </Button>
          }
        />
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4 sm:px-6 sm:py-6">
          <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">My Requests</h2>
          {unavailable ? (
            <div className="flex items-start gap-2 rounded-md border border-dashed px-4 py-4">
              <p className="text-xs text-muted-foreground">Your requests could not be read right now. Try reloading the page.</p>
            </div>
          ) : (
            <MyRequestsTable rows={rows} />
          )}
        </div>
      </div>
    </AuthGate>
  )
}
