import { notFound, redirect } from "next/navigation"

import { AuthGate } from "@/components/product/auth-gate"
import { PageHeader } from "@/components/product/page-header"
import { getCurrentNexusSession } from "@/platform/auth/server"
import { requirePermission } from "@/platform/permissions/server"
import { getCustomerByKey } from "@/features/customers/server"
import { createChangeRequest } from "@/features/customer-change/services/change-request.service"

/**
 * "Create Change Request" entry point (Customer Lifecycle V1, task
 * §4-6), mirroring /forms/customer-onboarding/page.tsx's own
 * create-then-redirect shape: visiting this bare route, once authorized,
 * always creates one real, persisted Customer Change Request
 * (create_customer_change_request,
 * supabase/migrations/20260913060000_customer_change_request_foundation.sql)
 * and immediately redirects to its own stable URL. This route itself
 * never renders the form.
 */
export const dynamic = "force-dynamic"

const CUSTOMER_CHANGE_REQUEST = { resource: "customer", action: "change_request" }

async function CreateAndRedirect({ customerKey }: { customerKey: string }) {
  const customer = await getCustomerByKey(customerKey)
  if (!customer) notFound()

  const actor = await requirePermission("customer", "change_request")

  /**
   * Real defect found via live retest (Batch 9, C-002): this bare
   * create-and-redirect route called the service layer directly and
   * never enforced the inactive-customer precondition, even though the
   * (unreachable, dead) `createChangeRequestAction` Server Action in
   * `features/customer-change/actions.ts` already implements this exact
   * check. Nothing in the live UI ever calls that action; this route,
   * and `/customers/[customerKey]/change/new/both`, are the only real
   * entry points. `create_customer_change_request` has no RPC-level
   * guard by design (B-010), so this must be enforced here.
   */
  if (!customer.is_active) {
    return (
      <div className="flex flex-1 flex-col">
        <PageHeader
          title="Customer is inactive"
          description="This customer is inactive. Reactivate the customer before creating a Change Request."
        />
      </div>
    )
  }

  const changeRequest = await createChangeRequest(customer.id, actor.appUserId)
  redirect(`/customers/${customerKey}/change-requests/${changeRequest.requestId}`)
  return null
}

export default async function NewCustomerChangeRequestRoute({ params }: { params: Promise<{ customerKey: string }> }) {
  const { customerKey } = await params
  const session = await getCurrentNexusSession()

  return (
    <AuthGate session={session} requiredPermission={CUSTOMER_CHANGE_REQUEST} loginRedirectTo={`/customers/${customerKey}/change-requests/new`}>
      <CreateAndRedirect customerKey={customerKey} />
    </AuthGate>
  )
}
