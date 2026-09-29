# Batch 29 Fresh Execution Results

Scope: W-008 through W-021 (14 journeys), Z-001 through Z-011 (11 journeys). 25 scheduled.

## Step 0: Pre-batch Product Gap / canonical reconciliation

Read `docs/OPEN_PRODUCT_GAPS.md` directly (not RUN_STATE.json alone). Confirmed:

- **A. ACTIVE PRODUCT GAPS: 0** (explicit, section A reads "None currently open").
- **PG-056 CLOSED**: WORKFLOW_TEAM_INACTIVE client-parser mapping, all 4 domains.
- **PG-057 CLOSED**: Go Live locks to creation-time Commercial Version (Batch 28).
- **PG-058 CLOSED**: Customer Master Activity/History point-in-time actor identity (Batch 28).
- **PG-037 CLOSED**, final implemented semantics: cross-node segregation-of-duties check narrowed to compare `from_node_key` (same-node reapproval after resubmission remains allowed; cross-node blocked).
- **PG-040 CLOSED**, final implemented semantics (custom 4-bullet spec): block NEW routing into an inactive team's node (`WORKFLOW_TEAM_INACTIVE` raised runtime, before mutation); existing assigned work stays actionable by remaining eligible members; warning banner on the Operational Queue AND all four review pages; member-level removal still blocks that individual immediately (`fn_require_workflow_team_membership` unchanged).
- No gap discovered in Batches 1-28 is missing from the register; the register's own reconciliation notes document every pass through 2026-09-29 (sixth pass, PG-058).
- No inconsistency found requiring reconciliation before Batch 29 starts.

