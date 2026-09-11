import { describe, expect, it } from "vitest"

import { approveCase, createCase, sendBackCase, setCurrentStage, startNextRevision, submitCase, updateRevisionData } from "./case"

const T1 = "2026-01-01T00:00:00.000Z"
const T2 = "2026-01-02T00:00:00.000Z"
const T3 = "2026-01-03T00:00:00.000Z"
const T4 = "2026-01-04T00:00:00.000Z"

describe("customer onboarding case lifecycle", () => {
  it("creates a draft case with revision 1", () => {
    const onboardingCase = createCase("REQ-00124", T1, "user-a")
    expect(onboardingCase.status).toBe("draft")
    expect(onboardingCase.currentStageKey).toBe("customer_details")
    expect(onboardingCase.currentRevision.revisionNumber).toBe(1)
    expect(onboardingCase.currentRevision.status).toBe("draft")
    expect(onboardingCase.currentRevision.createdBy).toBe("user-a")
    expect(onboardingCase.currentRevision.data).toEqual({})
  })

  it("records which stage the submitter is currently working in", () => {
    const onboardingCase = createCase("REQ-00124", T1, "user-a")
    const onTaxStage = setCurrentStage(onboardingCase, "tax_registration")
    expect(onTaxStage.currentStageKey).toBe("tax_registration")
    expect(onboardingCase.currentStageKey).toBe("customer_details")
  })

  it("saves a draft with incomplete data (Save Draft is always allowed)", () => {
    const onboardingCase = createCase("REQ-00124", T1, "user-a")
    const updated = updateRevisionData(
      onboardingCase,
      { customer_legal_entity_name: "Northwind Fictional Retail Group" },
      T2,
      "user-a"
    )
    expect(updated.currentRevision.data).toEqual({ customer_legal_entity_name: "Northwind Fictional Retail Group" })
    expect(updated.status).toBe("draft")
  })

  it("never mutates the previous case object when updating draft data", () => {
    const original = createCase("REQ-00124", T1, "user-a")
    const updated = updateRevisionData(original, { country: "IN" }, T2, "user-a")
    expect(original.currentRevision.data).toEqual({})
    expect(updated).not.toBe(original)
  })

  it("submits a draft revision, setting case status to submitted", () => {
    const draft = updateRevisionData(createCase("REQ-00124", T1, "user-a"), { country: "IN" }, T2, "user-a")
    const submitted = submitCase(draft, T3, "user-a")
    expect(submitted.status).toBe("submitted")
    expect(submitted.currentRevision.status).toBe("submitted")
    expect(submitted.currentRevision.submittedBy).toBe("user-a")
    expect(submitted.currentRevision.submittedAt).toBe(T3)
  })

  it("rejects editing a revision that has already been submitted", () => {
    const submitted = submitCase(createCase("REQ-00124", T1, "user-a"), T2, "user-a")
    expect(() => updateRevisionData(submitted, { country: "SG" }, T3, "user-a")).toThrow()
    // the rejected attempt leaves the submitted revision's data untouched
    expect(submitted.currentRevision.data).toEqual({})
  })

  it("rejects submitting a revision that is not a draft", () => {
    const submitted = submitCase(createCase("REQ-00124", T1, "user-a"), T2, "user-a")
    expect(() => submitCase(submitted, T3, "user-a")).toThrow()
  })

  it("sends back a submitted case without touching the submitted revision", () => {
    const submitted = submitCase(
      updateRevisionData(createCase("REQ-00124", T1, "user-a"), { gst_number: "29AAAAA0000A1Z1" }, T2, "user-a"),
      T3,
      "user-a"
    )
    const sentBack = sendBackCase(submitted, "Please upload a clearer GST certificate", "user-b", T4, "tax_registration")
    expect(sentBack.status).toBe("sent_back")
    expect(sentBack.sentBack).toEqual({
      reason: "Please upload a clearer GST certificate",
      sentBackBy: "user-b",
      sentBackAt: T4,
      targetStageKey: "tax_registration",
    })
    // revision 1 is exactly as it was submitted
    expect(sentBack.currentRevision.revisionNumber).toBe(1)
    expect(sentBack.currentRevision.status).toBe("submitted")
    expect(sentBack.currentRevision.data).toEqual({ gst_number: "29AAAAA0000A1Z1" })
  })

  it("rejects sending back a case that was never submitted", () => {
    const draft = createCase("REQ-00124", T1, "user-a")
    expect(() => sendBackCase(draft, "reason", "user-b", T2, null)).toThrow()
  })

  it("starts a new revision after send-back, copying data forward without mutating revision 1", () => {
    const submitted = submitCase(
      updateRevisionData(createCase("REQ-00124", T1, "user-a"), { pan: "ABCDE1234F" }, T2, "user-a"),
      T3,
      "user-a"
    )
    const sentBack = sendBackCase(submitted, "reason", "user-b", T4, null)
    const nextRevision = startNextRevision(sentBack, "2026-01-05T00:00:00.000Z", "user-b")

    expect(nextRevision.currentRevision.revisionNumber).toBe(2)
    expect(nextRevision.currentRevision.status).toBe("draft")
    expect(nextRevision.currentRevision.data).toEqual({ pan: "ABCDE1234F" })
    expect(nextRevision.currentRevision.createdBy).toBe("user-b")
    // the case status stays sent_back until the new revision is actually resubmitted
    expect(nextRevision.status).toBe("sent_back")
  })

  it("rejects starting a new revision on a case that was never sent back", () => {
    const submitted = submitCase(createCase("REQ-00124", T1, "user-a"), T2, "user-a")
    expect(() => startNextRevision(submitted, T3, "user-b")).toThrow()
  })

  it("distinguishes a first submission from a resubmission after review", () => {
    const submitted = submitCase(createCase("REQ-00124", T1, "user-a"), T2, "user-a")
    const sentBack = sendBackCase(submitted, "reason", "user-b", T3, null)
    const editing = updateRevisionData(startNextRevision(sentBack, T4, "user-b"), { pan: "ABCDE1234F" }, T4, "user-b")
    const resubmitted = submitCase(editing, "2026-01-05T00:00:00.000Z", "user-b")

    expect(resubmitted.status).toBe("resubmitted")
    expect(resubmitted.currentRevision.revisionNumber).toBe(2)
    expect(resubmitted.currentRevision.submittedBy).toBe("user-b")
  })

  it("approves a submitted case", () => {
    const submitted = submitCase(createCase("REQ-00124", T1, "user-a"), T2, "user-a")
    const approved = approveCase(submitted, "user-c", T3)
    expect(approved.status).toBe("approved")
    expect(approved.approvedBy).toBe("user-c")
    expect(approved.approvedAt).toBe(T3)
  })

  it("approves a resubmitted case", () => {
    const submitted = submitCase(createCase("REQ-00124", T1, "user-a"), T2, "user-a")
    const sentBack = sendBackCase(submitted, "reason", "user-b", T3, null)
    const resubmitted = submitCase(startNextRevision(sentBack, T4, "user-b"), "2026-01-05T00:00:00.000Z", "user-b")
    const approved = approveCase(resubmitted, "user-c", "2026-01-06T00:00:00.000Z")
    expect(approved.status).toBe("approved")
  })

  it("rejects approving a draft case", () => {
    const draft = createCase("REQ-00124", T1, "user-a")
    expect(() => approveCase(draft, "user-c", T2)).toThrow()
  })

  it("rejects approving a case that has been sent back but not yet resubmitted", () => {
    const submitted = submitCase(createCase("REQ-00124", T1, "user-a"), T2, "user-a")
    const sentBack = sendBackCase(submitted, "reason", "user-b", T3, null)
    expect(() => approveCase(sentBack, "user-c", T4)).toThrow()
  })
})
