import { describe, expect, it } from "vitest"

import { COUNTRY_CATALOGUE, toCountryOptions, toPhoneCountryCodeOptions } from "./countries"
import { getActiveOptions, resolveOption } from "./service"

function findCountry(name: string) {
  return COUNTRY_CATALOGUE.find((country) => country.name === name)
}

describe("canonical country catalogue", () => {
  it("is materially complete", () => {
    // Not locking an exact count: the external dataset does not guarantee
    // one. 190+ rules out an accidentally truncated list without pinning
    // to countries-list's current total.
    expect(COUNTRY_CATALOGUE.length).toBeGreaterThan(190)
  })

  it("gives every country a stable, unique identity", () => {
    const codes = COUNTRY_CATALOGUE.map((country) => country.code)
    expect(new Set(codes).size).toBe(codes.length)
    expect(codes.every((code) => code.length > 0)).toBe(true)
  })

  it("includes India with the correct calling code", () => {
    expect(findCountry("India")?.code).toBe("IN")
    expect(findCountry("India")?.callingCode).toBe("+91")
  })

  it("includes Singapore with the correct calling code", () => {
    expect(findCountry("Singapore")?.code).toBe("SG")
    expect(findCountry("Singapore")?.callingCode).toBe("+65")
  })

  it("includes United Kingdom with the correct calling code", () => {
    expect(findCountry("United Kingdom")?.code).toBe("GB")
    expect(findCountry("United Kingdom")?.callingCode).toBe("+44")
  })

  it("includes United States", () => {
    expect(findCountry("United States")?.code).toBe("US")
  })

  it("includes United Arab Emirates", () => {
    expect(findCountry("United Arab Emirates")?.code).toBe("AE")
  })

  it("keeps countries that share a calling code as separate identities", () => {
    const unitedStates = findCountry("United States")
    const canada = findCountry("Canada")
    expect(unitedStates?.callingCode).toBe("+1")
    expect(canada?.callingCode).toBe("+1")
    expect(unitedStates?.code).not.toBe(canada?.code)
  })
})

describe("country reference master options", () => {
  it("exposes every catalogue country as active by default", () => {
    const options = toCountryOptions()
    expect(options.length).toBe(COUNTRY_CATALOGUE.length)
    expect(options.every((option) => option.active)).toBe(true)
  })

  it("appears in active selection mode", () => {
    const active = getActiveOptions("country")
    expect(active.some((option) => option.value === "IN")).toBe(true)
  })

  it("excludes a deactivated country from new selections without touching the shared catalogue", () => {
    const active = getActiveOptions("country")
    const deactivatedCopy = active.map((option) => (option.value === "IN" ? { ...option, active: false } : option))
    expect(deactivatedCopy.find((option) => option.value === "IN")?.active).toBe(false)
    // The shared, canonical source is untouched by that local copy.
    expect(getActiveOptions("country").some((option) => option.value === "IN")).toBe(true)
  })

  it("still resolves a country that would be historically deactivated", () => {
    const resolved = resolveOption("country", "IN")
    expect(resolved?.label).toBe("India")
  })
})

describe("phone country code options", () => {
  it("derives from the same country catalogue as the country list", () => {
    const countryOptions = toCountryOptions()
    const phoneOptions = toPhoneCountryCodeOptions()
    expect(phoneOptions.length).toBe(countryOptions.length)
    expect(phoneOptions.map((option) => option.value).sort()).toEqual(
      countryOptions.map((option) => option.value).sort()
    )
  })

  it("displays the country name with its calling code", () => {
    const india = toPhoneCountryCodeOptions().find((option) => option.value === "IN")
    expect(india?.label).toBe("India (+91)")
    expect(india?.dialCode).toBe("+91")
  })

  it("keeps countries sharing a calling code as separate phone options", () => {
    const options = toPhoneCountryCodeOptions()
    const us = options.find((option) => option.value === "US")
    const ca = options.find((option) => option.value === "CA")
    expect(us?.dialCode).toBe("+1")
    expect(ca?.dialCode).toBe("+1")
    expect(us?.value).not.toBe(ca?.value)
  })
})
