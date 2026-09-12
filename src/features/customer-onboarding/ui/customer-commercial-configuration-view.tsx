"use client"

import { useMemo, useState } from "react"

import { PageHeader } from "@/components/product/page-header"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { CommercialChange, CommercialComponent, CommercialConfiguration } from "@/features/commercial"
import { toVersionSummaries } from "@/features/commercial"
import { VersionHistoryTable } from "@/features/commercial/ui/version-history-table"
import type { ReferenceMasterSnapshot } from "@/features/reference-data"

import { persistedComponentTableCells } from "../domain/commercial-configuration-view"
import type { CommercialNature } from "../domain/commercial-rate"
import { ColumnValue, COLUMN_LABELS, NON_RECURRING_COLUMNS, ON_DEMAND_COLUMNS, RECURRING_COLUMNS } from "./commercial-rate-section"
import type { ColumnKey } from "./commercial-rate-section"

/**
 * The real Customer Commercials view (task correction: "create one
 * fictional customer... show its real commercials on the Customer
 * Commercials page using the business terminology we have defined").
 *
 * This deliberately does NOT reuse CommercialConfigurationOverview
 * (../../commercial/ui/commercial-configuration-overview.tsx): that
 * component's vocabulary (pricingRuleKindLabel producing "Linear" /
 * "Volume-based" / "Graduated / tiered", a generic CommitmentsSection)
 * is the old, pre-Commercial-Rate SaaS-generic model the task
 * explicitly says must not remain the primary Commercial UI vocabulary.
 * This view instead reconstructs every persisted Component through
 * ../domain/commercial-configuration-view.ts (the exact inverse of
 * onboarding-to-Commercial-Configuration promotion) and renders it
 * through the SAME `ColumnValue`/column-set/section structure Customer
 * Onboarding's own Commercial Rate stage already uses, so a component
 * reads identically in both places (task correction: "reuse existing
 * summary logic, do not create a separate formatter vocabulary").
 *
 * Three Nature-scoped sections (Recurring / Non-Recurring / On-Demand),
 * never one generic mixed table with a Nature column, and no separate
 * generic Commitments table: MUG renders beside its own component via
 * the `mug` column, exactly like Customer Onboarding.
 */

type NatureRow = { componentId: string; name: string; columns: ColumnKey[]; cellsByColumn: ReturnType<typeof buildCellsByColumn> }

function buildCellsByColumn(columns: ColumnKey[], cells: ReturnType<typeof persistedComponentTableCells>["cells"]) {
  return columns.map((column) => ({ column, cells }))
}

function formatFxSnapshot(currencyCode: string | null, rate: number | null): string {
  if (!currencyCode || currencyCode === "INR") return "INR (no conversion)"
  if (rate === null) return "-"
  return `1 ${currencyCode} = INR ${rate.toFixed(2)}`
}

const NATURE_SECTIONS: { nature: CommercialNature; title: string; emptyMessage: string; columns: ColumnKey[] }[] = [
  { nature: "recurring", title: "Recurring Commercials", emptyMessage: "No recurring commercials on this version.", columns: RECURRING_COLUMNS },
  {
    nature: "non_recurring",
    title: "Non-Recurring Commercials",
    emptyMessage: "No non-recurring commercials on this version.",
    columns: NON_RECURRING_COLUMNS,
  },
  { nature: "on_demand", title: "On-Demand Commercials", emptyMessage: "No on-demand commercials on this version.", columns: ON_DEMAND_COLUMNS },
]

