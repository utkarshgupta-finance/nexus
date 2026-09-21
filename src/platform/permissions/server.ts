import "server-only"

import { getCurrentNexusSession } from "@/platform/auth/server"
import type { ActiveNexusUser } from "@/platform/auth"
import { AuthorizationError } from "./domain/errors"
import { sessionHasPermission } from "./domain/has-permission"
import {
  userHasCustomerScopedPermission,
  userHasBusinessUnitScopedPermission,
  getScopedCustomerIds,
  getScopedBusinessUnits,
  userHasAnyScopedPermission,
} from "./data/scoped-permission.data"

/**
 * TRUSTED, SERVER-ONLY authorization entry point, reusable by any future
 * module (task correction §27: Commercial Configuration writes, Customer
 * Master Change Requests, Legal approvals, Workflow approvals, form
 * submission actions, Finance controls). Every governed mutation in
 * Nexus must go through `requirePermission`, never invent a parallel
 * check (`CLAUDE.md`'s durable operating principle, task correction §36).
 */

/** Read-only check: does the current session hold this permission right now. Never throws; used where a caller wants to branch on the answer (read-only vs write-capable UI), not enforce it. */
async function hasPermission(resource: string, action: string): Promise<boolean> {
  const session = await getCurrentNexusSession()
  return sessionHasPermission(session, resource, action)
}

/**
 * Deny-by-default enforcement. Resolves the current session and returns
 * it, narrowed to the `active` case (which carries a real `appUserId`,
 * safe to use as an audit actor) only when every one of these holds:
 * authenticated, provisioned (`app_users` row exists), active
 * (`is_active = true`), and the required permission is present. Throws
 * `AuthorizationError` otherwise, naming the specific reason, and never
 * fails open: a database error resolving the session propagates as a
 * thrown error too, never as a silently-granted permission.
 */
async function requirePermission(resource: string, action: string): Promise<ActiveNexusUser> {
  const session = await getCurrentNexusSession()

  if (session.status === "unauthenticated") {
    throw new AuthorizationError("unauthenticated", "You must be signed in to perform this action.")
  }
  if (session.status === "unavailable") {
    throw new AuthorizationError("unavailable", "Nexus could not verify your session right now. Please try again.")
  }
  if (session.status === "unprovisioned") {
    throw new AuthorizationError("unprovisioned", "Your account is authenticated but has not been granted access to Nexus.")
  }
  if (session.status === "inactive") {
    throw new AuthorizationError("inactive", "Your Nexus account is no longer active.")
  }
  if (!sessionHasPermission(session, resource, action)) {
    throw new AuthorizationError("missing_permission", `You do not have permission to ${action} ${resource}.`)
  }

  return session
}

/**
 * PD-005 (D-022, Batches 1-13 Ledger Audit product decision closure):
 * the customer-record-aware sibling of `hasPermission`/`requirePermission`.
 * A holder of the plain global permission passes exactly as before (the
 * fast, already-resolved `sessionHasPermission` check, no extra
 * database round trip). A user who does NOT hold the global permission
 * may still pass if they hold a Business Unit, Territory, or specific
 * Customer scoped grant that covers this exact customer record
 * (`fn_user_has_customer_scoped_permission`); a user with neither is
 * denied. This is the server-side enforcement point: it is never
 * sufficient to only filter what a list UI renders (CLAUDE.md's "not
 * only in the UI" principle applies to scope exactly as it already does
 * to permissions generally).
 */
async function hasPermissionForCustomer(resource: string, action: string, customerId: string): Promise<boolean> {
  const session = await getCurrentNexusSession()
  if (session.status !== "active") return false
  if (sessionHasPermission(session, resource, action)) return true
  return userHasCustomerScopedPermission(session.appUserId, resource, action, customerId)
}

/** Deny-by-default enforcement, scoped variant of `requirePermission`. See `hasPermissionForCustomer` above for the resolution order. */
async function requirePermissionForCustomer(resource: string, action: string, customerId: string): Promise<ActiveNexusUser> {
  const session = await getCurrentNexusSession()

  if (session.status === "unauthenticated") {
    throw new AuthorizationError("unauthenticated", "You must be signed in to perform this action.")
  }
  if (session.status === "unavailable") {
    throw new AuthorizationError("unavailable", "Nexus could not verify your session right now. Please try again.")
  }
  if (session.status === "unprovisioned") {
    throw new AuthorizationError("unprovisioned", "Your account is authenticated but has not been granted access to Nexus.")
  }
  if (session.status === "inactive") {
    throw new AuthorizationError("inactive", "Your Nexus account is no longer active.")
  }
  if (!sessionHasPermission(session, resource, action)) {
    const scoped = await userHasCustomerScopedPermission(session.appUserId, resource, action, customerId)
    if (!scoped) {
      throw new AuthorizationError("missing_permission", `You do not have permission to ${action} ${resource} for this customer.`)
    }
  }

  return session
}

