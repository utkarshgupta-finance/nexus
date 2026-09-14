"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

import { PageHeader } from "@/components/product/page-header"
import { PendingButton } from "@/components/product/pending-button"
import { Input } from "@/components/ui/input"
import { formatBusinessDate } from "@/lib/date"
import { createGoLiveRequestAction } from "../actions"
import type { GoLiveLineItem } from "../domain/line-items"

/**
 * Go Live creation form (Phase E). Every authoritative Commercial fact
 * is fetched and locked server-side (the route resolves `lineItem`
 * itself from real data, never a client-supplied label); the only
 * editable fields are Go Live Date, Prorate First Month, and a comment.
 * A user cannot mutate Commercial terms from this form.
 */
function GoLiveCreateForm({ customerKey, lineItem }: { customerKey: string; lineItem: GoLiveLineItem }) {
  const router = useRouter()
  const [goLiveDate, setGoLiveDate] = useState("")
  const [prorateFirstMonth, setProrateFirstMonth] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleCreate() {
    if (!goLiveDate) {
      setError("Go Live Date is required.")
      return
    }
    setError(null)
    setIsPending(true)
    startCreate()
  }

  async function startCreate() {
    const result = await createGoLiveRequestAction({
      customerId: lineItem.customerId,
      commercialConfigurationId: lineItem.commercialConfigurationId,
      commercialVersionId: lineItem.commercialVersionId,
      stableComponentKey: lineItem.stableComponentKey,
      goLiveDate,
      prorateFirstMonth,
    })
    setIsPending(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    router.push(`/customers/${customerKey}/go-live/${result.request.id}`)
  }

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader title="Create Go Live" description={`Customer / ${customerKey} / Go Live`} />

      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-4 sm:px-6 sm:py-6">
        <section className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm">
          <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Commercial Context (locked)</h2>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            <dt className="text-muted-foreground">Commercial Component</dt>
            <dd className="text-foreground">{lineItem.componentLabel}</dd>
            <dt className="text-muted-foreground">Pricing Model</dt>
            <dd className="text-foreground">{lineItem.pricingModelLabel}</dd>
            <dt className="text-muted-foreground">Billing Frequency</dt>
            <dd className="text-foreground">{lineItem.billingCadenceLabel}</dd>
            <dt className="text-muted-foreground">Minimum Usage Guarantee</dt>
            <dd className="text-foreground">{lineItem.mugSummary ?? "None"}</dd>
            <dt className="text-muted-foreground">Billing Currency</dt>
            <dd className="text-foreground">{lineItem.billingCurrency}</dd>
            <dt className="text-muted-foreground">Version</dt>
            <dd className="text-foreground">Version {lineItem.versionNumber}</dd>
            <dt className="text-muted-foreground">Commercial Effective From</dt>
            <dd className="text-foreground">{formatBusinessDate(lineItem.effectiveFrom)}</dd>
          </dl>
        </section>

        <section className="flex flex-col gap-4 rounded-lg border bg-card p-4 shadow-sm">
          <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Go Live Details</h2>

          {error ? <p className="text-xs text-destructive">{error}</p> : null}

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-foreground" htmlFor="go-live-date">
              Go Live Date
            </label>
            <Input id="go-live-date" type="date" className="w-48" value={goLiveDate} onChange={(event) => setGoLiveDate(event.target.value)} />
          </div>

          <label className="flex items-center gap-2 text-xs text-foreground">
            <input
              type="checkbox"
              className="size-3.5 accent-foreground"
              checked={prorateFirstMonth}
              onChange={(event) => setProrateFirstMonth(event.target.checked)}
            />
            Prorate first month?
          </label>
          <p className="text-[11px] text-muted-foreground">
            Default is No: a Go Live in the middle of a month still receives full monthly treatment unless this is checked.
          </p>

          <PendingButton pending={isPending} pendingLabel="Creating..." onClick={handleCreate}>
            Create Draft
          </PendingButton>
        </section>
      </div>
    </div>
  )
}

export { GoLiveCreateForm }