function ReadOnlyComponentsTable({ rows }: { rows: NatureRow[] }) {
  if (rows.length === 0) return null
  const columns = rows[0].columns

  return (
    <>
      <div className="hidden overflow-x-auto rounded-lg border sm:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Component</TableHead>
              {columns.map((column) => (
                <TableHead key={column}>{COLUMN_LABELS[column]}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.componentId}>
                <TableCell className="font-medium text-foreground">{row.name}</TableCell>
                {row.cellsByColumn.map(({ column, cells }) => (
                  <TableCell key={column} className={column === "mug" || column === "revenueRecognition" || column === "invoiceCycle" ? "whitespace-normal" : undefined}>
                    <ColumnValue column={column} cells={cells} />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-3 sm:hidden">
        {rows.map((row) => (
          <div key={row.componentId} className="flex flex-col gap-2 rounded-lg border bg-card p-4 shadow-sm">
            <span className="text-sm font-medium text-foreground">{row.name}</span>
            <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-xs">
              {row.cellsByColumn.map(({ column, cells }) => (
                <div key={column} className="contents">
                  <dt className="text-muted-foreground">{COLUMN_LABELS[column]}</dt>
                  <dd className="text-foreground">
                    <ColumnValue column={column} cells={cells} />
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </>
  )
}

function CustomerCommercialConfigurationHeader({
  customerName,
  configuration,
  version,
}: {
  customerName: string
  configuration: CommercialConfiguration
  version: ReturnType<typeof toVersionSummaries>[number] | null
}) {
  const metadata = [
    { label: "Version", value: version ? `Version ${version.versionNumber}` : "-" },
    { label: "Billing Currency", value: version?.billingCurrency ?? "-" },
    { label: "FX Snapshot", value: formatFxSnapshot(version?.billingCurrency ?? null, version?.fxSnapshotRate ?? null) },
    { label: "Effective From", value: version?.effectiveDate ?? "-" },
  ]

  return (
    <div className="flex flex-col gap-3 border-b px-6 py-4">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <h1 className="text-base font-semibold text-foreground">{customerName}</h1>
          <Badge
            variant="ghost"
            className={version?.status === "active" ? "bg-success/10 text-success dark:bg-success/15" : "bg-muted text-muted-foreground"}
          >
            {version?.status === "active" ? "Active" : "Superseded"}
          </Badge>
        </div>
        <p className="font-mono text-[0.7rem] text-muted-foreground">{configuration.key}</p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        {metadata.map((item, index) => (
          <div key={item.label} className="flex items-center gap-4">
            {index > 0 ? <span className="h-3 w-px bg-border" aria-hidden /> : null}
            <div className="flex items-baseline gap-1.5">
              <span className="text-xs text-muted-foreground">{item.label}</span>
              <span className="text-xs font-semibold tabular-nums text-foreground">{item.value}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function CustomerCommercialConfigurationView({
  customerName,
  configuration,
  changes,
  components,
  snapshot,
}: {
  customerName: string
  configuration: CommercialConfiguration
  changes: CommercialChange[]
  components: CommercialComponent[]
  snapshot: ReferenceMasterSnapshot
}) {
  const versions = useMemo(() => toVersionSummaries(changes, components), [changes, components])
  const activeVersion = versions.find((version) => version.status === "active") ?? versions[versions.length - 1] ?? null
  const [selectedVersionNumber, setSelectedVersionNumber] = useState<number | null>(activeVersion?.versionNumber ?? null)
  const selectedVersion = versions.find((version) => version.versionNumber === selectedVersionNumber) ?? activeVersion

  const visibleComponents = useMemo(() => {
    if (!selectedVersion) return components
    const idsInVersion = new Set(selectedVersion.componentIds)
    return components.filter((component) => idsInVersion.has(component.id))
  }, [components, selectedVersion])

  const rowsByNature = useMemo(() => {
    const grouped: Record<CommercialNature, NatureRow[]> = { recurring: [], non_recurring: [], on_demand: [] }
    for (const component of visibleComponents) {
      const { nature, cells } = persistedComponentTableCells(component, snapshot)
      const section = NATURE_SECTIONS.find((entry) => entry.nature === nature)
      if (!section) continue
      grouped[nature].push({ componentId: component.id, name: cells.name, columns: section.columns, cellsByColumn: buildCellsByColumn(section.columns, cells) })
    }
    return grouped
  }, [visibleComponents, snapshot])

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader title="Commercials" description="Persisted Commercial Configuration for this customer." />
      <CustomerCommercialConfigurationHeader customerName={customerName} configuration={configuration} version={selectedVersion} />

      <div className="flex flex-col gap-6 py-4">
        {selectedVersion ? (
          <p className="px-6 text-xs text-muted-foreground">
            Showing Version {selectedVersion.versionNumber}
            {selectedVersion.status === "active" ? " (current)" : " (historical, read-only)"}.
          </p>
        ) : null}

        {NATURE_SECTIONS.map((section) => (
          <div key={section.nature} className="flex flex-col gap-3 px-6">
            <span className="text-sm font-semibold text-foreground">{section.title}</span>
            {rowsByNature[section.nature].length === 0 ? (
              <p className="text-xs text-muted-foreground">{section.emptyMessage}</p>
            ) : (
              <ReadOnlyComponentsTable rows={rowsByNature[section.nature]} />
            )}
          </div>
        ))}

        <Separator />

        <VersionHistoryTable versions={versions} selectedVersionNumber={selectedVersionNumber} onSelectVersion={setSelectedVersionNumber} />
      </div>
    </div>
  )
}

export { CustomerCommercialConfigurationView }
