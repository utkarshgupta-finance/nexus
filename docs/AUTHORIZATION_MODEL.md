# Nexus: Authorization Model

This document defines the data-driven authorization model for Nexus. It
contains no real Nexus role names, permission lists, or organizational
structure. Every role and permission named below is a generic,
illustrative example only.

**Status: [IMPLEMENTED] as of 2026-09-12.** See
`docs/PLATFORM_ARCHITECTURE.md` §8 for how authorization relates to
identity, assignment, and workflow. §§1-9 below describe the design as
originally locked; §§10-15 describe what actually exists now: real
Supabase Auth sessions, a real `app_users` mapping, a real permission
resolver, and real server-side enforcement on the Customer Onboarding
Settings workspace. `roles`/`permissions`/`role_permissions`/`user_roles`
have existed as schema since Migration 1
(`supabase/migrations/20260906084244_platform_core_foundation.sql`); this
round is what seeds a first real permission catalog into them and builds
the application-service enforcement layer this document always
described but never had code behind.

## 1. Principle: data-driven, not hardcoded

Role names are never hardcoded into feature logic. A feature checks
whether the current user has a **permission** to perform an **action** on
a **resource**, optionally within a **scope**. Which roles grant that
permission is configuration, changed without a code deploy. This is what
keeps the role list open: adding, renaming, or regranting a role is a data
change in `platform/permissions/`, never a change to feature code.

## 2. Identity vs authorization

Supabase Auth is the authentication identity provider: it answers "who is
this person." Nexus authorization, entirely separate, answers "what is
this person allowed to do." Nexus role and permission logic is never
stored in Supabase Auth metadata or provider groups; it lives in the
tables in §4, which the application queries directly.

The application maintains its own profile table, `app_users`, in a strict
1:1 relationship with Supabase's `auth.users`: the Nexus application user
ID reuses the `auth.users` UUID rather than minting a second identifier.
`app_users` holds only the minimal application-level profile Nexus needs;
it does not hold roles, permissions, or speculative profile fields. See
`docs/DATA_ARCHITECTURE.md` §2 for the table shape.

The specific login method behind Supabase Auth (Google Workspace,
Microsoft, passwordless, or another supported provider) is still deferred
and does not affect this model: whichever provider is chosen, it only ever
answers "who," never "what is allowed."

## 3. Core model: resource + action + scope

```
User --- has role assignments ---> Role
Role --- has permission assignments ---> Permission
Permission = Resource + Action
Role assignment (User, Role) is optionally qualified by a Scope
```

- **Resource**: what is acted on, at the type level (a work item, a
  configuration setting), not a specific record. Distinct from the
  Resource Registry in `docs/DATA_ARCHITECTURE.md` §2, which identifies
  specific record instances; a permission's "resource" is the type those
  instances belong to.
- **Action**: what is attempted (view, create, edit, submit, approve, send
  back, delete, configure).
- **Scope**: the boundary an assignment applies within (§5).

## 4. Entities

| Entity | Purpose |
|---|---|
| `app_users` | Application profile, 1:1 with Supabase `auth.users` (§2). This document covers authorization, not authentication. |
| `roles` | Named, configurable groupings of permissions. |
| `permissions` | Resource + action pairs, registered as features are built. |
| `role_permissions` | Which permissions a role grants. Historical grant record, see below. |
| `user_roles` | Which roles a user holds, optionally scoped (§5). Historical grant record, see below. |

A feature that introduces a new resource registers its permissions the
same way any feature registers a reference value: as configuration,
reviewed like any other configuration change, never as a schema change
scattered through feature code.

**Historical grant records, not hard delete.** For a Finance platform
subject to audit, "who has access now" is not the only question that must
be efficiently answerable; "who had access on a given historical date,
under which role and scope, who granted it, when, who revoked it, when,
and why" must be too. Reconstructing that solely by replaying generic
`audit_log` JSON works, but is not the primary path Nexus relies on for
something this material. `user_roles` and `role_permissions` are
therefore historical grant records, not rows that are physically deleted
on revoke: granting reuses the existing `created_at`/`created_by`
semantics (no duplicate columns for naming purity), and revoking sets
`revoked_at`, `revoked_by`, and an optional `revocation_reason` on the
same row rather than deleting it. An active grant is
`revoked_at IS NULL`; a revoked one is preserved exactly as it was. The
partial-unique-index pattern already used for global versus scoped
assignment (§5) extends naturally: uniqueness applies only among currently
active rows, never among historical ones, so a user can be re-granted a
role they previously held without colliding with their own history. Grant
and revoke are still each independently captured by the generic audit
trigger (an `INSERT` and a later `UPDATE` respectively), which is a
byproduct of this design, not a replacement for it: the grant/revoke
history is queryable directly from `user_roles`/`role_permissions`
without joining `audit_log` at all. Full column shape in
`docs/DATA_ARCHITECTURE.md` §13.

