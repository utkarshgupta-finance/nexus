/**
 * Demo Customer Master enrichment: NOT backend truth.
 *
 * The real `customers` table (./types.ts's `CustomerMasterRecord`) has
 * no country, industry, segment, business unit, contact, tax, or billing
 * currency column (`docs/MASTER_DATA_FOUNDATION_DESIGN.md` §5.2, §3:
 * "Customer Master is not a CRM"). This module is a clearly-labeled,
 * fixture-only enrichment layer that lets the Customer Master detail
 * screen show what a fully populated record would eventually look like,
 * keyed by the same `customers.key` the real backend row uses, without
 * pretending any of it is persisted. Every consumer of this module must
 * carry `source: "demo"` through to the UI (see
 * ../read-models/customer-master-detail.ts): nothing here is presented
 * as backend truth.
 *
 * Only one entry exists: the single fictional demo customer this task
 * creates. This is not a general Customer Master enrichment mechanism;
 * it does not scale to real customers, and is not meant to.
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
