"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { XIcon } from "lucide-react"

import { PageHeader } from "@/components/product/page-header"
import { PendingButton } from "@/components/product/pending-button"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatTimestampDate } from "@/lib/date"
import {
  provisionAppUserAction,
  setAppUserActiveAction,
  setAppUserDisplayNameAction,
  grantUserRoleAction,
  revokeUserRoleAction,
} from "../actions"
import { assignUserToTeamAction, removeUserFromTeamAction } from "@/platform/team/actions"
import type { TeamRow } from "@/platform/team/server"
import { labelForUserAccessEntry } from "../domain/user-access"
import type { UserAccessEntry } from "../domain/user-access"
import type { AssignableRole } from "../services/user-access.service"

/**
 * Settings/Administration -> User Access (task Phase J): the one place
 * an admin manages who can use Nexus, reusing app_users/roles/
 * permissions/user_roles exactly as they already are, no competing RBAC
 * system. Deliberately prop-driven for the entry list itself (no local
 * copy in `useState`): every mutation calls `router.refresh()` rather
 * than hand-updating local state, so what renders always matches the
 * real, just-written database row, never an optimistic guess.
 *
 * Team column (task Phase K) follows the exact same assign/remove
 * pattern as Roles, gated on its own `canManageTeams` (`team.write`),
 * separate from `canWrite` (`user_access.write`): an admin may hold one
 * without the other. Access Profile is still not shown: that concept
 * does not exist until the Maker/Checker capability layer (task Phase L)
 * is built.
 */
