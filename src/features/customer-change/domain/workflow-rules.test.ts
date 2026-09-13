import { describe, expect, it } from "vitest"

import { evaluateCustomerChangeRequirements, toRequirementRpcRows } from "./workflow-rules"

describe("evaluateCustomerChangeRequirements", () => {
  it("requires Finance Head approval for a Segment change", () => {
    const requirements = evaluateCustomerChangeRequirements({ segment: "sme" }, { segment: "enterprise" })
    expect(requirements).toEqual([
      {
        kind: "approval",
        roleCode: "FINANCE_HEAD",
        scopeLabel: null,
        evidenceType: null,
        reason: "Segment change requires Finance Head approval.",
        matchedRuleKeys: ["segment_change_requires_finance_approval"],
      },
    ])
  })

  it("requires two DISTINCT BU_HEAD approvals for a Business Unit change: outgoing and incoming, never merged", () => {
    const requirements = evaluateCustomerChangeRequirements({ business_unit: "sme" }, { business_unit: "india_enterprise" })
    expect(requirements).toHaveLength(2)
    expect(requirements.every((requirement) => requirement.roleCode === "BU_HEAD")).toBe(true)
    expect(requirements.map((requirement) => requirement.scopeLabel).sort()).toEqual(["current business_unit", "proposed business_unit"])
  })

  it("requires company registration evidence for a Legal Entity Name change", () => {
    const requirements = evaluateCustomerChangeRequirements({ name: "Old Co Pvt Ltd" }, { name: "New Co Pvt Ltd" })
    expect(requirements).toEqual([
      {
        kind: "evidence",
        roleCode: null,
        scopeLabel: null,
        evidenceType: "company_registration",
        reason: "Legal Entity Name change requires updated registration evidence.",
        matchedRuleKeys: ["legal_name_change_requires_registration_evidence"],
      },
    ])
  })

  it("requires nothing when no governed field actually changed", () => {
    expect(evaluateCustomerChangeRequirements({ industry: "fmcg" }, { industry: "fmcg" })).toEqual([])
  })

  it("combines requirements across multiple simultaneously changed fields", () => {
    const requirements = evaluateCustomerChangeRequirements({ segment: "sme", business_unit: "sme" }, { segment: "enterprise", business_unit: "kam" })
    expect(requirements.filter((requirement) => requirement.roleCode === "FINANCE_HEAD")).toHaveLength(1)
    expect(requirements.filter((requirement) => requirement.roleCode === "BU_HEAD")).toHaveLength(2)
  })
})

describe("toRequirementRpcRows", () => {
  it("shapes each requirement into the submit_customer_change_request RPC's expected snake_case row", () => {
    const rows = toRequirementRpcRows([
      { kind: "approval", roleCode: "FINANCE_HEAD", scopeLabel: null, evidenceType: null, reason: "x", matchedRuleKeys: ["a"] },
    ])
    expect(rows).toEqual([{ kind: "approval", role_code: "FINANCE_HEAD", scope_label: null, evidence_type: null, reason: "x", matched_rule_keys: ["a"] }])
  })
})
