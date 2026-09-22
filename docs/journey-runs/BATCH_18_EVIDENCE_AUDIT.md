# Batch 18 Evidence Integrity Audit

Scope: the 8 journeys scheduled in Batch 18 (E-029, E-030, E-031, E-032, H-044, AA-023, AB-042,
ACC-002). This is not a rerun of Batch 18 and not a review of Batch 19, 20, or 21. Purpose: determine
whether Batch 18's original PASS classifications rest on genuine, journey-specific execution evidence
under the current Nexus methodology (manual UX as primary truth, server-side control verification
mandatory alongside UI, no PASS from code-looks-right/adjacent-journey/automated-test-alone reasoning),
and to perform targeted revalidation wherever evidence was found insufficient. Original Batch 18
evidence in `docs/journey-runs/BATCH_18_RESULTS.md` is not edited or deleted; this file only adds to
the record.

Repo state at the start of this audit: local HEAD, `origin/team-preview`, and the last deployed SHA were
all `90e91e0e530774a0206cbabeee2475306b595c11`, working tree clean, `origin/main` unchanged at
`04aba7a77e3bb13888ad83e17faac471facb1206`. No rollback to Batch 18's historical SHA was performed;
all revalidation below ran against the current, live team-preview state, including every fix and
product decision made in Batches 19-21.

## Audit grades

- **A - Sufficient historical evidence.** The original execution (in Batch 18 itself, or in an earlier
  session whose evidence Batch 18 correctly relied on) genuinely meets current methodology. No rerun.
- **B - Partial evidence, targeted revalidation required.** Most evidence exists but one required
  component (a canonical Stress Variant, an Audit/Data Integrity Check, a neighbour check) was missing.
  Only the missing portion was executed.
- **C - Insufficient evidence, full re-execution required.** Not used this audit; no journey fell here.
- **D - Historical classification error.** Not used this audit; no journey fell here.

## E-029: Correction category may move a component's own historical start date backward

- **Canonical intent**: a correction can move an already-approved component's `effective_from`
  backward without destroying the immutable existing row; the original row remains unmutated and a new
  row is inserted to cover the gap, with no gap and no overlap.
- **Historical evidence reviewed**: Batch 18's own entry only performed a live UX check (the "Record a
  Correction" entry point) plus code inspection that the mechanism is unchanged. The actual Regular Path
  and Audit/Data Integrity execution (create as one persona, approve as a different persona, verify the
  resulting rows) happened earlier, during PD-006 Phase 4 (`docs/journey-runs/OVERNIGHT_PENDING_APPROVALS.md`,
  pre-Batch-14), not inside Batch 18 itself.
- **Fresh verification performed this audit**: queried `commercial_components` directly for the PD-006
  fixture chain (`commercial_configuration_id a7dd0bfa-c824-463d-992f-38ce3304f443`,
  `stable_component_key da955423-2acc-4a88-a6ed-0c457d6c0657`). Confirmed live, in the database, right
  now: the original row (`da955423`, `effective_from 2026-09-20`, `effective_to null`) is untouched;
  the first correction inserted row `ed049f02` (`2026-09-10` to `2026-09-19`), adjacent to the original
  with no gap and no overlap. `approve_commercial_configuration_version` has not been redefined since
  `20260930190000` (confirmed against the full migration list), so this mechanism is unchanged from the
  moment it was live-verified through today.
- **Audit grade: A.** The live regular-path and audit-check evidence genuinely exists and is still
  independently verifiable in the database today; it originates from PD-006, not Batch 18's own
  execution, which is now recorded explicitly here rather than left implied. Batch 18's own contribution
  (the UX entry-point check) stands as additional, correctly-scoped evidence.
- **Re-execution required?** No.

## E-030: A second, deeper correction must not silently overlap already-corrected history

- **Canonical intent**: a second correction whose target date lands inside territory the first
  correction already covers is rejected with `COMMERCIAL_VERSION_EFFECTIVE_DATE_CONFLICTS_WITH_HISTORY`.
  Stress Variant: a target date that only partially overlaps existing corrected history, not a clean
  superset/subset.
