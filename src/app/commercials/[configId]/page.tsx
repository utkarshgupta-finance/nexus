import { notFound } from "next/navigation"

import { AuthGate } from "@/components/product/auth-gate"
import { getCurrentNexusSession } from "@/platform/auth/server"
import { getCommercialConfigurationOverview } from "@/features/commercial/server"
import { CommercialConfigurationOverview } from "@/features/commercial/ui/commercial-configuration-overview"

/**
 * The live Commercial Configuration screen (task correction, Commercial
 * Configuration persistence/versioning): unlike /commercials (still the
 * fixture-only demo screen, see its own header comment), this route
 * reads the real, persistent Commercial Configuration
 * (supabase/migrations/20260908210000_commercial_configuration_foundation.sql,
 * 20260912210000_commercial_configuration_persistence.sql) for one
 * specific configuration id, protected by `commercial_configuration.read`.
 *
 * `dynamic = "force-dynamic"` for the same reason as every other live
 * backend-reading route in this app (task correction §23): a page
 * reading live data must never be allowed to statically prerender.
 */
export const dynamic = "force-dynamic"

const COMMERCIAL_CONFIGURATION_READ = { resource: "commercial_configuration", action: "read" }

export default async function CommercialConfigurationPage({ params }: { params: Promise<{ configId: string }> }) {
  const { configId } = await params
  const session = await getCurrentNexusSession()

  let overview: Awaited<ReturnType<typeof getCommercialConfigurationOverview>> = null
  let overviewUnavailable = false
  try {
    overview = await getCommercialConfigurationOverview(configId)
  } catch {
    overviewUnavailable = true
  }

  return (
    <AuthGate session={session} requiredPermission={COMMERCIAL_CONFIGURATION_READ} loginRedirectTo={`/commercials/${configId}`}>
      {overviewUnavailable ? (
        <div className="p-6 text-sm text-destructive">
          Commercial Configuration could not be reached. Try again shortly.
        </div>
      ) : overview ? (
        <CommercialConfigurationOverview overview={overview} />
      ) : (
        notFound()
      )}
    </AuthGate>
  )
}
