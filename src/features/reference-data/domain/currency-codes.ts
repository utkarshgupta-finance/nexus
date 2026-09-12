import { countries as countriesListData } from "countries-list"

/**
 * Canonical set of ISO 4217 currency codes, derived from the same
 * `countries-list` package already used for the Country catalogue
 * (Library First: no new dependency for this), rather than a hand-typed
 * list that would drift out of date. Every country record in
 * `countries-list` carries its own `currency` array (one or more ISO
 * 4217 codes); this module flattens and dedupes them into one lookup set
 * so Currency Settings can validate "Add Currency" against real,
 * recognized codes (task correction: "Prefer selecting or validating
 * ISO-style codes rather than accepting random free-text currency
 * identities") without maintaining a second currency catalogue by hand.
 */
function buildIsoCurrencyCodes(): Set<string> {
  const codes = new Set<string>()
  for (const data of Object.values(countriesListData)) {
    for (const code of data.currency) codes.add(code)
  }
  return codes
}

const ISO_CURRENCY_CODES: Set<string> = buildIsoCurrencyCodes()

/** True only for a real ISO 4217 code this catalogue recognizes, case-insensitively. Never a plausibility guess. */
function isValidIsoCurrencyCode(code: string): boolean {
  return ISO_CURRENCY_CODES.has(code.trim().toUpperCase())
}

export { ISO_CURRENCY_CODES, isValidIsoCurrencyCode }
