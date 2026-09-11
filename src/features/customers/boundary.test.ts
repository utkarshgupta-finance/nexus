import { describe, expect, it } from "vitest"

/**
 * Same proof as src/features/commercial/boundary.test.ts: the public
 * barrel (./index.ts) must never touch the server-only Supabase client,
 * and must never re-export a write path. Customer Master has no
 * governed-field mutation function anywhere in this feature except
 * `insertCustomer` (data/customers.data.ts, used only by
 * scripts/seed-demo-customer.ts): this test proves the public,
 * client-safe surface exposes none of it, matching the task's "no
 * unrestricted direct editing" requirement structurally, not just by
 * convention.
 */

describe("customers feature public/server boundary", () => {
  it("importing the public barrel (./index.ts) does not throw the server-only guard", async () => {
    await expect(import("./index")).resolves.toBeDefined()
  })

  it("the public barrel does not re-export any read model, data, or mutation function", async () => {
    const publicSurface = await import("./index")
    const exportedValues = Object.keys(publicSurface)

    expect(exportedValues.length).toBeGreaterThan(0)
    for (const name of exportedValues) {
      expect(name).not.toMatch(/^(insertCustomer|getCustomerByKey|listCustomers|listCustomerMaster|getCustomerMasterDetailByKey)$/)
    }
  })

  it("./server.ts still throws the server-only guard in a non-server-component context", async () => {
    await expect(import("./server")).rejects.toThrow(/Client Component/)
  })
})
