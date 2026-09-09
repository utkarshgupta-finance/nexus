# Nexus: Foundation RPC Privilege Hardening

## MIGRATION DESIGN

**STATUS: LOCKED.**

**SQL AUTHORED: YES. PRINCIPAL REVIEWED: YES. DRY-RUN: PASSED. REMOTE
APPLY: PASSED. LOCAL/REMOTE MIGRATION HISTORY: ALIGNED AT
`20260909080000`. RUNTIME VERIFICATION: NOT YET RUN. HARDENING CLOSEOUT:
NOT YET COMPLETE.**

See §19 for the applied-state evidence and §20 for the consolidated
current status.

## Amendment record

**Amendment 1 (runtime gate strengthened from 15 to 20 official tests).**
This is a controlled amendment to a locked design, made after the
independent principal database/security review of the authored migration
file. That review returned **P0 = 0, P1 = 0, SQL APPROVED, no SQL
revision required**, and the migration has since been applied. It also
raised one **P2 runtime-verification gap against §14's original 15-test
plan**, not against the SQL:

- SQLSTATE `42501` (`insufficient_privilege`) is returned identically for
  a function `EXECUTE` denial and for a later table-privilege denial.
  Because Migrations 4 and 5 already revoke all table privileges from
  `anon`/`authenticated` (`revoke all on table form_definitions,
  form_versions ...`, `revoke all on table requests,
  submission_revisions ...`) and RLS is enabled with zero policies, a
  denial test asserting on SQLSTATE alone would still pass even if
  `EXECUTE` were accidentally present. The ten denial tests were
  therefore not discriminating for the privilege they claim to prove.
- The `PUBLIC` leg of the contract was not directly proven at all.
  `PUBLIC` is not a switchable role, and because `anon` and
  `authenticated` each now carry their own explicit `REVOKE`, their
  denial does not by itself imply the `PUBLIC` ACL entry was removed.

§14 is amended below from 15 to 20 official tests, adding one catalog
privilege-contract assertion per RPC (Tests 16-20). §13, §15, and §16 are
clarified in support. No other design decision in this document is
reopened: the exact five signatures (§3), the inventory (§4), the
privilege matrices (§5, §6), the REVOKE/GRANT contract (§7), the SECURITY
mode posture (§8), the scope exclusions (§9), historical immutability
(§10), the `ALTER DEFAULT PRIVILEGES` decision (§11), and the future
callable-RPC rule (§12) all stand exactly as originally locked.

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

No table grant is added here or by the eventual harness. The five
`service_role` positive tests (§14.1 A) are the empirical proof, and they
must be read as proving three things at once, not one:

1. `service_role` can invoke the RPC at all (the `EXECUTE` grant this
   migration established actually works);
2. `SECURITY INVOKER` execution finds sufficient underlying table
   privilege for every `SELECT`/`INSERT`/`UPDATE` the body performs on
   `form_definitions`, `form_versions`, `resources`, `requests`, and
   `submission_revisions`;
3. `service_role`'s Supabase RLS-bypass posture behaves as expected
   beneath those five tables, all of which have RLS enabled with zero
   policies, so a non-bypassing role would see no rows and every RPC
   would fail.

Point 3 is a Supabase platform property this migration neither creates
nor changes. It is named here only so that a failure of these tests is
diagnosed correctly rather than misread as a defect in this migration's
`GRANT`. Audit writes need no `service_role` privilege of their own:
`fn_audit_row()` is `SECURITY DEFINER` with `set search_path = pg_catalog`
(Migration 1), so it appends to `audit_log` and consumes
`audit_log_audit_sequence_seq` as the owner.

## 14. Runtime test plan: 20 official tests

**Amended from 15 to 20 (see the Amendment record above).** The gate is
now two layers: a behavioural layer that proves what each role can and
cannot actually do (Tests 1-15), and a catalog layer that proves the
exact privilege state this migration wrote (Tests 16-20). Neither layer
alone is sufficient. Tests 1-15 cannot distinguish which privilege
blocked a denied call; Tests 16-20 cannot prove the RPC bodies work.
Together they close the contract.

Twenty is the full count. No further test is added: PUBLIC needs no
invocation test (§14.3), and the underlying table-privilege question of
§13 is already answered by Tests 1-15 A rather than by anything new.

### 14.1 Tests 1-15: execution matrix (unchanged in structure)

Five RPCs times three role outcomes, mirroring Migration 8's Test 22/23/24
pattern exactly:

- **A. service_role success** (5 tests, one per RPC): fixture setup as
  `postgres`; the role switch covers only the bare RPC invocation; success
  verified by the returned row(s)' ids/shape after `RESET ROLE`. This is
  also where §13's live-verification question is actually answered for
  each RPC.
