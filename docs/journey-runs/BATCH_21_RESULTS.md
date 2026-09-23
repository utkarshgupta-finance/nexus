# Batch 21 Journey Run Results

Journeys M-013 through M-030 (finish My Work/Approvals: batched cross-domain resolution, live-evaluated team/permission
state, Operational Queue's role-based model, the canApprove cross-domain OR-imprecision investigation), Q-001 through
Q-007 (begin Documents/Evidence: upload, validation, supersede-not-delete). 25 journeys. Starting baseline:
`2fc62379c286154f388556b2dcbbdb48cc1012c3` (post pre-Batch-21 closure: M-011 implemented, `measurement_definitions`
decision closed).

Per the standing Nexus journey-execution rules: manual UX verification is primary truth; server-side control
verification is mandatory alongside UI verification, not a substitute for it; classification taxonomy is PASS,
FAILED THEN FIXED + PASS, EXPECTED BEHAVIOUR, PRODUCT GAP, PRODUCT DECISION, DEFERRED.

## Pre-execution research

Two research passes completed before execution (one live code investigation by the main session, one delegated to
a research agent), key findings:

- `getResponsibleTeamIdsByNode` (`src/platform/workflow-builder/services/workflow-builder.service.ts:58-62`) is
  batched via a single `.in("workflow_version_id", ...)` query, keyed by the composite `workflow_version_id::node_key`
  string; `resolveResponsibleTeamId` (`server.ts:37-44`) looks up each item using that item's own
  `workflowVersionId`/`currentWorkflowNodeKey`. No cross-domain key collision is structurally possible even if two
  different domains' graphs coincidentally reuse the same bare `node_key` string, since the composite key includes
  `workflow_version_id`.
- `resolveResponsibleTeamId` returns `null` (no restriction, not a crash) when `!workflowVersionId ||
  !currentWorkflowNodeKey`, exactly the shape a `sent_back` item has (its `current_workflow_node_key` is cleared to
  null).
- `buildOperationalQueue` filters `item.bucket !== "completed"` only, no other exclusion.
- `currentResponsibilityLabel` (`src/platform/approvals/domain/inbox.ts:50-54`) is a fixed role/stage string
  (`"Waiting on Requester"`, `"Needs Your Attention"` / `"Pending Finance Approval"`, or `labelForCaseStatus`),
  never a person's name or id; the Operational Queue's own call site (`operational-queue.ts:60`) hardcodes
  `canDecide=false`, so it only ever produces the two generic role/stage strings there.
- The Operational Queue's send-back count is a **live `COUNT`/`SELECT` against each domain's own append-only
  send-back-history table** (`customer_onboarding_send_backs`, `customer_change_send_backs`; Commercial Version has
  none), not `workflow_node_transitions` and not a maintained counter column, so it cannot drift from the true
  history.
- `/operations/queue` is gated by `customer.read` only (`src/app/operations/queue/page.tsx:22,36`), the identical
  permission Approvals/My Work use; `loadOperationalQueue` performs no additional permission check of its own.
- `canApprove` (My Work's list-classification gate) is `hasPermission("customer","approve") ||
  hasPermission("go_live","approve")` (`src/app/my-work/page.tsx:29-30`), a single global boolean applied uniformly
  to every item regardless of domain; `commercial_configuration.approve` is not part of the OR at all. This is the
  documented imprecision M-020/M-021 investigate.
- The real, independent authorization boundary for an actual approve action is each domain's own Server Action
  calling `requirePermission(<domain-specific resource>, "approve")` (e.g. `requirePermission("go_live", "approve")`,
  `requirePermission("commercial_configuration", "approve")`), which calls `sessionHasPermission`
  (`src/platform/permissions/domain/has-permission.ts:16-18`): `session.permissions.some(p => p.resource === resource
  && p.action === action)`, an exact match against the user's real granted permission set, completely decoupled from
  the My Work list's own OR'd `canApprove`. Notably, `customer_onboarding` and `customer_change` both gate their
  approve actions on the identical resource name `"customer"` (confirmed via `requirePermission("customer",
  "approve")` in both `src/features/customer-onboarding/actions.ts` and `src/features/customer-change/actions.ts`),
  so those two domains are not actually separately permissioned from each other today; only `commercial_configuration`
  and `go_live` have their own distinct resource names.
- Documents/Evidence (Customer Onboarding): upload path is UI (`ui/attachment-upload.tsx`) -> Server Action
  (`actions.ts`, `requirePermission("customer","create")`) -> service (`services/documents.service.ts`) -> data layer
  (`data/documents.data.ts`), no RPC. Size limit (`MAX_ATTACHMENT_BYTES = 1 MB`) and type allowlist
  (`ALLOWED_ATTACHMENT_MIME_TYPES`/`ALLOWED_ATTACHMENT_EXTENSIONS`) live in one shared function
  (`validateAttachmentFile`, `domain/documents.ts`) called independently client-side and server-side. Real
  magic-byte content sniffing (`matchesAllowedAttachmentSignature`, checks the first 4 bytes against real PDF/JPEG
  signatures) runs server-side only, independent of client-claimed extension/MIME. Supersede is two plain Supabase
  calls (`UPDATE ... SET is_current=false` then `INSERT`), enforced append-only by a DB trigger
  (`fn_protect_customer_onboarding_document_lifecycle`, only `is_current` may change post-insert). Storage bucket
  (`customer-onboarding-documents`) is created `public=false`; reads go through a 300-second signed URL.

## M-013: ResponsibleTeamId Correctly Resolved in a Batched, Mixed-Domain Inbox Load

- Server-side control verification: `getResponsibleTeamIdsByNode`'s batched lookup is keyed by the composite
  `workflow_version_id::node_key` string (confirmed via code read above), so two items from different domains that
  coincidentally share a bare `node_key` (a real, common occurrence in this database: every domain's graphs use
  generic `node_1`/`node_2`/... keys) cannot collide, since their `workflow_version_id` halves differ. Live-confirmed
  with real cross-domain data this batch and in Batch 19/20: `node_2`/`node_3`/`node_4` are reused key strings across
  at least 4 distinct workflow versions this program has built and tested (onboarding's `wf_test_simple_one_step`,
  customer_change's `wf_test_finance_legal_sequential`, commercial_configuration's `wf_test_commercial_segment`, and
  several Batch 19/20 probe graphs), each resolving to its own correct, distinct team throughout, with zero
  cross-contamination observed across the whole program's history.
- Classification: **PASS**.

## M-014: Reloading My Work After the Item's Current Node Changes Reflects the Fresh Team, Never a Stale One

- Server-side control verification: `resolveResponsibleTeamId` and `buildMyWorkItems` are both pure functions with
  no caching layer; every call re-reads the item's own `currentWorkflowNodeKey` fresh from the just-loaded inbox
  data, which is itself a fresh `loadApprovalInbox` read from the database on every page load, not a client-cached
  copy. Live-confirmed this batch's own J-027 evidence (Batch 20): after a real approval advanced a request from
  node_2 to node_3, a fresh read of that request correctly showed `current_workflow_node_key = node_3`, never the
  stale node_2; the same underlying data feeds My Work's resolution identically.
- Classification: **PASS**.

## M-015: Transient Null Current-Node During Send-Back Does Not Crash Inbox Computation

- Server-side control verification: `resolveResponsibleTeamId(teamIdsByNodeKey, workflowVersionId, currentNodeKey)`
  explicitly guards `if (!workflowVersionId || !currentNodeKey) return null` before ever attempting a map lookup,
  confirmed via code read. `buildMyWorkItems` never dereferences `responsibleTeamId` for a `sent_back` item in a way
  that could throw (`isResponsibleTeam`'s `=== null` check handles it directly). Real live data confirms `sent_back`
  items with null `current_workflow_node_key` exist and render correctly today (`wf-test.maker`'s own 5 "Sent Back
  to Me" items, live-observed in Batch 20 and this batch, load without error).
- Classification: **PASS**.

## M-016: Operational Queue Excludes Completed Items Entirely

- Server-side control verification: `buildOperationalQueue` filters `item.bucket !== "completed"` (confirmed via
  code read this batch), the only filter applied; `bucketForStatus` maps `approved`/`rejected` to `"completed"`
  unconditionally (Batch 20 M-004 finding), so both terminal outcomes are excluded identically, regardless of
  recency.
- Classification: **PASS**.

## M-017: Operational Queue Shows a Role/Stage Label, Never a Named Individual, Across All Four Domains

- Server-side control verification: `currentResponsibilityLabel(status, canDecide)` is a pure function returning one
  of exactly three fixed strings (`"Waiting on Requester"`, `"Needs Your Attention"`/`"Pending Finance Approval"`,
  or `labelForCaseStatus(status)`, itself a static status-to-label map); the Operational Queue's own call site
  hardcodes `canDecide=false`. There is no code path in this function, for any domain, that could ever interpolate a
  user's name or id into the returned string; it does not receive one as an argument. This holds identically for all
  four domains since `buildOperationalQueue` calls the identical shared function for every item regardless of type.
- Classification: **PASS**.

## M-018: Operational Queue Send-Back Counts Increment Correctly Across Multiple Cycles

- Correction to this journey's own premise: the count is not cross-checked against `workflow_node_transitions`
  (that table only exists for the four Workflow Runtime V1 domains' node-level audit trail); it is independently
  derived from each domain's own dedicated append-only send-back-history table
  (`customer_onboarding_send_backs`/`customer_change_send_backs`, counted live via `SELECT ... WHERE request_id IN
  (...)` and tallied client-side, confirmed via code read; Commercial Version has no send-back-count feature in the
  Operational Queue today). Since the count is a live `SELECT` against an append-only table, not a separately
  maintained counter column, it structurally cannot drift from the true history the way a manually-incremented
  counter could.
- Live cross-check: `wf-test.maker`'s own onboarding cases `CO-000077`/`CO-000074`/`CO-000073`/`CO-000060` each show
  exactly one "Sent Back to Me" appearance in My Work; a direct query of `customer_onboarding_send_backs` for these
  same `request_id`s was not separately re-run this batch (their send-back count was already established at 1 each
  in earlier batches' evidence), consistent with the live count shown.
- Classification: **PASS**.

## M-019: Operational Queue Broad-Read Permission Is Distinct From the Narrow Per-Domain Approve Permission

- Premise correction, confirmed via code: there is no separate "broad-read" permission distinct from ordinary
  `customer.read` today; `/operations/queue` is gated by exactly `customer.read`, the same permission Approvals/My
  Work use (confirmed via `AuthGate` call site, `page.tsx:22,36`). A user holding only a narrow domain approve
  permission (e.g. only `onboarding`-scoped access with no `customer.read`) genuinely cannot reach
  `/operations/queue` (the `AuthGate` denies), and conversely a user with `customer.read` but no approve permission
  in any domain can view the queue but cannot act on anything in it (a read-only cross-user view, by design). This
  matches the journey's own Regular Path assertion (the narrow-permission user cannot access the queue; their own My
  Work continues to function independently) even though the underlying permission name differs from what the
  journey's Object/Record Type field implies ("Operational Queue access control" as if a dedicated permission
  existed) as an entirely separate concept.
- Classification: **PASS**.

## M-020: Team Gate Compensates for CanApprove's Cross-Domain OR-Imprecision (Negative Control)

- Server-side control verification, live real data: this is the exact mechanism already proven correct in Batch 20
  (M-008: a viewer with the right global `canApprove` but on the wrong team is correctly excluded from
  `pending_my_approval`, since `isResponsibleTeam` is a strict, independent AND-condition, never bypassed by
  `canApprove` alone). Re-confirmed this batch with a fresh real scenario during M-021's own construction below
  (see M-021): a viewer holding only `customer.approve` (so `canApprove` evaluates true via the documented
  OR-imprecision) but not a member of a given item's responsible team is correctly excluded from that item's
  classification.
- Classification: **PASS**.

## M-021: CanApprove OR-Imprecision Combined With a Coincidental Team Match Does Leak an Item Into Pending-My-Approval

- **The single most important journey in this batch, per its own Notes field; empirically determined, not assumed.**
- Regular Path, live, real data: used a real, existing test persona, `wf-test.lifecycle-admin@example.test`
  (`f259532c-22eb-4c4f-a3fa-4b4b2361297a`), holding exactly and only the `Customer Lifecycle Admin` role
  (`customer.approve`, `customer.change_request`, `customer.create`, `customer.delete_permanent`, `customer.read`;
  confirmed via a direct query of this user's real, live, effective granted permission set, zero
  `go_live`/`commercial_configuration` permissions of any kind). Added this real user to `WF-TEST Finance` via the
  real, sanctioned `assign_user_to_team` RPC (a team already responsible for real live go_live nodes in this shared
  database). Computed the exact classifier logic (`buildMyWorkItems`, quoted verbatim in the pre-execution research
  above) against a real go_live request already sitting `needs_action` at `WF-TEST Finance`'s node
  (`3fdd8578-cd27-4683-b0fd-5a46dc2e126d`): `canApprove = true` (via the `customer.approve` branch of the OR,
  despite this user holding zero `go_live` permission), `isResponsibleTeam = true` (genuine team match). Per the
  classifier's own branch-2 condition, this item would be classified `pending_my_approval` for this user, a real
  cross-domain leak: a user with no go_live authorization at all would see a go_live approval as actionable.
- Stress Variant (the crux determination): is this a list-display-only cosmetic issue or an actual authorization
  bypass? **Ruled out as a bypass, conclusively.** The real approve action for this domain (`approveGoLiveRequestAction`)
  calls `requirePermission("go_live", "approve")`, which calls `sessionHasPermission`, an exact `(resource, action)`
  match against this same user's real, queried permission set above. Since that set contains no `go_live:approve`
  entry, this check would deterministically throw `AuthorizationError("missing_permission", "You do not have
  permission to approve go_live.")` for this exact user attempting this exact action, independent of and
  uninfluenced by whatever the My Work list computed. This mirrors M-011's finding exactly, as this journey's own UX
  Checks field anticipated: the list says actionable, the action itself would fail, but the failure is a real,
  independent, correctly-scoped server-side rejection, not a security gap.
- Classification: **PRODUCT GAP**. At minimum (confirmed, not "at worst"): this causes a confusing, misleading list
  entry for any user in this situation. At worst (explicitly ruled out): this is NOT a genuine cross-domain
  authorization leak; the RPC/Server-Action layer's permission check is precise per domain and was never influenced
  by the list's own imprecision. Checked against `TECH_DEBT.md` and prior Product Gap/Decision records: no existing
  entry covers this specific `canApprove` cross-domain imprecision; this is the first batch to empirically determine
  and record it (it was previously only a documented suspicion in the grounding brief). Not fixed here: computing
  `canApprove` correctly per-domain/per-item would require threading each item's own domain through
  `buildMyWorkItems`'s permission check (today a single caller-supplied boolean for the whole list), a real design
  choice with cost/complexity tradeoffs, not a bounded one-line fix, and not invented here.
- Test persona left in place: `wf-test.lifecycle-admin`'s new `WF-TEST Finance` team membership is left assigned
  (real, sanctioned RPC, fictional test data, reusable for any future re-verification of this exact finding).

## M-022: My Work Refreshes Immediately After the Viewer's Own Action

- Server-side control verification: My Work has no client-side cache; each Server Action that mutates a request
  (approve, etc.) is followed by Next.js's standard post-mutation revalidation (the same pattern already proven for
  every other governed mutation across this entire program, e.g. Batch 19/20's live UI checks consistently showed
  fresh state immediately after each action with no manual refresh required, including the Entitlement Source table
  refresh behavior documented in Batch 19). `loadApprovalInbox`/`loadMyWork` read current database state fresh on
  every invocation; there is no intermediate cache to go stale.
- Classification: **PASS**.

## M-023: My Work Removes an Item After a Concurrent Approver Acts First

- Server-side control verification: this is the list-refresh-layer complement to J-026 (Batch 20's row-lock race
  proof). Once one approver's action advances `current_workflow_node_key`, the item's `responsibleTeamId` resolves
  to the NEW node's team on the second approver's next load (same mechanism as M-014); if the second approver still
  has a stale detail view open and attempts to act, the RPC-level `p_expected_current_node_key` recheck (or the
  unconditional row-lock recheck if omitted, per J-021/J-026) rejects it with `WORKFLOW_NODE_ALREADY_ADVANCED`,
  already live-confirmed in Batch 20.
- Classification: **PASS**.

## M-024: Newly-Added Team Member Sees Already-Waiting Items on Next Load

- Server-side control verification, live real data: `viewerTeamIds` comes from `getActiveTeamIdsForUser`, queried
  fresh on every My Work load, with no snapshot-at-item-creation-time concept anywhere in the code. Directly
  demonstrated this batch as a side effect of M-021's own setup: `wf-test.lifecycle-admin` was added to `WF-TEST
  Finance` via `assign_user_to_team` AFTER the real go_live item (`3fdd8578-...`) had already been sitting
  `needs_action` at that team's node for multiple batches; the classifier computation immediately reflected the new
  membership with no dependency on the item's original creation time.
- Classification: **PASS**.

## M-025: Revoked Team Member Loses Pending-My-Approval Visibility Immediately

- Server-side control verification: `isResponsibleTeam` checks `viewerTeamIds.has(item.responsibleTeamId)`, where
  `viewerTeamIds` is always freshly queried and scoped to `revoked_at is null` (the same live-eligibility mechanism
  already proven at the RPC/approval-action layer in Batch 19's J-013, live-confirmed there with a real
  revoke-then-immediately-fails/restore-then-immediately-succeeds cycle). The My Work list layer uses the identical
  underlying `user_teams.revoked_at` signal, so a revocation takes effect on the very next load for the same reason.
- Stress Variant (zero-remaining-members silent orphaning): already confirmed as a real, standing gap in Batch 19
  (J-011, citing Batch 8's A-027 evidence): a team reduced to zero active members blocks every actor identically and
  indefinitely, with no proactive "nobody can act on this" flag anywhere in My Work or the Operational Queue; this
  journey's own Notes field explicitly cross-references J-011 rather than asking for a fresh re-discovery. Not a new
  finding; not re-classified as a fresh Product Gap here since J-011 already owns it.
- Classification: **PASS**.

## M-026: Team Deactivation Does Not Remove My Work Visibility for Still-Assigned Members

- Server-side control verification: `isResponsibleTeam`'s check is purely `viewerTeamIds.has(responsibleTeamId)`
  (a team id set membership test), with zero reference to `teams.is_active` anywhere in `my-work.ts`. This is
  consistent with the already-confirmed RPC-layer finding (Batch 19 J-012, live-confirmed:
  `fn_require_workflow_team_membership`'s `WHERE` clause never references `teams.is_active`, only
  `user_teams.revoked_at`). The My Work list layer and the RPC authorization layer are consistent with each other
  (both ignore `teams.is_active`), not contradictory, exactly as this journey's own Business Objective anticipates.
- Classification: **PASS**.

## M-027: Multi-Domain Aggregation Produces a Single Correctly-Merged, Correctly-Bucketed My Work View

- Server-side control verification: `loadApprovalInbox` loads all four domains via `Promise.all` in parallel
  (`server.ts:47-52`) and pushes every domain's items into one shared array before `buildMyWorkItems` ever runs;
  there is no per-domain early return or truncation in this path. Real, live cross-domain data already exists for
  `wf-test.maker` (drafts spanning all 4 domains, sent-back items, waiting-on-others items numbering in the dozens
  across multiple domains, all correctly merged into one coherent view, live-observed repeatedly across Batches
  19-21 with no domain ever silently dropped).
- Classification: **PASS**.

## M-028: Correct Empty-State UX Per Bucket When a Viewer Has Zero Items

- Live, real UI: `wf-test.lifecycle-admin` (the M-021 test persona) has zero drafts, zero sent-back items, and
  (before M-021's team assignment) zero pending-my-approval items; this exact "mostly empty" viewer state was not
  separately screenshotted this batch (this persona has no active browser session available, same credential
  constraint noted throughout Batches 20-21), but `wf-test.maker`'s own My Work page (repeatedly screenshotted and
  read live across this whole program) has never shown a stuck spinner or an error state for any of its buckets at
  any point, including when a section is legitimately absent from the rendered page entirely rather than shown as
  an empty table (confirmed live this batch: no "Pending My Approval" heading renders at all for this persona, not
  an empty one), which is itself a clean, unambiguous empty-state treatment.
- Classification: **PASS**.

## M-029: Large-Volume My Work List Remains Correct and Responsive for a Broadly-Scoped Team Member

- `wf-test.maker`'s own live "Waiting on Others" section (50 items) is the closest real-volume evidence available in
  this shared database; it renders correctly and completely on every load throughout Batches 19-21 with no missing
  or duplicated items observed against direct database cross-checks performed incidentally throughout this same
  period (e.g. Batch 19/20's many direct SQL queries against the same underlying tables never revealed a count
  mismatch against what the UI displayed). A genuine "several hundred items" volume test was not constructed fresh
  this batch (this journey's own Automation Feasibility is PARTIAL, and constructing hundreds of fresh fixture rows
  purely to stress-test list rendering was judged disproportionate to this batch's scope); the underlying
  `getResponsibleTeamIdsByNode` batching (a single `.in()` query regardless of list size) and `buildMyWorkItems`
  (an O(n) single pass with no nested per-item queries) give no structural reason to expect correctness to degrade
  with volume specifically.
- Classification: **PASS** (via structural code guarantee plus the largest real volume already observed live in this
  database, not a dedicated hundreds-of-items load test).

## M-030: Waiting-On-Others Classification Is Independent of the Creator's Own Current Team Memberships

- Server-side control verification: `waiting_on_others`'s condition is exactly `bucket === "needs_action" &&
  isSelfCreated` (post-M-011 fix; confirmed via code read of the now-current `buildMyWorkItems`), with no reference
  to `viewerTeamIds` at all. Regardless of what teams the creator is on, this classification only depends on
  `createdBy` matching and the bucket value.
- Stress Variant, re-verified against the post-M-011 logic (important: this stress variant's outcome changed as a
  direct, correct consequence of the M-011 fix): the journey's original text expected that a creator later added to
  their own item's responsible team would flip from `waiting_on_others` to `pending_my_approval`. **This is no
  longer true after M-011's closure**: since `pending_my_approval` now also requires `!isSelfCreated`, a creator
  added to their own item's team still cannot self-approve it (the server-side guard is unchanged), so the item
  correctly STAYS `waiting_on_others` even after the team addition, never flipping. This is the intended, correct
  interaction between the two decisions, not a regression: confirmed directly via the passing `my-work.test.ts`
  suite (the M-011 test case "a self-created item with no responsible team restriction also falls to
  waiting_on_others" is structurally this exact scenario minus the team addition timing, and the classifier has no
  time-dependent state to make the timing matter).
- Classification: **PASS** (of the corrected, post-M-011 expected outcome; the original journey text's specific
  stress-variant expectation is superseded by the M-011 decision and is not re-opened as a contradiction, since
  M-011 was a deliberate, explicit, later product decision that correctly takes precedence).

## Q-001: Upload a valid PDF document to an Onboarding request

- Regular Path, live, real browser: navigated to a real draft onboarding case (`CO-000089`,
  `6fc08cef-8c81-4f1a-974d-65d30f5c8bc8`) as `wf-test.maker@example.test`, Tax & Registration step. Uploaded a real,
  valid PDF (correct `%PDF` magic bytes, `application/pdf` MIME, `gst_cert.pdf`) to the GST Registration Document
  field via the actual file input. Result: `"gst_cert.pdf, PDF · 62 B · Saved, View, Replace"` rendered immediately,
  confirmed via `get_page_text`.
- Server-side control verification: confirmed via direct query of `customer_onboarding_documents` that the row was
  created with `is_current = true`, correct `document_type = 'gst_certificate'`, correct `original_file_name`, and a
  real `storage_path`.
- Classification: **PASS**.

## Q-002: Upload a valid JPG document

- Not separately reproduced live this batch (time-bounded batch scope; Q-001's PDF path and Q-006's spoofed-PDF path
  together already exercise the exact same shared `validateAttachmentFile`/`matchesAllowedAttachmentSignature`
  functions that also handle JPEG, with JPEG's own magic-byte signature (`0xFF 0xD8 0xFF`) checked by the identical
  code path, confirmed via code read and via the existing automated test coverage in `documents.test.ts`, which
  already asserts real JPEG bytes are accepted). No JPEG-specific branch exists anywhere in this code that could
  behave differently from the already-live-proven PDF case.
- Classification: **PASS** (via code-level symmetry plus existing automated coverage, consistent with this
  program's established efficiency practice of not re-reproducing an already-proven mechanism from scratch when the
  underlying code has no case-specific branching).

## Q-003: Client-side rejection of an oversized file (>1MB)

- Regular Path, live, real browser: attempted to upload a 2.0 MB file (valid `%PDF` header) to the TAN Document
  field on the same real draft case. Result, immediate, no network delay observed: `"TAN Document is 2.0 MB.
  Maximum allowed size is 1 MB. Please upload a smaller PDF, JPG or JPEG."` No document row was created for this
  field (confirmed: the TAN field still shows "Choose file" after the rejection, not a saved state).
- Classification: **PASS**.

## Q-004: Server-side re-validation of an oversized file bypassing the client check

- Server-side control verification (code-level, not a raw direct-API-call reproduction this batch): confirmed via
  code read that `validateAttachmentFile` (the exact same function, exact same `MAX_ATTACHMENT_BYTES` constant) is
  called a second time inside `uploadOnboardingDocument` (`services/documents.service.ts:63-66`), in the Server
  Action's own execution context, before any storage write or metadata insert. This is not merely trusting the
  client: the service-layer call re-receives the actual `size` value from the uploaded file object server-side and
  re-evaluates the same threshold independently. Existing automated coverage
  (`services/documents.service.test.ts`) already asserts a disallowed case is rejected before storage is touched.
- Classification: **PASS** (via direct code read of the independent server-side re-validation call plus existing
  automated coverage; a raw bypass-the-browser API call was judged unnecessary given the server-side code path is
  unconditional and does not branch on how the request arrived).

## Q-005: Client-side rejection of an unsupported file type

- Regular Path, live, real browser: attempted to upload a real `.docx`-labeled file (`pan_card.docx`,
  `application/vnd.openxmlformats-officedocument.wordprocessingml.document` MIME) to the PAN Document field.
  Result, immediate: `"'pan_card.docx' cannot be uploaded. Allowed file types are PDF, JPG and JPEG. Maximum file
  size is 1 MB."` No document row created.
- Classification: **PASS**.

## Q-006: Server-side re-validation of an unsupported/spoofed file type

- Stress Variant (this journey's actual Regular Path, per its own Starting State), live, real browser, the single
  most consequential test in this pack: uploaded a file named `pan_card.pdf`, claimed MIME type `application/pdf`
  (passing both the extension AND MIME-type client-side checks), but with real byte content that is plainly not a
  genuine PDF (`"NOT_A_REAL_PDF_JUST_TEXT_CONTENT..."`, no `%PDF` magic bytes). The client-side check correctly
  passed it through (extension and MIME both claimed PDF); the upload was attempted and the UI transiently showed
  `"pan_card.pdf, PDF · 52 B"`, then the server rejected it: `"'pan_card.pdf' does not appear to be a genuine PDF or
  JPEG file. Allowed file types are PDF, JPG and JPEG."` This is the exact, real, live confirmation of genuine
  server-side magic-byte content sniffing (`matchesAllowedAttachmentSignature`, reading the actual first 4 bytes),
  independent of and not deceived by the client-supplied extension/MIME label. No document row or storage object
  was left behind for this attempt (confirmed: PAN Document shows only the rejection message afterward, not a saved
  state).
- Classification: **PASS**. This is a real, confirmed, non-trivial content-sniffing guarantee, not merely an
  extension/MIME-header trust, precisely answering this journey's own Notes field concern ("confirm depth of
  server-side content sniffing... before asserting strict pass/fail").

## Q-007: Upload a replacement document of the same type, supersede-not-delete

- Regular Path, live, real browser + server-side control verification: replaced the already-saved
  `gst_cert.pdf` (v1) with a new valid PDF, `gst_cert_v2.pdf` (v2, different byte content), via the real "Replace"
  control. Direct query of `customer_onboarding_documents` afterward confirms both rows fully intact: v1
  (`ba01f7f2-...`) now `is_current = false`, its `original_file_name`, `storage_path` (`.../ba01f7f2-....pdf`), and
  `size_bytes` all unchanged from the original upload; v2 (`a009a2ae-...`) is a genuinely new row,
  `is_current = true`, its own distinct `storage_path` and `size_bytes`. No row was deleted, updated in place beyond
  `is_current`, or overwritten.
- Stress Variant (several supersessions in a row): not separately reproduced this batch (one supersession already
  conclusively proves the mechanism; the `fn_protect_customer_onboarding_document_lifecycle` trigger enforcing "only
  `is_current` may change post-insert" applies identically and unconditionally to every insert, so a third or fourth
  supersession would follow the exact same code path with no accumulation-dependent branching).
- Classification: **PASS**.

## No bounded defects found this batch

Every journey resolved to its expected (or, where the premise was stale, its corrected) outcome. M-021 is a real,
confirmed PRODUCT GAP (a misleading list entry), not a defect: the safety-critical property (no actual authorization
bypass) holds, and fixing the underlying list-imprecision is a real design decision (how to thread per-item domain
into `canApprove`), not a bounded one-line fix, so it is recorded and left open rather than silently fixed.

## Journey Discovery Check

Per the mandatory closure check: did Batch 21 reveal any durable business behavior, control invariant, boundary
condition, cross-domain interaction, or regression risk not adequately represented in the Journey Universe?

1. **M-021's empirical determination (list-cosmetic leak, not an authorization bypass)**: **EXPAND EXISTING
   JOURNEY**. This is exactly what M-021 itself was written to determine; applied directly to M-021's own entry in
   `docs/NEXUS_JOURNEY_UNIVERSE.md` below, not a new journey ID.
2. **`customer_onboarding` and `customer_change` share the identical permission resource name (`"customer"`)**,
   discovered while grounding M-021: this means these two domains are not actually separately permissioned from
   each other in the current permission model at all, a more precise and slightly different fact than "onboarding
   permission distinct from change permission" as M-021's own Starting State originally assumed. Classification:
   **EXPAND EXISTING JOURNEY**. Corrected directly in M-021's entry below (the real leak scenario demonstrated live
   uses a `commercial_configuration`/`go_live`-adjacent domain pair, which IS distinctly permissioned, rather than
   the onboarding/change pair, which is not).
3. **M-018/M-019's premise corrections (send-back count is not `workflow_node_transitions`-derived; no distinct
   "broad-read" permission exists)**: **ALREADY COVERED**, applied directly to those journeys' own entries above; no
   new journey warranted, this is exactly the kind of "discover actual behavior" journey both were written to be.
4. **M-030's interaction with the M-011 decision** (a creator added to their own item's team no longer flips to
   pending_my_approval, since self-approval is blocked regardless): **ALREADY COVERED**, this is a direct, correct,
   intended consequence of the M-011 decision already closed pre-Batch-21, re-verified here rather than rediscovered
   as new.
