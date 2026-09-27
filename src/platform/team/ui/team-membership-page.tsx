"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { XIcon } from "lucide-react"

import { PendingButton } from "@/components/product/pending-button"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { assignUserToTeamAction, removeUserFromTeamAction, setPrimaryTeamMembershipAction, checkTeamRemovalImpactAction } from "../actions"
import { labelForTeamMembershipEntry } from "../domain/membership"
import type { TeamMembershipEntry } from "../domain/membership"
import type { Team } from "../domain/types"

/**
 * Team Membership (PD-009, docs/AUTHORIZATION_MODEL.md section 25): lets
 * a `team.write` holder assign and remove team membership without ever
 * needing `user_access.write`. Deliberately the narrowest possible
 * surface: no role data, no display-name editing, no activate/
 * deactivate control, nothing beyond what `assignUserToTeamAction`/
 * `removeUserFromTeamAction`/`setPrimaryTeamMembershipAction` (already
 * gated on `team.write` alone) can do. `canWrite` here is that same
 * `team.write` check; there is no separate read-only mode; the route
 * only renders this section at all once its own `team.read` gate has
 * already passed.
 */
function TeamMembershipPage({ entries, assignableTeams, canWrite }: { entries: TeamMembershipEntry[]; assignableTeams: Team[]; canWrite: boolean }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [pendingAuthUserId, setPendingAuthUserId] = useState<string | null>(null)
  const [teamDraftByUser, setTeamDraftByUser] = useState<Record<string, string>>({})
  const [actionError, setActionError] = useState<string | null>(null)

  function runAction(authUserId: string, action: () => Promise<{ ok: boolean; error?: string }>) {
    setActionError(null)
    setPendingAuthUserId(authUserId)
    startTransition(async () => {
      const result = await action()
      setPendingAuthUserId(null)
      if (!result.ok) {
        setActionError(result.error ?? "An unexpected error occurred.")
        return
      }
      router.refresh()
    })
  }

  /** Same warn-but-allow pre-removal check as the User Access page's own team removal (Product Gap Closure, O-018), so this surface never regresses that guarantee. */
  async function handleRemoveTeam(authUserId: string, userTeamId: string) {
    setActionError(null)
    const impactResult = await checkTeamRemovalImpactAction(userTeamId)
    if (!impactResult.ok) {
      setActionError(impactResult.error)
      return
    }
    const { impact } = impactResult
    if (impact.pendingApprovalCount > 0) {
      const teamLabel = impact.teamName ?? "this team"
      const confirmed = window.confirm(
        `This change will leave ${impact.pendingApprovalCount} pending approval${impact.pendingApprovalCount === 1 ? "" : "s"} with no eligible approver on ${teamLabel}. Remove this membership anyway?`
      )
      if (!confirmed) return
    }
    runAction(authUserId, () => removeUserFromTeamAction(userTeamId))
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-4 sm:px-6 sm:py-6">
      <h2 className="text-sm font-medium text-foreground">Team Membership</h2>
      {actionError ? <p className="text-xs text-destructive">{actionError}</p> : null}

      {entries.length >= 200 ? (
        <p className="text-xs text-muted-foreground">
          Showing the first 200 users. If someone you expect to see is missing, they may be beyond this limit; contact IT.
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Display Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Teams</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-xs text-muted-foreground">
                  No provisioned users found.
                </TableCell>
              </TableRow>
            ) : (
              entries.map((entry) => {
                const rowBusy = isPending && pendingAuthUserId === entry.authUserId
                const teamDraft = teamDraftByUser[entry.authUserId] ?? ""
                const assignableTeamsForRow = assignableTeams.filter((team) => !entry.teams.some((granted) => granted.teamId === team.id))

                return (
                  <TableRow key={entry.authUserId}>
                    <TableCell className="text-foreground">{labelForTeamMembershipEntry(entry)}</TableCell>
                    <TableCell className="text-muted-foreground">{entry.email ?? "-"}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1.5">
                        <div className="flex flex-wrap gap-1">
                          {entry.teams.length === 0 ? (
                            <span className="text-xs text-muted-foreground">No team assigned</span>
                          ) : (
                            entry.teams.map((team) => (
                              <Badge key={team.userTeamId} variant="ghost" className="gap-1 bg-muted text-muted-foreground">
                                {team.teamName}
                                {team.isPrimary ? (
                                  <span className="text-[0.65rem] text-muted-foreground">(Primary)</span>
                                ) : canWrite ? (
                                  <button
                                    type="button"
                                    className="text-[0.65rem] underline-offset-2 hover:underline disabled:no-underline"
                                    disabled={rowBusy}
                                    onClick={() =>
                                      entry.appUserId && runAction(entry.authUserId, () => setPrimaryTeamMembershipAction(entry.appUserId as string, team.teamId))
                                    }
                                  >
                                    Make Primary
                                  </button>
                                ) : null}
                                {canWrite ? (
                                  <button
                                    type="button"
                                    aria-label={`Remove ${team.teamName}`}
                                    disabled={rowBusy}
                                    onClick={() => handleRemoveTeam(entry.authUserId, team.userTeamId)}
                                  >
                                    <XIcon className="size-3" />
                                  </button>
                                ) : null}
                              </Badge>
                            ))
                          )}
                        </div>
                        {canWrite && assignableTeamsForRow.length > 0 ? (
                          <div className="flex items-center gap-1.5">
                            <Select
                              value={teamDraft}
                              onValueChange={(value) => setTeamDraftByUser((current) => ({ ...current, [entry.authUserId]: String(value) }))}
                            >
                              <SelectTrigger size="sm" className="h-7 w-52 text-xs">
                                <SelectValue placeholder="Assign a team...">
                                  {() => {
                                    const selected = assignableTeamsForRow.find((team) => team.id === teamDraft)
                                    return selected ? `${selected.name} (${selected.code})` : "Assign a team..."
                                  }}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {assignableTeamsForRow.map((team) => (
                                  <SelectItem key={team.id} value={team.id}>
                                    {team.name} <span className="text-muted-foreground">({team.code})</span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!teamDraft || rowBusy}
                              onClick={() =>
                                entry.appUserId &&
                                runAction(entry.authUserId, () => assignUserToTeamAction(entry.appUserId as string, teamDraft, entry.teams.length === 0))
                              }
                            >
                              Add
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

export { TeamMembershipPage }
