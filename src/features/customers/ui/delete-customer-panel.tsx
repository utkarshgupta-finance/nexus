"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

import { checkCustomerDeletionEligibilityAction, deleteCustomerPermanentlyAction, deactivateCustomerAction } from "../actions"
import type { DeletionEligibility } from "../domain/deletion-types"

const CONFIRMATION_TEXT = "DELETE"

/**
 * Customer -> More Actions -> Permanently Delete Customer (Customer
 * Lifecycle V1, Phase 14-16): checks real eligibility before enabling
 * anything, requires a Reason and typing "DELETE" to confirm, and offers
 * Deactivate as the alternative when blocked by real business history.
 * `delete_customer_permanently` re-checks the same facts server-side, so
 * this panel's own eligibility read is UX guidance, never the real gate.
 */
function DeleteCustomerPanel({ customerId, customerKey }: { customerId: string; customerKey: string }) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [eligibility, setEligibility] = useState<DeletionEligibility | null>(null)
  const [isChecking, setIsChecking] = useState(false)
  const [reason, setReason] = useState("")
  const [confirmationText, setConfirmationText] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  async function handleOpen() {
    setIsOpen(true)
    setIsChecking(true)
    setActionError(null)
    const result = await checkCustomerDeletionEligibilityAction(customerId)
    setIsChecking(false)
    if (result.ok) {
      setEligibility(result.eligibility)
    } else {
      setActionError(result.error)
    }
  }

  function handleClose() {
    setIsOpen(false)
    setEligibility(null)
    setReason("")
    setConfirmationText("")
    setActionError(null)
  }

  async function handleDeactivate() {
    setActionError(null)
    setIsSubmitting(true)
    const result = await deactivateCustomerAction(customerId)
    setIsSubmitting(false)
    if (result.ok) {
      router.refresh()
      handleClose()
    } else {
      setActionError(result.error)
    }
  }

  async function handleDelete() {
    if (!reason.trim()) {
      setActionError("A reason is required to permanently delete this customer.")
      return
    }
    if (confirmationText !== CONFIRMATION_TEXT) {
      setActionError(`Type "${CONFIRMATION_TEXT}" to confirm.`)
      return
    }
    setActionError(null)
    setIsSubmitting(true)
    const result = await deleteCustomerPermanentlyAction(customerId, reason)
    setIsSubmitting(false)
    if (result.ok) {
      router.push("/customers")
      router.refresh()
    } else {
      setActionError(result.error)
    }
  }

  if (!isOpen) {
    return (
      <Button variant="outline" size="sm" onClick={handleOpen}>
        Permanently Delete Customer
      </Button>
    )
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 shadow-sm sm:p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-medium tracking-wide text-destructive uppercase">Permanently Delete Customer</h2>
        <Button variant="outline" size="sm" onClick={handleClose} disabled={isSubmitting}>
          Cancel
        </Button>
      </div>

      {actionError ? <p className="text-xs text-destructive">{actionError}</p> : null}

      {isChecking ? (
        <p className="text-xs text-muted-foreground">Checking deletion eligibility for {customerKey}...</p>
      ) : eligibility && !eligibility.eligible ? (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-foreground">This customer cannot be permanently deleted:</p>
          <ul className="flex flex-col gap-2">
            {eligibility.blockers.map((blocker) => (
              <li key={blocker.kind} className="flex items-start gap-2 text-xs">
                <Badge variant="ghost" className="bg-warning/10 text-warning">
                  {blocker.count}
                </Badge>
                <span className="text-muted-foreground">{blocker.reason}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">You can deactivate this customer instead: it stays fully intact, just marked inactive.</p>
          <Button size="sm" variant="outline" className="w-fit" onClick={handleDeactivate} disabled={isSubmitting}>
            Deactivate Instead
          </Button>
        </div>
      ) : eligibility && eligibility.eligible ? (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">
            This customer has no Commercial Configuration and no approved Change Request. This action is permanent and cannot be undone; a deletion
            record survives independently for audit purposes.
          </p>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-foreground" htmlFor="delete-reason">
              Reason
            </label>
            <textarea
              id="delete-reason"
              className="min-h-20 rounded-md border bg-transparent px-3 py-2 text-sm"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-foreground" htmlFor="delete-confirmation">
              Type &quot;{CONFIRMATION_TEXT}&quot; to confirm
            </label>
            <Input id="delete-confirmation" value={confirmationText} onChange={(event) => setConfirmationText(event.target.value)} />
          </div>
          <Button
            size="sm"
            variant="destructive"
            className="w-fit"
            onClick={handleDelete}
            disabled={isSubmitting || confirmationText !== CONFIRMATION_TEXT || !reason.trim()}
          >
            Permanently Delete
          </Button>
        </div>
      ) : null}
    </section>
  )
}

export { DeleteCustomerPanel }
