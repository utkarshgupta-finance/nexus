import { describe, expect, it } from "vitest"

import { groupCommitmentSummaries } from "./configuration-overview-helpers"
import type { CommercialCommitment } from "../domain/types"

// Fictional fixture data only.

const quantityCommitment: CommercialCommitment = {
  kind: "quantity",
  id: "commit-quantity",
  commercialChangeId: "chg-1",
  commercialComponentId: "comp-1",
  thresholdValue: 100,
  currency: null,
  period: "monthly",
  effectiveFrom: "2026-01-01",
  effectiveTo: null,
}

const sharedSpendCommitment: CommercialCommitment = {
  kind: "spend",
  id: "commit-spend-shared",
  commercialChangeId: "chg-1",
  memberComponentIds: ["comp-2", "comp-3"],
  thresholdValue: 5000,
  currency: "USD",
  period: "annual",
  effectiveFrom: "2026-01-01",
  effectiveTo: null,
}

describe("groupCommitmentSummaries", () => {
  it("lists a quantity commitment once, under its own Component", () => {
    const { summaries, byComponentId } = groupCommitmentSummaries([quantityCommitment])

    expect(summaries).toHaveLength(1)
    expect(byComponentId.get("comp-1")).toHaveLength(1)
    expect(byComponentId.get("comp-1")?.[0].id).toBe("commit-quantity")
  })

  it("represents a spend commitment shared by two Components as ONE summary, referenced from both groups, never duplicated at the top level", () => {
    const { summaries, byComponentId } = groupCommitmentSummaries([sharedSpendCommitment])

    // The deduplicated "all commitments" view: exactly one entry, not
    // one per member Component.
    expect(summaries).toHaveLength(1)
    expect(summaries[0].id).toBe("commit-spend-shared")

    // Both member Components see the same commitment id, not two
    // independently-fabricated commitments.
    expect(byComponentId.get("comp-2")).toHaveLength(1)
    expect(byComponentId.get("comp-3")).toHaveLength(1)
    expect(byComponentId.get("comp-2")?.[0].id).toBe("commit-spend-shared")
    expect(byComponentId.get("comp-3")?.[0].id).toBe("commit-spend-shared")

    // Genuinely the same object reference, not two structurally-equal
    // copies: proves no per-Component cloning/flattening happened.
    expect(byComponentId.get("comp-2")?.[0]).toBe(byComponentId.get("comp-3")?.[0])
  })

  it("composes a quantity commitment and a shared spend commitment together without cross-contamination", () => {
    const { summaries, byComponentId } = groupCommitmentSummaries([quantityCommitment, sharedSpendCommitment])

    expect(summaries).toHaveLength(2)
    expect(byComponentId.get("comp-1")).toHaveLength(1)
    expect(byComponentId.get("comp-1")?.[0].kind).toBe("quantity")
    expect(byComponentId.get("comp-2")?.[0].kind).toBe("spend")
    expect(byComponentId.get("comp-3")?.[0].kind).toBe("spend")
  })
})
