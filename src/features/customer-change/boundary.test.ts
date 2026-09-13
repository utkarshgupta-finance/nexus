import { describe, expect, it } from "vitest"

/**
 * Same proof as every other feature's boundary.test.ts in this repo
 * (src/features/customer-onboarding/boundary.test.ts and similar): the
 * public barrel (./index.ts) must never touch the service-role-backed
 * change request service, and ./server.ts must genuinely throw the
 * server-only guard outside a server context, not merely be documented
 * as server-only.
 */

describe("customer-change feature public/server boundary", () => {
  it("importing the public barrel (./index.ts) does not throw the server-only guard", async () => {
    await expect(import("./index")).resolves.toBeDefined()
  })

  it("the public barrel does not re-export loadChangeRequest, previewRequirements, or any data-layer function", async () => {
    const publicSurface = await import("./index")
    const exportedValues = Object.keys(publicSurface)
    for (const name of exportedValues) {
      expect(name).not.toMatch(/^(loadChangeRequest|previewRequirements|createChangeRequest|saveChangeDraft|submitChangeRequest|sendBackChangeRequest|rejectChangeRequest|approveChangeRequest)$/)
    }
  })

  it("./server.ts still throws the server-only guard in a non-server-component context", async () => {
    await expect(import("./server")).rejects.toThrow(/Client Component/)
  })
})
