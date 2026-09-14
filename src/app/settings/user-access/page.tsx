import { AuthGate } from "@/components/product/auth-gate"
import { SettingsNav } from "@/components/product/settings-nav"
import type { SettingsNavItem } from "@/components/product/settings-nav"
import { getCurrentNexusSession } from "@/platform/auth/server"
import { hasPermission } from "@/platform/permissions/server"
import { sessionHasPermission } from "@/platform/permissions"
import { listUserAccessEntries, listAssignableRoles } from "@/platform/user-access/server"
import { listActiveTeams } from "@/platform/team/server"
import { UserAccessPage } from "@/platform/user-access/ui/user-access-page"

/**
 * User Access (task Phase J): reuses app_users/roles/permissions/
 * user_roles exactly as they already are (no competing RBAC system).
 * `dynamic = "force-dynamic"` matching every other route reading live
 * backend/session data in this app: a static prerender would cache a
 * build-time snapshot of who has access, forever.
 */
export const dynamic = "force-dynamic"

const USER_ACCESS_READ = { resource: "user_access", action: "read" }

export default async function UserAccessRoute() {
  const session = await getCurrentNexusSession()

  let entries: Awaited<ReturnType<typeof listUserAccessEntries>> = []
  let assignableRoles: Awaited<ReturnType<typeof listAssignableRoles>> = []
  let assignableTeams: Awaited<ReturnType<typeof listActiveTeams>> = []
  let unavailable = false
  try {
    ;[entries, assignableRoles, assignableTeams] = await Promise.all([listUserAccessEntries(), listAssignableRoles(), listActiveTeams()])
  } catch {
    unavailable = true
  }

  const canWrite = await hasPermission("user_access", "write")
  const canManageTeams = await hasPermission("team", "write")

  const navItems: SettingsNavItem[] = []
  if (sessionHasPermission(session, "reference_master", "read")) {
    navItems.push({ href: "/settings/customer-onboarding", label: "Reference Master" })
  }
  if (sessionHasPermission(session, "team", "read")) {
    navItems.push({ href: "/settings/teams", label: "Team Master" })
  }
  navItems.push({ href: "/settings/user-access", label: "User Access" })

  return (
    <AuthGate session={session} requiredPermission={USER_ACCESS_READ} loginRedirectTo="/settings/user-access">
      <SettingsNav items={navItems} />
      {unavailable ? (
        <div className="flex flex-1 flex-col">
          <p className="p-6 text-xs text-muted-foreground">User Access could not be read right now. Please try again shortly.</p>
        </div>
      ) : (
        <UserAccessPage
          entries={entries}
          assignableRoles={assignableRoles}
          assignableTeams={assignableTeams}
          canWrite={canWrite}
          canManageTeams={canManageTeams}
        />
      )}
    </AuthGate>
  )
}
