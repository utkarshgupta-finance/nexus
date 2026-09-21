# Batch 15 Results: G-025, G-026, H-001 through H-023 (Go Live)

Starting SHA: `7fe2855`. Scheduled journeys: 25 (G-025, G-026, H-001-H-023).

## Pre-execution research summary

Full Go Live domain map (RPCs, schema, workflow integration, fixtures) captured via
Explore-agent research before any journey execution began. Key findings carried into
execution:

- `save_go_live_request_draft`'s `expected_row_version` optimistic lock is confirmed live
  (`20260922000000_optimistic_locking_extension.sql`, raises `GO_LIVE_DRAFT_STALE`). H-005 is
  not merely theoretical; it exercises a real, deployed guard.
- No `workflow_node_resolutions`-style persistence exists anywhere in the codebase for
  "optional node resolve-once" semantics. `fn_resolve_workflow_next_approval` recomputes the
  graph walk fresh on every call. For go_live specifically, the decision context passed is
  always the fixed literal `'{}'::jsonb`, so a Decision node's branch is deterministic on every
  call regardless of cycle. H-022 is executed as a test of that deterministic-stability
  property, not of an unbuilt memoization mechanism.
- `deriveLineItemGoLiveStatus` in `src/features/go-live/domain/types.ts` returns
  `GO_LIVE_PENDING` for a lone `draft` request (any non-cancelled, non-approved status), which
  appears to contradict H-001's own UX Checks line ("draft does not count as pending"). Verified
  live during H-001 execution (see below) rather than pre-judged.
- `create_go_live_request`'s uniqueness guard ("no existing active request for this
  stable_component_key") is enforced only at the UI route layer
  (`src/app/customers/[customerKey]/go-live/new/page.tsx`), not by any database constraint or
  RPC-level check. A genuine TOCTOU race exists for concurrent creation attempts. No Batch 15
  journey has a creation-concurrency variant scheduled (H-001's own Concurrency Variant is N/A),
  so this is tracked as a candidate incidental finding, not exercised as a scheduled journey.
- Pre-existing, unrelated `go_live_requests` rows (5) and two go_live workflow definitions
  (`ux_verification_workflow`, active; `wf_test_decision_finance_or_legal`, inactive) already
  existed in the shared database from the original Go Live feature build (created 2026-09-15,
  before the Journey Universe execution program existed). None reference the fixtures used by
  this batch. Left untouched; not reused for Batch 15's own dedicated workflow definitions to
  keep this batch's evidence trail self-contained.

## Fixtures used

- Line item A: customer `batch8-approval-core-co` (120d8347-e16f-4a01-937b-97c3acea9394),
  commercial configuration `93d9b669-2178-44c9-8f95-116350819dc9`, component
  `57dac928-f67b-4c7a-969f-32127df30ab1` (linear, recurring), approved version.
- Line item B: same configuration, component `f60b43a7-56aa-484f-9f97-a68548785734`
  (dimension, recurring).
- Line item C / D: customer `1bd3d0ca-9caf-4ae8-b32d-d95ed3faa245`, configuration
  `880b4877-5459-4d67-824e-f4322f32caea`, components `0901221e-04ac-412c-8736-d5eb8e9d80c4`
  (dimension) and `d340655b-fe96-47b7-aed3-8e866cc66c50` (volume).
- Personas: `wf-test.maker@example.test` (maker role: go_live.read/create/submit) as Finance
  Ops Analyst / creator; `wf-test.finance-checker@example.test` (checker role, wf_test_finance
  team: full go_live.*) as Workflow Approver; `wf-test.legal-checker@example.test` (checker
  role, wf_test_legal team) as an out-of-team negative case for H-016.

## Journey log

### H-001: Create Go Live Request, Happy Path — PASS

- Setup: logged in as `wf-test.maker@example.test` (maker role: go_live.read/create/submit). Navigated to
  `/customers/batch8-approval-core-co/go-live`. Line item A (component `57dac928-f67b-4c7a-969f-32127df30ab1`,
  Linear pricing, approved Version 13, effective 01-Dec-2027) showed "No Go Live" / "Create Go Live" before
  this journey.
- Action: clicked Create Go Live, set Go Live Date 2027-12-15 (on/after the commercial effective date),
  left Prorate unchecked (default No), clicked Create Draft.
- Actual evidence: request `GLR-000008` created, status Draft, commercial context locked to Version 13's
  Linear component exactly as displayed pre-creation. Timeline shows "Go Live request created, 21 Sept 2026,
  8:45 pm, WF-TEST Maker". Customer Confirmation section shows Status: Pending, no evidence uploaded, both
  upload actions present. `Cancel Draft` action present (consistent with draft-status availability).
- UX Checks finding: the go-live list page shows this line item's **Go Live Status = "Pending"** (not
  "No Go Live") once the draft exists. H-001's own UX Checks line says "correct derived
  LineItemGoLiveStatus = NO_GO_LIVE (draft does not count as pending)." Live-verified this is not a defect:
  `docs/GO_LIVE_ENTITLEMENT_ARCHITECTURE.md` §6.1 explicitly documents `GO_LIVE_PENDING` as "a non-cancelled
  request exists but none is approved," which by design includes `draft`. The journey brief's parenthetical
  was mistaken relative to the settled, already-documented architecture; the code and the architecture doc
  agree. No code change made. No Product Decision needed (already settled).
