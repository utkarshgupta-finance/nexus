import { AuthGate } from "@/components/product/auth-gate"
import { SettingsNav } from "@/components/product/settings-nav"
import type { SettingsNavItem } from "@/components/product/settings-nav"
import { getCurrentNexusSession } from "@/platform/auth/server"
import { hasPermission } from "@/platform/permissions/server"
import { sessionHasPermission } from "@/platform/permissions"
import { listUserAccessEntries, listAssignableRoles } from "@/platform/user-access/server"
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
  let unavailable = false
  try {
    ;[entries, assignableRoles] = await Promise.all([listUserAccessEntries(), listAssignableRoles()])
  } catch {
    unavailable = true
  }

  const canWrite = await hasPermission("user_access", "write")

  const navItems: SettingsNavItem[] = [{ href: "/settings/user-access", label: "User Access" }]
  if (sessionHasPermission(session, "reference_master", "read")) {
    navItems.unshift({ href: "/settings/customer-onboarding", label: "Reference Master" })
  }

  return (
    <AuthGate session={session} requiredPermission={USER_ACCESS_READ} loginRedirectTo="/settings/user-access">
      <SettingsNav items={navItems} />
      {unavailable ? (
        <div className="flex flex-1 flex-col">
          <p className="p-6 text-xs text-muted-foreground">User Access could not be read right now. Please try again shortly.</p>
        </div>
      ) : (
        <UserAccessPage entries={entries} assignableRoles={assignableRoles} canWrite={canWrite} />
      )}
    </AuthGate>
  )
}
