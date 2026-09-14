import type { PricingRuleKind } from "@/features/commercial/domain/types"

/**
 * Pricing-model classification (Go Live + Entitlement Ledger, Phase K).
 * `linear` (Per Unit) and `flat` (Flat Fee) are deterministic: quantity,
 * MUG, and entitlement alone fully determine consumption, so their
 * monthly ledger row can auto-finalize. `volume` (Slab/Whole Quantity),
 * `graduated` (Progressive Slab), and `dimension` (Designation-based)
 * are multi-rate models; raw usage is still captured and entitlement is
 * still allocated for them, but final commercial recognition is
 * deferred to the future MRR Recognition module (not built in this
 * program): their ledger row always lands PENDING_MRR_RECOGNITION,
 * never a fabricated recognized result.
 */
type PricingRecognitionClass = "AUTO_FINALIZABLE" | "REQUIRES_MRR_RECOGNITION"

const AUTO_FINALIZABLE_KINDS: readonly PricingRuleKind[] = ["linear", "flat"]

function classifyPricingRecognition(pricingRuleKind: PricingRuleKind): PricingRecognitionClass {
  return AUTO_FINALIZABLE_KINDS.includes(pricingRuleKind) ? "AUTO_FINALIZABLE" : "REQUIRES_MRR_RECOGNITION"
}

export { classifyPricingRecognition }
export type { PricingRecognitionClass }
