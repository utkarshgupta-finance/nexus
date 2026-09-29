import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

import { AuthGate, lacksRecordPermission } from "./auth-gate"
import type { NexusSession } from "@/platform/auth"

/**
 * PG-059: `redirect()` throws (the real Next.js behavior, a special digest
 * error caught by the framework, not returned) so every redirect-branch
 * test below asserts on the thrown call's argument via this mock rather
 * than on rendered output. `vi.hoisted` is required because `vi.mock`'s
 * factory is itself hoisted above any plain top-level `const`.
 */
const { redirectMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }),
}))
vi.mock("next/navigation", () => ({ redirect: redirectMock }))

/**
 * `AuthGate` takes `session` as a plain prop, so every non-redirect branch
 * (unavailable/unprovisioned/inactive/restricted) is exercisable by genuine
 * rendering with a controlled session value, without needing a real
 * backend failure or a live browser. This is the same real component every
 * governed page renders; only the input is a test double, not the output.
 */
describe("AuthGate", () => {
  it("renders the honest backend/infra-failure message for an unavailable session", () => {
    const session: NexusSession = { status: "unavailable" }
    const html = renderToStaticMarkup(
      <AuthGate session={session} requiredPermission={{ resource: "user_access", action: "read" }} loginRedirectTo="/settings/user-access">
        <div>should not render</div>
      </AuthGate>
    )
    expect(html).toContain("Session unavailable")
    expect(html).toContain("Nexus could not verify your session right now")
    expect(html).not.toContain("should not render")
  })

  it("renders the honest offboarded message for an inactive session, unaffected by PG-059's expired-session change", () => {
    const session: NexusSession = { status: "inactive", authUserId: "auth-1", email: "x@example.test", appUserId: "app-1" }
    const html = renderToStaticMarkup(
      <AuthGate session={session} requiredPermission={{ resource: "customer", action: "read" }} loginRedirectTo="/customers">
        <div>should not render</div>
      </AuthGate>
    )
    expect(html).toContain("Account inactive")
    expect(html).not.toContain("should not render")
  })

  it("PG-059: redirects to /login with no reason param for a genuinely unauthenticated (never signed in) session", () => {
    redirectMock.mockClear()
    const session: NexusSession = { status: "unauthenticated" }
    expect(() =>
      renderToStaticMarkup(
        <AuthGate session={session} requiredPermission={{ resource: "customer", action: "read" }} loginRedirectTo="/customers">
          <div>should not render</div>
        </AuthGate>
      )
    ).toThrow()
    expect(redirectMock).toHaveBeenCalledWith("/login?redirectTo=%2Fcustomers")
  })

  it("PG-059: redirects to /login with reason=session-expired for a session that was valid and has since expired", () => {
    redirectMock.mockClear()
    const session: NexusSession = { status: "unauthenticated", expired: true }
    expect(() =>
      renderToStaticMarkup(
        <AuthGate session={session} requiredPermission={{ resource: "customer", action: "read" }} loginRedirectTo="/customers">
          <div>should not render</div>
        </AuthGate>
      )
    ).toThrow()
    expect(redirectMock).toHaveBeenCalledWith("/login?redirectTo=%2Fcustomers&reason=session-expired")
  })
})

/**
 * S-014 Product Decision (2026-09-27): governed request-detail routes call
 * `notFound()` instead of rendering `AuthGate`'s own "Access restricted"
 * message when a real record's viewer lacks permission, so a nonexistent
 * and an unauthorized record are indistinguishable. Scoped to the active
 * session only; every other session status is `AuthGate`'s own concern.
 */
describe("lacksRecordPermission", () => {
  const activeSession = (permissions: { resource: string; action: string }[]): NexusSession => ({
    status: "active",
    authUserId: "auth-1",
    email: "x@example.test",
    appUserId: "app-1",
    roles: [],
    permissions,
  })

  it("returns false when the active session holds the required permission", () => {
    const session = activeSession([{ resource: "customer", action: "read" }])
    expect(lacksRecordPermission(session, { resource: "customer", action: "read" })).toBe(false)
  })

  it("returns true when the active session lacks the required permission and no scoped grant was resolved", () => {
    const session = activeSession([])
    expect(lacksRecordPermission(session, { resource: "customer", action: "read" })).toBe(true)
  })

  it("returns false when a resolved scoped grant (additionalAccessGranted) covers this specific record", () => {
    const session = activeSession([])
    expect(lacksRecordPermission(session, { resource: "customer", action: "read" }, true)).toBe(false)
  })

  it("returns false for a non-active session, deferring entirely to AuthGate's own account-level handling", () => {
    const session: NexusSession = { status: "unprovisioned", authUserId: "auth-1", email: "x@example.test" }
    expect(lacksRecordPermission(session, { resource: "customer", action: "read" })).toBe(false)
  })
})
