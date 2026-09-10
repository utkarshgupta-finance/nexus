import { describe, expect, it } from "vitest"

import { parseCommercialError } from "./errors"

describe("parseCommercialError", () => {
  it("recognizes a named M9 token", () => {
    const result = parseCommercialError({
      message: "USAGE_FACT_EVENT_CONFLICT: source_system=x, source_event_key=y already recorded",
      code: "P0001",
    })

    expect(result.kind).toBe("usage_fact_event_conflict")
    expect(result.message).toBe("source_system=x, source_event_key=y already recorded")
  })

  it("recognizes a named M10 token", () => {
    const result = parseCommercialError({
      message: "RECONCILIATION_ALREADY_SUPERSEDED: resource-1 already has a successor",
      code: "P0001",
    })

    expect(result.kind).toBe("reconciliation_already_superseded")
  })

  it("falls back to a generic SQLSTATE kind for an unnamed unique_violation", () => {
    const result = parseCommercialError({
      message: 'duplicate key value violates unique constraint "uq_billing_calculations_grain"',
      code: "23505",
    })

    expect(result.kind).toBe("conflict")
    expect(result.sqlState).toBe("23505")
  })

  it("falls back to check_violation as invalid_input", () => {
    const result = parseCommercialError({
      message: 'new row for relation "reconciliation_adjustments" violates check constraint',
      code: "23514",
    })

    expect(result.kind).toBe("invalid_input")
  })

  it("falls back to unknown for anything unrecognized", () => {
    const result = parseCommercialError({ message: "connection reset by peer", code: undefined })

    expect(result.kind).toBe("unknown")
    expect(result.message).toBe("connection reset by peer")
  })

  it("does not misread an ordinary message containing a colon as a token", () => {
    const result = parseCommercialError({ message: 'invalid input syntax for type uuid: "nope"', code: "22P02" })

    expect(result.kind).toBe("unknown")
  })
})
