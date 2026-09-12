"use client"

import { useMemo, useState } from "react"

import { PageHeader } from "@/components/product/page-header"
import { Separator } from "@/components/ui/separator"
import type { CommercialConfigurationOverview as CommercialConfigurationOverviewData, ComponentSummary } from "@/features/commercial"
import { CommercialRecordHeader } from "./commercial-record-header"
import { CommercialComponentsTable } from "./commercial-components-table"
import { CommercialComponentDetailSheet } from "./commercial-component-detail-sheet"
import { CommitmentsSection } from "./commitments-section"
import { CommercialChangeStrip } from "./commercial-change-strip"
import { VersionHistoryTable } from "./version-history-table"

/**
 * Commercial Configuration Overview: the first Commercial screen.
 * Purely presentational over whatever `overview` it is given; it does
 * not fetch anything itself.
 *
 * Shows the currently active version's components by default (task
 * correction §33: "show the current active version clearly"); clicking
 * "View details" on any row in the Version History table (§32) switches
 * which version's Components/Commitments render above it, without a
 * second fetch: every version's Components already arrived in one
 * `overview` read.
 */

function CommercialConfigurationOverview({ overview }: { overview: CommercialConfigurationOverviewData }) {
  const [selectedComponent, setSelectedComponent] = useState<ComponentSummary | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const activeVersion = overview.versions.find((version) => version.status === "active") ?? overview.versions[overview.versions.length - 1] ?? null
  const [selectedVersionNumber, setSelectedVersionNumber] = useState<number | null>(activeVersion?.versionNumber ?? null)

  const selectedVersion = overview.versions.find((version) => version.versionNumber === selectedVersionNumber) ?? activeVersion

  const visibleComponents = useMemo(() => {
    if (!selectedVersion) return overview.components
    const idsInVersion = new Set(selectedVersion.componentIds)
    return overview.components.filter((component) => idsInVersion.has(component.id))
  }, [overview.components, selectedVersion])

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
        {selectedVersion ? (
          <p className="px-6 text-xs text-muted-foreground">
            Showing Version {selectedVersion.versionNumber}
            {selectedVersion.status === "active" ? " (current)" : " (historical, read-only)"}.
          </p>
        ) : null}

        <CommercialComponentsTable components={visibleComponents} onSelect={handleSelect} />

        <Separator />

        <CommitmentsSection commitments={overview.commitments} components={visibleComponents} />

        <Separator />

        <VersionHistoryTable
          versions={overview.versions}
          selectedVersionNumber={selectedVersionNumber}
          onSelectVersion={setSelectedVersionNumber}
        />

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
