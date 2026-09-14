import { describe, expect, it } from "vitest"

import { toGovernedFieldDto } from "./api-dto"
import { emptySnapshot } from "./snapshot"
import type { ReferenceMasterSnapshot } from "./types"

describe("toGovernedFieldDto", () => {
  it("is null for a genuinely absent code", () => {
    expect(toGovernedFieldDto(emptySnapshot(), "segment", null)).toBeNull()
  })

  it("resolves a known code to its current label", () => {
    const snapshot: ReferenceMasterSnapshot = { ...emptySnapshot(), segment: [{ value: "enterprise", label: "Enterprise", active: true }] }
    expect(toGovernedFieldDto(snapshot, "segment", "enterprise")).toEqual({ code: "enterprise", label: "Enterprise" })
  })

  it("falls back to the raw code, never null, when the code is no longer a valid option (task spec: never blank a historical value)", () => {
    expect(toGovernedFieldDto(emptySnapshot(), "segment", "retired_segment")).toEqual({ code: "retired_segment", label: "retired_segment" })
  })
})
