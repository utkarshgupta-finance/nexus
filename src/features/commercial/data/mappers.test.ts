import { describe, expect, it } from "vitest"

import {
  toBillingCalculation,
  toCommercialChange,
  toCommercialCommitment,
  toCommercialComponent,
  toCommercialConfiguration,
  toEarnedResult,
  toInvoiceEligibilityEvent,
  toInvoiceEvidence,
  toInvoiceEvidenceItem,
  toMeasurementDefinition,
  toReconciliationAdjustment,
} from "./mappers"

// All fixture data below is fictional: generic ids, no real customer or
// business content, matching this repository's public-repo safety rules.

describe("toCommercialConfiguration", () => {
  it("maps snake_case row to camelCase domain shape", () => {
    const result = toCommercialConfiguration({
      id: "cfg-1",
      customer_id: "cust-1",
      key: "acme-2026",
      name: "Acme Fictional Account",
      relationship_note: null,
      is_active: true,
      commercial_change_id: "chg-1",
      row_version: 1,
      created_at: "2026-01-01T00:00:00Z",
      created_by: "user-1",
      updated_at: "2026-01-01T00:00:00Z",
      updated_by: "user-1",
    })

    expect(result.id).toBe("cfg-1")
    expect(result.originatingChangeId).toBe("chg-1")
    expect(result.isActive).toBe(true)
    expect(result.relationshipNote).toBeNull()
  })
})

describe("toCommercialChange", () => {
  it("maps request_id to id", () => {
    const result = toCommercialChange({
      request_id: "req-1",
      commercial_configuration_id: "cfg-1",
      change_category: "initial_setup",
      effective_date: "2026-01-01",
      reason: null,
      created_at: "2026-01-01T00:00:00Z",
      created_by: "user-1",
    })

    expect(result.id).toBe("req-1")
    expect(result.category).toBe("initial_setup")
  })
})

describe("toMeasurementDefinition", () => {
  it("passes dimension keys through unchanged", () => {
    const result = toMeasurementDefinition({
      id: "md-1",
      key: "api_calls",
      name: "API Calls",
      unit: "calls",
      business_definition: "Fictional business meaning",
      counting_rule: "Fictional counting rule",
      period_basis: "monthly",
      dimension_keys: ["region"],
      expected_source: null,
      status: "active",
    })

    expect(result.dimensionKeys).toEqual(["region"])
    expect(result.status).toBe("active")
  })
})

describe("toCommercialComponent", () => {
  it("preserves the arrears/no-quantity-basis shape", () => {
    const result = toCommercialComponent({
      id: "comp-1",
      commercial_configuration_id: "cfg-1",
      commercial_change_id: "chg-1",
      supersedes_component_id: null,
      measurement_definition_id: "md-1",
      is_recurring: true,
      pricing_rule_kind: "linear",
      pricing_rule_parameters: { rate: 10 },
      billing_cadence: "monthly",
      billing_timing: "arrears",
      billing_quantity_basis: null,
      reconciliation_cadence: "monthly",
      transaction_currency: "USD",
      fx_snapshot_rate: 91,
      effective_from: "2026-01-01",
      effective_to: null,
    })

    expect(result.billingTiming).toBe("arrears")
    expect(result.billingQuantityBasis).toBeNull()
    expect(result.measurementDefinitionId).toBe("md-1")
    expect(result.fxSnapshotRate).toBe(91)
  })
})

describe("toCommercialCommitment", () => {
  it("maps a quantity commitment to its single direct Component", () => {
    const result = toCommercialCommitment({
      id: "commit-1",
      commercial_change_id: "chg-1",
      commercial_component_id: "comp-1",
      kind: "quantity",
      threshold_value: 100,
      currency: null,
      period: "monthly",
      effective_from: "2026-01-01",
      effective_to: null,
    })

    if (result.kind !== "quantity") throw new Error("expected kind = quantity")
    expect(result.commercialComponentId).toBe("comp-1")
    expect(result.currency).toBeNull()
    expect(result.period).toBe("monthly")
  })

  it("maps a spend commitment using the caller-supplied membership, not a null placeholder", () => {
    const result = toCommercialCommitment(
      {
        id: "commit-1",
        commercial_change_id: "chg-1",
        commercial_component_id: null,
        kind: "spend",
        threshold_value: 1000,
        currency: "USD",
        period: "quarterly",
        effective_from: "2026-01-01",
        effective_to: null,
      },
      ["comp-1", "comp-2"]
    )

    if (result.kind !== "spend") throw new Error("expected kind = spend")
    expect(result.memberComponentIds).toEqual(["comp-1", "comp-2"])
    expect(result.currency).toBe("USD")
  })

  it("represents one spend commitment shared by two Components as a single object with two members", () => {
    // Regression guard for the "do not flatten a shared spend commitment
    // into fake per-Component commitments" requirement: mapping the same
    // row twice with the same membership list must yield the same
    // logical commitment (same id), not two independent objects.
    const row = {
      id: "commit-shared",
      commercial_change_id: "chg-1",
      commercial_component_id: null,
      kind: "spend" as const,
      threshold_value: 5000,
      currency: "USD",
      period: "annual" as const,
      effective_from: "2026-01-01",
      effective_to: null,
    }

    const result = toCommercialCommitment(row, ["comp-1", "comp-2", "comp-3"])

    if (result.kind !== "spend") throw new Error("expected kind = spend")
    expect(result.id).toBe("commit-shared")
    expect(result.memberComponentIds).toHaveLength(3)
    expect(new Set(result.memberComponentIds)).toEqual(new Set(["comp-1", "comp-2", "comp-3"]))
  })

  it("throws for a quantity row missing its required commercial_component_id", () => {
    expect(() =>
      toCommercialCommitment({
        id: "commit-bad",
        commercial_change_id: "chg-1",
        commercial_component_id: null,
        kind: "quantity",
        threshold_value: 100,
        currency: null,
        period: "monthly",
        effective_from: "2026-01-01",
        effective_to: null,
      })
    ).toThrow()
  })

  it("throws for a spend row with no resolved membership supplied", () => {
    expect(() =>
      toCommercialCommitment({
        id: "commit-bad",
        commercial_change_id: "chg-1",
        commercial_component_id: null,
        kind: "spend",
        threshold_value: 1000,
        currency: "USD",
        period: "quarterly",
        effective_from: "2026-01-01",
        effective_to: null,
      })
    ).toThrow()
  })
})

