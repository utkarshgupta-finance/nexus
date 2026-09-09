# Nexus: Foundation RPC Privilege Hardening

## MIGRATION DESIGN

**STATUS: LOCKED.**

**NO SQL YET. NO MIGRATION FILE YET. NO DATABASE CHANGES YET.**

## 1. Purpose

Make trusted execution of five existing, already-applied application/domain
RPCs repository-deterministic, by giving each an explicit, repository-SQL
`GRANT EXECUTE` to `service_role`, and by having the same forward migration
reassert the full negative privilege contract (`PUBLIC`/`anon`/`authenticated`
denied) rather than depending solely on each RPC's original migration to
keep that contract intact forever.

## 2. Why this forward hardening exists

The Foundation Regression & Hardening Review of Migrations 1-7 found that
Migration 8 established a stronger, fully repository-deterministic RPC
privilege pattern (explicit `REVOKE` from `PUBLIC`/`anon`/`authenticated`
plus an explicit `GRANT` to `service_role`, both in the same migration)
that five earlier RPCs never received. Those five RPCs already correctly
`REVOKE EXECUTE` from `PUBLIC`/`anon`/`authenticated` in their own original
migrations; what they lack is a repository-explicit positive grant to
`service_role`, which today depends entirely on Supabase's environment-level
default provisioning at function-creation time, not on anything this
repository's SQL states. This is a reproducibility and drift-safety gap,
not a currently known security defect: nothing found during the review
proves `service_role` currently lacks `EXECUTE`, only that no migration
says so.

This migration is a **retrospective hardening checkpoint**. Its purpose is
to make the entire RPC privilege boundary, positive and negative, explicit
and re-assertable at the moment this migration is applied, not merely to
add the one missing statement while trusting that the original migrations'
`REVOKE` statements, and whatever the environment separately provisioned
for `service_role`, both remain exactly as intended years later. Repeating
the `REVOKE` statements here is intentional and safe (see §7); it does not
mean the original migrations were wrong.

## 3. Exact five RPC signatures

| # | Schema-qualified name | Parameter type signature | Return type | Defined in |
|---|---|---|---|---|
| 1 | `public.create_form_version` | `(uuid, uuid, uuid, jsonb, jsonb, text, text)` | `form_versions` | Migration 4 (`20260907014500_form_versioning_foundation.sql`) |
| 2 | `public.publish_form_version` | `(uuid, integer, uuid, uuid, jsonb)` | `form_versions` | Migration 4 |
| 3 | `public.create_request_with_draft` | `(uuid, uuid, jsonb, uuid, uuid, jsonb)` | `TABLE(request public.requests, revision public.submission_revisions)` | Migration 5 (`20260907044335_submission_data_foundation.sql`) |
| 4 | `public.submit_revision` | `(uuid, integer, jsonb, uuid, uuid, jsonb)` | `public.submission_revisions` | Migration 5 |
| 5 | `public.create_next_revision` | `(uuid, uuid, uuid, uuid, jsonb)` | `public.submission_revisions` | Migration 5 |

Every signature above is copied verbatim from each RPC's own existing
`revoke execute on function ...` statement in its original migration, not
re-derived from the `create function` parameter list independently, so
there is no risk of a mismatched overload signature when the `GRANT`
statements are eventually authored.

## 4. Complete-inventory confirmation

All `create function`/`create or replace function` statements across
Migrations 1-7 (19 functions total) were re-enumerated and classified:

- **Trigger-only (14)**: `fn_set_updated_at`, `fn_resources_immutable`,
  `fn_audit_row`, `fn_audit_log_immutable`, `fn_protect_access_grant`,
  `fn_form_definitions_protect_key`, `fn_assert_resource_type`,
  `fn_bump_row_version`, `fn_protect_form_version_lifecycle`,
  `fn_protect_request_integrity`, `fn_protect_submission_revision_lifecycle`,
  `fn_audit_submission_revision_transition`, `fn_protect_customer_lifecycle`,
  `fn_protect_capability_lifecycle`.
- **Application/domain RPC (5)**: exactly the five in §3. Migration 7 has
  none. A repository-wide search for `grant execute`/`GRANT EXECUTE` across
  every migration file confirms exactly one existing occurrence anywhere
  today, Migration 8's own RPC; no other function in Migrations 1-7 has
  ever received an explicit `service_role` grant, and no sixth
  application/domain RPC exists.
- **Helper/internal**: none distinct from the trigger-only set.

