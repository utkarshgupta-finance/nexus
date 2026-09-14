import { describe, expect, it } from "vitest"

import { codeForDenialReason, httpStatusForCode } from "./status"

describe("codeForDenialReason", () => {
  it("maps every authorization denial reason to its own distinct error code, never a collapsed generic one", () => {
    expect(codeForDenialReason("unauthenticated")).toBe("AUTH_REQUIRED")
    expect(codeForDenialReason("unavailable")).toBe("DATABASE_UNAVAILABLE")
    expect(codeForDenialReason("unprovisioned")).toBe("AUTH_UNPROVISIONED")
    expect(codeForDenialReason("inactive")).toBe("AUTH_INACTIVE")
    expect(codeForDenialReason("missing_permission")).toBe("AUTH_PERMISSION_DENIED")
  })
})

describe("httpStatusForCode", () => {
  it("uses 401 only for genuinely unauthenticated, 403 for every authenticated-but-denied case", () => {
    expect(httpStatusForCode("AUTH_REQUIRED")).toBe(401)
    expect(httpStatusForCode("AUTH_UNPROVISIONED")).toBe(403)
    expect(httpStatusForCode("AUTH_INACTIVE")).toBe(403)
    expect(httpStatusForCode("AUTH_PERMISSION_DENIED")).toBe(403)
  })

  it("uses 404 for not found and 409 for conflict/stale-version classes", () => {
    expect(httpStatusForCode("RESOURCE_NOT_FOUND")).toBe(404)
    expect(httpStatusForCode("STALE_VERSION")).toBe(409)
    expect(httpStatusForCode("CONFLICT")).toBe(409)
    expect(httpStatusForCode("COMMERCIAL_EFFECTIVE_DATE_CONFLICT")).toBe(409)
  })

  it("falls back to 500 for UNEXPECTED, never a misleadingly specific status", () => {
    expect(httpStatusForCode("UNEXPECTED")).toBe(500)
  })
})
