import { describe, expect, it } from "vitest"

import { classifyPricingRecognition } from "./pricing-classification"

describe("classifyPricingRecognition", () => {
  it("Per Unit (linear) and Flat Fee (flat) are AUTO_FINALIZABLE", () => {
    expect(classifyPricingRecognition("linear")).toBe("AUTO_FINALIZABLE")
    expect(classifyPricingRecognition("flat")).toBe("AUTO_FINALIZABLE")
  })

  it("Slab (volume), Progressive Slab (graduated), and Designation-based (dimension) all REQUIRE MRR Recognition", () => {
    expect(classifyPricingRecognition("volume")).toBe("REQUIRES_MRR_RECOGNITION")
    expect(classifyPricingRecognition("graduated")).toBe("REQUIRES_MRR_RECOGNITION")
    expect(classifyPricingRecognition("dimension")).toBe("REQUIRES_MRR_RECOGNITION")
  })
})
