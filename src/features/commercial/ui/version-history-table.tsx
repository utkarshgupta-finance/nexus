import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { commercialChangeCategoryLabel } from "@/features/commercial"
import type { VersionSummary } from "@/features/commercial"

/**
 * Restrained Version History (task correction §32): Version/Status/
 * Effective From/Effective To/Billing Currency/FX Snapshot/Created At.
 * No diff engine, no per-field change highlighting: each row links its
 * own Components already loaded elsewhere on this page (see
 * CommercialConfigurationOverview's own component filtering by
 * `versionNumber` for "View details"), never a second fetch.
 */

function formatFxSnapshot(currencyCode: string | null, rate: number | null): string {
  if (!currencyCode || currencyCode === "INR") return "INR (no conversion)"
  if (rate === null) return "-"
  return `1 ${currencyCode} = INR ${rate.toFixed(2)}`
}

function VersionHistoryTable({
  versions,
  selectedVersionNumber,
  onSelectVersion,
}: {
  versions: VersionSummary[]
  selectedVersionNumber: number | null
  onSelectVersion: (versionNumber: number) => void
}) {
  const sorted = [...versions].sort((a, b) => b.versionNumber - a.versionNumber)

  return (
    <div className="flex flex-col gap-2">
      <h2 className="px-6 text-[0.7rem] font-medium tracking-wide text-muted-foreground uppercase">Version history</h2>
      {sorted.length === 0 ? (
        <p className="px-6 pb-4 text-xs text-muted-foreground">No commercial versions recorded yet.</p>
      ) : (
        <div className="mx-6 overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Version</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Effective From</TableHead>
                <TableHead>Effective To</TableHead>
                <TableHead>Billing Currency</TableHead>
                <TableHead>FX Snapshot</TableHead>
                <TableHead>Created At</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((version) => (
                <TableRow key={version.changeId} data-selected={version.versionNumber === selectedVersionNumber}>
                  <TableCell className="font-medium text-foreground">Version {version.versionNumber}</TableCell>
                  <TableCell>
                    <Badge variant="ghost" className={version.status === "active" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}>
                      {version.status === "active" ? "Active" : "Superseded"}
                    </Badge>
                  </TableCell>
                  <TableCell>{commercialChangeCategoryLabel(version.category)}</TableCell>
                  <TableCell>{version.effectiveDate}</TableCell>
                  <TableCell>{version.effectiveTo ?? "-"}</TableCell>
                  <TableCell>{version.billingCurrency ?? "-"}</TableCell>
                  <TableCell>{formatFxSnapshot(version.billingCurrency, version.fxSnapshotRate)}</TableCell>
                  <TableCell>{version.createdAt.slice(0, 10)}</TableCell>
                  <TableCell>
                    <button
                      type="button"
                      className="text-xs font-medium text-foreground underline underline-offset-2"
                      onClick={() => onSelectVersion(version.versionNumber)}
                    >
                      View details
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

export { VersionHistoryTable }
