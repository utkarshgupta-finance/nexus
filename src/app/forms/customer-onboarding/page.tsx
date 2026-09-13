import { redirect } from "next/navigation"

import { AuthGate } from "@/components/product/auth-gate"
import { getCurrentNexusSession } from "@/platform/auth/server"
import { requirePermission } from "@/platform/permissions/server"
import { createOnboardingCase } from "@/features/customer-onboarding/services/case.service"

/**
 * "New Customer" entry point (Customer Lifecycle V1, task §54: Customers
 * -> New Customer -> Customer Onboarding). Visiting this bare route,
 * once authorized, always creates one real, persisted Customer
 * Onboarding Case (create_customer_onboarding_case,
 * supabase/migrations/20260913040000_customer_lifecycle_onboarding_foundation.sql)
 * and immediately redirects to its own stable URL
 * (/forms/customer-onboarding/[requestId]), which is what every
 * subsequent Save Draft/Submit/refresh actually operates on. This route
 * itself never renders the form.
 */
export const dynamic = "force-dynamic"

const CUSTOMER_CREATE = { resource: "customer", action: "create" }

async function CreateAndRedirect() {
  const actor = await requirePermission("customer", "create")
  const onboardingCase = await createOnboardingCase(actor.appUserId)
  redirect(`/forms/customer-onboarding/${onboardingCase.requestId}`)
  return null
}

export default async function NewCustomerOnboardingRoute() {
  const session = await getCurrentNexusSession()

  return (
    <AuthGate session={session} requiredPermission={CUSTOMER_CREATE} loginRedirectTo="/forms/customer-onboarding">
      <CreateAndRedirect />
    </AuthGate>
  )
}
