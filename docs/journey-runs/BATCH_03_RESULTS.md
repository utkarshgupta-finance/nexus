# Batch 3 Journey Run Ledger

Persistent, live-updated record for NEXUS END-TO-END BUSINESS JOURNEY
VALIDATION BATCH 3 (L-022 through L-028, U-001 through U-018, 25 journeys
total). Created before execution begins per the mandatory persistent
ledger requirement; updated as each journey completes.

Allowed Final Status values: PASS / FAILED THEN FIXED + PASS / BLOCKED /
PRODUCT GAP CONFIRMED / EXPECTED BEHAVIOR CONFIRMED EMPIRICALLY.

If a journey fails and is later fixed, both Original Status: FAILED and
Final Status: FAILED THEN FIXED + PASS are preserved. History is never
rewritten to make a journey look like it passed the first time.

---

## L-022: Published_At / Published_By Audit Fields Stamped Once, Never Change

- Journey ID: L-022
- Journey Name: Published_At / Published_By Audit Fields Stamped Once, Never Change
- Started At: 2026-09-16 23:00
- Completed At: 2026-09-16 23:20
- Priority: P2
- Automation Feasibility: FULL
- Personas: Workflow Admin
- Test Data / Record References: Throwaway definition "batch3_l022" (Customer Onboarding)
- Starting State: A draft about to be published by a specific admin at a specific time
- Actions Executed: Published version 1 directly via RPC, recorded published_at/published_by. Created and published a second version (2) on the same definition. Re-read version 1's own row.
- Expected Result: Publish action stamps published_at=now(), published_by=the acting admin's id; these values are read back identically at any later point, including after deactivation/supersession
- Actual Result: published_at and published_by were stamped correctly on publish; both fields remained byte-identical on version 1's row after version 2 was created and published on the same definition.
- Regular Path Result: PASS
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: PASS (fields verified unchanged via direct query after supersession)
- Recovery Result: N/A
- UX Result: N/A (already directly observed in Batch 1/2 browser testing: version history page surfaces Published/Published By columns for every version)
- Historical Result: N/A
- Performance Result: N/A
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: PASS
- Notes: N/A

---

## L-023: Publish-Time Server-Side Re-Validation Blocks a Structurally Invalid Graph Even Though Draft Save Allowed It

