"use client"

import { PendingButton } from "@/components/product/pending-button"
import { Button } from "@/components/ui/button"

type OnboardingStageFooterAction = "save" | "next" | "submit" | "cancel" | null

/**
 * The one consistent bottom navigation footer for every Customer
 * Onboarding stage (Customer Lifecycle V1 UX pass): Stage 1 gets Save
 * Draft + Next, middle stages get Previous + Save Draft + Next, the
 * final stage gets Previous + Save Draft + Submit. Next never requires
 * the current stage to be complete (draft navigation is permissive);
 * only Submit is strict. The stage capsules above stay clickable as
 * secondary navigation, but this footer is the primary, always-visible
 * way to move forward, so the user is never required to reach for them.
 */
function OnboardingStageFooter({
  isFirstStage,
  isLastStage,
  pendingAction,
  canCancel = false,
  onPrevious,
  onSaveDraft,
  onNext,
  onSubmit,
  onCancelClick,
}: {
  isFirstStage: boolean
  isLastStage: boolean
  pendingAction: OnboardingStageFooterAction
  /** Task Phase C: only a draft (never sent_back, submitted, or resubmitted) may be discarded. */
  canCancel?: boolean
  onPrevious: () => void
  onSaveDraft: () => void
  onNext: () => void
  onSubmit: () => void
  onCancelClick?: () => void
}) {
  const isBusy = pendingAction !== null

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        {isFirstStage ? null : (
          <Button variant="outline" size="sm" onClick={onPrevious} disabled={isBusy}>
            Previous
          </Button>
        )}
        {canCancel && onCancelClick ? (
          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={onCancelClick} disabled={isBusy}>
            Cancel Draft
          </Button>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <PendingButton
          variant="outline"
          size="sm"
          onClick={onSaveDraft}
          pending={pendingAction === "save"}
          pendingLabel="Saving..."
          disabled={isBusy && pendingAction !== "save"}
        >
          Save Draft
        </PendingButton>
        {isLastStage ? (
          <PendingButton size="sm" onClick={onSubmit} pending={pendingAction === "submit"} pendingLabel="Submitting..." disabled={isBusy && pendingAction !== "submit"}>
            Submit
          </PendingButton>
        ) : (
          <PendingButton size="sm" onClick={onNext} pending={pendingAction === "next"} pendingLabel="Saving..." disabled={isBusy && pendingAction !== "next"}>
            Next
          </PendingButton>
        )}
      </div>
    </div>
  )
}

export { OnboardingStageFooter }
export type { OnboardingStageFooterAction }
