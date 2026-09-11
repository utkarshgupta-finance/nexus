/**
 * Reference Master: the controlled option lists Nexus forms select from
 * (Country, Industry, Segment, Business Unit, Phone Country Code, Currency
 * today).
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
 */

type ReferenceListKey = "country" | "industry" | "segment" | "business_unit" | "phone_country_code" | "currency"

/**
 * `dialCode` only applies to the `phone_country_code` list. Kept as an
 * optional field on the shared shape rather than a parallel type, since
 * every other consumer of a Reference Master option only ever needs
 * `value`/`label`/`active`.
 */
type ReferenceOption = {
  value: string
  label: string
  active: boolean
  dialCode?: string
}

export type { ReferenceListKey, ReferenceOption }
