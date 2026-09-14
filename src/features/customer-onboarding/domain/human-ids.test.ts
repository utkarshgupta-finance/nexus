import { describe, expect, it } from "vitest"

import { formatOnboardingCaseId } from "./types"
import { formatCommercialVersionId } from "./commercial-version-types"

describe("Human-Friendly IDs (task Phase L)", () => {
  it("formats a Customer Onboarding case number as CO-000123", () => {
    expect(formatOnboardingCaseId(123)).toBe("CO-000123")
  })

  it("formats a Commercial Configuration Version number as CC-000078", () => {
    expect(formatCommercialVersionId(78)).toBe("CC-000078")
  })

  it("never truncates a number wider than the padded width", () => {
    expect(formatOnboardingCaseId(1234567)).toBe("CO-1234567")
  })
})
