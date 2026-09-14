import { describe, expect, it } from "vitest"

import { buildOperationLogLine, buildCorrelationId } from "./log-entry"

describe("buildOperationLogLine", () => {
  it("carries every field through unchanged and stamps occurredAt from the given time", () => {
    const now = new Date("2026-09-14T12:00:00.000Z")
    const line = buildOperationLogLine(
      { eventCode: "onboarding.approve", operation: "approveOnboardingCase", resourceType: "customer_onboarding_case", resourceId: "req-1", actorUserId: "actor-1", status: "success", durationMs: 42 },
      now
    )
    expect(line).toEqual({
      eventCode: "onboarding.approve",
      operation: "approveOnboardingCase",
      resourceType: "customer_onboarding_case",
      resourceId: "req-1",
      actorUserId: "actor-1",
      status: "success",
      durationMs: 42,
      occurredAt: "2026-09-14T12:00:00.000Z",
    })
  })

  it("has a fixed, narrow field set: no field wide enough to accidentally carry a secret", () => {
    const now = new Date("2026-09-14T12:00:00.000Z")
    const line = buildOperationLogLine({ eventCode: "x", operation: "y", status: "failure" }, now)
    expect(Object.keys(line).sort()).toEqual(["eventCode", "occurredAt", "operation", "status"])
  })
})

describe("buildCorrelationId", () => {
  it("is short, uppercase, and prefixed for easy recognition in an error message", () => {
    const id = buildCorrelationId("a1b2c3d4-e5f6-7890-abcd-ef1234567890")
    expect(id).toBe("NX-A1B2C3D4")
  })

  it("never includes hyphens from the source UUID", () => {
    const id = buildCorrelationId("aaaa-bbbb-cccc-dddd-eeee")
    expect(id.slice(3)).not.toContain("-")
  })
})
