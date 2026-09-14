/**
 * Customer Duplicate Prevention (task Phase K): deterministic, exact-match
 * signals only, never fuzzy/AI matching as an authoritative blocker. GST
 * and PAN are hard identifiers: a real business cannot legitimately hold
 * two Customer Master records under the same GST/PAN, so a match there
 * blocks Submit outright. Legal Entity Name and Brand are softer:
 * different legal entities can share a similar or even identical display
 * name (a franchise, a common word), so a match there only warns.
 */

type DuplicateFieldKey = "gst_number" | "pan" | "legal_entity_name" | "brand_name"

type DuplicateSeverity = "hard" | "soft"

const FIELD_SEVERITY: Record<DuplicateFieldKey, DuplicateSeverity> = {
  gst_number: "hard",
  pan: "hard",
  legal_entity_name: "soft",
  brand_name: "soft",
}

const FIELD_LABELS: Record<DuplicateFieldKey, string> = {
  gst_number: "GST",
  pan: "PAN",
  legal_entity_name: "Legal Entity Name",
  brand_name: "Brand",
}

type ExistingCustomerIdentity = {
  customerId: string
  customerKey: string
  customerName: string
  gstNumber: string | null
  pan: string | null
  legalEntityName: string | null
  brandName: string | null
}

type DuplicateCandidate = {
  gstNumber: string | null
  pan: string | null
  legalEntityName: string | null
  brandName: string | null
}

type DuplicateMatch = {
  fieldKey: DuplicateFieldKey
  severity: DuplicateSeverity
  matchedValue: string
  customerId: string
  customerKey: string
  customerName: string
}

/** Trims and case-folds so "ABC Foods Pvt Ltd" matches "abc foods pvt ltd ", but never matches two different empty/unset values against each other. */
function normalize(value: string | null): string | null {
  if (!value) return null
  const trimmed = value.trim()
  return trimmed ? trimmed.toLowerCase() : null
}

/** GST/PAN are compared exactly (case-insensitive only for accidental case entry), never trimmed of internal characters: a real GSTIN/PAN typo is a different identifier, not a fuzzy near-match. */
function findFieldMatches(
  fieldKey: DuplicateFieldKey,
  candidateValue: string | null,
  existingCustomers: ExistingCustomerIdentity[],
  extractor: (customer: ExistingCustomerIdentity) => string | null
): DuplicateMatch[] {
  const normalizedCandidate = normalize(candidateValue)
  if (!normalizedCandidate) return []
  return existingCustomers
    .filter((customer) => normalize(extractor(customer)) === normalizedCandidate)
    .map((customer) => ({
      fieldKey,
      severity: FIELD_SEVERITY[fieldKey],
      matchedValue: candidateValue as string,
      customerId: customer.customerId,
      customerKey: customer.customerKey,
      customerName: customer.customerName,
    }))
}

function findPotentialDuplicates(candidate: DuplicateCandidate, existingCustomers: ExistingCustomerIdentity[]): DuplicateMatch[] {
  return [
    ...findFieldMatches("gst_number", candidate.gstNumber, existingCustomers, (customer) => customer.gstNumber),
    ...findFieldMatches("pan", candidate.pan, existingCustomers, (customer) => customer.pan),
    ...findFieldMatches("legal_entity_name", candidate.legalEntityName, existingCustomers, (customer) => customer.legalEntityName),
    ...findFieldMatches("brand_name", candidate.brandName, existingCustomers, (customer) => customer.brandName),
  ]
}

function hasHardDuplicateMatch(matches: DuplicateMatch[]): boolean {
  return matches.some((match) => match.severity === "hard")
}

export { findPotentialDuplicates, hasHardDuplicateMatch, FIELD_LABELS }
export type { DuplicateFieldKey, DuplicateSeverity, DuplicateMatch, DuplicateCandidate, ExistingCustomerIdentity }
