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
 * `status` is derived, never stored, and is one of THREE states, not two
 * (task Phase H): 'superseded' means every Component this Change created
 * has been closed (`effectiveTo` set) by a later Change; 'scheduled'
 * means the Change's Components are still open (`effectiveTo` null) but
 * their own `effectiveDate` has not arrived yet, so this version has been
 * approved but is not yet the customer's real current terms; 'active'
 * means open AND its effective date has already arrived, at most one
 * version at a time. A new Change always closes the entire prior open
 * set in one transaction (`create_commercial_change_for_configuration`
 * for the legacy path, `approve_commercial_configuration_version` for
 * the governed path), so a version can only ever be fully open or fully
 * closed, never a mix; approving a future-dated version does not by
 * itself make it "active" here, only "scheduled", until `today` catches
 * up to its `effectiveDate`. `billingCurrency`/`fxSnapshotRate` are read
 * straight from this version's own Components, never the current
 * Reference Master rate: an already-created version's FX snapshot is
 * frozen, by construction, at the moment its Components were inserted.
 */
type VersionStatus = "scheduled" | "active" | "superseded"

type VersionSummary = {
  versionNumber: number
  changeId: string
  category: CommercialChange["category"]
  effectiveDate: string
  effectiveTo: string | null
  status: VersionStatus
  billingCurrency: string | null
  fxSnapshotRate: number | null
  reason: string | null
  createdAt: string
  createdBy: string | null
  /** The resolved display label (task Phase M: never a raw actor id) of who approved this version through the governed Commercial Configuration Version lifecycle (commercial_configuration_versions.decided_by); null for a version created through the older immediate-promotion path, which has no such row, or for the initial_setup version, which is never approved through that lifecycle. Never fabricated. */
  approvedBy: string | null
  componentIds: string[]
}

/**
 * Groups components by their originating Change into version summaries,
 * ordered oldest first. `approvedByChangeId` is an optional changeId ->
 * approving actor lookup sourced from commercial_configuration_versions.
 * decided_by, entirely additive: omitting it leaves every approvedBy
 * null, exactly as before this field existed. `today` (ISO date,
 * `YYYY-MM-DD`) is an explicit parameter, never read from the system
 * clock inside this pure function, so "is this version active yet" stays
 * deterministic and unit-testable; callers pass the real current date.
 */
function toVersionSummaries(
  changes: CommercialChange[],
  components: CommercialComponent[],
  approvedByChangeId: Map<string, string | null> | undefined,
  today: string
): VersionSummary[] {
  const orderedChanges = [...changes].sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate))
  return orderedChanges.map((change, index) => {
    const versionComponents = components.filter((component) => component.commercialChangeId === change.id)
    const effectiveTo = versionComponents.length > 0 ? versionComponents[0].effectiveTo : null
    const status: VersionStatus = effectiveTo !== null ? "superseded" : change.effectiveDate > today ? "scheduled" : "active"
    return {
      versionNumber: index + 1,
      changeId: change.id,
      category: change.category,
      effectiveDate: change.effectiveDate,
      effectiveTo,
      status,
      billingCurrency: versionComponents[0]?.transactionCurrency ?? null,
      fxSnapshotRate: versionComponents[0]?.fxSnapshotRate ?? null,
      reason: change.reason,
      createdAt: change.createdAt,
      createdBy: change.createdBy,
      approvedBy: approvedByChangeId?.get(change.id) ?? null,
      componentIds: versionComponents.map((component) => component.id),
    }
  })
}

export { toCommitmentSummary, groupCommitmentSummaries, toVersionSummaries }
export type { CommitmentSummary, VersionSummary, VersionStatus }
