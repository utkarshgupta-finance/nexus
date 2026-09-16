"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { PageHeader } from "@/components/product/page-header"
import { PendingButton } from "@/components/product/pending-button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatTimestampDate } from "@/lib/date"
import { createWorkflowDefinitionAction, setWorkflowDefinitionActiveAction, replaceActiveWorkflowDefinitionAction } from "../actions"
import type { WorkflowAppliesTo, WorkflowDefinition } from "../domain/types"

const APPLIES_TO_LABELS: Record<WorkflowAppliesTo, string> = {
  customer_onboarding: "Customer Onboarding",
  customer_change: "Customer Change",
  commercial_configuration: "Commercial Configuration",
  go_live: "Go Live",
  agreement: "Agreement",
}

/** Task Phase M: `updatedByLabel` is a pre-resolved display label, never the raw actor id `definition.updatedBy` itself holds. `hasPublishedVersion` looks across every version of this definition (task 3: activating with no published version at all is rejected server-side), not only the latest, which may itself still be a draft. */
type DefinitionRow = {
  definition: WorkflowDefinition
  latestVersionNumber: number | null
  latestVersionStatus: string | null
  hasPublishedVersion: boolean
  updatedByLabel: string | null
}

/**
 * Settings/Administration -> Workflows (task Phase N/O): Name/Applies
 * To/Version/Status/Last Updated/Updated By, restrained V1 per the task
 * spec. Opening a row goes to its version history
 * (`workflows/[definitionId]`), never straight to the canvas: a
 * definition can have more than one version.
 *
 * Active/Activate column (Workflow Runtime V1, Task 3: at most one
 * active workflow per binding context): `canPublish` gates
 * Activate/Deactivate, matching the same `workflow_definition.publish`
 * permission publishing already requires, since activating is an
 * equally consequential runtime-affecting action. "Activate" always
 * calls the governed replacement RPC (`replaceActiveWorkflowDefinitionAction`),
 * never the plain one, so a Workflow Admin never has to separately
 * deactivate whichever other definition currently holds this context's
 * slot first: one click either activates cleanly (nothing else was
 * active) or swaps atomically (something else was).
 */
function WorkflowDefinitionsPage({ rows, canWrite, canPublish }: { rows: DefinitionRow[]; canWrite: boolean; canPublish: boolean }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [codeDraft, setCodeDraft] = useState("")
  const [nameDraft, setNameDraft] = useState("")
  const [appliesToDraft, setAppliesToDraft] = useState<WorkflowAppliesTo | "">("")
  const [formError, setFormError] = useState<string | null>(null)
  const [activatingId, setActivatingId] = useState<string | null>(null)
  const [activateError, setActivateError] = useState<string | null>(null)

  function handleCreate() {
    if (!codeDraft.trim() || !nameDraft.trim() || !appliesToDraft) {
      setFormError("Workflow Code, Name, and Applies To are all required.")
      return
    }
    setFormError(null)
    startTransition(async () => {
      const result = await createWorkflowDefinitionAction(codeDraft.trim(), nameDraft.trim(), appliesToDraft)
      if (!result.ok) {
        setFormError(result.error)
        return
      }
      setCodeDraft("")
      setNameDraft("")
      setAppliesToDraft("")
      router.push(`/settings/workflows/${result.definition.id}`)
    })
  }

  function handleActivate(definitionId: string) {
    setActivateError(null)
    setActivatingId(definitionId)
    startTransition(async () => {
      const result = await replaceActiveWorkflowDefinitionAction(definitionId)
      setActivatingId(null)
      if (!result.ok) {
        setActivateError(result.error)
        return
      }
      router.refresh()
    })
  }

  function handleDeactivate(definitionId: string) {
    setActivateError(null)
    setActivatingId(definitionId)
    startTransition(async () => {
      const result = await setWorkflowDefinitionActiveAction(definitionId, false)
      setActivatingId(null)
      if (!result.ok) {
        setActivateError(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader title="Workflows" description="Settings / Administration" />

      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-4 sm:px-6 sm:py-6">
        {formError ? <p className="text-xs text-destructive">{formError}</p> : null}

        {canWrite ? (
          <div className="flex flex-wrap items-end gap-2 rounded-lg border bg-card p-4 shadow-sm">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-foreground" htmlFor="workflow-code">Workflow Code</label>
              <Input id="workflow-code" className="w-40" value={codeDraft} onChange={(event) => setCodeDraft(event.target.value)} placeholder="e.g. customer_onboarding_v1" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-foreground" htmlFor="workflow-name">Name</label>
              <Input id="workflow-name" className="w-56" value={nameDraft} onChange={(event) => setNameDraft(event.target.value)} placeholder="e.g. Customer Onboarding Approval" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-foreground">Applies To</label>
              <Select value={appliesToDraft} onValueChange={(value) => setAppliesToDraft(value as WorkflowAppliesTo)}>
                <SelectTrigger size="sm" className="w-52">
                  <SelectValue placeholder="Select...">{() => (appliesToDraft ? APPLIES_TO_LABELS[appliesToDraft] : "Select...")}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(APPLIES_TO_LABELS) as WorkflowAppliesTo[]).map((key) => (
                    <SelectItem key={key} value={key}>{APPLIES_TO_LABELS[key]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <PendingButton size="sm" pending={isPending} pendingLabel="Creating..." onClick={handleCreate}>
              Create Workflow
            </PendingButton>
          </div>
        ) : null}

        {activateError ? <p className="text-xs text-destructive">{activateError}</p> : null}

        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Name</TableHead>
                <TableHead>Applies To</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Active</TableHead>
                <TableHead>Last Updated</TableHead>
                <TableHead>Updated By</TableHead>
                {canPublish ? <TableHead /> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canPublish ? 8 : 7} className="text-xs text-muted-foreground">
                    No workflows have been created yet.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map(({ definition, latestVersionNumber, latestVersionStatus, hasPublishedVersion, updatedByLabel }) => (
                  <TableRow key={definition.id}>
                    <TableCell>
                      <Link href={`/settings/workflows/${definition.id}`} className="font-medium text-foreground underline underline-offset-2">
                        {definition.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{APPLIES_TO_LABELS[definition.appliesTo]}</TableCell>
                    <TableCell className="text-muted-foreground">{latestVersionNumber ?? "-"}</TableCell>
                    <TableCell>
                      {latestVersionStatus ? (
                        <Badge variant="ghost" className={latestVersionStatus === "published" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}>
                          {latestVersionStatus === "published" ? "Published" : "Draft"}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">No versions yet</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="ghost" className={definition.isActive ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}>
                        {definition.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatTimestampDate(definition.updatedAt)}</TableCell>
                    <TableCell className="text-muted-foreground">{updatedByLabel ?? "-"}</TableCell>
                    {canPublish ? (
                      <TableCell>
                        {definition.isActive ? (
                          <PendingButton
                            size="sm"
                            variant="outline"
                            pending={isPending && activatingId === definition.id}
                            pendingLabel="Deactivating..."
                            onClick={() => handleDeactivate(definition.id)}
                          >
                            Deactivate
                          </PendingButton>
                        ) : (
                          <PendingButton
                            size="sm"
                            variant="outline"
                            pending={isPending && activatingId === definition.id}
                            pendingLabel="Activating..."
                            disabled={!hasPublishedVersion}
                            title={hasPublishedVersion ? undefined : "Publish a version before activating this workflow."}
                            onClick={() => handleActivate(definition.id)}
                          >
                            Activate
                          </PendingButton>
                        )}
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}

export { WorkflowDefinitionsPage, APPLIES_TO_LABELS }
export type { DefinitionRow }
