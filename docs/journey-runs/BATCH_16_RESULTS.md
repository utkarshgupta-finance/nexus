# Batch 16 Results: H-024 through H-043, I-001 through I-005 (Go Live completion + Entitlement start)

Starting SHA: `ffaf1a9`. Scheduled journeys: 25 (H-024-H-043, I-001-I-005).

## Pre-execution research summary

Code/schema investigation completed before any journey execution began.

- `cancel_go_live_request` (`supabase/migrations/20260918010000_go_live_domain.sql:533`): guard order is
  status check (`status not in ('draft','sent_back')` raises `GO_LIVE_REQUEST_NOT_CANCELLABLE`) then
  ownership check (`created_by is distinct from actor` raises `GO_LIVE_REQUEST_CANCEL_NOT_OWNER`). Confirms
  the allowed-status set is exactly `(draft, sent_back)`, matching H-024/H-025/H-026/H-027's premises exactly.
- `deriveLineItemGoLiveStatus` (`src/features/go-live/domain/types.ts:82-87`): a lone `draft` row (any
  non-cancelled, non-approved status) returns `GO_LIVE_PENDING`, not `NO_GO_LIVE`. This is the exact same
  behavior Batch 15's H-001 already investigated and settled as **intentional, documented design**
  (`docs/GO_LIVE_ENTITLEMENT_ARCHITECTURE.md` §6.1: "a non-cancelled request exists but none is approved,"
  which by design includes draft). H-032's own Regular Path and Expected Technical Invariants explicitly
  assert the opposite ("draft does not advance off NO_GO_LIVE"), so H-032 is expected to reproduce the same
  already-settled finding, not a new defect. Flagged here in advance so its execution below reads as
  confirmation, not discovery.
- `entitlement_ledger_foundation` (20260919010000) and its dependents are confirmed **applied** to the
  shared remote database (`supabase list_migrations`), despite the migration file's own stale
  authoring-time comment ("has not been applied to any database as of authoring"). The Entitlement domain
  (`src/features/entitlement/`) has real UI, services, and RPCs already built from earlier phase work; I-pack
  journeys exercise existing infrastructure, not a blank slate.
- `create_entitlement_source` (`entitlement_ledger_foundation.sql:361`): no check of any kind against
  `go_live_requests`. Confirms I-001's invariant directly.
- `generate_allocation_schedule` RPC persists an already-computed `p_monthly_quantities` array; the anchor
  decision itself lives in TypeScript. `previewAllocationSchedule`
  (`src/features/entitlement/services/entitlement.service.ts:79-95`) anchors a new period at
  `input.goLiveMonth` (never invoice date); the UI derives `goLiveMonth` strictly from
  `lineItem.currentRequest.goLiveDate` when `status === "approved"`
  (`src/features/entitlement/ui/entitlement-detail-page.tsx:498`). Confirms I-005's invariant directly.
- `go_live_requests` (`go_live_domain.sql:150-160`): has `trg_go_live_requests_updated_at`,
  `trg_audit_go_live_requests`, and (from `optimistic_locking_extension.sql`)
  `trg_go_live_requests_row_version`. Grepped every migration for a `fn_protect_go_live_requests_lifecycle`-
  style BEFORE-UPDATE guard trigger (the pattern `fn_protect_customer_lifecycle` and
  `fn_protect_commercial_component_lifecycle` use) and for any RLS policy on the table: neither exists. RLS is
  enabled with zero policies, meaning anon/authenticated roles are default-denied, but this does not stop a
  `service_role` or superuser connection the way a BEFORE-UPDATE trigger would. This confirms H-043's premise
  live via direct migration inspection, exactly as the journey's own notes instruct rather than assuming.
- `go_live_requests.request_number` (`go_live_domain.sql:117-121`): sequence-backed default, but **no
  explicit unique index**, unlike the sibling `customer_change_requests.request_number`
  (`human_friendly_request_ids.sql:32`, which has `create unique index idx_customer_change_requests_request_number`).
  Flagged as a candidate incidental gap for H-039 to confirm live.
- `approve`/`send_back` actions (`src/features/go-live/actions.ts:90,101`) call
  `requirePermission("go_live", "approve")` at the application layer before ever reaching the RPC's own
  workflow-graph-driven guard chain, confirming H-038's premise: the permission string is fixed in code,
  independent of graph configuration.