/**
 * PD-005 follow-up (Product Decision Closure): the business-unit-only
 * sibling of `hasPermissionForCustomer`, for a record with no resolved
 * customer yet (a Customer Onboarding case before approval).
 */
async function hasPermissionForBusinessUnit(resource: string, action: string, businessUnit: string | null): Promise<boolean> {
  const session = await getCurrentNexusSession()
  if (session.status !== "active") return false
  if (sessionHasPermission(session, resource, action)) return true
  return userHasBusinessUnitScopedPermission(session.appUserId, resource, action, businessUnit)
}

/** Deny-by-default enforcement, business-unit-scoped variant. See `hasPermissionForBusinessUnit` above for the resolution order. */
async function requirePermissionForBusinessUnit(resource: string, action: string, businessUnit: string | null): Promise<ActiveNexusUser> {
  const session = await getCurrentNexusSession()

  if (session.status === "unauthenticated") {
    throw new AuthorizationError("unauthenticated", "You must be signed in to perform this action.")
  }
  if (session.status === "unavailable") {
    throw new AuthorizationError("unavailable", "Nexus could not verify your session right now. Please try again.")
  }
  if (session.status === "unprovisioned") {
    throw new AuthorizationError("unprovisioned", "Your account is authenticated but has not been granted access to Nexus.")
  }
  if (session.status === "inactive") {
    throw new AuthorizationError("inactive", "Your Nexus account is no longer active.")
  }
  if (!sessionHasPermission(session, resource, action)) {
    const scoped = await userHasBusinessUnitScopedPermission(session.appUserId, resource, action, businessUnit)
    if (!scoped) {
      throw new AuthorizationError("missing_permission", `You do not have permission to ${action} ${resource} for this business unit.`)
    }
  }

  return session
}

/**
 * PD-005 follow-up (Product Decision Closure): bulk resolution for a
 * list/search surface. Returns `null` to mean "no filtering needed, the
 * caller holds the global permission and sees everything" (the common
 * case, resolved from the already-fetched session with no database
 * call); returns a `Set<string>` of exactly the customer ids a scoped
 * caller may see otherwise (possibly empty). Callers must filter their
 * list against this set whenever it is not `null`; a `null` return must
 * never be treated as "empty."
 */
async function getVisibleCustomerIds(resource: string, action: string): Promise<Set<string> | null> {
  const session = await getCurrentNexusSession()
  if (session.status !== "active") return new Set()
  if (sessionHasPermission(session, resource, action)) return null
  return getScopedCustomerIds(session.appUserId, resource, action)
}

/** Bulk resolution sibling of `getVisibleCustomerIds`, for the business-unit-scoped case (Onboarding cases with no resolved customer yet). Same `null` = "unfiltered" contract. */
async function getVisibleBusinessUnits(resource: string, action: string): Promise<Set<string> | null> {
  const session = await getCurrentNexusSession()
  if (session.status !== "active") return new Set()
  if (sessionHasPermission(session, resource, action)) return null
  return getScopedBusinessUnits(session.appUserId, resource, action)
}

/**
 * PD-005 follow-up (Product Decision Closure): the page-level gate for a
 * list/search surface. A global holder passes with no database call.
 * Otherwise checks whether the user holds ANY scoped grant at all for
 * (resource, action): a scoped grant that currently matches zero rows
 * still passes (the page renders an honest empty result), only a user
 * with neither a global nor any scoped grant is denied.
 */
async function hasAnyPermission(resource: string, action: string): Promise<boolean> {
  const session = await getCurrentNexusSession()
  if (session.status !== "active") return false
  if (sessionHasPermission(session, resource, action)) return true
  return userHasAnyScopedPermission(session.appUserId, resource, action)
}

export {
  hasPermission,
  requirePermission,
  hasPermissionForCustomer,
  requirePermissionForCustomer,
  hasPermissionForBusinessUnit,
  requirePermissionForBusinessUnit,
  getVisibleCustomerIds,
  getVisibleBusinessUnits,
  hasAnyPermission,
}
