import type { LineItemGoLiveStatus, GoLiveRequest } from "./types"

/**
 * One recurring or on-demand Commercial line item as the Go Live tab
 * needs to show it, per the product brief's own worked examples (SFA:
 * Recurring/User/Per Unit/Version 3/01-Apr-2026/Live/15-Jul-2026/
 * Confirmed; DMS: Recurring/Distributor/Flat Fee/Version 3/01-Apr-2026/
 * No Go Live/-/Pending). Pure display shape, composed in
 * ../services/line-items.service.ts from already-existing Commercial
 * services; no new Commercial data model.
 */
type GoLiveLineItem = {
  customerId: string
  stableComponentKey: string
  commercialComponentId: string
  commercialConfigurationId: string
  /** Null for the never-versioned original onboarding setup: shown as "Version 1" in the UI, matching the Commercial Configuration overview's own numbering convention. */
  commercialVersionId: string | null
  versionNumber: number
  componentLabel: string
  pricingModelLabel: string
  billingCadenceLabel: string
  /** Null when this line item has no Minimum Usage Guarantee commitment. */
  mugSummary: string | null
  isRecurring: boolean
  billingCurrency: string
  effectiveFrom: string
  goLiveStatus: LineItemGoLiveStatus
  currentRequest: GoLiveRequest | null
}

export type { GoLiveLineItem }
