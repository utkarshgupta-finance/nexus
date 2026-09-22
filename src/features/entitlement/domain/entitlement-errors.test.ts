import { describe, expect, it } from "vitest"

import { parseEntitlementError, EntitlementOperationError } from "./entitlement-errors"

describe("parseEntitlementError", () => {
  it("maps USAGE_BEFORE_GO_LIVE to its own kind with the RPC's safe message", () => {
    const parsed = parseEntitlementError({
      message: "USAGE_BEFORE_GO_LIVE: usage month 2026-08-01 is before this line item's Go Live month 2026-09-22",
      code: "P0001",
    })

    expect(parsed.kind).toBe("usage_before_go_live")
    expect(parsed.message).toBe("usage month 2026-08-01 is before this line item's Go Live month 2026-09-22")
  })

  it("maps MONTHLY_USAGE_ALREADY_FINALIZED to its own kind (Batch 17 I-012 finalize-bypass fix)", () => {
    const parsed = parseEntitlementError({
      message: "MONTHLY_USAGE_ALREADY_FINALIZED: usage for 2026-09-01 has already been finalized and cannot be resubmitted",
      code: "P0001",
    })

    expect(parsed.kind).toBe("monthly_usage_already_finalized")
    expect(parsed.message).toBe("usage for 2026-09-01 has already been finalized and cannot be resubmitted")
  })

  it("maps SETTLEMENT_EXCEEDS_OUTSTANDING to its own kind (Batch 17 I-022 over-settlement fix)", () => {
    const parsed = parseEntitlementError({
      message: "SETTLEMENT_EXCEEDS_OUTSTANDING: settling 60 would exceed the 50 still outstanding on this entry (already settled 50)",
      code: "P0001",
    })

    expect(parsed.kind).toBe("settlement_exceeds_outstanding")
    expect(parsed.message).toBe("settling 60 would exceed the 50 still outstanding on this entry (already settled 50)")
  })

  it("wraps into an EntitlementOperationError whose .message is the safe text a UI can show directly", () => {
    const error = new EntitlementOperationError(
      parseEntitlementError({ message: "SETTLEMENT_EXCEEDS_OUTSTANDING: settling 60 would exceed the 50 still outstanding on this entry (already settled 50)" })
    )

    expect(error.message).toBe("settling 60 would exceed the 50 still outstanding on this entry (already settled 50)")
    expect(error.entitlementError.kind).toBe("settlement_exceeds_outstanding")
  })

  it("maps SETTLEMENT_REVERSAL_EXCEEDS_SETTLED to its own kind (Product Decision Closure, I-024 settlement reversal)", () => {
    const parsed = parseEntitlementError({
      message: "SETTLEMENT_REVERSAL_EXCEEDS_SETTLED: reversing 60 would exceed the 50 still reversible on this settlement (already reversed 0)",
      code: "P0001",
    })

    expect(parsed.kind).toBe("settlement_reversal_exceeds_settled")
    expect(parsed.message).toBe("reversing 60 would exceed the 50 still reversible on this settlement (already reversed 0)")
  })

  it("still falls back to unknown for a genuinely unrecognized token", () => {
    const parsed = parseEntitlementError({ message: "SOME_FUTURE_TOKEN_NOT_YET_MAPPED: detail" })
    expect(parsed.kind).toBe("unknown")
  })
})
