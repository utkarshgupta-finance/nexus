import { ReferenceMasterSettings } from "@/features/reference-data/ui/reference-master-settings"
import { emptySnapshot, loadReferenceMasterSnapshot } from "@/features/reference-data/server"
import type { ReferenceMasterSnapshot } from "@/features/reference-data"

/**
 * Reference Master management for Customer Onboarding, backed by a real
 * Supabase-persisted Reference Master
 * (supabase/migrations/20260912080000_reference_master_foundation.sql).
 * `dynamic = "force-dynamic"` for the same reason as `src/app/customers/
 * page.tsx`: this route reads live backend data with no dynamic API of
 * its own to opt it out of static optimization, so without this export
 * Next.js would prerender one frozen snapshot at build time.
 *
 * The read is wrapped: a missing credential or an unreachable database
 * must show an honest unavailable state (task correction §23), never
 * crash the page or silently render as if there are no values.
 */
export const dynamic = "force-dynamic"

export default async function CustomerOnboardingSettingsPage() {
  let snapshot: ReferenceMasterSnapshot
  let snapshotUnavailable = false
  try {
    snapshot = await loadReferenceMasterSnapshot()
  } catch {
    snapshotUnavailable = true
    snapshot = emptySnapshot()
  }

  return <ReferenceMasterSettings initialSnapshot={snapshot} snapshotUnavailable={snapshotUnavailable} />
}
