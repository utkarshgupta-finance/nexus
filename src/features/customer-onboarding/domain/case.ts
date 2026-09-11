import type { CustomerOnboardingCase, CustomerOnboardingRevision, CustomerOnboardingStageKey, AppUserId } from "./types"

/**
 * Pure transitions over a Customer Onboarding Case. Every function
 * returns a new object; nothing here mutates its input, and nothing
 * here rewrites a revision once it has been submitted, matching the
 * Form Submission principle this feature must preserve.
 *
 * The conceptual flow (task spec §37):
 *
 *   createCase -> draft revision 1
 *   -> updateRevisionData (repeatable while draft)
 *   -> submitCase -> revision 1 submitted, case "submitted"
 *   -> sendBackCase -> case "sent_back" (revision 1 stays submitted, untouched)
 *   -> startNextRevision -> draft revision 2, data copied forward from revision 1
 *   -> updateRevisionData (Finance's own edits land on revision 2, not revision 1)
 *   -> submitCase -> revision 2 submitted, case "resubmitted"
 *   -> approveCase -> case "approved"
 *
 * This is deliberately not a workflow engine: there is no persistence,
 * no actor authorization check, and no generic state-machine
 * abstraction. It is the minimum set of pure functions that make the
 * required audit shape possible once a real service layer exists:
 * "who changed what, when, and why" is reconstructable from the
 * resulting revision list plus `sentBack`/`approvedBy`/`approvedAt`,
 * never from a single mutable blob.
 */

function createCase(requestId: string, now: string, createdBy: AppUserId | null): CustomerOnboardingCase {
  return {
    requestId,
    status: "draft",
    currentStageKey: "customer_details",
    currentRevision: createDraftRevision(1, now, createdBy),
    sentBack: null,
    approvedBy: null,
    approvedAt: null,
  }
}

/**
 * Records which stage the submitter is currently working in. Purely
 * informational for the Onboarding Cases list; it does not gate
 * anything (task spec §32: casual stage navigation is never blocked).
 */
function setCurrentStage(onboardingCase: CustomerOnboardingCase, stageKey: CustomerOnboardingStageKey): CustomerOnboardingCase {
  return { ...onboardingCase, currentStageKey: stageKey }
}

function createDraftRevision(revisionNumber: number, now: string, createdBy: AppUserId | null): CustomerOnboardingRevision {
  return {
    revisionNumber,
    status: "draft",
    data: {},
    createdBy,
    createdAt: now,
    updatedBy: createdBy,
    updatedAt: now,
    submittedBy: null,
    submittedAt: null,
  }
}

/**
 * Save Draft. Always allowed, regardless of which required fields are
 * still missing from `data`: required-field validation is a Submit-time
 * concern (task spec §4), never a gate on saving a draft. Throws only if
 * the current revision has already been submitted, since a submitted
 * revision is immutable evidence.
 */
function updateRevisionData(
  onboardingCase: CustomerOnboardingCase,
  data: Record<string, unknown>,
  now: string,
  updatedBy: AppUserId | null
): CustomerOnboardingCase {
  if (onboardingCase.currentRevision.status !== "draft") {
    throw new Error("Cannot update data on a revision that has already been submitted.")
  }
  return {
    ...onboardingCase,
    currentRevision: { ...onboardingCase.currentRevision, data, updatedBy, updatedAt: now },
  }
}

/**
 * Submit. The caller (the form UI) is responsible for having already
 * run required-field validation for the applicable stages; this
 * function only performs the state transition, so submission
 * requirements can grow per-stage without this function changing (task
 * spec §34). Resubmitting after a send-back lands on case status
 * "resubmitted" rather than "submitted", so the Onboarding Cases list
 * can distinguish a first submission from a review cycle.
 */
function submitCase(onboardingCase: CustomerOnboardingCase, now: string, submittedBy: AppUserId | null): CustomerOnboardingCase {
  if (onboardingCase.currentRevision.status !== "draft") {
    throw new Error("Only a draft revision can be submitted.")
  }
  return {
    ...onboardingCase,
    status: onboardingCase.status === "sent_back" ? "resubmitted" : "submitted",
    currentRevision: {
      ...onboardingCase.currentRevision,
      status: "submitted",
      submittedBy,
      submittedAt: now,
      updatedBy: submittedBy,
      updatedAt: now,
    },
  }
}

/**
 * Send back. Only ever applies to a submitted revision, and never
 * touches that revision: it stays exactly as submitted, so the record
 * of what was actually reviewed and rejected is preserved. Editing
 * resumes on a new revision via `startNextRevision`.
 */
function sendBackCase(
  onboardingCase: CustomerOnboardingCase,
  reason: string,
  sentBackBy: AppUserId | null,
  now: string,
  targetStageKey: CustomerOnboardingStageKey | null
): CustomerOnboardingCase {
  if (onboardingCase.status !== "submitted" && onboardingCase.status !== "resubmitted") {
    throw new Error("Only a submitted case can be sent back.")
  }
  if (onboardingCase.currentRevision.status !== "submitted") {
    throw new Error("Cannot send back a case whose current revision is not submitted.")
  }
  return {
    ...onboardingCase,
    status: "sent_back",
    sentBack: { reason, sentBackBy, sentBackAt: now, targetStageKey },
  }
}

/**
 * Start editing again after a send-back. Creates revision N+1 as a new
 * draft, with `data` copied forward from the submitted revision it
 * follows, mirroring the real `create_next_revision` RPC's semantics.
 * Whoever edits next (the original submitter or a reviewer) edits this
 * new revision, never the one that was actually reviewed (task spec
 * §36: "Revision 3 Submitted by User A / Revision 4 Edited during
 * Finance review by User B").
 */
function startNextRevision(onboardingCase: CustomerOnboardingCase, now: string, actorId: AppUserId | null): CustomerOnboardingCase {
  if (onboardingCase.status !== "sent_back") {
    throw new Error("Can only start a new revision after a case has been sent back.")
  }
  const nextRevision = createDraftRevision(onboardingCase.currentRevision.revisionNumber + 1, now, actorId)
  return {
    ...onboardingCase,
    currentRevision: { ...nextRevision, data: onboardingCase.currentRevision.data },
  }
}

/**
 * Approve. The approved values become Customer Master's initial state
 * in a later stage (task spec §37); this function only records that the
 * case itself reached approval, it does not create any Customer Master
 * record.
 */
function approveCase(onboardingCase: CustomerOnboardingCase, approvedBy: AppUserId | null, now: string): CustomerOnboardingCase {
  if (onboardingCase.status !== "submitted" && onboardingCase.status !== "resubmitted") {
    throw new Error("Only a submitted case can be approved.")
  }
  if (onboardingCase.currentRevision.status !== "submitted") {
    throw new Error("Cannot approve a case whose current revision is not submitted.")
  }
  return { ...onboardingCase, status: "approved", approvedBy, approvedAt: now }
}

export { createCase, setCurrentStage, updateRevisionData, submitCase, sendBackCase, startNextRevision, approveCase }
