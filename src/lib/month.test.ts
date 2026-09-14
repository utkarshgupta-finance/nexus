import { describe, expect, it } from "vitest"

import { toMonthKey, monthKeyToBusinessDate, addMonths, monthsBetweenInclusive, monthRange, compareMonthKeys, formatMonthKey } from "./month"

describe("toMonthKey / monthKeyToBusinessDate", () => {
  it("extracts YYYY-MM from any business date in that month", () => {
    expect(toMonthKey("2026-07-15")).toBe("2026-07")
    expect(toMonthKey("2026-07-01")).toBe("2026-07")
  })

  it("round-trips to the canonical first-of-month business date", () => {
    expect(monthKeyToBusinessDate("2026-07")).toBe("2026-07-01")
  })
})

describe("addMonths", () => {
  it("adds within the same year", () => {
    expect(addMonths("2026-07", 1)).toBe("2026-08")
  })

  it("rolls over into the next year", () => {
    expect(addMonths("2026-12", 1)).toBe("2027-01")
  })

  it("rolls backward across a year boundary with a negative delta", () => {
    expect(addMonths("2027-01", -1)).toBe("2026-12")
  })

  it("zero delta returns the same month", () => {
    expect(addMonths("2026-07", 0)).toBe("2026-07")
  })
})

describe("monthsBetweenInclusive", () => {
  it("is 1 for the same month", () => {
    expect(monthsBetweenInclusive("2026-07", "2026-07")).toBe(1)
  })

  it("is 12 for a Jul-Jun span (the product brief's own worked example)", () => {
    expect(monthsBetweenInclusive("2026-07", "2027-06")).toBe(12)
  })
})

describe("monthRange", () => {
  it("produces every month key in order, inclusive of both ends", () => {
    expect(monthRange("2026-11", "2027-02")).toEqual(["2026-11", "2026-12", "2027-01", "2027-02"])
  })

  it("a single-month range returns exactly one entry", () => {
    expect(monthRange("2026-07", "2026-07")).toEqual(["2026-07"])
  })
})

describe("compareMonthKeys", () => {
  it("orders lexically, matching calendar order", () => {
    expect(compareMonthKeys("2026-07", "2026-08")).toBe(-1)
    expect(compareMonthKeys("2026-08", "2026-07")).toBe(1)
    expect(compareMonthKeys("2026-07", "2026-07")).toBe(0)
    expect(compareMonthKeys("2026-12", "2027-01")).toBe(-1)
  })
})

describe("formatMonthKey", () => {
  it("renders a short month name and year", () => {
    expect(formatMonthKey("2026-07")).toBe("Jul 2026")
    expect(formatMonthKey("2027-01")).toBe("Jan 2027")
  })
})
