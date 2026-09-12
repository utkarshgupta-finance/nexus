import { describe, expect, it } from "vitest"

import { isValidIsoCurrencyCode } from "./currency-codes"

/**
 * Currency Settings' own Add flow (task correction §9: "Prefer selecting
 * or validating ISO-style codes rather than accepting random free-text
 * currency identities") validates against this real ISO 4217 catalogue,
 * derived from the same `countries-list` dependency already used for the
 * Country catalogue, never a hand-maintained duplicate.
 */
describe("isValidIsoCurrencyCode", () => {
  it("recognizes real ISO 4217 codes already active in Nexus (USD, GBP)", () => {
    expect(isValidIsoCurrencyCode("USD")).toBe(true)
    expect(isValidIsoCurrencyCode("GBP")).toBe(true)
  })

  it("recognizes a real ISO 4217 code not yet added to Nexus (JPY)", () => {
    expect(isValidIsoCurrencyCode("JPY")).toBe(true)
  })

  it("rejects a code that is not a recognized ISO 4217 currency", () => {
    expect(isValidIsoCurrencyCode("ZZZ")).toBe(false)
  })

  it("is case-insensitive, since a Settings user may type either case", () => {
    expect(isValidIsoCurrencyCode("usd")).toBe(true)
    expect(isValidIsoCurrencyCode("JpY")).toBe(true)
  })

  it("rejects blank or malformed input rather than guessing", () => {
    expect(isValidIsoCurrencyCode("")).toBe(false)
    expect(isValidIsoCurrencyCode("US")).toBe(false)
    expect(isValidIsoCurrencyCode("DOLLARS")).toBe(false)
  })
})
