"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

import { PendingButton } from "@/components/product/pending-button"
import { Button } from "@/components/ui/button"

import { deactivateCustomerAction, reactivateCustomerAction } from "../actions"

/**
 * Customer Deactivation lifecycle (task Phase I): a standalone
 * Deactivate/Reactivate action, independent of Permanent Delete's own
 * "Deactivate Instead" fallback (offered only when deletion is
 * blocked). Both directions require a reason, enforced server-side by
 * `set_customer_active` itself, never only here.
 */
function CustomerStatusPanel({ customerId, isActive }: { customerId: string; isActive: boolean }) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  async function handleConfirm() {
    if (!reason.trim()) {
      setActionError(`A reason is required to ${isActive ? "deactivate" : "reactivate"} this customer.`)
      return
    }
    setActionError(null)
    setIsSubmitting(true)
    const result = isActive ? await deactivateCustomerAction(customerId, reason) : await reactivateCustomerAction(customerId, reason)
    setIsSubmitting(false)
    if (result.ok) {
      router.refresh()
      setIsOpen(false)
      setReason("")
    } else {
      setActionError(result.error)
    }
  }

  if (!isOpen) {
    return (
      <Button variant="outline" size="sm" onClick={() => setIsOpen(true)}>
        {isActive ? "Deactivate Customer" : "Reactivate Customer"}
      </Button>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {actionError ? <p className="text-xs text-destructive">{actionError}</p> : null}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-foreground" htmlFor="customer-status-reason">
          Reason
        </label>
        <textarea
          id="customer-status-reason"
          className="min-h-16 rounded-md border bg-transparent px-3 py-2 text-sm"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setIsOpen(false)
            setReason("")
            setActionError(null)
          }}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <PendingButton
          size="sm"
          variant={isActive ? "destructive" : "default"}
          onClick={handleConfirm}
          pending={isSubmitting}
          pendingLabel={isActive ? "Deactivating..." : "Reactivating..."}
          disabled={!reason.trim()}
        >
          {isActive ? "Confirm Deactivate" : "Confirm Reactivate"}
        </PendingButton>
      </div>
    </div>
  )
}

export { CustomerStatusPanel }
