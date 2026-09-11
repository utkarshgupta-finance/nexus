import { describe, expect, it } from "vitest"

import { CUSTOMER_ONBOARDING_STAGES, toProcessJourneyStages } from "./process"

describe("Customer Onboarding stage order", () => {
  it("lists all five V1 stages in the required business order", () => {
    expect(CUSTOMER_ONBOARDING_STAGES.map((stage) => stage.key)).toEqual([
      "customer_details",
      "tax_registration",
      "commercial_documents",
      "commercial_rate",
      "agreement_approval",
    ])
  })

  it("names every stage for the information it collects, never a department or role", () => {
    const labels = CUSTOMER_ONBOARDING_STAGES.map((stage) => stage.label)
    expect(labels).toEqual([
      "Customer Details",
      "Tax & Registration",
      "Commercial Documents",
      "Commercial Rate",
      "Agreement & Approval",
    ])
    for (const forbidden of ["Sales", "Finance", "Legal"]) {
      expect(labels.some((label) => label.includes(forbidden))).toBe(false)
    }
  })

  it("marks every V1 stage available", () => {
    expect(CUSTOMER_ONBOARDING_STAGES.every((stage) => stage.available)).toBe(true)
  })

  it("orders stages 1 through 5 with no gaps", () => {
    expect(CUSTOMER_ONBOARDING_STAGES.map((stage) => stage.order)).toEqual([1, 2, 3, 4, 5])
  })
})

describe("toProcessJourneyStages", () => {
  const ALL_COMPLETE: Record<string, "not_started" | "attention" | "complete"> = {
    customer_details: "complete",
    tax_registration: "complete",
    commercial_documents: "complete",
    commercial_rate: "complete",
    agreement_approval: "complete",
  }

  it("takes each stage's state from the supplied statuses map, never from stage order", () => {
    const statuses = {
      customer_details: "attention" as const,
      tax_registration: "not_started" as const,
      commercial_documents: "complete" as const,
      commercial_rate: "not_started" as const,
      agreement_approval: "not_started" as const,
    }
    const stages = toProcessJourneyStages("commercial_documents", statuses)
    expect(stages.find((stage) => stage.id === "customer_details")?.state).toBe("attention")
    expect(stages.find((stage) => stage.id === "tax_registration")?.state).toBe("not_started")
    expect(stages.find((stage) => stage.id === "commercial_documents")?.state).toBe("complete")
    expect(stages.find((stage) => stage.id === "commercial_rate")?.state).toBe("not_started")
    expect(stages.find((stage) => stage.id === "agreement_approval")?.state).toBe("not_started")
  })

  it("marks only the current stage as current, independent of its completeness", () => {
    const stages = toProcessJourneyStages("tax_registration", ALL_COMPLETE)
    expect(stages.find((stage) => stage.id === "tax_registration")?.isCurrent).toBe(true)
    expect(stages.find((stage) => stage.id === "customer_details")?.isCurrent).toBeFalsy()
    expect(stages.find((stage) => stage.id === "commercial_rate")?.isCurrent).toBeFalsy()
    // Completeness is unaffected by which stage is current (the bug this replaces).
    expect(stages.find((stage) => stage.id === "tax_registration")?.state).toBe("complete")
  })
})