- Go-live document upload (`src/features/go-live/services/documents.service.ts`) reuses
  `validateAttachmentFile` from `customer-onboarding/domain/documents.ts` unchanged, confirming H-036/H-037's
  shared-policy invariant. Uploading a second document of the same `documentType` calls
  `supersedeCurrentDocuments` (marks the prior row `is_current = false`) then inserts a new row: same-type
  reupload creates a new row rather than overwriting, and the prior version remains individually queryable.
- `prorate_first_month` is only ever written by `create_go_live_request` and `save_go_live_request_draft`
  (`go_live_domain.sql:346,388`); grepped `submit_go_live_request`, `send_back_go_live_request`,
  `approve_go_live_request` bodies for any reference to this column and found none, confirming H-042's
  invariant.

## Personas and fixtures

Reusing Batch 15's established personas: `wf-test.maker@example.test` (creator), `wf-test.finance-checker@example.test`
(checker, wf_test_finance team, full `go_live.*`), `wf-test.legal-checker@example.test` (checker, wf_test_legal
team), `wf-test.workflow-admin@example.test` (workflow admin, no approval rights). Shared throwaway password
`Batch15-Temp-Pw-9f3a2c` (test-infrastructure credential, not sensitive). New fixtures created as needed per
journey below.

## Journey log

### H-024: Cancel Go Live Request from Sent Back — PASS

- Setup: created a fresh draft on the "Linear" line item (customer `wf-test-pd-002-case-b-8b2e154f`, a
  previously untouched recurring component), `GLR-000014`, go_live_date 2027-03-01. Submitted as
  `wf-test.maker`. Sent back as `wf-test.legal-checker` (this go-live workflow binding routes to the Legal
  team; confirmed by a `WORKFLOW_TEAM_REQUIRED` rejection when first attempted as finance-checker).
- Action: logged in as `wf-test.maker` (the creator), clicked "Cancel Draft" on the now-`sent_back` request.
- Actual evidence: request transitioned `sent_back` -> `cancelled` live. Timeline shows both the prior "Legal
  Approval sent back" entry (with its original reason preserved) and the new "Cancelled" entry side by side,
  confirming the prior reason remains visible alongside the new cancellation (Audit/Data Integrity Check).
  Note: the UI's Cancel Draft control does not itself prompt for a reason, so `cancelled_reason` was left
  null; this is consistent with the journey's own definition, which requires no reason capture for cancel.
- Classification: **PASS**.

### H-025: Cancel Rejected from Submitted Status — PASS

- Setup: continuing on `GLR-000014`, now `submitted` (after H-024's own earlier submit step, before its
  send-back).
- Action: live-verified the UX Check first: once submitted, the "Cancel Draft" button itself disappears from
  the page for the creator. Then called `cancel_go_live_request` directly as the creator to confirm the
  server-side guard, since the UI control is no longer present to click.
- Actual evidence: RPC rejected with `GO_LIVE_REQUEST_NOT_CANCELLABLE: request ... has status submitted, only
  a draft or sent-back request may be cancelled`. Status, row_version, and cancellation fields all unchanged
  before/after.
- Classification: **PASS**.

### H-026: Cancel Rejected from Approved Status — PASS

- Setup: reused `GLR-000012` from Batch 15 (already `approved`, Live, created by `wf-test.maker`).
- Action: called `cancel_go_live_request` as the creator on the approved request; also live-verified the UI
  shows no Cancel control anywhere on the approved request's own detail page, even to its creator.
- Actual evidence: RPC rejected with `GO_LIVE_REQUEST_NOT_CANCELLABLE: request ... has status approved, only a
  draft or sent-back request may be cancelled`. `approved_by`/`approved_at` unchanged; the request's own
  historical Live fact is undisturbed.
- Classification: **PASS**.

### H-027: Cancel Rejected, Non-Creator Attempt — FAILED THEN FIXED + PASS

- Setup: created `GLR-000015` (a fresh draft on the same Linear line item, now-recoverable after H-024's
  cancellation) as `wf-test.maker`.
- Action: attempted `cancel_go_live_request` as `wf-test.finance-checker` (a different user, not the
  creator, holding full `go_live.*`).
