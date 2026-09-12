import { InfoIcon } from "lucide-react"

import { CommercialConfigurationOverview } from "@/features/commercial/ui/commercial-configuration-overview"
import { FIXTURE_COMMERCIAL_CONFIGURATION_OVERVIEW } from "@/features/commercial/fixtures/configuration-overview.fixture"

/**
 * Legacy fixture route, not the live customer Commercials experience
 * (task correction: "Northwind Fictional Retail Group and generic SaaS
 * commercial data must be removed from the normal live customer
 * Commercials experience or clearly isolated as legacy/dev-only"). Not
 * linked from any real navigation (no sidebar entry, no Customer Master
 * link): a real customer's Commercials are reached from that customer's
 * own record and rendered by CustomerCommercialConfigurationView
 * (features/customer-onboarding/ui/customer-commercial-configuration-view.tsx),
 * never this fixture. Kept only as a design-reference screen; see the
 * fixture module's own header comment for why it still exists.
 */

export default function CommercialsPage() {
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-start gap-2 border-b border-warning/30 bg-warning/5 px-6 py-2.5">
        <InfoIcon className="mt-0.5 size-3.5 shrink-0 text-warning" />
        <p className="text-xs text-muted-foreground">
          Legacy design-reference screen, not live data. Illustrative old Commercial UI fixture (&ldquo;Northwind
          Fictional Retail Group&rdquo;), not the current Nexus Commercial vocabulary. A real customer&rsquo;s
          Commercials are reached from that customer&rsquo;s own record.
        </p>
      </div>
      <CommercialConfigurationOverview overview={FIXTURE_COMMERCIAL_CONFIGURATION_OVERVIEW} />
    </div>
  )
}
