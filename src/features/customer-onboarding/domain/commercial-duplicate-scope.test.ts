import { describe, expect, it } from "vitest"

import { findDuplicateScopeMatches } from "./commercial-duplicate-scope"
import { createComponent } from "./commercial-rate"

describe("findDuplicateScopeMatches (PG-044)", () => {
  it("flags two per_unit components sharing the same rate and unit", () => {
    const a = { ...createComponent("recurring", "per_unit"), id: "a", description: "Storage", rate: 5, pricingUnit: "GB" }
    const b = { ...createComponent("recurring", "per_unit"), id: "b", description: "Storage (duplicate)", rate: 5, pricingUnit: "GB" }
    const matches = findDuplicateScopeMatches([a, b])
    expect(matches).toHaveLength(1)
    expect(matches[0].componentIds.sort()).toEqual(["a", "b"])
  })

  it("does not flag two per_unit components with different rates", () => {
    const a = { ...createComponent("recurring", "per_unit"), id: "a", rate: 5, pricingUnit: "GB" }
    const b = { ...createComponent("recurring", "per_unit"), id: "b", rate: 10, pricingUnit: "GB" }
    expect(findDuplicateScopeMatches([a, b])).toEqual([])
  })

  it("does not flag components with different pricing models even if other fields coincide", () => {
    const a = { ...createComponent("recurring", "per_unit"), id: "a", rate: 5, pricingUnit: "GB" }
    const b = { ...createComponent("recurring", "flat_fee"), id: "b", amount: 5 }
    expect(findDuplicateScopeMatches([a, b])).toEqual([])
  })

  it("flags designation-based components with the same rows regardless of row order", () => {
    const a = {
      ...createComponent("recurring", "designation_based"),
      id: "a",
      designationRows: [
        { id: "1", designation: "Manager", rate: 100, per: "USER" },
        { id: "2", designation: "Director", rate: 200, per: "USER" },
      ],
    }
    const b = {
      ...createComponent("recurring", "designation_based"),
      id: "b",
      designationRows: [
        { id: "3", designation: "Director", rate: 200, per: "USER" },
        { id: "4", designation: "Manager", rate: 100, per: "USER" },
      ],
    }
    const matches = findDuplicateScopeMatches([a, b])
    expect(matches).toHaveLength(1)
  })

  it("is a no-op for a single component or an empty list", () => {
    const solo = createComponent("recurring", "per_unit")
    expect(findDuplicateScopeMatches([solo])).toEqual([])
    expect(findDuplicateScopeMatches([])).toEqual([])
  })

  it("groups three-way duplicates into one match, not three pairs", () => {
    const make = (id: string) => ({ ...createComponent("recurring", "flat_fee"), id, amount: 1000 })
    const matches = findDuplicateScopeMatches([make("a"), make("b"), make("c")])
    expect(matches).toHaveLength(1)
    expect(matches[0].componentIds.sort()).toEqual(["a", "b", "c"])
  })
})
