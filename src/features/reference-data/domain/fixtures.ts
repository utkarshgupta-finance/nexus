import { toCountryOptions, toPhoneCountryCodeOptions } from "./countries"
import type { ReferenceListKey, ReferenceOption } from "./types"

/**
 * Development fixture data for every Reference Master list Customer
 * Onboarding Stage 1 depends on. Fictional, public-safe, illustrative
 * only, not a locked company taxonomy (`CLAUDE.md` "Prototype UI fields"),
 * except `country` and `phone_country_code`, which come from the real
 * canonical country catalogue (./countries.ts) rather than a hand-typed
 * sample: a real form needs every country available, not a handful of
 * examples.
 *
 * One inactive option is included on purpose (`segment`'s "Global Key
 * Accounts (Legacy)") so the historical-resolution behaviour this module
 * must support has something real to demonstrate and test: it never
 * appears in `getActiveOptions`, but `resolveOption` can still resolve it.
 * Every canonical country starts active; Settings is where a real
 * deactivation would happen.
 *
 * This module is the single shared source both the Customer Onboarding
 * form and the Reference Master Settings screen read from, so the two
 * screens can never drift into two different copies of the same list.
 */
const REFERENCE_MASTER_FIXTURES: Record<ReferenceListKey, ReferenceOption[]> = {
  country: toCountryOptions(),
  industry: [
    { value: "fmcg", label: "FMCG", active: true },
    { value: "consumer_durables", label: "Consumer Durables", active: true },
    { value: "retail", label: "Retail", active: true },
    { value: "healthcare", label: "Healthcare", active: true },
    { value: "automotive", label: "Automotive", active: true },
    { value: "other", label: "Other", active: true },
  ],
  segment: [
    { value: "enterprise", label: "Enterprise", active: true },
    { value: "mid_market", label: "Mid Market", active: true },
    { value: "sme", label: "SME", active: true },
    { value: "global_key_accounts", label: "Global Key Accounts (Legacy)", active: false },
  ],
  business_unit: [
    { value: "india_enterprise", label: "India Enterprise", active: true },
    { value: "india_mid_market", label: "India Mid Market", active: true },
    { value: "sme", label: "SME", active: true },
    { value: "mea", label: "MEA", active: true },
    { value: "sea", label: "SEA", active: true },
    { value: "kam", label: "KAM", active: true },
    { value: "bat", label: "BAT", active: true },
  ],
  // Moved from a hardcoded Tax & Registration form option list into
  // Reference Master (Customer Onboarding Settings, "Customer Setup"):
  // the exact same values the form already used, none invented. "other"
  // stays the reserved escape hatch for a local tax scheme this taxonomy
  // does not name (see `TAX_IDENTIFIER_TYPE_OTHER` in
  // ../../customer-onboarding/forms/customer-onboarding-form-definition.ts).
  tax_identifier_type: [
    { value: "vat_number", label: "VAT Number", active: true },
    { value: "tax_identification_number", label: "Tax Identification Number", active: true },
    { value: "business_registration_number", label: "Business Registration Number", active: true },
    { value: "other", label: "Other", active: true },
  ],
  phone_country_code: toPhoneCountryCodeOptions(),
  // Stable identity is the currency code (task spec: "stable stored
  // identity = currency code"); the label pairs code with the full name
  // so a chooser never shows a bare, ambiguous three-letter code. Only
  // these five start active; every other ISO currency is deliberately
  // left out rather than auto-activated, until a real business owner
  // asks for it. `inrConversionRate` is "1 unit of this currency = X INR"
  // (task correction §12): INR's own rate is always 1; IDR is deliberately
  // left unconfigured (`null`) so the missing-rate validation path (§15)
  // has a real, illustrative example to exercise without inventing a
  // number nobody has actually approved. Fictional, illustrative rates,
  // not a live market feed.
  currency: [
    { value: "INR", label: "INR - Indian Rupee", active: true, inrConversionRate: 1 },
    { value: "USD", label: "USD - US Dollar", active: true, inrConversionRate: 91 },
    { value: "GBP", label: "GBP - British Pound Sterling", active: true, inrConversionRate: 121 },
    { value: "SGD", label: "SGD - Singapore Dollar", active: true, inrConversionRate: 68 },
    { value: "IDR", label: "IDR - Indonesian Rupiah", active: true, inrConversionRate: null },
  ],
  // Commercial Rate lists (Customer Onboarding Commercial Rate V1, corrected
  // business model, docs/COMMERCIAL_DOMAIN_ARCHITECTURE.md §22). Stable
  // codes, never the display label, matching every list above.
  pricing_unit: [
    { value: "USER", label: "User", active: true },
    { value: "PERSON", label: "Person", active: true },
    { value: "MESSAGE", label: "Message", active: true },
    { value: "OUTLET", label: "Outlet", active: true },
    { value: "DISTRIBUTOR", label: "Distributor", active: true },
    { value: "SESSION", label: "Session", active: true },
    { value: "REQUEST", label: "Request", active: true },
    { value: "MAN_DAY", label: "Man-day", active: true },
    { value: "DAY", label: "Day", active: true },
    { value: "IMAGE", label: "Image", active: true },
    { value: "REPORT", label: "Report", active: true },
    { value: "DASHBOARD", label: "Dashboard", active: true },
  ],
  // How often the customer is invoiced. Distinct from revenue recognition:
  // a Recurring component's revenue is always monthly regardless of this
  // value (docs §22). No "On-Demand" value here: On-Demand components leave
  // this optional and pick from the same real cadences where applicable.
  // `cadenceMonths` is the governed machine-readable cadence (Settings
  // task correction: "do not rely only on the display label to determine
  // invoice cadence"); "one_time" is the one reserved row with
  // `cadenceMonths: null`, a special non-recurring cadence a Settings-added
  // frequency can never carry, since adding one always requires a positive
  // cadence (see reference-master-settings.tsx's Invoice Frequency Add flow).
  invoice_frequency: [
    { value: "monthly", label: "Monthly", active: true, cadenceMonths: 1 },
    { value: "quarterly", label: "Quarterly", active: true, cadenceMonths: 3 },
    { value: "half_yearly", label: "Half-Yearly", active: true, cadenceMonths: 6 },
    { value: "annual", label: "Annual", active: true, cadenceMonths: 12 },
    { value: "one_time", label: "One-Time", active: true, cadenceMonths: null },
  ],
  // Whether an invoice is raised in advance of the period or after
  // (postpaid). "Postpaid" is the corrected business wording; "Arrears",
  // "On Completion", and "On Demand" were removed as separate timing values.
  invoice_timing: [
    { value: "advance", label: "Advance", active: true },
    { value: "postpaid", label: "Postpaid", active: true },
  ],
  commercial_nature: [
    { value: "recurring", label: "Recurring", active: true },
    { value: "non_recurring", label: "Non-Recurring", active: true },
    { value: "on_demand", label: "On-Demand", active: true },
  ],
  // System-supported calculation models (docs/COMMERCIAL_DOMAIN_ARCHITECTURE.md
  // §22): Settings may Activate/Deactivate these, never add a new one, since a
  // new value here needs new Pricing Kernel calculation logic to mean
  // anything. Shared across all three Commercial Natures (Recurring,
  // Non-Recurring, On-Demand); no separate "Fixed Fee" value is needed since
  // Flat Fee already covers a fixed, non-usage-based amount for every nature.
  pricing_model: [
    { value: "per_unit", label: "Per Unit", active: true },
    { value: "flat_fee", label: "Flat Fee", active: true },
    { value: "slab", label: "Slab", active: true },
    { value: "designation_based", label: "Designation Based", active: true },
  ],
  // System-supported logic (docs/SETTINGS_ARCHITECTURE.md, System Rules):
  // mirrors the fixed `SlabMethod` union in
  // ../../customer-onboarding/domain/commercial-rate.ts, purely so
  // Settings has one governed place to document and Activate/Deactivate
  // these as supported rules. Deactivating a row here does not yet hide
  // it from the Commercial Rate editor's own Slab Method toggle, which
  // still renders both values directly: the same honest, already-existing
  // limitation as `commercial_nature` (see that field's own note above).
  slab_method: [
    { value: "whole_quantity", label: "Whole Quantity", active: true },
    { value: "progressive", label: "Progressive", active: true },
  ],
  // System-supported logic, same pattern as `slab_method` above: mirrors
  // the fixed `RevenueRecognitionMethod` union for Non-Recurring
  // components, governed here for visibility, not yet wired to gate the
  // Revenue Recognition Method toggle in the Commercial Rate editor.
  revenue_recognition_method: [
    { value: "full_recognition", label: "Full Recognition", active: true },
    { value: "milestone_based", label: "Milestone Based", active: true },
  ],
}

export { REFERENCE_MASTER_FIXTURES }
