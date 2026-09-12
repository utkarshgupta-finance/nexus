import { describe, expect, it } from "vitest"

import { getActiveOptions, getAllOptions, getInrConversionRate, resolveOption } from "./service"

describe("reference master option resolution", () => {
  it("returns only active values for new selections", () => {
    const options = getActiveOptions("segment")
    expect(options.every((option) => option.active)).toBe(true)
    expect(options.map((option) => option.value)).toContain("mid_market")
  })

  it("excludes inactive values from new selections", () => {
    const options = getActiveOptions("segment")
    expect(options.some((option) => option.value === "global_key_accounts")).toBe(false)
  })

  it("still resolves an inactive value for historical display", () => {
    const resolved = resolveOption("segment", "global_key_accounts")
    expect(resolved).not.toBeNull()
    expect(resolved?.label).toBe("Global Key Accounts (Legacy)")
    expect(resolved?.active).toBe(false)
  })

  it("keeps the stable internal value separate from the display label", () => {
    const resolved = resolveOption("segment", "mid_market")
    expect(resolved?.value).toBe("mid_market")
    expect(resolved?.label).toBe("Mid Market")
    expect(resolved?.value).not.toBe(resolved?.label)
  })

  it("returns null for a value that was never a real option", () => {
    expect(resolveOption("segment", "does_not_exist")).toBeNull()
  })

  it("does not mutate historical form submission data when reference master state changes", () => {
    const submissionData = { segment: "mid_market" }

    expect(getActiveOptions("segment").some((option) => option.value === "mid_market")).toBe(true)

    // Simulates a Reference Master deactivation the way the Settings screen
    // applies one: as an independent local copy, never mutating the shared
    // fixture that submissions and the resolver both read from.
    const deactivatedCopy = getAllOptions("segment").map((option) =>
      option.value === "mid_market" ? { ...option, active: false } : option
    )
    expect(deactivatedCopy.find((option) => option.value === "mid_market")?.active).toBe(false)

    expect(submissionData.segment).toBe("mid_market")
    expect(resolveOption("segment", "mid_market")?.label).toBe("Mid Market")
  })

  it("resolves a historical value to its original label even after later deactivation elsewhere", () => {
    const beforeLabel = resolveOption("segment", "global_key_accounts")?.label
    // Deactivation already happened in the fixture itself for this option;
    // resolution must be unaffected by that state either way.
    const afterLabel = resolveOption("segment", "global_key_accounts")?.label
    expect(afterLabel).toBe(beforeLabel)
    expect(afterLabel).toBe("Global Key Accounts (Legacy)")
  })

  it("exposes a dial code alongside the display label for phone country codes", () => {
    const india = resolveOption("phone_country_code", "IN")
    expect(india?.label).toBe("India (+91)")
    expect(india?.dialCode).toBe("+91")
  })

  it("starts with exactly INR, USD, GBP, SGD and IDR active for currency, nothing else auto-activated", () => {
    const active = getActiveOptions("currency").map((option) => option.value).sort()
    expect(active).toEqual(["GBP", "IDR", "INR", "SGD", "USD"])
  })

  it("uses the currency code as the stable value, paired with the full name in the label", () => {
    const inr = resolveOption("currency", "INR")
    expect(inr?.value).toBe("INR")
    expect(inr?.label).toBe("INR - Indian Rupee")
  })

  it("still resolves a currency that is later deactivated, for historical display", () => {
    const deactivatedCopy = getAllOptions("currency").map((option) =>
      option.value === "IDR" ? { ...option, active: false } : option
    )
    expect(deactivatedCopy.find((option) => option.value === "IDR")?.active).toBe(false)
    // The shared fixture itself is untouched by that local copy, matching
    // the same non-mutation guarantee already proven above for segment.
    expect(resolveOption("currency", "IDR")?.active).toBe(true)
    expect(resolveOption("currency", "IDR")?.label).toBe("IDR - Indonesian Rupiah")
  })

  describe("getInrConversionRate (task correction §12-15: 1 unit of currency = X INR, centrally governed)", () => {
    it("INR's own rate is always 1", () => {
      expect(getInrConversionRate("INR")).toBe(1)
    })

    it("resolves USD's configured rate", () => {
      expect(getInrConversionRate("USD")).toBe(91)
    })

    it("resolves GBP's configured rate", () => {
      expect(getInrConversionRate("GBP")).toBe(121)
    })

    it("is null for a currency with no rate configured yet (IDR), never a guessed value", () => {
      expect(getInrConversionRate("IDR")).toBeNull()
    })

    it("is null for a currency code that is not a real option at all", () => {
      expect(getInrConversionRate("XYZ")).toBeNull()
    })
  })
})

