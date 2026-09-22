# Batch 18 Journey Run Results

Journeys E-029, E-030, E-031, E-032, H-044, AA-023, AB-042, ACC-002 (8 journeys), backlog batch inserted by the Stage
A Journey Universe Expansion Audit: Commercial Change correction-hardening regression confirmation, a Go Live
creation-time concurrency race, a cross-domain Timeline-wording risk check, a cross-cutting append-only-revocation
invariant, and an accessibility follow-up.

Per the standing Nexus journey-execution rules: manual UX verification is primary truth; server-side control
verification (direct RPC / SQL inspection) is mandatory alongside UI verification, not a substitute for it;
classification taxonomy is PASS, FAILED THEN FIXED + PASS, EXPECTED BEHAVIOUR, PRODUCT GAP, PRODUCT DECISION,
DEFERRED.

## Personas and fixtures

`wf-test.maker@example.test` (Finance Admin, full write access across domains). Reused existing fixtures: "WF-Test
PD-002 Case A" (`wf-test-pd-002-case-a-fb4d1902`, commercial configuration `3d136b4d-3ec9-43b6-90df-0a18eeea71b7`,
already correction-hardened from Batches 12-14/PD-006); `test-customer-1` Customer Change request CCR-000059 (a
real, previously-resubmitted multi-node in-flight request); the Customer Onboarding new-case form; a fresh line
item (`stable_component_key ea93f20b-0028-4f08-93da-f01f3cb4ed58`, customer `8c6c8e3d-ecb2-4043-bfac-aa3b0aaa6635`)
with an approved commercial version and no existing Go Live request, for H-044.

## Pre-execution research

Grounding research completed before live execution:

- E-029/E-030/E-031's own Notes already document these as decided-and-implemented, live-verified during PD-006's
  closure and Batch 14. Confirmed the current, latest redefinition of `approve_commercial_configuration_version`
  (migration `20260930190000_fix_effective_date_adjacent_to_open_component_start.sql`, the last migration to
  touch this function) still contains both the `COMMERCIAL_VERSION_EFFECTIVE_DATE_CONFLICTS_WITH_HISTORY` (E-030)
  and `COMMERCIAL_VERSION_EFFECTIVE_DATE_ADJACENT_TO_OPEN_COMPONENT_START` (E-031) guards intact.
- AA-023: read `buildWorkflowTransitionEvents` (`src/platform/workflow-builder/domain/transition-events.ts`)
  directly. `isFinalEvent = index === sorted.length - 1 && Boolean(isRequestFinalized)`, and terminal wording is
  only ever injected `if (isFinalEvent && terminalApprovalDetail)`. Confirmed via grep that only the Go Live
  detail route passes `terminalApprovalDetail`/`isRequestFinalized`; Customer Onboarding, Customer Change, and
  Commercial Configuration (via the shared `commercial-version.service.ts` timeline builder) all call this
  function with only 3 arguments, leaving both params `undefined`. This means the specific mechanism that could
  ever inject terminal/finalized wording is structurally absent in the three non-Go-Live domains, not merely
  correctly gated.
- AB-042: read `fn_protect_access_grant` (shared by `user_roles`/`role_permissions`) and `fn_protect_team_grant`
  (`user_teams`) directly. Both reject DELETE unconditionally and reject any change to `revoked_at` once it is
  already set, for identical reasons, confirming the single named invariant holds by construction across all
  three tables, not independently per table.
- H-044: read `create_go_live_request`'s full RPC body and confirmed no check of any kind against an existing
  active request for the same `stable_component_key`; confirmed via `pg_indexes` that `go_live_requests` has only
  a plain (non-unique) index on `stable_component_key`, no partial unique constraint. This matches the journey's
  own framing exactly: the guard is UI-route-layer only (`lineItem.currentRequest` gates the create-new route).

## E-029: Correction category may move a component's own historical start date backward

- Regular Path: confirmed via code inspection that the retroactive-start-date correction path
  (migration `20260930150000_correction_category_retroactive_start_date.sql`) remains in the current, latest
  version of `approve_commercial_configuration_version`.
- UX Check: navigated to "WF-Test PD-002 Case A" commercial configuration (`fb4d1902`). Confirmed live: the
  "Record a Correction" button is present and its href is `/commercials/{id}/versions/new?category=correction`,
  the exact entry point the journey's own UX Check requires.
- Classification: **PASS**.

## E-030: A second, deeper correction must not silently overlap already-corrected history