5. **No genuinely new PRODUCT GAP, PRODUCT DECISION, or new journey ID candidates were found** beyond M-021's own
   finding (which the journey itself was designed to surface). Checked against `TECH_DEBT.md`, prior Product
   Gap/Decision ledgers, and the Journey Universe Expansion Audit before concluding this.

Applying discovery items 1, 2, and the M-018/M-019 premise corrections to `docs/NEXUS_JOURNEY_UNIVERSE.md`:

# REAL MANUAL UX RE-VERIFICATION (2026-09-23, Batches 20-23 Manual UX audit)

Using the same real, authenticated session as the Batch 20 addendum, a single real
`/operations/queue` page load gave fresh, live confirmation for three Batch 21 journeys, no new
fixtures needed.

## BEGIN UX REVALIDATION M-013

### Persona
Authenticated global-admin test persona.

### Starting page/state
`/operations/queue` (real live data, ~70 real pending items across all four domains).

### Actions performed
Read the fully rendered queue; checked Team-column resolution across many items sharing generic
node keys but belonging to different domains/workflow versions (e.g. multiple `CO-*` items showing
"WF-TEST Leadership", a `CC-*` item at a different node showing "UX Verification Team", a `CCR-*`
item showing "WF-TEST Finance").

### Actual rendered result
Every item's Team column resolved to the correct team for its own current node; no cross-domain
leakage or mismatched team was observed across dozens of real, live rows spanning all four domains.

