import { CustomerOnboardingPage } from "@/features/customer-onboarding/ui/customer-onboarding-page"
import { emptySnapshot, loadReferenceMasterSnapshot } from "@/features/reference-data/server"
import { ReferenceMasterSnapshotProvider } from "@/features/reference-data/ui/snapshot-context"
import type { ReferenceMasterSnapshot } from "@/features/reference-data"

/**
 * Customer Onboarding reads the real, persistent Reference Master
 * (supabase/migrations/20260912080000_reference_master_foundation.sql)
 * for Industry/Segment/Business Unit/Tax Identifier Type/Currency/
 * Pricing Unit/Invoice Frequency, loaded once here and threaded down
 * through `ReferenceMasterSnapshotProvider` to every Client Component
 * that needs it (`CustomerOnboardingPage` and, several levels deeper,
 * `CommercialRateSection`), rather than each of them reading Supabase
 * directly. `dynamic = "force-dynamic"` for the same reason as
 * `src/app/customers/page.tsx`: this route has no dynamic API of its own
 * to opt it out of static optimization.
 *
 * The read is wrapped: a missing credential or an unreachable database
 * must show an honest unavailable state (task correction §23), never
 * crash the page or silently render as if there are no values.
 */
export const dynamic = "force-dynamic"

export default async function CustomerOnboardingRoute() {
  let snapshot: ReferenceMasterSnapshot
  let snapshotUnavailable = false
  try {
    snapshot = await loadReferenceMasterSnapshot()
  } catch {
    snapshotUnavailable = true
    snapshot = emptySnapshot()
  }

  return (
    <ReferenceMasterSnapshotProvider snapshot={snapshot}>
      <CustomerOnboardingPage snapshotUnavailable={snapshotUnavailable} />
    </ReferenceMasterSnapshotProvider>
  )
}
