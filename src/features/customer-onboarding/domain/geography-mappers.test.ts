import { describe, expect, it } from "vitest"

import { filterCityOptions, toStateOptions } from "./geography-mappers"

describe("toStateOptions", () => {
  it("maps raw state rows to value/label options sorted by label", () => {
    const options = toStateOptions([
      { name: "Uttar Pradesh", state_code: "UP" },
      { name: "Maharashtra", state_code: "MH" },
    ])
    expect(options).toEqual([
      { value: "MH", label: "Maharashtra" },
      { value: "UP", label: "Uttar Pradesh" },
    ])
  })

  it("returns an empty list for a country with no states in the dataset", () => {
    expect(toStateOptions([])).toEqual([])
  })

  it("skips a subdivision with no stable code rather than inventing one", () => {
    const options = toStateOptions([
      { name: "Maharashtra", state_code: "MH" },
      { name: "Some District", state_code: null },
    ])
    expect(options).toEqual([{ value: "MH", label: "Maharashtra" }])
  })
})

describe("filterCityOptions", () => {
  const cities = [
    { id: 1, name: "Springfield" },
    { id: 2, name: "Spring Valley" },
    { id: 3, name: "Mumbai" },
    { id: 4, name: "Springdale" },
  ]

  it("returns every city when there is no search text, paginated", () => {
    const result = filterCityOptions(cities, "", 0, 10)
    expect(result.totalCount).toBe(4)
    expect(result.items.length).toBe(4)
  })

  it("filters by a case-insensitive substring match", () => {
    const result = filterCityOptions(cities, "spring", 0, 10)
    expect(result.totalCount).toBe(3)
    expect(result.items.map((item) => item.label)).toEqual(["Spring Valley", "Springdale", "Springfield"])
  })

  it("uses the numeric city id as the stable value, not the name", () => {
    const result = filterCityOptions(cities, "mumbai", 0, 10)
    expect(result.items).toEqual([{ value: "3", label: "Mumbai" }])
  })

  it("paginates via skip/take without ever returning more than take items", () => {
    const page1 = filterCityOptions(cities, "", 0, 2)
    const page2 = filterCityOptions(cities, "", 2, 2)
    expect(page1.items.length).toBe(2)
    expect(page2.items.length).toBe(2)
    expect(page1.totalCount).toBe(4)
    expect(page2.totalCount).toBe(4)
    expect(page1.items).not.toEqual(page2.items)
  })

  it("returns no matches for a search string that matches nothing", () => {
    const result = filterCityOptions(cities, "zzzzz", 0, 10)
    expect(result.items).toEqual([])
    expect(result.totalCount).toBe(0)
  })
})