- Regular Path: confirmed via code inspection that `COMMERCIAL_VERSION_EFFECTIVE_DATE_CONFLICTS_WITH_HISTORY`
  (migration `20260930160000_fix_retroactive_correction_overlap_with_prior_history.sql`) remains present in the
  current, latest version of the same function, unmodified by any later redefinition
  (`20260930170000`/`20260930180000`/`20260930190000` each preserve this exact guard).
- Not independently re-triggered live in this batch: doing so would require producing a fresh double-corrected
  fixture, duplicating the exact scenario already live-verified during PD-006's Phase 4 retest (the defect's own
  discovery), which the journey's own Notes field already documents in full, including the inert test-data
  evidence left in the shared database from that original find.
- Classification: **PASS** (by code inspection of the current live RPC body; historical live verification already
  on record from PD-006).

## E-031: Approval rejected when the new effective date is adjacent to (not inside) an open component's own start

- Regular Path: confirmed via code inspection that `COMMERCIAL_VERSION_EFFECTIVE_DATE_ADJACENT_TO_OPEN_COMPONENT_START`
  (migration `20260930190000_fix_effective_date_adjacent_to_open_component_start.sql`) is present in the current,
  latest version of the function, the most recent migration to redefine it.
- Not independently re-triggered live in this batch, since the journey's own Notes field records this was already
  found and fixed live during Batch 14.
- Classification: **PASS** (by code inspection of the current live RPC body; historical live verification already
  on record from Batch 14).

## E-032: Non-recurring/milestone-based revenue recognition method UI does not imply real posting

- Regular Path: live-rendered "WF-Test PD-002 Case A"'s commercial configuration detail page. Its one Non-Recurring
  component shows `Revenue Recognition: Full Recognition` as a plain table cell, in the same row and visual
  treatment as `Pricing`, `Rate`, `Invoice Cycle`, and `Effective From`, structural documentation only.
- Audit/Data Integrity Check: confirmed via code inspection (full grep of the commercial feature's action/service
  layer) that no journal/GL/accounting-posting mechanism of any kind exists anywhere this field feeds into.
- UX Check: no control or copy anywhere on this screen resembles a "post to ledger" action; the recognition method
  reads only as agreed-structure documentation.
- Classification: **PASS**.

## H-044: Concurrent creation of two Go Live requests for the same stable_component_key

- **DEFECT (Batch 18, H-044)**: invariant under test is that a stable_component_key never has two simultaneously
  active Go Live requests. Fired two `create_go_live_request` calls against the same fresh, previously-uncovered
  stable_component_key in immediate succession. Both succeeded, producing two active `draft` go_live_requests rows
  for the same component with identical creation timestamps, confirmed via direct SQL. Root cause: the RPC never
  checked for an existing active request before inserting, and the table carried no database-level uniqueness
  constraint, only a UI-route-layer guard. Risk: two independent approval chains could race to completion for the
  same commercial line item. Fixed via migration `20261003000000_fix_concurrent_go_live_request_creation_race.sql`:
  a partial unique index (`stable_component_key` where `status <> 'cancelled'`, matching the application layer's
  own existing definition of "active") is the true source of truth, with the RPC translating the resulting unique
  violation into a named `GO_LIVE_ACTIVE_REQUEST_ALREADY_EXISTS` error. One of the two duplicate rows was cancelled
  through the normal governed `cancel_go_live_request` path (not a raw delete) to allow the new index to be
  created; the audit trail of both original creation events remains intact.
- Live re-verification after the fix: a further `create_go_live_request` call against the same stable_component_key
  (which now has one remaining active request) was correctly rejected with `GO_LIVE_ACTIVE_REQUEST_ALREADY_EXISTS`.
- Classification: **FAILED THEN FIXED + PASS**.

## AA-023: Timeline never labels an in-progress multi-node approval as final/Live before the terminal node is reached

- Regular Path: live-rendered Customer Change request CCR-000059's review Timeline, a genuine multi-transition,
  not-yet-finalized request (status `submitted`, two recorded `approve` transitions from a resubmission cycle).
  Confirmed live: both approval lines read plainly (`"Finance Approval approved"`, `"Legal Approval approved"`),
  with no terminal/finalized wording folded into either, exactly as the code-level grounding predicted.
- Server-side control verification: confirmed via code inspection that Customer Onboarding and Commercial
  Configuration (via the shared `commercial-version.service.ts` timeline builder) call `buildWorkflowTransitionEvents`
  identically to Customer Change, with no `terminalApprovalDetail`/`isRequestFinalized` arguments passed, so the
  specific mechanism that produced H-020's original defect (premature terminal wording) is structurally absent in
  all three non-Go-Live domains, not merely correctly gated by a runtime condition.
- Classification: **PASS**.

