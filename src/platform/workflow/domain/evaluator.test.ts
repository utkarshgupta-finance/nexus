import { describe, expect, it } from "vitest"

import { evaluateWorkflowRules } from "./evaluator"
import type { WorkflowRule } from "./types"

/**
 * A fictional, generic Customer Master Change Request rule set (task
 * spec §62-64): illustrative only, no real employee names, no real
 * company policy. This is the example the pure evaluator is proven
 * against; nothing here is a shipped Customer Master feature (Customer
 * Master itself does not exist yet), and this file is never imported
 * outside this test.
 */
const LEGAL_ENTITY_NAME_RULE: WorkflowRule = {
  key: "legal_entity_name_changed_requires_tax_evidence",
  description: "A Legal Entity Name change requires revised GST, PAN, and TAN evidence.",
  conditions: [{ field: "legal_entity_name", operator: "changed" }],
  requirements: [
    { kind: "evidence", evidenceType: "gst_certificate", reason: "Legal Entity Name changed" },
    { kind: "evidence", evidenceType: "pan_document", reason: "Legal Entity Name changed" },
    { kind: "evidence", evidenceType: "tan_document", reason: "Legal Entity Name changed" },
  ],
}

/** Context-gated (task spec §64): only applies when country is IN, never a hardcoded global India rule. */
const ADDRESS_CHANGE_RULE: WorkflowRule = {
  key: "address_changed_requires_gst_evidence_when_gst_applies",
  description: "An address/geography change requires a revised GST Certificate, where GST applies.",
  conditions: [
    { field: "address", operator: "changed" },
    { field: "country", operator: "equals", value: "IN" },
  ],
  requirements: [{ kind: "evidence", evidenceType: "gst_certificate", reason: "Address changed and GST applies" }],
}

const SEGMENT_CHANGE_RULE: WorkflowRule = {
  key: "segment_changed_requires_finance_head_approval",
  description: "A Segment change requires Finance Head approval.",
  conditions: [{ field: "segment", operator: "changed" }],
  requirements: [
    { kind: "approval", role: { role: "FINANCE_HEAD" }, reason: "Segment changed" },
  ],
}

const BUSINESS_UNIT_CHANGE_RULE: WorkflowRule = {
  key: "business_unit_changed_requires_old_and_new_bu_head_approval",
  description: "A Business Unit change requires approval from both the old and the new Business Unit Head.",
  conditions: [{ field: "business_unit", operator: "changed" }],
  requirements: [
    {
      kind: "approval",
      role: { role: "BU_HEAD", scope: { source: "current", field: "business_unit" } },
      reason: "Business Unit changed (old BU Head)",
    },
    {
      kind: "approval",
      role: { role: "BU_HEAD", scope: { source: "proposed", field: "business_unit" } },
      reason: "Business Unit changed (new BU Head)",
    },
  ],
}

const ALL_RULES = [LEGAL_ENTITY_NAME_RULE, ADDRESS_CHANGE_RULE, SEGMENT_CHANGE_RULE, BUSINESS_UNIT_CHANGE_RULE]

