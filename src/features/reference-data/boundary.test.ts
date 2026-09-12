import { describe, expect, it } from "vitest"

/**
 * Same proof as src/features/commercial/boundary.test.ts and
 * src/features/customers/boundary.test.ts: the public barrel (./index.ts)
 * must never touch the server-only Supabase client or re-export a write
 * path, and ./server.ts must genuinely throw the server-only guard
 * outside a server context, not merely be documented as server-only.
 */

describe("reference-data feature public/server boundary", () => {
  it("importing the public barrel (./index.ts) does not throw the server-only guard", async () => {
    await expect(import("./index")).resolves.toBeDefined()
  })

  it("the public barrel does not re-export any write or snapshot-loading function", async () => {
    const publicSurface = await import("./index")
    const exportedValues = Object.keys(publicSurface)

    expect(exportedValues.length).toBeGreaterThan(0)
    for (const name of exportedValues) {
      expect(name).not.toMatch(
        /^(loadReferenceMasterSnapshot|addReferenceOption|setReferenceOptionActive|updateCurrencyInrConversionRate|updateInvoiceFrequencyCadence)$/
      )
    }
  })

  it("./server.ts still throws the server-only guard in a non-server-component context", async () => {
    await expect(import("./server")).rejects.toThrow(/Client Component/)
  })

  it("./actions.ts transitively hits the same server-only guard (it imports ./server.ts), so its Server Actions cannot run outside a server context either", async () => {
    await expect(import("./actions")).rejects.toThrow(/Client Component/)
  })
})
