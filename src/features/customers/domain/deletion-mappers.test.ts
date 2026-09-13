import { describe, expect, it } from "vitest"

import { toDeletionEligibility, toCustomerDeletionAudit } from "./deletion-mappers"
import type { CustomerDeletionAuditRow } from "../data/deletion-row-types"

describe("toDeletionEligibility", () => {
  it("is eligible with no blockers when both counts are zero", () => {
    expect(toDeletionEligibility("cust-1", 0, 0)).toEqual({ customerId: "cust-1", eligible: true, blockers: [] })
  })

  it("blocks on any Commercial Configuration, real or empty", () => {
    const result = toDeletionEligibility("cust-1", 1, 0)
    expect(result.eligible).toBe(false)
    expect(result.blockers).toHaveLength(1)
    expect(result.blockers[0].kind).toBe("commercial_configuration")
  })

  it("blocks on any approved Change Request", () => {
    const result = toDeletionEligibility("cust-1", 0, 2)
    expect(result.eligible).toBe(false)
    expect(result.blockers).toEqual([
      { kind: "approved_change_request", count: 2, reason: expect.stringContaining("2 approved Customer Change Request") },
    ])
  })

  it("reports both blockers when both are present", () => {
    const result = toDeletionEligibility("cust-1", 1, 1)
    expect(result.eligible).toBe(false)
    expect(result.blockers).toHaveLength(2)
  })
})

describe("toCustomerDeletionAudit", () => {
  it("maps every backend column to the domain shape", () => {
    const row: CustomerDeletionAuditRow = {
      id: "audit-1",
      customer_id: "cust-1",
      customer_key: "garbage-co",
      customer_name: "Garbage Co Pvt Ltd",
      segment: null,
      business_unit: null,
      country: null,
      industry: null,
      brand_name: null,
      was_active: true,
      reason: "no real commercial history",
      deleted_by: "user-a",
      deleted_at: "2026-09-13T00:00:00.000Z",
    }
    expect(toCustomerDeletionAudit(row)).toEqual({
      id: "audit-1",
      customerId: "cust-1",
      customerKey: "garbage-co",
      customerName: "Garbage Co Pvt Ltd",
      segment: null,
      businessUnit: null,
      country: null,
      industry: null,
      brandName: null,
      wasActive: true,
      reason: "no real commercial history",
      deletedBy: "user-a",
      deletedAt: "2026-09-13T00:00:00.000Z",
    })
  })
})
