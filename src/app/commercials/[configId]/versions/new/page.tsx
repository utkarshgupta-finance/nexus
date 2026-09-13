import { notFound, redirect } from "next/navigation"

import { AuthGate } from "@/components/product/auth-gate"
import { getCurrentNexusSession } from "@/platform/auth/server"
import { requirePermission } from "@/platform/permissions/server"
import { commercialConfigurationService } from "@/features/commercial/server"
import { createVersionFromActive } from "@/features/customer-onboarding/services/commercial-version.service"

/**
 * "Create New Version" entry point (Customer Lifecycle V1, task
 * §10-13), mirroring /forms/customer-onboarding/page.tsx's own
 * create-then-redirect shape: visiting this bare route, once authorized,
 * always creates one real, persisted Commercial Configuration Version
 * whose draft is seeded from the configuration's current active
 * Components, and immediately redirects to its own stable URL.
 */
export const dynamic = "force-dynamic"

const COMMERCIAL_CONFIGURATION_WRITE = { resource: "commercial_configuration", action: "write" }

async function CreateAndRedirect({ configId }: { configId: string }) {
  const configuration = await commercialConfigurationService.getCommercialConfiguration(configId)
  if (!configuration) notFound()

  const actor = await requirePermission("commercial_configuration", "write")
  const version = await createVersionFromActive(configId, "amendment", actor.appUserId)
  redirect(`/commercials/${configId}/versions/${version.requestId}`)
  return null
}

export default async function NewCommercialConfigurationVersionRoute({ params }: { params: Promise<{ configId: string }> }) {
  const { configId } = await params
  const session = await getCurrentNexusSession()

  return (
    <AuthGate session={session} requiredPermission={COMMERCIAL_CONFIGURATION_WRITE} loginRedirectTo={`/commercials/${configId}/versions/new`}>
      <CreateAndRedirect configId={configId} />
    </AuthGate>
  )
}
