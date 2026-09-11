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
  it("marks stages before the current one completed and stages after it upcoming", () => {
    const stages = toProcessJourneyStages("commercial_documents")
    expect(stages.find((stage) => stage.id === "customer_details")?.state).toBe("completed")
    expect(stages.find((stage) => stage.id === "tax_registration")?.state).toBe("completed")
    expect(stages.find((stage) => stage.id === "commercial_documents")?.state).toBe("current")
    expect(stages.find((stage) => stage.id === "commercial_rate")?.state).toBe("upcoming")
    expect(stages.find((stage) => stage.id === "agreement_approval")?.state).toBe("upcoming")
  })
})
