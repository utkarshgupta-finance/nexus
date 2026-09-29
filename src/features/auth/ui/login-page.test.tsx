import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

// `login-page.tsx` statically imports the real "use server" signInAction,
// which itself imports a "server-only"-guarded module; under this test's
// jsdom environment (window defined) that throws for real, exactly as it
// would in a genuine client bundle, so it must be mocked out to test the
// Client Component in isolation.
vi.mock("../actions", () => ({ signInAction: vi.fn() }))
// `useRouter` requires a real Next.js App Router context, which
// renderToStaticMarkup does not provide; only the static banner/form
// markup is under test here, never client-side navigation.
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }))

import { LoginPage } from "./login-page"

/**
 * PG-059: the login page must show a distinct "your session expired"
 * message only when the login route was reached via AuthGate's
 * `reason=session-expired` redirect, never for an ordinary first-time
 * visit to /login.
 */
describe("LoginPage", () => {
  it("PG-059: shows no session-expired banner for an ordinary logged-out visit", () => {
    const html = renderToStaticMarkup(<LoginPage redirectTo="/my-work" />)
    expect(html).not.toContain("Your session expired")
    expect(html).toContain("Sign in to continue.")
  })

  it("PG-059: shows the session-expired banner when sessionExpired is true", () => {
    const html = renderToStaticMarkup(<LoginPage redirectTo="/my-work" sessionExpired />)
    expect(html).toContain("Your session expired. Please sign in again to continue.")
  })

  it("PG-059: does not show the session-expired banner when sessionExpired is explicitly false", () => {
    const html = renderToStaticMarkup(<LoginPage redirectTo="/my-work" sessionExpired={false} />)
    expect(html).not.toContain("Your session expired")
  })
})
