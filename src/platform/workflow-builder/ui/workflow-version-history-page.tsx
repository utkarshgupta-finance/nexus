"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { PageHeader } from "@/components/product/page-header"
import { PendingButton } from "@/components/product/pending-button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatTimestampDate } from "@/lib/date"
import { createWorkflowVersionAction } from "../actions"
import type { WorkflowDefinition, WorkflowDefinitionVersion } from "../domain/types"
import { APPLIES_TO_LABELS } from "./workflow-definitions-page"

/** Task Phase M: `publishedByLabel`/`updatedByLabel` are pre-resolved display labels, never the raw actor ids the version row itself holds. */
type VersionRow = { version: WorkflowDefinitionVersion; publishedByLabel: string | null; updatedByLabel: string | null }

/**
 * Version history for one workflow definition (task Phase N/O): a
 * definition can have many versions over time, at most one of which is
 * ever `draft`. Opening a version goes to its canvas editor.
 */
function WorkflowVersionHistoryPage({
  definition,
  rows,
  canWrite,
  hasDraft,
}: {
  definition: WorkflowDefinition
  rows: VersionRow[]
  canWrite: boolean
  hasDraft: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleNewDraft() {
    setError(null)
    startTransition(async () => {
      const result = await createWorkflowVersionAction(definition.id)
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.push(`/settings/workflows/${definition.id}/versions/${result.version.id}`)
    })
  }

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        title={definition.name}
        description={`Settings / Administration / Workflows / ${APPLIES_TO_LABELS[definition.appliesTo]}`}
        actions={
          canWrite && !hasDraft ? (
            <PendingButton size="sm" pending={isPending} pendingLabel="Creating..." onClick={handleNewDraft}>
              New Draft Version
            </PendingButton>
          ) : undefined
        }
      />

      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-4 sm:px-6 sm:py-6">
        {error ? <p className="text-xs text-destructive">{error}</p> : null}

        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Version</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Published</TableHead>
                <TableHead>Published By</TableHead>
                <TableHead>Last Updated</TableHead>
                <TableHead>Updated By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-xs text-muted-foreground">
                    This workflow has no versions yet.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map(({ version, publishedByLabel, updatedByLabel }) => (
                  <TableRow key={version.id}>
                    <TableCell>
                      <Link
                        href={`/settings/workflows/${definition.id}/versions/${version.id}`}
                        className="font-medium text-foreground underline underline-offset-2"
                      >
                        Version {version.versionNumber}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="ghost" className={version.status === "published" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}>
                        {version.status === "published" ? "Published" : "Draft"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{version.publishedAt ? formatTimestampDate(version.publishedAt) : "-"}</TableCell>
                    <TableCell className="text-muted-foreground">{publishedByLabel ?? "-"}</TableCell>
                    <TableCell className="text-muted-foreground">{formatTimestampDate(version.updatedAt)}</TableCell>
                    <TableCell className="text-muted-foreground">{updatedByLabel ?? "-"}</TableCell>
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

export { WorkflowVersionHistoryPage }
export type { VersionRow }
