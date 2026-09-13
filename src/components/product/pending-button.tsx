import type { ComponentProps } from "react"
import { Loader2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"

/**
 * Shared mutating-action feedback pattern (Customer Lifecycle V1 UX
 * pass): every button that triggers a Save Draft/Submit/Approve/Send
 * Back/Reject/Delete style Server Action swaps to `pendingLabel` and
 * disables itself while `pending` is true, so no page hand-rolls its own
 * ad hoc "Saving..."/disabled-button logic. Callers still own the boolean
 * `pending` state itself (whichever async handler they already have);
 * this component only centralizes the label swap, disabling, and spinner.
 */
function PendingButton({
  pending,
  pendingLabel,
  disabled,
  children,
  ...props
}: Omit<ComponentProps<typeof Button>, "children"> & {
  pending: boolean
  pendingLabel: string
  children: React.ReactNode
}) {
  return (
    <Button disabled={pending || disabled} {...props}>
      {pending ? (
        <>
          <Loader2Icon data-icon="inline-start" className="size-3 animate-spin" />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </Button>
  )
}

export { PendingButton }