describe("operators", () => {
  it("changed: fires when the proposed value differs from the current value", () => {
    const result = evaluateWorkflowRules({
      currentValues: { segment: "mid_market" },
      proposedValues: { segment: "sme" },
      rules: [SEGMENT_CHANGE_RULE],
    })
    expect(result.matchedRuleKeys).toEqual([SEGMENT_CHANGE_RULE.key])
  })

  it("changed: does not fire when the field is unchanged", () => {
    const result = evaluateWorkflowRules({
      currentValues: { segment: "mid_market" },
      proposedValues: { segment: "mid_market" },
      rules: [SEGMENT_CHANGE_RULE],
    })
    expect(result.matchedRuleKeys).toEqual([])
  })

  it("changed: does not fire when the field is simply absent from the proposed change", () => {
    const result = evaluateWorkflowRules({
      currentValues: { segment: "mid_market", legal_entity_name: "Old Name" },
      proposedValues: { legal_entity_name: "New Name" },
      rules: [SEGMENT_CHANGE_RULE],
    })
    expect(result.matchedRuleKeys).toEqual([])
  })

  it("equals: matches a condition against the proposed (or, if absent, current) value", () => {
    const result = evaluateWorkflowRules({
      currentValues: { address: "Old Address", country: "IN" },
      proposedValues: { address: "New Address" },
      rules: [ADDRESS_CHANGE_RULE],
    })
    expect(result.matchedRuleKeys).toEqual([ADDRESS_CHANGE_RULE.key])
  })

  it("not_equals: fires only when the resolved value differs from the given value", () => {
    const rule: WorkflowRule = {
      key: "non_default_currency",
      description: "Fires when Billing Currency is not the default.",
      conditions: [{ field: "billing_currency", operator: "not_equals", value: "INR" }],
      requirements: [{ kind: "evidence", evidenceType: "fx_note", reason: "Non-default currency" }],
    }
    expect(
      evaluateWorkflowRules({ currentValues: {}, proposedValues: { billing_currency: "USD" }, rules: [rule] })
        .matchedRuleKeys
    ).toEqual(["non_default_currency"])
    expect(
      evaluateWorkflowRules({ currentValues: {}, proposedValues: { billing_currency: "INR" }, rules: [rule] })
        .matchedRuleKeys
    ).toEqual([])
  })

  it("a rule with no conditions never fires", () => {
    const rule: WorkflowRule = { key: "empty", description: "No conditions.", conditions: [], requirements: [] }
    expect(evaluateWorkflowRules({ currentValues: {}, proposedValues: {}, rules: [rule] }).matchedRuleKeys).toEqual([])
  })
})

describe("context gating: address/geography evidence only applies where GST applies", () => {
  it("requires GST evidence for an address change when country is IN", () => {
    const result = evaluateWorkflowRules({
      currentValues: { address: "Old Address", country: "IN" },
      proposedValues: { address: "New Address" },
      rules: [ADDRESS_CHANGE_RULE],
    })
    expect(result.evidence).toEqual([
      { evidenceType: "gst_certificate", reasons: ["Address changed and GST applies"], matchedRuleKeys: [ADDRESS_CHANGE_RULE.key] },
    ])
  })

  it("does not require GST evidence for an address change outside India (never a hardcoded global rule)", () => {
    const result = evaluateWorkflowRules({
      currentValues: { address: "Old Address", country: "SG" },
      proposedValues: { address: "New Address" },
      rules: [ADDRESS_CHANGE_RULE],
    })
    expect(result.matchedRuleKeys).toEqual([])
  })
})

describe("role scoping", () => {
  it("Segment change requires FINANCE_HEAD approval", () => {
    const result = evaluateWorkflowRules({
      currentValues: { segment: "mid_market" },
      proposedValues: { segment: "sme" },
      rules: [SEGMENT_CHANGE_RULE],
    })
    expect(result.approvals).toEqual([
      { role: "FINANCE_HEAD", scopeValue: undefined, reasons: ["Segment changed"], matchedRuleKeys: [SEGMENT_CHANGE_RULE.key] },
    ])
  })

  it("Business Unit change requires both the old and the new BU_HEAD, kept distinct", () => {
    const result = evaluateWorkflowRules({
      currentValues: { business_unit: "BU_A" },
      proposedValues: { business_unit: "BU_B" },
      rules: [BUSINESS_UNIT_CHANGE_RULE],
    })
    expect(result.approvals).toHaveLength(2)
    const scopeValues = result.approvals.map((approval) => approval.scopeValue).sort()
    expect(scopeValues).toEqual(["BU_A", "BU_B"])
    expect(result.approvals.every((approval) => approval.role === "BU_HEAD")).toBe(true)
  })
})