## 5. Scope: immediate model and extension path

A role assignment can be global or scoped. Scope is carried as a single
nullable column, `scope_resource_id`, referencing
`resources.resource_id` (`docs/DATA_ARCHITECTURE.md` §2), rather than a
separate `scope_type` plus `scope_id` pair. The Resource Registry already
tags every resource with its type, so a second type column on `user_roles`
would only duplicate what the registry already knows. `NULL` means global
assignment; a non-null value scopes the assignment to that resource,
whatever type it is.

**Immediate implementation supports global (`scope_resource_id IS NULL`)
assignment only.** No scoped assignment is created yet.

**Extension path, preserved but not built:** Nexus may eventually need
hierarchical organizational scope, conceptually
`organization -> legal entity -> business unit -> customer -> module`. Three
approaches were considered:

| Approach | Verdict |
|---|---|
| A dedicated assignment table per scope type | Rejected. Defeats the goal of an open, configurable scope list; a new scope type would need a new table and a migration. |
| A flat scope reference with no hierarchy (the model adopted) | Correct starting point, but alone cannot express "access to legal entity B implies access to business units under B" without enumerating every child at assignment time. |
| A scope hierarchy table (`org_scopes`: `resource_id`, `parent_resource_id`), with an optional closure table as a later performance optimization | The right future extension. Not built today. |

Because `scope_resource_id` already points into the Resource Registry, the
hierarchy table above can be added later purely additively: it FKs to
`resources.resource_id` the same way `user_roles.scope_resource_id` does,
and only the permission-check query needs to learn to walk parent scopes.
`user_roles` and `role_permissions` are never touched.

## 6. Enforcement layers

Authorization is checked in the application-service layer
(`docs/PLATFORM_ARCHITECTURE.md` §2), as close to the business action as
possible. The UI uses the same permission data to decide what to render,
but that is a convenience, not the enforcement point: the application
service re-checks before executing the action regardless of what the UI
allowed. This is what lets a future scheduled job, integration, or API
call the same application service under the same check, with no separate
permission system to keep in sync.

PostgreSQL Row Level Security, enabled by default on application tables
(`docs/DATA_ARCHITECTURE.md` §12), is a defense-in-depth boundary beneath
this, not a replacement for it. RLS policies are not designed to express
the full `roles`/`permissions`/`scope` model; they exist to deny
unauthorized direct table access if the application layer is ever
bypassed, while the application-service layer remains the primary,
authoritative enforcement point.

Beneath RLS is a third layer: ordinary PostgreSQL table privileges. Since
Nexus's browser and mobile clients have no legitimate reason to reach
Platform Core tables directly, direct-access privileges for those roles
are revoked, not merely denied by an RLS policy that a future migration
could accidentally weaken. Full detail in
`docs/DATA_ARCHITECTURE.md` §12.

## 7. Authorization, assignment, and workflow are distinct

Three different questions must never collapse into one:

- "Is this user permitted to perform this action on this kind of record at
  all" (authorization, this document).
- "Is this specific record assigned to this user right now" (assignment,
  `tasks`, `docs/PLATFORM_ARCHITECTURE.md` §6 and §8).
- "Is this workflow instance currently in a state where this action is
  valid" (workflow state, `docs/PLATFORM_ARCHITECTURE.md` §6).

A user can be authorized to approve and still be blocked because the
record is not in an approvable state; a task can be assigned to a user who
individually lacks the permission that task's action requires; a record
can be approvable while a specific user is not authorized to approve it.
All relevant checks must pass, and none of them is derived from the
others. Maker/checker separation (a user cannot check their own
submission) is a workflow-level rule that consults both the audit trail
(who submitted) and the authorization check (who may approve), not a
special case bolted onto either system.

## 8. UX consequence

Because authorization, assignment, and workflow state are all data, a
record's available actions, and whether it appears in a given user's My
Work queue at all, are computed from that data rather than hardcoded per
screen. See `docs/PLATFORM_ARCHITECTURE.md` §11.

## 9. What §§1-8 do not cover

No real Nexus role, permission, or organizational scope is named in
§§1-8. Specific resources and actions for any real feature are defined
when that feature is built, against its approved product requirements,
not against anything in this document.

## 10. [IMPLEMENTED] Authentication provider: Supabase Auth