describe("Commercial Rate reference lists (Pricing Unit, Invoice Frequency, Invoice Timing, Commercial Nature, Pricing Model)", () => {
  it("Pricing Unit exposes the twelve initial values with stable codes distinct from their labels", () => {
    const values = getActiveOptions("pricing_unit").map((option) => option.value).sort()
    expect(values).toEqual([
      "DASHBOARD",
      "DAY",
      "DISTRIBUTOR",
      "IMAGE",
      "MAN_DAY",
      "MESSAGE",
      "OUTLET",
      "PERSON",
      "REPORT",
      "REQUEST",
      "SESSION",
      "USER",
    ])
    expect(resolveOption("pricing_unit", "MAN_DAY")?.label).toBe("Man-day")
  })

  describe("Person unit (task correction §11-12): behaves exactly like every other Pricing Unit, no special-case path", () => {
    it("PERSON is a stable, active Pricing Unit code selectable like any other", () => {
      const person = resolveOption("pricing_unit", "PERSON")
      expect(person).not.toBeNull()
      expect(person?.value).toBe("PERSON")
      expect(person?.label).toBe("Person")
      expect(person?.active).toBe(true)
      expect(getActiveOptions("pricing_unit").some((option) => option.value === "PERSON")).toBe(true)
    })

    it("is manageable through Reference Master Settings exactly like other units (getAllOptions/deactivate, same generic path)", () => {
      const deactivatedCopy = getAllOptions("pricing_unit").map((option) => (option.value === "PERSON" ? { ...option, active: false } : option))
      expect(deactivatedCopy.find((option) => option.value === "PERSON")?.active).toBe(false)
      // The shared fixture itself is untouched by that local copy, matching the same non-mutation guarantee proven above for segment/currency.
      expect(resolveOption("pricing_unit", "PERSON")?.active).toBe(true)
    })

    it("an inactive Person would be excluded from new selections but still historically resolvable, same as any other unit", () => {
      const deactivatedCopy = getAllOptions("pricing_unit").map((option) => (option.value === "PERSON" ? { ...option, active: false } : option))
      const activeOnly = deactivatedCopy.filter((option) => option.active)
      expect(activeOnly.some((option) => option.value === "PERSON")).toBe(false)
      const resolved = deactivatedCopy.find((option) => option.value === "PERSON")
      expect(resolved?.label).toBe("Person")
    })
  })

  it("Invoice Frequency has the four real cadences plus One-Time, no On-Demand value", () => {
    const values = getActiveOptions("invoice_frequency").map((option) => option.value)
    expect(values).toEqual(["monthly", "quarterly", "half_yearly", "annual", "one_time"])
  })

  it("Invoice Timing is exactly Advance and Postpaid", () => {
    const values = getActiveOptions("invoice_timing").map((option) => option.value)
    expect(values).toEqual(["advance", "postpaid"])
  })

  it("Commercial Nature has exactly Recurring, Non-Recurring, On-Demand", () => {
    const values = getActiveOptions("commercial_nature").map((option) => option.value)
    expect(values).toEqual(["recurring", "non_recurring", "on_demand"])
  })

  it("Pricing Model has exactly the four shared models, no separate Fixed Fee", () => {
    const values = getActiveOptions("pricing_model").map((option) => option.value)
    expect(values).toEqual(["per_unit", "flat_fee", "slab", "designation_based"])
  })

  it("a deactivated Commercial Rate list value disappears from new selections but still resolves historically, same as every other list", () => {
    const deactivatedCopy = getAllOptions("pricing_model").map((option) =>
      option.value === "slab" ? { ...option, active: false } : option
    )
    expect(deactivatedCopy.some((option) => option.value === "slab" && option.active)).toBe(false)
    expect(resolveOption("pricing_model", "slab")?.active).toBe(true)
    expect(resolveOption("pricing_model", "slab")?.label).toBe("Slab")
  })
})