## 5. Before privilege matrix

| RPC | PUBLIC | anon | authenticated | service_role |
|---|---|---|---|---|
| create_form_version | revoked (M4) | revoked (M4) | revoked (M4) | not repository-explicit |
| publish_form_version | revoked (M4) | revoked (M4) | revoked (M4) | not repository-explicit |
| create_request_with_draft | revoked (M5) | revoked (M5) | revoked (M5) | not repository-explicit |
| submit_revision | revoked (M5) | revoked (M5) | revoked (M5) | not repository-explicit |
| create_next_revision | revoked (M5) | revoked (M5) | revoked (M5) | not repository-explicit |

## 6. After privilege matrix

| Role | Final state, all five RPCs |
|---|---|
| postgres / owner | EXECUTE (owner privilege, unchanged) |
| service_role | EXECUTE, explicit `GRANT`, repository-deterministic |
| authenticated | DENY, explicit `REVOKE`, reasserted by this migration |
| anon | DENY, explicit `REVOKE`, reasserted by this migration |
| PUBLIC | DENY, explicit `REVOKE`, reasserted by this migration |

## 7. Full REVOKE + GRANT contract, and why REVOKEs are intentionally repeated

For each of the five signatures in §3, conceptually:

```
REVOKE EXECUTE ON FUNCTION <exact signature> FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION <exact signature> FROM anon;
REVOKE EXECUTE ON FUNCTION <exact signature> FROM authenticated;
GRANT  EXECUTE ON FUNCTION <exact signature> TO service_role;
```

An equivalent, consolidated `REVOKE ... FROM PUBLIC, anon, authenticated`
form is acceptable when SQL is eventually authored, provided the resulting
contract is identical to the four lines above.

The `REVOKE` statements are repeated here deliberately, not because the
original Migration 4/5 `REVOKE` statements were incorrect. Reasserting them
in this forward migration:

- makes this migration a complete, self-contained statement of the
  intended privilege boundary at the moment it is applied, not merely a
  diff against whatever state happens to already exist;
- restores the intended contract if environment-level provisioning or any
  later, out-of-band privilege drift had accidentally granted `PUBLIC`,
  `anon`, or `authenticated` `EXECUTE` on any of these five functions
  before this migration runs, for any reason not visible in this
  repository's own history;
- matches exactly how Migration 8 itself states its own `REVOKE`s are
  "defense-in-depth, not a correction" even though earlier default-privilege
  rules already covered the same ground.

`REVOKE` on a privilege a role does not currently hold is a safe no-op in
PostgreSQL; there is no destructive or surprising effect from repeating it.

## 8. SECURITY mode: unchanged

All five RPCs remain `SECURITY INVOKER`, confirmed directly against each
function's own definition in Migrations 4 and 5. This migration changes no
function body and no `SECURITY` clause. `SECURITY DEFINER` is not
introduced anywhere; the only legitimate caller (`service_role`) already
needs no privilege elevation, so `DEFINER` would add search-path risk for
no benefit, exactly the reasoning already stated in Migrations 4, 5, and 8.

## 9. Scope exclusions

No table privilege change. No RLS change. No policy created. No Resource
Registry change. No lifecycle trigger change. No audit trigger change. No
`SECURITY INVOKER`/`DEFINER` change. No trigger-only function receives a
`service_role` grant (trigger invocation never checks the writing role's
own `EXECUTE` privilege on the trigger function, so such a grant would be
pure scope creep with no correctness effect).

## 10. Historical migrations 1-8: immutable

Migrations 1 through 8 remain byte-for-byte unchanged. This hardening is
implemented entirely as one new, separate forward migration file, not yet
timestamped or numbered.

## 11. ALTER DEFAULT PRIVILEGES: not used here

