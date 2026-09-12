/**
 * Reference Master: the controlled option lists Nexus forms select from.
 * `docs/SETTINGS_ARCHITECTURE.md` is the canonical, authoritative document
 * for how these lists are organized (the Customer Onboarding Settings
 * workspace's three groups: Customer Setup, Commercial Setup, System
 * Rules) and governed (the three configuration levels below); this header
 * only summarizes it.
 *
 * A Reference Master value is never physically removed once it has been
 * offered to a user: deactivating a value stops it appearing in new
 * selections, but a form submission or Customer Master record that already
 * stored the value must still be able to resolve it back to a display
 * label. See ./service.ts for the two option-resolution modes this
 * requires (active-only selection vs historical resolution).
 *
 * `docs/DATA_ARCHITECTURE.md` §6 already locks the intended generic shape
 * for reference/master data (a stable code, a display label, an active
 * flag, a sort order), but no table implementing it exists yet (M7 built
 * two purpose-built tables, `customers` and `capabilities`, not a generic
 * one; see that migration's own scope note). Until that table exists,
 * this feature is a fixture/TypeScript-only stand-in that already honours
 * the same contract, so a future generic table is a drop-in replacement
 * behind ./service.ts without any calling code changing.
 *
 * Not every list here is governed identically (`docs/SETTINGS_ARCHITECTURE.md`
 * documents the full distinction):
 * - **Level 1, Configurable Reference Data** (`industry`, `segment`,
 *   `business_unit`, `tax_identifier_type`, `pricing_unit`): pure
 *   administrative data. View, Search, Add, Activate, Deactivate.
 * - **Level 2, Governed Business Parameters** (`currency`'s
 *   `inrConversionRate`, `invoice_frequency`'s `cadenceMonths`): the list
 *   of values may still grow, but each value also carries a governed
 *   number with real calculation meaning, edited within defined
 *   semantics, never free text.
 * - **Level 3, System-Supported Logic** (`commercial_nature`,
 *   `pricing_model`, `invoice_timing`, `slab_method`,
 *   `revenue_recognition_method`): a new value needs new application/
 *   calculation code before it means anything, so Settings never allows
 *   adding one, only Activate/Deactivate where that is already safely
 *   wired (see ../ui/reference-master-settings.tsx and
 *   `docs/SETTINGS_ARCHITECTURE.md`'s honesty note on which of these five
 *   already gate real UI behavior today and which do not yet).
 *
 * `country` and `phone_country_code` are Reference Master shaped (for
 * historical-resolution consistency) but are deliberately excluded from
 * the Settings workspace's own navigation: geography stays governed by
 * its own canonical dataset (`./countries.ts`) and API, never a
 * hand-curated Settings list (`docs/SETTINGS_ARCHITECTURE.md`).
 *
 * Payment Terms is deliberately not a Reference Master list here: Commercial
 * Rate V1 was corrected to exclude payment terms entirely from this stage
 * (they belong to a later Invoice/Collections configuration, see
 * `docs/COMMERCIAL_DOMAIN_ARCHITECTURE.md` §22).
 */

type ReferenceListKey =
  | "country"
  | "industry"
  | "segment"
  | "business_unit"
  | "tax_identifier_type"
  | "phone_country_code"
  | "currency"
  | "pricing_unit"
  | "invoice_frequency"
  | "invoice_timing"
  | "commercial_nature"
  | "pricing_model"
  | "slab_method"
  | "revenue_recognition_method"

/**
 * `dialCode` only applies to the `phone_country_code` list; `inrConversionRate`
 * only applies to the `currency` list (task correction: "Extend Currency
 * Settings / Reference Master to support a centrally governed INR
 * conversion rate... 1 unit of foreign currency = X INR"); `cadenceMonths`
 * only applies to the `invoice_frequency` list (task correction: "Invoice
 * Frequency is configurable but must carry semantic cadence... do not rely
 * only on the display label to determine invoice cadence"). All three are
 * kept as optional fields on the shared shape rather than parallel types,
 * since every other consumer of a Reference Master option only ever needs
 * `value`/`label`/`active`.
 *
 * INR's own row always carries `inrConversionRate: 1`; a foreign currency
 * with no rate configured yet carries `null`, never a guessed value (see
 * `getInrConversionRate` in ./service.ts). A recurring Invoice Frequency
 * always carries a positive `cadenceMonths` (Monthly = 1, Quarterly = 3,
 * Half-Yearly = 6, Annual = 12); the system-reserved "One-Time" value
 * carries `cadenceMonths: null`, which is exactly what protects it from
 * being silently re-created or impersonated: Settings requires a positive
 * cadence for any new recurring frequency it adds, so a `null` cadence can
 * only ever mean the one true One-Time row (see
 * ../ui/reference-master-settings.tsx's Invoice Frequency Add flow).
 */
type ReferenceOption = {
  value: string
  label: string
  active: boolean
  dialCode?: string
  inrConversionRate?: number | null
  cadenceMonths?: number | null
}

export type { ReferenceListKey, ReferenceOption }
