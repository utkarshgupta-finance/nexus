import { notFound } from "next/navigation"

import { isValidUuid } from "@/lib/uuid"
import { AuthGate } from "@/components/product/auth-gate"
import { getCurrentNexusSession } from "@/platform/auth/server"
import { hasPermission, hasPermissionForCustomer } from "@/platform/permissions/server"
import { loadVersion, getCommercialVersionDiff, loadCommercialVersionTimeline } from "@/features/customer-onboarding/server"
import { CommercialVersionReviewPage } from "@/features/customer-onboarding/ui/commercial-version-review-page"
import { emptySnapshot, loadReferenceMasterSnapshot } from "@/features/reference-data/server"
import { ReferenceMasterSnapshotProvider } from "@/features/reference-data/ui/snapshot-context"
import { commercialConfigurationService } from "@/features/commercial/server"
import { getCustomerById } from "@/features/customers/server"
import type { ReferenceMasterSnapshot } from "@/features/reference-data"
import type { CommercialRateDiff } from "@/features/customer-onboarding/server"

/**
 * Reviewer detail screen for one Commercial Configuration Version,
 * mirroring /reviews/change-requests/[requestId]/page.tsx's own shape.
 */
export const dynamic = "force-dynamic"

const COMMERCIAL_CONFIGURATION_READ = { resource: "commercial_configuration", action: "read" }

export default async function CommercialVersionReviewRoute({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params
  if (!isValidUuid(requestId)) notFound()
  const session = await getCurrentNexusSession()

  const version = await loadVersion(requestId)
  if (!version) notFound()

  const canDecide = await hasPermission("commercial_configuration", "approve")

  // PD-005 follow-up (Product Decision Closure): resolve the owning
  // customer once, outside the display-only try/catch below, so the
  // scoped read check below it is never silently skipped by a display
  // failure.
  const configuration = await commercialConfigurationService.getCommercialConfiguration(version.commercialConfigurationId)
  const canAccessThisVersion = configuration ? await hasPermissionForCustomer("commercial_configuration", "read", configuration.customerId) : false

  let customerName = "Commercial Configuration Version Review"
  try {
    const customer = configuration ? await getCustomerById(configuration.customerId) : null
    customerName = customer?.name ?? customerName
  } catch {
    // Keep the generic fallback title; this is a display nicety, not the review's authorization boundary.
  }

  let snapshot: ReferenceMasterSnapshot
  try {
    snapshot = await loadReferenceMasterSnapshot()
  } catch {
    snapshot = emptySnapshot()
  }

  let diff: CommercialRateDiff | null = null
  try {
    diff = await getCommercialVersionDiff(requestId)
  } catch {
    diff = null
  }

  const timeline = await loadCommercialVersionTimeline(requestId)

  return (
    <AuthGate
      session={session}
      requiredPermission={COMMERCIAL_CONFIGURATION_READ}
      loginRedirectTo={`/reviews/commercial-versions/${requestId}`}
      additionalAccessGranted={canAccessThisVersion}
    >
      <ReferenceMasterSnapshotProvider snapshot={snapshot}>
        <CommercialVersionReviewPage
          requestId={requestId}
          configId={version.commercialConfigurationId}
          customerName={customerName}
          version={version}
          canDecide={canDecide}
          diff={diff}
          timeline={timeline}
        />
      </ReferenceMasterSnapshotProvider>
    </AuthGate>
  )
}
