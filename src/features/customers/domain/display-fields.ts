import type { CustomerMasterRecord } from "./types"
import type { DemoCustomerEnrichment } from "./demo-enrichment"

/**
 * Single source of truth for "does this customer's display value come
 * from a real governed column, or the legacy demo enrichment fallback".
 * A real value on `record` always wins; `enrichment` only fills in a
 * field that has never been set (docs/CUSTOMER_LIFECYCLE.md §3c). Both
 * the Customers list and the Customer detail page must resolve these
 * identically, so this lives here once instead of being duplicated.
 */

function resolveBrandName(record: CustomerMasterRecord, enrichment: DemoCustomerEnrichment | null): string | null {
  return record.brandName ?? enrichment?.brandName ?? null
}

function resolveCountryCode(record: CustomerMasterRecord, enrichment: DemoCustomerEnrichment | null): string | null {
  return record.country ?? enrichment?.countryCode ?? null
}

function resolveIndustryCode(record: CustomerMasterRecord, enrichment: DemoCustomerEnrichment | null): string | null {
  return record.industry ?? enrichment?.industryValue ?? null
}

function resolveSegmentCode(record: CustomerMasterRecord, enrichment: DemoCustomerEnrichment | null): string | null {
  return record.segment ?? enrichment?.segmentValue ?? null
}

function resolveBusinessUnitCode(record: CustomerMasterRecord, enrichment: DemoCustomerEnrichment | null): string | null {
  return record.businessUnit ?? enrichment?.businessUnitValue ?? null
}

/** Billing currency has no real governed column on `customers` yet, so it is demo-enrichment-only until one exists. */
function resolveBillingCurrencyCode(enrichment: DemoCustomerEnrichment | null): string | null {
  return enrichment?.billingCurrencyCode ?? null
}

export {
  resolveBrandName,
  resolveCountryCode,
  resolveIndustryCode,
  resolveSegmentCode,
  resolveBusinessUnitCode,
  resolveBillingCurrencyCode,
}
