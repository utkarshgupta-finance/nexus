import { notFound, redirect } from "next/navigation"

import { AuthGate } from "@/components/product/auth-gate"
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