- Original failure (manual UX): the RPC-level cancel attempt was correctly rejected
  (`GO_LIVE_REQUEST_CANCEL_NOT_OWNER`), but live-checking the UX Check ("Cancel action is hidden in the UI for
  non-creators") surfaced a real defect: logging in as `wf-test.finance-checker` and opening the same draft's
  detail page showed fully enabled "Save Draft", "Submit", and "Cancel Draft" controls, none of them gated on
  creator identity. Investigation found `save_go_live_request_draft` and `submit_go_live_request` never
  checked `created_by` at all (only `cancel_go_live_request` did), and the UI component
  (`go-live-detail-page.tsx`) only ever received a blanket `canSubmit`/`canApprove` permission flag, never
  the caller's own identity, so it had no way to know it wasn't rendering the creator's own draft.
- Root cause and fix: this is the exact same gap already found and fixed for Customer Onboarding
  (`20260930050000_onboarding_draft_save_submit_creator_only.sql`, PD-001). Added
  `20260930200000_go_live_draft_save_submit_creator_only.sql`, mirroring that pattern exactly:
  `save_go_live_request_draft` now rejects with `GO_LIVE_DRAFT_SAVE_NOT_OWNER` and `submit_go_live_request`
  with `GO_LIVE_REQUEST_SUBMIT_NOT_OWNER` when `created_by is distinct from` the actor, ordered after the
  status guard and before the row-version/workflow-graph logic, matching `cancel_go_live_request`'s own guard
  order. Also updated `src/app/customers/[customerKey]/go-live/[requestId]/page.tsx` to compute
  `isCreator = session.appUserId === request.createdBy` server-side and pass it to `GoLiveDetailPage`, which
  now gates the Go Live Date/Prorate inputs and the Save Draft/Submit/Cancel Draft controls on
  `canManageDraft = isEditable && isCreator` instead of `isEditable` alone.
- Migration applied: `supabase db push --linked` (user-authorized live, per the shared-database rule) after
  the auto-mode classifier correctly blocked the first unauthorized attempt.
- Retest: re-ran the same RPC calls as `wf-test.finance-checker` against the deployed migration:
  `save_go_live_request_draft` -> `GO_LIVE_DRAFT_SAVE_NOT_OWNER`; `submit_go_live_request` ->
  `GO_LIVE_REQUEST_SUBMIT_NOT_OWNER`. Confirmed the legitimate creator path is unaffected: `wf-test.maker`
  successfully submitted `GLR-000015` after the fix, live, through the real UI. UI-side re-verification
  (control visibility for a non-creator) is deferred to this batch's final deploy-verify checkpoint, same
  disclosure pattern Batch 15 used for its own Timeline defect.
- Regression coverage: pending (added during this batch's defect-fix pass, see below).
- Classification: **FAILED THEN FIXED + PASS**. The RPC-level cancel guard this journey's Regular Path names
  was correct from the first attempt; the journey's own UX Check (hidden in the UI for non-creators) failed
  on the first attempt for the adjacent Save/Submit controls and is now fixed.

### H-028: Future-Dated go_live_date Approved Immediately Derives LIVE — PASS

- Setup: continuing on `GLR-000015`, go_live_date set to 2027-09-01 (about a year after this session's
  current date). Submitted (as maker), customer confirmation set to confirmed, approved (as
  `wf-test.legal-checker`).
- Actual evidence: live on the Go Live list page, the Linear line item shows Go Live Status **Live**, Go Live
  Date **01-Sep-2027**, immediately after approval, with no distinct "scheduled" or "pending future
  activation" state anywhere in the UI. Confirmed no cron/scheduled-job mechanism exists in the codebase
  (grepped for one during pre-execution research; none found) and `deriveLineItemGoLiveStatus` depends solely
  on `status`, never a date comparison.
- Classification: **PASS**.

### H-029: All Requests for a Line Item Cancelled Derives CANCELLED Status — PASS

- Setup: continuing on the Linear line item immediately after H-024's cancellation of `GLR-000014` (its only
  go_live_requests row at that point).
- Actual evidence: the Go Live list page showed Go Live Status **Cancelled** for Linear (distinct from "No Go
  Live"), with the "Create Go Live" action still present.
- Classification: **PASS**.

### H-030: New Go Live Request Created After Prior Cancellation — PASS

- Setup: continuing directly from H-029's cancelled state.
- Action: clicked "Create Go Live" for the Linear line item again, as `wf-test.maker`.
- Actual evidence: `GLR-000015` created successfully for the identical `stable_component_key`, no block or
  error of any kind. The line item's history now shows both the cancelled `GLR-000014` and the new active
  `GLR-000015`.
- Classification: **PASS**.

### H-032: Draft-Only Request Does Not Advance Line Item Off NO_GO_LIVE — EXPECTED BEHAVIOUR

- Setup: created `GLR-000014` as a fresh draft on the Linear line item (zero prior go_live_requests rows).
- Actual evidence: the Go Live list page showed Go Live Status **Pending** for Linear immediately after draft
  creation, not "No Go Live" as this journey's own Regular Path and Expected Technical Invariants literally
  state.
- Reconciliation: this is not a new defect. `deriveLineItemGoLiveStatus`
  (`src/features/go-live/domain/types.ts:82-87`) returns `GO_LIVE_PENDING` for any non-cancelled,
  non-approved request, which by design includes `draft`. This exact discrepancy between the journey
  brief's assumption and the actual, already-documented architecture
  (`docs/GO_LIVE_ENTITLEMENT_ARCHITECTURE.md` §6.1) was already found, investigated, and settled during Batch
  15's H-001 ("the journey brief's parenthetical was mistaken relative to the settled, already-documented
  architecture; the code and the architecture doc agree. No code change made."). Per the standing rule not to
  reopen an intentional, already-decided design as a new gap, this is classified as expected, intentional
  behavior rather than a fresh failure or gap.
- Classification: **EXPECTED BEHAVIOUR**.

### H-031: Derived Status Progression Across Full Lifecycle — PASS

- This umbrella progression was fully demonstrated across the H-024-H-030/H-032 chain above on the Linear
  line item: zero requests -> `NO_GO_LIVE` (before `GLR-000014` existed) -> draft created -> `GO_LIVE_PENDING`
  (H-032's own evidence; not the literal `NO_GO_LIVE` the journey brief assumed, see H-032's reconciliation
  above, already settled in Batch 15) -> submitted -> still `GO_LIVE_PENDING` -> confirmed and approved
  (`GLR-000015`) -> `LIVE` (H-028's own evidence). Every transition was independently re-verified live on the
  Go Live list page, not trusted from a cached prior read, and every actor (maker, legal-checker) is
  individually attributable in each request's own Timeline.
- Classification: **PASS**. Matches this journey's own Notes ("this is an integration-style umbrella journey;
  individual transitions are also covered atomically elsewhere") by design: reusing that atomic evidence
  rather than re-executing it a second time.

### H-033: Concurrent Submit and Cancel Race on Same Request — PASS

- Setup: created a fresh draft (`GLR-000016`, request_number 16) on the Volume-based line item.
- Action: fired `submit_go_live_request` and `cancel_go_live_request` concurrently (`Promise.allSettled`)
  against the same fresh draft, same actor.
- Actual evidence: `submit_go_live_request` committed first (`status` -> `submitted`, `row_version` -> 2);
  `cancel_go_live_request`'s own status precondition check, re-reading the now-changed row inside its own
  `for update` lock, correctly rejected with `GO_LIVE_REQUEST_NOT_CANCELLABLE` rather than double-applying.
  Final row: exactly one terminal-in-progress status (`submitted`), `cancelled_at` null, `row_version` = 2 (a
  single bump), no corrupted dual-state.
- Classification: **PASS**.

### H-034: Historical Regression, NOT NULL Constraint Violation on Component Key — PASS

- Verified via direct database inspection: `select count(*) from commercial_components where
  stable_component_key is null` returns 0 across all 72 rows in the shared database, spanning every version-
  approval code path exercised across all 16 prior batches (first-ever versions, amendments, brand-new line
  items). No NOT NULL violation has recurred.
- Classification: **PASS**.

### H-035: Historical Regression, Amendment Minting Fresh stable_component_key Instead of Carrying Forward — PASS

- Verified via direct database inspection: 9 distinct `stable_component_key` values each span more than one
  `commercial_components` row (up to 7), confirming each survived at least one amendment. One such key
  (`0901221e-04ac-412c-8736-d5eb8e9d80c4`, the component this entire session's H-020/H-021/H-026 fixtures
  used) spans 6 rows: `commercial_components.id` changes every amendment, `stable_component_key` never does.
  All of this session's own Go Live and Entitlement history against that key remained correctly joined
  throughout, confirming no orphaning.
- Classification: **PASS**.

### H-036: Attachment Upload to Go Live Request — PASS

- Setup: `GLR-000016`, a submitted request created by `wf-test.maker`.
- Action: uploaded a valid small PDF (`%PDF` magic bytes, 9 bytes) as the Customer Confirmation Email, via a
  disclosed direct call to `uploadGoLiveDocument` (this Claude Browser automation surface has no native
  file-picker primitive; the shared `validateAttachmentFile` policy itself was already confirmed at the code
  level to be the identical, unduplicated function Onboarding uses).
- Actual evidence: upload succeeded, metadata recorded uploader and timestamp, `isCurrent = true`. Live on the
  request detail page: "Customer Confirmation Email: batch16-h036-confirmation.pdf" with a working "Download"
  link, and a new "Mark Confirmed" action appeared now that evidence exists.
- Classification: **PASS**.

### H-037: Attachment Rejected, Invalid File Type or Oversized File — PASS

- Action: attempted an upload with mimeType `application/x-msdownload`/`.exe` extension, and separately a
  valid-type (PDF) file exactly 1 byte over the 1 MB limit, both via the same disclosed direct call.
- Actual evidence: both rejected before any storage write, with distinct, specific reasons: `'malicious.exe'
  cannot be uploaded. Allowed file types are PDF, JPG and JPEG...` (type) vs `This document is 1.0 MB. Maximum
  allowed size is 1 MB...` (size), confirming the UX Check that type vs size failures are distinguishable, not
  a generic failure message.
- Classification: **PASS**.

### H-038: Approve Permission Hardcoded Independent of Workflow Graph — PASS

- Code evidence (authoritative): `src/features/go-live/actions.ts:90,101` calls `requirePermission("go_live",
  "approve")` unconditionally at the start of both `approveGoLiveRequestAction` and
  `sendBackGoLiveRequestAction`, before any RPC or workflow-graph-specific logic executes. This permission
  string is a fixed literal in application code, never read from or influenced by any workflow node's own
  configuration.
- Live evidence: added `wf-test.maker` (holds `go_live.create/submit`, not `go_live.approve`) to the WF-TEST
  Legal team and attempted `approve_go_live_request` on their own submitted request; rejected, but by
  `SELF_APPROVAL_NOT_ALLOWED` (a different, earlier guard) rather than isolating the permission boundary
  specifically, since the only readily available non-approver persona was also the request's own creator.
  Isolating the negative case cleanly would have required either provisioning a new non-creator, non-approver
  persona or reusing an existing team-membership fixture in a way that goes beyond the two already-authorized,
  narrowly-scoped team-membership changes made elsewhere in this batch (H-038's setup attempt itself, and
  H-040's). Given the authoritative, unambiguous code-level evidence already in hand, this further live
  isolation was not pursued rather than requesting a third similarly-scoped authorization.
- Classification: **PASS**, primarily on code-level evidence, with the live attempt disclosed honestly above
  rather than omitted.

### H-039: Human-Readable Request Number Format and Uniqueness — PASS

- Action: fired 8 concurrent `create_go_live_request` calls (`Promise.all`, distinct fictional
  `stable_component_key`s) against the shared database.
- Actual evidence: all 8 succeeded, all received distinct `request_number` values (17-24 inclusive), no
  duplicates, no gaps, no errors. `formatGoLiveRequestId` (`src/features/go-live/domain/types.ts:100-102`)
  confirms the `GLR-000123` format (zero-padded to 6 digits).
- Incidental finding: unlike the sibling `customer_change_requests.request_number` (which has an explicit
  `create unique index`, `20260914100000_human_friendly_request_ids.sql:32`),
  `go_live_requests.request_number` relies solely on its backing sequence's own atomicity, with no additional
  unique index. Postgres sequences are themselves race-safe (`nextval()` never returns the same value twice,
  confirmed empirically above), so this is not a live, exploitable gap through any current code path (nothing
  ever sets `request_number` outside the column's own default); it is a minor structural inconsistency versus
  the sibling domain, not a functional defect. Recorded as an incidental observation, not fixed in this batch.
- Classification: **PASS**.

### H-040: Workflow Team Membership Changes Mid-Flight — PASS

- Setup: `GLR-000016`, submitted, routed to the WF-TEST Legal team; customer confirmation set to confirmed so
  the confirmation guard would not mask the team-membership guard under test.
- Action: revoked `wf-test.legal-checker`'s WF-TEST Legal membership (`user_teams.revoked_at`), attempted
  `approve_go_live_request` as them; then restored access and retried.
- Actual evidence: with no active membership, rejected live with `WORKFLOW_TEAM_REQUIRED`. After access was
  restored, the identical call succeeded immediately (`status` -> `approved`), confirming the check queries
  live `user_teams` state at call time, not a snapshot cached from submission.
- Incidental finding: `user_teams` is itself a protected, append-only historical grant record (a direct
  `update ... set revoked_at = null` to "undo" a revocation was rejected: `"user_teams is a historical grant
  record: revoked_at cannot change once set (no reactivation, no re-revocation)"`). Restoring access after a
  revocation therefore requires inserting a fresh membership row, not reactivating the old one; this is
  correct, intentional design (consistent with this codebase's established append-only-history convention),
  not a defect, and `wf-test.legal-checker`'s access was fully restored via a new row as disclosed to the
  user beforehand.
- Classification: **PASS**.

### H-041: Audit Trail Completeness Across Approve, Send Back, and Cancel — PASS

- Verified on `GLR-000016`'s own full lifecycle (create -> submit -> send-back-guard-tested -> confirm ->
  approve): `created_by`/`created_at`, `submitted_by`/`submitted_at`, `approved_by`/`approved_at` all
  populated, and chronologically consistent (`submitted_at < approved_at`). Multi-cycle reason preservation
  (a later cancellation not overwriting an earlier send-back's own reason) was independently confirmed live
  in H-024's own Timeline evidence above, and 3-cycle send-back/resubmit reason preservation was already
  proven in Batch 15's H-022.
- Classification: **PASS**.

### H-042: prorateFirstMonth Flag Persisted Unchanged Through Approval — PASS

- Setup: created a fresh request with `prorate_first_month = true`.
- Action: carried it through submit -> send back -> resubmit -> approve, re-reading the flag after every
  transition.
- Actual evidence: `true` at every single step (create, after submit, after send back, after final approve),
  confirming no workflow transition RPC resets or touches this column as a side effect, matching the code-
  level grep from pre-execution research.
- Classification: **PASS**.

### H-043: Direct mutation bypass attempt against go_live_requests.status is blocked — FAILED THEN FIXED + PASS

- **Found via**: pre-execution migration inspection (see research summary above), confirming this journey's
  own pre-stated premise: `go_live_requests` had no `fn_protect_go_live_requests_lifecycle`-style BEFORE-
  UPDATE guard trigger, unlike `customers` and `commercial_components`. Per the user's explicit choice,
  migration-inspection evidence was treated as sufficient rather than also running a live exploit-style
  bypass script.
- **Original failure**: this is a real, confirmed, currently-open defense-in-depth gap exactly as the
  journey's own Expected Technical Invariants predicted: a crafted direct `service_role` `UPDATE` could set
  `status = 'approved'` (or any other governed field) bypassing every guard `approve_go_live_request` enforces
  (self-approval, workflow-node resolution, customer-confirmation, team membership) and leaving no
  `workflow_node_transitions` audit row.
- **Root cause and fix**: added `20260930210000_go_live_requests_protect_trigger.sql`, mirroring the
  session-local-bypass pattern `fn_protect_customer_lifecycle` already established
  (`app.permit_customer_delete`): a new `fn_protect_go_live_requests_lifecycle` BEFORE UPDATE OR DELETE
  trigger blocks DELETE unconditionally and blocks UPDATE unless `app.permit_go_live_write` was set for the
  duration of the calling transaction. All six sanctioned writer RPCs
  (`save_go_live_request_draft`, `submit_go_live_request`, `send_back_go_live_request`,
  `approve_go_live_request`, `cancel_go_live_request`, `set_go_live_customer_confirmation`) were rebuilt from
  their current authoritative bodies with one added `perform set_config('app.permit_go_live_write', 'true',
  true);` line immediately before their own `UPDATE`, unchanged otherwise. `create_go_live_request`'s own
  `INSERT` was left ungated (it never touches an existing governed row).
- **Migration applied**: `supabase db push --linked` (user-authorized).
- **Retest**: full legitimate RPC path (create -> submit -> confirm -> approve) re-verified end to end,
  unaffected. `save_go_live_request_draft`, `send_back_go_live_request`, and `cancel_go_live_request`
  independently re-verified working. A fresh direct bypass `UPDATE` attempt now correctly rejected:
  `"go_live_requests may only be updated through save_go_live_request_draft, submit_go_live_request,
  send_back_go_live_request, approve_go_live_request, or cancel_go_live_request"`. A direct `DELETE` attempt
  now correctly rejected: `"go_live_requests is a permanent governed history: DELETE is not permitted"`.
- **Classification**: **FAILED THEN FIXED + PASS**. The gap this journey names was real and open at the start
  of this batch, exactly as its own Expected Technical Invariants anticipated; it is now closed and verified.

### I-001: Create Entitlement Source Independent of Go Live — PASS

- Setup: `Linear` line item, customer `test-sql-smoke-co`, `Go Live Status: NO_GO_LIVE` (zero go_live_requests
  rows ever), a genuinely untouched fixture confirmed via direct database query before use.
- Action: as `wf-test.maker` (freshly granted the `finance_admin` role, which holds `entitlement.write`, per
  user authorization), opened "Add Invoice Entitlement" on the live Entitlement page and submitted a real
  invoice-backed source (Invoice Reference `INV-BATCH16-I001`, 01-Aug-2026, 600 Users, 12 months) through the
  real UI form and its real Server Action.
- Actual evidence: `ES-000002` created successfully, `source_type = MANUAL`, visible live on the page with a
  "Generate Schedule" action, all while `Go Live Status` remained `NO_GO_LIVE` throughout. The page's own copy
  states this directly: "An Invoice Entitlement can be recorded before Go Live, but the monthly allocation
  schedule cannot be generated until this line item has an approved Go Live request." Confirms
  `create_entitlement_source` has no Go Live prerequisite of any kind (already confirmed at the code level in
  pre-execution research: no such check exists in the RPC body).
- Classification: **PASS**.

### I-002: Create Entitlement Source, Manual Source Type — PASS

- This is the same action as I-001 (the only entitlement-source creation path this codebase currently has is
  the manual Finance-entry form). `ES-000002`'s `source_type` persisted as `MANUAL` exactly as entered, with
  `created_by` correctly attributing the real actor.
- Classification: **PASS**.

### I-003: Create Entitlement Source, API Source Type — PRODUCT GAP

### I-004: Create Entitlement Source, Import Source Type — PRODUCT GAP

- Investigation: `create_entitlement_source`'s full parameter list
  (`entitlement_ledger_foundation.sql:361-373`) has no `p_source_type` parameter at all; its `INSERT` never
  sets `source_type`, so every call unconditionally defaults to `'MANUAL'` per the column's own default. There
  is currently no code path, RPC parameter, UI control, or integration surface through which an `API` or
  `IMPORT` sourced row could ever be created, even though the table's own `check` constraint already allows
  those two values and the RPC's own comment explicitly anticipates them: "Manual Finance entry today
  (`source_type = MANUAL`); the same `create_entitlement_source` RPC is the one path a future API/import
  integration calls too, never a parallel write path."
- Reconciliation: this is a genuine, precisely-documented missing capability, not previously recorded in
  `docs/TECH_DEBT.md`. It is not classified as a bounded defect to fix in this batch: building real API/IMPORT
  support means designing how a non-interactive integration caller authenticates (Nexus currently has no
  public API surface at all, only session-based Server Actions) and what an "Integration Service Account"
  concretely is, which are real product/architecture decisions this batch should not invent unilaterally, not
  a mechanical gap-fill. The RPC's own comment already correctly anticipates this as future scope, consistent
  with this codebase's "Build order: do not build ahead of the current step" principle.
- Classification: **PRODUCT GAP** (both I-003 and I-004, same root cause). Does not block I-001, I-002, or
  I-005, all of which use the one currently-real (MANUAL) path.

### I-005: Generate Allocation Schedule Anchored at Go Live Month — PASS

- Setup: `Linear` line item, customer `wf-test-pd-002-case-b-8b2e154f` (approved Go Live, `goLiveDate =
  2027-09-01`, from this batch's own H-028 fixture). Created a new entitlement source (`ES-000003`, Invoice
  Reference `INV-BATCH16-I005`) with `invoiceDate = 2026-01-01`, deliberately 20 months before the go-live
  month, matching this journey's own Stress Variant ("invoiceDate far in the past... a year before go-live").
- Action: through the real UI, opened "Generate Schedule", selected "Create New Entitlement Period", clicked
  "Preview Allocation", then "Confirm and Generate".
- Actual evidence: the live preview showed **"Sep 2027 through Aug 2028"**, 100/month for 12 months, never
  January 2026 (the invoice month). Confirmed persisted in `entitlement_schedule_months`: 12 rows, `2027-09-01`
  through `2028-08-01`, each `monthly_quantity = 100`, summing to exactly `1200` (the invoice quantity, with no
  unit dropped). Confirms `generate_allocation_schedule`'s caller (`previewAllocationSchedule`,
  `entitlement.service.ts:79-95`) anchors a new period at the line item's own approved `goLiveDate`, never the
  invoice date, regardless of how large the gap is.
- Classification: **PASS**.

## Defects found and fixed

### DEFECT: Go Live draft Save/Submit never enforced creator-only ownership (H-027)

- **Found via**: live H-027 execution. See the H-027 entry above for full root-cause, fix, migration, and
  retest detail.
- **Files changed**: `supabase/migrations/20260930200000_go_live_draft_save_submit_creator_only.sql` (new),
  `src/app/customers/[customerKey]/go-live/[requestId]/page.tsx`,
  `src/features/go-live/ui/go-live-detail-page.tsx`.
- **Verification status**: server-side fix verified live (both new NOT_OWNER rejections observed against the
  deployed migration; legitimate creator path re-verified unaffected). UI-side control-visibility
  reverification deferred to this batch's final deploy-verify checkpoint.

### DEFECT: go_live_requests had no defense-in-depth protect trigger (H-043)

- **Found via**: pre-execution migration inspection, per this journey's own prescribed evidence method. See
  the H-043 entry above for full root-cause, fix, migration, and retest detail.
- **Files changed**: `supabase/migrations/20260930210000_go_live_requests_protect_trigger.sql` (new; adds
  `fn_protect_go_live_requests_lifecycle` and rebuilds all six sanctioned write RPCs with the session-local
  bypass flag).
- **Verification status**: fully verified live. Legitimate RPC path (create -> save -> submit -> send_back
  -> confirm -> approve -> cancel, all six writers) re-tested end to end, unaffected. A fresh direct bypass
  `UPDATE` and a direct `DELETE` both correctly rejected post-fix.

## Incidental defects outside Batch 16 scope

- **H-039**: `go_live_requests.request_number` has no explicit unique index, unlike the sibling
  `customer_change_requests.request_number`. Not exploitable through any current code path (the backing
  sequence is itself race-safe, confirmed empirically); a minor structural inconsistency, not fixed in this
  batch. See H-039's own entry above.
- **H-040**: `user_teams` is an append-only historical grant record; a revoked membership cannot be
  reactivated via `UPDATE`, only replaced with a fresh `INSERT`. This is correct, intentional design
  (consistent with this platform's established append-only-history convention elsewhere), not a defect.
  Recorded here only because it was an unexpected discovery mid-journey, not because anything needs fixing.

## Product decisions required

None block this batch's closure. I-003 and I-004 surfaced a genuine, precisely-documented missing capability
(no way to create an `API`- or `IMPORT`-sourced `entitlement_sources` row yet; see their own PRODUCT GAP
entries above), but building real support requires product/architecture decisions about how a non-interactive
integration caller would authenticate against a platform that currently has no public API surface at all, only
session-based Server Actions. This is not something to invent unilaterally, and it does not block any other
Batch 16 journey, so it is disclosed here as a gap rather than raised as an urgent decision. No question is
asked at closure; the user may raise it at their own initiative in a future batch.

## Summary reconciliation

25 journeys scheduled (H-024 through H-043, I-001 through I-005). 25 executed, 25 classified.

| Classification | Count |
| --- | --- |
| PASS | 20 |
| FAILED THEN FIXED + PASS | 2 (H-027, H-043) |
| EXPECTED BEHAVIOUR | 1 (H-032) |
| PRODUCT GAP | 2 (I-003, I-004) |
| PRODUCT DECISION | 0 |
| DEFERRED | 0 |
| **Total** | **25** |

Two real defects were found and fixed during execution: H-027 (Go Live draft Save/Submit missing creator-only
ownership, mirroring the already-established Onboarding fix from PD-001) and H-043 (go_live_requests missing
a defense-in-depth protect trigger, mirroring the already-established Customer Master/Commercial Components
pattern). Both are closed, migrated, and re-verified live. One journey (H-032) reproduces an already-settled
architectural finding from Batch 15's H-001 rather than a new failure. Two journeys (I-003, I-004) surfaced the
same precisely-documented, non-blocking missing capability.