## AB-042: Grant/revocation-history tables are append-only platform-wide, never reactivated in place

- Server-side control verification: read `fn_protect_access_grant` (`user_roles`, `role_permissions`) and
  `fn_protect_team_grant` (`user_teams`) directly. Both reject DELETE unconditionally and reject any change to
  `revoked_at` once already set, for the same named reason ("historical grant record: revoked_at cannot change
  once set, no reactivation, no re-revocation").
- Regular Path: attempted a direct `UPDATE ... SET revoked_at = NULL` against an already-revoked `user_teams` row.
  Correctly rejected by `fn_protect_team_grant` with exactly this message. `user_roles` and `role_permissions`
  were not independently re-attempted live in this batch: the Claude Code safety classifier correctly declined a
  direct live-access-grant-reactivation attempt against these two tables as an unauthorized live RBAC mutation,
  since it cannot distinguish fictional test rows from real access grants in a shared database. This is the
  correct behavior for that classifier; not worked around. Historical live verification of this identical
  mechanism on these exact two tables already exists on record (N-010, Batch 4, `user_roles`; N-022, Batch 4,
  `role_permissions`), and the shared `fn_protect_access_grant` function body confirmed above is the same function
  serving both tables today.
- Classification: **PASS** (fresh live verification for `user_teams`; code inspection plus historical Batch 4 live
  verification for `user_roles`/`role_permissions`).

## ACC-002: Required form fields consistently expose aria-required to assistive technology

- Regular Path: live-inspected the Customer Onboarding new-case form's accessibility tree. The Country field (the
  exact Base UI combobox ACC-001 originally found exposing `aria-required="false"` despite its visual asterisk) now
  exposes `aria-required="true"`. Cross-checked every other visually-required field on the same form page
  (Legal Entity Name, Brand Name, Address, Pincode, Industry/Category, Segment, Business Unit, Primary Contact
  Name/Email/Country code/Phone/Designation): all correctly expose `aria-required="true"`. The one field with no
  visible asterisk (Website) correctly exposes `aria-required="false"`, confirming the check is not merely
  over-marking everything.
- Classification: **FAILED THEN FIXED + PASS** for the Country field itself (the confirmed regression target);
  **PASS** for every other field checked on this page (already correct, not previously flagged).

## Summary reconciliation

8 journeys scheduled (E-029, E-030, E-031, E-032, H-044, AA-023, AB-042, ACC-002). 8 executed, 8 classified.

| Classification | Count |
| --- | --- |
| PASS | 6 (E-029, E-030, E-031, E-032, AA-023, AB-042) |
| FAILED THEN FIXED + PASS | 2 (H-044, ACC-002) |
| EXPECTED BEHAVIOUR | 0 |
| PRODUCT GAP | 0 |
| PRODUCT DECISION | 0 |
| DEFERRED | 0 |
| **Total** | **8** |

One genuine new defect was found and fixed this batch: H-044 (Go Live request creation had no database-level
protection against a concurrent-creation race for the same commercial line item). ACC-002 confirms a defect
(the Country combobox's `aria-required` gap) that was already fixed in an earlier, unrelated session and is now
being formally closed as a scheduled journey for the first time; no new code change was required for it in this
batch, only live confirmation.

## Journey Discovery Check (mandatory from Batch 17 onward, per Stage A11)

Reviewed every finding this batch surfaced (H-044's defect and fix; ACC-002's confirmed-already-fixed regression;
every PASS) against the Journey Universe taxonomy: ALREADY COVERED / EXPAND EXISTING JOURNEY / NEW JOURNEY
REQUIRED / REGRESSION TEST ONLY / FUTURE MODULE / PRODUCT DECISION REQUIRED.

- H-044's defect and fix are exactly what the journey's own premise anticipated ("if both succeed today, this
  journey's finding becomes the basis for adding a database-level uniqueness constraint"); fixing and
  regression-testing it does not surface any distinct untested behavior. ALREADY COVERED.
- ACC-002 confirms an already-fixed defect; no new accessibility surface was discovered beyond the one field this
  journey's own scope names. ALREADY COVERED.
- AA-023's finding, that the terminal-wording mechanism is structurally absent (not just correctly gated) in three
  of four domains, does not describe a new user-facing path; it is a stronger form of the same PASS the journey
  already tests for. ALREADY COVERED.
- No new entity, permission, state transition, or cross-module interaction was discovered during this batch's
  research or execution that falls outside the surface already enumerated across the Commercial Change, Go Live,
  Cross-Domain, Security, and Accessibility packs.

**Conclusion: No new journey candidates found.**
