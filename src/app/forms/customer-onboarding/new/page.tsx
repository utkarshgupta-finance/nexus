import { redirect } from "next/navigation"

import { AuthGate } from "@/components/product/auth-gate"
import { getCurrentNexusSession } from "@/platform/auth/server"
import { requirePermission } from "@/platform/permissions/server"
import { createOnboardingCase } from "@/features/customer-onboarding/services/case.service"

export const dynamic = "force-dynamic"

const CUSTOMER_CREATE = { resource: "customer", action: "create" }

/**
 * The one and only place a new Customer Onboarding request is created
 * (task spec: "No Duplicate Request Creation" is critical). Reached only
 * by the landing page's own "+ New Customer Onboarding" button
 * (../page.tsx); visiting the landing page itself never creates
 * anything. Immediately redirects to the real, persisted case, exactly
 * like the old bare /forms/customer-onboarding route used to.
 */
async function CreateAndRedirect() {
  const actor = await requirePermission("customer", "create")
  const onboardingCase = await createOnboardingCase(actor.appUserId)
  redirect(`/forms/customer-onboarding/${onboardingCase.requestId}`)
  return null
}

export default async function NewCustomerOnboardingRoute() {
  const session = await getCurrentNexusSession()
  return (
    <AuthGate session={session} requiredPermission={CUSTOMER_CREATE} loginRedirectTo="/forms/customer-onboarding/new">
      <CreateAndRedirect />
    </AuthGate>
  )
}
