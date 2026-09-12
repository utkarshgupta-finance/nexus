import { redirect } from "next/navigation"

import { sessionHasPermission } from "@/platform/permissions"
import type { NexusSession } from "@/platform/auth"
import { PageHeader } from "./page-header"

/**
 * Reusable server-side route protection (task correction §20, §27): any
 * governed page wraps its content in this gate instead of inventing its
 * own auth-state handling. Authentication and authorization are checked
 * here, but this is a rendering convenience, not the enforcement
 * boundary itself: every underlying Server Action still enforces
 * `requirePermission` independently (`src/platform/permissions/
 * server.ts`), so a future consumer that forgets to wrap a page in this
 * gate still cannot bypass a governed mutation by calling its Server
 * Action directly.
 *
 * Distinguishes every state task correction §26 requires: unauthenticated
 * redirects to `/login` (never silently renders empty or fake data),
 * unprovisioned/inactive/missing-permission each show their own honest
 * message, never a generic "access denied" that hides which of the three
 * actually applies.
 */
function AuthGate({
  session,
  requiredPermission,
  loginRedirectTo,
  children,
}: {
  session: NexusSession
  requiredPermission: { resource: string; action: string }
  loginRedirectTo: string
  children: React.ReactNode
}) {
  if (session.status === "unauthenticated") {
    redirect(`/login?redirectTo=${encodeURIComponent(loginRedirectTo)}`)
  }

  if (session.status === "unavailable") {
    return (
      <div className="flex flex-1 flex-col">
        <PageHeader
          title="Session unavailable"
          description="Nexus could not verify your session right now. Try reloading the page; contact your administrator if this continues."
        />
      </div>
    )
  }

  if (session.status === "unprovisioned") {
    return (
      <div className="flex flex-1 flex-col">
        <PageHeader
          title="Access not provisioned"
          description={`Your account (${session.email ?? "unknown"}) is authenticated but has not been granted access to Nexus. Contact your administrator.`}
        />
      </div>
    )
  }

  if (session.status === "inactive") {
    return (
      <div className="flex flex-1 flex-col">
        <PageHeader title="Account inactive" description="Your Nexus account is no longer active. Contact your administrator." />
      </div>
    )
  }

  if (!sessionHasPermission(session, requiredPermission.resource, requiredPermission.action)) {
    return (
      <div className="flex flex-1 flex-col">
        <PageHeader
          title="Access restricted"
          description={`You do not have permission to view this page (requires ${requiredPermission.resource}.${requiredPermission.action}). Contact your administrator.`}
        />
      </div>
    )
  }

  return <>{children}</>
}

export { AuthGate }