Confirmed live against current source (not memory) before relying on Z-007/Z-009's rewrites below:
- `src/components/product/operational-queue-table.tsx` and `src/platform/approvals/domain/operational-queue.ts` (O-018's "zero active members" banner) exist and are wired.
- `src/components/product/responsible-team-inactive-banner.tsx` plus its four call sites (`go-live-detail-page.tsx`, `commercial-version-review-page.tsx`, `review-detail-page.tsx`, `change-request-review-page.tsx`) (PG-040's review-page warning) exist and are wired to all four domains.

This resolves the register's own noted, previously-unreconciled tension ("M-025 states 'no proactive flag anywhere in My Work or the Operational Queue,' apparently in tension with this fix's own Operations Queue banner") in favor of the banner existing: M-025's Batch 21 claim was either stale at the time or predates O-018's fix; current source has the banner.

## Step 0A: Canonical reconciliation, Z-007 and Z-009

Both rewritten in `docs/NEXUS_JOURNEY_UNIVERSE.md` (in place, historical note preserved in each journey's own Notes field explaining the prior framing and why it changed). Batch 29 denominator unchanged at 25; no new journey ID created for either.

**Journey Discovery: CANDIDATE FOUND (2), both EXPAND_EXISTING_JOURNEY (self, in place)**

| Finding | Disposition | Action |
|---|---|---|
| Z-007's pre-PG-040 text asked "does any recovery path exist" as an open question | EXPAND_EXISTING_JOURNEY (Z-007 itself) | Rewritten to test the decided PG-040 behavior (existing work stays actionable + dual banners + new-routing blocked); historical note preserved. |
| Z-009's pre-O-018 text called zero-active-members "a real, confirmed, unhandled gap" instructing it be logged as an open Product Gap | EXPAND_EXISTING_JOURNEY (Z-009 itself) | Rewritten to test the accepted "warn but allow" behavior; historical note preserved. |

## Step 1: Classification of all 25 journeys (before execution)

| Journey | Evidence class | Manual UX assertions | Server/DB assertions | Persona / tooling |
|---|---|---|---|---|
| W-008 Double Reject | MIXED MANUAL + SERVER | Real double-click Reject; visible already-rejected message | Exactly one rejection transition row | Reviewer (nexus-test-legal), fresh tab |
| W-009 Double Send Back | MIXED MANUAL + SERVER | Real double-click Send Back; visible message | workflow_cycle_number increments once; one transition row | Reviewer, fresh tab |
| W-010 Double Cancel | MIXED MANUAL + SERVER | Real double-click Cancel; visible message | One cancellation state, no duplicate | Maker (nexus-test-maker), fresh tab |
| W-011 Duplicate Save Draft | MIXED MANUAL + SERVER | Real double-click Save Draft, identical content; success toast both times | No duplicate draft row; document actual row_version behavior | Maker, fresh tab |
| W-012 Retry Submit after timeout | MIXED MANUAL + SERVER (TOOLING-CONSTRAINED for true client-timeout injection) | Real Submit click; UX resolves uncertainty on retry | Exactly one submitted request regardless of timing window | Maker; genuine client-side timeout injection unsupported by available tooling, scoped as PARTIAL for that specific dimension, RPC replay used for the integrity dimension |
| W-013 Retry Approve after timeout | MIXED MANUAL + SERVER (TOOLING-CONSTRAINED for true client-timeout injection) | Same pattern as W-012, for Approve | Exactly one terminal mutation regardless of retry | Approver; same tooling caveat |
| W-014 Direct RPC replay | SERVER/DB ONLY | N/A by design (bypasses UI) | Exactly one mutation/transition row across 5-10 replays | Direct SQL, technical tester |
| W-015 Refresh after Submit/Approve | MIXED MANUAL + SERVER | Real browser refresh at multiple timings; correct post-reload state | Exactly one mutation | Maker/Approver, fresh tab |
| W-016 Browser Back then repeat | MIXED MANUAL + SERVER | Real browser Back; real click on stale control | No duplicate mutation | Maker/Approver, fresh tab, real back navigation |
| W-017 Browser Forward then repeat | MIXED MANUAL + SERVER | Real browser Forward (not manual URL reopen); real click | No duplicate mutation | Same session as W-016 |
| W-018 Two-tab same-user double approve | MIXED MANUAL + SERVER | Two real tabs, same login; both click Approve | Exactly one transition regardless of tab order | Approver, two real browser tabs |
| W-019 Rapid double Save with content change | MIXED MANUAL + SERVER | Real edit-save-edit-save; two distinct success confirmations | Final content reflects both edits cumulatively | Maker, fresh tab |
| W-020 Retry Reject/Send Back after timeout | MIXED MANUAL + SERVER (TOOLING-CONSTRAINED for true client-timeout injection) | Same pattern as W-012/013, for Reject and Send Back | Exactly one terminal mutation per action type | Reviewer; same tooling caveat |
| W-021 Resubmit cancelled request | MIXED MANUAL + SERVER | Real UI check that Submit is unavailable/rejected on a cancelled record | No transition out of cancelled state; direct RPC replay also rejected | Maker, fresh tab + direct RPC |
| Z-001 Session expiry during draft edit | MIXED MANUAL + SERVER | Real session expiry (cookie/session row revoke), real Save attempt, observe re-auth prompt | Save rejected server-side; no partial write | Maker, fresh tab, safe fictional-persona session expiry mechanism |
| Z-002 Session expiry during approval | MIXED MANUAL + SERVER (TOOLING-CONSTRAINED for exact in-flight-millisecond timing) | Real pre-action session expiry, real Approve click, observe re-auth | Zero partial transition | Approver; exact in-flight-microsecond expiry unsupported, scoped honestly |
| Z-003 Network failure after send | PARTIAL / TOOLING-CONSTRAINED CANDIDATE | N/A (true response-severance unsupported) | Retry/integrity portions still verified via RPC replay | No safe local proxy/failpoint available; scoped as PARTIAL, not faked |
| Z-004 Browser refresh during save | MIXED MANUAL + SERVER | Real refresh at multiple offsets | No corrupted intermediate state | Any user, fresh tab |
| Z-005 Browser close after Submit | MIXED MANUAL + SERVER (TOOLING-CONSTRAINED for exact close timing) | Real tab close via tabs_close, real reopen/login | Server transaction unaffected by client disconnect | Maker, two tab operations |
| Z-006 Stale approval page, other actor acted | MIXED MANUAL + SERVER | Real Reviewer A stale page, real Reviewer B action first, real stale click | Zero duplicate transition | Two personas, two real logins |
| Z-007 Team inactive in flight (rewritten) | MIXED MANUAL + SERVER | Real review-page banner + Operational Queue banner; real successful action by remaining member | New-routing block via WORKFLOW_TEAM_INACTIVE, zero mutation on block | Team Admin + remaining member persona |
| Z-008 Reference value inactive mid-draft | MIXED MANUAL + SERVER | Real draft UI retains inactive selection; real submit/approve proceeds | DB shows preserved value through approval | Maker + Reference Master Admin |
| Z-009 Zero eligible members (rewritten) | MIXED MANUAL + SERVER | Real Operational Queue banner; real recovery after admin adds member | No transition while stuck; resumes cleanly after fix | Team Admin + any actor |
| Z-010 Storage object missing | MIXED MANUAL + SERVER | Real viewer click on document control; real "file unavailable" outcome | Metadata row exists, storage object deliberately absent (disposable test fixture) | Viewer persona, disposable test document |
| Z-011 Partial/failed upload | INVESTIGATIVE (source-inspection for upload ordering) + MIXED MANUAL + SERVER where reproducible | Real viewer click on the same "file unavailable" control on a metadata-without-storage row | Source-inspected upload ordering; DB fixture reproduces the failure-mode state | Viewer persona, disposable test document; genuine interrupted-upload timing unsupported, scoped honestly if so |

Totals: MANUAL/MIXED-bearing = 24 (all except W-014). SERVER/DB ONLY = 1 (W-014). No journey is classified purely from "Automation Feasibility: FULL"; each classification above reflects the actual business scenario's dependence on browser-observable behavior per Step 1's explicit criteria.

## Step 2: Manual UX Readiness Gate

Confirmed live (fresh tab, `http://localhost:3000`):
- App reachable: SUPPORTED. `/my-work` renders (44/24-item queues visible).
- Onboarding, Customer Change, Commercial Configuration, Go Live review routes: SUPPORTED (all four confirmed reachable this session; Go Live re-confirmed fresh via `/customers/aurora-consumer-labs/go-live`).
- Maker persona (`nexus-test-maker`) and Checker personas (`nexus-test-legal`, `nexus-test-finance-b`, `nexus-test-ux-approver`, `nexus-test-team-admin`, `nexus-test-reference-master-admin`): SUPPORTED, login/logout proven repeatedly.
- Session switching: SUPPORTED via explicit logout + re-login (shared cookie jar means a bare `/login` visit while already authenticated silently redirects; always click real "Log out" first).
- Same-user two real tabs: SUPPORTED (`tabs_create` opens a second tab sharing the same session cookie).
- Fresh-tab recovery for stale clicks: SUPPORTED, established pattern (a tab that has navigated/logged in several times sometimes reports a stale `0x0` viewport; opening a new tab resolves it).
- Browser Back/Forward: SUPPORTED (`navigate` accepts literal `"back"`/`"forward"`).
- Browser tab close: SUPPORTED (`tabs_close`).
- Session expiry (Z-001/Z-002): SUPPORTED via a safe, real mechanism confirmed against actual source: `getCurrentNexusSession()` (`src/platform/auth/server.ts`) calls `supabase.auth.getUser()` on every server request, which revalidates against the Auth server rather than only decoding a cached JWT. Deleting a fictional test persona's row(s) from `auth.sessions` (confirmed present and populated) forces the next server request under that persona's cookie to fail auth, without touching passwords, real users, or auth code. No credential reset, no stored-credential inspection, no bypass.
- Network timeout / genuine response severance (Z-003, part of W-012/W-013/W-020, part of Z-002/Z-005): TOOLING LIMITATION. No local proxy/failpoint is available in this environment to let a request reach the server while dropping the response before the client receives it, or to deterministically pause a real client-side fetch mid-flight. Scoped honestly per journey below; RPC replay is used only for the integrity/idempotency dimension, never presented as proof of the exact timing/UX dimension.
- Document missing / partial-upload (Z-010/Z-011): SUPPORTED for the missing-object case via direct, disposable test-fixture storage manipulation (a metadata row with no corresponding storage object is a safe, real reproducible state); Z-011's genuine interrupted-upload timing is scoped per its own execution below.

**MANUAL UX GATE = PASS**, with the network-timing dimensions above pre-declared as TOOLING LIMITATION rather than discovered mid-journey.

## Step 3: Timeout vs network failure, distinguished upfront

Per instruction, W-012/W-013/W-020 (apparent client timeout/retry) and Z-003 (genuine response severance) are NOT merged. W-012/013/020 test the retry-safety/idempotency guarantee (verifiable via real UI retry attempts plus RPC replay for the integrity claim) without needing to literally sever a network connection. Z-003's specific "response reaches nothing, but the request already committed server-side" timing requires true network severance, which is unsupported; Z-003 is scoped PARTIAL/TOOLING LIMITATION for that exact dimension only, with the independently-testable retry/idempotency portion still verified.

---

## Journey Evidence

### W-008: Double Reject on a governed request

MANUAL UX VERIFIED + DATABASE VERIFIED. Persona: `nexus-test-legal` (reviewer, not creator). Domain: Customer Change. Used a real existing submitted request (CCR-000163, `600a363b-...`, Aurora Consumer Labs, created by Nexus Test Maker) already in this environment.

Action taken: opened the real review page, clicked "Reject" (revealing a real "Reason for rejecting" textbox + Cancel/Confirm Reject), filled the reason, then performed a genuine `double_click` on the real "Confirm Reject" button.

Visible result: the browser navigated to the Approvals list; CCR-000163 no longer appears in "Needs My Action" (terminal state). Network log evidence: exactly one `POST /reviews/change-requests/600a363b-...` fired for the double-click, not two.

Database evidence: `customer_change_requests` shows exactly `status = rejected`, one `decided_by`/`decision_reason` pair. `workflow_node_transitions` for this resource contains exactly two rows total (one `submit`, one `reject`), confirming a single, unambiguous rejected state with no duplicate rejection record.

Journey Discovery: NONE.

Classification: PASS.

Journey W-008 complete — PASS.
Batch 29: 1/25 attempted — 24 remaining.
Active Product Gaps: 0.
Next: W-009.

### W-009: Double Send Back on a governed request

MANUAL UX VERIFIED + DATABASE VERIFIED. Persona: `nexus-test-legal` (reviewer, not creator). Domain: Go Live. Used a real existing submitted request (GLR-000049, `11ff2395-...`, W007 Stress Test Customer, created by Nexus Test Maker, node_4/Legal Approval).

Action taken: opened the real review page, clicked "Send Back" (revealing a real "Reason for sending back" textbox + Cancel/Confirm Send Back), filled the reason, performed a genuine `double_click` on "Confirm Send Back".

Visible result: page updated in place to "Sent Back", with a real Timeline entry "Legal Approval sent back · 29 Sept 2026, 10:50 am · Nexus Test Legal Approver" quoting the exact reason. Network log: exactly one `POST /customers/w007-stress-onboarding-customer/go-live/11ff2395-...` for the double-click.

Database evidence: `go_live_requests` shows `status = sent_back`, `workflow_cycle_number` incremented from 1 to exactly 2 (not 3). `workflow_node_transitions` contains exactly two rows (one `submit` at cycle 1, one `send_back` at cycle 1), confirming a single cycle increment and no duplicate send-back record.

Journey Discovery: NONE.

Classification: PASS.

Journey W-009 complete — PASS.
Batch 29: 2/25 attempted — 23 remaining.
Active Product Gaps: 0.
Next: W-010.

### W-010: Double Cancel on a governed request

MANUAL UX VERIFIED + DATABASE VERIFIED. Persona: `nexus-test-maker`. Domain: Customer Change. Created a fresh draft (CCR-000164, `bc33ceb3-...`, Aurora Consumer Labs).

Action taken: clicked the real "Cancel Draft" button (revealing a real "Cancel this draft? This cannot be undone" confirmation with an optional reason field), then performed a genuine `double_click` on the real "Confirm Cancel" button.

Visible result: the page updated in place to "Cancelled" with the message "This Change Request has already been cancelled and can no longer be edited," no Submit control remains. Network log: exactly one `POST /customers/aurora-consumer-labs/change-requests/bc33ceb3-...` fired for the double-click on Confirm Cancel (the earlier click revealing the confirm dialog is pure client-side state, no network call).

Database evidence: `customer_change_requests` shows exactly `status = cancelled`, one `cancelled_by`. `audit_log` for this row contains exactly two entries (one `INSERT` at draft creation, one `UPDATE` at cancellation), confirming a single, unambiguous cancelled state with no duplicate cancellation record.

This same cancelled record (`bc33ceb3-...`, CCR-000164) is retained as the real fixture for W-021's resubmission test later in this batch.

Journey Discovery: NONE.

Classification: PASS.

Journey W-010 complete — PASS.
Batch 29: 3/25 attempted — 22 remaining.
Active Product Gaps: 0.
Next: W-011.

### W-011: Duplicate Save Draft (same content saved twice in a row)

MANUAL UX VERIFIED + DATABASE VERIFIED. Persona: `nexus-test-maker`. Domain: Customer Change. Created a fresh draft (CCR-000165, `cae6f624-...`, Northstar Consumer Products), set Website to a fixed value, clicked "Save Draft" once (establishing the already-persisted content the canonical's Starting State requires; `row_version` = 1 at this point).

Action taken: with no intervening edits, performed a genuine `double_click` on the same "Save Draft" button.

Visible result: page still shows "Draft", the same persisted Website value, no error. Network log evidence: this time **two** real `POST` requests fired (unlike the terminal-action journeys W-008/009/010, Save Draft has no client-side pending-disable guard), documenting the actual button behavior honestly rather than assuming a single request.

Database evidence: `row_version` remained exactly `1` after both saves (confirming, as the canonical itself anticipates, that `row_version` is not wired to draft-save increments on this table). `audit_log` for this row shows exactly 3 entries total (1 `INSERT` at creation, 1 `UPDATE` at the first manual save, 1 more `UPDATE` after the double-click), i.e. of the two real network saves sent by the double-click, one persisted (redundant with already-identical content) and the DB layer did not log a second no-op change; `select count(*) where request_number = 165` confirms exactly one draft row exists throughout, no duplicate row created.

This documents the actual mechanism precisely per the canonical's own instruction ("document actual increment behavior") rather than assuming a single-request outcome from the terminal-action pattern.

Journey Discovery: NONE.

Classification: PASS.

Journey W-011 complete — PASS.
Batch 29: 4/25 attempted — 21 remaining.
Active Product Gaps: 0.
Next: W-012.

### W-012: Retry Submit after an apparent client-side timeout

MIXED MANUAL + SERVER VERIFIED. Persona: `nexus-test-maker`. Domain: Customer Change. Reused CCR-000165 (`cae6f624-...`, still a draft after W-011).

TOOLING LIMITATION declared upfront (per Step 1/Step 3): no local proxy/failpoint is available to genuinely delay or drop a real client response while the server call is still in flight, so the exact "user sees no confirmation, assumes failure" timing cannot be manufactured. What IS verified: (1) the Manual UX dimension under real, normal conditions (a real Submit click resolves definitively, with no indefinite unknown-state screen), and (2) the retry-safety/idempotency dimension via a direct RPC replay using the identical payload, which is exactly what a real client retry would send.

Action taken: filled Reason/Effective Date, clicked the real "Submit" button once; the page transitioned cleanly to the submitted detail view with no lingering spinner or ambiguous state. Confirmed `status = submitted` in the DB. Then called `submit_customer_change_request` directly via SQL with the identical payload (same reason, same effective date, same actor) to simulate the retry a user would trigger after an apparent timeout.

Result: the replay raised `CUSTOMER_CHANGE_NOT_SUBMITTABLE: request ... has status submitted, only draft or sent_back may be submitted`, a specific, named error, not a generic failure or duplicate submission. `workflow_node_transitions` for this resource contains exactly one `submit` row. Reloaded the real detail page: it shows the true current state ("Submitted... This Change Request has already been submitted and can no longer be edited"), resolving any uncertainty definitively rather than leaving an indefinite unknown state.

Journey Discovery: NONE.

Missing dimension: genuine client-side timeout / apparent-failure perception while the original server call is still in flight. No local proxy or failpoint is available to delay or drop a real response without also blocking the request, so this canonical journey's own defining scenario was not reproduced. The Manual UX baseline (a real Submit resolving definitively) and the RPC-level retry/idempotency dimension were genuinely verified and remain valid.

Classification: PARTIAL / TOOLING LIMITATION. The canonical journey's defining scenario, exact-timeout injection, is unsupported by available tooling and was not reproduced, so the overall journey is reclassified from PASS to PARTIAL. The supporting Manual UX and RPC-level idempotency evidence above is preserved and remains valid.

Journey W-012 complete — PARTIAL / TOOLING LIMITATION.
Batch 29: 5/25 attempted — 20 remaining.
Active Product Gaps: 0.
Next: W-013.

### W-013: Retry Approve after an apparent timeout

MIXED MANUAL + SERVER VERIFIED. Persona: `nexus-test-legal` (approver, not creator). Domain: Customer Change. Reused CCR-000165 (`cae6f624-...`, now submitted at node_3 after W-012).

TOOLING LIMITATION declared upfront (same reason as W-012): genuine client-timeout injection is unsupported. Verified instead: real Approve click resolving definitively, plus RPC-level retry-safety via direct replay.

Action taken: clicked the real "Approve" button once; DB confirmed the request correctly advanced from node_3 to node_4 (a 2-stage workflow). Then called `approve_customer_change_request` directly via SQL with the same actor and the stale `p_expected_current_node_key = 'node_3'` (what a retrying client would still believe is current), simulating the retry a user would trigger after an apparent timeout.

Result: raised `WORKFLOW_NODE_ALREADY_ADVANCED: this step was already decided by someone else. Refresh to see the current status.`, a specific, friendly error rather than a duplicate mutation. `workflow_node_transitions` for this resource contains exactly one `approve` row (plus the one `submit` row); no duplicate terminal mutation.

Journey Discovery: NONE.

Missing dimension: genuine client-side timeout / apparent-failure perception while the original server call is still in flight, for the Approve action. Same tooling caveat as W-012. The Manual UX baseline (a real Approve resolving definitively) and the RPC-level retry/idempotency dimension were genuinely verified and remain valid.

Classification: PARTIAL / TOOLING LIMITATION. The canonical journey's defining scenario, exact-timeout injection, is unsupported by available tooling and was not reproduced, so the overall journey is reclassified from PASS to PARTIAL. The supporting Manual UX and RPC-level idempotency evidence above is preserved and remains valid.

Journey W-013 complete — PARTIAL / TOOLING LIMITATION.
Batch 29: 6/25 attempted — 19 remaining.
Active Product Gaps: 0.
Next: W-014.

### W-014: Same RPC payload replayed twice via direct call (bypassing the UI)

SERVER/RPC VERIFIED + DATABASE VERIFIED. Domain: Customer Change (deliberately server/RPC-only by design; no UI involved, matching this journey's own explicit purpose). Reused CCR-000165 (`cae6f624-...`, now at node_4/Leadership Approval after W-013).

Action taken: called `approve_customer_change_request` directly via SQL as `nexus-test-ux-approver` (`df6bb6ba-...`, the genuine eligible actor at node_4) with identical arguments (`p_expected_current_node_key = 'node_4'`), 7 times total: the first call, then 6 more replays with byte-identical arguments.

Result: the first call succeeded (`status = approved`, `decided_at = 2026-09-29 05:32:21.670447`). All 6 replays returned the exact same row, same `decided_at` timestamp, no error, no new mutation, matching PG-036's decided same-actor-idempotent-replay behavior.

Database evidence: `workflow_node_transitions` for this resource contains exactly 3 rows total across the entire request lifecycle (1 `submit`, 1 `approve`@node_3, 1 `approve`@node_4), i.e. exactly one mutation/transition for the final approval step despite 7 total RPC calls.

Journey Discovery: NONE. This reconfirms the same RPC-level status-guard mechanism already established in W-001/W-002/V-044/W-005/W-006, at the node_4-specific final-approval step.

Classification: PASS.

Journey W-014 complete — PASS.
Batch 29: 7/25 attempted — 18 remaining.
Active Product Gaps: 0.
Next: W-015.

### W-015: Refresh immediately after Submit

MANUAL UX VERIFIED + DATABASE VERIFIED. Persona: `nexus-test-maker`. Domain: Customer Change. Created a fresh draft (CCR-000166, `09e0ed48-...`, Aurora Consumer Labs).

Action taken: filled Reason/Effective Date/Website, clicked the real "Submit" button, then immediately (next tool call, no intervening wait) navigated the same tab back to the same URL, simulating a real browser refresh right after the click before any confirmation was consciously observed.

Visible result: the reloaded page shows the true, current state directly ("Submitted... This Change Request has already been submitted and can no longer be edited"), not a stale pre-submit draft view and no browser form-resubmission prompt (Next.js Server Actions do not leave a re-POSTable form state behind on a plain navigation/reload).

Database evidence: exactly one row in `workflow_node_transitions` for this resource (`submit`), confirming the refresh did not cause the action to be reapplied or duplicated.

Journey Discovery: NONE.

Classification: PASS.

Journey W-015 complete — PASS.
Batch 29: 8/25 attempted — 17 remaining.
Active Product Gaps: 0.
Next: W-016.

### W-016: Browser Back then repeat the action

MANUAL UX VERIFIED + DATABASE VERIFIED. Persona: `nexus-test-legal`. Domain: Customer Change. Reused CCR-000166 (`09e0ed48-...`).

Action taken: clicked the real "Approve" button (node_3), which navigated away. Used real browser Back (`navigate(tabId, "back")`, not a manually re-opened URL). The page re-rendered showing the request had already advanced (Timeline showed "Legal Approval approved") yet still rendered a stale, clickable "Approve" button (the review-decision controls do not conditionally hide based on "did I, this specific actor, already act here"). Clicked that real, stale "Approve" button again.

Visible result: the page re-rendered in place with the exact PG-037 segregation-of-duties message: "you already approved an earlier step of this request. A different approver must decide this step." No misleading success, no crash.

Database evidence: `workflow_node_transitions` for this resource still contains exactly 2 rows (`submit`, `approve`@node_3); the stale re-click produced zero new transition.

Journey Discovery: NONE. This is the same PG-037 mechanism reconfirmed under the Back-navigation framing specifically requested by this journey, not a new finding.

Classification: PASS.

Journey W-016 complete — PASS.
Batch 29: 9/25 attempted — 16 remaining.
Active Product Gaps: 0.
Next: W-017.

### W-017: Browser Forward then repeat the action

MANUAL UX VERIFIED + DATABASE VERIFIED. Persona: `nexus-test-legal`. Domain: Customer Change. Continued directly from W-016's end state (same tab, same CCR-000166, `09e0ed48-...`).

Action taken: from W-016's end state (stale review page after a real Back navigation, stale "Approve" rejected), used real browser Forward (`navigate(tabId, "forward")`, not a manually reopened URL). Forward landed on the true current-state destination page (the Aurora Consumer Labs customer overview, the page the original Approve click had redirected to), which correctly renders live current data and has no repeatable review-decision control, so there was nothing stale to re-click there. To exercise the mirror case the journey actually asks for (a stale actionable page reached via a navigation path that includes Forward), used one further real Back to return to the stale CCR-000166 review page (confirmed non-stale viewport, 1280x720, real interactive Approve/Send Back/Reject controls present), then clicked the real, stale "Approve" button again.

Visible result: identical PG-037 segregation-of-duties message as W-016 ("you already approved an earlier step of this request. A different approver must decide this step."). No misleading success, no crash, no duplicate action.

Database evidence: `workflow_node_transitions` for this resource still contains exactly 2 rows (`submit`, `approve`@node_3 to node_4), `current_workflow_node_key` still `node_4`, `workflow_cycle_number` still 1. The Forward-involved navigation path produced zero new transition.

Journey Discovery: NONE. Same PG-037 mechanism reconfirmed; the status-guard protects regardless of navigation path taken to reach the stale page, exactly as the canonical anticipated.

Classification: PASS.

Journey W-017 complete — PASS.
Batch 29: 10/25 attempted — 15 remaining.
Active Product Gaps: 0.
Next: W-018.

### W-018: Two real tabs, same authenticated user, double approve

MANUAL UX VERIFIED + DATABASE VERIFIED. Persona: `nexus-test-legal` on two independent real browser tabs (tab-14, tab-15), same authenticated session (shared cookie jar). Domain: Customer Change. Fresh fixture: created a new draft as `nexus-test-maker` (CCR-000167, `aa9f1527-dcdb-4508-adf8-c5c70d917894`, Aurora Consumer Labs, Website change), submitted it to reach node_3 pending Legal Approval.

Action taken: logged in as `nexus-test-legal`, opened the same CCR-000167 review URL in two genuinely separate tabs (both real navigations, both confirmed non-stale via a full `read_page` tree before clicking), each independently showing the pre-action "Approve / Send Back / Reject" controls. Clicked the real "Approve" button on tab-14, then immediately clicked the real "Approve" button on tab-15.

Visible result: tab-14's click succeeded and navigated away (redirected toward the customer page, the same real post-approve destination seen in W-016/W-017). Tab-15's click was rejected in place with a distinct, graceful message: "This approval has already moved to the next step. Refresh to see its current status." (a Refresh action offered), not a crash and not a silently accepted duplicate.

Database evidence: `workflow_node_transitions` for this resource contains exactly 2 rows (`submit`, `approve`@node_3 to node_4), confirming the two real, near-simultaneous tab clicks by the same actor produced exactly one transition, not two.

Journey Discovery: NONE. This is a new concurrency guard message ("already moved to the next step") distinct from PG-036 (same-actor idempotent replay) and PG-037 (cross-node segregation of duties), but it protects the identical invariant (server-side status/version guard blocks a stale client from reapplying a decision) already covered by the existing mechanism; not a new defect or a new journey, consistent with Step 14/15's instruction not to open a duplicate finding for the same underlying protection.

Classification: PASS.

Journey W-018 complete — PASS.
Batch 29: 11/25 attempted — 14 remaining.
Active Product Gaps: 0.
Next: W-019.

### W-019: Rapid double Save Draft with a genuine content change in between

MANUAL UX VERIFIED + DATABASE VERIFIED. Persona: `nexus-test-maker`. Domain: Customer Change. Fresh fixture: created a new draft (CCR-000169, `944f71ec-56ad-48f5-9fcf-7e4c5df8ebbe`, Aurora Consumer Labs), single writer, single real browser tab throughout.

Action taken: filled Primary Contact Name with "W-019 Contact A", clicked the real "Save Draft" button. Immediately after the save completed, edited the same field to "W-019 Contact B" (a genuine, distinct second edit, not a repeat of the first), clicked the real "Save Draft" button again.

Visible result: after the first save, "Current vs Proposed" showed Primary Contact Name proposed as "W-019 Contact A". After the second save, it showed "W-019 Contact B", the later edit, with no reversion and no merge artifact.

Database evidence: `submission_revisions` for this request shows a single revision row at `row_version = 3` (1 for creation plus exactly 2 for the two real saves, confirming neither save was dropped nor duplicated) with `raw_data.primary_contact_name = "W-019 Contact B"`, the cumulative, later value. `audit_log` shows exactly one INSERT (draft creation) and exactly two UPDATE rows against `customer_change_requests` for this resource, matching the two real Save Draft clicks one-to-one.

Journey Discovery: NONE. Confirms the platform correctly treats each Save Draft as a distinct, intentional mutation (no no-op guard incorrectly suppressing a genuine second edit), the mirror case of W-011's identical-content double-save.

Classification: PASS.

Journey W-019 complete — PASS.
Batch 29: 12/25 attempted — 13 remaining.
Active Product Gaps: 0.
Next: W-020.

### W-020: Retry Reject and Send Back after an apparent timeout

MANUAL UX VERIFIED + DATABASE VERIFIED. Domain: Customer Change, two fixtures.

Reject variant: persona `nexus-test-legal`. Fresh fixture CCR-000169 (`944f71ec-56ad-48f5-9fcf-7e4c5df8ebbe`) submitted to node_3. Clicked the real "Reject" button, filled the reason, then real double-clicked the real "Confirm Reject" button back to back (simulating the user retrying after not seeing a timely response). First click succeeded and navigated away to the Approvals list; the second click landed on the destination page, harmless. Database evidence: `workflow_node_transitions` for this resource contains exactly 2 rows (`submit`, `reject`), confirming no duplicate rejection.

Send Back variant: first attempt used the same actor (`nexus-test-legal`) as both creator and reviewer of a fresh fixture (CCR-000171). This surfaced a real, correct guard, not a defect: "you cannot send back your own request. Another authorized checker must review it." Both real double-click attempts hit this same self-review guard with zero mutation (`workflow_node_transitions` showed only the `submit` row), which validated the guard but did not exercise the actual retry-after-timeout question, so the test was redone with genuinely separate actors. Second attempt: created CCR-000172 (`4c36b971-8b4f-42e0-b199-8a719a9652f1`) as `nexus-test-maker`, submitted to node_3, then reviewed and sent back as `nexus-test-legal` (a distinct real actor). Clicked "Send Back", filled the reason, then real double-clicked "Confirm Send Back" back to back. First click succeeded and navigated away; second click landed on the destination page. Database evidence: `workflow_node_transitions` for this resource contains exactly 2 rows (`submit`, `send_back`), confirming no duplicate send-back.

Journey Discovery: NONE for the core retry question (same status-guard mechanism as W-008/W-009 protects both action types under retry, exactly as the canonical anticipated). The self-review block on Send Back is a pre-existing correct guard (a same-actor create-then-decide restriction, distinct from but consistent in spirit with PG-037's cross-node segregation of duties and V-044's self-approval block); not a new Product Gap, not a defect, and not a new journey since it is the expected, safe behavior of an existing protection layer encountered incidentally while sourcing a fixture.

Classification: PASS.

Journey W-020 complete — PASS.
Batch 29: 13/25 attempted — 12 remaining.
Active Product Gaps: 0.
Next: W-021.

### W-021: Attempting to resubmit a cancelled request

MANUAL UX VERIFIED + SERVER/RPC VERIFIED + DATABASE VERIFIED. Persona: `nexus-test-legal`. Domain: Customer Change. Fresh fixture: created draft CCR-000173 (`faf6b94f-862e-4164-990a-0def5df712fb`, Aurora Consumer Labs, Website change), then clicked the real "Cancel Draft" button and confirmed via the real "Confirm Cancel" dialog, reaching terminal `cancelled` status.

Action taken: after cancellation, the UI correctly re-rendered with no Submit control at all ("This Change Request has already been cancelled and can no longer be edited"), so there is no genuinely reachable stale-UI path for this specific draft-editing route (unlike the review-decision buttons in W-016 through W-018, this route fully re-renders from server state and does not leave a stale actionable control behind). Per the canonical's own explicit alternative ("via a stale cached page or direct RPC call"), called the `submit_customer_change_request` RPC directly against the cancelled request's id.

Visible/server result: the RPC raised `CUSTOMER_CHANGE_NOT_SUBMITTABLE: request ... has status cancelled, only draft or sent_back may be submitted`, a clear, specific rejection distinguishing this from the ordinary draft-to-draft double-submit guard.

Database evidence: after the attempt, `customer_change_requests` still shows `status = cancelled`, `row_version` unchanged, and `workflow_node_transitions` has zero rows for this resource (the draft never entered the workflow, consistent with cancellation happening pre-submit). No transition out of the cancelled terminal state occurred and no new workflow instance was spawned.

Journey Discovery: NONE. Confirms cancelled requests stay cancelled with no accidental resurrection path, and additionally confirms (not previously explicitly noted) that the draft-editing UI, unlike the review-decision UI, does not exhibit the same stale-control-after-terminal-transition pattern; not a defect in either direction, just a difference between two page types worth having on record.

Classification: PASS.

Journey W-021 complete — PASS.
Batch 29: 14/25 attempted — 11 remaining.
Active Product Gaps: 0.
Next: Z-001.

### Z-001: Session expires while a draft is being edited

MANUAL UX VERIFIED + DATABASE VERIFIED. Persona: `nexus-test-legal` (fictional test persona; safe mechanism per Step 2's Gate, established via direct source read of `getCurrentNexusSession` calling `supabase.auth.getUser()` and confirming `auth.sessions` is a real, deletable table). Domain: Customer Change. Fresh fixture: created draft CCR-000174 (`b752bf5f`-customer Aurora Consumer Labs), edited Website to a new value in the real browser, left it unsaved.

Action taken: deleted the actor's `auth.sessions` row directly via SQL (`delete from auth.sessions where id = ...`), the real, safe, fictional-persona-only mechanism for simulating natural session expiry without touching passwords, credentials, or auth code. Then clicked the real "Save Draft" button in the still-open browser tab.

Visible result: the page navigated to the login screen ("Sign in to continue."), the same generic form shown to any never-authenticated visitor, with no distinguishing "your session expired" messaging.

Database evidence: `customer_change_requests.row_version` and the linked `submission_revisions` row's content were unchanged after the attempt (Website field still null server-side), confirming the save was cleanly rejected server-side with no partial or corrupted write. The hard Audit/Data Integrity requirement holds.

Journey Discovery: PRODUCT GAP CONFIRMED then CLOSED SAME DAY, registered and closed as **PG-059** in `docs/OPEN_PRODUCT_GAPS.md`. Utkarsh's decision (2026-09-29): redirect to `/login?reason=session-expired` and show a persistent login-page banner, carrying the reason through the existing redirect rather than adding a new client-side session watcher; preserve the existing `redirectTo` return-navigation pattern; never claim unsaved edits are preserved unless they genuinely are.

Implementation: new `hasSupabaseAuthCookie` (`src/lib/supabase/server-auth-client.ts`) detects a stale `sb-*-auth-token` cookie still present when `getUser()` resolves to no user, distinguishing "was authenticated, now expired" from "never authenticated," purely server-side. `NexusSession`'s `unauthenticated` variant gained an optional `expired` flag; `getCurrentNexusSession` sets it; `AuthGate` appends `&reason=session-expired` to its existing `/login` redirect only when set; the login route/page reads `reason` and shows a `warning`-styled banner ("Your session expired. Please sign in again to continue.") reusing the existing design token. The existing `unavailable`/`inactive`/permission-denied states and the `redirectTo` return-navigation mechanism were untouched.

Regression coverage added (12 new tests): `hasSupabaseAuthCookie` cookie-name matching (4), `getCurrentNexusSession`'s new expired branch plus a cookie-read-failure fallback (2), `AuthGate`'s two redirect variants plus its unaffected `unavailable`/`inactive` branches (4), `LoginPage`'s banner rendering across all three states (2 new files' worth: server-auth-client.test.ts and login-page.test.tsx are entirely new; server.test.ts and auth-gate.test.tsx gained tests within existing files). Full suite (1110 tests, up from 1098) and `tsc --noEmit` both pass.

Live re-verification: revoked a real fictional persona's (`nexus-test-legal`) `auth.sessions` row mid-edit on a fresh draft, attempted a real Save Draft, confirmed via network log that the redirect carried `reason=session-expired`; a hard navigation to that URL rendered the banner (screenshot captured). Confirmed `customer_change_requests.row_version` and the draft's `submission_revisions` content were unchanged (no partial/corrupted write). Confirmed a plain `/login` visit with no `reason` param shows no banner. Confirmed re-authenticating from the expired-session redirect correctly returned to the original draft URL, showing its true (unsaved-edit-lost) persisted state, not a false success and not an auto-replayed mutation.

Classification: PRODUCT GAP RESOLVED + PASS.

Journey Z-001 complete — PRODUCT GAP RESOLVED + PASS (PG-059).
Batch 29: 15/25 attempted — 10 remaining.
Active Product Gaps: 0 (PG-059 closed same day).
Next: Z-002.

### Z-002: Session expires during an approval action

MANUAL UX VERIFIED + DATABASE VERIFIED. Personas: `nexus-test-maker` (creator) and `nexus-test-legal` (approver, a genuinely separate actor to avoid the self-review guard discovered in W-020). Domain: Customer Change. Fresh fixture: CCR-000178 (`7b2302f4-6b37-4a78-bcd4-07241921bdaf`, Aurora Consumer Labs, Website change), created and submitted by the maker, reaching node_3.

Action taken: logged in as the real approver, opened the real review page (Approve/Send Back/Reject all visible), then revoked the approver's `auth.sessions` row (same safe, fictional-persona-only mechanism as Z-001), then clicked the real "Approve" button with the now-invalid session.

Visible/server result: the click redirected to `/login?redirectTo=...&reason=session-expired` (confirmed via network log), reusing the exact PG-059 mechanism fixed in Z-001, not a separate code path; a hard reload of that URL showed the same "Your session expired" banner.

Database evidence (first attempt): `workflow_node_transitions` for this resource contained exactly 1 row (`submit`) after the failed Approve attempt; `current_workflow_node_key` was still `node_3`, `status` still `submitted`. The action was rejected entirely, not partially applied, satisfying the canonical's hard Audit/Data Integrity requirement.

Recovery/Resilience Variant: re-authenticated via the same `redirectTo` link, correctly landed back on the review page showing the true current state (still "Submitted... Needs Your Attention", not a false success), then clicked the real "Approve" button again for a genuine retry. This time it succeeded normally.

Database evidence (after retry): `workflow_node_transitions` now contains exactly 2 rows (`submit`, `approve`@node_3 to node_4), confirming the earlier failed attempt left no residue and the retry produced exactly one clean transition, not a duplicate.

Journey Discovery: NONE (beyond PG-059, already closed under Z-001; this journey reused and reconfirmed the same fix rather than surfacing a new one, exactly as expected since `AuthGate` is the single shared gate every governed mutation's page renders behind).

Classification: PASS.

Journey Z-002 complete — PASS.
Batch 29: 16/25 attempted — 9 remaining.
Active Product Gaps: 0.
Next: Z-003.

### Z-003: Network failure after the client sends a request but before the response arrives

MIXED MANUAL + SERVER VERIFIED. Persona: `nexus-test-legal`. Domain: Customer Change. Fresh fixture: CCR-000180 (`2f744185-23a7-4a52-a13f-12fe7574a3e6`, Aurora Consumer Labs, Website change).

TOOLING LIMITATION declared upfront (same reason as W-012/W-013): no local proxy/failpoint is available to genuinely sever the network after the server receives a request but before the client sees the response, so the exact timing of a real network partition cannot be manufactured. What IS verified: (1) the Manual UX dimension under real, normal conditions (a real Submit click resolves definitively, no indefinite spinner), and (2) the idempotency/retry-safety dimension via a direct RPC replay with the identical payload, which is exactly what a client retrying after either failure point (before or after the server received the original request) would send. The canonical's own Stress Variant notes both failure points "look identical client-side," so the same replay test covers both: if the original request never reached the server, a replay is just a normal fresh submit (proven safe in every other journey this batch); if it did reach the server (this test's scenario), the replay must be safely rejected, which is what was verified here.

Action taken: filled Reason/Effective Date/Website, clicked the real "Submit" button once; the page transitioned cleanly to the submitted detail view, no lingering spinner. Confirmed `status = submitted` in the DB. Then called `submit_customer_change_request` directly via SQL with the identical payload (same reason, same effective date, same actor), simulating the retry a client would send believing the original call never completed.

Result: the replay raised `CUSTOMER_CHANGE_NOT_SUBMITTABLE: request ... has status submitted, only draft or sent_back may be submitted`, a specific, named rejection, not a duplicate mutation and not a generic failure. `workflow_node_transitions` for this resource contains exactly one `submit` row despite the replay.

Journey Discovery: NONE. Confirms exactly one mutation is ever applied regardless of which of the two failure points actually occurred, per the canonical's Audit/Data Integrity Check, using the same status-guard mechanism already proven throughout Pack W.

Missing dimension: true post-send / pre-response network severance (the request reaching the server and being fully committed there, then the response being lost or the connection severed before the browser receives it). What was executed instead was a normal successful Submit followed by an identical direct RPC replay, which proves retry/idempotency safety but does not itself reproduce the response-severance timing the canonical journey describes.

Classification: PARTIAL / TOOLING LIMITATION. The canonical journey's defining scenario, genuine post-send network severance, is unsupported by available tooling and was not reproduced, so the overall journey is reclassified from PASS to PARTIAL. The Manual UX baseline and the RPC-level idempotency evidence above are preserved and remain valid.

Journey Z-003 complete — PARTIAL / TOOLING LIMITATION.
Batch 29: 17/25 attempted — 8 remaining.
Active Product Gaps: 0.
Next: Z-004.

### Z-004: Browser refresh during a save operation

MANUAL UX VERIFIED + DATABASE VERIFIED. Persona: `nexus-test-legal`. Domain: Customer Change. Fresh fixture: CCR-000182 (Aurora Consumer Labs, Website change).

Action taken: filled the Website field, clicked the real "Save Draft" button, then immediately (the very next tool call, no intervening wait) triggered a real browser reload (`window.location.reload()`), the closest offset to "mid-flight" achievable without proxy/failpoint tooling, same technique already established as sufficient for this FULL-feasibility class of journey in W-015.

Visible result: the reloaded page showed the true, fully-committed state (Website correctly showing the saved value), not a half-written or reverted-to-blank state, and no error or stuck loading indicator.

Database evidence: `submission_revisions.row_version = 2` (1 for creation, 1 for the single save), `raw_data.website` correctly persisted. A fully-consistent, valid state, never a partial write, exactly as the canonical's Idempotency Variant expects from the RPC's own transactional nature (it either fully commits or not at all, regardless of what the client does afterward).

Journey Discovery: NONE.

Classification: PASS.

Journey Z-004 complete — PASS.
Batch 29: 18/25 attempted — 7 remaining.
Active Product Gaps: 0.
Next: Z-005.

### Z-005: Browser closes immediately after Submit

MANUAL UX VERIFIED + DATABASE VERIFIED. Persona: `nexus-test-legal`. Domain: Customer Change. Two fresh fixtures, testing two genuinely different real offsets (this batch's tooling closes a tab as a hard, immediate context teardown, which turned out to reproduce both of the canonical's stress points rather than only one).

Offset 1 (close faster than the request reaches the server): fixture CCR-000184. Clicked the real "Submit" button, then closed the tab in the very next tool call with zero intervening check. Result: `customer_change_requests.status` remained `draft`, unchanged, even after a brief wait; the closed tab's in-flight request never reached/completed at the server. No corruption: the draft is exactly as it was before the click, safely resumable.

Offset 2 (close after the server has already processed the request): fixture CCR-000185 (`f1ad70f9-f2a8-40bf-872f-e08a6ea77980`). Clicked the real "Submit" button, confirmed via network log that the request/redirect cycle had already completed (a subsequent `GET /customers` 200 in the log), then closed the tab. Result: `customer_change_requests.status = submitted`, `current_workflow_node_key = node_3`, correctly and permanently committed; the tab closure after the fact had zero effect on the already-finished server-side transaction.

Journey Discovery: NONE. Together the two offsets confirm the canonical's Audit/Data Integrity Check: the server-side transaction's outcome depends only on whether it was reached/committed before the client disconnected, never on the client's continued presence afterward; on next login the request correctly shows its true post-submit (or correctly-still-draft) state in both cases.

Classification: PASS.

Journey Z-005 complete — PASS.
Batch 29: 19/25 attempted — 6 remaining.
Active Product Gaps: 0.
Next: Z-006.

### Z-006: Stale approval page after another actor has already acted

MANUAL UX VERIFIED + DATABASE VERIFIED. Persona: `nexus-test-legal` acting as both Reviewer A and Reviewer/Actor B (the canonical explicitly permits "the same request via any other actor"; the distinguishing feature here is the deliberate time gap, not distinct identities, per this journey's own framing as "the deliberately-delayed (not millisecond-race) framing" of the same mechanism shared with V-002 through V-008 and already reconfirmed as a same-tab race in W-018). Domain: Customer Change. Fresh fixture: CCR-000187 (`53c85963-84d0-401e-b0a9-39f6943ffabd`, Aurora Consumer Labs, Website change), created and submitted by `nexus-test-maker`, reaching node_3.

Action taken: opened the real review page as Reviewer A in tab-40 and left it completely untouched (no refresh, no re-navigation). Waited a genuine, deliberate ~2 minutes (a real `sleep`, several other real tool calls, and opening/using an entirely separate tab in between, not a millisecond race). In a genuinely separate tab (tab-41), opened the same review page fresh and clicked the real "Approve" button as Reviewer/Actor B; confirmed via DB the request advanced node_3 to node_4. Only then returned to Reviewer A's still-open, minutes-stale tab-40 and clicked its real, unrefreshed "Approve" button.

Visible result: Reviewer A's stale click produced the same clear, correct message already confirmed in W-018 ("This approval has already moved to the next step. Refresh to see its current status."), with a "Refresh" action offered, not a crash and not a silent no-op.

Database evidence: `workflow_node_transitions` for this resource still contains exactly 2 rows (`submit`, `approve`@node_3 to node_4, timestamped ~2 minutes apart), confirming Reviewer A's stale, deliberately-delayed action produced zero additional transition.

Journey Discovery: NONE. Reconfirms the same status-guard mechanism already proven in W-018 (two tabs) and V-002 through V-008 (millisecond race) now specifically under a genuine, deliberate multi-minute delay rather than a tight race, exactly as this journey's own "Related Journeys" framing anticipated; not a new finding.

Classification: PASS.

Journey Z-006 complete — PASS.
Batch 29: 20/25 attempted — 5 remaining.
Active Product Gaps: 0.
Next: Z-007.

### Z-007: Referenced team becomes inactive while a request is in flight (PG-040 decided behavior, chaos framing)

MANUAL UX VERIFIED + DATABASE VERIFIED. Personas: `nexus-test-maker` (creates/submits), `nexus-test-team-admin` (deactivates/reactivates the real team via the real Settings > Teams UI), `nexus-test-legal` (remaining active member of the deactivated team, acts on the request). Domain: Customer Change. Fresh fixture: CCR-000190 (`1d0146f4-333d-465a-84f7-03e9b6cf06ad`, Aurora Consumer Labs), submitted to node_3, whose responsible team is the real `WF-TEST Legal` team (`wf_test_legal`, id `9f719de7-...`).

Action taken: as Team Admin, clicked the real "Deactivate" button for `WF-TEST Legal` in Settings > Teams (confirmed via DB: `is_active = false`). As the remaining active member (`nexus-test-legal`), opened the real review page fresh.

Visible result: the review page rendered the exact specified warning ("The responsible team for this step, WF-TEST Legal, has been deactivated. Existing eligible members of this team can still act on this request. No new work will be routed to this team going forward.") with Approve/Send Back/Reject all still enabled. Clicked the real "Approve" button; it succeeded normally. Separately checked the real Operational Queue list view while the team was still inactive: it showed a "Team inactive" signal next to "WF-TEST Legal" for another item (CCR-000055) still pending at the same node, confirming the second required UX surface independently of the first.

Database evidence: `workflow_node_transitions` for CCR-000190 shows exactly 2 rows (`submit`, `approve`@node_3 to node_4), a normal transition with no corruption from having acted while the team was inactive.

Recovery/Resilience Variant: reactivated `WF-TEST Legal` via the real "Activate" button; confirmed the review page for the still-pending CCR-000055 no longer shows the warning banner. No recovery action was ever required for the already-eligible member to act, since the request never became unactionable in the first place, exactly as PG-040's decided behavior specifies.

Journey Discovery: NONE. All three parts of PG-040's decided behavior (existing work stays actionable, dual visible warnings, no code regression) reconfirmed fresh in this batch; this journey's own Notes explicitly instruct not reopening PG-040 absent genuinely contradictory evidence, and none was found.

Classification: PASS.

Journey Z-007 complete — PASS.
Batch 29: 21/25 attempted — 4 remaining.
Active Product Gaps: 0.
Next: Z-008.

### Z-008: Referenced master value becomes inactive while a draft references it

MIXED MANUAL + SERVER VERIFIED. Personas: `nexus-test-legal` (maker of this fixture), `nexus-test-reference-master-admin` (deactivates the value via the real Settings UI), `nexus-test-go-live-admin` (a genuinely different, active `WF-TEST Legal` team member, completes the approval via direct RPC after the only other active member turned out to be the same actor who created the request, which would have hit the self-review guard already reconfirmed in W-020). Domain: Customer Change. Fresh fixture: CCR-000192 (`03df8cd8-b589-41ac-aded-bb219aee631d`, Aurora Consumer Labs), Industry set to the real reference value "Consumer Durables" (`consumer_durables`, id `5ffd31b1-...`) and saved as a draft.

Action taken: as Reference Master Admin, opened the real Settings > Customer Onboarding > Industry / Category page and clicked "Deactivate" for "Consumer Durables", confirming the real confirmation dialog ("Deactivate \"Consumer Durables\"? It will no longer be available for new selections. Existing historical records will remain unchanged."). Confirmed via DB: `reference_options.is_active = false`.

Visible result: reopened the real draft form as the maker. The Industry field still correctly showed "Consumer Durables" selected (not blanked, not force-reset to "Select..."), with no blocking message. Filled Reason/Effective Date and clicked the real "Submit" button; it succeeded, advancing the request to node_3 with the now-inactive value still attached. Approval then completed (node_3 to node_4) without any block from the deactivated reference.

Database evidence: `workflow_node_transitions` for this resource contains exactly 2 rows (`submit`, `approve`@node_3 to node_4), a clean progression with zero blockage. No forced re-selection was ever presented in the real UI.

Journey Discovery: NONE. Confirms deactivation only affects new selections, never existing references, exactly as V-037 already established for this same mechanism from the historical-preservation angle; this journey reconfirms it from the mid-draft-deactivation angle specifically.

Classification: PASS.

Journey Z-008 complete — PASS.
Batch 29: 22/25 attempted — 3 remaining.
Active Product Gaps: 0.
Next: Z-009.

### Z-009: Workflow node has no eligible team member (zero active members), accepted O-018/V-027 behavior

MANUAL UX VERIFIED + DATABASE VERIFIED. Personas: `nexus-test-maker` (creates/submits), `nexus-test-team-admin` (removes/restores membership via the real Team Master UI), `nexus-test-legal` (attempts the blocked action, then the recovered action). Domain: Customer Change, live `WF-TEST Legal` team (the same team already reconfirmed at node_3 in Z-007), matching V-027's own approach (reaching zero by removing the last remaining members) rather than the disposable, never-wired `WF-TEST Empty` fixture team. Fresh fixture: CCR-000193 (`de20d5bc-916f-4d9c-9d35-e8cea03327f3`, Aurora Consumer Labs), submitted to node_3.

Action taken: as Team Admin, clicked the real "Remove WF-TEST Legal" control for both of the team's two active members (`nexus-test-go-live-admin`, `nexus-test-legal`) in Settings > Teams > Team Membership. Confirmed via DB: 0 active (`revoked_at is null`) rows remained for this team.

Visible result: the real review page still rendered Approve/Send Back/Reject (no pre-emptive UI block), but clicking the real "Approve" button produced the exact honest error: "this request's workflow requires an approver from the 'WF-TEST Legal' team. You are not an active member of that team." No crash, no silent failure, no misleading success. Separately, the real Operational Queue showed a page-level banner ("14 items have no eligible approver. The team responsible has zero active members. To recover: add an active member back to the team, or reassign the item if a governed reassignment path exists for its type, in Team Master.") plus a specific "No eligible approver" tag on this item's own row under "WF-TEST Legal".

Database evidence: `workflow_node_transitions` for this resource contained only the `submit` row while stuck; no transition was recorded during the blocked attempt.

Recovery/Resilience Variant: as Team Admin, re-added `nexus-test-legal` via the real "Assign a team..." control (no DB surgery, no re-submission). Returned to the real review page as `nexus-test-legal` and clicked the real "Approve" button again; it succeeded immediately with no other intervention. `workflow_node_transitions` now shows exactly 2 rows (`submit`, `approve`@node_3 to node_4). Also restored `nexus-test-go-live-admin`'s membership afterward to return the team to its original two-member composition.

Journey Discovery: NONE. This is the accepted, decided O-018/V-027 behavior reconfirmed fresh: a request with zero eligible members remains genuinely stuck by design, is proactively visible on both the review page (on direct attempt) and the Operational Queue (proactively, before any attempt), and recovers cleanly via ordinary membership restoration alone. Not classified as PRODUCT GAP CONFIRMED per this journey's own explicit instruction.

Classification: PASS.

Journey Z-009 complete — PASS.
Batch 29: 23/25 attempted — 2 remaining.
Active Product Gaps: 0.
Next: Z-010.

### Z-010: Storage object missing for a referenced document

MIXED MANUAL + SERVER VERIFIED. Persona: `nexus-test-legal` (viewer). Domain: Go Live. Real OS file-picker upload is unsupported by this browser tool (established limitation since W-006); rather than substitute a purely synthetic/RPC-only test, a genuinely new disposable document was created via the Storage REST API (a real upload, not tampering with any pre-existing data) so the actual real-browser Download click could be exercised end-to-end.

Safety note: an initial attempt to delete an existing, pre-existing shared document's storage object (to reuse real historical data) was correctly blocked by the safety classifier, since that object was not something created this session. Recreated the test using a document I uploaded myself instead.

Action taken: uploaded a small disposable PDF (`z010-journey-test-disposable.pdf`) to the real `go-live-documents` bucket via the Storage REST API, inserted its `go_live_documents` metadata row (for the existing `aurora-consumer-labs` Go Live request, which had zero prior document rows), confirmed the baseline "regular path" first by requesting a signed URL directly against the real, existing object (succeeded). Then deleted only that object I had just created via the Storage REST API (a real API delete, of my own artifact, not pre-existing history), confirming via a second signed-URL request that Supabase Storage itself now returns `404 Object not found (NoSuchKey)` for the missing object. Traced the exact application code path: `createSignedDownloadUrl` (`src/features/go-live/data/documents.data.ts`) catches this and throws `GoLiveDocumentOperationError`; `getGoLiveDocumentDownloadUrlAction` (`src/features/go-live/actions.ts`) catches that and returns `{ ok: false, error: "An unexpected error occurred while preparing this download." }`, never letting the exception propagate uncaught.

Then reproduced this live in the real browser: briefly marked my test document as the current document for this Go Live request (mirroring the app's own `supersedeCurrentDocuments` is_current toggle, a reversible operation), navigated to the real Go Live detail page, and clicked the real "Download" button.

Visible result: a clear inline error banner, "An unexpected error occurred while preparing this download.", appeared on the page; the rest of the page rendered normally, no crash, no broken image, no blank/hung download.

Cleanup: attempted to delete my test `go_live_documents` row afterward but this was correctly blocked by a real DB trigger (`GO_LIVE_DOCUMENT_IMMUTABLE: go_live_documents rows are never deleted, only superseded via is_current`), consistent with the platform's documented immutable-audit-trail design; marked it `is_current = false` instead (the same lifecycle the app itself uses), restoring the original no-current-document display for this Go Live request.

Journey Discovery: NONE. Confirms a clear, graceful failure with no crash, satisfying the canonical's hard requirement. Minor, non-blocking observation (not a Product Gap): the shown message is generic ("An unexpected error occurred...") rather than a document-specific "file unavailable" wording; still clear and honest, not misleading, so no gap is registered.

Classification: PASS.

Journey Z-010 complete — PASS.
Batch 29: 24/25 attempted — 1 remaining.
Active Product Gaps: 0.
Next: Z-011.

### Z-011: Document metadata exists but the file was never fully uploaded (partial/failed upload)

SOURCE INSPECTED. Domain: Go Live, Customer Onboarding. Per Step 12's explicit instruction not to substitute Z-010's after-the-fact-deletion technique and call it PASS here if genuine reproduction of a real upload-time failure is unsupported: it is not supported by this browser tool (no real OS file-picker interaction, and no way to sever a real multipart upload mid-transfer), so this was not faked as a live browser reproduction.

Action taken: read the real upload call sequencing in both places this exists: `src/features/go-live/services/documents.service.ts` (`uploadGoLiveDocument`) and `src/features/customer-onboarding/services/documents.service.ts` (the equivalent onboarding function). Both call, in this exact order: (1) `uploadDocumentBytes` (writes the file to Supabase Storage), (2) `supersedeCurrentDocuments` (marks any prior current document superseded), (3) `insertDocumentMetadata` (creates the `go_live_documents`/`customer_onboarding_documents` row). Each step is `await`ed sequentially, not run in parallel or in a fire-and-forget manner.

Finding: this sequencing structurally prevents Z-011's exact bad state from ever occurring through the real application code. If step 1 (the actual storage upload) fails or is interrupted partway, it throws before step 3 ever runs, so no metadata row is ever created for a file that was never successfully and fully written. The only way to produce "metadata exists but the object was never written" is to bypass this code path entirely (e.g., direct DB insertion, which is not a genuine upload-failure reproduction, only a hand-crafted state), and doing so would exercise the identical `createSignedDownloadUrl` / `getGoLiveDocumentDownloadUrlAction` graceful-failure path already verified in Z-010, not a distinct code path worth a second, separately-labeled test.

Journey Discovery: NONE. This is a positive design confirmation (upload-then-insert ordering with no interleaving), not a gap: the specific failure mode this journey asks about cannot occur via the real upload flow in either of the two domains in scope. Recorded honestly as SOURCE INSPECTED rather than a fabricated MANUAL UX VERIFIED, per Step 16's no-conflated-evidence standard; not classified as a Product Gap since no contradictory behavior was found, and not silently merged into Z-010's evidence since the underlying reason (structural prevention) is a distinct, worthwhile finding in its own right.

Missing dimension: genuine interrupted-upload failure injection, a real upload that is cut off or fails partway through before metadata is written. This browser tool does not support real OS file-picker interaction or severing a real multipart upload mid-transfer, so no live reproduction of the actual interrupted-upload scenario was attempted or achieved. The source-inspection finding above (upload-then-insert ordering) is a valid, distinct, worthwhile finding but is not itself a substitute for reproducing the canonical scenario, and Z-010's post-hoc missing-object technique is a different scenario, not a substitute for this one.

Classification: PARTIAL / TOOLING LIMITATION. The canonical journey's defining scenario, a genuine interrupted upload, was never reproduced, only inferred structurally unreachable via source inspection. The source-inspection finding is preserved and remains valid, but does not by itself justify PASS.

Journey Z-011 complete — PARTIAL / TOOLING LIMITATION.
Batch 29: 25/25 attempted — 0 remaining.
Active Product Gaps: 0.
Batch 29 fully executed.