Migration 2's existing `ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN
SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated` does
not include `PUBLIC`, so PostgreSQL's own built-in default (`GRANT EXECUTE
TO PUBLIC` at `CREATE FUNCTION` time) still applies to every function
created afterward; every migration since (4, 5, 7, 8) has correctly
compensated by explicitly revoking `PUBLIC` on its own new functions each
time. This migration continues that same explicit, per-RPC convention
rather than introducing any new `ALTER DEFAULT PRIVILEGES` rule: a global
default `GRANT EXECUTE TO service_role` would silently apply to every
future function created by `postgres`, including future trigger-only
functions that must never be directly callable, which is exactly the kind
of surprising, hard-to-audit effect this design avoids.

## 12. Future callable-RPC rule

Every future Nexus application/domain RPC must, inside the same migration
that creates it, explicitly encode both: `REVOKE EXECUTE` from `PUBLIC`,
`anon`, and `authenticated`, and an explicit `GRANT EXECUTE` to the
intended trusted role (`service_role`). Neither may be assumed from
platform defaults or from a separate `ALTER DEFAULT PRIVILEGES` rule.
Trigger-only functions remain a separate category: `REVOKE` as already
practiced, never `GRANT` to any role.

## 13. Underlying service_role table access: REQUIRES LIVE VERIFICATION

Because all five RPCs are `SECURITY INVOKER`, an explicit `EXECUTE` grant
proves only that the function is callable, not that `service_role` holds
the `SELECT`/`INSERT`/`UPDATE` privilege each RPC body needs on
`form_definitions`, `form_versions`, `resources`, `requests`, and
`submission_revisions`. No migration from 1-8 grants or revokes any table
privilege for `service_role` anywhere; the consistent, repository-wide
posture is that `service_role` is left untouched and relies on Supabase's
own environment-level table-privilege provisioning. This migration does
not change that posture and does not add speculative table grants. Whether
each RPC's successful path actually works end-to-end as `service_role` is
an empirical question, to be proven by the runtime test plan below
(§14), the same way Migration 8's own Test 22 proved it for its own RPC;
until then it is marked **REQUIRES LIVE VERIFICATION**, not assumed.

## 14. Runtime test plan: 15 tests

Five RPCs times three role outcomes, mirroring Migration 8's Test 22/23/24
pattern exactly:

- **service_role success** (5 tests, one per RPC): fixture setup as
  `postgres`; the role switch covers only the bare RPC invocation; success
  verified by the returned row(s)' ids/shape after `RESET ROLE`. This is
  also where §13's live-verification question is actually answered for
  each RPC.
- **anon denial, SQLSTATE 42501** (5 tests, one per RPC): `SET LOCAL ROLE
  anon`; literal, well-typed but fictional arguments, so `EXECUTE` denial
  is the first and only gate reached; SQLSTATE alone is authoritative, a
  message-text mismatch is informational only, never a cause for FAIL.
- **authenticated denial, SQLSTATE 42501** (5 tests, one per RPC): same
  shape, `SET LOCAL ROLE authenticated`.

## 15. Rollback-bound fixture strategy

One outer `BEGIN`, ending in an unconditional `ROLLBACK`, no `COMMIT`
anywhere in the harness. Every fixture value each RPC needs is resolved
into plain scalar variables strictly before any `SET LOCAL ROLE`; the
role-switched section contains only the bare RPC call and scalar result
capture (never a composite/record variable as a multi-item `INTO` target,
never a `pg_temp`/harness-helper lookup while role-switched); `RESET ROLE`
runs unconditionally immediately afterward, before any postgres-side
bookkeeping. Where an RPC changes lifecycle state (`publish_form_version`,
`submit_revision`), its own fresh, isolated fixture is minted for that
specific test so no test's fixture is shared or mutated by another.

## 16. Residue strategy

Same discipline as Migration 8: fixed, unmistakably fictional canary ids
for any fixture row reused by more than one test; an independent,
post-rollback connection re-querying those canary ids directly. This
migration touches no new table, so residue coverage is scoped to the
existing `form_definitions`/`form_versions`/`requests`/`submission_revisions`
fixture rows the harness creates, the same tables the Foundation 1-7
retrospective harness will need to cover regardless.

## 17. Foundation M1-7 retrospective work: separate, subsequent stage

This migration closes exactly one finding from the Foundation Regression &
Hardening Review of Migrations 1-7 (the repository-nondeterministic
`service_role` EXECUTE gap on five RPCs). It is not the Foundation 1-7
retrospective runtime harness itself. That harness is designed, authored,
and run as a separate, later stage, after this migration is designed,
authored, reviewed, applied, and runtime-proven: bringing Migrations 1-3 to
full current verification depth, Migrations 4-6 to incremental current
verification depth (folding in this migration's own 15-test evidence for
the five RPCs), and reusing Migration 7's existing 40/40 evidence directly
without rerunning it.

## 18. Migration 9 gate

Migration 9 remains blocked until the full Foundation 1-7 hardening effort
closes, not merely this one RPC-privilege migration. This migration is one
necessary step in that effort, not the whole of it.
