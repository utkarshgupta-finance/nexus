import { describe, expect, it, vi, beforeEach } from "vitest"

/**
 * Stable Commercial Component Identity regression test (Nexus Foundational
 * Hardening, Phase 1). approve_commercial_configuration_version (supabase/
 * migrations/20260920080000_fix_add_commercial_component_stable_key.sql)
 * has always correctly forwarded whatever `stable_component_key` it
 * receives on each component in the `p_components` payload; the real
 * defect was that `approveVersion` here never included that key at all,
 * so every amendment silently minted a brand new identity for every
 * component, existing or new. This test guards the payload builder
 * directly: an existing component (loaded via toDraftComponent, carrying
 * its persisted stableComponentKey) must send that same key through
 * unchanged, and a genuinely new component (createComponent, whose
 * stableComponentKey is null) must send null, letting the RPC's own
 * `coalesce(p_stable_component_key, p_new_commercial_component_id)` mint
 * a fresh identity for it.
 */
vi.mock("server-only", () => ({}))

const getVersionByRequestId = vi.fn()
const getLatestRevisionForRequest = vi.fn()
const approveVersionData = vi.fn()

vi.mock("../data/commercial-version.data", () => ({
  getVersionByRequestId: (...args: unknown[]) => getVersionByRequestId(...args),
  getLatestRevisionForRequest: (...args: unknown[]) => getLatestRevisionForRequest(...args),
  approveVersion: (...args: unknown[]) => approveVersionData(...args),
}))

import { createComponent } from "../domain/commercial-rate"
import { toDraftComponent } from "../domain/commercial-configuration-view"
import { REFERENCE_MASTER_FIXTURES } from "@/features/reference-data/domain/fixtures"
import type { CommercialComponent } from "@/features/commercial"
import type { CommercialConfigurationVersionRow } from "../data/commercial-version-row-types"
import type { SubmissionRevisionRow } from "../data/case-row-types"

function persistedComponent(overrides: Partial<CommercialComponent> = {}): CommercialComponent {
  return {
    id: "row-existing-v2",
    commercialConfigurationId: "cfg-1",
    commercialChangeId: "chg-1",
    supersedesComponentId: null,
    measurementDefinitionId: null,
    isRecurring: true,
    pricingRuleKind: "linear",
    pricingRuleParameters: {
      name: "Distributor Platform",
      commercialNature: "recurring",
      invoiceFrequencyCode: "monthly",
      invoiceTimingCode: "advance",
      rate: 200,
      pricingUnit: "USER",
    },
    billingCadence: "monthly",
    billingTiming: "advance",
    billingQuantityBasis: "previous_period_actual",
    reconciliationCadence: "monthly",
    transactionCurrency: "INR",
    fxSnapshotRate: null,
    effectiveFrom: "2026-01-01",
    effectiveTo: null,
    stableComponentKey: "stable-key-original",
    ...overrides,
  }
}

function versionRow(overrides: Partial<CommercialConfigurationVersionRow> = {}): CommercialConfigurationVersionRow {
  return {
    request_id: "req-1",
    version_number: 2,
    commercial_configuration_id: "cfg-1",
    change_category: "amendment",
    status: "submitted",
    reason: "rate change",
    effective_date: "2026-11-01",
    commercial_change_id: null,
    decided_by: null,
    decided_at: null,
    decision_reason: null,
    cancelled_by: null,
    cancelled_at: null,
    cancelled_reason: null,
    workflow_version_id: null,
    current_workflow_node_key: null,
    workflow_cycle_number: 1,
    row_version: 1,
    created_at: "2026-10-01T00:00:00Z",
    created_by: "maker-1",
    updated_at: "2026-10-01T00:00:00Z",
    updated_by: "maker-1",
    ...overrides,
  }
}

function revisionRow(commercialRate: unknown): SubmissionRevisionRow {
  return {
    id: "rev-1",
    request_id: "req-1",
    revision_number: 1,
    status: "draft",
    row_version: 1,
    submission_contract_version: 1,
    raw_data: { commercial_rate: commercialRate },
    effective_data: null,
    created_at: "2026-10-01T00:00:00Z",
    created_by: "maker-1",
    updated_at: "2026-10-01T00:00:00Z",
    updated_by: "maker-1",
    submitted_at: "2026-10-01T00:00:00Z",
    submitted_by: "maker-1",
  }
}

beforeEach(() => {
  getVersionByRequestId.mockReset()
  getLatestRevisionForRequest.mockReset()
  approveVersionData.mockReset()
})

describe("approveVersion: stable_component_key propagation", () => {
  it("carries an existing component's stableComponentKey through unchanged, and sends null for a genuinely new component", async () => {
    const { approveVersion } = await import("./commercial-version.service")

    const existingDraft = toDraftComponent(persistedComponent())
    const newDraft = {
      ...createComponent("recurring", "per_unit"),
      description: "New Add-On",
      rate: 50,
      pricingUnit: "USER",
      invoiceTerms: { invoiceFrequency: "monthly" as const, invoiceTiming: "advance" as const },
    }

    getVersionByRequestId.mockResolvedValue(versionRow())
    getLatestRevisionForRequest.mockResolvedValue(
      revisionRow({ billingCurrency: "INR", components: [existingDraft, newDraft] })
    )
    approveVersionData.mockResolvedValue(versionRow({ status: "approved" }))

    await approveVersion("req-1", "checker-1", REFERENCE_MASTER_FIXTURES)

    expect(approveVersionData).toHaveBeenCalledTimes(1)
    const [, components] = approveVersionData.mock.calls[0] as [string, Record<string, unknown>[], string]
    expect(components).toHaveLength(2)
    expect(components[0].stable_component_key).toBe("stable-key-original")
    expect(components[1].stable_component_key).toBeNull()
  })
})
