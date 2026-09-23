import { notFound } from "next/navigation"

import { isValidUuid } from "@/lib/uuid"
import { AuthGate } from "@/components/product/auth-gate"
import { getCurrentNexusSession } from "@/platform/auth/server"
import { hasPermission, hasPermissionForCustomer, hasPermissionForBusinessUnit } from "@/platform/permissions/server"
import { getOnboardingCase, listOnboardingDocumentsWithUploader, loadOnboardingRequestTimeline } from "@/features/customer-onboarding/server"
import { ReviewDetailPage } from "@/features/customer-onboarding/ui/review-detail-page"
import { emptySnapshot, loadReferenceMasterSnapshot } from "@/features/reference-data/server"
import { ReferenceMasterSnapshotProvider } from "@/features/reference-data/ui/snapshot-context"
import type { ReferenceMasterSnapshot } from "@/features/reference-data"
import type { PersistedOnboardingDocumentView } from "@/features/customer-onboarding/server"

export const dynamic = "force-dynamic"

const CUSTOMER_READ = { resource: "customer", action: "read" }

export default async function ReviewDetailRoute({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params
  if (!isValidUuid(requestId)) notFound()
  const session = await getCurrentNexusSession()

  // PD-001 (A-036): a draft is only readable by its own creator through
  // this route too (a reviewer never has a legitimate reason to open
  // someone else's still-drafting case by guessing/reusing a request id).
  // Once the case leaves draft, normal customer.read visibility applies.
  const actorUserId = session.status === "active" ? session.appUserId : ""
  const onboardingCase = await getOnboardingCase(requestId, actorUserId)
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
  // PD-005 follow-up (Product Decision Closure): scope by the resolved
  // customer once approval has created one; before that, by the case's
  // own business_unit form field (there is no customer to scope by yet).
  const canAccessThisCase = onboardingCase.customerId
    ? await hasPermissionForCustomer("customer", "read", onboardingCase.customerId)
    : await hasPermissionForBusinessUnit("customer", "read", (onboardingCase.currentRevision.data["business_unit"] as string | undefined) ?? null)

  let documents: PersistedOnboardingDocumentView[] = []
  try {
    documents = await listOnboardingDocumentsWithUploader(requestId)
  } catch {
    documents = []
  }

  const timeline = await loadOnboardingRequestTimeline(requestId, actorUserId)

  return (
    <AuthGate session={session} requiredPermission={CUSTOMER_READ} loginRedirectTo={`/reviews/${requestId}`} additionalAccessGranted={canAccessThisCase}>
      <ReferenceMasterSnapshotProvider snapshot={snapshot}>
        <ReviewDetailPage requestId={requestId} onboardingCase={onboardingCase} canApprove={canApprove} documents={documents} timeline={timeline} />
      </ReferenceMasterSnapshotProvider>
    </AuthGate>
  )
}
