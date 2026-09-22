import { describe, expect, it } from "vitest"

import { sessionHasPermission } from "./has-permission"
import type { NexusSession } from "@/platform/auth"

const UNAUTHENTICATED: NexusSession = { status: "unauthenticated" }
const UNAVAILABLE: NexusSession = { status: "unavailable" }
const UNPROVISIONED: NexusSession = { status: "unprovisioned", authUserId: "auth-1", email: "new@example.com" }
const INACTIVE: NexusSession = { status: "inactive", authUserId: "auth-1", email: "offboarded@example.com", appUserId: "app-1" }

function activeSession(permissions: { resource: string; action: string }[]): NexusSession {
  return {
    status: "active",
    authUserId: "auth-1",
    email: "user@example.com",
    appUserId: "app-1",
    roles: [{ code: "reference_master_admin", name: "Reference Master Admin" }],
    permissions,
  }
}

describe("sessionHasPermission: deny-by-default over every session state", () => {
  it("denies when unauthenticated", () => {
    expect(sessionHasPermission(UNAUTHENTICATED, "reference_master", "read")).toBe(false)
  })

  it("denies when the session/backend itself is unavailable (distinct from unauthenticated, task correction §26)", () => {
    expect(sessionHasPermission(UNAVAILABLE, "reference_master", "read")).toBe(false)
  })

  it("denies when authenticated but unprovisioned (no app_users row)", () => {
    expect(sessionHasPermission(UNPROVISIONED, "reference_master", "read")).toBe(false)
  })

  it("denies when the app_user is inactive", () => {
    expect(sessionHasPermission(INACTIVE, "reference_master", "read")).toBe(false)
  })

  it("denies an active user with zero permissions", () => {
    expect(sessionHasPermission(activeSession([]), "reference_master", "read")).toBe(false)
  })

  it("grants an active user holding the exact resource+action", () => {
    const session = activeSession([{ resource: "reference_master", action: "read" }])
    expect(sessionHasPermission(session, "reference_master", "read")).toBe(true)
  })

  it("denies when the user holds a different action on the same resource", () => {
    const session = activeSession([{ resource: "reference_master", action: "read" }])
    expect(sessionHasPermission(session, "reference_master", "write")).toBe(false)
  })

  it("denies when the user holds the same action on a different resource", () => {
    const session = activeSession([{ resource: "customer_master", action: "read" }])
    expect(sessionHasPermission(session, "reference_master", "read")).toBe(false)
  })

  it("grants read and write independently when both are held (multiple roles union correctly)", () => {
    const session = activeSession([
      { resource: "reference_master", action: "read" },
      { resource: "reference_master", action: "write" },
    ])
    expect(sessionHasPermission(session, "reference_master", "read")).toBe(true)
    expect(sessionHasPermission(session, "reference_master", "write")).toBe(true)
  })

  it("denies the Operational Queue's customer.read gate for a real narrow-permission holder (M-019): go_live approve access does not imply queue access", () => {
    // Real permission set confirmed live against a real WF-TEST user
    // holding the real "Go Live Admin" role: go_live.approve/create/read/
    // submit plus workflow_definition.publish/read/write, and genuinely
    // zero customer.* permissions of any kind.
    const goLiveAdminOnly = activeSession([
      { resource: "go_live", action: "approve" },
      { resource: "go_live", action: "create" },
      { resource: "go_live", action: "read" },
      { resource: "go_live", action: "submit" },
      { resource: "workflow_definition", action: "publish" },
      { resource: "workflow_definition", action: "read" },
      { resource: "workflow_definition", action: "write" },
    ])
    expect(sessionHasPermission(goLiveAdminOnly, "go_live", "approve")).toBe(true)
    expect(sessionHasPermission(goLiveAdminOnly, "customer", "read")).toBe(false)
  })
})
