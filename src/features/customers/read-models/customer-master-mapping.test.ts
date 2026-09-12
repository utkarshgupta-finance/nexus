import { describe, expect, it } from "vitest"

import { resolveOption } from "@/features/reference-data"
import { DEMO_CUSTOMER_KEY } from "../domain/demo-enrichment"
import { DEMO_DOCUMENTS } from "../domain/demo-documents"
import type { CustomerRow } from "../data/row-types"
import { toCustomerMasterDetail, toCustomerMasterListEntry } from "./customer-master-mapping"
import { REFERENCE_MASTER_FIXTURES } from "@/features/reference-data/domain/fixtures"

const DEMO_ROW: CustomerRow = {
  id: "11111111-1111-4111-8111-111111111111",
  key: DEMO_CUSTOMER_KEY,
  name: "Northstar Consumer Products Pvt Ltd",
  is_active: true,
  row_version: 1,
  created_at: "2026-09-01T00:00:00.000Z",
  created_by: null,
  updated_at: "2026-09-01T00:00:00.000Z",
  updated_by: null,
}

const OTHER_ROW: CustomerRow = {
  id: "22222222-2222-4222-8222-222222222222",
  key: "some-other-customer",
  name: "Some Other Customer Pvt Ltd",
  is_active: true,
  row_version: 1,
  created_at: "2026-09-02T00:00:00.000Z",
  created_by: null,
  updated_at: "2026-09-02T00:00:00.000Z",
  updated_by: null,
}

describe("customer master read model composition", () => {
  it("attaches demo enrichment only to the fixed demo customer key", () => {
    const entry = toCustomerMasterListEntry(DEMO_ROW)
    expect(entry.record.name).toBe("Northstar Consumer Products Pvt Ltd")
    expect(entry.enrichment?.source).toBe("demo")
  })

  it("handles a real customer row with no demo enrichment safely, not as an error", () => {
    const entry = toCustomerMasterListEntry(OTHER_ROW)
    expect(entry.record.name).toBe("Some Other Customer Pvt Ltd")
    expect(entry.enrichment).toBeNull()
  })

  it("attaches all seven demo documents only to the demo customer's detail", () => {
    const demoDetail = toCustomerMasterDetail(DEMO_ROW)
    expect(demoDetail.documents).toHaveLength(7)
    expect(demoDetail.documents).toEqual(DEMO_DOCUMENTS)

    const otherDetail = toCustomerMasterDetail(OTHER_ROW)
    expect(otherDetail.documents).toEqual([])
  })

  it("demo state is distinguishable from real state via enrichment being present or null, never a guess", () => {
    expect(toCustomerMasterDetail(DEMO_ROW).enrichment).not.toBeNull()
    expect(toCustomerMasterDetail(OTHER_ROW).enrichment).toBeNull()
  })

  it("resolves every demo enrichment Reference Master code to a real display label", () => {
    const detail = toCustomerMasterDetail(DEMO_ROW)
    const enrichment = detail.enrichment
    if (!enrichment) throw new Error("expected demo enrichment")
    expect(resolveOption(REFERENCE_MASTER_FIXTURES, "country", enrichment.countryCode)?.label).toBe("India")
    expect(resolveOption(REFERENCE_MASTER_FIXTURES, "industry", enrichment.industryValue)?.label).toBe("FMCG")
    expect(resolveOption(REFERENCE_MASTER_FIXTURES, "segment", enrichment.segmentValue)?.label).toBe("Enterprise")
    expect(resolveOption(REFERENCE_MASTER_FIXTURES, "business_unit", enrichment.businessUnitValue)?.label).toBe("India Enterprise")
    expect(resolveOption(REFERENCE_MASTER_FIXTURES, "currency", enrichment.billingCurrencyCode)?.label).toBe("INR - Indian Rupee")
  })
})
