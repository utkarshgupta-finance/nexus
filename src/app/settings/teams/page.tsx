import { AuthGate } from "@/components/product/auth-gate"
import { SettingsNav } from "@/components/product/settings-nav"
import type { SettingsNavItem } from "@/components/product/settings-nav"
import { getCurrentNexusSession } from "@/platform/auth/server"
import { hasPermission } from "@/platform/permissions/server"
import { sessionHasPermission } from "@/platform/permissions"
import { listTeams, listActiveTeams, listTeamMembershipEntries } from "@/platform/team/server"
import { TeamMasterPage } from "@/platform/team/ui/team-master-page"
import { TeamMembershipPage } from "@/platform/team/ui/team-membership-page"

/**
 * Team Master (task Phase K): a governed teams catalog, no hardcoded
 * example teams. `dynamic = "force-dynamic"` matching every other route
 * reading live backend/session data in this app.
 */
export const dynamic = "force-dynamic"

const TEAM_READ = { resource: "team", action: "read" }

export default async function TeamMasterRoute() {
  const session = await getCurrentNexusSession()

  let teams: Awaited<ReturnType<typeof listTeams>> = []
  let assignableTeams: Awaited<ReturnType<typeof listActiveTeams>> = []
  let membershipEntries: Awaited<ReturnType<typeof listTeamMembershipEntries>> = []
  let unavailable = false
  try {
    ;[teams, assignableTeams, membershipEntries] = await Promise.all([listTeams(), listActiveTeams(), listTeamMembershipEntries()])
  } catch {
    unavailable = true
  }

  const canWrite = await hasPermission("team", "write")

  const navItems: SettingsNavItem[] = []
  if (sessionHasPermission(session, "reference_master", "read")) {
    navItems.push({ href: "/settings/customer-onboarding", label: "Reference Master" })
  }
  navItems.push({ href: "/settings/teams", label: "Team Master" })
  if (sessionHasPermission(session, "workflow_definition", "read")) {
    navItems.push({ href: "/settings/workflows", label: "Workflows" })
  }
  if (sessionHasPermission(session, "user_access", "read")) {
    navItems.push({ href: "/settings/user-access", label: "User Access" })
  }

  return (
    <AuthGate session={session} requiredPermission={TEAM_READ} loginRedirectTo="/settings/teams">
      <SettingsNav items={navItems} />
      {unavailable ? (
        <div className="flex flex-1 flex-col">
          <p className="p-6 text-xs text-muted-foreground">Team Master could not be read right now. Please try again shortly.</p>
        </div>
      ) : (
        <>
          <TeamMasterPage teams={teams} canWrite={canWrite} />
          <TeamMembershipPage entries={membershipEntries} assignableTeams={assignableTeams} canWrite={canWrite} />
        </>
      )}
    </AuthGate>
  )
}
