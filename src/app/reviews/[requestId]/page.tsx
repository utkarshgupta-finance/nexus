import { notFound } from "next/navigation"

import { AuthGate } from "@/components/product/auth-gate"
import { getCurrentNexusSession } from "@/platform/auth/server"
import { hasPermission } from "@/platform/permissions/server"
import { getOnboardingCase, listOnboardingDocuments, loadOnboardingRequestTimeline } from "@/features/customer-onboarding/server"
import { ReviewDetailPage } from "@/features/customer-onboarding/ui/review-detail-page"
import { emptySnapshot, loadReferenceMasterSnapshot } from "@/features/reference-data/server"
import { ReferenceMasterSnapshotProvider } from "@/features/reference-data/ui/snapshot-context"
import type { ReferenceMasterSnapshot } from "@/features/reference-data"
import type { PersistedOnboardingDocumentMetadata } from "@/features/customer-onboarding/server"

export const dynamic = "force-dynamic"

const CUSTOMER_READ = { resource: "customer", action: "read" }

export default async function ReviewDetailRoute({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params
  const session = await getCurrentNexusSession()

  const onboardingCase = await getOnboardingCase(requestId)
  if (!onboardingCase) {
    notFound()
  }

  let snapshot: ReferenceMasterSnapshot
  try {
    snapshot = await loadReferenceMasterSnapshot()
  } catch {
    snapshot = emptySnapshot()
  }

  const canApprove = await hasPermission("customer", "approve")

  let documents: PersistedOnboardingDocumentMetadata[] = []
  try {
    documents = await listOnboardingDocuments(requestId)
  } catch {
    documents = []
  }

  const timeline = await loadOnboardingRequestTimeline(requestId)

  return (
    <AuthGate session={session} requiredPermission={CUSTOMER_READ} loginRedirectTo={`/reviews/${requestId}`}>
      <ReferenceMasterSnapshotProvider snapshot={snapshot}>
        <ReviewDetailPage requestId={requestId} onboardingCase={onboardingCase} canApprove={canApprove} documents={documents} timeline={timeline} />
      </ReferenceMasterSnapshotProvider>
    </AuthGate>
  )
}
