import { countries as countriesListData } from "countries-list"

import type { ReferenceOption } from "./types"

/**
 * Canonical country catalogue, derived from `countries-list` (MIT,
 * offline JSON data, no runtime API) rather than hand-maintained: ISO
 * 3166-1 alpha-2 code, canonical name, and calling code for every entry
 * the package ships. `countries-list` was chosen over the larger
 * `world-countries` package (tens of megabytes of full country records)
 * because Nexus only needs code, name, and calling code, and this stays
 * small enough to bundle for an offline, client-side Reference Master
 * screen.
 *
 * The stable identity is the ISO country code, never the calling code:
 * several countries share a calling code (`US`, `CA`, and others all use
 * "+1"), and each must resolve to its own distinct Reference Master
 * option. Country and Phone Country Code options are both derived from
 * this one catalogue, so they can never drift apart.
 */
type CountryRecord = {
  code: string
  name: string
  callingCode: string
}

function buildCountryCatalogue(): CountryRecord[] {
  return Object.entries(countriesListData)
    .map(([code, data]) => ({ code, name: data.name, callingCode: `+${data.phone[0]}` }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

const COUNTRY_CATALOGUE: CountryRecord[] = buildCountryCatalogue()

function toCountryOptions(): ReferenceOption[] {
  return COUNTRY_CATALOGUE.map((country) => ({ value: country.code, label: country.name, active: true }))
}

function toPhoneCountryCodeOptions(): ReferenceOption[] {
  return COUNTRY_CATALOGUE.map((country) => ({
    value: country.code,
    label: `${country.name} (${country.callingCode})`,
    dialCode: country.callingCode,
    active: true,
  }))
}

export { COUNTRY_CATALOGUE, toCountryOptions, toPhoneCountryCodeOptions }
export type { CountryRecord }
