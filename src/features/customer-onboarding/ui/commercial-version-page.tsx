"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

import { PageHeader } from "@/components/product/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

import { saveCommercialVersionDraftAction, submitCommercialVersionAction } from "../actions"
import { createEmptyCommercialRateDraft } from "../domain/commercial-rate"
import type { CommercialRateDraft } from "../domain/commercial-rate"
import type { CommercialConfigurationVersion } from "../domain/commercial-version-types"
import { CommercialRateSection } from "./commercial-rate-section"

/**
 * Requester-facing Commercial Configuration Version screen (task spec
 * §10-13): "Create New Version copies current Active into Version 2
 * Draft, reuse existing Commercial Rate editor." Reuses
 * `CommercialRateSection` exactly as onboarding's own Commercial Rate
 * stage does; its own Previous/Save Draft/Next footer is repurposed here
 * (Previous -> back to Commercials, Next -> reveal Submit).
 */

function CommercialVersionPage({
  requestId,
  configId,
  initialVersion,
}: {
  requestId: string
  configId: string
  initialVersion: CommercialConfigurationVersion
}) {
  const router = useRouter()
  const isLocked = initialVersion.status !== "draft"

  const [commercialRate, setCommercialRate] = useState<CommercialRateDraft>(initialVersion.commercialRate ?? createEmptyCommercialRateDraft())
  const [showSubmitPanel, setShowSubmitPanel] = useState(false)
  const [reason, setReason] = useState(initialVersion.reason ?? "")
  const [effectiveDate, setEffectiveDate] = useState(initialVersion.effectiveDate ?? new Date().toISOString().slice(0, 10))
  const [isSaving, setIsSaving] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  async function handleSaveDraft() {
    setActionError(null)
    setIsSaving(true)
    const result = await saveCommercialVersionDraftAction(requestId, commercialRate)
    setIsSaving(false)
    if (!result.ok) setActionError(result.error)
  }

  async function handleSubmit() {
    setActionError(null)
    setIsSaving(true)
    await saveCommercialVersionDraftAction(requestId, commercialRate)
    const result = await submitCommercialVersionAction(requestId, reason, effectiveDate)
    setIsSaving(false)
    if (result.ok) {
      router.push(`/commercials/${configId}`)
      router.refresh()
    } else {
      setActionError(result.error)
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        title="Commercial Configuration Version"
        description={`Request ${requestId}, ${initialVersion.changeCategory}`}
        actions={
          <Badge variant="ghost" className="bg-muted text-muted-foreground">
            {initialVersion.status}
          </Badge>
        }
      />

      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-4 sm:px-6 sm:py-6">
        {isLocked ? (
          <p className="text-xs text-muted-foreground">This version has already been {initialVersion.status} and can no longer be edited.</p>
        ) : (
          <>
            <CommercialRateSection
              value={commercialRate}
              onChange={setCommercialRate}
              onPrevious={() => router.push(`/commercials/${configId}`)}
              onSaveDraft={handleSaveDraft}
              onNext={() => setShowSubmitPanel(true)}
            />

            {showSubmitPanel ? (
              <section className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm sm:p-6">
                <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Submit for Approval</h2>
                {actionError ? <p className="text-xs text-destructive">{actionError}</p> : null}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-foreground" htmlFor="version-reason">
                    Reason for this version
                  </label>
                  <textarea
                    id="version-reason"
                    className="min-h-20 rounded-md border bg-transparent px-3 py-2 text-sm"
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                  />
                </div>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-foreground" htmlFor="version-effective-date">
                      Effective Date
                    </label>
                    <Input id="version-effective-date" type="date" value={effectiveDate} onChange={(event) => setEffectiveDate(event.target.value)} />
                  </div>
                  <Button size="sm" onClick={handleSubmit} disabled={isSaving}>
                    Submit
                  </Button>
                </div>
              </section>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}

export { CommercialVersionPage }
