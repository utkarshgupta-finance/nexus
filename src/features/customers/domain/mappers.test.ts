import { describe, expect, it } from "vitest"

import { toCustomerMasterRecord } from "./mappers"
import type { CustomerRow } from "../data/row-types"

const FAKE_ROW: CustomerRow = {
  id: "11111111-1111-4111-8111-111111111111",
  key: "demo-northstar-consumer-products",
  name: "Northstar Consumer Products Pvt Ltd",
  is_active: true,
  row_version: 1,
  created_at: "2026-09-01T00:00:00.000Z",
  created_by: null,
  updated_at: "2026-09-01T00:00:00.000Z",
  updated_by: null,
}

describe("toCustomerMasterRecord", () => {
  it("maps every backend column to the domain shape", () => {
    expect(toCustomerMasterRecord(FAKE_ROW)).toEqual({
      id: FAKE_ROW.id,
      key: FAKE_ROW.key,
      name: FAKE_ROW.name,
      isActive: true,
      rowVersion: 1,
      createdAt: FAKE_ROW.created_at,
      createdBy: null,
      updatedAt: FAKE_ROW.updated_at,
      updatedBy: null,
    })
  })

  it("never invents a field the real backend table does not have", () => {
    const record = toCustomerMasterRecord(FAKE_ROW)
    expect(Object.keys(record).sort()).toEqual(
      ["id", "key", "name", "isActive", "rowVersion", "createdAt", "createdBy", "updatedAt", "updatedBy"].sort()
    )
  })
})