- **B. anon denial, SQLSTATE 42501** (5 tests, one per RPC): `SET LOCAL
  ROLE anon`; literal, well-typed but fictional arguments, so `EXECUTE`
  denial is the first and only gate reached; SQLSTATE alone is
  authoritative for this layer, a message-text mismatch is informational
  only, never a cause for FAIL.
- **C. authenticated denial, SQLSTATE 42501** (5 tests, one per RPC): same
  shape, `SET LOCAL ROLE authenticated`.

The `42501` assertion is deliberately kept non-discriminating and
locale-independent, exactly as Migration 8 implemented it, because
PostgreSQL error message text is in principle locale-dependent and
asserting on it risks a false FAIL on an otherwise-correct denial. What
changes is that this layer is **no longer asked to carry the privilege
proof on its own**. Tests 16-20 supply the discrimination that message
text cannot safely supply. A message-shape observation
(`permission denied for function ...`) should still be recorded in the
PASS detail as an informational signal, and it remains never a cause for
FAIL.

All Migration 8 harness lessons in §15 continue to apply to Tests 1-15
without change: fixture setup as `postgres`, every fixture id and scalar
resolved before any `SET LOCAL ROLE`, the role-switched section
containing only the RPC invocation and scalar capture, `RESET ROLE`
immediately and unconditionally afterward, all harness bookkeeping as
`postgres`, isolated lifecycle fixtures where needed, and one
rollback-bound outer transaction.

### 14.2 Tests 16-20: catalog privilege contract, one per RPC

One official test per exact RPC signature (§3), each proving the complete
effective and direct privilege matrix for that one function. These tests
switch no role, invoke no RPC, parse no error message, and touch no data.
They are pure catalog assertions and are therefore locale-independent and
deterministic.

| Test | Target signature |
|---|---|
| 16 | `public.create_form_version(uuid, uuid, uuid, jsonb, jsonb, text, text)` |
| 17 | `public.publish_form_version(uuid, integer, uuid, uuid, jsonb)` |
| 18 | `public.create_request_with_draft(uuid, uuid, jsonb, uuid, uuid, jsonb)` |
| 19 | `public.submit_revision(uuid, integer, jsonb, uuid, uuid, jsonb)` |
| 20 | `public.create_next_revision(uuid, uuid, uuid, uuid, jsonb)` |

Each signature is resolved once via `::regprocedure`, which performs exact
identity-argument matching. A signature that does not exist raises
`42883 undefined_function` and fails the test loudly, which is the
intended behaviour: it is the same identity guarantee the migration's own
`REVOKE`/`GRANT` statements rely on.

**Mandatory effective-privilege assertions.** For each signature:

```
has_function_privilege('service_role',  '<exact signature>'::regprocedure, 'EXECUTE') = true
has_function_privilege('anon',          '<exact signature>'::regprocedure, 'EXECUTE') = false
has_function_privilege('authenticated', '<exact signature>'::regprocedure, 'EXECUTE') = false
```

`has_function_privilege` resolves the **effective** privilege, accounting
for grants held directly, grants inherited through role membership, and
grants held through `PUBLIC`. That last property is what makes the two
`false` assertions also a proof of the `PUBLIC` leg: if `PUBLIC` still
held `EXECUTE`, every role including `anon` and `authenticated` would
resolve to `true`. These three assertions are mandatory for every one of
Tests 16-20 regardless of what else the test does.

**Mandatory direct-ACL assertions.** See §14.4 for the exact mechanism and
why it is required in addition to the effective checks. For each
signature, prove:

- `service_role` holds a **direct** `EXECUTE` grant in the function's own
  ACL, not merely an effective one;
- that direct grant is **not grantable** (no `WITH GRANT OPTION`), so
  `service_role` cannot pass `EXECUTE` onward;
- `PUBLIC` holds **no** `EXECUTE` entry;
- `anon` holds **no** direct `EXECUTE` entry;
- `authenticated` holds **no** direct `EXECUTE` entry.

A test passes only if every effective assertion and every direct-ACL
assertion for its signature passes. Partial passes are recorded as FAIL
with the failing assertion named.

### 14.3 PUBLIC verification strategy

`PUBLIC` is a PostgreSQL pseudo-role. It cannot be authenticated as, and
`SET ROLE PUBLIC` is not valid SQL. There is therefore **no invocation
test for PUBLIC, and no fake or proxy PUBLIC invocation test may be
written.** Attempting one would either fail to parse or, worse, silently
test some other role and be mistaken for `PUBLIC` coverage.

`PUBLIC` is proven entirely through catalog and effective-privilege
inspection in Tests 16-20, on two independent legs:

1. **Effective:** `has_function_privilege('anon', ..., 'EXECUTE') = false`
   and the same for `authenticated`. A live `PUBLIC` grant would make both
   `true`, since `PUBLIC` privileges apply to every role.
2. **Direct:** no `EXECUTE` ACL entry whose grantee is `PUBLIC` exists on
   the function (§14.4).

Leg 1 catches a `PUBLIC` grant reached by any path; leg 2 proves the ACL
entry itself is absent. Both are required.

### 14.4 Direct-ACL inspection: chosen mechanism

**Decision: use `aclexplode()` over the function's `proacl`, with
`acldefault()` as the NULL fallback. Do not parse `proacl::text`.**

String-matching `proacl::text` for a fragment such as
`service_role=X/postgres` is rejected as fragile: ACL item ordering is not
contractual, role names can be quoted, and a substring match cannot
distinguish a grantee from a grantor. PostgreSQL provides a structured
alternative, so there is no reason to accept that fragility.

`aclexplode(aclitem[])` returns one row per ACL entry as
`(grantor oid, grantee oid, privilege_type text, is_grantable boolean)`.
For functions the relevant `privilege_type` is `'EXECUTE'`. **`PUBLIC` is
represented by `grantee = 0`**, which is what makes the `PUBLIC` leg
directly assertable rather than inferred. Named roles are compared with
`::regrole`, for example `grantee = 'service_role'::regrole`, which is
exact and raises loudly if the role is absent.

**The one real trap, and why the fallback is mandatory.** `pg_proc.proacl`
is `NULL` when a function has never had an explicit `GRANT` or `REVOKE`,
and `aclexplode(NULL)` returns **zero rows**. A naive
"no row with `grantee = 0`" assertion would therefore *pass* against a
`NULL` `proacl`, even though a `NULL` `proacl` means the implicit default
is in force and `PUBLIC` **does** hold `EXECUTE`. That is precisely the
failure this migration exists to prevent, so the check must not be able to
report it as success. Two guards, both required:

- explode `coalesce(p.proacl, acldefault('f', p.proowner))` rather than
  `p.proacl`, so a `NULL` ACL materialises the real implicit default
  (owner all privileges, plus `EXECUTE` to `PUBLIC`) and the `PUBLIC`
  assertion correctly FAILS;
- separately assert `p.proacl IS NOT NULL`, which is an independent,
  direct proof that this migration wrote an explicit ACL rather than the
  function still sitting on platform defaults. This assertion is the
  clearest single expression of the migration's stated purpose:
  repository-determinism rather than environment-provisioning dependence.

Shape of the per-signature check, resolved against `pg_proc` by exact
`regprocedure` identity:

```
select ...
from pg_proc p
left join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
  on a.privilege_type = 'EXECUTE'
where p.oid = '<exact signature>'::regprocedure
```

and assert, over the resulting `EXECUTE` entries: exactly one with
`grantee = 'service_role'::regrole` and `is_grantable = false`; zero with
`grantee = 0`; zero with `grantee = 'anon'::regrole`; zero with
`grantee = 'authenticated'::regrole`; plus `p.proacl IS NOT NULL`.

Optionally, and cheaply, the `service_role` entry's `grantor` may also be
asserted equal to `p.proowner`, confirming the grant was made by the owner
(`postgres`) as the migration intended rather than by some third party.
This is a nice-to-have, not a gate.

This is not materially more complex than the effective checks: it is one
set-returning function and integer/`regrole` comparisons, with no string
handling anywhere. The effective `has_function_privilege` assertions of
§14.2 remain mandatory alongside it either way, because the two answer
different questions: `aclexplode` proves what the ACL literally says, and
`has_function_privilege` proves what PostgreSQL will actually enforce
after resolving membership and `PUBLIC`.

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

Tests 16-20 need no fixture at all. They read only `pg_proc` and the
privilege catalog, switch no role, and write nothing, so they sit outside
this strategy entirely and contribute no residue risk.

**`create_request_with_draft` composite-return caution (recorded from the
independent principal review).** This is a harness-authoring rule, not a
schema issue and not a defect in the function. Of the five RPCs,
`create_request_with_draft` is the only one whose return type is
`returns table (request public.requests, revision public.submission_revisions)`,
that is, **two composite columns**. The general rule above already forbids
a composite or record variable as a multi-item `INTO` target inside the
role-switched block, and this RPC is the one place where that rule is easy
to violate by accident: the natural-looking `select * into v_rec from
public.create_request_with_draft(...)` binds a record and reintroduces
exactly the failure mode Migration 8 taught. Capture scalar fields
explicitly instead, for example:

```
select (request).id, (revision).id
  into v_request_id, v_revision_id
  from public.create_request_with_draft(...);
```