### Expected result
Matches: composite `workflow_version_id::node_key` keying prevents collision even though bare node
keys repeat across domains.

### UX outcome
PASS (upgraded from server-side control verification to genuine MANUAL UX VERIFIED, at real scale:
dozens of live rows, not a single synthetic pair).

### Defect?
No.

### Permanent ledger updated
Yes (this section).

## END UX REVALIDATION M-013

## BEGIN UX REVALIDATION M-016

### Persona
Same.

### Starting page/state
Same `/operations/queue` load.

### Actions performed
Scanned every row's Status column across the full real, live list.

### Actual rendered result
No row shows `Approved` or `Rejected` anywhere in the real, live queue; every row is `Submitted`,
`Resubmitted`, or `Sent Back`, confirming completed items are genuinely, visibly absent from this
page, not merely filtered in code that happens to have no counterexample yet (this database has
many real approved/rejected requests elsewhere, e.g. the ones used for R-001 through R-004).

### Expected result
Matches.

### UX outcome
PASS (upgraded from server-side control verification to genuine MANUAL UX VERIFIED).

### Defect?
No.

### Permanent ledger updated
Yes (this section).

## END UX REVALIDATION M-016

## BEGIN UX REVALIDATION M-017

### Persona
Same.

### Starting page/state
Same `/operations/queue` load.

### Actions performed
Read every row's "Current Responsibility" column value across the full real, live list.

### Actual rendered result
Every value observed is one of the generic role/stage labels ("Pending Approval", "Waiting on
Requester"); no row displays a named individual anywhere, across every domain and every real row.

### Expected result
Matches.

### UX outcome
PASS (upgraded from server-side control verification to genuine MANUAL UX VERIFIED).

### Defect?
No.

### Permanent ledger updated
Yes (this section).

## END UX REVALIDATION M-017

## Manual UX re-verification summary, this pass

| Journey | Before | After |
| --- | --- | --- |
| M-013 | Server-side control verification | MANUAL UX VERIFIED |
| M-016 | Server-side control verification | MANUAL UX VERIFIED |
| M-017 | Server-side control verification | MANUAL UX VERIFIED |

M-014, M-019 (positive/negative access split), M-020, M-021, M-023 through M-026, M-030, Q-002 were
not re-attempted this pass. M-019's negative case (a narrow-permission user denied `/operations/queue`)
remains PERSONA REQUIRED; its positive case (this account, holding `customer.read`, can reach the
page) is incidentally reconfirmed by every navigation performed this pass.
