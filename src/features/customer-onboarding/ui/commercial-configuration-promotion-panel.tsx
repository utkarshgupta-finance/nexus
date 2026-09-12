"use client"

import { useState } from "react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { promoteCommercialRateDraftAsNewConfigurationAction } from "../actions"
import type { CommercialRateDraft } from "../domain/commercial-rate"
import { isCommercialRateDraftComplete } from "../domain/commercial-rate"
import { useReferenceMasterSnapshot } from "@/features/reference-data/ui/snapshot-context"

/**
 * Controlled development/test promotion path (docs/
 * COMMERCIAL_DOMAIN_ARCHITECTURE.md §22, "a real approved-case ->
 * Commercial Configuration promotion path is future work"; task
 * correction §21: "allow a controlled development/test promotion path
 * only if necessary for Preview verification, document it honestly").
 * Customer Onboarding has no live approval workflow yet: this panel is
 * an honest, explicitly-labeled stand-in for the future "promote on
 * approval" step, never disguised as a real approval action. Rendered
 * only for a user already holding `commercial_configuration.write`
 * (server-derived, see ../actions.ts); the write itself is independently
 * re-checked server-side regardless of this panel's own visibility.
 *
 * Requires the stable Customer Master identity (task correction §22:
 * never a legal name/brand name/GST/PAN) for whichever real, already-
 * approved customer this draft's commercial terms belong to; this panel
 * does not create a customer record, and never promotes against a fake
 * one.
 */
function CommercialConfigurationPromotionPanel({ draft }: { draft: CommercialRateDraft }) {
  const snapshot = useReferenceMasterSnapshot()
  const [customerId, setCustomerId] = useState("")
  const [configurationKey, setConfigurationKey] = useState("")
  const [configurationName, setConfigurationName] = useState("")
  const [effectiveDate, setEffectiveDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [pending, setPending] = useState(false)
  const [result, setResult] = useState<{ ok: true; commercialConfigurationId: string } | { ok: false; error: string } | null>(null)

  const draftComplete = isCommercialRateDraftComplete(snapshot, draft)

  async function handlePromote() {
    setPending(true)
    setResult(null)
    const response = await promoteCommercialRateDraftAsNewConfigurationAction({
      customerId: customerId.trim(),
      configurationKey: configurationKey.trim(),
      configurationName: configurationName.trim(),
      draft,
      effectiveDate,
    })
    setResult(response)
    setPending(false)
  }

  const canSubmit = draftComplete && customerId.trim() && configurationKey.trim() && configurationName.trim() && effectiveDate && !pending

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-dashed p-4">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold text-foreground">Promote to Commercial Configuration (development)</span>
        <span className="text-[0.7rem] text-muted-foreground">
          Customer Onboarding has no live approval workflow yet. This is a controlled development/test path that writes
          this draft into the real, persistent Commercial Configuration for the stable Customer Master identity below.
        </span>
      </div>

      {!draftComplete ? (
        <span className="text-[0.7rem] text-warning">Complete every Commercial Rate requirement before promoting.</span>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <span className="text-[0.7rem] text-muted-foreground">Customer Master id</span>
          <Input value={customerId} onChange={(event) => setCustomerId(event.target.value)} placeholder="Stable customers.id" />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-[0.7rem] text-muted-foreground">Configuration key</span>
          <Input value={configurationKey} onChange={(event) => setConfigurationKey(event.target.value)} placeholder="e.g. northwind-2026" />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-[0.7rem] text-muted-foreground">Configuration name</span>
          <Input value={configurationName} onChange={(event) => setConfigurationName(event.target.value)} placeholder="e.g. Northwind Retail" />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-[0.7rem] text-muted-foreground">Effective from</span>
          <Input type="date" value={effectiveDate} onChange={(event) => setEffectiveDate(event.target.value)} />
        </div>
      </div>

      <Button size="sm" className="w-fit" disabled={!canSubmit} onClick={handlePromote}>
        {pending ? "Promoting..." : "Promote as new Commercial Configuration"}
      </Button>

      {result?.ok ? (
        <span className="text-[0.7rem] text-success">
          Promoted. <Link href={`/commercials/${result.commercialConfigurationId}`} className="underline underline-offset-2">View Commercial Configuration</Link>
        </span>
      ) : null}
      {result && !result.ok ? <span className="text-[0.7rem] text-destructive">{result.error}</span> : null}
    </div>
  )
}

export { CommercialConfigurationPromotionPanel }
