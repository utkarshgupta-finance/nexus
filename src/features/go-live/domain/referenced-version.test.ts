import { describe, expect, it } from "vitest"

import { resolveReferencedVersionSnapshot } from "./referenced-version"
import type { ComponentSummary, VersionSummary } from "@/features/commercial"

const STABLE_KEY = "stable-1"

function version(overrides: Partial<VersionSummary>): VersionSummary {
  return {
    versionNumber: 1,
    changeId: "change-1",
    category: "amendment",
    effectiveDate: "2026-01-01",
    effectiveTo: null,
    status: "active",
    billingCurrency: "INR",
    fxSnapshotRate: null,
    reason: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    createdBy: null,
    approvedBy: null,
    componentIds: [],
    ...overrides,
  }
}

function component(overrides: Partial<ComponentSummary>): ComponentSummary {
  return {
    id: "component-1",
    label: "Flat fee",
    pricingRuleKindLabel: "Flat fee",
    measurementLabel: null,
    billingCadenceLabel: "Monthly",
    billingTimingLabel: "Advance",
    billingQuantityBasisLabel: "Fixed",
    reconciliationCadenceLabel: "Monthly",
    transactionCurrency: "INR",
    effectiveFrom: "2026-01-01",
    effectiveTo: null,
    supersedesComponentId: null,
    isRecurring: true,
    stableComponentKey: STABLE_KEY,
    commitments: [],
    ...overrides,
  }
}

describe("resolveReferencedVersionSnapshot", () => {
  it("returns the locked snapshot for a version that is still current", () => {
    const versions = [version({ changeId: "change-1", versionNumber: 1, status: "active", componentIds: ["component-1"] })]
    const components = [component({ id: "component-1", effectiveTo: null })]

    const snapshot = resolveReferencedVersionSnapshot(versions, components, "change-1", STABLE_KEY, () => null)

    expect(snapshot).not.toBeNull()
    expect(snapshot?.versionNumber).toBe(1)
    expect(snapshot?.isSuperseded).toBe(false)
    expect(snapshot?.currentVersionNumber).toBeNull()
  })

  it("flags isSuperseded and resolves the current version number when a later version has closed the referenced component (PG-057)", () => {
    const versions = [
      version({ changeId: "change-1", versionNumber: 1, status: "superseded", effectiveTo: "2026-02-01", componentIds: ["component-1"] }),
      version({ changeId: "change-2", versionNumber: 2, status: "active", componentIds: ["component-2"] }),
    ]
    const components = [
      component({ id: "component-1", effectiveTo: "2026-01-31", pricingRuleKindLabel: "Flat fee (old)" }),
      component({ id: "component-2", effectiveTo: null, pricingRuleKindLabel: "Flat fee (new)" }),
    ]

    const snapshot = resolveReferencedVersionSnapshot(versions, components, "change-1", STABLE_KEY, () => null)

    expect(snapshot).not.toBeNull()
    expect(snapshot?.versionNumber).toBe(1)
    expect(snapshot?.pricingModelLabel).toBe("Flat fee (old)")
    expect(snapshot?.isSuperseded).toBe(true)
    expect(snapshot?.currentVersionNumber).toBe(2)
  })

  it("returns null when the referenced version cannot be found", () => {
    const snapshot = resolveReferencedVersionSnapshot([], [], "missing-change", STABLE_KEY, () => null)
    expect(snapshot).toBeNull()
  })

  it("returns null when the referenced version exists but never created a component for this stable key", () => {
    const versions = [version({ changeId: "change-1", componentIds: ["component-1"] })]
    const components = [component({ id: "component-1", stableComponentKey: "a-different-stable-key" })]

    const snapshot = resolveReferencedVersionSnapshot(versions, components, "change-1", STABLE_KEY, () => null)
    expect(snapshot).toBeNull()
  })
})
