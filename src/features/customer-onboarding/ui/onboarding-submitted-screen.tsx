import Link from "next/link"
import { CheckCircle2Icon } from "lucide-react"

import { KeyValueGrid } from "@/components/product/key-value-grid"
import { Button } from "@/components/ui/button"
import { formatOnboardingCaseId } from "../domain/types"

/**
 * The Submitted confirmation screen (Customer Lifecycle V1 UX pass,
 * defect §3): shown immediately after a successful Submit and on every
 * later visit while the case is still submitted/resubmitted, so the
 * user is never left staring at a bare "Submitted" badge wondering what
 * happened to the customer they just created. The underlying business
 * rule stays exactly as designed: a submitted case is not yet a Customer
 * Master, so this screen never claims otherwise, and only shows "Review
 * Now" to a user who actually holds `customer.approve`.
 */
function OnboardingSubmittedScreen({
  legalName,
  requestId,
  caseNumber,
  submittedAt,
  revisionNumber,
  canReview,
  onViewRequest,
}: {
  legalName: string
  requestId: string
  caseNumber: number
  submittedAt: string | null
  revisionNumber: number
  canReview: boolean
  onViewRequest: () => void
}) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-10 sm:px-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex size-10 items-center justify-center rounded-full bg-success/10 text-success">
          <CheckCircle2Icon className="size-5" />
        </span>
        <h1 className="text-base font-semibold text-foreground">Submitted for review</h1>
        <p className="max-w-md text-xs text-muted-foreground">
          This customer has been submitted for review. A Customer Master will be created after approval.
        </p>
      </div>

      <div className="rounded-lg border bg-card p-4 shadow-sm sm:p-6">
        <KeyValueGrid
          columns={2}
          items={[
            { label: "Customer", value: legalName },
            { label: "Request ID", value: formatOnboardingCaseId(caseNumber) },
            { label: "Status", value: "Submitted" },
            { label: "Submitted At", value: submittedAt ? new Date(submittedAt).toLocaleString() : "-" },
            { label: "Current Revision", value: revisionNumber },
          ]}
        />
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        <Button variant="outline" size="sm" onClick={onViewRequest}>
          View Request
        </Button>
        {canReview ? (
          <Button size="sm" render={<Link href={`/reviews/${requestId}`} />}>
            Review Now
          </Button>
        ) : null}
      </div>
    </div>
  )
}

export { OnboardingSubmittedScreen }
