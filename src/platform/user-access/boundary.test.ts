import { describe, expect, it } from "vitest"

/**
 * Same proof as every other platform capability's boundary.test.ts in
 * this repo (../permissions/boundary.test.ts and similar): ./server.ts
 * must genuinely throw the server-only guard outside a server context,
 * not merely be documented as server-only. This module has no separate
 * client-safe public barrel (unlike a feature's index.ts): the one
 * client component here (./ui/user-access-page.tsx) only ever imports
 * types from ./domain/user-access.ts (no server-only guard) and
 * type-only from ./services/user-access.service.ts (erased at compile
 * time, never pulling in the runtime module or its guard).
 */

describe("platform/user-access server boundary", () => {
  it("./server.ts still throws the server-only guard in a non-server-component context", async () => {
    await expect(import("./server")).rejects.toThrow(/Client Component/)
  })

  it("./actions.ts still throws the server-only guard in a non-server-component context", async () => {
    await expect(import("./actions")).rejects.toThrow(/Client Component/)
  })
})
