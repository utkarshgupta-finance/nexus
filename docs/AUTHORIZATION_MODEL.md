# Nexus: Authorization Model

This document defines the data-driven authorization model for Nexus. It
contains no real Nexus role names, permission lists, or organizational
structure. Every role and permission named below is a generic,
illustrative example only.

**Status: locked design.** See `docs/PLATFORM_ARCHITECTURE.md` §8 for how
authorization relates to identity, assignment, and workflow. Nothing in
this document has been implemented. No table, role, or permission exists
because of this document.

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

## 9. What this document does not cover

No real Nexus role, permission, or organizational scope is named here.
Session management is out of scope; §2 covers only the identity/
authorization boundary, not how Supabase Auth issues or refreshes a
session. Specific resources and actions for any real feature are defined
when that feature
is built, against its approved product requirements, not against anything
in this document.
