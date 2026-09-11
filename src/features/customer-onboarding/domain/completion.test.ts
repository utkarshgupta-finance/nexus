import { describe, expect, it } from "vitest"

import { isEligibleForCompletion } from "./completion"

describe("Customer Onboarding completion gate (task spec §25)", () => {
  it("is not eligible for completion with neither a Signed Agreement nor Legal Approval", () => {
    expect(isEligibleForCompletion({ hasSignedAgreement: false, legalApprovalComplete: false })).toBe(false)
  })

  it("is not eligible with only a Signed Agreement attached", () => {
    expect(isEligibleForCompletion({ hasSignedAgreement: true, legalApprovalComplete: false })).toBe(false)
  })

  it("is not eligible with only Legal Approval complete", () => {
    expect(isEligibleForCompletion({ hasSignedAgreement: false, legalApprovalComplete: true })).toBe(false)
  })

  it("is eligible only once both a Signed Agreement and Legal Approval are true", () => {
    expect(isEligibleForCompletion({ hasSignedAgreement: true, legalApprovalComplete: true })).toBe(true)
  })
})
