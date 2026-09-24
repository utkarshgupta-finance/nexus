import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { AuthGate } from "./auth-gate"
import type { NexusSession } from "@/platform/auth"

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
})
