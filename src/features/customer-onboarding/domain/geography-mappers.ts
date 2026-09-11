/**
 * Pure transforms over raw geography rows. Kept separate from
 * ../server/geography.ts (the actual `countries-states-cities` reader)
 * so this logic is unit-testable without pulling in the `server-only`
 * import guard, matching the precedent already set by
 * src/features/commercial/read-models/configuration-overview-helpers.ts.
 *
 * Country/State/City are a canonical geography catalogue, not a
 * Reference Master list: there is no active/inactive concept here, and
 * this module never produces the tens of thousands of rows a full city
 * catalogue would require Settings to manage (task spec §17).
 */

type RawStateRecord = { name: string; state_code: string | null }
type RawCityRecord = { id: number; name: string }

type GeographyOption = { value: string; label: string }

type CityLazyLoadResult = { items: GeographyOption[]; totalCount: number }

/**
 * A handful of subdivisions in the underlying dataset carry no stable
 * code (a few Kosovo districts, at the time this was written); without
 * one there is nothing usable as a value, so those rows are skipped
 * rather than assigned a made-up code.
 */
function toStateOptions(rawStates: RawStateRecord[]): GeographyOption[] {
  return rawStates
    .filter((state): state is RawStateRecord & { state_code: string } => state.state_code !== null)
    .map((state) => ({ value: state.state_code, label: state.name }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

/**
 * City's stable value is the dataset's own numeric id, not the bare
 * name: city names are not globally unique (many countries have more
 * than one city sharing a name), so a name-only value could silently
 * collide.
 */
function filterCityOptions(
  rawCities: RawCityRecord[],
  search: string,
  skip: number,
  take: number
): CityLazyLoadResult {
  const query = search.trim().toLowerCase()
  const matches = query ? rawCities.filter((city) => city.name.toLowerCase().includes(query)) : rawCities
  const sorted = [...matches].sort((a, b) => a.name.localeCompare(b.name))
  const page = sorted.slice(skip, skip + take)
  return {
    items: page.map((city) => ({ value: String(city.id), label: city.name })),
    totalCount: sorted.length,
  }
}

export { toStateOptions, filterCityOptions }
export type { RawStateRecord, RawCityRecord, GeographyOption, CityLazyLoadResult }
