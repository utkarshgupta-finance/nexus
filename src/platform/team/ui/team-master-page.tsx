"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { PageHeader } from "@/components/product/page-header"
import { PendingButton } from "@/components/product/pending-button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatTimestampDate } from "@/lib/date"
import { createTeamAction, setTeamActiveAction } from "../actions"
import type { TeamRow } from "../data/team.data"

/**
 * Settings/Administration -> Team Master (task Phase K): a governed
 * teams catalog, no hardcoded example teams. Mirrors Reference Master's
 * own add/activate/deactivate shape, kept much simpler since Team has no
 * grouping, no configurable-vs-governed distinction, and no per-list
 * special cases the way Reference Master does.
 */
function TeamMasterPage({ teams, canWrite }: { teams: TeamRow[]; canWrite: boolean }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [pendingTeamId, setPendingTeamId] = useState<string | null>(null)
  const [codeDraft, setCodeDraft] = useState("")
  const [nameDraft, setNameDraft] = useState("")
  const [descriptionDraft, setDescriptionDraft] = useState("")
  const [formError, setFormError] = useState<string | null>(null)

  function handleCreate() {
    if (!codeDraft.trim() || !nameDraft.trim()) {
      setFormError("Team Code and Team Name are both required.")
      return
    }
    setFormError(null)
    startTransition(async () => {
      const result = await createTeamAction(codeDraft.trim(), nameDraft.trim(), descriptionDraft.trim() || null)
      if (!result.ok) {
        setFormError(result.error)
        return
      }
      setCodeDraft("")
      setNameDraft("")
      setDescriptionDraft("")
      router.refresh()
    })
  }

  function toggleActive(team: TeamRow) {
    setPendingTeamId(team.id)
    startTransition(async () => {
      const result = await setTeamActiveAction(team.id, !team.is_active)
      setPendingTeamId(null)
      if (!result.ok) {
        setFormError(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader title="Team Master" description="Settings / Administration" />

      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-4 sm:px-6 sm:py-6">
        {formError ? <p className="text-xs text-destructive">{formError}</p> : null}

        {canWrite ? (
          <div className="flex flex-wrap items-end gap-2 rounded-lg border bg-card p-4 shadow-sm">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-foreground" htmlFor="team-code">Team Code</label>
              <Input id="team-code" className="w-36" value={codeDraft} onChange={(event) => setCodeDraft(event.target.value)} placeholder="e.g. finance" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-foreground" htmlFor="team-name">Team Name</label>
              <Input id="team-name" className="w-48" value={nameDraft} onChange={(event) => setNameDraft(event.target.value)} placeholder="e.g. Finance" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-foreground" htmlFor="team-description">Description (optional)</label>
              <Input id="team-description" className="w-56" value={descriptionDraft} onChange={(event) => setDescriptionDraft(event.target.value)} />
            </div>
            <PendingButton size="sm" pending={isPending && !pendingTeamId} pendingLabel="Adding..." onClick={handleCreate}>
              Add Team
            </PendingButton>
          </div>
        ) : null}

        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Team Code</TableHead>
                <TableHead>Team Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Updated</TableHead>
                {canWrite ? <TableHead className="text-right">Actions</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {teams.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canWrite ? 6 : 5} className="text-xs text-muted-foreground">
                    No teams have been added yet.
                  </TableCell>
                </TableRow>
              ) : (
                teams.map((team) => (
                  <TableRow key={team.id}>
                    <TableCell className="font-mono text-xs text-foreground">{team.code}</TableCell>
                    <TableCell className="text-foreground">{team.name}</TableCell>
                    <TableCell className="text-muted-foreground">{team.description ?? "-"}</TableCell>
                    <TableCell>
                      <Badge variant="ghost" className={team.is_active ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}>
                        {team.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatTimestampDate(team.updated_at)}</TableCell>
                    {canWrite ? (
                      <TableCell className="text-right">
                        <PendingButton
                          size="sm"
                          variant="outline"
                          pending={isPending && pendingTeamId === team.id}
                          pendingLabel="Saving..."
                          onClick={() => toggleActive(team)}
                        >
                          {team.is_active ? "Deactivate" : "Activate"}
                        </PendingButton>
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

export { TeamMasterPage }