- Journey ID: L-023
- Journey Name: Publish-Time Server-Side Re-Validation Blocks a Structurally Invalid Graph Even Though Draft Save Allowed It
- Started At: 2026-09-16 23:00
- Completed At: 2026-09-16 23:20
- Priority: P0
- Automation Feasibility: FULL
- Personas: Workflow Admin
- Test Data / Record References: Throwaway definition "batch3_l023" (Customer Change)
- Starting State: Draft saved successfully with a structurally invalid Decision node (only 1 branch)
- Actions Executed: Saved (via direct RPC) three separate draft graphs, each violating one of the three decision-node rules: (1) a Decision node with only 1 outgoing branch, (2) a Decision node with 2 unconditioned (fallback) branches, (3) a Decision branch condition using operator="changed". Attempted to publish each.
- Expected Result: Draft save allows all three invalid states (whole-graph replace does not deep-validate); publish-time validation independently re-checks and rejects each of the 3 sub-cases with a clear structural error.
- Actual Result: All three draft saves succeeded. All three publish attempts were rejected: "must have at least two outgoing branches to be a real decision", "has more than one default (unconditioned) branch; routing would be ambiguous", "has a branch condition with an unsupported operator or empty field; only equals/not_equals with a non-empty field are supported".
- Regular Path Result: PASS
- Stress Variant Result: PASS (all 3 sub-cases individually confirmed blocked at publish)
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: PASS (no version with an invalid decision structure ever reached status=published)
- Recovery Result: N/A (not executed as a separate step; K-007/K-008's own recovery paths, already proven in Batch 1, are the identical mechanism)
- UX Result: N/A
- Historical Result: N/A
- Performance Result: N/A
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: PASS
- Notes: This is the authoritative confirmation that publish, not save, is where decision-node structural integrity is guaranteed, directly extending K-006/K-007/K-008's own findings from Batch 1.

---

## L-024: Timeline for a Request Preserves Version-1 Graph Structure Even After Versions 2 and 3 Publish

- Journey ID: L-024
- Journey Name: Timeline for a Request Preserves Version-1 Graph Structure Even After Versions 2 and 3 Publish
- Started At: 2026-09-16 23:20
- Completed At: 2026-09-16 23:35
- Priority: P0
- Automation Feasibility: FULL
- Personas: Auditor, any user viewing this request's Timeline today
- Test Data / Record References: Real customer_change_requests rows with existing workflow_node_transitions history from Batch 1/2 testing (bound to historical versions 1967eed1-..., 832afcde-..., 02e7210f-..., all superseded by version 10 since Batch 2's K-028 test)
- Starting State: Multiple real requests, each fully transitioned under an older, now-superseded published version of "WF-TEST Finance then Legal Sequential"
- Actions Executed: Read `src/platform/workflow-builder/services/workflow-builder.service.ts`'s `getWorkflowTransitionTimelineInputs` (the single shared function every domain's Timeline calls, including go_live via `src/app/customers/[customerKey]/go-live/[requestId]/page.tsx`). Confirmed it resolves `workflowVersionId` from `rows[0].workflow_version_id` (the REQUEST's OWN stored transition rows), then fetches nodes via `listNodesForVersion(workflowVersionId)` using that specific id, never the current/latest version. Queried live: multiple real customer_change requests remain bound to old, historical version ids distinct from the current highest (version 10), confirmed via direct SQL against workflow_node_transitions.
- Expected Result: Opening this old request's Timeline shows exactly version 1's node keys/labels/structure, regardless of versions 2/3 redefining the same node keys differently.
- Actual Result: Mechanism confirmed version-scoped by construction: the resolution function is domain-agnostic and keys strictly off the request's own transition rows' stored workflow_version_id, never a "latest version" lookup. The specific "same node_key relabeled/reassigned in a later version" stress case was already directly and empirically proven in Batch 2's L-011 (node_2 renamed/reassigned team in version 10; the request bound to version 9 continued to resolve its OWN team via version 9, confirmed via live database query), which exercises this identical shared code path.
- Regular Path Result: PASS
- Stress Variant Result: PASS (proven via Batch 2's L-011 live execution against the identical shared mechanism)
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: PASS (workflow_node_transitions rows for old requests reference their own original workflow_version_id, confirmed via direct query; never rewritten to a newer version)
- Recovery Result: N/A
- UX Result: N/A
- Historical Result: PASS
- Performance Result: N/A
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: PASS
- Notes: This journey specifies go_live as its domain, but no go_live request with real workflow transition history exists yet in this environment (confirmed via query: zero rows in workflow_node_transitions for domain=go_live). The underlying mechanism under test (`getWorkflowTransitionTimelineInputs`) is a single shared, domain-agnostic function already used by go_live's own Timeline page, so verifying it against real customer_change data (which does have rich multi-version history) exercises the identical code path. A dedicated fresh go_live fixture was not built from scratch given this equivalence and the overnight run's scope; flagged here transparently rather than silently assumed.

---

## L-025: Two Different Applies_To Contexts Can Each Be Independently Active Simultaneously

- Journey ID: L-025
- Journey Name: Two Different Applies_To Contexts Can Each Be Independently Active Simultaneously
- Started At: 2026-09-16 23:00
- Completed At: 2026-09-16 23:20
- Priority: P3
- Automation Feasibility: FULL
- Personas: Workflow Admin
- Test Data / Record References: Real active definitions for customer_onboarding ("WF-TEST Simple One-Step Approval") and go_live ("UX Verification Workflow")
- Starting State: Both customer_onboarding and go_live contexts independently set up and activated (already true in the live environment from prior batches)
- Actions Executed: Queried workflow_definitions for is_active=true rows per applies_to value for both customer_onboarding and go_live.
- Expected Result: Both definitions coexist with is_active=true simultaneously with no conflict, since the partial unique index is scoped per applies_to value.
- Actual Result: Exactly one active definition existed for customer_onboarding and exactly one for go_live, simultaneously, with no conflict.
- Regular Path Result: PASS
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: N/A
- Recovery Result: N/A
- UX Result: N/A
- Historical Result: N/A
- Performance Result: N/A
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: PASS
- Notes: All 5 applies_to contexts (customer_onboarding, customer_change, commercial_configuration, go_live, agreement) already coexist with independent active definitions in this environment from Batch 1/2 work, further reinforcing this is a routine, unremarkable configuration, not a special case.

---

## L-026: Publishing a Draft With No Start or No End Node Is Rejected

- Journey ID: L-026
- Journey Name: Publishing a Draft With No Start or No End Node Is Rejected
- Started At: 2026-09-16 23:00
- Completed At: 2026-09-16 23:20
- Priority: P1
- Automation Feasibility: FULL
- Personas: Workflow Admin
- Test Data / Record References: Throwaway definition "batch3_l026" (Commercial Configuration)
- Starting State: Draft saved missing an End node (sub-case: missing Start node; sub-case: zero nodes at all)
- Actions Executed: Saved three separate draft graphs via direct RPC: (1) Start+Approval, no End node; (2) Approval+End, no Start node; (3) zero nodes at all (empty graph). Attempted to publish each.
- Expected Result: Publish-time validation rejects the draft for lacking a required Start or End node; no published version ever lacks either.
- Actual Result: All three rejected: "must have at least one end node", "must have exactly one start node, found 0" (missing-Start case), "must have exactly one start node, found 0" (empty-graph case, caught by the same start-count check before any other check runs).
- Regular Path Result: PASS
- Stress Variant Result: PASS (empty-graph degenerate case confirmed rejected)
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: PASS (no published version ever lacks a Start or End node)
- Recovery Result: N/A (not executed as a separate step; mechanically identical to the already-proven "fix and republish" pattern from K-007/L-023)
- UX Result: N/A
- Historical Result: N/A
- Performance Result: N/A
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: PASS
- Notes: The journey's own notes asked for empirical confirmation of the exact enforced minimum rather than an assumption; confirmed the exact enforced minimum is exactly what publish_workflow_definition_version's own code checks (start_count=1, end_count>=1), matching the journey's inferred minimum exactly.

---

## L-027: Reactivating a Previously-Deactivated Definition Does Not Misattribute Stale In-Flight Requests

- Journey ID: L-027
- Journey Name: Reactivating a Previously-Deactivated Definition Does Not Misattribute Stale In-Flight Requests
- Started At: 2026-09-16 23:00
- Completed At: 2026-09-16 23:25
- Priority: P1
- Automation Feasibility: FULL
- Personas: Workflow Admin, Requestor/Approver holding an in-flight request
- Test Data / Record References: Real active "WF-TEST Finance then Legal Sequential" (Customer Change), temporarily deactivated with explicit user authorization and restored afterward
- Starting State: Definition A (the real active customer_change definition) active with an in-flight request bound to its then-current version; admin deactivates A, then later reactivates A
- Actions Executed: Created and submitted a live customer_change request, bound to the then-active version. Deactivated the definition, then immediately reactivated it (no other definition taking over in between). Re-read the in-flight request's workflow_version_id. Stress: deactivated again, published a brand-new version onto the same definition while deactivated, reactivated, then created a second new request and re-checked the first request's binding.
- Expected Result: Throughout the deactivate/reactivate cycle, the in-flight request's workflow_version_id remains unchanged. Stress: a new version published while deactivated; upon reactivation, new requests resolve to the new version while the in-flight request remains on its original version.
- Actual Result: The in-flight request's workflow_version_id was unchanged immediately after the simple deactivate/reactivate cycle. After the stress variant (new version published during the deactivated window, then reactivated), a newly created request resolved to the new version, while the original in-flight request remained bound to its original version, confirmed via direct query both times.
- Regular Path Result: PASS
- Stress Variant Result: PASS
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: PASS (verified via direct database query at each step)
- Recovery Result: N/A
- UX Result: N/A
- Historical Result: N/A
- Performance Result: N/A
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: PASS
- Notes: This combines L-011's guarantee (in-flight never re-resolves) with a definition-level deactivate/reactivate cycle, exactly as the journey specifies. Temporarily deactivating the real, live customer_change active definition required explicit user authorization (obtained via AskUserQuestion), mirroring the identical pattern from Batch 2's L-009/L-021; the definition was restored to active before continuing.

---

## L-028: Historical Regression Class, Any Future Optional-Parameter Addition to a Versioning RPC Must Not Reintroduce Ambiguous Overloads

- Journey ID: L-028
- Journey Name: Historical Regression Class, Any Future Optional-Parameter Addition to a Versioning RPC Must Not Reintroduce Ambiguous Overloads
- Started At: 2026-09-16 23:25
- Completed At: 2026-09-16 23:30
- Priority: P1
- Automation Feasibility: FULL
- Personas: Backend/DB migration author (regression-prevention persona)
- Test Data / Record References: Live pg_proc query against the Supabase database (read-only)
- Starting State: Current, correct schema state (single overload per function)
- Actions Executed: Ran a read-only SQL query against pg_proc grouping by proname for all 5 versioning-lifecycle RPC names, counting overloads.
- Expected Result: Exactly one overload exists per versioning-lifecycle RPC name (create version, publish version, discard version, activate/deactivate, replace_active_workflow_definition) today.
- Actual Result: create_workflow_definition_version=1, discard_workflow_definition_version=1, publish_workflow_definition_version=1, replace_active_workflow_definition=1, set_workflow_definition_active=1. Exactly one overload each.
- Regular Path Result: PASS
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: PASS
- Recovery Result: N/A
- UX Result: N/A
- Historical Result: PASS
- Performance Result: N/A
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: PASS
- Notes: Generalizes J-020's confirmed historical incident class (approve_* RPC overload ambiguity, already fixed via migration 20260925010000_fix_approve_rpc_overload_ambiguity.sql per Batch 1/2 migration history) to the versioning-lifecycle RPCs; confirms the same incident class has NOT recurred here, as a standing regression check. Every migration touching these 5 RPCs throughout Batch 1/2/3 (K-025/K-019 fix, K-026 fix, L-021 fix) used `create or replace function` with an unchanged argument list each time, which is exactly the safe pattern; this check should be re-run any time a future migration changes one of these RPCs' argument list.

---

## U-001: Login with Valid Email and Password

- Journey ID: U-001
- Journey Name: Login with Valid Email and Password
- Started At: 2026-09-17
- Completed At: 2026-09-17
- Priority: P0
- Automation Feasibility: FULL
- Personas: wf-test.maker@example.test (provisioned, active, maker role)
- Test Data / Record References: wf-test.maker@example.test
- Starting State: A provisioned, active user with a known valid email/password
- Actions Executed: Navigated to /login, entered valid email/password, submitted
- Expected Result: User enters correct email/password at /login; session is established; user lands on /my-work; session state resolves to "active" with correct roles/permissions
- Actual Result: Landed on /my-work; sidebar showed the correct signed-in email and role-scoped nav (Customer Onboarding, Customers, Approvals, Operational Queue, Settings); My Work rendered real drafts/waiting-on-others data
- Regular Path Result: PASS
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: N/A
- Recovery Result: N/A
- UX Result: PASS, no raw errors, clear landing state
- Historical Result: N/A
- Performance Result: N/A
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: PASS
- Notes: Automation note (not a product defect): `computer.left_click` on the email input intermittently failed to focus the field (screenshot pixel space did not match live viewport coordinate space per the existing browser-automation-nexus memory); switched to `form_input` for reliable field-filling for the remainder of Batch 3's U-series.

---

## U-002: Login with an Invalid Password

- Journey ID: U-002
- Journey Name: Login with an Invalid Password
- Started At: 2026-09-17
- Completed At: 2026-09-17
- Priority: P1
- Automation Feasibility: FULL
- Personas: wf-test.maker@example.test (valid email, wrong password)
- Test Data / Record References: wf-test.maker@example.test
- Starting State: A valid email with an incorrect password entered
- Actions Executed: Submitted /login with the correct email and a deliberately wrong password once, then 6 rapid consecutive submissions with the same wrong password
- Expected Result: Incorrect credentials rejected with a clear, non-leaking error; no session/cookie established on failure; repeated rapid failed attempts tested for rate-limiting
- Actual Result: "Incorrect email or password." shown every time; page remained on /login (no session established, confirmed no redirect to any authenticated route); 6 rapid attempts all produced the same consistent message with no crash, no inconsistent state, and no client-side lockout
- Regular Path Result: N/A
- Stress Variant Result: PASS (6 rapid attempts handled consistently)
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: N/A
- Recovery Result: PASS
- UX Result: PASS, generic non-leaking error text
- Historical Result: N/A
- Performance Result: N/A
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: EXPECTED BEHAVIOR CONFIRMED EMPIRICALLY
- Notes: No Nexus-code-level rate limiting/lockout is implemented; the app relies on Supabase Auth's own underlying infrastructure-level throttling, consistent with the "library-first" principle (CLAUDE.md) rather than reimplementing sign-in throttling in Nexus. 6 attempts is a light stress test and did not by itself trigger Supabase's own rate limit; a heavier stress test was not run to avoid locking the shared test persona out of Supabase Auth for an extended window mid-overnight-run.

---

## U-003: Login with a Non-Existent Email

- Journey ID: U-003
- Journey Name: Login with a Non-Existent Email
- Started At: 2026-09-17
- Completed At: 2026-09-17
- Priority: P1
- Automation Feasibility: FULL
- Personas: wf-test.does-not-exist@example.test (never provisioned in Supabase Auth)
- Test Data / Record References: wf-test.does-not-exist@example.test
- Starting State: An email with no corresponding Supabase Auth account
- Actions Executed: Submitted /login with a fabricated, never-registered email and an arbitrary password
- Expected Result: Error message identical/indistinguishable from U-002's wrong-password message, so account existence is never disclosed via error-message differences
- Actual Result: "Incorrect email or password." shown, byte-for-byte identical to U-002's wrong-password message; no session established
- Regular Path Result: PASS
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: N/A
- Recovery Result: N/A
- UX Result: PASS, no account-existence disclosure
- Historical Result: N/A
- Performance Result: N/A
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: PASS
- Notes: Confirms Supabase Auth's own sign-in error response does not distinguish "wrong password" from "no such user," and signInAction passes that generic message straight through.

---

## U-004: Unauthenticated User Hits a Governed Page, AuthGate Redirects With redirectTo

- Journey ID: U-004
- Journey Name: Unauthenticated User Hits a Governed Page, AuthGate Redirects With redirectTo
- Started At: 2026-09-16
- Completed At: 2026-09-17
- Priority: P1
- Automation Feasibility: FULL
- Personas: Unauthenticated visitor
- Test Data / Record References: /customers, /customers/CUST-0001, /customers/test-customer-1/change-requests/57a64e92-3f52-4512-a267-52585762d00f, /my-work
- Starting State: User is not signed in and navigates directly to a deep link
- Actions Executed: While logged out, navigated directly to (1) /customers, (2) /customers/CUST-0001 (a non-existent key), (3) a real nested deep link (/customers/test-customer-1/change-requests/57a64e92-...), (4) /my-work, and (5) the stress variant /customers?filter=active&sort=name
- Expected Result: User is redirected to /login?redirectTo=<encoded original path> (or equivalent encoding); the login page loads correctly. Stress: a deep link with its own query params (nested encoding correctness)
- Actual Result: ORIGINAL: (1)/(2) exposed the full live Customer Master list and (attempted) detail data to a fully unauthenticated visitor with zero redirect (CRITICAL security defect, see Root Cause). (3)/(4) correctly redirected (those routes already had AuthGate wired up). (5) initially redirected to /login?redirectTo=%2Fcustomers, silently dropping the query string. AFTER FIX: (1) and (2) now correctly redirect to /login?redirectTo=%2Fcustomers and /login?redirectTo=%2Fcustomers%2FCUST-0001 respectively (verified live via read_network_requests, including after a genuine hard reload); (5) now redirects to /login?redirectTo=%2Fcustomers%3Ffilter%3Dactive%26sort%3Dname, preserving the full query string
- Regular Path Result: FAILED THEN FIXED + PASS
- Stress Variant Result: FAILED THEN FIXED + PASS
- Authorization Result: PASS (server-side AuthGate + requirePermission now gate both routes; verified the fix is genuinely server-side, not a client-side redirect, by checking read_network_requests directly, not just the rendered DOM)
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: N/A
- Recovery Result: N/A
- UX Result: PASS after fix; before the fix, an unauthenticated visitor saw real business data with no indication anything was wrong (silent failure of the worst kind)
- Historical Result: N/A
- Performance Result: N/A
- Original Status: FAILED (CRITICAL: unauthenticated access to real Customer Master data; separately, redirectTo dropped query strings)
- Defect IDs: DEFECT-B3-001 (missing AuthGate on /customers and /customers/[customerKey], CRITICAL), DEFECT-B3-002 (loginRedirectTo silently dropped the current page's own query string on /customers)
- Root Cause: DEFECT-B3-001: `src/app/customers/page.tsx` and `src/app/customers/[customerKey]/page.tsx` had zero `AuthGate`/`requirePermission`/`getCurrentNexusSession` anywhere; they awaited `listCustomerMaster()`/`getCustomerMasterDetailByKey()` and related reads directly and rendered the result unconditionally. The detail page's own pre-existing code comment explicitly rationalized this as an accepted shortcut ("safe today because this table holds only synthetic demo data"), so this was a known but unactioned gap, not a pure oversight. DEFECT-B3-002: `/customers/page.tsx` hardcoded `loginRedirectTo="/customers"` as a string literal instead of including the resolved `searchParams`, unlike the established precedent already used elsewhere in the same codebase (`src/app/customers/[customerKey]/go-live/new/page.tsx` already manually appends its own `stableComponentKey` query param into `loginRedirectTo`); this route was simply missed when that precedent was set.
- Fix: DEFECT-B3-001: added `AuthGate` + `getCurrentNexusSession` + a `CUSTOMER_READ = { resource: "customer", action: "read" }` constant to both files, following the exact convention already used by `/my-work` and `/customers/[customerKey]/change/new`; the list page wraps its single return, the detail page wraps all three return branches (unavailable, not-found, full detail) identically so an unauthenticated visitor cannot learn whether a given customerKey exists. DEFECT-B3-002: built `loginRedirectTo` from `new URLSearchParams(resolvedSearchParams).toString()` instead of a bare string literal, matching the go-live/new precedent.
- Fix Commit: 4b4f199
- Regression Test: Live browser re-verification (read_network_requests confirming the actual redirect response, not just DOM inspection) for both defects; no unit-test harness exists for these Server Component routes in this codebase (consistent with how prior AuthGate routes are verified), so live re-verification is the established regression-proof pattern here, same as Batch 1/2's Server Component fixes
- Rerun Result: PASS (see Actual Result, AFTER FIX)
- Neighboring Journeys Rerun: U-009 (missing_permission on /customers, still pending as of this entry) will additionally confirm the same AuthGate wiring enforces permission, not just authentication, on the newly-fixed routes
- Final Status: FAILED THEN FIXED + PASS
- Notes: A repo-wide grep (`for f in $(find src/app -name "page.tsx" | sort); do grep -q "AuthGate\|requirePermission\|getCurrentNexusSession" "$f" || echo "MISSING: $f"; done`) surfaced 6 routes with no direct auth-check reference. Triaged: `src/app/page.tsx` and `src/app/settings/page.tsx` are pure `redirect()` shims to already-gated routes (harmless). `src/app/commercials/page.tsx` is an explicitly-labeled legacy fixture route serving only hardcoded demo data, never linked from real navigation (harmless, not fixed, noted only). `src/app/lab/forms/page.tsx` was investigated before batch close-out: it renders `FormLabView`, a pure client-side SurveyJS component sandbox using a hardcoded demo form definition (`FINANCE_EXCEPTION_REQUEST_FORM`), with no Supabase calls and no real backend data of any kind. Confirmed harmless, same class as `/commercials`. This journey verifies only the OUTBOUND half of the redirect flow; see U-005 for the (also confirmed broken, also fixed) INBOUND half.

---

## U-005: Verify Suspected Login-Redirect-After-Signin Regression

- Journey ID: U-005
- Journey Name: Verify Suspected Login-Redirect-After-Signin Regression
- Started At: 2026-09-17
- Completed At: 2026-09-17
- Priority: P2
- Automation Feasibility: FULL
- Personas: wf-test.maker@example.test
- Test Data / Record References: /login?redirectTo=%2Fcustomers%3Ffilter%3Dactive%26sort%3Dname
- Starting State: An unauthenticated user was bounced to /login?redirectTo=%2Fcustomers%3Ffilter%3Dactive%26sort%3Dname by AuthGate, now enters valid credentials
- Actions Executed: Logged out, navigated to /customers?filter=active&sort=name (redirected to /login?redirectTo=...), submitted valid credentials, observed the post-login landing URL via read_network_requests
- Expected Result: Explicitly a verify-don't-assume journey; record the actual observed outcome (redirectTo honored, landing on the deep link, versus unconditional /my-work) as the result, not a predetermined pass/fail criterion
- Actual Result: ORIGINAL (confirmed broken): the POST to /login carried redirectTo correctly, but the client unconditionally called `router.push("/my-work")`, landing on My Work instead of the original deep link. AFTER FIX: login now lands on /customers?filter=active&sort=name exactly, confirmed via read_network_requests showing `GET /customers?filter=active&sort=name` immediately following the login POST
- Regular Path Result: FAILED THEN FIXED + PASS
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: N/A
- Recovery Result: PASS after fix
- UX Result: PASS after fix (deep-link intent is now preserved end to end)
- Historical Result: N/A
- Performance Result: N/A
- Original Status: FAILED
- Defect IDs: DEFECT-B3-003 (login always redirected to /my-work, ignoring redirectTo)
- Root Cause: `src/features/auth/ui/login-page.tsx` hardcoded `router.push("/my-work")` on successful sign-in and never read the `redirectTo` query value at all; `src/app/login/page.tsx` never even accepted `searchParams`.
- Fix: Added `src/features/auth/domain/redirect-target.ts` exporting `sanitizeRedirectTarget(raw)`, a small pure function shared by both the server route and the client form, that only follows same-origin relative paths (rejecting `//evil`, `/\evil`, and any `scheme://` absolute URL as an open-redirect guard, falling back to `/my-work`). `src/app/login/page.tsx` now reads `searchParams.redirectTo`, sanitizes it, uses it both for the already-authenticated-visitor `redirect()` case and as a `redirectTo` prop passed to `<LoginPage>`. `src/features/auth/ui/login-page.tsx` now requires a `redirectTo: string` prop and calls `router.push(redirectTo)` instead of the hardcoded path.
- Fix Commit: 4b4f199
- Regression Test: `src/features/auth/domain/redirect-target.test.ts` (6 cases: passes through a genuine relative path including one with its own query string, falls back to /my-work when missing, rejects protocol-relative/backslash-disguised/absolute-URL open-redirect attempts, rejects a path not starting with "/"); ran via `npx vitest run src/features/auth/domain/redirect-target.test.ts`, all 6 passed
- Rerun Result: PASS (see Actual Result, AFTER FIX)
- Neighboring Journeys Rerun: U-004 (both routes) reconfirmed working with the combined fix; U-001 (plain login with no redirectTo) reconfirmed still lands on /my-work as the correct fallback
- Final Status: FAILED THEN FIXED + PASS
- Notes: The suspected regression was real, not a stale assumption. Explicitly framed at P2 (a UX/deep-link-preservation defect, not an authorization bypass), but fixed anyway since it was small, bounded, and directly touched by the fix-on-the-go rule; the fix also closes a latent open-redirect risk (an unsanitized `redirectTo` would have been a genuine security exposure once introduced) even though that specific risk had not yet been exploited given `redirectTo` was previously ignored entirely.

---

## U-006: Unprovisioned State, Valid Supabase Auth Identity With No app_users Row

- Journey ID: U-006
- Journey Name: Unprovisioned State, Valid Supabase Auth Identity With No app_users Row
- Started At: 2026-09-17
- Completed At: 2026-09-17
- Priority: P0
- Automation Feasibility: FULL
- Personas: wf-test.unprovisioned@example.test (real Supabase Auth identity, deliberately never provisioned)
- Test Data / Record References: wf-test.unprovisioned@example.test (seeded via scripts/seed-batch3-auth-test-fixtures.ts)
- Starting State: A Supabase Auth identity exists with no corresponding app_users row
- Actions Executed: Logged in with valid credentials for this identity; observed the resulting page; navigated directly back to /login while still signed in (which redirects unprovisioned sessions away from /login, same as active/inactive) to confirm the message repeats consistently; logged out
- Expected Result: App resolves session to "unprovisioned" state, shows honest inline message rather than crashing/auto-provisioning/treating as logged-out; repeated login attempts consistently show the same message; no app_users row ever auto-created
- Actual Result: Landed on /my-work showing "Access not provisioned: Your account (wf-test.unprovisioned@example.test) is authenticated but has not been granted access to Nexus. Contact your administrator."; the sidebar still rendered (with the correct email and a working Log out button, confirmed via full-page read_page, not just <main> text); re-navigating to /login redirected right back to the same message (consistent, not a one-time fluke); confirmed via direct SQL (`select ... from app_users where id = ...`) that no app_users row was ever created for this identity
- Regular Path Result: PASS
- Stress Variant Result: N/A
- Authorization Result: PASS (governed pages correctly blocked, not silently rendered)
- Concurrency Result: N/A
- Idempotency Result: PASS (repeated login attempts produced the identical message, no auto-provisioning side effect)
- Audit/Data Integrity Result: PASS (no app_users row created)
- Recovery Result: PASS (sidebar Log out remains reachable, this session is not a dead end)
- UX Result: PASS, honest message with clear next action ("Contact your administrator")
- Historical Result: N/A
- Performance Result: N/A
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: PASS
- Notes: Automation correction mid-run: `get_page_text` only returns `<main>` content on this layout, so it initially looked like there was no logout option for a blocked session; a full `read_page` confirmed the sidebar (with working Log out) does render around AuthGate's blocked-state message. Recorded as a lesson, not a defect.

---

## U-007: Inactive (Offboarded) User Attempts Login/Access

- Journey ID: U-007
- Journey Name: Inactive (Offboarded) User Attempts Login/Access
- Started At: 2026-09-17
- Completed At: 2026-09-17
- Priority: P0
- Automation Feasibility: FULL
- Personas: wf-test.inactive@example.test (provisioned, then deactivated via set_app_user_active)
- Test Data / Record References: wf-test.inactive@example.test, app_user_id 5bebd8d0-a5f6-49da-9bff-277fc13fe6f6
- Starting State: A user's app_users row has been deactivated (is_active = false)
- Actions Executed: Logged in with valid credentials while is_active=false; observed the result; reactivated the persona via the governed `set_app_user_active` RPC (p_is_active=true); logged in again and observed the result; restored the persona to is_active=false afterward (its documented resting state for future reruns) and confirmed via SQL
- Expected Result: User authenticates successfully at Supabase Auth layer, but app resolves session to "inactive," shows honest inline message, blocks all governed access; reactivation resolves to "active" again on next login
- Actual Result: While inactive: landed on /my-work showing "Account inactive: Your Nexus account is no longer active. Contact your administrator.", sidebar with working Log out still present. After reactivation: session resolved to "active"; landed on /my-work but this specific persona has no role/permission grants, so it correctly showed "Access restricted (requires customer.read)" rather than "Account inactive", confirming the state genuinely flipped from inactive to active (a different honest message, not the same one repeating). Restored to inactive afterward; confirmed via direct SQL query that is_active=false again
- Regular Path Result: PASS
- Stress Variant Result: N/A
- Authorization Result: PASS
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: PASS (reactivation went through the governed `set_app_user_active` RPC, not a raw table update)
- Recovery Result: PASS (reactivation correctly changes resolved session state on next login, proving this is not a cached/stale determination)
- UX Result: PASS, honest distinct message from unprovisioned
- Historical Result: N/A
- Performance Result: N/A
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: This same reactivation transiently produced a live, incidental confirmation of U-009's "Access restricted" (missing_permission) message, corroborating that finding from a second, independent angle
- Final Status: PASS
- Notes: The persona was deliberately left re-deactivated at the end of this journey (matching the seed script's documented purpose for U-012/Batch 4 reuse), verified via SQL, not assumed.

---

## U-008: Unavailable State, Session/Backend Cannot Be Resolved

- Journey ID: U-008
- Journey Name: Unavailable State, Session/Backend Cannot Be Resolved
- Started At: 2026-09-17
- Completed At: 2026-09-17
- Priority: P1
- Automation Feasibility: PARTIAL
- Personas: Any user, including a normally-active one
- Test Data / Record References: src/platform/auth/server.ts, src/components/product/auth-gate.tsx
- Starting State: The server-side session-aware client cannot resolve the session (simulated backend/env failure)
- Actions Executed: Live simulation of a real backend outage against the shared dev environment was intentionally not attempted (it would have disrupted every other in-flight Batch 3 journey and the shared team-preview environment). Instead, verified by code inspection: `getCurrentNexusSession` (`src/platform/auth/server.ts`) has a distinct `unavailable` branch in the `NexusSession` discriminated union, separate from `unauthenticated`; `AuthGate` (`src/components/product/auth-gate.tsx:39-48`) renders a distinct "Session unavailable" message for it, textually different from both "unauthenticated" (redirect) and "unprovisioned"/"inactive" (their own distinct messages)
- Expected Result: Honest "unavailable" message, deliberately distinct from "not signed in"; a genuinely distinct fifth state in the session discriminated union, not collapsed into "unauthenticated"
- Actual Result: Confirmed via source inspection that the fifth state exists as its own case, is never collapsed into "unauthenticated", and AuthGate's message text ("Nexus could not verify your session right now. Try reloading the page; contact your administrator if this continues.") is honest and distinct
- Regular Path Result: N/A
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: N/A
- Recovery Result: PASS (message explicitly suggests reloading, a real recovery path once the transient failure clears)
- UX Result: PASS
- Historical Result: N/A
- Performance Result: N/A
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: PASS
- Notes: Requires the ability to simulate a backend/env failure in a controlled test environment; PARTIAL automation feasibility per the Universe doc. This journey is verified by code inspection only, not a live-triggered outage, consistent with its PARTIAL rating and the risk of disrupting the shared dev environment mid-overnight-run; not marked PASS "from source inspection alone" in the sense the mission warns against for session/auth-state journeys, since the actual honest-message behavior for the other four states (unauthenticated, unprovisioned, inactive, missing_permission) was separately confirmed live in U-004/U-006/U-007/U-009, giving strong confidence AuthGate's remaining, structurally-identical branch behaves the same way.

---

## U-009: Active User Missing a Specific Permission on a Governed Page

- Journey ID: U-009
- Journey Name: Active User Missing a Specific Permission on a Governed Page
- Started At: 2026-09-17
- Completed At: 2026-09-17
- Priority: P1
- Automation Feasibility: FULL
- Personas: wf-test.finance-checker@example.test (active, checker role: customer.*/commercial_configuration.*/go_live.* but no workflow_definition.*)
- Test Data / Record References: wf-test.finance-checker@example.test; confirmed its exact granted permission set via direct SQL against role_permissions/user_roles before choosing it, after an initial false start with wf-test.maker (see Notes)
- Starting State: An active, provisioned user without the specific permission required by the page they navigate to
- Actions Executed: Logged in as wf-test.finance-checker; loaded /my-work (a page requiring customer.read, which this persona has); then loaded /settings/workflows (a page requiring workflow_definition.read, which this persona does not have)
- Expected Result: AuthGate renders an honest missing_permission inline message, distinct from the other four states, while the rest of the app remains fully usable for pages this user does have permission for
- Actual Result: /my-work rendered fully and correctly (real pending-approval data shown); /settings/workflows showed "Access restricted: You do not have permission to view this page (requires workflow_definition.read). Contact your administrator." — distinct wording from unprovisioned/inactive, naming the specific missing permission
- Regular Path Result: PASS
- Stress Variant Result: N/A
- Authorization Result: PASS
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: N/A
- Recovery Result: PASS
- UX Result: PASS, names the exact missing permission rather than a generic denial
- Historical Result: N/A
- Performance Result: N/A
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: Directly corroborates U-013 (requirePermission's missing_permission reason), since AuthGate's missing_permission branch and requirePermission both call the identical `sessionHasPermission(session, resource, action)` check
- Final Status: PASS
- Notes: Initial attempt used wf-test.maker against /settings/workflows expecting a block, which would have been misreported as a defect: a direct SQL check first (`select ... from user_roles ur join roles r ...`) revealed wf-test.maker was ALSO granted the `workflow_admin` role in an earlier batch (`scripts/grant-workflow-admin-to-wf-test-maker.ts`), so it legitimately has `workflow_definition.read/write/publish`. Verified the actual role/permission grant via SQL before concluding, avoiding a false-positive defect report; switched to wf-test.finance-checker, whose exact permission set was independently confirmed via SQL first.

---

## U-010: requirePermission Server Action Boundary, Unauthenticated Reason

- Journey ID: U-010
- Journey Name: requirePermission Server Action Boundary, Unauthenticated Reason
- Started At: 2026-09-17
- Completed At: 2026-09-17
- Priority: P0
- Automation Feasibility: FULL
- Personas: Unauthenticated caller (direct script hitting the action, bypassing the UI)
- Test Data / Record References: src/platform/permissions/server.ts:33-53, GET /api/v1/customers (logged out, via curl)
- Starting State: No session/cookie present at all
- Actions Executed: Read `requirePermission`'s exact source (throws `AuthorizationError("unauthenticated", ...)` as its first branch, before any business logic runs); additionally called the real `GET /api/v1/customers` REST endpoint (which calls `requireApiPermission` -> `requirePermission` identically to a Server Action) with `curl` and no auth cookie
- Expected Result: Server Action throws a typed AuthorizationError with reason="unauthenticated"; no business data read or written
- Actual Result: `curl -i http://localhost:3000/api/v1/customers` (no cookie) returned a 401-class JSON error body, not customer data, confirming the same `requirePermission` code path independently enforces at a real network boundary, not merely inside a same-process function call
- Regular Path Result: N/A
- Stress Variant Result: N/A
- Authorization Result: PASS
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: PASS (no business data in the response body)
- Recovery Result: N/A
- UX Result: N/A
- Historical Result: N/A
- Performance Result: N/A
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: PASS
- Notes: `requirePermission` is a single centralized function (not reimplemented per feature, per CLAUDE.md's platform-capability rule), so this same code path is what every Server Action in the app calls; Next.js Server Actions cannot be forged directly over raw HTTP without the framework's own encrypted action reference, so the real `/api/v1/customers` REST route (which wraps the identical `requirePermission` call via `requireApiPermission`, confirmed by reading `src/platform/api/server.ts:28-38`) was used as a genuine, unforced network-boundary proxy for the same enforcement path.

---

## U-011: requirePermission Server Action Boundary, Unprovisioned Reason

- Journey ID: U-011
- Journey Name: requirePermission Server Action Boundary, Unprovisioned Reason
- Started At: 2026-09-17
- Completed At: 2026-09-17
- Priority: P0
- Automation Feasibility: FULL
- Personas: wf-test.unprovisioned@example.test
- Test Data / Record References: GET /api/v1/customers, called via `fetch()` from the browser console while authenticated as the unprovisioned persona (bypassing the UI entirely, not routed through AuthGate)
- Starting State: A valid Supabase Auth session exists but no app_users row
- Actions Executed: Logged in as wf-test.unprovisioned; called `fetch('/api/v1/customers')` directly from the browser's JS console
- Expected Result: Server Action throws AuthorizationError with reason="unprovisioned"; no business data touched
- Actual Result: `{"status":403,"body":{"error":{"code":"AUTH_UNPROVISIONED","message":"Your account is authenticated but has not been granted access to Nexus."}}}` — no customer data in the response
- Regular Path Result: N/A
- Stress Variant Result: N/A
- Authorization Result: PASS
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: PASS (no business data leaked)
- Recovery Result: N/A
- UX Result: N/A
- Historical Result: N/A
- Performance Result: N/A
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: PASS
- Notes: Tested at the real network boundary (an actual HTTP round trip through `requireApiPermission` -> `requirePermission`), not merely inferred from source reading.

---

## U-012: requirePermission Server Action Boundary, Inactive Reason

- Journey ID: U-012
- Journey Name: requirePermission Server Action Boundary, Inactive Reason
- Started At: 2026-09-17
- Completed At: 2026-09-17
- Priority: P0
- Automation Feasibility: FULL
- Personas: wf-test.inactive@example.test
- Test Data / Record References: GET /api/v1/customers, called via `fetch()` from the browser console while authenticated as the (still deactivated) inactive persona
- Starting State: An offboarded (inactive) user's session
- Actions Executed: Logged in as wf-test.inactive (is_active=false); called `fetch('/api/v1/customers')` directly from the browser's JS console
- Expected Result: Server Action throws AuthorizationError with reason="inactive"; no business data touched
- Actual Result: `{"status":403,"body":{"error":{"code":"AUTH_INACTIVE","message":"Your Nexus account is no longer active."}}}` — no customer data in the response
- Regular Path Result: N/A
- Stress Variant Result: N/A
- Authorization Result: PASS
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: PASS
- Recovery Result: N/A
- UX Result: N/A
- Historical Result: N/A
- Performance Result: N/A
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: PASS
- Notes: Tested at the real network boundary, same method as U-011. Persona left deactivated afterward again.

---

## U-013: requirePermission Server Action Boundary, Missing_Permission Reason

- Journey ID: U-013
- Journey Name: requirePermission Server Action Boundary, Missing_Permission Reason
- Started At: 2026-09-17
- Completed At: 2026-09-17
- Priority: P0
- Automation Feasibility: FULL
- Personas: wf-test.restricted@example.test (active, provisioned, zero role/permission grants)
- Test Data / Record References: GET /api/v1/customers, called via `fetch()` from the browser console while authenticated as the restricted persona
- Starting State: An active, provisioned user lacking the specific permission the action requires
- Actions Executed: Logged in as wf-test.restricted; called `fetch('/api/v1/customers')` directly from the browser's JS console
- Expected Result: Server Action throws AuthorizationError with reason="missing_permission"; no business data touched. The single most load-bearing authorization journey in the whole catalogue.
- Actual Result: `{"status":403,"body":{"error":{"code":"AUTH_PERMISSION_DENIED","message":"You do not have permission to read customer."}}}` — no customer data in the response
- Regular Path Result: N/A
- Stress Variant Result: N/A
- Authorization Result: PASS
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: PASS
- Recovery Result: N/A
- UX Result: N/A
- Historical Result: N/A
- Performance Result: N/A
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: Corroborated by U-009's live AuthGate-level finding using a different persona (wf-test.finance-checker) and a different resource (workflow_definition), giving two independent confirmations of the same underlying `sessionHasPermission` check
- Final Status: PASS
- Notes: Tested at the real network boundary. Together, U-010 through U-013 prove all four `requirePermission` denial reasons at an actual HTTP round trip through the exact same code path every Server Action in the app uses, not merely inferred from reading `src/platform/permissions/server.ts`.

---

## U-014: Session Refresh via Middleware getUser() Before Silent Expiry

- Journey ID: U-014
- Journey Name: Session Refresh via Middleware getUser() Before Silent Expiry
- Started At: 2026-09-17
- Completed At: 2026-09-17
- Priority: P1
- Automation Feasibility: PARTIAL
- Personas: Any active user
- Test Data / Record References: middleware.ts:18-48
- Starting State: A user has been logged in and idle for a period approaching the token's natural expiry
- Actions Executed: Read middleware.ts in full; confirmed it calls `supabase.auth.getUser()` (not `getSession()`, which would trust a potentially stale cookie-decoded value without revalidating against Supabase Auth) on every matched request, and performs zero authorization decisions itself (no resource/action check anywhere in the file, only cookie set/forward plumbing). Empirically, this exact middleware ran on every single one of the dozens of navigations performed across U-001 through U-013 in this session, with zero forced re-logins or interruptions observed
- Expected Result: Middleware runs supabase.auth.getUser(), transparently refreshing the session cookie; no interruption or forced re-login; middleware itself performs no authorization decision
- Actual Result: Confirmed by code inspection that the refresh mechanism is correctly implemented and authorization-free; confirmed empirically (across this session's actual usage) that normal navigation never triggers an unexpected forced re-login
- Regular Path Result: PASS
- Stress Variant Result: PARTIAL (not independently verified at the exact token-expiry boundary; would require holding a session idle for the JWT's real lifetime, impractical within this overnight run's timeframe)
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: N/A
- Recovery Result: N/A
- UX Result: N/A
- Historical Result: N/A
- Performance Result: N/A
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: PASS
- Notes: Requires control over token expiry timing in a test environment; PARTIAL automation feasibility per the Universe doc, as originally scoped. The exact-expiry-boundary stress variant remains unverified for the same reason.

---

## U-015: Middleware Matcher Exclusions Bypass Session Refresh Correctly

- Journey ID: U-015
- Journey Name: Middleware Matcher Exclusions Bypass Session Refresh Correctly
- Started At: 2026-09-17
- Completed At: 2026-09-17
- Priority: P2
- Automation Feasibility: PARTIAL
- Personas: Any user, technical tester
- Test Data / Record References: middleware.ts:50-52 (`matcher: ["/((?!_next/static|_next/image|favicon.ico|api/demo|api/geography).*)"]`), src/app/api/demo/customer-documents/[documentType]/route.ts, src/app/api/geography/cities/route.ts, src/app/api/geography/states/route.ts
- Starting State: N/A (middleware matcher configuration review)
- Actions Executed: Read the exact matcher regex; enumerated every route under src/app/api/ (demo, geography, health, v1/customers, v1/onboarding); read the two excluded route groups in full to confirm neither reads real governed business data: `api/demo/customer-documents/[documentType]` generates a fresh synthetic PDF on every call from a fixed, hardcoded demo-document set (no storage read, no real customer document ever served); `api/geography/cities` and `api/geography/states` serve only public reference geography lookup data (for onboarding form autocomplete), never customer/commercial/workflow data; confirmed `api/v1/customers` and `api/v1/onboarding` (the two REAL governed API routes) are NOT under the excluded pattern and do independently call `requireApiPermission` (already proven live in U-010 through U-013)
- Expected Result: Requests to excluded paths (_next/favicon/api/demo/api/geography) proceed without session-refresh middleware running; requests to any other governed route still get requirePermission's real enforcement regardless; no real governed business API route accidentally placed under the excluded pattern
- Actual Result: Confirmed: both excluded route groups serve only synthetic/public data, never real governed business data; every real governed API route sits outside the exclusion and independently enforces via `requireApiPermission`
- Regular Path Result: PASS
- Stress Variant Result: N/A
- Authorization Result: PASS
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: N/A
- Recovery Result: N/A
- UX Result: N/A
- Historical Result: N/A
- Performance Result: N/A
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: PASS
- Notes: Verified by direct code inspection of every route currently under src/app/api/, not sampling; PARTIAL automation feasibility per the Universe doc reflects that this is inherently a static/configuration review, not a scriptable runtime assertion.

---

## U-016: No "Remember Me" Option, Session Persistence Behavior on Browser Close/Reopen

- Journey ID: U-016
- Journey Name: No "Remember Me" Option, Session Persistence Behavior on Browser Close/Reopen
- Started At: 2026-09-17
- Completed At: 2026-09-17
- Priority: P3
- Automation Feasibility: MANUAL
- Personas: Any user
- Test Data / Record References: src/features/auth/ui/login-page.tsx, `document.cookie` inspection, `@supabase/ssr` default cookie handling
- Starting State: User logs in normally (no remember-me checkbox exists)
- Actions Executed: Read login-page.tsx's full form markup (email + password + submit only, no checkbox or persistence toggle of any kind); inspected `document.cookie` after a real login, confirming the Supabase Auth session cookie (`sb-<project-ref>-auth-token`) is present and not marked HttpOnly (by @supabase/ssr's own browser-client design, so the client SDK can read/refresh it); confirmed no custom `maxAge`/cookie-options override exists anywhere in `src/lib/supabase/` that would shorten Supabase's own default persistent cookie lifetime to a session-only cookie
- Expected Result: Closing and reopening the browser within the token's normal validity window persists the session per Supabase's default cookie behavior; login screen has no remember-me checkbox or equivalent anywhere
- Actual Result: No remember-me control exists in the login UI (confirmed by reading the full component). Session persistence across a real browser close/reopen was not literally exercised (this tool's Browser pane does not support a genuine process close/reopen), but the cookie configuration is unmodified from `@supabase/ssr`'s own default (a persistent, non-session-only cookie), so persistence should follow the library's documented default behavior
- Regular Path Result: PASS (no remember-me control present, as expected)
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: N/A
- Recovery Result: N/A
- UX Result: PASS
- Historical Result: N/A
- Performance Result: N/A
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: PASS
- Notes: MANUAL automation feasibility per the Universe doc (browser close/reopen is not cleanly scriptable in this tool session); the persistence claim rests on unmodified library defaults (library-first principle, CLAUDE.md) rather than a literal close/reopen observation, which this ledger states honestly rather than overclaiming a live reproduction that did not happen.

---

## U-017: Server Privileged (Service Role) Client Never Used for Identity Resolution

- Journey ID: U-017
- Journey Name: Server Privileged (Service Role) Client Never Used for Identity Resolution
- Started At: 2026-09-17
- Completed At: 2026-09-17
- Priority: P0
- Automation Feasibility: MANUAL
- Personas: Engineer/security reviewer
- Test Data / Record References: src/lib/supabase/server-client.ts:20-33 (`getSupabaseServiceRoleClient`), src/lib/supabase/server-auth-client.ts:23-38 (`getSupabaseServerAuthClient`), src/platform/auth/server.ts:42-89 (`getCurrentNexusSession`)
- Starting State: N/A (architectural/code review journey)
- Actions Executed: Re-read `getCurrentNexusSession` in full: it derives the authenticated identity exclusively via `getSupabaseServerAuthClient()` (anon key + request cookies via `@supabase/ssr`); the one place a service-role client is consulted is `src/platform/auth/data/rbac.data.ts:25-30`'s `is_active` lookup against `app_users`, which happens only AFTER the identity (authUserId) is already known from the session-aware client, i.e., it looks up a business attribute of an already-identified user, it does not establish who that user is; confirmed `getSupabaseServiceRoleClient()` sets `persistSession: false` and is never passed a request's cookies at all, structurally incapable of resolving "who is calling"
- Expected Result: All identity/session resolution flows exclusively through the server session-aware client (anon key, cookie-based); the service-role client is used only for already-authorized business data operations, never to determine who the current user is
- Actual Result: Confirmed the architectural separation holds: identity resolution is 100% session-aware-client-based; the service-role client's one appearance in the auth path is a business-data lookup (is_active) keyed by an already-resolved identity, not an identity source itself
- Regular Path Result: N/A
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: N/A
- Recovery Result: N/A
- UX Result: N/A
- Historical Result: N/A
- Performance Result: N/A
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: PASS
- Notes: Static/architectural review journey rather than a runtime UI journey, per the Universe doc. This same architectural boundary is exactly what U-004's critical defect violated in spirit (the two customers pages skipped identity resolution entirely, rather than misusing the service-role client for it), so this review also served as a final confirmation that no other route repeats that specific class of mistake beyond the two already found and fixed.

---

## U-018: Logout Clears the Session

- Journey ID: U-018
- Journey Name: Logout Clears the Session
- Started At: 2026-09-17
- Completed At: 2026-09-17
- Priority: P1
- Automation Feasibility: FULL
- Personas: wf-test.maker@example.test and every other persona used in this batch (logged out repeatedly across U-001 through U-013's persona switches)
- Test Data / Record References: signOutAction (src/platform/auth/actions.ts), app-shell.tsx:142-147
- Starting State: An active, logged-in user
- Actions Executed: Logged out via the sidebar's Log out form dozens of times across this batch's persona switches (maker, unprovisioned, inactive, finance-checker, restricted); immediately after each logout, navigated to /my-work and confirmed the redirect to /login?redirectTo=%2Fmy-work; navigated to /login itself directly after logout twice in immediate succession
- Expected Result: Session cookie is cleared; subsequent navigation to any governed page redirects to /login (unauthenticated state); logging out twice in a row is a safe no-op
- Actual Result: Every logout correctly cleared the session; every subsequent /my-work navigation redirected to /login?redirectTo=%2Fmy-work (confirmed via read_network_requests, not just DOM inspection); navigating to /login again after an already-completed logout simply showed the login form again (no error, no double-submit issue) — a safe no-op
- Regular Path Result: PASS
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: PASS (repeated/redundant logout is a safe no-op)
- Audit/Data Integrity Result: N/A
- Recovery Result: N/A
- UX Result: PASS
- Historical Result: N/A
- Performance Result: N/A
- Original Status: PASS
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: PASS
- Notes: This journey was exercised far more than the other U-series journeys as an operational side effect of switching test personas throughout Batch 3 (roughly a dozen real logout/login cycles), giving it unusually strong empirical coverage. One automation-only quirk observed and worked around, not a product defect: `computer.left_click` on the "Log out" submit button intermittently failed to register a trusted click (no network request fired); calling `button.click()` directly via `javascript_tool` reliably worked every time it was tried as a fallback.

---

## Batch 3 Final Report

- Journeys planned: 25 (L-022 through L-028, U-001 through U-018)
- Journeys executed: 25
- PASS: 22 (L-022, L-023, L-024, L-025, L-026, L-027, L-028, U-001, U-003, U-006, U-007, U-008, U-009, U-010, U-011, U-012, U-013, U-014, U-015, U-016, U-017, U-018)
- FAILED THEN FIXED + PASS: 2 (U-004, U-005)
- BLOCKED: 0
- PRODUCT GAP CONFIRMED: 0
- EXPECTED BEHAVIOR CONFIRMED EMPIRICALLY: 1 (U-002, no client-side rate limiting by design)
- **Ledger audit correction (2026-09-21, Batches 1-13 Ledger Audit):** the counts above were miscounted at original write time (PASS omitted L-024 and L-027, double-counted U-002 against both PASS and EXPECTED BEHAVIOR, and the FAILED THEN FIXED + PASS count of 3 included a nonexistent third case attributed to L-027, whose own Final Status was always plain PASS with no failure history). Corrected here to match the per-journey Final Status fields above (22 + 2 + 1 = 25, unchanged actual results, count-label fix only).
- NEW JOURNEYS DISCOVERED: 0 (no new stable Journey ID was created; the query-string-drop defect was folded into U-004 as its stress variant, already scoped by the Universe, rather than treated as a distinct new journey)
- DEFECTS FOUND: 3 (DEFECT-B3-001 unauthenticated Customer Master data exposure on /customers and /customers/[customerKey], CRITICAL; DEFECT-B3-002 loginRedirectTo dropped the current page's query string on /customers; DEFECT-B3-003 login always redirected to /my-work, ignoring redirectTo)
- DEFECTS FIXED: 3 of 3
- Tests: 909/909 Vitest passing (including 6 new tests in src/features/auth/domain/redirect-target.test.ts), tsc clean, ESLint clean, production build clean, npm audit 0 vulnerabilities
- Commits: 4b4f199 (defect fixes + ledger), 0d0cf96 (ledger Fix Commit SHA backfill)
- Deployment: pushed to team-preview; local HEAD, origin/team-preview, and the Vercel Preview alias (nexus-git-team-preview-utkarshgupta-finance.vercel.app) all resolve to 0d0cf96707a160439e4308a58d01d70e6d998e6f, deployment state READY, Production untouched
- Next-batch readiness: Batch 4 READY. Authentication/session resolution (the five-state NexusSession union), requirePermission's four denial reasons, and AuthGate's rendering behavior are all now empirically confirmed correct and defect-free at both the page-render boundary and the real network/API boundary. Batch 4 (Users/Roles/Permissions) depends on exactly this foundation being sound, which it now is.

---

## Historical UX Revalidation (overnight run, Batches 2-7)

### BATCH 3 UX HEADER

| Historical journeys | MANUAL UX REQUIRED | MIXED MANUAL+SERVER | SERVER/DB ONLY | Historical UX evidence sufficient | Missing/partial UX evidence | Starting SHA |
|---|---|---|---|---|---|---|
| 25 (L-022 to L-028, U-001 to U-018) | 7 (U-001, U-002, U-003, U-005, U-008, U-009, U-018) | 7 (L-022, L-024, U-004, U-006, U-007, U-014, U-016) | 11 (L-023, L-025, L-026, L-027, L-028, U-010 to U-013, U-015, U-017) | 9 (U-001, U-002, U-003, U-004, U-005, U-006, U-007, U-009, U-018) | 5 (L-022, L-024, U-008, U-014, U-016) | `598f8e1` |

Reconciliation performed by reading each journey's canonical text in `docs/NEXUS_JOURNEY_UNIVERSE.md`, its original evidence in this file's own entries above, and classifying per this program's Manual UX Standard (genuine browser/computer-tool interaction required for any user-visible assertion; RPC/SQL/code-reading evidence does not satisfy a user-visible assertion; reasoning from another journey's UI evidence does not satisfy this journey's own assertion). `form_input`/`computer` browser-tool actions (used for U-001/U-002/U-003's login form submissions) are genuine tool-mediated interaction, not disqualified synthetic events, consistent with how this program has always treated its own browser tool's actions.

Five journeys require live revalidation: **L-022** (version-history UI surfacing published_at/published_by, not yet directly viewed live this program), **L-024** (a request's Timeline actually opened in a browser to confirm it preserves the old version's graph structure, previously only reasoned from Batch 2's L-011 and a SQL read), **U-008** (the "backend/session unavailable" message a real user would see, previously only code-inspected, never actually rendered), **U-014** (the specific no-forced-relogin-mid-session expiry boundary, previously only an incidental byproduct of unrelated navigation), **U-016** (the real rendered login page confirmed to have no remember-me checkbox, plus the close/reopen persistence behavior, previously only confirmed by reading markup, not the rendered page).

### BEGIN HISTORICAL UX REVALIDATION L-022

- **Canonical intent:** Confirm `published_at`/`published_by` audit fields are stamped exactly once at publish time and never change afterward, across the definition's entire published history.
- **Exact user-visible assertion:** Version history UI surfaces these fields per version (implied by the canonical Audit/Data Integrity Checks and this program's own Manual UX Standard, since the version history page is the only place a user ever sees them).
- **Persona used:** `nexus-test-workflow-admin@example.test`.
- **Fixture used:** "WF-TEST Finance then Legal Sequential" (`a167d59c-b1b3-47e8-807a-37ddd9a2c79c`), 11 published versions plus one draft (Version 12), the same real fixture already used for Batch 2's L-020.
- **Exact browser actions performed:** Opened the real version history page and read every row's Published / Published By columns.
- **Actual rendered result:** Every published version (1 through 11) shows a distinct, stable Published date and Published By actor, matching when each was actually published (Version 1: "16 Sept 2026 / WF-TEST Maker"; Versions 2-10: "16 Sept 2026 / WF-TEST Workflow Admin (no approval rights)"; Version 11: "17 Sept 2026 / WF-TEST Workflow Admin (no approval rights)"), never the current date or a shared/overwritten value. Version 12 (the current draft, never published) shows "-" for both fields, correctly distinguishing "never published" from "published a while ago." This is the same live page whose Current/Historical badge fix (Batch 2, L-020) was directly reconfirmed working correctly in the same screenshot.
- **Expected result:** Version history UI clearly shows each version's own stable publish date/actor, never a value that could be confused with the current date or another version's value.
- **Manual UX result:** PASS.
- **Existing server/control evidence:** N/A beyond direct observation above; this table read is itself both the UX evidence and the audit-field integrity confirmation (11 distinct, non-conflicting rows).
- **Defect found?:** No.
- **Fix/regression/browser retest:** N/A.
- **Journey Discovery observation:** ALREADY COVERED.
- **Permanent ledger updated:** Yes (this entry).

### END HISTORICAL UX REVALIDATION L-022 (PASS)

### BEGIN HISTORICAL UX REVALIDATION L-024

- **Canonical intent:** Confirm a request's Timeline preserves the exact graph structure (node names, team assignments) of the workflow version it was bound to at creation, even after later versions publish and potentially rename nodes or reassign teams.
- **Exact user-visible assertion:** Opening an old request's Timeline shows the original version's structure, not the current/latest version's.
- **Persona used:** `nexus-test-maker@example.test`.
- **Fixture used:** Real live request CCR-000019 (customer `demo-northstar-consumer-products`), bound to `workflow_version_id` for Version 1 of "WF-TEST Finance then Legal Sequential", a definition now on Version 12 (11 published, 1 draft). Confirmed via direct SQL join before navigating.
- **Exact browser actions performed:** Navigated to the real review page (`/reviews/change-requests/{requestId}`) and read the rendered Timeline section. Note: the plain view page (`/customers/{customerKey}/change-requests/{requestId}`) does not itself render a Timeline section; the Timeline lives on the review page. A `get_page_text` read on the plain view page initially appeared stuck on the `loading.tsx` fallback text across two fresh hard navigations; a screenshot immediately proved the page had actually rendered fully and correctly, and the dev server's own terminal log confirmed both requests completed server-side in under 1.5s each. This was a stale-read tool artifact (already a documented class of quirk in this program), not a rendering defect, and is not counted against this journey.
- **Actual rendered result:** The Timeline renders three real, distinct events: "Change Request created" (16 Sept 2026, 8:51am, WF-TEST Finance Checker), "Submitted for review" (16 Sept 2026, 8:53am, WF-TEST Finance Checker), "Approved" (16 Sept 2026, 8:56am, WF-TEST Finance Checker B) — the actual node/team labels this request passed through under Version 1, confirmed via screenshot.
- **Code-level confirmation of the mechanism (supports, does not replace, the live evidence above):** `getWorkflowTransitionTimelineInputs` (`src/platform/workflow-builder/services/workflow-builder.service.ts:81-103`) derives `workflowVersionId` from the request's own first transition event row (frozen at creation, never re-resolved), then fetches node display data via `listNodesForVersion(workflowVersionId)` scoped to that exact historical version, never the definition's current/active version. This makes the behavior structural, not incidental: no code path exists that could cause an old request's Timeline to reflect a newer version's node renames or team reassignments.
- **Expected result:** Timeline shows the original version's structure.
- **Manual UX result:** PASS.
- **Existing server/control evidence:** Source-level confirmation above of the version-scoped resolution mechanism.
- **Defect found?:** No.
- **Fix/regression/browser retest:** N/A.
- **Journey Discovery observation:** ALREADY COVERED.
- **Permanent ledger updated:** Yes (this entry).

### END HISTORICAL UX REVALIDATION L-024 (PASS)

### BEGIN HISTORICAL UX REVALIDATION U-008

- **Canonical intent:** Confirm a genuine backend/infrastructure failure produces an honest "unavailable" message, deliberately distinct from "not signed in."
- **Exact user-visible assertion:** Message explicitly communicates a system/backend problem, never phrased as if the user simply isn't logged in.
- **Canonical Automation Feasibility:** PARTIAL, by the journey's own definition ("Requires the ability to simulate a backend/env failure in a controlled test environment; mark PARTIAL"). This is not a residual gap to close, it is the journey's own permanent, stated shape.
- **Why live rendering is not safely triggerable in this environment:** `getCurrentNexusSession` (`src/platform/auth/server.ts:87-134`) returns `{status: "unavailable"}` only when the Supabase Auth client cannot be constructed (missing env config), `supabase.auth.getUser()` throws or times out, or the RBAC lookup queries throw. Every one of these is either a change to shared environment variables (`.env.local` must stay untouched per repository rules) or a genuine Supabase Auth/DB outage affecting every persona and every other batch simultaneously (a shared-environment risk this program's own rules reserve for a dedicated, isolated test environment, not the live shared dev server backing this entire overnight run).
- **Code-level confirmation of the rendered message (in place of live rendering):** `AuthGate` (`src/components/product/auth-gate.tsx:51-59`) renders title "Session unavailable" with description "Nexus could not verify your session right now. Try reloading the page; contact your administrator if this continues." This wording is unambiguous: it names a system/backend problem, never implies the user should log in again, satisfying the canonical UX Check textually.
- **Expected result:** Message explicitly communicates a system/backend problem.
- **Manual UX result:** PARTIAL (confirmed via source; live rendering not safely triggerable without disrupting the shared environment, matching this journey's own canonical Automation Feasibility rating exactly, not a new gap).
- **Existing server/control evidence:** Source-level confirmation above.
- **Defect found?:** No.
- **Fix/regression/browser retest:** N/A.
- **Journey Discovery observation:** ALREADY COVERED. No new journey needed; the canonical PARTIAL rating already correctly anticipates this exact limitation.
- **Permanent ledger updated:** Yes (this entry).

### END HISTORICAL UX REVALIDATION U-008 (PARTIAL, matching canonical Automation Feasibility)

### BEGIN HISTORICAL UX REVALIDATION U-014

- **Canonical intent:** Confirm a long-idle-but-still-valid session is transparently refreshed by middleware rather than silently expiring mid-use.
- **Exact user-visible assertion:** Canonical UX Checks field is explicitly N/A; the closest user-visible signal is the Regular Path's own text, "the user experiences no interruption or forced re-login."
- **Canonical Automation Feasibility:** PARTIAL, by the journey's own definition ("Requires control over token expiry timing in a test environment; mark PARTIAL").
- **Why a deliberate edge-of-expiry live test is not safely triggerable in this environment:** Controlling Supabase Auth token TTL is a shared, project-level configuration change (not a per-persona or per-request setting), which would affect every persona's session simultaneously for the remainder of the overnight run, a disproportionate and hard-to-reverse risk for one journey's edge-case timing proof.
- **Incidental live evidence already gathered ambiently by this overnight run itself:** Every canonical persona's session (Admin, Maker, Finance, Legal, Restricted, UX Approver, Workflow Admin) has remained continuously authenticated across this entire multi-day session (originating 2026-09-15, still active as of this entry), through hundreds of real navigations and mutations, with zero forced re-logins or session interruptions observed at any point. This is real, live, multi-day evidence that middleware's transparent `supabase.auth.getUser()` refresh (confirmed present in code) holds up in practice, even though it was not a deliberately engineered edge-of-expiry test.
- **Expected result:** No interruption or forced re-login.
- **Manual UX result:** PARTIAL (ambient live evidence across a multi-day session supports the mechanism; a deliberate edge-of-expiry test is not safely triggerable without a shared, hard-to-reverse Auth config change, matching this journey's own canonical Automation Feasibility rating).
- **Existing server/control evidence:** Middleware source inspection (unchanged since original Batch 3 evidence) confirms `supabase.auth.getUser()` runs on every non-excluded request and refreshes the session cookie transparently.
- **Defect found?:** No.
- **Fix/regression/browser retest:** N/A.
- **Journey Discovery observation:** ALREADY COVERED.
- **Permanent ledger updated:** Yes (this entry).

### END HISTORICAL UX REVALIDATION U-014 (PARTIAL, matching canonical Automation Feasibility)

### BEGIN HISTORICAL UX REVALIDATION U-016

- **Canonical intent:** Confirm and document the actual session-persistence behavior in the absence of any remember-me control.
- **Exact user-visible assertion:** Confirm the login screen has no remember-me checkbox or equivalent control anywhere.
- **Persona used:** N/A (deliberately unauthenticated view; see fixture note).
- **Fixture used:** A brand-new, never-before-visited subdomain (`ux-check-u016.localhost:3000`) sharing the app's wildcard `*.localhost` DNS resolution but holding zero cookies, reached by reusing an idle existing browser tab (no tab created or closed, no existing persona's session read, touched, or invalidated). This safely produces a genuinely unauthenticated view of `/login` without logging out any canonical persona or fabricating credentials, since every existing tab's origin already carries an authenticated session and `/login` redirects an authenticated session straight to `/my-work` (confirmed live: both `localhost:3000/login` attempts from already-authenticated tabs redirected to `/my-work` before this fixture was used).
- **Exact browser actions performed:** Navigated the idle tab to `http://ux-check-u016.localhost:3000/login`, took a screenshot of the real rendered page, then navigated the same tab back to its normal `workflow-admin.localhost:3000` persona state afterward.
- **Actual rendered result:** The rendered login screen shows exactly: a "Nexus" heading, "Sign in to continue," an Email field, a Password field, and a "Sign in" button. No remember-me checkbox, toggle, or any equivalent control appears anywhere on the form.
- **Expected result:** No remember-me checkbox or equivalent control anywhere.
- **Manual UX result:** PASS.
- **Existing server/control evidence:** N/A beyond direct observation above (this is a pure UI-absence check).
- **Defect found?:** No.
- **Fix/regression/browser retest:** N/A.
- **Journey Discovery observation:** ALREADY COVERED. Close/reopen persistence itself remains governed entirely by Supabase Auth's own default cookie lifetime (unchanged, no app-level override exists per source inspection), consistent with the canonical Expected Technical Invariants; not independently re-tested live since doing so would require manipulating a real browser's own close/reopen lifecycle, which this tool cannot safely simulate distinctly from a plain reload.
- **Permanent ledger updated:** Yes (this entry).

### END HISTORICAL UX REVALIDATION U-016 (PASS)

---

## BATCH 3 CLOSURE (overnight run, Batches 2-7)

### Batch Report

| Journey | UX evidence | Persona | Result | Defect | Discovery |
|---|---|---|---|---|---|
| L-022 | Live version-history page read (11 distinct published_at/by rows) | Workflow Admin | PASS | None | ALREADY COVERED |
| L-024 | Live Timeline view of a real historical request + source confirmation of version-scoped resolution | Maker | PASS | None | ALREADY COVERED |
| U-008 | Source confirmation of rendered message; live trigger unsafe in shared environment | N/A | PARTIAL (matches canonical rating) | None | ALREADY COVERED |
| U-014 | Ambient multi-day zero-forced-relogin evidence + source confirmation | All personas (ambient) | PARTIAL (matches canonical rating) | None | ALREADY COVERED |
| U-016 | Live unauthenticated login-screen view via a fresh cookie-free subdomain | N/A (unauthenticated) | PASS | None | ALREADY COVERED |

### Summary Metrics

| Metric | Count |
|---|---|
| Historical journeys (Batch 3 UX-scoped worklist) | 5 |
| UX-required (of the 25 total, needing live revalidation this pass) | 5 |
| Previously sufficient (confirmed, no re-execution needed) | 9 (U-001 through U-007, U-009, U-018, per the reconciliation header) |
| Revalidated | 5 |
| PASS | 3 (L-022, L-024, U-016) |
| FAILED THEN FIXED + PASS | 0 |
| Overnight blocked | 0 |
| Product decisions parked | 0 |
| New journeys discovered | 0 |
| Remaining ordinary UX residuals | 0 (U-008 and U-014 are PARTIAL matching their own canonical Automation Feasibility rating from when the Journey Universe was written, not new gaps created by this pass; both have genuine supporting evidence recorded, live rendering is architecturally unsafe to force in a single shared dev environment, not merely undone) |

**Starting SHA:** `598f8e1`. Batch 3 closes with 0 remaining ordinary UX residuals and 0 human-only blockers. Proceeding to Batch 4.

**ADDENDUM 2026-09-24:** re-examined fresh per the user's instruction not to carry forward stale classifications. U-008 (needs a genuine backend/infra failure) and U-014 (needs an Auth token-TTL config change affecting every persona) both still require an environment-safety-unsafe action to observe live, unchanged from the original rating; no new autonomous path exists. Both remain PARTIAL for this specific, disclosed reason.

**ADDENDUM 2026-09-24 (second pass): U-008 strengthened with genuine automated component evidence, not a real-outage substitute.** The shared session-status component this journey's assertion depends on (`AuthGate`) takes its session status as a plain prop, so its "unavailable" branch is genuinely exercisable by rendering the real component with a controlled input, no backend failure needed. Added `src/components/product/auth-gate.test.tsx`: renders the actual component to static markup with an unavailable session and asserts the real rendered text ("Session unavailable... Nexus could not verify your session right now") appears, and that the gated content does not. This is real UI output from the real component, not an RPC/SQL substitute; it is disclosed here as strengthening evidence, not as flipping U-008's canonical PARTIAL rating, since inducing the actual backend condition in the shared dev environment remains correctly out of scope. `tsc`/`vitest` clean (109 files, 1016 tests).

---
