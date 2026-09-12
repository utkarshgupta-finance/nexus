import { billingCadenceLabel } from "../domain/labels"
import type { CommercialChange, CommercialCommitment, CommercialComponent } from "../domain/types"

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

/**
 * One "version" in the plain-English sense the Commercial Configuration
 * UI shows (task correction): every Component created together by the
 * same Commercial Change, numbered in effective-date order (a display
 * convenience, never a stored column, see this migration's own comment:
 * supabase/migrations/20260912210000_commercial_configuration_persistence.sql).
 * `status` is derived, never stored: 'active' means every Component this
 * Change created is still open (`effectiveTo` null); a new Change always
 * closes the entire prior open set in one transaction
 * (`create_commercial_change_for_configuration`), so a version can only
 * ever be fully open or fully closed, never a mix. `billingCurrency`/
 * `fxSnapshotRate` are read straight from this version's own Components,
 * never the current Reference Master rate: an already-created version's
 * FX snapshot is frozen, by construction, at the moment its Components
 * were inserted.
 */
type VersionSummary = {
  versionNumber: number
  changeId: string
  category: CommercialChange["category"]
  effectiveDate: string
  effectiveTo: string | null
  status: "active" | "superseded"
  billingCurrency: string | null
  fxSnapshotRate: number | null
  reason: string | null
  createdAt: string
  createdBy: string | null
  componentIds: string[]
}

/** Groups components by their originating Change into version summaries, ordered oldest first. */
function toVersionSummaries(changes: CommercialChange[], components: CommercialComponent[]): VersionSummary[] {
  const orderedChanges = [...changes].sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate))
  return orderedChanges.map((change, index) => {
    const versionComponents = components.filter((component) => component.commercialChangeId === change.id)
    const effectiveTo = versionComponents.length > 0 ? versionComponents[0].effectiveTo : null
    return {
      versionNumber: index + 1,
      changeId: change.id,
      category: change.category,
      effectiveDate: change.effectiveDate,
      effectiveTo,
      status: effectiveTo === null ? "active" : "superseded",
      billingCurrency: versionComponents[0]?.transactionCurrency ?? null,
      fxSnapshotRate: versionComponents[0]?.fxSnapshotRate ?? null,
      reason: change.reason,
      createdAt: change.createdAt,
      createdBy: change.createdBy,
      componentIds: versionComponents.map((component) => component.id),
    }
  })
}

export { toCommitmentSummary, groupCommitmentSummaries, toVersionSummaries }
export type { CommitmentSummary, VersionSummary }
