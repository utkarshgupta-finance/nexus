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
  phone_country_code: toPhoneCountryCodeOptions(),
  // Stable identity is the currency code (task spec: "stable stored
  // identity = currency code"); the label pairs code with the full name
  // so a chooser never shows a bare, ambiguous three-letter code. Only
  // these five start active; every other ISO currency is deliberately
  // left out rather than auto-activated, until a real business owner
  // asks for it.
  currency: [
    { value: "INR", label: "INR - Indian Rupee", active: true },
    { value: "USD", label: "USD - US Dollar", active: true },
    { value: "GBP", label: "GBP - British Pound Sterling", active: true },
    { value: "SGD", label: "SGD - Singapore Dollar", active: true },
    { value: "IDR", label: "IDR - Indonesian Rupiah", active: true },
  ],
  // Commercial Rate lists (task spec: Customer Onboarding Commercial Rate
  // V1). Stable codes, never the display label, matching every list above.
  pricing_unit: [
    { value: "USER", label: "User", active: true },
    { value: "MESSAGE", label: "Message", active: true },
    { value: "OUTLET", label: "Outlet", active: true },
    { value: "DISTRIBUTOR", label: "Distributor", active: true },
    { value: "SESSION", label: "Session", active: true },
    { value: "REQUEST", label: "Request", active: true },
    { value: "MAN_DAY", label: "Man-day", active: true },
    { value: "DAY", label: "Day", active: true },
  ],
  billing_cycle: [
    { value: "monthly", label: "Monthly", active: true },
    { value: "quarterly", label: "Quarterly", active: true },
    { value: "half_yearly", label: "Half-Yearly", active: true },
    { value: "annual", label: "Annual", active: true },
    { value: "one_time", label: "One-Time", active: true },
    { value: "on_demand", label: "On-Demand", active: true },
  ],
  billing_timing: [
    { value: "advance", label: "Advance", active: true },
    { value: "arrears", label: "Arrears", active: true },
    { value: "on_completion", label: "On Completion", active: true },
    { value: "on_demand", label: "On Demand", active: true },
  ],
  payment_terms: [
    { value: "due_on_receipt", label: "Due on Receipt", active: true },
    { value: "days_7", label: "7 Days", active: true },
    { value: "days_15", label: "15 Days", active: true },
    { value: "days_30", label: "30 Days", active: true },
    { value: "days_45", label: "45 Days", active: true },
    { value: "days_60", label: "60 Days", active: true },
    { value: "days_90", label: "90 Days", active: true },
    { value: "custom", label: "Custom", active: true },
  ],
  commercial_nature: [
    { value: "recurring", label: "Recurring", active: true },
    { value: "non_recurring", label: "Non-Recurring", active: true },
    { value: "on_demand", label: "On-Demand", active: true },
  ],
  // System-supported calculation models (docs/COMMERCIAL_DOMAIN_ARCHITECTURE.md
  // §23): Settings may Activate/Deactivate these, never add a new one, since a
  // new value here needs new Pricing Kernel calculation logic to mean anything.
  pricing_model: [
    { value: "per_unit", label: "Per Unit", active: true },
    { value: "flat_fee", label: "Flat Fee", active: true },
    { value: "slab", label: "Slab", active: true },
    { value: "designation_based", label: "Designation Based", active: true },
    { value: "fixed_fee", label: "Fixed Fee", active: true },
  ],
}

export { REFERENCE_MASTER_FIXTURES }
