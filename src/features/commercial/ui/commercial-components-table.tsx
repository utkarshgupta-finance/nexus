import { GaugeIcon, WalletIcon } from "lucide-react"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import type { ComponentSummary } from "@/features/commercial"
import { CommercialComponentStateBadge, deriveComponentState } from "./commercial-state-badge"

/**
 * Main body: the Components table. First-class Nexus table
 * (docs/UI_SYSTEM.md §9): strong primary cell content with muted
 * secondary metadata beneath, numeric/date columns right-aligned with
 * tabular numerals, whole row clickable to open the detail panel.
 * Lower-priority columns collapse on narrower screens rather than
 * turning rows into cards (§17).
 */

function CommitmentChip({ commitment }: { commitment: ComponentSummary["commitments"][number] }) {
  const Icon = commitment.kind === "quantity" ? GaugeIcon : WalletIcon
  const label =
    commitment.kind === "quantity"
      ? `Min ${commitment.thresholdValue.toLocaleString()}/mo`
      : `Shared spend · ${commitment.memberComponentIds.length}`
  return (
    <Badge variant="outline" className="gap-1 font-normal">
      <Icon data-icon="inline-start" className="size-3" />
      {label}
    </Badge>
  )
}

function CommercialComponentsTable({
  components,
  onSelect,
}: {
  components: ComponentSummary[]
  onSelect: (component: ComponentSummary) => void
}) {
  const supersededComponentIds = new Set(
    components.map((component) => component.supersedesComponentId).filter((id): id is string => id !== null)
  )

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Component</TableHead>
          <TableHead>Pricing</TableHead>
          <TableHead>Billing</TableHead>
          <TableHead>Commitment</TableHead>
          <TableHead className="hidden lg:table-cell">Currency</TableHead>
          <TableHead className="hidden lg:table-cell">Effective period</TableHead>
          <TableHead>State</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {components.length === 0 ? (
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={7} className="py-10 text-center text-xs text-muted-foreground">
              No Components on this Configuration yet.
            </TableCell>
          </TableRow>
        ) : (
          components.map((component) => {
            const state = deriveComponentState(component.id, component.effectiveTo, supersededComponentIds)
            return (
              <TableRow key={component.id} className="cursor-pointer" onClick={() => onSelect(component)}>
                <TableCell>
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium text-foreground">{component.label}</span>
                    {component.measurementLabel ? (
                      <span className="text-[0.7rem] text-muted-foreground">{component.measurementLabel}</span>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="text-foreground">{component.pricingRuleKindLabel}</TableCell>
                <TableCell>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-foreground">{component.billingCadenceLabel}</span>
                    <span className="text-[0.7rem] text-muted-foreground">{component.billingTimingLabel}</span>
                  </div>
                </TableCell>
                <TableCell>
                  {component.commitments.length === 0 ? (
                    <span className="text-muted-foreground">None</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {component.commitments.map((commitment) => (
                        <CommitmentChip key={commitment.id} commitment={commitment} />
                      ))}
                    </div>
                  )}
                </TableCell>
                <TableCell className="hidden text-foreground lg:table-cell">
                  {component.transactionCurrency}
                </TableCell>
                <TableCell className="hidden text-muted-foreground lg:table-cell">
                  {component.effectiveFrom} to {component.effectiveTo ?? "ongoing"}
                </TableCell>
                <TableCell>
                  <CommercialComponentStateBadge state={state} />
                </TableCell>
              </TableRow>
            )
          })
        )}
      </TableBody>
    </Table>
  )
}

export { CommercialComponentsTable }
