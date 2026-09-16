import { redirect } from "next/navigation"

import { LoginPage } from "@/features/auth/ui/login-page"
import { sanitizeRedirectTarget } from "@/features/auth/domain/redirect-target"
import { getCurrentNexusSession } from "@/platform/auth/server"

export const dynamic = "force-dynamic"

export default async function LoginRoute({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string }>
}) {
  const session = await getCurrentNexusSession()
  const { redirectTo } = await searchParams
  const target = sanitizeRedirectTarget(redirectTo)

  // Only redirect away from login for a genuinely resolved authenticated
  // identity; "unavailable" (task correction §26, session/backend
  // failure) must still show the login form, not bounce the visitor
  // somewhere that will fail the same way.
  if (session.status === "unprovisioned" || session.status === "inactive" || session.status === "active") {
    redirect(target)
  }

  return <LoginPage redirectTo={target} />
}
