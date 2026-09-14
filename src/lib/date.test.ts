import { describe, expect, it } from "vitest"

import {
  businessDateStartOfDayUtc,
  compareBusinessDates,
  compareTimestamps,
  formatBusinessDate,
  getBusinessDateYear,
} from "./date"

describe("business date handling (Platform Scale Closure, Phase H)", () => {
  it("reads the calendar year directly from the string, never through a timezone-sensitive Date parse", () => {
    expect(getBusinessDateYear("2026-01-01")).toBe(2026)
    expect(getBusinessDateYear("2026-12-31")).toBe(2026)
  })

  it("never shifts a year-boundary date regardless of the runtime's local timezone", () => {
    // The historical bug was `new Date("2026-01-01").getFullYear()`, which in a
    // negative-UTC-offset runtime reads back 2025 because the string is parsed
    // as UTC midnight and .getFullYear() reads local time. This must return
    // 2026 unconditionally, independent of process.env.TZ.
    const originalTz = process.env.TZ
    try {
      process.env.TZ = "America/New_York"
      expect(getBusinessDateYear("2026-01-01")).toBe(2026)
      process.env.TZ = "Pacific/Kiritimati"
      expect(getBusinessDateYear("2026-12-31")).toBe(2026)
    } finally {
      process.env.TZ = originalTz
    }
  })

  it("rejects a non-business-date string rather than silently coercing it", () => {
    expect(() => getBusinessDateYear("2026-01-01T00:00:00.000Z")).toThrow()
    expect(() => getBusinessDateYear("not-a-date")).toThrow()
  })

  it("compares business dates lexically without going through Date", () => {
    expect(compareBusinessDates("2026-01-01", "2026-12-31")).toBeLessThan(0)
    expect(compareBusinessDates("2026-12-31", "2026-01-01")).toBeGreaterThan(0)
    expect(compareBusinessDates("2026-06-15", "2026-06-15")).toBe(0)
  })

  it("formats a business date as DD-Mon-YYYY without shifting the day", () => {
    expect(formatBusinessDate("2026-01-01")).toBe("01-Jan-2026")
    expect(formatBusinessDate("2026-12-31")).toBe("31-Dec-2026")
  })

  it("converts a business date to a UTC start-of-day instant for mixed-timeline comparison only", () => {
    expect(businessDateStartOfDayUtc("2026-01-01")).toBe("2026-01-01T00:00:00.000Z")
  })
})

describe("timestamp comparison", () => {
  it("compares timestamps as real instants, not lexically", () => {
    expect(compareTimestamps("2026-01-01T23:59:59.000Z", "2026-01-02T00:00:00.000Z")).toBeLessThan(0)
    expect(compareTimestamps("2026-01-02T00:00:00.000Z", "2026-01-01T23:59:59.000Z")).toBeGreaterThan(0)
  })
})
