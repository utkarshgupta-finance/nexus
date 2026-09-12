import { ReferenceMasterSettings } from "@/features/reference-data/ui/reference-master-settings"
import { emptySnapshot, loadReferenceMasterSnapshot } from "@/features/reference-data/server"
import type { ReferenceMasterSnapshot } from "@/features/reference-data"
import { AuthGate } from "@/components/product/auth-gate"
import { getCurrentNexusSession } from "@/platform/auth/server"
import { sessionHasPermission } from "@/platform/permissions"

/**
 * Reference Master management for Customer Onboarding, backed by a real
 * Supabase-persisted Reference Master
 * (supabase/migrations/20260912080000_reference_master_foundation.sql),
 * now also protected by `reference_master.read`
 * (supabase/migrations/20260912150000_auth_authorization_foundation.sql):
 * `AuthGate` redirects an unauthenticated visitor to `/login`, and shows
 * an honest unprovisioned/inactive/missing-permission state otherwise,
 * never a silently empty or crashed Settings page.
 *
 * `dynamic = "force-dynamic"` for the same reason as `src/app/customers/
 * page.tsx`: this route reads live backend data (and now a live session)
 * with no dynamic API of its own to opt it out of static optimization.
 *
 * The snapshot read is wrapped: a missing credential or an unreachable
 * database must show an honest unavailable state (task correction §23),
 * never crash the page or silently render as if there are no values.
 */
export const dynamic = "force-dynamic"

const REFERENCE_MASTER_READ = { resource: "reference_master", action: "read" }

export default async function CustomerOnboardingSettingsPage() {
  const session = await getCurrentNexusSession()

  let snapshot: ReferenceMasterSnapshot
  let snapshotUnavailable = false
  try {
    snapshot = await loadReferenceMasterSnapshot()
  } catch {
    snapshotUnavailable = true
    snapshot = emptySnapshot()
  }

  const canWrite = sessionHasPermission(session, "reference_master", "write")

  return (
    <AuthGate session={session} requiredPermission={REFERENCE_MASTER_READ} loginRedirectTo="/settings/customer-onboarding">
      <ReferenceMasterSettings initialSnapshot={snapshot} snapshotUnavailable={snapshotUnavailable} canWrite={canWrite} />
    </AuthGate>
  )
}
