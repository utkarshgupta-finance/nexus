import { CommercialConfigurationOverview } from "@/features/commercial/ui/commercial-configuration-overview"
import { FIXTURE_COMMERCIAL_CONFIGURATION_OVERVIEW } from "@/features/commercial/fixtures/configuration-overview.fixture"

/**
 * First Commercial route. Fixture-backed only: Nexus has no per-user
 * authorization boundary yet, so this page must not import
 * features/commercial/server.ts or call live, service_role-backed data.
 * See the fixture module's own header comment for the full reasoning.
 */

export default function CommercialsPage() {
  return <CommercialConfigurationOverview overview={FIXTURE_COMMERCIAL_CONFIGURATION_OVERVIEW} />
}
