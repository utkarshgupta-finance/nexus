import { billingCadenceLabel } from "../domain/labels"
import type { CommercialCommitment } from "../domain/types"

/**
 * Pure composition helpers for the Configuration Overview read model,
 * kept in their own file with zero dependency on data/services (so, by
 * extension, no dependency on the server-only Supabase client either).
 * Split out so this logic can be unit tested directly; see
 * component-detail-helpers.ts for the same rationale applied to the
 * Component Detail read model.
 */

type CommitmentSummary =
  | {
      kind: "quantity"
      id: string
      commercialComponentId: string
      thresholdValue: number
      currency: null
      period: "monthly"
      periodLabel: string
      effectiveFrom: string
      effectiveTo: string | null
    }
  | {
      kind: "spend"
      id: string
      memberComponentIds: string[]
      thresholdValue: number
      currency: string
      period: CommercialCommitment["period"]
      periodLabel: string
      effectiveFrom: string
      effectiveTo: string | null
    }

function toCommitmentSummary(commitment: CommercialCommitment): CommitmentSummary {
  if (commitment.kind === "quantity") {
    return {
      kind: "quantity",
      id: commitment.id,
      commercialComponentId: commitment.commercialComponentId,
      thresholdValue: commitment.thresholdValue,
      currency: null,
      period: "monthly",
      periodLabel: billingCadenceLabel("monthly"),
      effectiveFrom: commitment.effectiveFrom,
      effectiveTo: commitment.effectiveTo,
    }
  }
  return {
    kind: "spend",
    id: commitment.id,
    memberComponentIds: commitment.memberComponentIds,
    thresholdValue: commitment.thresholdValue,
    currency: commitment.currency,
    period: commitment.period,
    periodLabel: billingCadenceLabel(commitment.period),
    effectiveFrom: commitment.effectiveFrom,
    effectiveTo: commitment.effectiveTo,
  }
}

/**
 * Maps each Commitment to a CommitmentSummary exactly once, then groups
 * those (shared, reference-equal) summaries by every Component id they
 * apply to: one entry for a quantity commitment's own Component, one
 * entry per member for a spend commitment. `summaries` is therefore
 * already the deduplicated "all commitments" list (one element per
 * commitment id, regardless of how many Components it touches); a spend
 * commitment shared by N Components appears in N of the map's value
 * arrays, still as the same object, never as N separate commitments.
 */
function groupCommitmentSummaries(commitments: CommercialCommitment[]): {
  summaries: CommitmentSummary[]
  byComponentId: Map<string, CommitmentSummary[]>
} {
  const byComponentId = new Map<string, CommitmentSummary[]>()
  const summaries: CommitmentSummary[] = []

  for (const commitment of commitments) {
    const summary = toCommitmentSummary(commitment)
    summaries.push(summary)
    const memberIds = commitment.kind === "quantity" ? [commitment.commercialComponentId] : commitment.memberComponentIds
    for (const componentId of memberIds) {
      const existing = byComponentId.get(componentId) ?? []
      existing.push(summary)
      byComponentId.set(componentId, existing)
    }
  }

  return { summaries, byComponentId }
}

export { toCommitmentSummary, groupCommitmentSummaries }
export type { CommitmentSummary }
