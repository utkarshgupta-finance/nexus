import { describe, expect, it } from "vitest"

/**
 * Proves the client/server split actually holds, rather than just
 * asserting it in a comment: importing the public barrel (./index.ts)
 * must never touch the server-only Supabase client, so it must never
 * throw the `server-only` package's "cannot be imported from a Client
 * Component" error. vitest runs in a plain Node/Vite environment, the
 * same non-server-component context `server-only` is designed to reject
 * imports from, so if ./index.ts (or anything it re-exports as a value,
 * not just a type) ever gained a transitive service/data import, this
 * test would start failing exactly the way component-detail.test.ts and
 * configuration-overview-helpers.test.ts once did before that logic was
 * split out of the read-model files.
 */

describe("commercial feature public/server boundary", () => {
  it("importing the public barrel (./index.ts) does not throw the server-only guard", async () => {
    await expect(import("./index")).resolves.toBeDefined()
  })

  it("the public barrel does not re-export any service or read-model function", async () => {
    const publicSurface = await import("./index")
    const exportedValues = Object.keys(publicSurface)

    // Type-only exports (domain types, CommitmentSummary, etc.) leave no
    // runtime trace at all, so this is only ever CommercialOperationError
    // plus the pure label functions re-exported from ./domain/labels.
    // None of those import Supabase; confirmed by the first test above
    // already succeeding. What this assertion additionally proves: none
    // of the *service or read-model* runtime exports (which do touch
    // Supabase) have leaked in, by name pattern.
    expect(exportedValues.length).toBeGreaterThan(0)
    for (const name of exportedValues) {
      expect(name).not.toMatch(/Service$/)
      expect(name).not.toMatch(/^get(CommercialConfigurationOverview|CommercialComponentDetail|FinanceActivity)$/)
    }
  })

  it("./server.ts still throws the server-only guard in a non-server-component context", async () => {
    // This is the control case: proves the guard is genuinely active for
    // the module that needs it, not merely absent everywhere due to a
    // vitest/environment quirk that would make the first assertion above
    // meaningless.
    await expect(import("./server")).rejects.toThrow(/Client Component/)
  })
})
