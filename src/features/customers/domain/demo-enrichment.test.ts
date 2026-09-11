import { describe, expect, it } from "vitest"

import { DEMO_CUSTOMER_ENRICHMENT, DEMO_CUSTOMER_KEY } from "./demo-enrichment"

describe("demo customer enrichment", () => {
  it("uses a stable key as identity, not a mutable field like legal entity name", () => {
    expect(DEMO_CUSTOMER_ENRICHMENT.customerKey).toBe(DEMO_CUSTOMER_KEY)
    expect(DEMO_CUSTOMER_KEY).not.toContain("Northstar")
  })

  it("always marks itself as demo, never presentable as backend truth", () => {
    expect(DEMO_CUSTOMER_ENRICHMENT.source).toBe("demo")
  })

  it("uses only clearly synthetic tax identifiers", () => {
    expect(DEMO_CUSTOMER_ENRICHMENT.pan).toBe("AAAAA0000A")
    expect(DEMO_CUSTOMER_ENRICHMENT.tan).toBe("BLRA00000A")
    expect(DEMO_CUSTOMER_ENRICHMENT.gstin).toBe("29AAAAA0000A1Z5")
  })

  it("uses a demo contact at example.com, never a real address", () => {
    expect(DEMO_CUSTOMER_ENRICHMENT.primaryContactEmail).toBe("demo@example.com")
  })

  it("references real Reference Master codes for every governed field", () => {
    expect(DEMO_CUSTOMER_ENRICHMENT.countryCode).toBe("IN")
    expect(DEMO_CUSTOMER_ENRICHMENT.industryValue).toBe("fmcg")
    expect(DEMO_CUSTOMER_ENRICHMENT.segmentValue).toBe("enterprise")
    expect(DEMO_CUSTOMER_ENRICHMENT.businessUnitValue).toBe("india_enterprise")
    expect(DEMO_CUSTOMER_ENRICHMENT.billingCurrencyCode).toBe("INR")
  })
})