describe("evidence and approval deduplication", () => {
  it("deduplicates identical evidence requested by two different matched rules", () => {
    const result = evaluateWorkflowRules({
      currentValues: { legal_entity_name: "Old Name", address: "Old Address", country: "IN" },
      proposedValues: { legal_entity_name: "New Name", address: "New Address" },
      rules: [LEGAL_ENTITY_NAME_RULE, ADDRESS_CHANGE_RULE],
    })
    const gstEvidence = result.evidence.filter((item) => item.evidenceType === "gst_certificate")
    expect(gstEvidence).toHaveLength(1)
    expect(gstEvidence[0]?.reasons).toEqual(["Legal Entity Name changed", "Address changed and GST applies"])
    expect(gstEvidence[0]?.matchedRuleKeys).toEqual([LEGAL_ENTITY_NAME_RULE.key, ADDRESS_CHANGE_RULE.key])
  })

  it("never merges two approvals of the same role code with different resolved scope", () => {
    const result = evaluateWorkflowRules({
      currentValues: { business_unit: "BU_A" },
      proposedValues: { business_unit: "BU_B" },
      rules: [BUSINESS_UNIT_CHANGE_RULE],
    })
    expect(result.approvals).toHaveLength(2)
  })
})

describe("multi-field aggregation (task spec §62-64 full scenario)", () => {
  it("aggregates evidence and approvals across Legal Entity Name, Segment, and Business Unit changing together", () => {
    const result = evaluateWorkflowRules({
      currentValues: {
        legal_entity_name: "Old Name",
        segment: "mid_market",
        business_unit: "BU_A",
        country: "IN",
      },
      proposedValues: {
        legal_entity_name: "New Name",
        segment: "sme",
        business_unit: "BU_B",
      },
      rules: ALL_RULES,
    })

    expect(result.matchedRuleKeys.sort()).toEqual(
      [LEGAL_ENTITY_NAME_RULE.key, SEGMENT_CHANGE_RULE.key, BUSINESS_UNIT_CHANGE_RULE.key].sort()
    )

    expect(result.evidence.map((item) => item.evidenceType).sort()).toEqual([
      "gst_certificate",
      "pan_document",
      "tan_document",
    ])

    expect(result.approvals).toHaveLength(3)
    expect(result.approvals.some((approval) => approval.role === "FINANCE_HEAD")).toBe(true)
    const buApprovals = result.approvals.filter((approval) => approval.role === "BU_HEAD")
    expect(buApprovals).toHaveLength(2)
    expect(buApprovals.map((approval) => approval.scopeValue).sort()).toEqual(["BU_A", "BU_B"])
  })

  it("does not fire the address-driven GST rule when address itself did not change", () => {
    const result = evaluateWorkflowRules({
      currentValues: { legal_entity_name: "Old Name", address: "Same Address", country: "IN" },
      proposedValues: { legal_entity_name: "New Name" },
      rules: ALL_RULES,
    })
    expect(result.matchedRuleKeys).toEqual([LEGAL_ENTITY_NAME_RULE.key])
    // Only one gst_certificate entry, contributed by the name rule alone.
    const gst = result.evidence.filter((item) => item.evidenceType === "gst_certificate")
    expect(gst).toHaveLength(1)
    expect(gst[0]?.matchedRuleKeys).toEqual([LEGAL_ENTITY_NAME_RULE.key])
  })
})

describe("purity", () => {
  it("never mutates its inputs", () => {
    const currentValues = { segment: "mid_market" }
    const proposedValues = { segment: "sme" }
    const rulesCopy = JSON.parse(JSON.stringify(ALL_RULES))
    evaluateWorkflowRules({ currentValues, proposedValues, rules: ALL_RULES })
    expect(currentValues).toEqual({ segment: "mid_market" })
    expect(proposedValues).toEqual({ segment: "sme" })
    expect(ALL_RULES).toEqual(rulesCopy)
  })

  it("returns an equivalent result for the same input every time", () => {
    const input = {
      currentValues: { segment: "mid_market", business_unit: "BU_A" },
      proposedValues: { segment: "sme", business_unit: "BU_B" },
      rules: ALL_RULES,
    }
    const first = evaluateWorkflowRules(input)
    const second = evaluateWorkflowRules(input)
    expect(first).toEqual(second)
  })
})
