# Batches 26-33 Pre-Flight Readiness Review (2026-09-27)

Performed before issuing any overnight-unattended-execution authorization for the remainder of the
current run (Batches 26 through 33, 183 journeys: AB-020 through AB-041, V-001 through V-047, W-001
through W-021, X-001 through X-021, Y-001 through Y-020, Z-001 through Z-030, AA-001 through AA-022).
All 183 canonical journey definitions were read in full via eight parallel research passes (one per
batch); nothing was sampled.

## 1. Persona gaps found and resolved

Seven new canonical personas added to `scripts/provision-canonical-test-personas.ts` and provisioned for
real (Auth identity + `app_users` row + role/team grant, verified via direct query, one spot-checked via
a real login):

| Persona | Role | Team | Resolves |
|---|---|---|---|
| `nexus-test-finance-b` | checker | wf_test_finance | Same-team, same-node concurrent-approval races (the single most repeated gap: V-005 through V-008, V-026, V-046, V-047, AB-039, X-006, Z-006, Z-026) — every canonical checker team had exactly one member, making a genuine two-real-approver race unstageable |
| `nexus-test-workflow-admin-b` | workflow_admin | — | Two-admin draft/publish races and "another admin revokes this admin's rights" scenarios (V-011, V-016, V-030, V-031) |
| `nexus-test-commercial-viewer` | commercial_configuration_viewer | — | AB-024's viewer-permission-never-implies-write check (a real, pre-existing role with no canonical persona) |
| `nexus-test-reference-master-viewer` | reference_master_viewer | — | Read-only Reference Master checks distinct from the existing read+write admin persona |
| `nexus-test-customer-lifecycle-admin` | customer_lifecycle_admin | — | AA-012 — the only role holding `customer.delete_permanent` |
| `nexus-test-go-live-admin` | go_live_admin | — | The "Go Live operator" persona several journeys' Notes referenced without a canonical match |
| `nexus-test-finance-admin` | finance_admin | — | AA-001's "Entitlement administrator" — finance_admin is the real role bundling entitlement/entitlement_settlement/usage permissions |

19 canonical personas now exist in total. All 7 new ones confirmed via direct `app_users`/`user_roles`/
`user_teams` query (active, correct role, correct team). One (`nexus-test-go-live-admin`) was
live-login-verified end to end (real Sign-in, correct downstream permission boundary observed). The
remaining 6 were not individually browser-login-tested in this pass; they share the identical,
already-proven authentication code path exercised successfully 12+ times this session across the other
personas, so this is a reasonable, disclosed scope-limit rather than a silent gap.

**Deliberately not provisioned** (execution-time techniques instead, not a persona gap):
- Composite/dual-domain personas (AA-009, AA-019): combine two existing single-domain personas across
  two separate actions rather than provisioning one persona holding contradictory roles.
- 10+/200+ simultaneous distinct approvers (V-046 stress, V-047 stress, Y-009): explicitly identified by
  the research itself as needing a scripted concurrent-RPC-call harness, not real distinct personas.
- A disposable "deactivated historical actor" (X-020): create a one-off disposable identity at
  execution time (the established pattern this session), not a new permanent canonical persona.

## 2. Fixture requirements

Full per-batch breakdown lives in each research pass's own output (not separately filed; summarized
here). Two categories:
- **Ordinary state fixtures** (a draft, a submitted request, a specific historical shape): all
  achievable via the same real RPCs/UI already used throughout Batches 24-25, at execution time.
- **Bulk/volume fixtures** (Y-001 through Y-020's large-scale checks; several V/AA journeys needing
  hundreds-to-thousands of rows): genuinely impractical to build via real UI actions at these volumes.
  These need direct SQL bulk-seeding (a real, already-demonstrated capability this session), not a new
  tool. Flagged per-journey in each batch's own research output; will be constructed at execution time,
  same discipline as every other fixture this run.

## 3. Tooling proven this pass

- **`tsc --noEmit`**: was failing (exit 2) on 15 pre-existing, empty, duplicate `node_modules/@types/*
  2` directories (a stray environment artifact, unrelated to any source file). Removed; `tsc --noEmit`
  now genuinely exits 0.
