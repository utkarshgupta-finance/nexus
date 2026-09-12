import { notFound } from "next/navigation"

import { AuthGate } from "@/components/product/auth-gate"
import { getCurrentNexusSession } from "@/platform/auth/server"
import { commercialConfigurationService } from "@/features/commercial/server"
import { getCustomerById } from "@/features/customers/server"
import { emptySnapshot, loadReferenceMasterSnapshot } from "@/features/reference-data/server"
import { CustomerCommercialConfigurationView } from "@/features/customer-onboarding/ui/customer-commercial-configuration-view"

/**
 * The live Commercial Configuration screen (task correction: "create one
 * fictional customer end to end and show its real commercials on the
 * Customer Commercials page using the business terminology we have
 * defined"). Unlike /commercials (still the fixture-only demo screen
 * showing the old generic SaaS vocabulary, see its own header comment),
 * this route reads the real, persistent Commercial Configuration and
 * renders it through CustomerCommercialConfigurationView, which reuses
 * Customer Onboarding's own Commercial Rate vocabulary and column
 * formatting rather than the old Commercial Configuration Overview's
 * generic pricingRuleKindLabel/CommitmentsSection model.
 *
 * `dynamic = "force-dynamic"` for the same reason as every other live
 * backend-reading route in this app: a page reading live data must never
 * be allowed to statically prerender.
 */
export const dynamic = "force-dynamic"

const COMMERCIAL_CONFIGURATION_READ = { resource: "commercial_configuration", action: "read" }

export default async function CommercialConfigurationPage({ params }: { params: Promise<{ configId: string }> }) {
  const { configId } = await params
  const session = await getCurrentNexusSession()

  let configuration: Awaited<ReturnType<typeof commercialConfigurationService.getCommercialConfiguration>> = null
  let changes: Awaited<ReturnType<typeof commercialConfigurationService.listCommercialChanges>> = []
  let components: Awaited<ReturnType<typeof commercialConfigurationService.listCommercialComponents>> = []
  let customerName: string | null = null
  let unavailable = false

  try {
    configuration = await commercialConfigurationService.getCommercialConfiguration(configId)
    if (configuration) {
      const [changesResult, componentsResult, customer] = await Promise.all([
        commercialConfigurationService.listCommercialChanges(configId),
        commercialConfigurationService.listCommercialComponents(configId),
        getCustomerById(configuration.customerId),
      ])
      changes = changesResult
      components = componentsResult
      customerName = customer?.name ?? null
    }
  } catch {
    unavailable = true
  }

  let snapshot: Awaited<ReturnType<typeof loadReferenceMasterSnapshot>>
  try {
    snapshot = await loadReferenceMasterSnapshot()
  } catch {
    snapshot = emptySnapshot()
  }

  return (
    <AuthGate session={session} requiredPermission={COMMERCIAL_CONFIGURATION_READ} loginRedirectTo={`/commercials/${configId}`}>
      {unavailable ? (
        <div className="p-6 text-sm text-destructive">Commercial Configuration could not be reached. Try again shortly.</div>
      ) : configuration ? (
        <CustomerCommercialConfigurationView
          customerName={customerName ?? configuration.name}
          configuration={configuration}
          changes={changes}
          components={components}
          snapshot={snapshot}
        />
      ) : (
        notFound()
      )}
    </AuthGate>
  )
}