Two plain scalar targets are fine; a single composite or record target is
not. The same applies to the other four RPCs, each of which returns a bare
composite row type (`create_form_version` and `publish_form_version`
return `form_versions`; `submit_revision` and `create_next_revision`
return `submission_revisions`): project the specific scalar column needed,
do not bind the whole row while role-switched.

## 16. Residue strategy

Same discipline as Migration 8: fixed, unmistakably fictional canary ids
for any fixture row reused by more than one test; an independent,
post-rollback connection re-querying those canary ids directly. This
migration touches no new table, so residue coverage is scoped to the
existing `form_definitions`/`form_versions`/`requests`/`submission_revisions`
fixture rows the harness creates, the same tables the Foundation 1-7
retrospective harness will need to cover regardless.

The runtime gate stays rollback-bound. The eventual harness must include
all five of the following, unchanged by this amendment:

1. one outer transaction wrapping every test;
2. an unconditional `ROLLBACK` at the end, with no `COMMIT` anywhere in
   the harness;
3. an independent, post-rollback connection for the residue check, not a
   re-query inside the same session;
4. fixed, unmistakably fictional canary ids for any fixture row reused by
   more than one test;
5. an explicit zero-residue proof, reported alongside the test results.

Tests 16-20 write nothing and so cannot produce residue, but they remain
inside the same outer transaction for uniformity of reporting.

## 17. Foundation M1-7 retrospective work: separate, subsequent stage

This migration closes exactly one finding from the Foundation Regression &
Hardening Review of Migrations 1-7 (the repository-nondeterministic
`service_role` EXECUTE gap on five RPCs). It is not the Foundation 1-7
retrospective runtime harness itself. That harness is designed, authored,
and run as a separate, later stage, after this migration is designed,
authored, reviewed, applied, and runtime-proven: bringing Migrations 1-3 to
full current verification depth, Migrations 4-6 to incremental current
verification depth (folding in this migration's own 20-test evidence for
the five RPCs), and reusing Migration 7's existing 40/40 evidence directly
without rerunning it.

## 18. Migration 9 gate

Migration 9 remains blocked until the full Foundation 1-7 hardening effort
closes, not merely this one RPC-privilege migration. This migration is one
necessary step in that effort, not the whole of it.

## 19. Applied-state evidence

The migration file `supabase/migrations/20260909080000_foundation_rpc_privilege_hardening.sql`
was authored, independently principal-reviewed, dry-run, and then applied
to the remote project through the Supabase CLI:

- **Apply command**: `npx supabase@2.117.0 db push`
- **Result**: succeeded
- **Local migration version**: `20260909080000`
- **Remote migration version**: `20260909080000`
- **History**: aligned; the filename timestamp is the version recorded
  remotely, as required by `CLAUDE.md`'s Supabase migration rules

**Atomicity, stated without overclaiming.** This apply succeeded as a
whole on this remote path, and local/remote history is aligned at the
single expected version. That is the extent of what this run evidences.
It is **not** a claim that every Supabase CLI execution path, version,
environment, or deployment mode is universally atomic. The separate
whole-file atomicity experiment recorded in
`docs/MASTER_DATA_FOUNDATION_MIGRATION_DESIGN.md` §22 covers Supabase CLI
2.117.0 on a Docker-backed **local** path only, and carries its own
explicit caveat to the same effect. A future CLI upgrade that changes
migration execution mechanics should trigger re-verification before being
relied upon.

The privilege DDL in this migration is in any case ordered so that the
most likely failure mode is harmless: the single consolidated `REVOKE` is
the first statement, so a signature that unexpectedly did not exist would
have raised `42883 undefined_function` before any privilege was altered.

## 20. Current status

| Gate | Status |
|---|---|
| SQL authored | **YES** |
| Independent principal review | **YES** (P0 = 0, P1 = 0, SQL APPROVED, no SQL revision required) |
| Dry-run | **PASSED** |
| Remote apply | **PASSED** |
| Local/remote migration history | **ALIGNED** at `20260909080000` |
| Runtime verification (20 official tests) | **NOT YET RUN** |
| Runtime harness | **NOT YET AUTHORED** |
| Hardening closeout | **NOT YET COMPLETE** |
| Foundation M1-7 retrospective harness (§17) | **NOT STARTED** (separate, subsequent stage) |
| Commercial Migration 9 | **BLOCKED** (§18) |

The one P2 the principal review raised was a runtime-verification gap in
§14's original 15-test plan, not a defect in the applied SQL. It is closed
in this document by the amendment to 20 official tests, and is closed in
practice only once that 20-test harness has been authored and run
20/20 PASS with zero residue.

Migration SQL is not to be modified. Migrations 1-8 and this migration are
now all immutable history.
