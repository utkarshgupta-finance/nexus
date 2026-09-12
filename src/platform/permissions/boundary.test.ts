import { describe, expect, it } from "vitest"

/**
 * Same proof as ../auth/boundary.test.ts: the public barrel exposes only
 * the pure, session-safe pieces (`sessionHasPermission`,
 * `AuthorizationError`), and ./server.ts (which transitively imports
 * ../auth/server.ts) genuinely throws the server-only guard, so
 * `hasPermission`/`requirePermission` can never run outside a real
 * server context either.
 */

describe("platform/permissions public/server boundary", () => {
  it("importing the public barrel (./index.ts) does not throw the server-only guard", async () => {
    await expect(import("./index")).resolves.toBeDefined()
  })

  it("the public barrel does not re-export hasPermission or requirePermission", async () => {
    const publicSurface = await import("./index")
    const exportedValues = Object.keys(publicSurface)
    for (const name of exportedValues) {
      expect(name).not.toMatch(/^(hasPermission|requirePermission)$/)
    }
  })

  it("./server.ts still throws the server-only guard in a non-server-component context", async () => {
    await expect(import("./server")).rejects.toThrow(/Client Component/)
  })
})
