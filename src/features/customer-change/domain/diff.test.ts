import { describe, expect, it } from "vitest"

import { buildFieldDiff } from "./diff"

describe("buildFieldDiff", () => {
  it("includes only fields present in proposedValues, marking each changed or unchanged", () => {
    const current = { segment: "sme", business_unit: "sme", name: "Acme Pvt Ltd" }
    const proposed = { segment: "enterprise", business_unit: "sme" }

    const rows = buildFieldDiff(current, proposed)

    expect(rows).toHaveLength(2)
    const segmentRow = rows.find((row) => row.key === "segment")
    expect(segmentRow).toEqual({ key: "segment", label: "Segment", current: "sme", proposed: "enterprise", changed: true })
    const buRow = rows.find((row) => row.key === "business_unit")
    expect(buRow).toEqual({ key: "business_unit", label: "Business Unit", current: "sme", proposed: "sme", changed: false })
    expect(rows.find((row) => row.key === "name")).toBeUndefined()
  })

  it("treats a null current value as null, not as a missing row", () => {
    const rows = buildFieldDiff({}, { brand_name: "Aurora" })
    expect(rows).toEqual([{ key: "brand_name", label: "Brand Name", current: null, proposed: "Aurora", changed: true }])
  })

  it("returns an empty list when nothing is proposed", () => {
    expect(buildFieldDiff({ segment: "sme" }, {})).toEqual([])
  })
})
