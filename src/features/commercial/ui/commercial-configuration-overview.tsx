"use client"

import { useState } from "react"

import { PageHeader } from "@/components/product/page-header"
import { Separator } from "@/components/ui/separator"
import type { CommercialConfigurationOverview as CommercialConfigurationOverviewData, ComponentSummary } from "@/features/commercial"
import { CommercialRecordHeader } from "./commercial-record-header"
import { CommercialComponentsTable } from "./commercial-components-table"
import { CommercialComponentDetailSheet } from "./commercial-component-detail-sheet"
import { CommitmentsSection } from "./commitments-section"
import { CommercialChangeStrip } from "./commercial-change-strip"

/**
 * Commercial Configuration Overview: the first Commercial screen.
 * Purely presentational over whatever `overview` it is given; it does
 * not fetch anything itself. Until a real per-user authorization
 * boundary exists in Nexus, callers must pass fixture data shaped like
 * the production read model, never a live features/commercial/server.ts
 * call (see the fixture module's own header comment for why).
 */

function CommercialConfigurationOverview({ overview }: { overview: CommercialConfigurationOverviewData }) {
  const [selectedComponent, setSelectedComponent] = useState<ComponentSummary | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const supersededComponentIds = new Set(
    overview.components.map((component) => component.supersedesComponentId).filter((id): id is string => id !== null)
  )

  function handleSelect(component: ComponentSummary) {
    setSelectedComponent(component)
    setSheetOpen(true)
  }

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader title="Commercial Configuration" description="Active commercial setup for this account" />
      <CommercialRecordHeader overview={overview} />

      <div className="flex flex-col gap-6 py-4">
        <CommercialComponentsTable components={overview.components} onSelect={handleSelect} />

        <Separator />

        <CommitmentsSection commitments={overview.commitments} components={overview.components} />

        <Separator />

        <CommercialChangeStrip changes={overview.changes} />
      </div>

      <CommercialComponentDetailSheet
        component={selectedComponent}
        supersededComponentIds={supersededComponentIds}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </div>
  )
}

export { CommercialConfigurationOverview }
