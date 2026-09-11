import { GaugeIcon, WalletIcon } from "lucide-react"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import type { CommitmentSummary, ComponentSummary } from "@/features/commercial"

/**
 * Body section: every Commitment on this Configuration, exactly once
 * each. A spend Commitment shared across several Components is one row
 * listing every member, never duplicated into separate rows per
 * Component (the underlying read model already guarantees this; this
 * component only needs to not break that guarantee while rendering it).
 * Quantity and spend are distinguished by icon + label together, never
 * colour alone (docs/UI_SYSTEM.md §3, §12).
 */

function componentLabelById(componentId: string, componentsById: Map<string, ComponentSummary>): string {
  return componentsById.get(componentId)?.label ?? componentId
}

function CommitmentsSection({
  commitments,
  components,
}: {
  commitments: CommitmentSummary[]
  components: ComponentSummary[]
}) {
  const componentsById = new Map(components.map((component) => [component.id, component]))

  return (
    <div className="flex flex-col gap-2">
      <h2 className="px-6 text-[0.7rem] font-medium tracking-wide text-muted-foreground uppercase">Commitments</h2>
      {commitments.length === 0 ? (
        <p className="px-6 pb-4 text-xs text-muted-foreground">No commitments apply to this Configuration.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Kind</TableHead>
              <TableHead>Threshold</TableHead>
              <TableHead>Period</TableHead>
              <TableHead>Applies to</TableHead>
              <TableHead className="hidden lg:table-cell">Effective period</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {commitments.map((commitment) => (
              <TableRow key={commitment.id} className="hover:bg-transparent">
                <TableCell>
                  <Badge variant="outline" className="gap-1 font-normal">
                    {commitment.kind === "quantity" ? (
                      <GaugeIcon data-icon="inline-start" className="size-3" />
                    ) : (
                      <WalletIcon data-icon="inline-start" className="size-3" />
                    )}
                    {commitment.kind === "quantity" ? "Quantity" : "Spend"}
                  </Badge>
                </TableCell>
                <TableCell className="text-foreground tabular-nums">
                  {commitment.kind === "quantity"
                    ? commitment.thresholdValue.toLocaleString()
                    : `${commitment.thresholdValue.toLocaleString()} ${commitment.currency}`}
                </TableCell>
                <TableCell className="text-muted-foreground">{commitment.periodLabel}</TableCell>
                <TableCell>
                  {commitment.kind === "quantity" ? (
                    <span className="text-foreground">
                      {componentLabelById(commitment.commercialComponentId, componentsById)}
                    </span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {commitment.memberComponentIds.map((componentId) => (
                        <Badge key={componentId} variant="secondary" className="font-normal">
                          {componentLabelById(componentId, componentsById)}
                        </Badge>
                      ))}
                    </div>
                  )}
                </TableCell>
                <TableCell className="hidden text-muted-foreground lg:table-cell">
                  {commitment.effectiveFrom} to {commitment.effectiveTo ?? "ongoing"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}

export { CommitmentsSection }
