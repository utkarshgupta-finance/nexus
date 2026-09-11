import type { CityLazyLoadResult, GeographyOption } from "./geography-mappers"

/**
 * Client-safe calls to Nexus's own same-origin geography routes
 * (src/app/api/geography/*), never a third-party API. The large
 * `countries-states-cities` dataset itself never reaches this module or
 * the client bundle; see ../server/geography.ts for where it actually
 * lives.
 */

async function fetchStatesForCountry(countryIso2: string): Promise<GeographyOption[]> {
  const response = await fetch(`/api/geography/states?country=${encodeURIComponent(countryIso2)}`)
  if (!response.ok) return []
  const body = (await response.json()) as { items: GeographyOption[] }
  return body.items
}

async function fetchCitiesForCountry(params: {
  countryIso2: string
  stateCode: string | null
  search: string
  skip: number
  take: number
}): Promise<CityLazyLoadResult> {
  const query = new URLSearchParams({
    country: params.countryIso2,
    search: params.search,
    skip: String(params.skip),
    take: String(params.take),
  })
  if (params.stateCode) query.set("state", params.stateCode)

  const response = await fetch(`/api/geography/cities?${query.toString()}`)
  if (!response.ok) return { items: [], totalCount: 0 }
  return (await response.json()) as CityLazyLoadResult
}

export { fetchStatesForCountry, fetchCitiesForCountry }