function UserAccessPage({
  entries,
  assignableRoles,
  assignableTeams,
  canWrite,
  canManageTeams,
}: {
  entries: UserAccessEntry[]
  assignableRoles: AssignableRole[]
  assignableTeams: TeamRow[]
  canWrite: boolean
  canManageTeams: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [pendingAuthUserId, setPendingAuthUserId] = useState<string | null>(null)
  const [editingDisplayNameFor, setEditingDisplayNameFor] = useState<string | null>(null)
  const [displayNameDraft, setDisplayNameDraft] = useState("")
  const [roleDraftByUser, setRoleDraftByUser] = useState<Record<string, string>>({})
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
      setEditingDisplayNameFor(null)
      router.refresh()
    })
  }

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader title="User Access" description="Settings / Administration" />

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4 sm:px-6 sm:py-6">
        {actionError ? <p className="text-xs text-destructive">{actionError}</p> : null}

        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Display Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Team</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead>Last Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => {
                const rowBusy = isPending && pendingAuthUserId === entry.authUserId
                const roleDraft = roleDraftByUser[entry.authUserId] ?? ""
                const assignableForRow = assignableRoles.filter((role) => !entry.roles.some((granted) => granted.roleId === role.id))
                const teamDraft = teamDraftByUser[entry.authUserId] ?? ""
                const assignableTeamsForRow = assignableTeams.filter((team) => !entry.teams.some((granted) => granted.teamId === team.id))

                return (
                  <TableRow key={entry.authUserId}>
                    <TableCell className="text-foreground">
                      {!entry.isProvisioned ? (
                        <span className="text-muted-foreground">-</span>
                      ) : editingDisplayNameFor === entry.authUserId ? (
                        <div className="flex items-center gap-1.5">
                          <Input
                            className="h-7 w-40 text-xs"
                            value={displayNameDraft}
                            onChange={(event) => setDisplayNameDraft(event.target.value)}
                            autoFocus
                          />
                          <PendingButton
                            size="sm"
                            pending={rowBusy}
                            pendingLabel="Saving..."
                            disabled={!canWrite}
                            onClick={() =>
                              entry.appUserId &&
                              runAction(entry.authUserId, () => setAppUserDisplayNameAction(entry.appUserId as string, displayNameDraft))
                            }
                          >
                            Save
                          </PendingButton>
                          <Button variant="outline" size="sm" onClick={() => setEditingDisplayNameFor(null)} disabled={rowBusy}>
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="text-left underline-offset-2 hover:underline disabled:no-underline"
                          disabled={!canWrite}
                          onClick={() => {
                            setEditingDisplayNameFor(entry.authUserId)
                            setDisplayNameDraft(entry.displayName ?? "")
                          }}
                        >
                          {labelForUserAccessEntry(entry)}
                        </button>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{entry.email ?? "-"}</TableCell>
                    <TableCell>
                      {!entry.isProvisioned ? (
                        <Badge variant="ghost" className="bg-muted text-muted-foreground">
                          Not Provisioned
                        </Badge>
                      ) : (
                        <Badge variant="ghost" className={entry.isActive ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}>
                          {entry.isActive ? "Active" : "Inactive"}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {!entry.isProvisioned ? (
                        <span className="text-xs text-muted-foreground">-</span>
                      ) : (
                        <div className="flex flex-col gap-1.5">
                          <div className="flex flex-wrap gap-1">
                            {entry.teams.length === 0 ? (
                              <span className="text-xs text-muted-foreground">No team assigned</span>
                            ) : (
                              entry.teams.map((team) => (
                                <Badge key={team.userTeamId} variant="ghost" className="gap-1 bg-muted text-muted-foreground">
                                  {team.teamName}
                                  {team.isPrimary ? <span className="text-[0.65rem] text-muted-foreground">(Primary)</span> : null}
                                  {canManageTeams ? (
                                    <button
                                      type="button"
                                      aria-label={`Remove ${team.teamName}`}
                                      disabled={rowBusy}
                                      onClick={() => runAction(entry.authUserId, () => removeUserFromTeamAction(team.userTeamId))}
                                    >
                                      <XIcon className="size-3" />
                                    </button>
                                  ) : null}
                                </Badge>
                              ))
                            )}
                          </div>
                          {canManageTeams && assignableTeamsForRow.length > 0 ? (
                            <div className="flex items-center gap-1.5">
                              <Select
                                value={teamDraft}
                                onValueChange={(value) => setTeamDraftByUser((current) => ({ ...current, [entry.authUserId]: String(value) }))}
                              >
                                <SelectTrigger size="sm" className="h-7 w-40 text-xs">
                                  <SelectValue placeholder="Assign a team..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {assignableTeamsForRow.map((team) => (
                                    <SelectItem key={team.id} value={team.id}>
                                      {team.name}
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
                      )}
                    </TableCell>
                    <TableCell>
                      {!entry.isProvisioned ? (
                        <span className="text-xs text-muted-foreground">-</span>
                      ) : (
                        <div className="flex flex-col gap-1.5">
                          <div className="flex flex-wrap gap-1">
                            {entry.roles.length === 0 ? (
                              <span className="text-xs text-muted-foreground">No roles assigned</span>
                            ) : (
                              entry.roles.map((role) => (
                                <Badge key={role.userRoleId} variant="ghost" className="gap-1 bg-muted text-muted-foreground">
                                  {role.roleName}
                                  {canWrite ? (
                                    <button
                                      type="button"
                                      aria-label={`Remove ${role.roleName}`}
                                      disabled={rowBusy}
                                      onClick={() => runAction(entry.authUserId, () => revokeUserRoleAction(role.userRoleId))}
                                    >
                                      <XIcon className="size-3" />
                                    </button>
                                  ) : null}
                                </Badge>
                              ))
                            )}
                          </div>
                          {canWrite && assignableForRow.length > 0 ? (
                            <div className="flex items-center gap-1.5">
                              <Select
                                value={roleDraft}
                                onValueChange={(value) => setRoleDraftByUser((current) => ({ ...current, [entry.authUserId]: String(value) }))}
                              >
                                <SelectTrigger size="sm" className="h-7 w-40 text-xs">
                                  <SelectValue placeholder="Assign a role..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {assignableForRow.map((role) => (
                                    <SelectItem key={role.id} value={role.id}>
                                      {role.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={!roleDraft || rowBusy}
                                onClick={() =>
                                  entry.appUserId &&
                                  runAction(entry.authUserId, () => grantUserRoleAction(entry.appUserId as string, roleDraft))
                                }
                              >
                                Add
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{entry.updatedAt ? formatTimestampDate(entry.updatedAt) : "-"}</TableCell>
                    <TableCell className="text-right">
                      {!canWrite ? null : !entry.isProvisioned ? (
                        <PendingButton
                          size="sm"
                          variant="outline"
                          pending={rowBusy}
                          pendingLabel="Provisioning..."
                          onClick={() => runAction(entry.authUserId, () => provisionAppUserAction(entry.authUserId))}
                        >
                          Provision Access
                        </PendingButton>
                      ) : (
                        <PendingButton
                          size="sm"
                          variant="outline"
                          pending={rowBusy}
                          pendingLabel="Saving..."
                          onClick={() =>
                            entry.appUserId && runAction(entry.authUserId, () => setAppUserActiveAction(entry.appUserId as string, !entry.isActive))
                          }
                        >
                          {entry.isActive ? "Deactivate" : "Activate"}
                        </PendingButton>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}

export { UserAccessPage }