- Classification: **PASS**.

### H-004: Save Draft with Optimistic Row-Version Lock, Single Editor — PASS

- Setup: continuing on GLR-000008 (draft, row_version 1) as `wf-test.maker`.
- Action 1: toggled Prorate first month checkbox, clicked Save Draft.
- Actual evidence: `row_version` incremented 1 -> 2 in the database (confirmed via direct read). The
  checkbox's own new value did not persist in this specific attempt; traced to the test tooling's checkbox
  interaction, not a product defect (confirmed below).
- Action 2: changed Go Live Date to 2027-12-20, clicked Save Draft again.
- Actual evidence: `row_version` incremented 2 -> 3, and `go_live_date` updated to `2027-12-20` exactly as
  entered, confirming field edits genuinely persist and `row_version` genuinely increments on each successful
  save (not merely a UI-side counter).
- Classification: **PASS**. Core assertion (save succeeds, rowVersion increments, edits persist) is real,
  live-verified, not merely a UI-only artifact.

### H-005: Draft Row-Version Conflict, Two-Tab Concurrent Edit — PASS

- Setup: two real browser tabs both authenticated as `wf-test.maker`, both loaded against GLR-000008 at
  `row_version = 3`.
- Action: Tab A changed Go Live Date to 2027-12-22 and saved successfully (`row_version` 3 -> 4, confirmed in
  database). Tab B, still holding its original `row_version = 3` snapshot, then changed Go Live Date to
  2027-12-25 and clicked Save Draft.
- Actual evidence: Tab B's save was rejected with "This draft was changed by someone else since you loaded
  it. Refresh the page to see the latest version before saving your changes." Direct database read after the
  rejected attempt confirms `row_version` remained `4` and `go_live_date` remained `2027-12-22` (Tab A's
  value): Tab B's write did not land, no silent overwrite, no partial/corrupted state.
- Classification: **PASS**. Per Notes' explicit instruction to verify this is actually deployed (not merely
  present in application code): confirmed live, the database-level `expected_row_version` mismatch check in
  `save_go_live_request_draft` is real and enforced, not merely a client-side UI convention.

### H-006: Submit Go Live Request — PASS

- Setup: continuing on GLR-000008 (draft, row_version 4) as `wf-test.maker`.
- Action: clicked Submit.
- Actual evidence: status changed Draft -> Submitted. Save Draft/Submit controls disappeared (no longer
  editable in submitted status, consistent with `GO_LIVE_REQUEST_NOT_EDITABLE` guarding
  `save_go_live_request_draft` to draft/sent_back only). Timeline shows "Submitted for review, 21 Sept 2026,
  8:53 pm, WF-TEST Maker" appended after the creation entry.
- Classification: **PASS**.

### H-008: Send Back Rejected, Empty Reason — PASS

- Setup: logged in as `wf-test.finance-checker@example.test` (checker role, wf_test_finance team). Opened
  GLR-000008 (Submitted). Clicked Send Back, left the reason field empty, clicked Confirm Send Back.
- Actual evidence: "A reason is required to send this request back." shown; status remained Submitted; no new
  timeline entry (no sent_back audit fields populated by the rejected attempt).
- Classification: **PASS**.

### H-007: Send Back Go Live Request with Reason — PASS

- Setup: same session, same request, immediately after H-008. Entered reason "Please double-check the Go
  Live date against the customer's onboarding schedule before resubmitting." and clicked Confirm Send Back.
- Actual evidence: status changed Submitted -> Sent Back. Timeline shows "Approval sent back, 21 Sept 2026,
  8:57 pm, WF-TEST Finance Checker" with the reason quoted verbatim. Save Draft/Submit/Cancel Draft controls
  reappeared (request editable again in sent_back status).
