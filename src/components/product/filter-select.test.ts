import { describe, expect, it } from "vitest"

import { resolveFilterLabel } from "./filter-select"

describe("resolveFilterLabel (Platform Operating Expansion, Phase F)", () => {
  const options = [
    { value: "enterprise", label: "Enterprise" },
    { value: "smb", label: "SMB" },
  ]

  it("shows the given All label for the sentinel value, never the raw sentinel string", () => {
    expect(resolveFilterLabel("__all__", options, "__all__", "All segments")).toBe("All segments")
  })

  it("shows the matching option's label for a real value", () => {
    expect(resolveFilterLabel("smb", options, "__all__", "All segments")).toBe("SMB")
  })

  it("falls back to the raw value only for a value with no matching option, never the sentinel itself in that case", () => {
    expect(resolveFilterLabel("unknown-code", options, "__all__", "All segments")).toBe("unknown-code")
  })
})
