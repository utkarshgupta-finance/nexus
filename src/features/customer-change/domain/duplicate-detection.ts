/**
 * Customer Change GST/PAN Duplicate Prevention (AA-015, PG-064): the same
 * exact-match GST/PAN hard blocker
 * src/features/customer-onboarding/domain/duplicate-detection.ts already
 * enforces for a brand new customer at Onboarding Submit, applied here to
 * a Customer Change Request proposing a new GST or PAN for an EXISTING
 * customer. Deterministic, exact-match only, never fuzzy: a real business
 * cannot legitimately hold two Customer Master records under the same
 * GST/PAN. The two features never import each other's internals
 * (docs/ARCHITECTURE.md's one-feature-never-imports-another rule), so this
 * is a small, feature-local mirror rather than a shared import; scoped to
 * GST/PAN only since that is the governed pair this gap concerns, unlike
 * Onboarding's own file, which also carries the Legal Entity Name/Brand
 * soft-match signals relevant only to brand-new customer identity.
 */

type GstPanFieldKey = "gst_number" | "pan"

type ExistingCustomerTaxIdentity = {
  customerId: string
  customerKey: string
  customerName: string
  gstNumber: string | null
  pan: string | null
}

type GstPanDuplicateCandidate = {
  gstNumber: string | null
  pan: string | null
}

type GstPanDuplicateMatch = {
  fieldKey: GstPanFieldKey
  matchedValue: string
  customerId: string
  customerKey: string
  customerName: string
}

/** Trims and case-folds so accidental case/whitespace entry still matches; never matches two unset values against each other. */
function normalize(value: string | null): string | null {
  if (!value) return null
  const trimmed = value.trim()
  return trimmed ? trimmed.toLowerCase() : null
}

function findFieldMatches(
  fieldKey: GstPanFieldKey,
  candidateValue: string | null,
  otherCustomers: ExistingCustomerTaxIdentity[],
  extractor: (customer: ExistingCustomerTaxIdentity) => string | null
): GstPanDuplicateMatch[] {
  const normalizedCandidate = normalize(candidateValue)
  if (!normalizedCandidate) return []
  return otherCustomers
    .filter((customer) => normalize(extractor(customer)) === normalizedCandidate)
    .map((customer) => ({
      fieldKey,
      matchedValue: candidateValue as string,
      customerId: customer.customerId,
      customerKey: customer.customerKey,
      customerName: customer.customerName,
    }))
}

/**
 * `excludeCustomerId` is always the Change Request's own customer: its
 * current GST/PAN, or a proposal that simply repeats it, must never be
 * flagged as a duplicate of itself. Only a genuine match against a
 * DIFFERENT customer counts.
 */
function findChangeRequestGstPanDuplicates(
  candidate: GstPanDuplicateCandidate,
  existingCustomers: ExistingCustomerTaxIdentity[],
  excludeCustomerId: string
): GstPanDuplicateMatch[] {
  const otherCustomers = existingCustomers.filter((customer) => customer.customerId !== excludeCustomerId)
  return [
    ...findFieldMatches("gst_number", candidate.gstNumber, otherCustomers, (customer) => customer.gstNumber),
    ...findFieldMatches("pan", candidate.pan, otherCustomers, (customer) => customer.pan),
  ]
}

export { findChangeRequestGstPanDuplicates }
export type { GstPanFieldKey, ExistingCustomerTaxIdentity, GstPanDuplicateCandidate, GstPanDuplicateMatch }
