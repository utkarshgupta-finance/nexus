import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { ResponsibleTeamInactiveBanner } from "./responsible-team-inactive-banner"

describe("ResponsibleTeamInactiveBanner (Product Gap Closure, PG-040)", () => {
  it("renders nothing when there is no responsible team at all", () => {
    const html = renderToStaticMarkup(<ResponsibleTeamInactiveBanner responsibleTeamStatus={null} />)
    expect(html).toBe("")
  })

  it("renders nothing when the responsible team is active", () => {
    const html = renderToStaticMarkup(
      <ResponsibleTeamInactiveBanner responsibleTeamStatus={{ teamId: "team-1", teamName: "Legal", isActive: true }} />
    )
    expect(html).toBe("")
  })

  it("renders a warning naming the team when the responsible team is inactive, without implying members are blocked", () => {
    const html = renderToStaticMarkup(
      <ResponsibleTeamInactiveBanner responsibleTeamStatus={{ teamId: "team-1", teamName: "West Region Finance", isActive: false }} />
    )
    expect(html).toContain("West Region Finance")
    expect(html).toContain("has been deactivated")
    expect(html).toContain("Existing eligible members of this team can still act on this request")
  })
})
