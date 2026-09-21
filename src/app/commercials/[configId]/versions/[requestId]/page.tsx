import { notFound } from "next/navigation"

import { AuthGate } from "@/components/product/auth-gate"
import { getCurrentNexusSession } from "@/platform/auth/server"
import { hasPermissionForCustomer } from "@/platform/permissions/server"
import { commercialConfigurationService } from "@/features/commercial/server"
import { loadVersion } from "@/features/customer-onboarding/server"
import { CommercialVersionPage } from "@/features/customer-onboarding/ui/commercial-version-page"
import { emptySnapshot, loadReferenceMasterSnapshot } from "@/features/reference-data/server"
import { ReferenceMasterSnapshotProvider } from "@/features/reference-data/ui/snapshot-context"
import type { ReferenceMasterSnapshot } from "@/features/reference-data"

/**
 * The real Commercial Configuration Version draft screen: reads one
 * real, persisted version by its stable request id, the same
 * "bare create route redirects here" shape as
 * /forms/customer-onboarding/[requestId]/page.tsx.
 */
export const dynamic = "force-dynamic"

const COMMERCIAL_CONFIGURATION_WRITE = { resource: "commercial_configuration", action: "write" }

export default async function CommercialConfigurationVersionRoute({ params }: { params: Promise<{ configId: string; requestId: string }> }) {
  const { configId, requestId } = await params
  const session = await getCurrentNexusSession()

  const version = await loadVersion(requestId)
  if (!version || version.commercialConfigurationId !== configId) notFound()

  // PD-005 follow-up (Product Decision Closure): a version always
  // belongs to one commercial_configuration, which belongs to one
  // customer; scope by that customer.
  const configuration = await commercialConfigurationService.getCommercialConfiguration(configId)
  const canAccessThisVersion = configuration ? await hasPermissionForCustomer("commercial_configuration", "write", configuration.customerId) : false

  let snapshot: ReferenceMasterSnapshot
  try {
    snapshot = await loadReferenceMasterSnapshot()
  } catch {
    snapshot = emptySnapshot()
  }

  return (
    <AuthGate
      session={session}
      requiredPermission={COMMERCIAL_CONFIGURATION_WRITE}
      loginRedirectTo={`/commercials/${configId}/versions/${requestId}`}
      additionalAccessGranted={canAccessThisVersion}
    >
      <ReferenceMasterSnapshotProvider snapshot={snapshot}>
        <CommercialVersionPage requestId={requestId} configId={configId} initialVersion={version} />
      </ReferenceMasterSnapshotProvider>
    </AuthGate>
  )
}