Supabase Auth is the authentication identity provider (§2 already
anticipated this; this section states the concrete implementation).
**Auth method: email + password.** Chosen over magic link or OAuth for
V1 because it needs no external email delivery dependency and no OAuth
app registration, matching the task's own "prefer a simple V1" guidance;
password verification is handled entirely by Supabase Auth, Nexus never
stores or sees a password beyond the single sign-in call
(`src/features/auth/actions.ts`). Revisit this choice if a real business
requirement (SSO with an existing identity provider, for example) asks
for it later; nothing in the identity/authorization boundary below
depends on which method was chosen.

Three distinct Supabase clients now exist, each with a narrow, named
purpose:

- `src/lib/supabase/browser-client.ts`: anon key, browser-only, used only
  where a Client Component needs a Supabase session operation directly
  (none currently do; sign-in/sign-out run as Server Actions instead, see
  §11).
- `src/lib/supabase/server-auth-client.ts`: anon key, server-only, reads
  the authenticated user from the request's own session cookie. This is
  the authoritative "who is calling" source (`src/platform/auth/
  server.ts`).
- `src/lib/supabase/server-client.ts` (already existed): service role
  key, server-only, privileged execution path. Never an identity source;
  see §2 and §14.

`middleware.ts` refreshes the session cookie on every request (the
standard `@supabase/ssr` Next.js pattern) and enforces nothing itself;
enforcement stays in the application-service layer per §6.

## 11. [IMPLEMENTED] App user mapping and provisioning

`app_users.id` reuses `auth.users.id` directly (Migration 1); no
`auth_user_id` column or second mapping table was needed or added. An
authenticated Supabase Auth user with no matching `app_users` row is
`unprovisioned`: Nexus never auto-creates an `app_users` row or grants
default access just because someone can authenticate (task correction
§6). Provisioning a real user means inserting their `app_users` row (and
any `user_roles` grant) as a deliberate administrative action; nothing
in this round builds a self-service provisioning UI, since granting
Nexus access is exactly the kind of action that should never be
self-service.

## 12. [IMPLEMENTED] Current session/user contract

`src/platform/auth/server.ts`'s `getCurrentNexusSession()` is the one
place the rest of the app derives identity, returning a Nexus-owned
`NexusSession` (`src/platform/auth/domain/types.ts`), never a raw
Supabase `User`/`Session` or raw `app_users`/`roles`/`permissions` row.
Five distinct states, all deliberately kept apart rather than collapsed
into `user | null` (task correction §26):

- `unauthenticated`: no valid session at all.
- `unavailable`: the session/backend itself could not be resolved (a
  missing environment variable, a database/network failure). Distinct
  from `unauthenticated`: a visitor who is genuinely signed out is not
  the same as a visitor whose status could not be determined.
- `unprovisioned`: a real session, but no `app_users` row.
- `inactive`: an `app_users` row exists, `is_active = false`.
- `active`: a real, active user, carrying whatever roles/permissions
  their current global `user_roles`/`role_permissions` grants resolve
  to.

Every state except `active` denies every governed action; only `active`
ever carries a non-empty `permissions` array.

## 13. [IMPLEMENTED] Permission resolution and enforcement guards

`src/platform/permissions/server.ts` exports `hasPermission(resource,
action)` (read-only check, never throws) and `requirePermission(resource,
action)` (deny-by-default enforcement, throws `AuthorizationError` naming
the specific denial reason, returns the active session, with a real
`appUserId`, only when every check passes). Resolution walks exactly the
chain §3 describes: `app_users -> user_roles (active, global) -> roles
(active) -> role_permissions (active) -> permissions (active)`
(`src/platform/auth/data/rbac.data.ts`). `src/platform/permissions/
domain/has-permission.ts`'s `sessionHasPermission` is the pure check
underneath both, safe to reuse anywhere a session has already been
fetched (a Server Component deciding what to render) without a second
database round trip.

These guards are deliberately feature-agnostic (task correction §27):
`requirePermission("reference_master", "write")` today, and the same
function, unchanged, is what a future Commercial Configuration write,
Customer Master Change Request, Legal approval, Workflow approval, or
form submission action calls with its own resource/action pair. Nothing
here is coupled to Settings.

## 14. [IMPLEMENTED] Reference Master permissions and enforcement

Two permissions exist today (`supabase/migrations/
20260912150000_auth_authorization_foundation.sql`): `reference_master`
`read` and `reference_master` `write`. Two illustrative roles grant them:
`reference_master_viewer` (read only) and `reference_master_admin` (read
and write); neither is a real Nexus organizational title, matching §1's
own naming principle.

