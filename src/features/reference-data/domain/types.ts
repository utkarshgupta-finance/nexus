/**
 * Reference Master: the controlled option lists Nexus forms select from
 * (Country, Industry, Segment, Business Unit, Phone Country Code, Currency,
 * plus the Commercial Rate lists added for Customer Onboarding's Commercial
 * Rate stage: Pricing Unit, Invoice Frequency, Invoice Timing, Commercial
 * Nature, Pricing Model).
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
 * Not every list here is governed identically (docs/COMMERCIAL_DOMAIN_ARCHITECTURE.md
 * §22 documents the distinction in full):
 * - **Freely configurable**: `pricing_unit`, `invoice_frequency`,
 *   `invoice_timing`. Pure administrative data; a new value needs no code change.
 * - **Controlled business option**: `commercial_nature`. Each value drives real
 *   UI/validation branching, so a value added here without matching code has no
 *   effect; Settings still allows adding one, but it does not become usable on
 *   its own.
 * - **System-supported logic**: `pricing_model`. A new value needs new
 *   calculation logic in the Pricing Kernel; Settings only allows Activate/
 *   Deactivate for this list, never adding a new one (see
 *   ../ui/reference-master-settings.tsx).
 *
 * Payment Terms is deliberately not a Reference Master list here: Commercial
 * Rate V1 was corrected to exclude payment terms entirely from this stage
 * (they belong to a later Invoice/Collections configuration, see docs §22).
 */

type ReferenceListKey =
  | "country"
  | "industry"
  | "segment"
  | "business_unit"
  | "phone_country_code"
  | "currency"
  | "pricing_unit"
  | "invoice_frequency"
  | "invoice_timing"
  | "commercial_nature"
  | "pricing_model"

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