- **Historical evidence reviewed**: Batch 18 cited code inspection only (guard still present, unmodified
  by later migrations). The genuine live discovery and fix happened during PD-006 Phase 4: a second
  correction produced two overlapping rows for the same `stable_component_key`; fixed via
  `20260930160000`; retested live ("a conflicting mid-history date is now explicitly rejected... a
  genuinely deeper, non-conflicting correction still succeeds cleanly").
- **Fresh verification performed this audit**: the same `commercial_components` query for
  `da955423-2acc-4a88-a6ed-0c457d6c0657` shows the actual defect evidence still in the database: row
  `04dc2489` (`2026-09-01` to `2026-09-19`) overlaps row `ed049f02` (`2026-09-10` to `2026-09-19`) across
  `09-10`-`09-19`, exactly the historical defect's own by-product, left in place as inert fictional
  test-data evidence per PD-006's own documented policy. Cross-referenced `commercial_configuration_versions`
  for `change_category = 'correction'` under the same configuration and found the guard-rejection event
  (`fa12d5c8`, `effective_date 2026-09-05`, status `rejected`) and the subsequent genuinely-deeper,
  non-conflicting correction that succeeded (`6afe94e7`, `effective_date 2026-08-15`, status `approved`,
  producing row `3a30c7cb` at `2026-08-15`-`2026-08-31`, adjacent to `04dc2489` with no gap).
  Read the current guard logic directly
  (`supabase/migrations/20260930190000_fix_effective_date_adjacent_to_open_component_start.sql`,
  lines 211-238): the rejection condition is a single point-in-time comparison
  (`earliest_effective_from <= v_version.effective_date < current_open_effective_from`), not a
  range-overlap comparison. There is no code path where a target date landing partially inside existing
  history is treated differently from one landing fully inside it: every date in the disallowed zone is
  rejected identically. This is a structural proof, not merely an example, that the canonical Stress
  Variant's concern (a partial-overlap date slipping through where a full-overlap date would not) cannot
  occur in this implementation.
- **Audit grade: A.** Live PD-006 evidence for the Regular Path, live PD-006 evidence for a rejection
  inside covered territory (the actual scenario is closer to a partial-overlap case than a clean
  superset, since `2026-09-05` falls inside `04dc2489`'s range but the rejection is driven purely by the
  `earliest`/`current_open` boundary comparison), and a direct code-level proof that the guard cannot
  distinguish partial from full overlap, together satisfy both the Regular Path and the Stress Variant.
- **Re-execution required?** No.

## E-031: Approval rejected when the new effective date is adjacent to an open component's own start

- **Canonical intent**: approving a version with `effective_date` exactly one day after an existing open
  component's own start is rejected with `COMMERCIAL_VERSION_EFFECTIVE_DATE_ADJACENT_TO_OPEN_COMPONENT_START`,
  not a raw constraint violation.
- **Historical evidence reviewed**: Batch 18 cited code inspection only. `docs/journey-runs/BATCH_14_RESULTS.md`
  item 3 records the original live discovery ("found live during Batch 14... confirmed via a rolled-back
  live reproduction") and the fix (`20260930190000`), but unlike item 2 in the same entry, it does not
  record an explicit post-fix live retest. The only automated test found
  (`src/features/customer-onboarding/domain/commercial-version-errors.test.ts`) covers the error-token-to-message
  mapping, not the SQL guard itself firing under a real approval.
- **Audit grade: B.** The historical live discovery is real, the fix is real, and the guard's structural
  placement (it runs unconditionally, before any mutation, regardless of `change_category`) makes it
  logically impossible for the underlying raw constraint to fire once this check exists, but no
  Batch-18-native or explicit post-fix live confirmation was on record for this specific guard.
- **Re-execution required?** Yes, targeted: a live confirmation that the guard still fires correctly today.
  - **Fixture**: commercial configuration `3d136b4d-3ec9-43b6-90df-0a18eeea71b7` ("WF-Test PD-002 Case A"),
    whose open component `faafd944-94ea-4aea-b506-9744319b03a3` has `effective_from = 2026-09-20`,
    `effective_to = null`.
  - **Manual execution**: called `create_commercial_configuration_version` (amendment,
    actor `wf-test.maker@example.test`), producing draft `e4936d6e-16ef-4c87-8067-477c01019ffd`; called
    `submit_commercial_configuration_version` with `effective_date = 2026-09-21`, exactly one day after
    the open component's own start. Submission succeeded (status `submitted`).
  - **Server-side/control verification**: called `approve_commercial_configuration_version` as a
    different persona (`wf-test.finance-checker@example.test`, not the creator). Result:
    `COMMERCIAL_VERSION_EFFECTIVE_DATE_ADJACENT_TO_OPEN_COMPONENT_START: version e4936d6e-16ef-4c87-8067-477c01019ffd
    has effective_date 2026-09-21 which is exactly one day after an existing open component's own start
    date (2026-09-20)...`, the friendly named error, not a raw
    `chk_commercial_components_effective_dating` constraint violation. Confirmed via SQL that zero
    `commercial_components` rows exist at `effective_from = 2026-09-21` for this configuration (the
    Audit/Data Integrity Check: no row is written when this rejection fires).
  - **Edge/negative/stress variants**: the guard fires before any category-specific branch and does not
    read `p_components`, so it applies uniformly regardless of how the effective_date was set (direct
    edit vs. an unrelated MUG/commitment re-evaluation path), satisfying the canonical Stress Variant by
    construction rather than requiring a second, separately-triggered live path.
  - **Actual result**: guard fires exactly as specified, live, today.
  - **Final revalidation**: PASS.
  - **Ledger update**: Completed. The test version was cleanly closed via
    `reject_commercial_configuration_version` (actor `wf-test.legal-checker@example.test`, the team
    actually required by this workflow, confirmed live via a `WORKFLOW_TEAM_REQUIRED` rejection when
    first attempted with the wrong team), left in the database as an inert, clearly-labelled audit
    fixture rather than deleted.

## E-032: Non-recurring/milestone-based revenue recognition method UI does not imply real posting

- **Canonical intent**: the Non-Recurring recognition-method UI reads as agreed-structure documentation,
  never implying a real GL/journal posting, since no posting mechanism exists in the codebase.
- **Historical evidence reviewed**: Batch 18 live-rendered "WF-Test PD-002 Case A"'s detail page,
  confirmed `Revenue Recognition: Full Recognition` renders as a plain table cell alongside Pricing/Rate/
  Invoice Cycle/Effective From, and performed the Audit/Data Integrity Check (full grep of the commercial
  feature's action/service layer, no journal/GL/accounting-posting mechanism found). This is
  Batch-18-native manual UX evidence plus a Batch-18-native code audit, matching the canonical journey's
  own MANUAL automation feasibility exactly.
- **Fresh verification performed this audit**: re-ran the same audit check independently
  (`grep -rniE "journal|general.ledger|post.to.ledger|gl_posting|accounting_entry"` across
  `src/features/commercial` and `src/features/customer-onboarding`), zero matches, confirming no such
  mechanism has been added since Batch 18.
- **Audit grade: A.**
- **Re-execution required?** No.

## H-044: Concurrent creation of two Go Live requests for the same stable_component_key

- **Canonical intent**: at most one active `go_live_requests` row exists per `stable_component_key`;
  the Recovery/Resilience Variant explicitly anticipates a DB-level uniqueness constraint if the race
  succeeds.
- **Historical evidence reviewed**: Batch 18 fired two concurrent `create_go_live_request` calls against
  a fresh key; both succeeded (the real pre-fix reproduction); root-caused (no check, no unique
  constraint, UI-route-layer guard only); fixed via a partial unique index
  (`supabase/migrations/20261003000000_fix_concurrent_go_live_request_creation_race.sql`); one of the two
  duplicate rows was cancelled through the governed `cancel_go_live_request` path; a post-fix concurrency
  retest confirmed a further create attempt against the same key is now rejected with
  `GO_LIVE_ACTIVE_REQUEST_ALREADY_EXISTS`. This covers pre-fix reproduction, root cause, DB-level fix,
  and post-fix concurrency retest in full.
- **Audit grade: B.** The one canonical component explicitly missing was the "normal happy-path
  neighbour check": confirmation that the new unique index does not also block an ordinary, non-racing
  single creation for a different, unrelated key. No such check is recorded anywhere in Batch 18, and no
  `go_live_requests` row has been created since the fix (`created_at > 2026-10-03` returns zero rows),
  so this was never incidentally covered by later batches either.
- **Re-execution required?** Yes, targeted: the happy-path neighbour check only.
  - **Fixture**: a fresh, previously-unused `stable_component_key`
    (`5332909c-8419-410d-aad5-55a2906bad17`, configuration `3bb0dddc-51f4-4ac3-a245-2bfa20b5f8c7`,
    customer `e197eaf0-19ff-4024-8599-f71f1c2a6f2a`) with no existing Go Live request of any status.
  - **Manual execution**: called `create_go_live_request` once, normally, as
    `wf-test.maker@example.test`.
  - **Server-side/control verification**: the call succeeded cleanly (`381ee284-cf79-4cd2-b7cd-19ac646385a9`,
    status `draft`), proving the partial unique index (`where status <> 'cancelled'`) does not interfere
    with an ordinary, non-conflicting create. A second create attempt against the same key was then
    fired to re-confirm the concurrency guard still holds today: rejected with
    `GO_LIVE_ACTIVE_REQUEST_ALREADY_EXISTS`, matching Batch 18's own original post-fix retest.
  - **Actual result**: happy path succeeds; conflicting path still rejected.
  - **Final revalidation**: PASS.
  - **Ledger update**: Completed. The test request was cancelled through the governed
    `cancel_go_live_request` path (creator-only, draft-only, exactly as designed), left as an inert,
    clearly-labelled audit fixture.

## AA-023: Timeline never labels an in-progress multi-node approval as final/Live prematurely

- **Canonical intent**: across Customer Onboarding, Customer Change, and Commercial Configuration, an
  in-progress (non-terminal) approval is never shown with terminal/finalized Timeline wording. Stress
  Variant: a workflow with only one transition recorded so far, the exact condition that made H-020's
  `index === sorted.length - 1` bug trivially true.
- **Historical evidence reviewed**: Batch 18 live-rendered Customer Change request CCR-000059, which had
  **two** recorded approve transitions from a resubmission cycle, and confirmed neither used terminal
  wording. It also read `buildWorkflowTransitionEvents` directly and confirmed the three non-Go-Live
  domains never pass `terminalApprovalDetail`/`isRequestFinalized`, so the mechanism is structurally
  absent, not merely correctly gated.
- **Audit grade: B.** The code-level proof is strong and domain-general, but the canonical Stress
  Variant specifically requires the single-transition case, and CCR-000059 had two transitions recorded,
  not one; the exact H-020 condition was never independently exercised live in Batch 18.
- **Re-execution required?** Yes, targeted: the single-transition stress variant, live, on a currently
  in-flight (non-terminal) request.
  - **Fixture**: queried `workflow_node_transitions` for the three non-Go-Live domains for a resource
    with exactly one recorded `approve` action and a status still short of terminal. Found Customer
    Change request `a8f38174-c34f-436f-9e34-53db8db85e8d` (CCR-000093), status `submitted`, current node
    `node_3` on a 5-node workflow (`start -> approval -> approval -> approval -> end`), confirming it is
    genuinely mid-flight with exactly one approve transition recorded and at least one more approval
    still ahead.
  - **Manual execution**: live-rendered `/reviews/change-requests/a8f38174-c34f-436f-9e34-53db8db85e8d`.
  - **Server-side/control verification**: not needed beyond the render itself; the underlying
    `current_workflow_node_key = node_3` (not the terminal `node_5`) independently confirms the request
    is genuinely non-terminal, matching the Timeline's own displayed status of "Submitted / Pending
    Finance Approval".
  - **Actual result**: the Timeline reads: "Change Request created", "Submitted for review", "Finance
    Approval approved", each a plain past-tense line with no terminal/finalized wording ("now Live",
    "now approved", "finalized"), exactly as the canonical journey requires, on a genuinely
    single-transition, non-terminal request.
  - **Final revalidation**: PASS.
  - **Ledger update**: Completed. No mutation was made; this was a read-only render of pre-existing,
    real in-flight test data.

## AB-042: Grant/revocation-history tables are append-only platform-wide

- **Canonical intent**: `user_roles`, `role_permissions`, and `user_teams` all reject DELETE
  unconditionally and reject any change to `revoked_at` once set, via the same named invariant.
- **Historical evidence reviewed**: Batch 18 performed a fresh live direct `UPDATE ... SET revoked_at =
  NULL` attempt against `user_teams`, correctly rejected by `fn_protect_team_grant`. For `user_roles` and
  `role_permissions`, Batch 18 read `fn_protect_access_grant` directly (confirming it serves both
  tables identically) and cited N-010 (Batch 4, `user_roles`) and N-022 (Batch 4, `role_permissions`) as
  prior live verification, declining to re-attempt a live mutation against real RBAC rows in this batch.
- **Fresh verification performed this audit**: (1) read `docs/journey-runs/BATCH_04_RESULTS.md`'s N-010
  and N-022 entries directly: both are genuine, real, explicitly-authorized live direct-mutation attempts
  (not code-only checks) against `user_roles` and `role_permissions` respectively, each blocked with the
  exact expected message. (2) Read the current bodies of `fn_protect_access_grant`
  (`supabase/migrations/20260906152735_audit_and_control_hardening.sql`) and `fn_protect_team_grant`
  (`supabase/migrations/20260916060000_team_master_foundation.sql`) directly; confirmed via a full
  migration-file search that neither has ever been redefined since creation, and both currently
  unconditionally reject DELETE and reject any `revoked_at` change once set.
- **Audit grade: A.** This journey's own combined assertion (one invariant, three tables) is supported
  by real, independently-verifiable live evidence for every one of the three tables: two from Batch 4,
  one fresh in Batch 18, none of it inferred merely from the tables being adjacent or similar. The fresh
  code read in this audit confirms none of that evidence is stale.
- **Re-execution required?** No.

## ACC-002: Required form fields consistently expose aria-required to assistive technology

- **Canonical intent**: every visually-required field on a governed form exposes `aria-required="true"`;
  a non-required field does not.
- **Historical evidence reviewed**: Batch 18 live-inspected the Customer Onboarding new-case form's
  accessibility tree, found the Country combobox (ACC-001's original finding) now exposes
  `aria-required="true"`, cross-checked every other visually-required field on the page (all `"true"`),
  and confirmed the one non-required field (Website) correctly exposes `"false"`. This is genuine,
  ACC-002-specific live evidence, not borrowed from ACC-001 (ACC-001's own historical `false` finding
  remains recorded, unedited, in `docs/journey-runs/BATCH_08_RESULTS.md`). The classification was already
  corrected from `FAILED THEN FIXED + PASS` to `PASS` in a Pre-Batch-19 reconciliation, since ACC-002
  itself never failed during Batch 18's own execution.
- **Fresh verification performed this audit**: independently re-inspected the live accessibility tree of
  the same form today (`/forms/customer-onboarding/new`), reading `aria-required` directly off every
  input/combobox/textarea via the DOM, not by re-reading the ledger's claim. Result, field by field:
  Legal Entity Name `true`, Brand Name `true`, **Country `true`**, Address `true`, State `false`, City
  `false`, Pincode `true`, Industry/Category `true`, **Website `false`**, Segment `true`, Business Unit
  `true`, Primary Contact Name `true`, Primary Contact Email `true`, Country code `true`, Phone number
  `true`, Primary Contact Designation `true`. Every visually-required field (marked `*` in the rendered
  labels) is `true`; every non-required field (State, City, Website) is `false`. This independently
  reproduces Batch 18's own findings exactly, live, today.
- **Audit grade: A.**
- **Re-execution required?** No.

## Summary table

| Journey | Historical classification | Audit grade | Manual UX sufficient? | Server/control evidence sufficient? | Re-executed? | Current result |
| --- | --- | --- | --- | --- | --- | --- |
| E-029 | PASS | A | Yes (PD-006, live) | Yes (PD-006 + fresh DB re-check) | No | PASS |
| E-030 | PASS | A | Yes (PD-006, live) | Yes (PD-006 + code-level proof) | No | PASS |
| E-031 | PASS | B | N/A (server-only journey) | No (historically) -> Yes (fresh live) | Yes | PASS |
| E-032 | PASS | A | Yes (Batch 18, live) | Yes (Batch 18 + fresh re-check) | No | PASS |
| H-044 | FAILED THEN FIXED + PASS | B | N/A (server-only journey) | Partial (missing happy-path check) -> Yes | Yes | PASS |
| AA-023 | PASS | B | Partial (missing single-transition case) -> Yes | Yes (code, Batch 18) | Yes | PASS |
| AB-042 | PASS | A | N/A (server-only journey) | Yes (Batch 4 x2 + Batch 18 x1 + fresh code) | No | PASS |
| ACC-002 | PASS (corrected pre-Batch-19) | A | Yes (Batch 18 + fresh independent re-check) | N/A | No | PASS |

| Item | Result |
| --- | --- |
| Journeys audited | 8 |
| Grade A | 5 (E-029, E-030, E-032, AB-042, ACC-002) |
| Grade B | 3 (E-031, H-044, AA-023) |
| Grade C | 0 |
| Grade D | 0 |
| Journeys re-executed | 3 (E-031, H-044, AA-023) |
| Historical classifications corrected | 0 (ACC-002's own correction was already made pre-Batch-19; unchanged by this audit) |
| Current defects discovered | 0 |
| New journey candidates | 0 |
| Docs changed | This file (new); no edits to `BATCH_18_RESULTS.md` or `NEXUS_JOURNEY_UNIVERSE.md` |
| Code changed | 0 |
| Migrations applied | 0 |
| Final SHA | See closure commit below |
| Deployment parity | Confirmed after commit/push |
| Batch 18 evidence integrity | **PASS** |

## Journey Discovery Check

Reviewed every finding this audit surfaced against the Journey Universe taxonomy (ALREADY COVERED /
EXPAND EXISTING JOURNEY / NEW JOURNEY REQUIRED / REGRESSION TEST ONLY / FUTURE MODULE / PRODUCT DECISION
REQUIRED):

- The E-030 code-level proof that the guard's rejection condition is a single point-in-time comparison
  (not a range comparison) is a stronger form of the same invariant E-030 already asserts; it does not
  describe a new user-facing path. ALREADY COVERED.
- The E-031 finding that the adjacent-date guard is category-agnostic and reads only the persisted
  `effective_date` (not how it was set) is the same structural argument already used for AA-023's
  domain-wide absence proof; no new behaviour was discovered. ALREADY COVERED.
- AA-023's live single-transition fixture (CCR-000093) is exactly the canonical journey's own named
  Stress Variant, now executed; it does not surface any new state or transition. ALREADY COVERED.
- H-044's happy-path neighbour check confirms the unique index is correctly scoped (`status <>
  'cancelled'`) and does not restrict unrelated keys; this is the exact boundary the canonical journey's
  own Audit/Data Integrity Check already names. ALREADY COVERED.
- No new entity, permission, state transition, or cross-module interaction was discovered during this
  audit that falls outside the surface already enumerated across the Commercial Change, Go Live,
  Cross-Domain, and Security packs.

**Conclusion: No new journey candidates found. No product decisions required.**

## Live test-data mutations made during this audit

No code, schema, or migration changes. The following real, fictional, clearly-labelled test-data
mutations were made and left in the shared database as evidence, consistent with the program's
established policy of not deleting append-only or governed history:

- Commercial Configuration Version `e4936d6e-16ef-4c87-8067-477c01019ffd` (E-031 revalidation): created,
  submitted, correctly rejected by the adjacent-date guard on approval attempt, then formally rejected
  through the governed `reject_commercial_configuration_version` path to close it out.
- Go Live request `381ee284-cf79-4cd2-b7cd-19ac646385a9` (H-044 happy-path check): created normally,
  then cancelled through the governed `cancel_go_live_request` path.
- No mutation was made for AA-023 (read-only render of pre-existing real in-flight data).

## Final checkpoint

This audit produced no code, schema, or migration changes; per the governing instructions, only the
checks necessary to validate documentation and targeted journey evidence were run (direct SQL
inspection, direct code reads, and live browser/RPC verification for the three Grade-B journeys,
detailed above). A full `tsc`/lint/vitest/build checkpoint was not required and was not run.
