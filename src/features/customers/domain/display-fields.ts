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

/** Task Phase H: billing_currency is now a real governed column; the demo fixture only fills in for the one legacy customer that predates it. */
function resolveBillingCurrencyCode(record: CustomerMasterRecord, enrichment: DemoCustomerEnrichment | null): string | null {
  return record.billingCurrency ?? enrichment?.billingCurrencyCode ?? null
}

function resolveState(record: CustomerMasterRecord, enrichment: DemoCustomerEnrichment | null): string | null {
  return record.state ?? enrichment?.stateName ?? null
}

function resolveCity(record: CustomerMasterRecord, enrichment: DemoCustomerEnrichment | null): string | null {
  return record.city ?? enrichment?.cityName ?? null
}

function resolvePrimaryContactName(record: CustomerMasterRecord, enrichment: DemoCustomerEnrichment | null): string | null {
  return record.primaryContactName ?? enrichment?.primaryContactName ?? null
}

function resolvePrimaryContactEmail(record: CustomerMasterRecord, enrichment: DemoCustomerEnrichment | null): string | null {
  return record.primaryContactEmail ?? enrichment?.primaryContactEmail ?? null
}

function resolvePrimaryContactDesignation(record: CustomerMasterRecord, enrichment: DemoCustomerEnrichment | null): string | null {
  return record.primaryContactDesignation ?? enrichment?.primaryContactDesignation ?? null
}

/** GST/PAN/TAN are India-only identifiers; the demo fixture only ever illustrates the India branch, so a non-India real customer correctly shows "Not available" here with no enrichment fallback attempted. */
function resolveGstNumber(record: CustomerMasterRecord, enrichment: DemoCustomerEnrichment | null): string | null {
  return record.gstNumber ?? enrichment?.gstin ?? null
}

function resolvePan(record: CustomerMasterRecord, enrichment: DemoCustomerEnrichment | null): string | null {
  return record.pan ?? enrichment?.pan ?? null
}

function resolveTan(record: CustomerMasterRecord, enrichment: DemoCustomerEnrichment | null): string | null {
  return record.tan ?? enrichment?.tan ?? null
}

export {
  resolveBrandName,
  resolveCountryCode,
  resolveIndustryCode,
  resolveSegmentCode,
  resolveBusinessUnitCode,
  resolveBillingCurrencyCode,
  resolveState,
  resolveCity,
  resolvePrimaryContactName,
  resolvePrimaryContactEmail,
  resolvePrimaryContactDesignation,
  resolveGstNumber,
  resolvePan,
  resolveTan,
}
