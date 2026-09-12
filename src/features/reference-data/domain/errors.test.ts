import { describe, expect, it } from "vitest"

import { parseReferenceMasterError, ReferenceMasterOperationError } from "./errors"

describe("parseReferenceMasterError", () => {
  it("maps a unique-violation code to conflict", () => {
    expect(parseReferenceMasterError({ message: "duplicate key value", code: "23505" }).kind).toBe("conflict")
  })

  it("maps a check-constraint violation to invalid_input", () => {
    expect(parseReferenceMasterError({ message: "check constraint failed", code: "23514" }).kind).toBe("invalid_input")
  })

  it("maps a not-null violation to invalid_input", () => {
    expect(parseReferenceMasterError({ message: "null value in column", code: "23502" }).kind).toBe("invalid_input")
  })

  it("falls back to unknown for any other code", () => {
    expect(parseReferenceMasterError({ message: "something else", code: "99999" }).kind).toBe("unknown")
  })

  it("falls back to unknown with no code at all", () => {
    expect(parseReferenceMasterError({ message: "no code here" }).kind).toBe("unknown")
  })

  it("never invents a message when the source error has none", () => {
    expect(parseReferenceMasterError({ message: "" }).message).toBe("An unexpected error occurred.")
  })
})

describe("ReferenceMasterOperationError", () => {
  it("carries the parsed kind and message", () => {
    const error = new ReferenceMasterOperationError({ kind: "conflict", message: "already exists" })
    expect(error.kind).toBe("conflict")
    expect(error.message).toBe("already exists")
    expect(error.name).toBe("ReferenceMasterOperationError")
    expect(error).toBeInstanceOf(Error)
  })
})
