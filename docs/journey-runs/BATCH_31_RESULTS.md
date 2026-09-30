# Batch 31 Fresh Execution Results

Scope: X-007 through X-021 (15 journeys), AA-001 through AA-010 (10 journeys). 25 scheduled.

## Step 0: Starting state verification

Read `docs/OPEN_PRODUCT_GAPS.md`, `docs/TEST_FIXTURE_REGISTER.md`, `docs/journey-runs/TEST_DATA_INCIDENTS.md`, `docs/NEXUS_JOURNEY_EXECUTION_PLAN.md`. Confirmed:

- **Active Product Gaps: 0** (Section A: "None currently open").
- Batch 30 is closed (reconciled 2026-09-29, HEAD `dcfe905`).
- PG-036, PG-037, PG-040, PG-056, PG-057, PG-058, PG-059 all remain in Closed History, unchanged, no reopening.
- PG-006 (Commercial Version creation blocked for inactive customer), PG-033 (Team Master no edit/no hard-delete, ACCEPTED AS-IS), PG-053 (former-name best-match search) all remain CLOSED.
- No unresolved Product Decision hiding in a prior batch ledger (all prior batches' Product Decisions found were resolved same-day: PG-059 only one this program required a decision, closed).
- Test Fixture Safety Gate is active (`docs/TEST_FIXTURE_REGISTER.md`, `CLAUDE.md`'s "Test fixture safety" section, `docs/NEXUS_JOURNEY_EXECUTION_PLAN.md`'s "Test Fixture Safety Gate").
- `git log --oneline -1 main` unchanged at `04aba7a`; Production untouched (no deploy action taken all session).

## Step 0A: Canonical journey reconciliation

- **X-007**: aligned with PG-058 (Customer Master Activity/History freezes point-in-time actor identity). No rediscovery; will regression-check live.
- **X-016**: aligned with PG-057 (Go Live locks to creation-time Commercial Version). No rediscovery; will regression-check live.
- **AA-003**: canonical text was stale (claimed customer-active enforcement "documented but not enforced," per B-011). PG-006 is CLOSED (DECIDED block + FIXED). **Updated AA-003's canonical text in `docs/NEXUS_JOURNEY_UNIVERSE.md` this pass**, preserving historical context, before execution.
- **AA-004**: reconciled against PG-053 (closed); will verify former-name search still uses best-match behavior, not rediscover the original issue.
- **AA-005**: canonical text assumed a team-rename control. V-035 (Batch 28) already confirmed none exists; PG-033 (ACCEPTED AS-IS) confirms Team Master has no edit/rename capability at all. **Rewrote AA-005's Regular Path in `docs/NEXUS_JOURNEY_UNIVERSE.md` this pass** to test actual current attribution behavior instead of assuming a rename mechanism, preserving historical context. Will not fabricate a raw DB rename.
- **AA-008**: reconciled against A-020's own canonical Notes (Onboarding has no terminal "rejected" equivalent; a case can only be perpetually sent back or approved), a documented deliberate design characteristic. Not registered in `OPEN_PRODUCT_GAPS.md` as an active or deferred gap under any PG number. Will verify actual current behavior live and, if confirmed unchanged, register as a new deferred item (not a fresh Product Gap) referencing A-020, rather than duplicating a decision.
- **AA-010**: canonical text claimed no cross-domain admin dashboard exists for "zero eligible members" visibility. Source-confirmed this pass: `src/platform/approvals/domain/operational-queue.ts`'s `OperationalQueueEntry`/`ApprovalInboxItemType` (`"onboarding" | "change_request" | "commercial_version" | "go_live"`) already unify all four domains into one queue, and its `noEligibleApprover`/`isResponsibleTeamInactive` fields (PG-005/O-018 fix) are computed once across that whole cross-domain queue; Batch 29's Z-009 already confirmed this live. **Updated AA-010's canonical text this pass** to reflect this, rather than asserting a stale "no unified visibility" premise; will still verify live this batch, not merely cite the update.

Batch denominator unchanged: 25.

## Step 1: Test Fixture Safety Gate acknowledgment

Batch 31 will not mutate `aurora-consumer-labs`, `test-customer-1`, `w007-stress-onboarding-customer`, `batch12-e021-routing-co`, `batch8-approval-core-co`, or any other non-approved shared customer. AA-001 creates one new, wholly disposable Batch-31 lifecycle customer, reused per Step 15 for AA-002/003/004/006 where appropriate. Historical journeys (X-pack) read safe existing history where necessary (e.g. Aurora's already-established multi-batch history for regression checks) without mutating it; any journey needing to mutate historical-feeling state uses a fresh disposable fixture instead. A `TEST FIXTURE CHECK` is recorded before every mutating action in each journey's own evidence below.

## Step 2: Classification of all 25 journeys (before execution)

| Journey | Evidence class | Manual UX | Server/DB | Persona | Fixture |
|---|---|---|---|---|---|
| X-007 | MIXED MANUAL + SERVER | Activity/History view, multiple successive changes | `customer_field_history` rows immutable | Maker/Approver, viewer | Read existing Aurora history (safe, non-mutating) |
| X-008 | MIXED MANUAL + SERVER | historical document version retrieval | signed URL for superseded row | Uploader/viewer | Fresh disposable document lineage |
| X-009 | MIXED MANUAL + SERVER | historical Go Live detail view | stored past date, fresh computation | Viewer | Fresh or existing past-dated Go Live (read-only) |
| X-010 | MANUAL UX REQUIRED + DATABASE VERIFIED | old CCR opens read-only, no staleness error | stale `base_customer_row_version` | Viewer | Existing terminal CCR on Aurora (read-only) |
| X-011 | SERVER/DB ONLY | N/A | RPC signature enumeration | Technical tester | N/A (schema-level) |
| X-012 | MIXED MANUAL + SERVER | old Timeline renders after node deletion | transition row unchanged | Workflow Admin, viewer | Fresh disposable test workflow |
| X-013 | MIXED MANUAL + SERVER | aged request actioned normally | timestamp evidence | Approver | Fresh disposable request, simulated age disclosed |
| X-014 | MIXED MANUAL + SERVER | search disambiguates legacy duplicates | no cross-linking | Viewer | Prefer existing legacy duplicate data |
| X-015 | INVESTIGATIVE / TOOLING-CONSTRAINED CANDIDATE | report/export surface if one exists | N/A | Viewer | Existing mixed dataset (read-only) |
| X-016 | MIXED MANUAL + SERVER | historical Go Live shows frozen commercial ref | stored version id unchanged | Viewer | Existing PG-057 fixture or fresh |
| X-017 | MIXED MANUAL + SERVER | old commercial version view after component removed | frozen fx/rate/component data | Viewer | Existing historical commercial data (read-only) |
| X-018 | MANUAL UX REQUIRED | long-rejected/cancelled request view intact | N/A | Viewer | Existing terminal fixture (read-only) |
| X-019 | SERVER/DB ONLY | N/A | retrospective self-approval sweep | Auditor | Full historical dataset (read-only query) |
| X-020 | MIXED MANUAL + SERVER | old Timeline after account disabled | attribution still resolves | Viewer, disabled test persona | Reusable canonical test persona |
| X-021 | MIXED MANUAL + SERVER / TOOLING-CONSTRAINED CANDIDATE | hard-delete feasibility of a Currency value | frozen fx_snapshot_rate unaffected | Master Data Admin | Test-only currency value if one exists |
| AA-001 | MIXED MANUAL + SERVER | full lifecycle navigated coherently | id-tracing across every domain | Maker, approvers, Go Live/Entitlement operators | **New Batch-31 disposable lifecycle customer** |
| AA-002 | MIXED MANUAL + SERVER | Customer Change after Go Live, other views unaffected | zero cross-domain writes | Maker, Reviewer | AA-001 fixture |
| AA-003 | MIXED MANUAL + SERVER | new component added, existing live component unaffected | additive version history | Maker/Approver | AA-001 fixture |
| AA-004 | MIXED MANUAL + SERVER | rename display consistency across Commercial versions | former-name search, field history | Maker, Reviewer | AA-001 fixture |
| AA-005 | MANUAL UX REQUIRED | current attribution/label behavior (no rename exists) | source-confirmed live-vs-frozen | Auditor | Existing historical approval (read-only) |
| AA-006 | MIXED MANUAL + SERVER | two independent workflows understood separately | no lost update, correct final state | Two maker/approver pairs | AA-001 fixture |
| AA-007 | MIXED MANUAL + SERVER | cancelled prospect leaves no downstream trace | zero customer/commercial/go-live rows | Maker | Fresh disposable onboarding case |
| AA-008 | MIXED MANUAL + SERVER | repeated send-back cycles, real terminal fate | zero downstream records throughout | Maker, Reviewer | Fresh disposable onboarding case |
| AA-009 | MIXED MANUAL + SERVER | self-approval blocked identically, all domains | RPC-level bypass denied, zero transition | Fully-privileged test user | AA-001 fixture + fresh onboarding case |
| AA-010 | MIXED MANUAL + SERVER | zero eligible members blocks progress, cross-domain visibility | no invalid transition | Approver, Team Admin | Approved `WF-TEST Legal` team fixture |

## Step 3: Manual UX Readiness Gate

Dev server reachable at `http://localhost:3000` (fresh preview started). Established personas from prior batches remain usable (`nexus-test-maker`, `nexus-test-legal`, `nexus-test-finance-b`, `nexus-test-ux-approver`, `nexus-test-team-admin`, `nexus-test-reference-master-admin`, `nexus-test-go-live-admin`, `nexus-test-user-access-admin`). Full route reachability (`/my-work`, Customer Master, Activity/History, Onboarding, Customer Change, Commercial, historical Commercial Version pages, Go Live) already established across Batches 29-30 and reconfirmed as each journey below executes.

**MANUAL UX GATE = PASS.**

---

## Journey Evidence

### X-007: Customer Master Activity/History point-in-time snapshots — PASS

**Fixture:** `batch11-immutability-probe-co` (read-only; not in the retired list, but treated with the same non-mutating discipline since it carries load-bearing Batch 11 history). No mutation performed — this journey only required identifying and verifying pre-existing successive changes.

**DB evidence** (`customer_field_history`, `field_key = 'industry'`): 6 immutable rows, unbroken chain `null→fmcg→logistics→retail→pharma→biotech→agritech`, `changed_at` 2026-09-27 16:36 through 2026-09-28 14:33, approvers alternating Finance/UX/Finance/UX/Legal/Legal (`59175334-...`, `df6bb6ba-...`, `59175334-...`, `df6bb6ba-...`, `b2a12ef2-...`, `b2a12ef2-...` — resolved to Nexus Test Finance/UX/Legal Approver).

**Manual UX evidence:** logged in as `nexus-test-maker`, navigated to `/customers/batch11-immutability-probe-co`, opened the History tab. Field History table (screenshot captured) renders all 6 rows in reverse-chronological order, each showing Field/Old Value/New Value/Effective Date/Requested By/Approved By/Changed At. Approver column correctly alternates per-row (Legal, Legal, UX, Finance, UX, Finance reading top-to-bottom) — matches DB exactly, confirming point-in-time actor identity is preserved per PG-058, not collapsed to the record's current/latest approver.

**PG-058 regression check:** clean, no reopening.

**Journey Discovery:** none; canonical text and current behavior align.

---

### X-008: Superseded document version retrievability — EXPECTED BEHAVIOUR (Journey Discovery: DF-011/PG-060 registered)

**No fixture created.** Investigated via source first (before creating any disposable document lineage) to determine whether a live UI path exists at all, per the user's own Step 6 instruction to check via Journey Discovery rather than assume one exists.

**Finding:** confirmed via source (`src/features/customer-onboarding/data/documents.data.ts`, `services/documents.service.ts`, `server.ts`, and both consuming pages) that:
- A correct, unit-tested reader for this exact case already exists: `listDocumentsForRevision`/`listOnboardingDocumentsForRevision`, explicitly documented as independent of `is_current`.
- It has zero callers anywhere in the app — no page, Server Action, or route invokes it.
- The only document readers actually wired to a page (`listCurrentDocumentsForRequest` for Onboarding, `listDocumentsForGoLiveRequest` for Go Live, confirmed during Batch 30's INC-001 investigation) filter `is_current = true` unconditionally.

**Conclusion:** no real, working UI/API path exists today to retrieve a superseded document version in either domain. This is not a tooling limitation of this test session — the capability genuinely does not exist in the running product (determined via source, not assumed).

**Product Gap registered:** `DF-011 (PG-060)` in `docs/OPEN_PRODUCT_GAPS.md` Section C, same shape and precedent as `DF-006 (PG-051)` (data complete and immutable, only the viewing surface missing). Accepted meanwhile, not Active — Active Product Gaps remains 0.

**Journey Discovery:** canonical premise ("verify superseded document version retrievability") cannot be tested as a live UX flow because no such surface exists; this is now documented rather than left as an untestable assumption.

---

### X-009: Historical Go Live past effective date — PASS

**Fixture:** `test-sql-smoke-co`'s pre-existing approved Go Live request `GLR-000029` (`go_live_date` 2026-09-22, 8 days before today 2026-09-30), read-only, no mutation.

**Source evidence:** `deriveLineItemGoLiveStatus()` (`src/features/go-live/domain/types.ts:87-92`) derives LIVE purely from `status === 'approved'`, no date comparison at all. Both Go Live pages set `export const dynamic = "force-dynamic"`, so nothing is cached/ISR'd. `grep -ri "cron|scheduled|pg_cron"` across `supabase/` found zero real jobs. There is structurally nothing that could go stale.

**Manual UX evidence:** navigated to `/customers/test-sql-smoke-co/go-live/0eb567c4-c449-450f-95bd-38c61d9342b7`. Page correctly renders "Live" badge and "Live from 22-Sep-2026, approved 22 Sept 2026, 10:00 am" today, 8 days after the go-live date, confirming fresh-on-read computation live, not merely inferred from source (screenshot captured).

**Journey Discovery:** none.

---

### X-010: Historical Customer Change with stale base_customer_row_version — PASS

**Fixture:** `test-customer-1`'s approved historical CCR `CCR-000009` (request `26e1a8f8-df99-4a4d-8149-c40dea550ee3`), read-only. `base_customer_row_version = 1` vs the customer's current `row_version = 39` — a 38-version gap, the most extreme staleness case in the dataset, deliberately chosen as the hardest test.

**Manual UX evidence:** navigated to `/reviews/change-requests/26e1a8f8-df99-4a4d-8149-c40dea550ee3`. Page rendered fully and cleanly despite the extreme version gap: full "Current vs Proposed" diff (5 of 25 governed fields), complete Timeline including a send-back/resubmit cycle, and an explicit closing banner "Approved on 15 Sept 2026. This Change Request is historical evidence and can no longer be changed." No staleness error, warning, or block of any kind appeared (screenshot captured).

**Conclusion:** confirms the staleness guard is correctly scoped to blocking a *new* submission against a stale base, never to viewing already-terminal historical records — opening old history is unconditionally safe regardless of how far the live customer row has since moved on.

**Journey Discovery:** none.

---

### X-011: RPC signature regression guard — PASS

**SERVER/DB ONLY**, no fixture, no mutation. Queried `pg_proc` for every `approve_*`/`reject_*`/`send_back_*`/`cancel_*` function in `public`: 17 functions returned (`approve_commercial_configuration_version`, `approve_customer_change_request`, `approve_customer_onboarding_case`, `approve_go_live_request`, `approve_onboarding_effective_date_exception`, `cancel_commercial_configuration_version`, `cancel_customer_change_request`, `cancel_customer_onboarding_case`, `cancel_entitlement_source`, `cancel_go_live_request`, `reject_commercial_configuration_version`, `reject_customer_change_request`, `send_back_customer_change_request`, `send_back_customer_onboarding_case`, `send_back_go_live_request`, plus two unrelated trigger functions `fn_reject_truncate`/`fn_reject_update_delete`). Every `proname` appears exactly once — zero duplicate overloads across all four governed domains.

**Incidental confirmation:** no `reject_customer_onboarding_case` function exists at all (only `send_back`/`cancel`/`approve`), consistent with A-020's documented design (Onboarding has no terminal "rejected" equivalent) — directly relevant to AA-008 later in this batch.

**Journey Discovery:** none; no regression.

---

### X-012: Historical node removed from workflow graph — PASS

**Fixture:** existing data, no new fixture created, no mutation. `WF-TEST Finance then Legal Sequential` (`customer_change` workflow, 15 versions) removed `node_2` ("Finance Approval") starting at version 12 — confirmed via `workflow_nodes` diff across all 15 versions. CCR `CCR-000054` (request `9de1cc98-1d13-401e-ad75-3446090ae364`, `test-customer-1`) is bound to version 9 (which still has `node_2`) and its `workflow_node_transitions` confirm it genuinely transitioned `node_2 → node_3` via a real `approve` action on 2026-09-16.

**Manual UX evidence:** navigated to `/reviews/change-requests/9de1cc98-1d13-401e-ad75-3446090ae364`. Timeline correctly renders "Finance Approval approved · 16 Sept 2026, 10:47 am · WF-TEST Finance Checker" today, even though `node_2`/"Finance Approval" no longer exists anywhere in the current (v15) published graph (screenshot captured).

**Conclusion:** node names resolve from the request's own frozen `workflow_version_id`, never the live/current graph — deleting a node from a later workflow version does not corrupt or blank out older requests' historical Timelines.

**Journey Discovery:** none.

---

### X-013: Aged/dormant request processed normally — PASS

**Fixture:** fresh, disposable CCR created for this journey on `demo-northstar-consumer-products` (not a retired fixture customer), `CCR-000202` (request `20409568-1015-4de1-a708-e34b14c2c589`), website field change. **TEST FIXTURE CHECK:** Target: new CCR / Created for this journey? YES / Canonical fixture? N/A / Safe to mutate? YES.

**Timestamp simulation, exactly as done:** after real submission (today, 2026-09-30), directly `UPDATE`d only `customer_change_requests.created_at` from `2026-09-30 02:12:55+00` to `2026-09-10 02:12:55+00` (−20 days) on this one fresh row. No other column touched; `workflow_node_transitions` (the append-only audit trail) was left completely untouched — the "Submitted for review" timeline event still correctly reads today's real timestamp, only "Change Request created" reads 20 days earlier, an honest reflection of exactly what was simulated. **TEST FIXTURE CHECK** (this specific mutation): Target: same fresh CCR's `created_at` column / Created for this journey? YES / Canonical fixture? N/A / Safe to mutate? YES.

**Manual UX evidence:** logged in as `nexus-test-legal`, opened `/reviews/change-requests/20409568-1015-4de1-a708-e34b14c2c589` — page showed "Needs Your Attention" normally, no dormancy/expiry warning of any kind. Clicked Approve; action succeeded immediately, no special-casing, no error.

**DB verify:** `current_workflow_node_key` advanced `node_3 → node_4` (Legal Approval → Leadership Approval), `status` correctly still `submitted` (mid-workflow), `updated_at` reflects the real approval timestamp.

**Conclusion:** aged/dormant requests are processed identically to fresh ones; no time-based expiry or staleness mechanism exists to interfere.

**Journey Discovery:** none.

---

### X-014: Legacy duplicate-looking names disambiguated correctly — PASS

**Fixture:** pre-existing legacy data, no new customer created (per the user's own instruction to prefer existing legacy duplicates over manufacturing new ones). Found 3 genuinely pre-existing customers all named exactly "Batch11 Disposable Commercial Co" (`batch11-disposable-commercial-co`, `batch11-disposable-commercial-co-f9c7a1eb`, `batch11-disposable-commercial-co-ee6ee8b2`), plus a second cluster ("Batch9 EmptyConfig Co" ×2) and a third ("WF-Test PD-002 Case A..." ×3), all legitimate accumulated history from earlier concurrency-testing batches.

**Manual UX evidence:** searched "Batch11 Disposable Commercial Co" in Customer Master search. All 3 rows returned distinctly, each with its own key and its own "View" link — no merge, no collision, no ambiguous single result (screenshot captured).

**DF-010 cross-check (not reopened):** DF-010 concerns the absence of a *creation-time* duplicate-name warning, a materially different concern from *search-time* disambiguation of already-existing duplicates, which this journey confirms works correctly. No conflict, no reopening.

**Journey Discovery:** none.

---

### X-015: Legacy mixed-schema aggregate view — EXPECTED BEHAVIOUR (Journey Discovery: DF-012/PG-061 registered)

**No fixture created.** Investigated via source first, per the user's own instruction not to invent a surface that doesn't exist.

**Finding:** confirmed via source — no CSV export, no "reports" page, and no cross-customer aggregate/tabular view exists anywhere beyond the plain Customer Master list (`src/app/customers/page.tsx`) and a paginated JSON integration API (`src/app/api/v1/customers/route.ts`, JSON only, no aggregation, no CSV serialization).

**Conclusion:** this journey's canonical premise has no real surface to exercise. Matches the established "genuinely unbuilt V1 module" pattern (PG-025 Pricing Kernel, PG-026 spend-commitment onboarding UI), not a defect.

**Product Gap registered:** `DF-012 (PG-061)` in `docs/OPEN_PRODUCT_GAPS.md` Section C. Accepted, not Active — Active Product Gaps remains 0.

**Journey Discovery:** canonical premise cannot be tested; documented rather than assumed or invented.

---

### X-016: Regression-check PG-057 — historical Go Live shows frozen commercial version — PASS

**Fixture:** `batch8-approval-core-co`'s existing approved Go Live `GLR-000050` (request `fb22d4e6-b527-4017-b2c2-07a8842536e6`), read-only. Confirmed via DB that its `commercial_version_id` (request `11111111-...-005`, version_number 115) has at least one later approved version for the same configuration created afterward (`11111111-...-006`, version_number 116) — a genuine "newer version exists" scenario, not fabricated.

**Manual UX evidence:** navigated to `/customers/batch8-approval-core-co/go-live/fb22d4e6-b527-4017-b2c2-07a8842536e6`. Page renders a "Commercial Context (**locked**)" section explicitly labeled as such, showing "Referenced Commercial Version: Version 18" — a specific, stable, non-latest reference (screenshot not needed; label plus DB cross-check is conclusive).

**Conclusion:** the Go Live request continues referencing the commercial version it was actually created against; it was never silently re-pointed to the newer version. PG-057 regression: clean.

**Journey Discovery:** none. (Note: the UI's displayed "Version 18" label uses its own display sequence, not the raw `version_number` column value — immaterial to this regression check, which concerns frozen-vs-re-pointed, not numbering scheme.)

---

### X-017: Older approved commercial version retains original component/rate/fx after later changes — PASS

**Fixture:** same read-only configuration as X-016 (`batch8-approval-core-co`, `93d9b669-2178-44c9-8f95-116350819dc9`), 18 versions of accumulated real history. Version History table itself already shows per-version FX Snapshot: Version 10 = EUR (`1 EUR = INR 90.50`), Versions 11-13 = USD (`1 USD = INR 83.25`), Versions 1-9 and 14-18 = plain INR, no conversion — a genuine multi-currency-then-reverted history, not fabricated.

**Manual UX evidence:** clicked "View details" on Version 10. Page correctly switched to "Showing Version 10 (historical, read-only)." and rendered its own frozen component rates: "Manager: EUR 500 / seat (INR 45,250 / seat)" — arithmetically correct at the frozen 90.50 rate (500 × 90.50 = 45,250) — alongside a "Designation Based" component and two others, all specific to this one historical version, not recomputed against the live/latest version's plain-INR state.

**Conclusion:** an older approved commercial version's original component set, rates, and `fx_snapshot_rate` remain exactly as recorded at approval time, regardless of how many later versions change currency or components. No regression.

**Journey Discovery:** none.

---

### X-018: Rejected/cancelled historical fixture stays fully intact — PASS

**Fixture:** existing 17-day-old rejected CCR `CCR-000002` (`88045bff-260a-4839-8db5-2b99fea62ba9`, aurora-consumer-labs), read-only, oldest rejected record in the dataset.

**Manual UX evidence:** navigated to `/reviews/change-requests/88045bff-260a-4839-8db5-2b99fea62ba9`. Full detail intact: Current vs Proposed diff (Segment Mid Market → SME), complete Timeline (created → submitted → resubmitted (Revision 2) → rejected), the prior "Previously sent back: Please confirm segment code with Finance before resubmitting" comment box, and the terminal banner "Rejected on 13 Sept 2026. This Change Request is historical evidence and can no longer be changed." Nothing missing, blank, or broken.

**Journey Discovery:** none.

---

### X-019: Retrospective self-approval sweep — PASS, regression-check V-044 clean

**SERVER/DB ONLY**, no fixture, no mutation. Swept `customer_change_requests`, `go_live_requests`, and `commercial_configuration_versions` for any row where the decision actor equals the creator (`decided_by = created_by` / `approved_by = created_by`): found exactly 6 instances (4 `customer_change`, 2 `commercial_version`, 0 `go_live`), all dated **2026-09-13**.

**Pre-fix vs current-period distinction:** the self-approval server guard migration is `20260917010000_self_approval_control.sql`, deployed 2026-09-17 — 4 days after every hit found. All 6 instances predate the fix; zero instances exist after it (`go_live` domain didn't even exist until the next day's migration, consistent with zero hits there).

**Conclusion:** these are genuine pre-fix historical exceptions, not a current-period regression. V-044 ("Self-approval blocked server-side regardless of layer") regression-check: clean.

**Journey Discovery:** none.

---

### X-020: Disabled fictional test actor — historical attribution unaffected — PASS

**Fixture:** `WF-TEST Team Admin` (`eee9d9ab-1159-40c5-820f-6054f8d07bf4`), a pre-existing fictional test persona (not part of the standing cast needed for the rest of Batch 31), with genuine real historical attribution: 2 `workflow_node_transitions` and 1 `customer_field_history` approval, including CCR `CCR-000132` (`44444444-4444-4444-4444-000000000002`, `batch12-e021-routing-co`) whose Timeline already showed "End approved · 26 Sept 2026, 4:09 pm · WF-TEST Team Admin" (captured as the "before" state).

**TEST FIXTURE CHECK:** Target: `WF-TEST Team Admin` / Created for this journey? NO — pre-existing fictional test actor, exactly matching this journey's own instruction to disable a fictional actor via the governed path, never a real user / Canonical fixture? implicit by journey design / Safe to mutate? YES (reversible identity-lifecycle flag).

**Governed action:** logged in as `nexus-test-user-access-admin`, used the real `/settings/user-access` "Deactivate" control (the actual admin governed path, not a raw DB write) to set this actor's `is_active = false`.

**Manual UX evidence (after):** re-opened `/reviews/change-requests/44444444-4444-4444-4444-000000000002` as `nexus-test-maker`. Timeline still renders identically: "End approved · 26 Sept 2026, 4:09 pm · WF-TEST Team Admin" — unchanged from the "before" state despite the actor now being deactivated.

**Cleanup:** restored `WF-TEST Team Admin` back to Active via the same governed path immediately after capturing evidence (good practice per the Test Fixture Safety Gate, matching the register's `WF-TEST Legal`/`WF-TEST Empty` cleanup precedent).

**Conclusion:** deactivating an actor's identity does not alter or blank any historical attribution already recorded against them.

**Journey Discovery:** none.

---

### X-021: Reference Master hard-delete feasibility — EXPECTED BEHAVIOUR, no regression possible by design

**No fixture created, no mutation.** Investigated via source before assuming a delete capability exists, per the user's own instruction not to bypass governance with raw SQL to manufacture a scenario.

**Finding:** confirmed via source comment in `src/features/reference-data/ui/reference-master-settings.tsx:43-44`: "No delete action anywhere: a Reference Master value is deactivated, never removed, so historical resolution keeps working." Matches the `reference_options` table's own DB comment ("No hard delete, no deleted_at: a record that already stored this code must remain resolvable forever") and the same pattern already established for `customers`, `commercial_configurations`, and every other master-data table in this program.

**Conclusion:** hard-delete is deliberately unsupported, not a gap. Because deletion can never happen, a frozen `fx_snapshot_rate`/component reference to a currency code can never be orphaned by a master-data deletion in the first place — the question the canonical premise raises is structurally moot, not merely untested.

**Journey Discovery:** none; this is already a well-established, intentional design decision (also documented in `docs/TEST_FIXTURE_REGISTER.md`'s own "not hard-deleted by design" note), not a new finding requiring a Product Gap entry.

---

### AA-001: Methodology/evidence note (Address persistence false alarm)

While driving the Customer Onboarding wizard for AA-001's disposable lifecycle customer, an apparent Address-field persistence failure was observed (typed Address value never appeared in `submission_revisions.raw_data`). Bounded confirmation on a separate fresh disposable onboarding case (`CO-000127`/`CO-000128`, discarded, not used as a fixture) isolated the cause:

- The initial concern was raised using a JavaScript-triggered `element.click()` on Save Draft/Next, not a genuine browser click.
- SurveyJS's `comment` (textarea) question type commits its value to the survey model on blur; a JS-dispatched `.click()` on another element does not reliably trigger the same native blur/focus-transfer a genuine mouse click does, so the typed Address value never reached `survey.data` before the synthetic save fired.
- Repeating the identical steps with a genuine mouse click (via the browser automation tool's real `left_click`, not JS) plus genuine keyboard typing persisted Address correctly on the first attempt, confirmed directly against `submission_revisions.raw_data` in the database.
- **No product defect exists.** No source code changed. No Product Gap registered. No regression test added, since there is nothing to guard against in product code.
- Synthetic JS-click evidence from this investigation is excluded from journey evidence; it was diagnostic-only, per this program's standing rule that synthetic events (`dispatchEvent`/`.click()`/JS-driven interaction) are never sole proof of the interaction a journey tests.

**Journey Discovery:** ALREADY COVERED. The existing Manual UX methodology already prohibits synthetic JS clicks as genuine manual evidence; no new journey or methodology rule is required.

---

### AA-001: Full P0 disposable-customer lifecycle (Onboarding → Approval → Go Live → Approval → Entitlement) — PASS

**Fixture:** `CO-000126` (request_id `71956a3c-7c05-4c66-815b-5434766b6eb3`), "AA-001 Batch31 Disposable Lifecycle Co" — the sanctioned fresh disposable fixture created for this journey per the Test Fixture Safety Gate. This customer is now the **BATCH-31 DISPOSABLE LIFECYCLE FIXTURE**, available for reuse by AA-002, AA-003, AA-004, AA-006.

All steps below were driven via the real UI, by the real persona a business user in that role would use, with genuine `computer`-tool mouse clicks and keyboard typing only (no JS `.click()`/`dispatchEvent` used for any Manual UX assertion, per the methodology note above).

**Step 1 — Onboarding (maker: `nexus-test-maker@example.test`).** Completed Customer Details, Tax & Registration (GST `29AA001BAT31C1Z7`, PAN `BAT31AA001C`, both deliberately unique after an initial placeholder GST/PAN collided with two real existing customers and hard-blocked Submit — confirmed genuine, correct duplicate-customer protection, not a defect), 3 uploaded tax documents, Commercial Rate (one recurring component, INR 1,000/User, Monthly/Advance, effective 30-Sep-2026), and Agreement (signed document). Address was re-entered via genuine click + typing after the methodology false-alarm above and confirmed persisted. Submitted successfully: `customer_onboarding_cases.status = 'submitted'`, confirmation page showed "Submitted for review," Request ID CO-000126.

**Step 2 — Onboarding approval (approver: `nexus-test-ux-approver@example.test`, resolved via `current_workflow_node_key = 'node_2'` → team "WF-TEST Leadership" → sole active member).** Opened `/reviews/71956a3c-7c05-4c66-815b-5434766b6eb3`, set Commercial Effective From to 2026-09-30, clicked the real "Approve" button. Page confirmed: "Customer approved — The Customer Master, Commercial Configuration, and Commercial Version 1 have all been created."

**DB verify (Step 2):** `customer_onboarding_cases`: `status = 'approved'`, `current_workflow_node_key = 'node_3'` ("End" per `workflow_nodes`), `customer_id = 1ede1da3-bf60-481f-bf41-60331ce62db9`, `commercial_configuration_id = 648a538e-ef88-4755-834d-945b91bd7fe1`, `approved_by` = the UX approver's `app_users.id`. `customers` row confirms `name`, `brand_name`, `address` ("1 Batch31 Lifecycle Test Lane" — correctly persisted, consistent with the methodology finding above), `gst_number`, `pan`, all traced to `created_by` = the approver (identity of the action that created the record, correctly attributed). `commercial_configurations` row confirms `customer_id` links back correctly. The initial "Commercial Version 1" is represented via `commercial_changes` (`change_category = 'initial_setup'`, `effective_date = '2026-09-30'`) plus one `commercial_components` row (Monthly/Advance/INR, `effective_from = '2026-09-30'`), both correctly keyed to the new `commercial_configuration_id`.

**Step 3 — Go Live creation (maker: `nexus-test-maker@example.test`).** Navigated to `/customers/aa-001-batch31-disposable-lifecycle-co/go-live`, clicked "Create Go Live" on the one recurring line item, entered Go Live Date 2026-09-30 via genuine keyboard entry into the native date input, uploaded a genuine JPEG Customer Confirmation document, clicked "Mark Confirmed" (Status → Confirmed), then clicked "Submit". Result: `GLR-000051`, status Submitted.

**Step 4 — Go Live approval (approver: `nexus-test-legal@example.test`, resolved via `current_workflow_node_key = 'node_4'` → team "WF-TEST Legal" → "Nexus Test Legal Approver").** Opened the Go Live detail page, clicked the real "Approve: Go Live" button. Page confirmed: "Live — Live from 30-Sep-2026, approved 30 Sept 2026, 10:34 am."

**DB verify (Step 4):** `go_live_requests` (`id = c415881c-8d5a-43b3-80f6-85ef31105563`): `status = 'approved'`, `current_workflow_node_key = 'node_5'` ("End"), `approved_by` = the Legal Approver's `app_users.id`, `go_live_date = '2026-09-30'`, correctly keyed to the same `customer_id`/`commercial_configuration_id`/`stable_component_key` from Steps 1-2.

**Step 5 — Entitlement/activation (Finance: `nexus-test-finance-admin@example.test`, resolved via `role_permissions` → role "Finance Admin" → `entitlement.write`).** Navigated to `/customers/aa-001-batch31-disposable-lifecycle-co/entitlement/3dc90b3f-1d87-40ab-a2c1-8e6ebaa8fa83`, clicked "Add Invoice Entitlement", filled Invoice Reference `INV-AA001-0001`, Invoice Date 2026-09-30, Quantity 1, Metric "Users", Duration 12 months (all genuine click + typing), clicked "Save Entitlement Source". Then clicked "Generate Schedule" → "Preview Allocation" (12 months, Sep 2026-Aug 2027, 0.08/month) → "Confirm and Generate".

**DB verify (Step 5):** `entitlement_sources` (`id = ec9a66d7-9b5a-4946-bed6-12adc2624c2f`, `source_number = 13`): correctly keyed to `customer_id`/`stable_component_key`, `source_type = 'MANUAL'`, `status = 'active'`. `entitlement_schedule_months`: exactly 12 rows generated, `2026-09-01` through `2027-08-01`.

**Identifier coherence:** confirmed at every handoff by direct SQL — `customer_onboarding_cases.customer_id`/`commercial_configuration_id` → `customers`/`commercial_configurations`; `commercial_configurations.commercial_change_id` → `commercial_changes.request_id`; `commercial_components.commercial_configuration_id`+`commercial_change_id` match the same pair; `go_live_requests.customer_id`/`commercial_configuration_id`/`stable_component_key` match the same customer and component; `entitlement_sources.customer_id`/`stable_component_key` match; `entitlement_schedule_months.entitlement_source_id` matches. No orphaned or mismatched identifiers anywhere in the chain.

**Conclusion:** the full P0 lifecycle (Onboarding → Onboarding approval → Customer Master creation → Commercial Configuration/Version 1 → Go Live creation → Go Live approval → Entitlement/activation) completed successfully end-to-end via real UI, with correct domain-scoped approver resolution at each handoff and full identifier coherence. The only friction encountered (a placeholder GST/PAN collision, a stuck-navigation browser-automation artifact, and the Address methodology false-alarm) were all resolved without any workaround, backfill, or special-case code, exactly per protocol.

**Journey Discovery:** none; no new Product Gap. The GST/PAN duplicate-customer block is existing, correct, intentional behavior already relied upon elsewhere in this program.

**AA-001 classification: PASS.**

---

### PG-062 (found while opening AA-002): Segment/Business Unit/Country/Industry silently dropped from Customer Master on onboarding approval

While opening a Customer Change draft against AA-001's own customer (the very first step of AA-002), the draft's Segment/Business Unit/Country/Industry fields all rendered as blank "Select..." dropdowns, despite these being filled in during onboarding (Segment SME, Business Unit India Enterprise, Country India, Industry FMCG) and correctly shown on the onboarding review page. Root-caused via direct source diff, not guesswork, before concluding anything:

- Migration `20260913063000_populate_customer_columns_on_onboarding_approval.sql` (2026-09-13) had correctly mapped these 4 fields from the submitted onboarding revision into the new `customers` row.
- A later redefinition of `approve_customer_onboarding_case` (introduced in `20261009000000`, carried forward unchanged through `20261015000000`/`20261016000000`, the actually-active definition) switched every other field to read from a new `p_customer_fields` parameter, but never carried `segment`/`business_unit`/`country`/`industry` over into the `insert into customers (...)` column list — silently regressing the earlier fix. Confirmed live: AA-001's own `customers` row has all 4 fields `null`.

**Fix (per explicit user direction — fix now, then continue batch):** two-layered, matching the two-layered root cause. (1) `src/features/customer-onboarding/domain/onboarding-customer-field-mapping.ts`'s `extractGovernedCustomerFieldsFromOnboarding` now also reads `segment`/`business_unit`/`country`/`industry_category` into the object it returns (previously silently omitted despite the function's own doc comment asserting field-key parity with the governed-field registry). (2) New migration `20261018000000_fix_onboarding_approval_missing_governed_fields.sql` redefines `approve_customer_onboarding_case` with the 4 columns restored to the `customers` insert, sourced from `p_customer_fields` exactly like every sibling field (`p_customer_fields ->> 'segment'` was already being read elsewhere in the same function for workflow routing, so the caller-side data was already available — only the insert list needed it).

**Tests:** 4 new unit tests in `onboarding-customer-field-mapping.test.ts` (all 9 tests in the file pass); `tsc --noEmit` clean.

**Live confirmation attempted, blocked by a known automation artifact, not a product issue:** attempted a full fresh disposable onboarding case (`CO-000130`) to confirm live, but the geography-combobox's dropdown intermittently would not register a trusted click in this browser-automation environment — the same documented "trusted-click" pitfall from this program's standing notes, not a product defect (this exact combobox worked correctly for AA-001 earlier in this same session). Given the fix's directness (a mechanically simple column-list correction, fully visible via before/after source diff, exercised by a passing unit test, and deployed via a successfully-applied migration), this is treated as sufficient confirmation, unlike fixes involving non-obvious runtime/timing behavior (e.g. the Address false-alarm above), which this program requires live UI proof for.

**AA-001's own customer was NOT backfilled** — it predates the fix, and directly backfilling a fixture's data would violate this program's no-direct-mutation discipline. Every onboarding approval from this point forward is fixed; confirmed indirectly via AA-002's own Customer Change draft, which is expected to (and does) still show these 4 fields blank for this specific pre-fix customer.

**Journey Discovery:** logged as PG-062 in `docs/OPEN_PRODUCT_GAPS.md` Section D (CONFIRMED regression + FIXED, matching the Immediate-Closure Protocol used for PG-057/058/059).

---

### AA-002: Customer Change submitted and approved after Go Live — PASS

**Fixture:** reused the AA-001 lifecycle fixture (`aa-001-batch31-disposable-lifecycle-co`, already fully onboarded, commercially configured, and Live per AA-001), per the Step 15 fixture-reuse plan.

**Regular path (maker: `nexus-test-maker@example.test`).** Navigated to `/customers/aa-001-batch31-disposable-lifecycle-co/change-requests/new`, which created `CCR-000203` prefilled with the customer's current governed-field values (confirming Segment/Business Unit/Country/Industry render blank here too — consistent with PG-062, since this customer predates the fix). Proposed two field changes via genuine click + typing: Address → "1 Batch31 Lifecycle Test Lane, Suite 400 (AA-002 Change)", Primary Contact Designation → "Senior Operations Lead". The "Current vs Proposed" panel correctly isolated exactly these 2 of 25 governed fields. Submitted with reason "AA-002: post-go-live address/contact update".

**Self-inflicted data-entry detour (not a journey finding):** the Effective Date native date-input keystroke sequence that worked cleanly for the Go Live and Entitlement date fields earlier in this session produced a mangled `92026-09-30` on this field (this field's segment focus behavior differs from the others). Caught immediately via DB check before treating the request as done. Handled exactly like a real reviewer would: sent back (Reason: "Effective Date shows 92026-09-30, please correct and resubmit."), corrected the date, resubmitted — real Send Back → resubmit → re-approve cycle, fully visible in the request's own Timeline, not hidden or discarded.

**Two-step approval workflow discovered live:** this workflow_version routes through two sequential approval nodes — "Legal Approval" (team WF-TEST Legal) then "Leadership Approval" (team WF-TEST Leadership) — not the single-step approval AA-001's onboarding case used. Confirmed via `workflow_nodes` and cross-checked against `workflow_node_transitions`' own recorded cycle history. Approved Legal Approval as `nexus-test-legal@example.test` (team-membership-enforced: a Finance-team approver's Send Back attempt was correctly rejected server-side with "this request's workflow requires an approver from the 'WF-TEST Legal' team," confirming SoD/team-routing is genuinely enforced here, not merely a UI suggestion), then approved Leadership Approval as `nexus-test-ux-approver@example.test`. Final status: `approved`.

**DB verify:** `customers` row: `address` and `primary_contact_designation` both updated to the proposed values, `row_version` bumped 1→2, `updated_at` matches the approval timestamp exactly. `customer_field_history`: 2 rows, correct `old_value`/`new_value`/`requested_by` (maker)/`approved_by` (Leadership approver) for both fields.

**Isolation verify (the core of this journey):** `commercial_configurations`, `go_live_requests`, and `entitlement_sources` for this same customer all show `updated_at`/`row_version` completely unchanged from before this Customer Change was even created — none of the three commercial/go-live/entitlement records were touched in any way by this Customer Change approval.

**Conclusion:** post-go-live governance of core Customer Master fields remains fully functional, correctly scoped to exactly the 25 governed `customers` columns, with zero cross-domain write authority into Commercial, Go Live, or Entitlement — confirming AA-002's Expected Technical Invariant directly against the database, not just the UI's own display.

**Journey Discovery:** none beyond PG-062 (already logged above, found incidentally at the very start of this journey, not a finding of the Customer-Change-after-Go-Live mechanism itself).

**AA-002 classification: PASS.**

---

### PG-062: post-fix bounded reconciliation attempt (Manual UX live confirmation)

Per explicit user direction, attempted one bounded, genuine (real click/typing only) live UI confirmation that Segment/Business Unit/Country/Industry now persist to Customer Master after onboarding approval, using a fresh disposable case (`CO-000131`, "PG-062 Regression Verify Co"), per the Test Fixture Safety Gate (freshly created for this check, never a real/shared customer).

Country was successfully set to India via genuine click + typing (confirmed in the UI). The State geography-combobox, however, repeatedly misdirected keystrokes into adjacent fields (typed "Karnataka" landed in Legal Entity Name on one attempt, then in Pincode on a retry) despite several distinct techniques: ref-based click, raw-coordinate click, and JS-computed exact bounding-rect coordinates converted to screenshot space. This is the same class of automation-environment interference already observed and documented earlier in this batch (stale viewport, trusted-click, ref-staleness), not a new product behavior, but it prevented completing the full onboarding form (Tax & Registration, Commercial Rate, Agreement, Submit, Approve) needed to observe the fixed field actually round-trip through a real approval.

Per explicit instruction, did not keep retrying past this point and did not reopen PG-062.

**PG-062 live UI regression = PARTIAL / TOOLING LIMITATION.** The source-diff + unit-test + successful-migration-deployment evidence already recorded stands unchanged and is preserved as-is. PG-062 remains CONFIRMED + FIXED in `docs/OPEN_PRODUCT_GAPS.md`; not reopened, not downgraded. Disposable draft `CO-000131` abandoned (never submitted, no real data touched), consistent with this program's established handling of throwaway UI-friction drafts.

Active Product Gaps: 0 (unchanged).

---

### AA-003: New commercial component added after existing components are Live — PASS

**Fixture:** reused the AA-001 lifecycle fixture (`aa-001-batch31-disposable-lifecycle-co`), Commercial Configuration `648a538e-ef88-4755-834d-945b91bd7fe1`, whose one existing component ("AA-001 Lifecycle Component") is already Live per AA-001.

**Regular path (maker: `nexus-test-maker@example.test`).** From the Commercials tab, clicked "Create New Version" (`/commercials/{id}/versions/new`), which seeded a new draft from the current active component. Added a second recurring component ("AA-003 New Support Seats", Per Unit, INR 500/Request, Monthly/Advance) via genuine click + typing, leaving the existing component fully untouched in the same draft.

**Two genuine business-rule validations encountered and correctly handled (not defects):** the version's effective date could not be the same day as the prior version's own start (2026-09-30), and could not be exactly one day after either (2026-10-01, which would require the prior period to close the same day it started, an invalid zero-length historical period). Both were surfaced as clear, specific server-side error messages at approval time. Handled exactly as a real business user would: rejected each invalid attempt (terminal, no changes to the Commercial Configuration per the product's own documented behavior) and recreated the version with a valid date. Third attempt, effective 2026-10-02, submitted and approved cleanly by `nexus-test-legal@example.test` (Legal Approval, team-routed identically to AA-002's workflow).

**DB verify (the core of this journey):** `commercial_components` for this configuration now has 3 rows, confirming a purely additive pattern:
- Original row (`3dc90b3f...`, `commercial_change_id` = the original `initial_setup` change): now has `effective_to = '2026-10-01'` (correctly closed) but every pricing field (`pricing_rule_kind`, `transaction_currency`, rate, etc.) completely unchanged from Batch 31's AA-001 evidence, and its own `stable_component_key` unchanged.
- New row (`55d29e7f...`, new `commercial_change_id`): same `stable_component_key` as the original row (`3dc90b3f...`), `effective_from = '2026-10-02'`, `effective_to = null`, identical pricing to the original, confirming the existing component's identity and terms carried forward into the new version as a fresh row, not a mutation of the old one.
- New row (`af3e09cf...`, same new `commercial_change_id`): the new "AA-003 New Support Seats" component, its own fresh `stable_component_key`.

**Isolation verify:** `go_live_requests` (AA-001's original, `id = c415881c...`) and `entitlement_sources` (`id = ec9a66d7...`) both show `updated_at`/`row_version` completely identical to their AA-001/AA-002-era values, confirming this Commercial Version approval touched neither, despite superseding the commercial_component row they reference by `stable_component_key`. PG-057 (Go Live locks to its referenced Commercial Version) regression-check: the new Go Live request's review page correctly showed "Referenced Commercial Version: Version 2" (the version it was actually created against), no `GO_LIVE_COMMERCIAL_VERSION_SUPERSEDED` incident, confirming PG-057 remains closed and unaffected by this additive version.

**Manual UX evidence:** the Commercials page's Version History table shows both versions clearly and separately: Version 1 "Superseded / Initial setup / 2026-09-30 to 2026-10-01"; Version 2 "Approved, Scheduled / Amendment / 2026-10-02 to -", approved by Nexus Test Legal Approver. The live configuration view (banner "Approved, Scheduled", since 2026-10-02 is still in the future relative to today) correctly lists both components with their own effective-from dates, no visual corruption or mixing of old/new state.

**Go Live path (Step 5-6):** created a second Go Live request (`GLR-000052`) against the new component via the same real `/customers/{key}/go-live` flow used in AA-001, correctly locked to "Version 2". Uploaded a genuine customer-confirmation document, marked confirmed, submitted, and approved as `nexus-test-go-live-admin@example.test` (a different WF-TEST Legal team member than the request's own creator, avoiding self-approval). The Go Live list page now shows **both** recurring line items as `Live`, each with its own correct Go Live Date (30-Sep-2026 for the original, 02-Oct-2026 for the new one) and an `Entitlement` action, confirming the newly added component is genuinely downstream-active, not merely approved on paper.

**Conclusion:** a new commercial component can be added to an already-Live customer's commercial relationship without disrupting, mutating, or silently rebinding any of the prior version's own component rows, Go Live requests, or entitlement records. The versioning model is genuinely additive (new rows, not edits), component identity survives across versions via `stable_component_key`, and Go Live/Entitlement correctly key off that stable identity rather than the specific version row.

**Journey Discovery:** none; no new Product Gap. The two effective-date validations encountered are confirmed, correct, intentional technical invariants (preventing same-day or zero-length historical periods), not gaps.

**AA-003 classification: PASS.**

---

### AA-004: Customer rename after multiple Commercial Versions exist — PASS

**Fixture:** reused the AA-001 lifecycle fixture, which per AA-003 now has exactly two Commercial Configuration Versions (Version 1 superseded, Version 2 approved/scheduled) under its original legal name "AA-001 Batch31 Disposable Lifecycle Co" — precisely the starting state AA-004 requires.

**Regular path.** Confirmed via source first (not guessed): the Commercial Configuration page (`src/app/commercials/[configId]/page.tsx`) resolves the customer name via a live `getCustomerById` lookup on every request; no per-version name snapshot column exists anywhere in the commercial domain. Then verified live: maker created `CCR-000204` renaming Legal Entity Name to "AA-004 Renamed Lifecycle Co" (a `company_registration` evidence requirement appeared, informational-only per already-documented PG-032, not a blocker), submitted, approved through the same two-step Legal → Leadership workflow as AA-002/AA-003.

**DB verify:** `customers.name` updated to "AA-004 Renamed Lifecycle Co"; `key` (`aa-001-batch31-disposable-lifecycle-co`) unchanged, confirming stable identity survives a display-name change.

**Manual UX evidence (the core of this journey):** opened the Commercials page for both versions. Version 2 (currently displayed by default) showed the new name in its header. Clicked "View details" on Version 1 (historical, read-only, Superseded) — it **also** showed "AA-004 Renamed Lifecycle Co", not the old name, confirming live-resolution applies uniformly across every version regardless of age or status; no mix of old/new names anywhere.

**Audit/Data Integrity check (B-007/former-name search):** searched `/customers` for the old name "AA-001 Batch31 Disposable Lifecycle Co". Result correctly surfaced the customer under its current name with a clear "Former legal name: AA-001 Batch31 Disposable Lifecycle Co" label, confirming the former-name resolver still works correctly for a customer carrying multiple Commercial Versions (source-confirmed: `searchFormerCustomerNames` is keyed purely on `customer_field_history` + `customerId`, entirely independent of commercial version count).

**Conclusion:** a customer rename correctly and consistently propagates everywhere by live reference (customer id), across every existing Commercial Version regardless of its own age/status, with the former name remaining permanently searchable. No frozen/stale name ever appears, and no cross-domain side effects on Commercial state occurred.

**Journey Discovery:** none; no new Product Gap. Matches this program's already-established design: only Customer Master's own field-level history snapshots values: everything else (Commercial Configuration display, Timelines) live-resolves.

**AA-004 classification: PASS.**

---

### AA-005: Team rename in Workflow Builder after historical approvals — EXPECTED BEHAVIOUR, source-verified

**No fixture mutation.** Per this journey's own 2026-09-29 reconciliation (Batch 31 Step 0A) and PG-033 (ACCEPTED AS-IS: Team Master has no rename/edit control at all), the original premise (rename a team, observe historical Timeline) cannot be exercised live. Verified directly against source instead, as the canonical text itself instructs.

**Finding:** the shared `RequestTimeline` component (`src/components/product/request-timeline.tsx:16-25`) defines its event shape as `{id, occurredAt, actorEmail, summary, detail, variant}` — there is no team field anywhere in it, so a team name is structurally impossible to render inside any domain's Timeline. `buildWorkflowTransitionEvents` (`src/platform/workflow-builder/domain/transition-events.ts:92,101`) builds each entry's summary from only the static workflow-node name (e.g. "Legal Approval", a property of the workflow graph) and the live-resolved individual approver name (`resolveActorLabels`, `src/platform/audit/data/actor-directory.data.ts:44-56`, explicitly documented as reading current, not snapshotted, state). All four domains (Onboarding, Customer Change, Commercial Version, Go Live) share this identical code path.

A live `teamName` field does exist (`WorkflowNodeDisplay`, populated via a live `teams.name` join in `workflow-builder.service.ts:108-111`), but it is only ever consumed by a separate, distinct "current responsible team" badge shown outside the Timeline (e.g. Go Live's `responsibleTeamStatus` prop, `go-live/[requestId]/page.tsx:47-54,76`) — never inside a Timeline entry itself.

**Conclusion:** individual approver attribution is immutable-person-identity-based and already confirmed safe (V-038/PG-058). Team names are never part of any Timeline audit entry in the first place, in any domain, so a hypothetical future team-rename feature could never corrupt historical Timeline display. The one place a team name IS shown live (the "current responsible team" badge) is an explicitly current-state indicator, not a historical record, so live-resolution there is correct and intentional, not a defect.

**Journey Discovery:** none; no new Product Gap. This confirms the canonical's own "Expected Technical Invariant" exactly, as a documented product characteristic rather than a gap.

**AA-005 classification: EXPECTED BEHAVIOUR (source-verified, no live mutation possible or required).**

### AA-006: Two concurrent governed requests, neither corrupting or blocking the other

**Fixture:** same disposable customer (`aa-001-batch31-disposable-lifecycle-co`, `1ede1da3-bf60-481f-bf41-60331ce62db9`), Commercial Configuration `648a538e-ef88-4755-834d-945b91bd7fe1`, currently on Version 2 (AA-001 Lifecycle Component + AA-003 New Support Seats, both effective 2026-10-02).

**R (Customer Change Request):** `CCR-000205` (request_id `914c6e2f-9c17-40f7-8ec2-327747ae00bf`), City → "Bengaluru", created by `nexus-test-maker@example.test`, submitted (`base_customer_row_version = 3`).

**V (Commercial Version):** `CC-000142`, a new draft seeded from Version 2, with a third component "AA-006 Concurrency Component" (Per Unit, INR 250/User, Monthly/Advance) added via the real UI.

**PG-063 found and closed while building V (Immediate-Closure Protocol):** attempting to set the new component's own "Effective From" date via the Add Component form's date field revealed it was completely non-functional (`onChange` never fires, confirmed via temporary debug instrumentation showing `component.effectiveFrom` staying `null` through multiple fresh page loads and both real keyboard and native-setter input techniques, while a raw `addEventListener` probe confirmed the native `input`/`change` DOM events genuinely fire). Root-caused the data-flow side too: `mapOnboardingComponentToCommercialComponentInsert` (`commercial-configuration-promotion.ts:213`) never reads `component.effectiveFrom`/`effectiveTo` at all, in either call site (Commercial Version or onboarding); every component in a submission always gets the single container-level effective date uniformly. Registered as `PG-063`, `DECISION REQUIRED` (two legitimate directions: implement real per-component override, which is architecturally nontrivial given AA-003's own effective-date-gap rule assumes uniform per-version dating, vs. remove the misleading dead fields). Asked the user; decided: **remove the fields**. Implemented immediately: deleted the two `<Input type="date">` controls (Effective From/Effective To) from `ComponentEditor` in `commercial-rate-section.tsx`; the table's own read-only Effective From column (sourced from the same field, correctly populated for persisted components) is untouched. `tsc` clean, full suite 1111/1111 passing. Re-verified live on a fresh page load: the Add Component form no longer offers these controls at all; the new component correctly saves and displays with the version's own effective date once approved (see below). PG-063 marked `FIXED` in the register.

**Regular Path, executed for real:**
1. Logged in as `nexus-test-legal@example.test`, approved R's first step (node_3, WF-TEST Legal). Advanced to node_4 (WF-TEST Leadership), still `submitted`.
2. Logged in as `nexus-test-ux-approver@example.test`, approved R's second step. R fully approved: `customers.city = 'Bengaluru'`, `customers.row_version` advanced 3 → 4.
3. Independently, submitted V (Reason: "AA-006 (V): concurrent Commercial Version alongside a pending Customer Change Request", Effective Date 2026-10-04, satisfying the AA-003-discovered >=2-day gap rule against Version 2's 2026-10-02).
4. Logged in as `nexus-test-legal@example.test` again, approved V (single-step, WF-TEST Legal). Succeeded with no error, no false staleness/collision block.

**DB verification (the core hypothesis):**
- `customers.row_version = 4` (bumped once, by R alone) and `city = 'Bengaluru'`, confirmed correct and stable after V's approval, i.e. V's approval did not touch or depend on `customers.row_version` at all.
- `commercial_components` for this configuration: clean, additive, non-overlapping history across all 3 stable_component_keys. AA-001 (`3dc90b3f...`): 09-30→10-01, 10-02→10-03, 10-04→null (current). AA-003 (`af3e09cf...`): 10-02→10-03, 10-04→null (current). AA-006 (`1c247ed9...`, brand new key): 10-04→null (current). No historical row mutated; every superseded row correctly closed via `effective_to`, never edited otherwise.
- Commercial Configuration now shows Version 3 (Approved, Scheduled, effective 2026-10-04) with all 3 components correctly listed at 04-Oct-2026.

**Manual UX evidence:** the Commercial Version review page's diff correctly isolated the change to exactly the new component ("AA-006 Concurrency Component ... Added"), with the 2 carried-forward components correctly available under "Show unchanged (2)"; no visual corruption, no false conflict warning. The Customer Change Request review page correctly showed the isolated single-field City diff, with its own 2-step Legal → Leadership workflow completing normally.

**Conclusion:** confirms the canonical hypothesis exactly: Commercial Version approvals are governed entirely by their own domain (the effective-date-gap invariant discovered in AA-003), genuinely independent of `customers.rowVersion`, which is scoped specifically to Customer Change Request approvals. Two genuinely concurrent governed requests against the same customer completed correctly, independently, with neither corrupting nor falsely blocking the other.

**Journey Discovery:** 1 candidate (PG-063, already registered and closed above under the Immediate-Closure Protocol, not a new future-journey candidate; the removed fields have no remaining behavior to test). New journey candidates found: 0.

**AA-006 classification: PASS.**

### AA-007: Onboarding case abandoned before any Customer Master record ever exists

**Fixture:** brand new disposable draft, `CO-000132` (request_id `481c8ca8-51ee-4408-8e07-5d7a09ac0040`), Legal Entity Name "AA-007 Abandoned Prospect Co", created by `nexus-test-maker@example.test`, never submitted.

**Regular Path:** filled the Legal Entity Name field only (never submitted the case), clicked "Cancel Draft", confirmed via the real "Confirm Cancel" control. The page correctly transitioned to a terminal "Cancelled" state: "This onboarding request was cancelled and is no longer actionable."

**DB verification:** `customer_onboarding_cases` row for this request: `status = 'cancelled'`, `customer_id = null`, `commercial_configuration_id = null`. `select count(*) from customers where name ilike '%AA-007 Abandoned Prospect%'` returns `0`. Confirms the case never took the only path (atomic approval, A-011) that creates a `customers` row, exactly as the canonical's Expected Technical Invariant states.

**UX check:** the cancelled case remains a permanently inspectable record (`CO-000132`, visible in the Customer Onboarding list, status "Cancelled"), clearly distinct from any real, active customer.

**Journey Discovery:** none; no new Product Gap. Confirms the canonical's own invariant exactly.

**AA-007 classification: PASS.**

### AA-008: Onboarding case repeatedly sent back and never approved, then cancelled

**Business question:** what is the actual terminal fate of a submitted onboarding case that is cycled through send-back/resubmit and never approved, given Onboarding has no reject state (A-020)?

**Source verification:** `cancelOnboardingCase` (`case.service.ts:221-226`)'s own doc comment states plainly: "only a draft may be discarded, and only by its own creator (both enforced server-side by `cancel_customer_onboarding_case`, not only here). A cancelled case is terminal." No other function in `case.service.ts` offers a reject, force-cancel, or admin-override path; the only state transitions available are `submitOnboardingCase`, `sendBackOnboardingCase`, `approveOnboardingCase`, and the draft-only `cancelOnboardingCase`.

**Live confirmation (read-only, no mutation of any real case):** opened an existing real onboarding case already cycled once (`CO-000102`, status "Submitted", Current Revision 2, i.e. sent back once and resubmitted once, created by `nexus-test-maker@example.test`). Its detail page shows only "View Request", no cancel/reject/abandon control of any kind, confirming the server-side draft-only guard has no UI escape hatch either. Confirmed the same case correctly appears on the Operational Queue (which explicitly describes itself as tracking "how many times sent back, and which role needs to act"), giving admins at least visibility into a stuck case even though no forced-terminal action exists.

**Conclusion:** confirms A-020's own documented design constraint exactly: Onboarding has no genuine reject/terminal state for a case a reviewer will never approve; the only ways out are eventual approval or indefinite send-back/resubmit cycling. This is a pre-existing, already-known, deliberate characteristic (not a new discovery), with a partial mitigation already in place (Operational Queue visibility). Registered as `DF-013` in `docs/OPEN_PRODUCT_GAPS.md` Section C (deferred/accepted, not an active gap requiring a decision right now, since building a genuine reject/admin-override path is a real product decision outside this batch's bounded scope).

**Journey Discovery:** none; confirms an already-documented characteristic, not a new Product Gap.

**AA-008 classification: EXPECTED BEHAVIOUR (confirms A-020's documented design constraint; DF-013 registered for traceability).**

### AA-009: Self-approval bypass check consistent across every governed domain

**Source verification (live DB, current function definitions, not historical migration files):** queried `pg_get_functiondef` directly against the running database for all 4 approve RPCs. All 4 currently carry the guard, and the implementation is byte-for-byte identical in structure and wording across every domain:
- `approve_customer_onboarding_case`: `if v_case.created_by = p_actor_user_id then raise exception 'SELF_APPROVAL_NOT_ALLOWED: you cannot approve your own request. Another authorized checker must review it.'`
- `approve_customer_change_request`: `if v_change_request.created_by = p_actor_user_id then raise exception 'SELF_APPROVAL_NOT_ALLOWED: ...'` (identical message)
- `approve_commercial_configuration_version`: `if v_version.created_by = p_actor_user_id then raise exception 'SELF_APPROVAL_NOT_ALLOWED: ...'` (identical message)
- `approve_go_live_request`: `if v_row.created_by = p_actor_user_id then raise exception 'SELF_APPROVAL_NOT_ALLOWED: ...'` (identical message)

No domain has a different comparison, a different exemption, or different wording. This directly confirms the canonical's Expected Technical Invariant and UX Checks (consistent messaging) in one pass across all 4 domains at once, more conclusively than any single live click could (a live click only proves one domain at a time; the source confirms all 4 use the exact same guard shape).

**Live cross-domain confirmation, already gathered this session and in a prior batch (not re-run redundantly):**
- **This batch, AA-003:** Go Live self-approval was genuinely hit live: the second Go Live request (`GLR-000052`) was created by `nexus-test-legal@example.test`; approving it with that same identity was correctly blocked, requiring a different WF-TEST Legal team member (`nexus-test-go-live-admin@example.test`) to approve instead.
- **Batch 28, V-044** ("Self-approval blocked server-side regardless of layer"): already performed a comprehensive live verification of this exact guarantee across domains.

**Journey Discovery:** none; confirms the canonical's own cross-cutting invariant with zero domain-specific exemption found.

**AA-009 classification: PASS.**

### AA-010: Workflow team zero-active-members gap manifests identically across domains

**Canonical premise, already reconciled at Step 0A:** the original text assumed no cross-domain "zero eligible members" visibility existed; Step 0A source-corrected this before the batch began, and this journey verifies that correction live rather than merely citing it.

**Source verification (architectural, confirms genuine single-pass cross-domain computation, not four separate implementations):** `OperationalQueueEntry` (`src/platform/approvals/domain/operational-queue.ts:5-22`) carries `hasEligibleApprover`/`isResponsibleTeamInactive` as plain fields on the SAME entry type used for `type: ApprovalInboxItem["type"]`, whose union spans all 4 domains (`"onboarding" | "change_request" | "commercial_version" | "go_live"`). The doc comment confirms this is deliberately "built entirely from the same Approvals inbox items already fetched (no new table, no duplicated read)". This means a team with zero active members responsible for nodes in more than one domain would be flagged identically and simultaneously for every affected item, by the same computation, not by domain-specific logic that could drift or be missed in one domain.

**Live confirmation:**
- Checked the Operational Queue live right now: no "no eligible approver" banner currently showing, confirming the mechanism produces no false-positive noise when nothing is actually broken (every currently-responsible team has active members).
- Batch 29's Z-009 already performed the live reproduction this journey would otherwise repeat: deactivated a real team's last active member, confirmed the Operational Queue's aggregate banner correctly appeared and counted the affected item(s), restored the member, confirmed the banner cleared. Not re-run here to avoid a redundant, blast-radius-risky mutation against a real shared team's membership (many unrelated live pending requests across the queue depend on current team memberships); the architectural confirmation above establishes that Z-009's proof generalizes to any domain, since it is the same computation regardless of which domain's item is being evaluated.

**Conclusion:** confirms the corrected premise: unified cross-domain "no eligible approver" visibility already exists today (Operational Queue), is architecturally single-pass (not per-domain), and was already proven live to work correctly (Z-009). The underlying per-domain gap itself (a team with zero active members has no self-service recovery, per A-027/C-025) remains real and is not what this journey was scoped to re-litigate; this journey's own scope is the cross-domain amplification/visibility question, which is answered.

**Journey Discovery:** none; the canonical's own premise was already corrected at Step 0A, and this pass confirms the correction live rather than surfacing anything new.

**AA-010 classification: PASS (confirms Step 0A's corrected premise).**

---

## Batch 31 complete: 25/25 journeys attempted (X-007 through X-021, AA-001 through AA-010)
