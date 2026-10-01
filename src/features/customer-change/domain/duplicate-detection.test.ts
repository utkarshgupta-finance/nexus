import { describe, expect, it } from "vitest"

import { findChangeRequestGstPanDuplicates } from "./duplicate-detection"
import type { ExistingCustomerTaxIdentity } from "./duplicate-detection"

const OTHER_CUSTOMER: ExistingCustomerTaxIdentity = {
  customerId: "cust-x",
  customerKey: "customer-x-co",
  customerName: "Customer X Co",
  gstNumber: "27ABCDE1234F1Z5",
  pan: "ABCDE1234F",
}

const SELF_CUSTOMER: ExistingCustomerTaxIdentity = {
  customerId: "cust-y",
  customerKey: "customer-y-co",
  customerName: "Customer Y Co",
  gstNumber: "29XYZAB5678C1Z9",
  pan: "XYZAB5678C",
}

describe("findChangeRequestGstPanDuplicates", () => {
  it("matches an exact GST number against a different customer, case-insensitively", () => {
    const matches = findChangeRequestGstPanDuplicates({ gstNumber: "27abcde1234f1z5", pan: null }, [OTHER_CUSTOMER, SELF_CUSTOMER], SELF_CUSTOMER.customerId)
    expect(matches).toHaveLength(1)
    expect(matches[0].fieldKey).toBe("gst_number")
    expect(matches[0].customerId).toBe("cust-x")
  })

  it("matches an exact PAN against a different customer", () => {
    const matches = findChangeRequestGstPanDuplicates({ gstNumber: null, pan: "ABCDE1234F" }, [OTHER_CUSTOMER, SELF_CUSTOMER], SELF_CUSTOMER.customerId)
    expect(matches).toHaveLength(1)
    expect(matches[0].fieldKey).toBe("pan")
    expect(matches[0].customerId).toBe("cust-x")
  })

  it("never flags the Change Request's own customer's current value as a duplicate of itself", () => {
    const matches = findChangeRequestGstPanDuplicates(
      { gstNumber: SELF_CUSTOMER.gstNumber, pan: SELF_CUSTOMER.pan },
      [OTHER_CUSTOMER, SELF_CUSTOMER],
      SELF_CUSTOMER.customerId
    )
    expect(matches).toEqual([])
  })

  it("never matches two unset values against each other", () => {
    const matches = findChangeRequestGstPanDuplicates({ gstNumber: null, pan: null }, [OTHER_CUSTOMER, SELF_CUSTOMER], SELF_CUSTOMER.customerId)
    expect(matches).toEqual([])
  })

  it("returns no matches for a genuinely different GST/PAN", () => {
    const matches = findChangeRequestGstPanDuplicates(
      { gstNumber: "09NEWNEW1234N1Z1", pan: "NEWNE1234N" },
      [OTHER_CUSTOMER, SELF_CUSTOMER],
      SELF_CUSTOMER.customerId
    )
    expect(matches).toEqual([])
  })

  it("can return matches for both GST and PAN at once", () => {
    const matches = findChangeRequestGstPanDuplicates(
      { gstNumber: OTHER_CUSTOMER.gstNumber, pan: OTHER_CUSTOMER.pan },
      [OTHER_CUSTOMER, SELF_CUSTOMER],
      SELF_CUSTOMER.customerId
    )
    expect(matches).toHaveLength(2)
  })
})