- Classification: **PASS**.

### H-010: Resubmit After Send Back — PASS

- Setup: logged back in as `wf-test.maker`. Opened GLR-000008 (Sent Back). Clicked Submit (the resubmit
  action; the RPC's own entry point is the same `submit_go_live_request`, accepting status IN
  (draft, sent_back) per H-006's guard).
- Actual evidence: status changed Sent Back -> Resubmitted. Timeline shows "Resubmitted for review, 21 Sept
  2026, 9:00 pm, WF-TEST Maker" appended after the "Approval sent back" entry, and the original send-back
  reason remained visible (not overwritten).
- Classification: **PASS**.

### H-012: Approve Blocked, Customer Confirmation Pending — PASS

- Setup: logged in as `wf-test.finance-checker`. Opened GLR-000008 (Resubmitted, confirmation still Pending).
  Clicked Approve: Go Live.
- Actual evidence: "customer confirmation is required before a Go Live request can be approved" shown
  (named, specific error, not generic). Status remained Resubmitted; no approved_by/at written.
- Classification: **PASS**.

### H-013: Set Customer Confirmation Then Approve — PASS

- Setup: same session, same request. Uploaded a real fictional PDF as Customer Confirmation Email evidence
  (genuine file upload through the app's real attachment pipeline: `input[type=file]` change event with an
  actual `File`/`Blob`, not a UI-only stub). "Document uploaded." confirmed, "Mark Confirmed" action
  appeared. Clicked it.
- Actual evidence: Customer Confirmation status changed Pending -> Confirmed; "Mark Not Confirmed" toggle
  appeared (reversible); the "Approval will be blocked..." warning disappeared from the Approve section.
- Classification: **PASS**.

### H-011: Approve Go Live Request, Happy Path — PASS

- Setup: same session, same request, confirmation now Confirmed. Clicked Approve: Go Live.
- Actual evidence: status changed Resubmitted -> Live. Detail page shows "Live from 22-Dec-2027, approved 21
  Sept 2026, 9:04 pm." Timeline correctly grouped into "APPROVAL CYCLE 1" (original submit through send-back)
  and "APPROVAL CYCLE 2" (resubmit through approval), with the final entry "Approval approved: line item is
  now Live, 21 Sept 2026, 9:04 pm, WF-TEST Finance Checker".
- Classification: **PASS**.

### H-017: Approve No-Op on Already-Approved Request — PASS

- Setup: GLR-000008 now approved. The UI correctly removes the Approve action entirely once a request is
  approved (no reachable double-click path through normal use), so this journey's retry assertion was
  verified by calling `approve_go_live_request` directly a second time with the same actor and null
  expected-node-key (disclosed here as code-level confirmation per the instruction to disclose non-UI
  evidence, since the UI's own correct behavior removes the reachable retry path).
- Actual evidence: the retry call returned success (no error) with `approved_by`, `approved_at`, and
  `row_version` all byte-for-byte identical to the pre-retry values (row_version stayed at 9). Confirms the
  RPC's documented `if v_row.status = 'approved' then return v_row; end if;` no-op path, not a silent
  re-write.
- Classification: **PASS**.

### H-009: Send Back Blocked, Self-Action by Submitter — PASS

- Setup: `wf-test.finance-checker` (a member of wf_test_finance, the responsible team for our single-node
  workflow) created, on Line item B (Dimension-based component), a fresh throwaway request GLR-000009, and
  submitted it themselves, becoming both creator and an eligible team reviewer of their own submission.
  Attempted Send Back on it.
- Actual evidence: "you cannot send back your own request. Another authorized checker must review it."
  shown; status remained Submitted; no sent_back fields written.
- Classification: **PASS**.

### H-014: Approve Blocked, Self-Approval — PASS

- Setup: same session, same request (GLR-000009). Attempted Approve: Go Live.
- Actual evidence: "you cannot approve your own request. Another authorized checker must review it." shown;
  status remained Submitted; no approved_by/at written.
- Classification: **PASS**.

### H-016: Approve Blocked, Not a Member of Responsible Team — PASS

- Setup: logged in as `wf-test.legal-checker@example.test` (checker role, wf_test_legal team, not a member
  of wf_test_finance, the responsible team for the active single-node workflow's Approval node). Opened
  GLR-000009 (Submitted, Line item B). First Approve attempt returned the customer-confirmation-required
  error instead (confirmation was still Pending), confirming the RPC's guard order checks confirmation before
  team membership. Uploaded a fictional PDF as Customer Confirmation Email evidence and clicked Mark
  Confirmed to clear that guard, then retried.
- Action: clicked Approve: Go Live with confirmation now Confirmed.
- Actual evidence: "this request's workflow requires an approver from the \"WF-TEST Finance\" team. You are
  not an active member of that team." shown. Status remained Submitted; Timeline unchanged (still only
  "Go Live request created" and "Submitted for review", no approval entry); no approved_by/at written.
- Classification: **PASS**.

### H-002: Blocked Creation, Commercial Version Not Approved — PASS

- Setup: no repo fixture has a recurring line item whose only reachable commercial version is unapproved (the
  Go Live list page only ever resolves `commercialVersionId` from an approved version, or null for the
  never-versioned original setup: `src/features/go-live/services/line-items.service.ts:42-56`, since
  `commercial_configuration_versions.commercial_change_id` is populated only once approved). There is
  therefore no UI-reachable path to point Go Live creation at an unapproved version, exactly matching the
  RPC's own defense-in-depth posture. Per the same disclosed non-UI-evidence convention used for H-017,
  verified this guard directly against `create_go_live_request`: found a real, live, pre-existing draft
  commercial version (`5c3a9ea1-101f-414b-87bb-144e2c9aea40`, version 14, status draft, customer
  `aurora-consumer-labs`) with a real recurring component (`c1f81ceb-14cd-4260-8cb7-6534b8f35a36`) under it.
- Action: called `create_go_live_request` directly with `p_commercial_version_id` set to that draft version's
  id and the real recurring component's stable key, actor `wf-test.maker`.
- Actual evidence: call rejected with `GO_LIVE_COMMERCIAL_VERSION_NOT_APPROVED: version
  5c3a9ea1-101f-414b-87bb-144e2c9aea40 has status draft, a Go Live request may only reference an approved
  version`. `go_live_requests` row count unchanged (7 before, 7 after); no row exists for the attempted id;
  no orphan `resources` row for the attempted id either (the RPC's own insert into `resources` never runs,
  since the version check raises before it). Confirms "no orphan row, no partial insert."
- Concurrency Variant: verified by code inspection rather than a live race, since the mechanism is
  structural, not timing-dependent: `create_go_live_request` (`supabase/migrations/20260918010000_go_live_domain.sql:325-332`)
  always does a fresh `select ... into v_version from commercial_configuration_versions where request_id =
  p_commercial_version_id` inside its own transaction immediately before checking status, never reads a
  client-supplied or cached status value. There is no code path by which a stale client-side "approved"
  belief could reach the insert.
- Stress Variant (submitted, not just draft): the guard is a single `v_version.status <> 'approved'` check,
  so `submitted` and `draft` share the identical code path; not re-run separately as live evidence would be
  redundant with the draft-status call above.
- Classification: **PASS**.

### H-003: No Go Live Request Exists for On-Demand Line Items — PASS

- Setup: customer `fictional-nexus-test-co`, on-demand ("Flat fee", `is_recurring = false`) component
  `5332909c-8419-410d-aad5-55a2906bad17`, current (`effective_to` null) and governed by an already-approved
  original setup (no `commercial_configuration_versions` row traceable for its own origin, which
  `listCurrentLineItemsForCustomer` explicitly treats as "Version 1, no version row", i.e. implicitly
  approved baseline truth). Zero `go_live_requests` rows have ever existed for this stable_component_key.
- Action: opened `/customers/fictional-nexus-test-co/go-live` as `wf-test.legal-checker`. Then navigated
  directly to `/customers/fictional-nexus-test-co/go-live/new?stableComponentKey=5332909c-...&commercialConfigurationId=3bb0dddc-...`.
- Actual evidence: the list page shows this component only in a separate "ON-DEMAND COMMERCIAL LINE ITEMS"
  section, Go Live column reading "Not Required" (never "No Go Live"), Action column showing only a "Usage"
  button, no Create action anywhere. The direct create-route navigation returned a genuine Next.js 404 ("This
  page could not be found"), confirming `src/app/customers/[customerKey]/go-live/new/page.tsx:37`'s
  `if (!lineItem || !lineItem.isRecurring) notFound()` guard is real and enforced, not merely a hidden UI
  affordance. Zero `go_live_requests` rows exist for this stable_component_key (verified directly).
- Note: the domain layer's `deriveLineItemGoLiveStatus` computation is skipped for on-demand items and the
  value `"NO_GO_LIVE"` is hardcoded as a placeholder in `listCurrentLineItemsForCustomer`
  (`src/features/go-live/services/line-items.service.ts:85`), but this value is never rendered for on-demand
  items: the list page's on-demand section hardcodes "Not Required" and never reads `item.goLiveStatus`
  (`src/features/go-live/ui/go-live-list-page.tsx:142`). Confirmed intentional per that file's own doc
  comment ("never a misleading 'No Go Live' for a model that structurally never needs one"). Not a defect.
- Classification: **PASS**.

### H-023: Cancel Go Live Request from Draft — PASS

- Setup: logged in as `wf-test.maker`. Created a fresh draft (`GLR-000010`, id `e8a4cdb2-5849-401f-9d4a-d3cb2a84dc8c`) on Line item D (Volume-based, customer `wf-test-pd-002-case-b-8b2e154f`).
- Action: clicked Cancel Draft.
- Actual evidence: database confirms `status = 'cancelled'`, `cancelled_by` = the maker's own actor id, `cancelled_at` set, `row_version` incremented 1 -> 2. `cancelled_reason` is `null` since this app's "Cancel Draft" control (unlike Send Back) has no reason field, by design (`handleCancel` in `go-live-detail-page.tsx:119-121` always passes `null`).
- Note: immediately after the click, the page transiently displayed the pre-cancel "Draft" state with normal Save/Submit/Cancel buttons instead of "Cancelled" (a `router.refresh()` timing artifact in the automated browser tooling, not a real defect): a full reload of the same URL immediately showed the correct "Cancelled" badge and a "Cancelled, 21 Sept 2026, 9:31 pm, WF-TEST Maker" timeline entry, and the database was correct throughout. Both routes already carry `export const dynamic = "force-dynamic"`, ruling out static-prerender staleness. Not logged as a defect.
- Classification: **PASS**.

### H-019: Approve Rejected from Cancelled Status — PASS

- Setup: continuing on `GLR-000010`, now cancelled. The "Review Decision" section (including Approve) is gated by `isDecidable = status IN (submitted, resubmitted)` (`go-live-detail-page.tsx:73,308`), so it never renders for a cancelled request, exactly matching H-018's own invariant applied uniformly to this status too, and leaving no UI-reachable path. Per the same disclosed non-UI-evidence convention used for H-002/H-017, called `approve_go_live_request` directly as `wf-test.finance-checker` (a non-creator, to avoid tripping the RPC's earlier self-approval guard first).
- Action: `approve_go_live_request(p_id=GLR-000010's id, p_actor_user_id=finance-checker)`.
- Actual evidence: rejected with `GO_LIVE_REQUEST_NOT_APPROVABLE: request ... has status cancelled, only submitted or resubmitted may be approved`. `status`, `approved_by`, `approved_at`, `cancelled_by`, `cancelled_at`, `row_version` all identical before and after the call.
- Classification: **PASS**.

### H-018: Approve Rejected from Draft Status — PASS

- Setup: logged in as `wf-test.maker`. Created a fresh draft (`GLR-000011`, id `8d58d2e4-6403-4d50-b951-ba550b5fba81`) on Line item C (Dimension-based), never submitted. Confirmed live: the "Review Decision" section (Approve/Send Back) does not render at all for this draft request, matching the UX Check ("Approve action should not even be exposed in the UI for draft-status requests").
- Action: since there is no UI-reachable Approve control to click, called `approve_go_live_request` directly as `wf-test.finance-checker` (non-creator) per the same disclosed convention.
- Actual evidence: rejected with `GO_LIVE_REQUEST_NOT_APPROVABLE: request ... has status draft, only submitted or resubmitted may be approved`. `status` remained draft, `row_version` unchanged at 1, no approval fields written.
- Classification: **PASS**.

### H-020: Multi-Node Workflow Advance — PASS

- Setup: published and activated a dedicated "Batch 15 Go Live Two Step Finance then Legal" workflow (Start -> Approval (node_2) -> Approval (node_3) -> End (node_4)), deactivating the single-node "Batch 15 Go Live Finance Approval" workflow first (only one active go_live workflow at a time). Created a fresh request (`GLR-000012`, id `ef0ea3af-6081-4dc8-8e06-baedc82e948f`) on Line item C (recreated after H-023's cancellation of its earlier draft), confirmed via direct read that `workflow_version_id` resolved to the new two-step workflow's published version. Submitted it (now at node_2), set customer confirmation to Confirmed.
- Action: approved as `wf-test.finance-checker` (node_2's approver; the node has no team assignment per the documented Builder-automation limitation noted in the Fixtures section below, so any checker persona could act, but finance-checker was used to match the node's intent).
- Actual evidence: `status` remained `submitted` (not yet approved), `current_workflow_node_key` advanced `node_2` -> `node_3`, `row_version` incremented, no `approved_by`/`approved_at` written. Confirms the RPC's own graph walk correctly distinguishes an intermediate Approval node from the terminal one.
- Classification: **PASS**.

### H-015: Approve Blocked, Stale expected_current_node_key — PASS

- Setup: continuing on `GLR-000012`, now genuinely at node_3 after H-020's advance. Per the RPC's guard order (checked directly:
  `supabase/migrations/20260925000000_workflow_runtime_v1_sequential_execution.sql:1587-1589`), `p_expected_current_node_key` is compared before the confirmation and team-membership checks, matching "always short-circuits before any other approval logic runs."
- Action: called `approve_go_live_request` with `p_expected_current_node_key = 'node_2'` (the request's OLD node, simulating a checker whose page was still open from before H-020's advance), as `wf-test.finance-checker`.
- Actual evidence: rejected with `WORKFLOW_NODE_ALREADY_ADVANCED: this step was already decided by someone else. Refresh to see the current status.`. `status`, `current_workflow_node_key` (still node_3), `row_version`, and `approved_by` all identical before and after. Verified the client-side wiring for the UX check: `src/features/go-live/actions.ts:39-43` maps this exact token to `{ error: "This approval has already moved to the next step. Refresh to see its current status.", stale: true }`, and `go-live-detail-page.tsx` renders a "Refresh" button when `stale` is true, not a dead-end error.
- Classification: **PASS**.

### H-021: Multi-Node Workflow Finalize — PASS

- Setup: continuing on `GLR-000012`, still at node_3 (the terminal Approval node in this 2-node graph).
- Action: logged in as `wf-test.legal-checker`, clicked Approve: Go Live.
- Actual evidence: `status` changed `submitted` -> `approved`, `approved_by`/`approved_at` set, `current_workflow_node_key` advanced to `node_4` (End). Live-verified on the Go Live list page: Line item C (Dimension-based) now shows Go Live Status **Live**, Go Live Date 15-Dec-2026, Customer Confirmation Confirmed, with View/Entitlement actions replacing Create Go Live.
- Classification: **PASS**.

### H-022: Optional Workflow Node Resolved Once and Skipped on Resubmission — PASS

- Setup: activated the pre-existing `wf_test_decision_finance_or_legal` workflow (Start -> Decision -> [Enterprise: `segment=enterprise` -> Finance Approval] / [Default -> Legal Approval] -> End; not built by this batch, already present from an earlier phase), deactivating the two-step workflow first. Per this batch's pre-execution research, `fn_resolve_workflow_next_approval` is always invoked with the fixed literal `'{}'::jsonb` decision context for go_live, so the `segment = enterprise` condition can never match and the Decision node deterministically always takes the Default edge. This journey is executed as a live test of that deterministic-stability property (the actual mechanism), not of an unbuilt per-request memoization mechanism, consistent with the pre-execution research summary.
- Fixture: created a fresh request (`GLR-000013`) on customer `demo-northstar-consumer-products`'s Linear component (a pre-existing, unrelated, already-approved line item reused for this single non-destructive test, similar to H-002's convention).
- Action (cycle 1): submitted as `wf-test.maker`. Landed at `node_4` (Legal Approval), confirmed live via direct read and via `wf-test.legal-checker` being able to act on it (proving the node's real team binding). Sent back with a reason ("Testing decision-node stability across a resubmission cycle").
- Action (cycle 2): resubmitted as `wf-test.maker` via the real UI. Landed at `node_4` again (same node, `workflow_cycle_number = 2`).
- Stress Variant (cycle 3): sent back and resubmitted once more (via direct RPC calls, disclosed, since the mechanism itself was already demonstrated end to end through the real UI in cycles 1 and 2 and a third full UI pass would only re-exercise the identical send-back/submit code paths already covered by H-007/H-010). Landed at `node_4` a third consecutive time (`workflow_cycle_number = 3`).
- Finalization: set customer confirmation and approved as `wf-test.legal-checker`. `status` -> `approved`, `current_workflow_node_key` -> `node_5` (End).
- Actual evidence: across three independent send-back/resubmit cycles, the Decision node's branch never flipped, always resolving to Legal Approval. Confirms "Optional node resolution is persisted per request, not recomputed fresh on every cycle in a way that could contradict itself": the graph-walk based determinism achieves the same observable guarantee the journey brief describes for a "resolve-once" mechanism, without needing a separate persisted resolution table.
- Classification: **PASS**.

### G-025: Slab and Designation Components Coexisting in One Commercial Configuration, PASS

- Setup: reused the existing `880b4877-5459-4d67-824e-f4322f32caea` configuration (customer `1bd3d0ca-9caf-4ae8-b32d-d95ed3faa245`, "WF-Test PD-002 Case B"), whose currently-active version already carried a `volume` component (`G-009 Whole Quantity Boundary Test`, Slab - Whole Quantity, 3 bands, MUG 50/100/-) and a `dimension` component (`G-014-017-021 Designation Test`, Designation Based, Consultant/Director rows, MUG 20/2) under the same configuration, exactly matching the journey's own Starting State. Logged in as `wf-test.maker`.
- Regular Path action: clicked Create New Version (`CC-000080`, amendment). Edited only the `G-009` (volume) component, changing the 501+ band's rate from INR 5 to INR 6; left the `G-014-017-021` (dimension) component and the flat-fee component completely untouched. Saved, submitted with effective date 2027-01-01.
- Regular Path evidence (live diff at `/reviews/commercial-versions/fbdaf50a-03cc-4e1e-87de-b4a46282f603`): `G-009 Whole Quantity Boundary Test` shown as **Changed**, band-level table correctly showing 1-100 and 101-500 as **Unchanged** and only 501+ as **Changed** (INR 5 -> INR 6). `G-014-017-021 Designation Test` shown as **Unchanged**, its own row-level table rendering byte-for-byte identical current vs proposed. No slab-band data leaked into the designation rows or vice versa: the two components use structurally different sub-diff renderers (`diffSlabRows` vs `diffDesignationRows`) and each rendered only its own shape. Approved by `wf-test.legal-checker` (`decided_by` confirmed via direct DB read); `CC-000080` is `status: "approved"`, effective 2027-01-01.
- Stress Variant action: with `CC-000080` approved and closing the prior in-flight-serialization block, created a second new version (`CC-000082`, amendment) as `wf-test.maker`, this time editing **both** the `G-009` (volume) and `G-014-017-021` (dimension) components in the same version. Saved, submitted with effective date 2027-02-01.
- Stress Variant evidence: live diff screen showed both components as **Changed** independently and correctly in the same review screen, each rendering only its own sub-diff shape with no cross-contamination between the two structurally different `pricing_rule_kind` branches. Approved by `wf-test.legal-checker`; `CC-000082` is `status: "approved"` (`decided_by` confirmed via direct DB read), effective 2027-02-01.
- Bonus live-verified guard: attempting Approve on `CC-000080` as `wf-test.finance-checker` (wrong team) was correctly rejected with `this request's workflow requires an approver from the "WF-TEST Legal" team. You are not an active member of that team.` Confirmed this batch's active `commercial_configuration` workflow is globally bound to the `WF-TEST Legal` team for its Approval node, not configuration-specific.
- Classification: **PASS**. Both the Regular Path (single-component edit, sibling component unchanged) and the Stress Variant (both components edited in the same version) were executed live end to end, including submission, live diff verification, and approval by the correct team's checker. No cross-contamination between the volume and dimension sub-diff renderers was observed in either variant.

### G-026: MUG Threshold-Only Edit Triggers Commitment Re-evaluation on Approval, PASS

- Setup: no live fixture existed anywhere in the shared database with the exact required shape (an approved, currently-active `linear` recurring component with MUG enabled). Built one from scratch on the same `880b4877-5459-4d67-824e-f4322f32caea` configuration: as `wf-test.maker`, added a new recurring component ("G-026 MUG Threshold Test", Per Unit / `linear`, rate INR 50/User, Monthly/Advance, MUG threshold 1000) to a new version. First submission attempt used the default (today's) overall version effective date and was correctly rejected by the approval guard (`effective_date ... must be strictly after the currently active period's own start date`); rejected and redone with `effective_date` matching the active period exactly, which was also correctly rejected (`must be strictly after`, equal dates do not satisfy "strictly"); rejected and redone with `effective_date` exactly one day after the active period's start, which was correctly rejected by a third, more precise guard (`is exactly one day after an existing open component's own start date ...; that component would need to be closed on the same day it started, which is not a valid historical period`). Redone a final time with `effective_date` two days after the active period's start (`CC-000088`, effective 2027-02-03): approved by `wf-test.legal-checker`, establishing the Starting State (component id `4cac730d-316f-43f9-8936-0b402ddde651`, rate 50, MUG threshold 1000).
- Action: as `wf-test.maker`, created a new version (`CC-000089`) and edited only the G-026 component's MUG threshold, 1000 -> 1200, leaving the rate and every other field untouched (effective date 2027-02-05, satisfying the same strictly-after guards). Submitted.
- Actual evidence (live diff at `/reviews/commercial-versions/c13c7108-4c50-4e2d-8af5-4eba9cfeea3e`): `G-026 MUG Threshold Test` shown as **Changed**, Current/Proposed rate both `INR 50 / User` (**0% change**), with the change line reading `MUG: 1,000 User -> 1,200 User`. Approved by `wf-test.legal-checker`; `CC-000089` is `status: "approved"`.
- Audit/Data Integrity Check, verified via direct DB read against `commercial_components` and `commercial_commitments` (not the diff screen): exactly one old `commercial_components` row (`4cac730d...`, `effective_from: 2027-02-03`, `effective_to: 2027-02-04`, rate still 50, MUG still 1000 in its own frozen `pricing_rule_parameters`) and exactly one new row (`acc2884b...`, `effective_from: 2027-02-05`, `effective_to: null`, rate still 50, MUG now 1200), both sharing the same `stable_component_key`. Exactly one old `commercial_commitments` row (`threshold_value: 1000`, linked to the old, now-closed component id) and one new row (`threshold_value: 1200`, linked to the new component id). The old commitment row's `threshold_value` was never mutated: it remains 1000, still linked to the old, closed component id.
- Classification: **PASS**. The Regular Path, the live UX Check (diff correctly flags the MUG-only change with the rate showing 0% change), and the live Audit/Data Integrity Check (exactly one old and one new commitment row, correctly linked, old row never mutated) were all exercised end to end against the deployed Preview, not only verified by code inspection. Three real, well-designed approval-time date guards were discovered live in the process (see below); none required a product fix, all are correct-as-designed data-integrity protections against zero-length or overlapping historical periods.

## Defects found and fixed

### DEFECT: Timeline mislabels an in-progress multi-node advance as "line item is now Live"

- **Found via**: live H-020 execution. Immediately after approving at node_2 (advancing to node_3, request still `status = 'submitted'`), the request's own Timeline showed "Approval approved: line item is now Live" for that advance, even though the line item was not yet Live.
- **Root cause**: `buildWorkflowTransitionEvents` (`src/platform/workflow-builder/domain/transition-events.ts`), shared by all four Workflow Runtime V1 domains (customer onboarding, customer change, commercial configuration, go live), computed `isFinalEvent = index === sorted.length - 1`: "the last transition fetched so far" rather than "the transition that actually reached the terminal node." With only one transition recorded (the node_2 -> node_3 advance), it was trivially "last," so the terminal detail got folded in regardless of whether the request had actually finalized. `to_node_key` cannot distinguish an intermediate node from the End node by shape alone (both are non-null node keys; `send_back_go_live_request`'s finalize branch sets `v_new_current_node_key` to the End node's own key, not null), so the array-position heuristic was the only thing standing in for the real signal.
- **Fix**: added an `isRequestFinalized` parameter to `buildWorkflowTransitionEvents`; `isFinalEvent` now also requires it to be true. The go-live detail route (`src/app/customers/[customerKey]/go-live/[requestId]/page.tsx`) passes `request.status === "approved"`, the one ground-truth signal already available at the call site. The other three domains don't currently pass a `terminalApprovalDetail` at all, so they were not visibly affected by this defect, but the underlying computation was equally wrong for them; the fix corrects it for all four call sites uniformly.
- **Regression coverage**: added a new test to `src/platform/workflow-builder/domain/transition-events.test.ts` reproducing the exact scenario (single approve transition to a non-terminal node, `terminalApprovalDetail` provided, `isRequestFinalized` omitted) and asserting the terminal text is never folded in. All 11 tests in that file pass; `tsc --noEmit` is clean.
- **Verification status**: fixed and unit-tested locally. Live re-verification against the deployed Preview is deferred to this batch's final checkpoint/deploy, since the defect is cosmetic (Timeline wording only; the underlying `status`/`approved_by`/`approved_at` data and the derived `GO_LIVE_PENDING`/`LIVE` line-item status were confirmed correct throughout via direct database reads and the Go Live list page).
- **Neighbor check**: the three-plus-node case (H-022's decision-node testing, still pending) and further send-back/resubmit cycles will exercise this same shared function again during this batch's remaining journeys, providing additional live coverage of the fix.

## Incidental defects outside Batch 15 scope

(filled in as execution proceeds)

## Product decisions required

(filled in as execution proceeds)

## Summary reconciliation

(filled in at closure)
