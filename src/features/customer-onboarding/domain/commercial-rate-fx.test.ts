import { describe, expect, it } from "vitest"

import { currentFxSnapshot, inrConversionRateFor, isForeignCurrency, isFxRateMissing, toInr } from "./commercial-rate-fx"
import { REFERENCE_MASTER_FIXTURES } from "@/features/reference-data/domain/fixtures"

/**
 * FX support (task correction §12-16): the rate is always Reference
 * Master's own governed value, never invented here and never editable
 * from Commercial Rate. The fixture (`src/features/reference-data/domain/fixtures.ts`)
 * defines USD = 91, GBP = 121, SGD = 68, INR = 1, and IDR left
 * unconfigured (`null`) on purpose, so the missing-rate path has a real
 * example to exercise.
 */

describe("inrConversionRateFor", () => {
  it("INR is always exactly 1, never a Settings lookup", () => {
    expect(inrConversionRateFor(REFERENCE_MASTER_FIXTURES, "INR")).toBe(1)
  })

  it("resolves USD's governed rate from Reference Master", () => {
    expect(inrConversionRateFor(REFERENCE_MASTER_FIXTURES, "USD")).toBe(91)
  })

  it("resolves GBP's governed rate from Reference Master", () => {
    expect(inrConversionRateFor(REFERENCE_MASTER_FIXTURES, "GBP")).toBe(121)
  })

  it("is null for a currency with no configured rate (IDR), never a guess", () => {
    expect(inrConversionRateFor(REFERENCE_MASTER_FIXTURES, "IDR")).toBeNull()
  })

  it("is null when no currency is chosen yet", () => {
    expect(inrConversionRateFor(REFERENCE_MASTER_FIXTURES, null)).toBeNull()
  })
})

describe("isForeignCurrency", () => {
  it("is false for INR and for no currency chosen yet", () => {
    expect(isForeignCurrency("INR")).toBe(false)
    expect(isForeignCurrency(null)).toBe(false)
  })

  it("is true for any non-INR currency", () => {
    expect(isForeignCurrency("USD")).toBe(true)
  })
})

describe("isFxRateMissing (task correction §15)", () => {
  it("is false for INR: nothing to configure", () => {
    expect(isFxRateMissing(REFERENCE_MASTER_FIXTURES, "INR")).toBe(false)
  })

  it("is false for a foreign currency with a configured rate", () => {
    expect(isFxRateMissing(REFERENCE_MASTER_FIXTURES, "USD")).toBe(false)
  })

  it("is true for a foreign currency with no configured rate", () => {
    expect(isFxRateMissing(REFERENCE_MASTER_FIXTURES, "IDR")).toBe(true)
  })

  it("is false when no currency is chosen yet (nothing to validate yet)", () => {
    expect(isFxRateMissing(REFERENCE_MASTER_FIXTURES, null)).toBe(false)
  })
})

describe("toInr (FX calculations, task correction §17, §19-20)", () => {
  it("Per Unit / Flat Fee style amount conversion: USD 100 at rate 91 = INR 9,100", () => {
    expect(toInr(REFERENCE_MASTER_FIXTURES, 100, "USD")).toBe(9100)
  })

  it("Slab rate conversion: USD 10 at rate 91 = INR 910", () => {
    expect(toInr(REFERENCE_MASTER_FIXTURES, 10, "USD")).toBe(910)
  })

  it("Designation rate conversion: USD 15 at rate 121 (GBP) style, using GBP's own rate = INR 1,815", () => {
    expect(toInr(REFERENCE_MASTER_FIXTURES, 15, "GBP")).toBe(1815)
  })

  it("MUG monetary conversion: USD 50,000 at rate 91 = INR 45,50,000", () => {
    expect(toInr(REFERENCE_MASTER_FIXTURES, 50000, "USD")).toBe(4550000)
  })

  it("Non-Recurring milestone-basis amount conversion: USD 10,000 at rate 91 = INR 9,10,000", () => {
    expect(toInr(REFERENCE_MASTER_FIXTURES, 10000, "USD")).toBe(910000)
  })

  it("INR itself converts to itself (rate 1)", () => {
    expect(toInr(REFERENCE_MASTER_FIXTURES, 200000, "INR")).toBe(200000)
  })

  it("is null when the amount is null", () => {
    expect(toInr(REFERENCE_MASTER_FIXTURES, null, "USD")).toBeNull()
  })

  it("is null when the currency has no configured rate, never a fabricated conversion", () => {
    expect(toInr(REFERENCE_MASTER_FIXTURES, 100, "IDR")).toBeNull()
  })
})

describe("currentFxSnapshot (task correction §16: the historical FX snapshot contract)", () => {
  it("captures the currency code and its currently governed rate", () => {
    expect(currentFxSnapshot(REFERENCE_MASTER_FIXTURES, "USD")).toEqual({ currencyCode: "USD", inrConversionRate: 91 })
  })

  it("captures INR's own fixed rate of 1", () => {
    expect(currentFxSnapshot(REFERENCE_MASTER_FIXTURES, "INR")).toEqual({ currencyCode: "INR", inrConversionRate: 1 })
  })

  it("is null when no currency is chosen yet", () => {
    expect(currentFxSnapshot(REFERENCE_MASTER_FIXTURES, null)).toBeNull()
  })

  it("is null when the currency has no configured rate: a snapshot cannot capture a rate that does not exist", () => {
    expect(currentFxSnapshot(REFERENCE_MASTER_FIXTURES, "IDR")).toBeNull()
  })
})
