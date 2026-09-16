import { describe, expect, it } from "vitest"

import { sanitizeRedirectTarget } from "./redirect-target"

describe("sanitizeRedirectTarget", () => {
  it("passes through a genuine relative path", () => {
    expect(sanitizeRedirectTarget("/customers")).toBe("/customers")
    expect(sanitizeRedirectTarget("/customers?filter=active&sort=name")).toBe("/customers?filter=active&sort=name")
    expect(sanitizeRedirectTarget("/customers/test-customer-1/change-requests/abc")).toBe(
      "/customers/test-customer-1/change-requests/abc"
    )
  })

  it("falls back to /my-work when missing", () => {
    expect(sanitizeRedirectTarget(undefined)).toBe("/my-work")
    expect(sanitizeRedirectTarget(null)).toBe("/my-work")
    expect(sanitizeRedirectTarget("")).toBe("/my-work")
  })

  it("rejects a protocol-relative redirect (open redirect attempt)", () => {
    expect(sanitizeRedirectTarget("//evil.example")).toBe("/my-work")
  })

  it("rejects a backslash-disguised protocol-relative redirect", () => {
    expect(sanitizeRedirectTarget("/\\evil.example")).toBe("/my-work")
  })

  it("rejects an absolute URL redirect", () => {
    expect(sanitizeRedirectTarget("https://evil.example")).toBe("/my-work")
    expect(sanitizeRedirectTarget("javascript://evil")).toBe("/my-work")
  })

  it("rejects a path that does not start with a slash", () => {
    expect(sanitizeRedirectTarget("evil.example")).toBe("/my-work")
  })
})
