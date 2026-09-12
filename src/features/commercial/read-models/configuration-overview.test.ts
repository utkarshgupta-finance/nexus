import { describe, expect, it } from "vitest"

import { toVersionSummaries } from "./configuration-overview-helpers"
import type { CommercialChange, CommercialComponent } from "../domain/types"

// Fictional fixture data only.

function change(overrides: Partial<CommercialChange> & Pick<CommercialChange, "id" | "effectiveDate" | "category">): CommercialChange {
  return {
    commercialConfigurationId: "cfg-1",
    reason: null,
    createdAt: `${overrides.effectiveDate}T00:00:00Z`,
    createdBy: "app-user-1",
    ...overrides,
  }
}

function component(overrides: Partial<CommercialComponent> & Pick<CommercialComponent, "id" | "commercialChangeId" | "effectiveTo">): CommercialComponent {
  return {
    commercialConfigurationId: "cfg-1",
    supersedesComponentId: null,
    measurementDefinitionId: null,
    isRecurring: true,
    pricingRuleKind: "flat",
    pricingRuleParameters: { amount: 100 },
    billingCadence: "monthly",
    billingTiming: "arrears",
    billingQuantityBasis: null,
    reconciliationCadence: "monthly",
    transactionCurrency: "INR",
    fxSnapshotRate: null,
    effectiveFrom: "2026-01-01",
    ...overrides,
  }
}

describe("toVersionSummaries (task correction: 'version' is every Component grouped by its originating Change)", () => {
  it("numbers versions in effective-date order, oldest first, regardless of input order", () => {
    const changes = [
      change({ id: "chg-2", effectiveDate: "2026-06-01", category: "amendment" }),
      change({ id: "chg-1", effectiveDate: "2026-01-01", category: "initial_setup" }),
    ]
    const versions = toVersionSummaries(changes, [])
    expect(versions.map((v) => v.versionNumber)).toEqual([1, 2])
    expect(versions[0].changeId).toBe("chg-1")
    expect(versions[1].changeId).toBe("chg-2")
  })

  it("a version is 'active' when its Components are still open (effectiveTo null)", () => {
    const changes = [change({ id: "chg-1", effectiveDate: "2026-01-01", category: "initial_setup" })]
    const components = [component({ id: "comp-1", commercialChangeId: "chg-1", effectiveTo: null })]
    const versions = toVersionSummaries(changes, components)
    expect(versions[0].status).toBe("active")
    expect(versions[0].effectiveTo).toBeNull()
  })

  it("a version is 'superseded' once its Components have been closed", () => {
    const changes = [
      change({ id: "chg-1", effectiveDate: "2026-01-01", category: "initial_setup" }),
      change({ id: "chg-2", effectiveDate: "2026-06-01", category: "amendment" }),
    ]
    const components = [
      component({ id: "comp-1", commercialChangeId: "chg-1", effectiveTo: "2026-05-31" }),
      component({ id: "comp-2", commercialChangeId: "chg-2", effectiveTo: null }),
    ]
    const versions = toVersionSummaries(changes, components)
    expect(versions[0].status).toBe("superseded")
    expect(versions[0].effectiveTo).toBe("2026-05-31")
    expect(versions[1].status).toBe("active")
  })

  it("reads billingCurrency and fxSnapshotRate straight from the version's own Components, never a current rate", () => {
    const changes = [change({ id: "chg-1", effectiveDate: "2026-01-01", category: "initial_setup" })]
    const components = [
      component({ id: "comp-1", commercialChangeId: "chg-1", effectiveTo: null, transactionCurrency: "USD", fxSnapshotRate: 91 }),
    ]
    const versions = toVersionSummaries(changes, components)
    expect(versions[0].billingCurrency).toBe("USD")
    expect(versions[0].fxSnapshotRate).toBe(91)
  })

  it("a later version's own FX snapshot is independent of an earlier version's, even for the same currency", () => {
    const changes = [
      change({ id: "chg-1", effectiveDate: "2026-01-01", category: "initial_setup" }),
      change({ id: "chg-2", effectiveDate: "2026-06-01", category: "renewal" }),
    ]
    const components = [
      component({ id: "comp-1", commercialChangeId: "chg-1", effectiveTo: "2026-05-31", transactionCurrency: "USD", fxSnapshotRate: 91 }),
      component({ id: "comp-2", commercialChangeId: "chg-2", effectiveTo: null, transactionCurrency: "USD", fxSnapshotRate: 93 }),
    ]
    const versions = toVersionSummaries(changes, components)
    expect(versions[0].fxSnapshotRate).toBe(91)
    expect(versions[1].fxSnapshotRate).toBe(93)
  })

  it("componentIds only includes Components created by that exact Change", () => {
    const changes = [
      change({ id: "chg-1", effectiveDate: "2026-01-01", category: "initial_setup" }),
      change({ id: "chg-2", effectiveDate: "2026-06-01", category: "amendment" }),
    ]
    const components = [
      component({ id: "comp-1", commercialChangeId: "chg-1", effectiveTo: "2026-05-31" }),
      component({ id: "comp-2", commercialChangeId: "chg-2", effectiveTo: null }),
      component({ id: "comp-3", commercialChangeId: "chg-2", effectiveTo: null }),
    ]
    const versions = toVersionSummaries(changes, components)
    expect(versions[0].componentIds).toEqual(["comp-1"])
    expect(versions[1].componentIds).toEqual(["comp-2", "comp-3"])
  })

  it("a Change with no Components yet has null billingCurrency/fxSnapshotRate and 'active' status, never a crash", () => {
    const changes = [change({ id: "chg-1", effectiveDate: "2026-01-01", category: "initial_setup" })]
    const versions = toVersionSummaries(changes, [])
    expect(versions[0].billingCurrency).toBeNull()
    expect(versions[0].fxSnapshotRate).toBeNull()
    expect(versions[0].status).toBe("active")
  })
})
