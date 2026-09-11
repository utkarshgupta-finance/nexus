import { CUSTOMER_ONBOARDING_FIELD_KEYS } from "@/features/customer-onboarding"
import type { CustomerOnboardingCase } from "@/features/customer-onboarding"

/**
 * Fictional, public-safe examples of Onboarding Cases at different
 * points in the flow, so the Customers area's split between "not yet a
 * Customer Master record" and "approved Customer Master record" (task
 * spec §5) has something real to show. No fake Customer Master record
 * exists alongside these: an onboarding case that has not been approved
 * never gets a Customer Master row, fabricated or otherwise.
 *
 * `createdBy`/`updatedBy`/`submittedBy`/`sentBack.sentBackBy` are all
 * `null` here too, matching the same no-fabricated-actor-identity rule
 * that applies everywhere else in this feature (task spec §3): there is
 * no auth yet, so nothing here invents a reviewer or submitter name.
 */
const FIXTURE_ONBOARDING_CASES: CustomerOnboardingCase[] = [
  {
    requestId: "REQ-10231",
    status: "draft",
    currentStageKey: "customer_details",
    currentRevision: {
      revisionNumber: 1,
      status: "draft",
      data: {
        [CUSTOMER_ONBOARDING_FIELD_KEYS.legalEntityName]: "Rivermede Fictional Foods Pvt Ltd",
        [CUSTOMER_ONBOARDING_FIELD_KEYS.country]: "IN",
      },
      createdBy: null,
      createdAt: "2026-08-20T09:12:00.000Z",
      updatedBy: null,
      updatedAt: "2026-08-21T14:03:00.000Z",
      submittedBy: null,
      submittedAt: null,
    },
    sentBack: null,
    approvedBy: null,
    approvedAt: null,
  },
  {
    requestId: "REQ-10198",
    status: "submitted",
    currentStageKey: "tax_registration",
    currentRevision: {
      revisionNumber: 1,
      status: "submitted",
      data: {
        [CUSTOMER_ONBOARDING_FIELD_KEYS.legalEntityName]: "Solborne Fictional Textiles Ltd",
        [CUSTOMER_ONBOARDING_FIELD_KEYS.country]: "IN",
      },
      createdBy: null,
      createdAt: "2026-08-14T10:00:00.000Z",
      updatedBy: null,
      updatedAt: "2026-08-15T11:30:00.000Z",
      submittedBy: null,
      submittedAt: "2026-08-15T11:30:00.000Z",
    },
    sentBack: null,
    approvedBy: null,
    approvedAt: null,
  },
  {
    requestId: "REQ-10176",
    status: "sent_back",
    currentStageKey: "tax_registration",
    currentRevision: {
      revisionNumber: 1,
      status: "submitted",
      data: {
        [CUSTOMER_ONBOARDING_FIELD_KEYS.legalEntityName]: "Palewood Fictional Logistics Inc",
        [CUSTOMER_ONBOARDING_FIELD_KEYS.country]: "IN",
      },
      createdBy: null,
      createdAt: "2026-08-01T08:00:00.000Z",
      updatedBy: null,
      updatedAt: "2026-08-02T09:15:00.000Z",
      submittedBy: null,
      submittedAt: "2026-08-02T09:15:00.000Z",
    },
    sentBack: {
      reason: "Please upload a clearer GST certificate.",
      sentBackBy: null,
      sentBackAt: "2026-08-04T13:00:00.000Z",
      targetStageKey: "tax_registration",
    },
    approvedBy: null,
    approvedAt: null,
  },
]

export { FIXTURE_ONBOARDING_CASES }
