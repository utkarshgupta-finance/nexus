import "server-only"

import countries from "countries-states-cities/dist/lib/countries.json"
import states from "countries-states-cities/dist/lib/states.json"
import cities from "countries-states-cities/dist/lib/cities.json"

import { filterCityOptions, toStateOptions } from "../domain/geography-mappers"
import type { CityLazyLoadResult, GeographyOption } from "../domain/geography-mappers"

/**
 * Server-only reader over the `countries-states-cities` (MIT) dataset:
 * canonical Country -> State -> City geography, entirely local/offline,
 * no runtime network call. Reached only through /api/geography/* route
 * handlers, never imported by a Client Component or by the SurveyJS
 * form definition: the full dataset (~37MB unpacked, ~146k cities) must
 * never reach the browser bundle (task spec §15).
 *
 * This installed version's own `getCountryByCode`/`getStatesOfCountry`
 * helpers are unusable as documented: `getCountryByCode` matches a
 * `sortname` field the bundled data no longer has (it now uses `iso2`),
 * so every lookup silently returns `""`. This module reads the raw
 * `dist/lib/*.json` files directly and filters by id instead, which is
 * proven correct by ../domain/geography-data.test.ts against the same
 * files.
 */

function findCountryId(countryIso2: string): number | null {
  return countries.find((country) => country.iso2 === countryIso2)?.id ?? null
}

function getStatesForCountry(countryIso2: string): GeographyOption[] {
  const countryId = findCountryId(countryIso2)
  if (countryId === null) return []
  const rawStates = states.filter((state) => state.country_id === countryId)
  return toStateOptions(rawStates)
}

/**
 * Cities scoped to a country, optionally narrowed further by state.
 * Always paginated and always filterable by a search string: some
 * states/countries have thousands of cities (England alone has
 * ~2,900 in this dataset), so nothing here ever returns the full list
 * unpaginated.
 */
function searchCitiesForCountry(params: {
  countryIso2: string
  stateCode: string | null
  search: string
  skip: number
  take: number
}): CityLazyLoadResult {
  const countryId = findCountryId(params.countryIso2)
  if (countryId === null) return { items: [], totalCount: 0 }

  let scoped = cities.filter((city) => city.country_id === countryId)

  if (params.stateCode) {
    const state = states.find((s) => s.country_id === countryId && s.state_code === params.stateCode)
    if (state) scoped = scoped.filter((city) => city.state_id === state.id)
  }

  return filterCityOptions(scoped, params.search, params.skip, params.take)
}

export { getStatesForCountry, searchCitiesForCountry }
