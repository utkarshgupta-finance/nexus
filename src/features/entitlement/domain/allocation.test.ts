import { describe, expect, it } from "vitest"

import { allocateEvenly } from "./allocation"

describe("allocateEvenly", () => {
  it("6,000 annual users over 12 months starting July divides to 500/month, Jul-Jun", () => {
    const result = allocateEvenly(6000, "2026-07", 12)
    expect(result).toHaveLength(12)
    expect(result[0]).toEqual({ month: "2026-07", quantity: 500 })
    expect(result[11]).toEqual({ month: "2027-06", quantity: 500 })
    expect(result.reduce((sum, entry) => sum + entry.quantity, 0)).toBe(6000)
  })

  it("places the remainder of an uneven division entirely in the final month, never dropping a unit", () => {
    const result = allocateEvenly(1000, "2026-01", 3)
    // 1000 / 3 = 333.33...; base months get 333.33, the last absorbs the remainder.
    expect(result[0].quantity).toBe(333.33)
    expect(result[1].quantity).toBe(333.33)
    expect(result[2].quantity).toBe(333.34)
    expect(result.reduce((sum, entry) => sum + entry.quantity, 0)).toBeCloseTo(1000, 2)
  })

  it("a single-month allocation gets the entire quantity", () => {
    expect(allocateEvenly(500, "2026-07", 1)).toEqual([{ month: "2026-07", quantity: 500 }])
  })

  it("returns an empty schedule for a non-positive month count, never a divide-by-zero", () => {
    expect(allocateEvenly(500, "2026-07", 0)).toEqual([])
  })

  it("months are contiguous and in order regardless of the starting month", () => {
    const result = allocateEvenly(400, "2026-11", 4)
    expect(result.map((entry) => entry.month)).toEqual(["2026-11", "2026-12", "2027-01", "2027-02"])
  })
})
