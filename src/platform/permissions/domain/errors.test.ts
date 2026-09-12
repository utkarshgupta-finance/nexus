import { describe, expect, it } from "vitest"

import { AuthorizationError } from "./errors"

describe("AuthorizationError", () => {
  it("carries the denial reason and a human-readable message", () => {
    const error = new AuthorizationError("unauthenticated", "You must be signed in to perform this action.")
    expect(error.reason).toBe("unauthenticated")
    expect(error.message).toBe("You must be signed in to perform this action.")
    expect(error.name).toBe("AuthorizationError")
    expect(error).toBeInstanceOf(Error)
  })

  it("distinguishes every denial reason task correction §26 requires", () => {
    const reasons = ["unauthenticated", "unavailable", "unprovisioned", "inactive", "missing_permission"] as const
    for (const reason of reasons) {
      const error = new AuthorizationError(reason, "denied")
      expect(error.reason).toBe(reason)
    }
  })
})