- **Concurrency (DB-level)**: proven via Batch 25's own T-024 redo — two genuinely distinct real actors,
  genuinely overlapping RPC calls, correct distinct attribution, verified by both admins independently
  via real UI reloads. This is the approved technique for every "two simultaneous actors" journey in
  Batches 26-33.
- **Session-expiry**: `auth.sessions` is directly queryable and mutable via the service-role connection;
  a real `DELETE` against a session row is the same underlying mechanism a Supabase Auth Admin sign-out
  uses. Confirmed a real, current session row exists and is addressable; not exercised destructively in
  this pass to avoid disrupting the active verification session.
- **Storage faults**: `storage.objects` is directly queryable and mutable via the service-role
  connection; a real document row was confirmed to exist and be addressable, proving the mechanism
  Z-010's "storage object missing, metadata row survives" fixture needs.
- **Overnight Discovered Journey Queue**: dry-run performed. A mock entry was created in
  `OVERNIGHT_DISCOVERED_JOURNEY_QUEUE.md`, moved through all four states (discovered → dependency
  assessed → executable → closed), confirmed the file's structure represents every state with no
  ambiguity, then deleted. Mechanics work as designed; no protocol changes needed.

## 4. Critical finding: no genuine dual-browser-session concurrency

Tested directly: this session's Browser pane tool shares **one cookie jar per origin across every tab**.
Logging in as persona B while persona A's session is active does not create a second, coexisting
session — `/login` simply redirects back to A's still-active session. There is no way, with this tool,
to have two different personas genuinely authenticated in two tabs at the same instant.

This does **not** block any journey: every "two simultaneous browser sessions" scenario in Batches
26-33 (V-047, Z-026, W-018, AB-039, and others) has an already-approved fallback — the same real,
distinct-actor, overlapping-RPC-call technique used for T-024 in Batch 25, which the user has already
confirmed is valid evidence ("literal simultaneous browser clicks are not required"). Z-026 specifically
*is a journey about this exact question* ("full correct isolation, or a clearly documented
single-session-per-browser limitation") — this finding is itself close to that journey's own expected
evidence, not merely a tooling obstacle to it.

**Also proven not fully achievable, already anticipated by the canonical text's own PARTIAL rating**:
true network-mid-request-drop simulation (Z-003, W-012/013/020) — this real dev environment has no
request-intercepting proxy or server-side failpoint. The canonical journeys already expect an
approximate fallback (kill the tab mid-request) and are already rated PARTIAL, not FULL, for this
reason. Not a new limitation, not blocking.

Client clock-skew (Z-028) is achievable via a real client-side `Date` override followed by genuine
subsequent UI interaction (legitimate fixture setup — the environment condition under test, not a
synthetic-click substitute for the interaction itself) but was not demonstrated live in this pass.

## 5. Product Decisions scan

No journey in Batches 26-33 is blocked on a pre-existing, unresolved Product Decision. Several journeys'
own Notes fields say things like "confirm against code rather than assume" or "this journey exists to
establish X" — that is normal execution-time discovery, exactly what these journeys are designed to do,
not a pre-flight blocker.

A handful of journeys will very likely re-confirm **already-known, already-disclosed** gaps rather than
discover new ones: the zero-active-team-member stuck-request gap (first found as A-027, resurfaces as
V-027, Z-007, Z-009) and the team-deactivation-doesn't-block-approval inconsistency (first confirmed as
T-019 in Batch 25, resurfaces as V-036). These should be logged as re-confirmations with cross-references
to their original finding, per the Journey Discovery protocol, not treated as new Product Decisions
requiring a pause.

## 6. Not yet done — requires the user

**Bounded test-mutation pre-authorization** was not self-granted in this pass and cannot be: this is a
standing-authorization decision for the user to make before an extended unattended run, not something
this readiness review can certify on its own. Everything else in this document is a factual/technical
finding; this one item is a decision.

## Certification

**READY**, with the two disclosed, already-mitigated limitations in section 4 (no genuine dual-browser
concurrency; no true network-fault injection), both of which have approved fallbacks already exercised
successfully in this run, and pending the user's explicit bounded overnight authorization (section 6).
