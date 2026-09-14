import { notFound } from "next/navigation"

import { AuthGate } from "@/components/product/auth-gate"
import { getCurrentNexusSession } from "@/platform/auth/server"
import { hasPermission } from "@/platform/permissions/server"
import { getOnboardingCase, listOnboardingFieldComments, listOnboardingDocumentsWithUploader } from "@/features/customer-onboarding/server"
import type { PersistedOnboardingDocumentView } from "@/features/customer-onboarding/server"
import { CustomerOnboardingPage } from "@/features/customer-onboarding/ui/customer-onboarding-page"
import { emptySnapshot, loadReferenceMasterSnapshot } from "@/features/reference-data/server"
import { ReferenceMasterSnapshotProvider } from "@/features/reference-data/ui/snapshot-context"
import type { ReferenceMasterSnapshot } from "@/features/reference-data"

/**
 * The real Customer Onboarding Case screen (Customer Lifecycle V1):
 * unlike the bare /forms/customer-onboarding route (which only ever
 * creates a new case and redirects here), this route reads one real,
 * persisted case by its stable request id and is what Save Draft,
 * Submit, Send Back's edit link, and a page refresh all actually load.
 *
 * `dynamic = "force-dynamic"` for the same reason as every other live
 * backend-reading route: a page reading live data must never be allowed
 * to statically prerender.
 */
export const dynamic = "force-dynamic"

const CUSTOMER_CREATE = { resource: "customer", action: "create" }

export default async function CustomerOnboardingCaseRoute({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params
  const session = await getCurrentNexusSession()

  const onboardingCase = await getOnboardingCase(requestId)
  if (!onboardingCase) {
    notFound()
  }

  const fieldComments = await listOnboardingFieldComments(requestId)

  let initialDocuments: PersistedOnboardingDocumentView[] = []
  try {
    initialDocuments = await listOnboardingDocumentsWithUploader(requestId)
  } catch {
    // A read failure here should not block reopening the form itself;
    // the requester simply sees empty slots, same as before this fix,
    // rather than a broken page.
    initialDocuments = []
  }

  let snapshot: ReferenceMasterSnapshot
  let snapshotUnavailable = false
  try {
    snapshot = await loadReferenceMasterSnapshot()
  } catch {
    snapshotUnavailable = true
    snapshot = emptySnapshot()
  }

  const canReview = await hasPermission("customer", "approve")

  return (
    <AuthGate session={session} requiredPermission={CUSTOMER_CREATE} loginRedirectTo={`/forms/customer-onboarding/${requestId}`}>
      <ReferenceMasterSnapshotProvider snapshot={snapshot}>
        <CustomerOnboardingPage
          requestId={requestId}
          initialCase={onboardingCase}
          snapshotUnavailable={snapshotUnavailable}
          canReview={canReview}
          fieldComments={fieldComments}
          initialDocuments={initialDocuments}
        />
      </ReferenceMasterSnapshotProvider>
    </AuthGate>
  )
}