`/settings/customer-onboarding` requires `reference_master.read` to view
at all (`src/components/product/auth-gate.tsx`, wrapping the route);
every mutating Server Action in `src/features/reference-data/actions.ts`
independently requires `reference_master.write` before performing any
write, deriving the actor from the resolved session, never from a
client-supplied parameter. The Settings UI itself also reads whether the
current session can write and hides Add/Activate/Deactivate/governed-
value-edit controls entirely when it cannot (task correction §22:
"prefer a clear read-only treatment," never a control that is shown but
will always fail); this is a rendering convenience only, the Server
Action's own check is what actually enforces this, exactly as §6
already stated for the general model.

**Actor-aware audit.** `reference_options` writes moved from plain
PostgREST `insert`/`update` calls into RPC functions
(`add_reference_option`, `set_reference_option_active`,
`update_currency_inr_conversion_rate`, `update_invoice_frequency_cadence`),
matching the exact `set_config('app.current_user_id', ...)`-then-mutate
pattern every Commercial RPC already used
(`docs/DATA_ARCHITECTURE.md` §9): this is the only way a real actor
identity reaches `audit_log.actor_user_id`, since PostgREST gives each
plain `.insert()`/`.update()` call its own transaction, and the audit
trigger reads a transaction-local Postgres setting. `actorUserId = null`
is retained only for genuinely system-originated writes (none exist for
Reference Master today; every current write is a real authenticated
Settings action).

## 16. [IMPLEMENTED] Commercial Configuration permissions and enforcement

Two permissions exist (`supabase/migrations/
20260912210000_commercial_configuration_persistence.sql`):
`commercial_configuration` `read` and `commercial_configuration` `write`,
seeded the same way §14 seeded Reference Master's. Two roles grant them:
`commercial_configuration_viewer` (read only) and
`commercial_configuration_admin` (read and write), same naming
convention as §14's roles, not real organizational titles.

`/commercials/[configId]` requires `commercial_configuration.read` to
view at all (`AuthGate`, same mechanism as §14). Every promotion write
(`src/features/customer-onboarding/actions.ts`) independently requires
`commercial_configuration.write` before performing any write, deriving
the actor from the resolved session, and passes that real `appUserId`
into every write RPC as the audit actor, matching §14's own
`set_config('app.current_user_id', ...)`-then-mutate pattern exactly. See
docs/COMMERCIAL_DOMAIN_ARCHITECTURE.md §22a for the full promotion/
versioning architecture this enforces.

## 17. Root cause: a missing Settings nav link is a provisioning gap, not a permission bug

Diagnosed 2026-09-12, when a user reported the Settings link had
disappeared on Vercel Preview. `src/app/layout.tsx` computes
`canReadSettings` from `sessionHasPermission(session, "reference_master",
"read")` (§14), which is correctly `false` for any session that is not
`active` (§12). A direct query confirmed zero rows in `auth.users` in
this project: no Supabase Auth account, therefore no `app_users` row, has
ever existed. The Settings link was never actually broken by a code
change; nobody with a real, provisioned identity had ever visited the
Preview deployment since authentication was introduced. The fix is
provisioning one real admin identity (§11's "no self-service provisioning
UI" limitation, below), never relaxing `canReadSettings`'s own check.

## 18. Current limitations, honestly stated

- **Global permissions only.** `user_roles.scope_resource_id` is never
  populated by this round; every grant is global, matching §5's own
  "immediate implementation supports global assignment only." Scoped
  authorization (a role limited to one customer, one business unit) is
  still the documented future extension in §5, not built.
- **No self-service provisioning UI.** Granting `app_users`/`user_roles`
  rows today is a direct administrative action (a migration for
  catalog-level roles/permissions, a data insert for a specific user's
  grant), not a Settings screen. Building that UI is future work, not
  a security gap: the underlying tables and enforcement are real either
  way. This is also the direct cause of §17: with no such UI, and no
  automated way to create a Supabase Auth user without the public signup
  API (which this project's own email-confirmation setting gates),
  provisioning the first real Preview admin is a manual, one-time step.
- **Reference Master and Commercial Configuration are protected today.**
  `requirePermission` is feature-agnostic and ready for reuse (§13), and
  as of 2026-09-12 both `src/features/reference-data/actions.ts` and
  `src/features/customer-onboarding/actions.ts` (Commercial Configuration
  promotion) call it. Every other route/action in Nexus remains
  unauthenticated-reachable, an explicitly disclosed gap, not a silently
  broken promise, to be closed feature by feature as each is built out.
- **RLS remains deny-by-default, not user-aware.** No user-session RLS
  policy was introduced this round; Platform Core tables remain denied
  to `anon`/`authenticated` entirely, and the service-role client
  (bypassing RLS) is still the only path that reaches them, gated by the
  application-service checks in §13-14/§16, exactly the layering §6
  already specified.
