/**
 * PG-044 (D-006/D-019, Batch 11): two Commercial Components with
 * byte-for-byte identical scope, rate, and currency could both be
 * accepted and persisted as independently open rows, with no signal to a
 * reviewer before approval. DECIDED (2026-09-28): warn, don't block (unlike
 * PG-045's sibling decision for duplicate designation row NAMES within one
 * component, which is a hard block): legitimate business reasons for two
 * identical-looking components may exist (e.g. separate contractual
 * lines), so a warning informs the reviewer without removing their
 * judgment.
 *
 * A version's own billing currency is a single field on the whole draft
 * (`CommercialRateDraft.billingCurrency`), not per-component, so every
 * component being compared here already shares the same currency; only
 * "scope" (nature + pricing model + the pricing-specific fields that
 * determine what is actually charged) needs comparing pairwise. Purely a
 * same-draft comparison (this version's own proposed components against
 * each other), never against already-open sibling components elsewhere on
 * the configuration: `approve_commercial_configuration_version` always
 * closes every currently-open component and replaces the full set from
 * the submitted draft, so a "carried forward" component is represented by
 * exactly one entry in the draft, never two.
 */

import type { CommercialComponentDraft } from "./commercial-rate"

type DuplicateScopeMatch = {
  componentIds: string[]
  componentDescriptions: string[]
}

/** Trims and case-folds a designation name for comparison, same normalization PG-045 uses. */
function normalizeName(value: string): string {
  return value.trim().toLowerCase()
}

/**
 * A stable, order-independent key for "what this component actually
 * charges for": nature, pricing model, and the pricing-specific fields for
 * that model. Deliberately excludes id, description/name, notes,
 * stableComponentKey, effectiveFrom/To, invoiceTerms, revenueRecognition,
 * and MUG: those are administrative, timing, or protection details, not
 * scope+rate.
 */
function scopeKey(component: CommercialComponentDraft): string {
  const shape: Record<string, unknown> = { nature: component.nature, pricingModel: component.pricingModel }
  switch (component.pricingModel) {
    case "per_unit":
      shape.rate = component.rate
      shape.pricingUnit = component.pricingUnit
      break
    case "flat_fee":
      shape.amount = component.amount
      break
    case "slab":
      shape.pricingUnit = component.pricingUnit
      shape.slabMethod = component.slabMethod
      shape.slabRows = [...component.slabRows]
        .map((row) => ({ from: row.from, to: row.to, rate: row.rate }))
        .sort((a, b) => (a.from ?? 0) - (b.from ?? 0))
      break
    case "designation_based":
      shape.designationRows = [...component.designationRows]
        .map((row) => ({ designation: normalizeName(row.designation), rate: row.rate, per: row.per }))
        .sort((a, b) => a.designation.localeCompare(b.designation))
      break
  }
  return JSON.stringify(shape)
}

/** Groups components sharing the same scope key; every group has 2+ members. */
function findDuplicateScopeMatches(components: CommercialComponentDraft[]): DuplicateScopeMatch[] {
  const byKey = new Map<string, CommercialComponentDraft[]>()
  for (const component of components) {
    const key = scopeKey(component)
    const group = byKey.get(key)
    if (group) group.push(component)
    else byKey.set(key, [component])
  }
  return [...byKey.values()]
    .filter((group) => group.length > 1)
    .map((group) => ({
      componentIds: group.map((component) => component.id),
      componentDescriptions: group.map((component) => component.description.trim() || "(unnamed component)"),
    }))
}

export { findDuplicateScopeMatches }
export type { DuplicateScopeMatch }
