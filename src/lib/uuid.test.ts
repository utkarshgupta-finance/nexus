import { describe, expect, it } from "vitest"

import { isValidUuid } from "./uuid"

describe("isValidUuid (S-013)", () => {
  it("accepts a genuine, well-formed UUID", () => {
    expect(isValidUuid("95838de6-57f9-4493-b378-d9f472bfa7ae")).toBe(true)
  })

  it("accepts a well-formed UUID regardless of case", () => {
    expect(isValidUuid("95838DE6-57F9-4493-B378-D9F472BFA7AE")).toBe(true)
  })

  it("rejects a completely malformed string", () => {
    expect(isValidUuid("not-a-valid-uuid")).toBe(false)
  })

  it("rejects an empty string", () => {
    expect(isValidUuid("")).toBe(false)
  })

  it("rejects a UUID-shaped string with an invalid character", () => {
    expect(isValidUuid("95838de6-57f9-4493-b378-d9f472bfa7az")).toBe(false)
  })

  it("rejects a UUID missing a segment", () => {
    expect(isValidUuid("95838de6-57f9-4493-d9f472bfa7ae")).toBe(false)
  })
})
