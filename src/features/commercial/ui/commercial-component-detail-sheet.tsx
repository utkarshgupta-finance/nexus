import { GaugeIcon, WalletIcon } from "lucide-react"

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import type { ComponentSummary } from "@/features/commercial"
import { KeyValueGrid } from "@/components/product/key-value-grid"
import { CommercialComponentStateBadge, deriveComponentState } from "./commercial-state-badge"

/**
 * Secondary context: a side panel with the full detail behind one
 * Component row, rather than navigating away from the record
 * (docs/UI_SYSTEM.md §13). Progressive disclosure for the columns the
 * table itself keeps compact (quantity basis, reconciliation cadence,
 * full commitment detail, supersession pointer).
 */

function CommercialComponentDetailSheet({
  component,
  supersededComponentIds,
  open,
  onOpenChange,
}: {
  component: ComponentSummary | null
  supersededComponentIds: ReadonlySet<string>
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md">
        {component ? (
          <div className="flex h-full flex-col overflow-y-auto">
            <SheetHeader>
              <SheetTitle>{component.label}</SheetTitle>
              <SheetDescription>
                <span className="font-mono">{component.id}</span> · {component.pricingRuleKindLabel}
              </SheetDescription>
            </SheetHeader>

            <div className="flex flex-col gap-4 px-6 pb-6">
              <div>
                <CommercialComponentStateBadge
                  state={deriveComponentState(component.id, component.effectiveTo, supersededComponentIds)}
                />
              </div>

              <KeyValueGrid
                columns={2}
                items={[
                  { label: "Measurement", value: component.measurementLabel ?? "No usage measurement" },
                  { label: "Currency", value: component.transactionCurrency },
                  { label: "Billing cadence", value: component.billingCadenceLabel },
                  { label: "Billing timing", value: component.billingTimingLabel },
                  { label: "Quantity basis", value: component.billingQuantityBasisLabel },
                  { label: "Reconciliation cadence", value: component.reconciliationCadenceLabel },
                  { label: "Effective from", value: component.effectiveFrom },
                  { label: "Effective to", value: component.effectiveTo ?? "Ongoing" },
                ]}
              />

              {component.supersedesComponentId ? (
                <>
                  <Separator />
                  <p className="text-xs text-muted-foreground">
                    Replaces an earlier version of this Component&apos;s terms.
                  </p>
                </>
              ) : null}

              <Separator />

              <div className="flex flex-col gap-3">
                <span className="text-[0.7rem] font-medium text-muted-foreground">Commitments</span>
                {component.commitments.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No commitments apply to this Component.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {component.commitments.map((commitment) => {
                      const Icon = commitment.kind === "quantity" ? GaugeIcon : WalletIcon
                      return (
                        <div key={commitment.id} className="flex items-start gap-2 rounded-md bg-muted/40 px-3 py-2">
                          <Icon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs font-medium text-foreground">
                              {commitment.kind === "quantity"
                                ? `Minimum ${commitment.thresholdValue.toLocaleString()} units, ${commitment.periodLabel.toLowerCase()}`
                                : `Minimum ${commitment.thresholdValue.toLocaleString()} ${commitment.currency}, ${commitment.periodLabel.toLowerCase()}`}
                            </span>
                            {commitment.kind === "spend" ? (
                              <span className="text-[0.7rem] text-muted-foreground">
                                Shared across {commitment.memberComponentIds.length} Components
                              </span>
                            ) : null}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

export { CommercialComponentDetailSheet }
