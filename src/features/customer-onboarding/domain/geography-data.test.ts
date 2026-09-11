import { describe, expect, it } from "vitest"

/**
 * Sanity-checks the chosen `countries-states-cities` dataset itself
 * (task spec §15's "evaluate... ability to query cities by
 * country/state"), not the `server-only`-guarded reader
 * (../server/geography.ts, which vitest cannot import directly, the
 * same way src/features/commercial/server.ts cannot; see that
 * feature's boundary.test.ts for the established precedent). This test
 * file imports the raw package data straight from node_modules, which
 * is safe: it never ships in the client bundle regardless of whether a
 * test file references it.
 *
 * Note: this installed version's own `getCountryByCode` helper is
 * broken (it matches a `sortname` field the bundled data no longer
 * has), so ../server/geography.ts reads the raw `dist/lib/*.json`
 * files directly and filters by id, exactly as this test does.
 */
import countries from "countries-states-cities/dist/lib/countries.json"
import states from "countries-states-cities/dist/lib/states.json"
import cities from "countries-states-cities/dist/lib/cities.json"

describe("countries-states-cities dataset", () => {
  it("has a materially complete country list", () => {
    expect(countries.length).toBeGreaterThan(190)
  })

  it("has multiple states for India", () => {
    const india = countries.find((country) => country.iso2 === "IN")
    expect(india).toBeDefined()
    const indiaStates = states.filter((state) => state.country_id === india?.id)
    expect(indiaStates.length).toBeGreaterThan(20)
    expect(indiaStates.some((state) => state.name === "Maharashtra")).toBe(true)
  })

  it("has cities for a known Indian state", () => {
    const india = countries.find((country) => country.iso2 === "IN")
    const maharashtra = states.find((state) => state.country_id === india?.id && state.name === "Maharashtra")
    expect(maharashtra).toBeDefined()
    const maharashtraCities = cities.filter((city) => city.state_id === maharashtra?.id)
    expect(maharashtraCities.length).toBeGreaterThan(50)
    expect(maharashtraCities.some((city) => city.name === "Mumbai" || city.name === "Pune")).toBe(true)
  })

  it("has countries with no states, so State can fall back gracefully", () => {
    const stateCountryIds = new Set(states.map((state) => state.country_id))
    const withoutStates = countries.filter((country) => !stateCountryIds.has(country.id))
    expect(withoutStates.length).toBeGreaterThan(0)
  })
})
