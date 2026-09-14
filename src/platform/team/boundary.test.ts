import { describe, expect, it } from "vitest"

/**
 * Same proof as every other platform capability's boundary.test.ts in
 * this repo (../permissions/boundary.test.ts, ../user-access/boundary.test.ts):
 * ./server.ts and ./actions.ts must genuinely throw the server-only
 * guard outside a server context, not merely be documented as
 * server-only.
 */

describe("platform/team server boundary", () => {
  it("./server.ts still throws the server-only guard in a non-server-component context", async () => {
    await expect(import("./server")).rejects.toThrow(/Client Component/)
  })

  it("./actions.ts still throws the server-only guard in a non-server-component context", async () => {
    await expect(import("./actions")).rejects.toThrow(/Client Component/)
  })
})
