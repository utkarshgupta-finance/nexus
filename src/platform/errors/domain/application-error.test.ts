import { describe, expect, it } from "vitest"

import { ApplicationError, toApplicationErrorResponse, toUnexpectedErrorResponse, withCorrelationReference } from "./application-error"

describe("ApplicationError", () => {
  it("uses the code's own default message when none is given", () => {
    const error = new ApplicationError("AUTH_PERMISSION_DENIED")
    expect(error.message).toBe("You do not have permission to do this.")
    expect(error.code).toBe("AUTH_PERMISSION_DENIED")
    expect(error.correlationId).toBeNull()
  })

  it("prefers a caller-supplied message over the default", () => {
    const error = new ApplicationError("VALIDATION_FAILED", "Commercial Rate is incomplete. Add Invoice Frequency to SFA + DMS.")
    expect(error.message).toBe("Commercial Rate is incomplete. Add Invoice Frequency to SFA + DMS.")
  })

  it("carries a correlation id when given one", () => {
    const error = new ApplicationError("CONFLICT", undefined, "NX-ABCD1234")
    expect(error.correlationId).toBe("NX-ABCD1234")
  })
})

describe("toApplicationErrorResponse", () => {
  it("never exposes anything beyond code/message/correlationId, no stack, no raw cause", () => {
    const error = new ApplicationError("STALE_VERSION", undefined, "NX-11112222")
    const response = toApplicationErrorResponse(error)
    expect(Object.keys(response).sort()).toEqual(["code", "correlationId", "message"])
    expect(response).toEqual({ code: "STALE_VERSION", message: error.message, correlationId: "NX-11112222" })
  })
})

describe("toUnexpectedErrorResponse", () => {
  it("never leaks the original error's own message, only the generic UNEXPECTED default", () => {
    const response = toUnexpectedErrorResponse("NX-99998888")
    expect(response.code).toBe("UNEXPECTED")
    expect(response.message).toBe("An unexpected error occurred.")
    expect(response.correlationId).toBe("NX-99998888")
  })
})

describe("withCorrelationReference (Platform Scale Closure, Phase T)", () => {
  it("appends a support reference when the error carries a correlation id", () => {
    const error = Object.assign(new Error("boom"), { correlationId: "NX-ABCD1234" })
    expect(withCorrelationReference("An unexpected error occurred.", error)).toBe("An unexpected error occurred. Reference: NX-ABCD1234")
  })

  it("leaves the message untouched when there is no correlation id, never inventing one", () => {
    expect(withCorrelationReference("Some message.", new Error("boom"))).toBe("Some message.")
    expect(withCorrelationReference("Some message.", "not even an error")).toBe("Some message.")
  })
})