describe("toEarnedResult", () => {
  it("maps versioning fields through unchanged", () => {
    const result = toEarnedResult({
      id: "er-2",
      commercial_component_id: "comp-1",
      period_start: "2026-01-01",
      period_end: "2026-01-31",
      measurement_definition_id: "md-1",
      commercial_commitment_id: null,
      result_version: 2,
      supersedes_earned_result_id: "er-1",
      raw_quantity: 12,
      calculated_quantity: 12,
      calculated_amount: 120,
      transaction_currency: "USD",
      pricing_calculation_version: "v1",
      rounding_policy_version: "v1",
      status: "open",
      finalized_at: null,
      finalized_by: null,
      created_at: "2026-02-01T00:00:00Z",
    })

    expect(result.resultVersion).toBe(2)
    expect(result.supersedesEarnedResultId).toBe("er-1")
    expect(result.status).toBe("open")
  })
})

describe("toBillingCalculation", () => {
  it("maps a fixed-basis row with no source ids", () => {
    const result = toBillingCalculation({
      id: "bc-1",
      commercial_component_id: "comp-1",
      billing_period_start: "2026-01-01",
      billing_period_end: "2026-01-31",
      billing_quantity_basis_used: "fixed",
      basis_quantity: null,
      source_earned_result_id: null,
      source_commercial_commitment_id: null,
      pricing_calculation_version: "v1",
      rounding_policy_version: "v1",
      calculated_amount: 100,
      transaction_currency: "USD",
      created_at: "2026-01-01T00:00:00Z",
    })

    expect(result.billingQuantityBasisUsed).toBe("fixed")
    expect(result.basisQuantity).toBeNull()
    expect(result.sourceEarnedResultId).toBeNull()
  })
})

describe("toInvoiceEligibilityEvent", () => {
  it("maps eligible=false correctly (not a falsy-skip bug)", () => {
    const result = toInvoiceEligibilityEvent({
      id: "iee-1",
      billing_calculation_id: "bc-1",
      eligible: false,
      reason: "period not yet closed",
      decided_by: null,
      created_at: "2026-01-01T00:00:00Z",
    })

    expect(result.eligible).toBe(false)
  })
})

describe("toInvoiceEvidence", () => {
  it("maps a credit_note header", () => {
    const result = toInvoiceEvidence({
      id: "ie-1",
      evidence_kind: "credit_note",
      external_reference: "CN-1001",
      external_date: "2026-01-15",
      amount: 50,
      currency: "USD",
      source_system: "fictional-erp",
      created_at: "2026-01-15T00:00:00Z",
    })

    expect(result.evidenceKind).toBe("credit_note")
    expect(result.externalReference).toBe("CN-1001")
  })
})

describe("toInvoiceEvidenceItem", () => {
  it("resolves a billing_calculation target", () => {
    const result = toInvoiceEvidenceItem({
      id: "item-1",
      invoice_evidence_id: "ie-1",
      billing_calculation_id: "bc-1",
      reconciliation_adjustment_id: null,
      allocated_amount: 50,
      created_at: "2026-01-15T00:00:00Z",
    })

    expect(result.target).toEqual({ kind: "billing_calculation", billingCalculationId: "bc-1" })
  })

  it("resolves a reconciliation_adjustment target", () => {
    const result = toInvoiceEvidenceItem({
      id: "item-2",
      invoice_evidence_id: "ie-1",
      billing_calculation_id: null,
      reconciliation_adjustment_id: "ra-1",
      allocated_amount: 10,
      created_at: "2026-01-15T00:00:00Z",
    })

    expect(result.target).toEqual({ kind: "reconciliation_adjustment", reconciliationAdjustmentId: "ra-1" })
  })

  it("throws when neither target is set, rather than silently picking one", () => {
    expect(() =>
      toInvoiceEvidenceItem({
        id: "item-3",
        invoice_evidence_id: "ie-1",
        billing_calculation_id: null,
        reconciliation_adjustment_id: null,
        allocated_amount: 10,
        created_at: "2026-01-15T00:00:00Z",
      })
    ).toThrow()
  })
})

describe("toReconciliationAdjustment", () => {
  it("maps resource_id to id and preserves nullable quantityExplanation", () => {
    const result = toReconciliationAdjustment({
      resource_id: "ra-1",
      commercial_component_id: "comp-1",
      window_start: "2026-01-01",
      window_end: "2026-03-31",
      earned_amount: 120,
      billed_amount: 100,
      direction: "additional_billing",
      monetary_difference: 20,
      transaction_currency: "USD",
      reason: "earned result superseded after billing",
      quantity_explanation: null,
      rate_provenance: { note: "fictional rate evidence" },
      supersedes_adjustment_id: null,
      status: "open",
      finalized_at: null,
      finalized_by: null,
      created_at: "2026-04-01T00:00:00Z",
    })

    expect(result.id).toBe("ra-1")
    expect(result.quantityExplanation).toBeNull()
    expect(result.rateProvenance).toEqual({ note: "fictional rate evidence" })
  })
})
