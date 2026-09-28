import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

const searchFieldHistoryByOldValue = vi.fn()

vi.mock("../data/change-request.data", () => ({
  searchFieldHistoryByOldValue: (...args: unknown[]) => searchFieldHistoryByOldValue(...args),
}))

import { searchFormerCustomerNames } from "./change-request.service"

/**
 * PG-053 (B-007, Batch 8): when a customer's historical names share
 * overlapping substrings, `searchFormerCustomerNames` used to keep only the
 * first (most-recent) row per customer, which could show a less-specific
 * historical name than the one that actually matched the search term. Fixed
 * to prefer the best-matching (closest length, or exact) historical name per
 * customer instead.
 */
describe("searchFormerCustomerNames (PG-053)", () => {
  it("prefers the historical name that most specifically matches the search term over the most-recent one", async () => {
    // Rows arrive most-recent-first, as the real query orders them.
    searchFieldHistoryByOldValue.mockResolvedValue([
      { customer_id: "cust-1", field_key: "name", old_value: "Acme Global India", changed_at: "2026-03-01T00:00:00Z" },
      { customer_id: "cust-1", field_key: "name", old_value: "Acme Global", changed_at: "2026-01-01T00:00:00Z" },
      { customer_id: "cust-1", field_key: "name", old_value: "Acme", changed_at: "2025-01-01T00:00:00Z" },
    ])

    const results = await searchFormerCustomerNames("Acme")

    expect(results).toHaveLength(1)
    expect(results[0].oldValue).toBe("Acme")
  })

  it("still returns the exact match even when it is not the most recent row", async () => {
    searchFieldHistoryByOldValue.mockResolvedValue([
      { customer_id: "cust-1", field_key: "name", old_value: "Northstar Global", changed_at: "2026-03-01T00:00:00Z" },
      { customer_id: "cust-1", field_key: "brand_name", old_value: "Northstar", changed_at: "2026-01-01T00:00:00Z" },
    ])

    const results = await searchFormerCustomerNames("Northstar")

    expect(results).toHaveLength(1)
    expect(results[0].oldValue).toBe("Northstar")
  })

  it("keeps the most recent match when specificity is tied (preserves prior tiebreak)", async () => {
    searchFieldHistoryByOldValue.mockResolvedValue([
      { customer_id: "cust-1", field_key: "name", old_value: "Acme Corp", changed_at: "2026-03-01T00:00:00Z" },
      { customer_id: "cust-1", field_key: "brand_name", old_value: "Acme Inc.", changed_at: "2026-01-01T00:00:00Z" },
    ])

    const results = await searchFormerCustomerNames("Acme")

    expect(results).toHaveLength(1)
    expect(results[0].oldValue).toBe("Acme Corp")
  })

  it("returns one entry per distinct customer, unaffected by the specificity change", async () => {
    searchFieldHistoryByOldValue.mockResolvedValue([
      { customer_id: "cust-1", field_key: "name", old_value: "Acme Global", changed_at: "2026-01-01T00:00:00Z" },
      { customer_id: "cust-2", field_key: "name", old_value: "Acme Traders", changed_at: "2025-06-01T00:00:00Z" },
    ])

    const results = await searchFormerCustomerNames("Acme")

    expect(results.map((r) => r.customerId).sort()).toEqual(["cust-1", "cust-2"])
  })

  it("returns an empty array for a blank search term without querying", async () => {
    const results = await searchFormerCustomerNames("   ")
    expect(results).toEqual([])
    expect(searchFieldHistoryByOldValue).not.toHaveBeenCalled()
  })
})
