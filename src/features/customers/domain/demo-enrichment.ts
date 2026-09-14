/**
 * Demo Customer Master enrichment: NOT backend truth.
 *
 * Every field this module illustrates (country, industry, segment,
 * business unit, contact, tax, billing currency) is now a REAL,
 * governed `customers` column (task Phase H,
 * supabase/migrations/20260916020000_customer_master_governed_fields.sql).
 * This module survives only as a fallback for the one legacy fixture
 * customer created before that migration existed, whose row genuinely
 * has no value in those columns; `../domain/display-fields.ts`'s
 * resolvers always prefer a real value first. It is not a general
 * Customer Master enrichment mechanism, does not scale to real
 * customers (every customer created through Onboarding Approval or
 * updated through a Customer Change Request already has real values),
 * and is not meant to. Every consumer of this module must carry
 * `source: "demo"` through to the UI (see
 * ../read-models/customer-master-mapping.ts): nothing here is
 * presented as backend truth.
 */

const DEMO_CUSTOMER_KEY = "demo-northstar-consumer-products"

type DemoCustomerEnrichment = {
  customerKey: string
  brandName: string
  countryCode: string
  stateName: string
  cityName: string
  industryValue: string
  segmentValue: string
  businessUnitValue: string
  primaryContactName: string
  primaryContactEmail: string
  primaryContactDesignation: string
  billingCurrencyCode: string
  gstin: string
  pan: string
  tan: string
  /** Always "demo": marks every field on this type as fixture-only, never backend truth. */
  source: "demo"
}

/**
 * Synthetic values only, exactly as specified for this task: a
 * fictional legal entity, a demo contact at example.com, and clearly
 * fake PAN/TAN/GSTIN patterns that do not correspond to any real
 * taxpayer. Reference Master value codes (countryCode/industryValue/
 * segmentValue/businessUnitValue/billingCurrencyCode) are chosen to
 * match real entries in src/features/reference-data so the detail
 * screen resolves real display labels through the real Reference
 * Master contract, not a hardcoded label here.
 */
const DEMO_CUSTOMER_ENRICHMENT: DemoCustomerEnrichment = {
  customerKey: DEMO_CUSTOMER_KEY,
  brandName: "Northstar",
  countryCode: "IN",
  stateName: "Karnataka",
  cityName: "Bengaluru",
  industryValue: "fmcg",
  segmentValue: "enterprise",
  businessUnitValue: "india_enterprise",
  primaryContactName: "Demo Contact",
  primaryContactEmail: "demo@example.com",
  primaryContactDesignation: "Commercial Manager",
  billingCurrencyCode: "INR",
  gstin: "29AAAAA0000A1Z5",
  pan: "AAAAA0000A",
  tan: "BLRA00000A",
  source: "demo",
}

export { DEMO_CUSTOMER_KEY, DEMO_CUSTOMER_ENRICHMENT }
export type { DemoCustomerEnrichment }
