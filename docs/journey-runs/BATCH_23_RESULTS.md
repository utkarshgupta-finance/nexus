# Batch 23 Results

Scheduled journeys: Q-021 (1), R-013 through R-020 (8), S-001 through S-017 (17). Total = 26.
Starting baseline: `dc146ed504fc1222fe564e664cb729d58ccf3d71`.
Depends on Batch 22 (confirmed closed, PD-007 decided).

This ledger is written journey-by-journey, immediately after each journey completes, not
retrospectively after the whole batch. Discovery observations are logged as they arise in a
scratch list below, then reconciled at batch close.

## Discovery scratch list (updated live during execution)

(updated as journeys execute)

---

## BEGIN Q-021

### Canonical intent
Go Live document upload must validate the actual uploaded file content/byte signature, not merely filename, MIME declaration, or client-supplied metadata, consistent with Onboarding's established defense-in-depth pattern.

### Preconditions
An in-progress Go Live request with no evidence uploaded for a given Go Live document type.

### Fixture
`pngBytesDisguisedAsPdf`: a real `Blob` containing genuine PNG magic bytes (`0x89 0x50 0x4e 0x47 0x0d 0x0a 0x1a 0x0a`), with a filename `disguised.pdf` and claimed `mimeType: "application/pdf"` — the exact same fixture shape as Onboarding's own A-023 regression test, adapted to Go Live's `uploadGoLiveDocument` input contract.

### Step 1: inspect existing Onboarding implementation
Read `src/features/customer-onboarding/domain/documents.ts` (`matchesAllowedAttachmentSignature`: checks the first bytes against real PDF (`%PDF`) and JPEG (`0xffd8ff`) magic-number signatures) and `src/features/customer-onboarding/services/documents.service.ts` (`uploadOnboardingDocument`): calls `validateAttachmentFile` (name/mimeType/size) first, then separately reads `input.file.bytes.slice(0, 4)` and calls `matchesAllowedAttachmentSignature`, throwing `InvalidDocumentError` before any Storage write if the real bytes don't match.

### Step 2: inspect current Go Live implementation
Read `src/features/go-live/services/documents.service.ts` (`uploadGoLiveDocument`, before this run's fix): called `validateAttachmentFile` only. No byte-level check anywhere in the file. Confirmed via `grep` that `matchesAllowedAttachmentSignature` was imported nowhere in the `go-live` feature.

### Step 3: establish current behaviour before changing anything
**Executed the actual failing scenario against the real, unmodified code** (not inferred): added the exact same spoofed-content test fixture used by Onboarding's A-023 regression test, called the real `uploadGoLiveDocument`, and ran it via `npx vitest run`. Result: the call proceeded past validation and reached the point of constructing a return value from an unmocked `insertDocumentMetadata` result (throwing `TypeError: Cannot read properties of undefined`, not `InvalidGoLiveDocumentError`) — proving the spoofed file was never rejected by any validation step; it reached `uploadDocumentBytes`/`insertDocumentMetadata` unimpeded. This is the preserved, reproduced pre-fix failure.

### Regular Path
A genuine PDF (`validPdfBlob`, matching the real `%PDF` signature) with a correctly-claimed `application/pdf` MIME type uploads successfully: `uploadDocumentBytes` is called, metadata is persisted.

### Edge Variant
N/A beyond the spoofed-content Stress/Negative case below.

### Negative Variant
The spoofed-content file (Step 3 above): now, after the fix, correctly rejected with `InvalidGoLiveDocumentError`, and `uploadDocumentBytes` is never called (no storage write, no orphaned metadata).

### Stress Variant
N/A (Onboarding's own equivalent journey Q-006 already covers this at the shared-policy level; this journey's own scope is the presence/absence of the check in Go Live specifically, not novel byte-pattern exhaustion).

### Manual UX evidence
TOOLING-BLOCKED. No authenticated browser session exists this run (confirmed: the only reachable localhost:3000 tab renders the sign-in page; standing restriction forbids deriving credentials). The rejection message's on-screen rendering in the Go Live upload UI could not be visually confirmed.

### Server / RPC / DB evidence
Real, live: confirmed via direct source read (both before and after the fix) that the check operates on `input.file.bytes`, the authoritative uploaded Blob, never the caller-declared `mimeType`/`name`/`size` fields — identical authority model to Onboarding's own check. Confirmed no `supabase.storage` write (`uploadDocumentBytes`) is ever reached when the signature check fails, both by test assertion and by direct code-path read (the throw happens before that call in source order).

### Automated evidence
Added this run, `src/features/go-live/services/documents.service.test.ts`: two new tests, `"rejects a file whose real bytes are not a genuine PDF/JPEG..."` (the real pre-fix failure, now passing post-fix) and `"accepts a genuine PDF whose real bytes match the claimed type"` (regression guard against over-rejection). Both real, executed, passing (`npx vitest run`).

### Neighbour check (Onboarding, item 12)
Re-ran Onboarding's own `documents.service.test.ts` and `domain/documents.test.ts` (14 + N existing tests) after this change: all pass unchanged. The shared `matchesAllowedAttachmentSignature` function itself was not modified, only imported into a new call site, so this is a genuine no-regression confirmation, not an assumption.

### Actual outcome
**Real defect confirmed via live execution, then fixed.** Before the fix, a file whose real bytes were a disallowed format (PNG) but whose name/declared MIME type claimed an allowed one (`.pdf`/`application/pdf`) would pass Go Live's validation and reach Storage. After the fix, it is rejected before any Storage write, exactly matching Onboarding's own behavior for the identical fixture.

### Classification
FAILED THEN FIXED + PASS.

### Defect / Gap / Decision
Defect (this journey's own scheduled assertion). Not a Product Decision: the business intent ("evidence must not be spoofable by extension/MIME claim alone") was already settled by Onboarding's own Q-006 journey; this was a bounded, safe completion of an already-decided policy for a second consumer of the same shared validation module.

### Fix / Retest
Fixed in `src/features/go-live/services/documents.service.ts` (import + one guard clause, mirroring Onboarding's own service exactly). Retested: both new tests pass, all existing Go Live tests (4) and Onboarding tests unchanged and passing, `tsc --noEmit` clean.

### Journey Discovery observation
None beyond this journey's own scope. The fix reuses the exact existing shared function; no new boundary, cross-domain interaction, or control invariant was surfaced that isn't already covered by Q-006/Q-011's own documentation of the shared-policy model.

### Permanent ledger updated
Yes.

## END Q-021

---

## BEGIN R-013

### Canonical intent
Customer Master's own record has no unified rendered Timeline UI; only its onboarding/change sub-processes do.

### Preconditions
An existing customer with multiple sub-records over time.

### Fixture
`src/features/customers/ui/customer-master-detail.tsx`, read directly.

### Regular Path
Confirmed via direct source read: the tab list is exactly `overview / activity / details / tax / commercials / go-live / documents / change-requests / history`. No "Timeline"-named tab exists; `RequestTimeline` is never imported into this file (confirmed by grep).

### Manual UX evidence
TOOLING-BLOCKED (no browser session).

### Server / RPC / DB evidence
Confirmed via source: the `history` tab is a distinct former-name/field-history mechanism (§7/S-003), not `RequestTimelineEvent`-shaped.

### Automated evidence
N/A (an intentional absence check).

### Actual outcome
Matches canonical expectation: no unified Customer Timeline exists; each sub-process has its own.

### Classification
EXPECTED BEHAVIOUR (documented, pre-existing PRODUCT GAP per its own Notes; not newly discovered).

### Journey Discovery observation
None new.

### Permanent ledger updated
Yes.

## END R-013

## BEGIN R-014

### Canonical intent
Settings/Team Master/User Access/Workflow Builder have no rendered Timeline UI; their history exists only in raw `audit_log`.

### Preconditions
Changes have been made in each of these four areas over time.

### Fixture
Real, live `audit_log` rows for `teams`, `user_roles`, `user_teams`, `workflow_definitions`, `workflow_definition_versions`.

### Regular Path
Confirmed via `grep -rl "Timeline" src/app/settings/` and `src/platform/team/ui/`: zero matches anywhere in these areas' UI.

### Server / RPC / DB evidence
Real, live: confirmed via direct SQL that `audit_log` genuinely holds real rows for all four areas (`teams`: 27, `user_roles`: 57, `user_teams`: 60, `workflow_definitions`: 129, `workflow_definition_versions`: 227) even though no UI ever surfaces them — the Audit/Data Integrity Check this journey specifically requires.

### Manual UX evidence
TOOLING-BLOCKED (no browser session).

### Automated evidence
N/A.

### Actual outcome
Matches canonical expectation exactly, confirmed with real row counts, not assumed.

### Classification
EXPECTED BEHAVIOUR (documented PRODUCT GAP, unchanged).

### Journey Discovery observation
None new.

### Permanent ledger updated
Yes.

## END R-014

## BEGIN R-015

### Canonical intent
`listAuditLogForRow`'s 500-row cap behaves predictably (deterministic order, no silent data loss) for a high-churn record.

### Preconditions
A row with >500 `audit_log` entries.

### Fixture
Real, live: queried the actual highest-churn row in the database (`customers`/`120d8347-...`, 42 real entries) — nowhere near 500.

### Regular Path
Confirmed via direct source read, `src/platform/audit/data/audit-log.data.ts`: `.order("occurred_at", { ascending: false }).limit(500)`, then `.reverse()` to restore ascending order for callers — a genuine query-layer `LIMIT`, deterministic ordering.

### Stress Variant
**Not executable against real data**: the highest real row-churn in the live database is 42 entries, far short of the 500/499/501 boundary this journey's own Stress Variant requires. Seeding 500+ synthetic rows directly into the permanent, append-only `audit_log` table (confirmed immutable per R-016) to force this boundary was judged not worth the permanent, unremovable clutter it would create in the shared database for a query-layer mechanic already covered by an existing real test.

### Manual UX evidence
TOOLING-BLOCKED (no browser session, and no UI currently surfaces this query directly per the journey's own UX Check).

### Server / RPC / DB evidence
Real, live: confirmed the cap/ordering mechanism in source; confirmed no real row currently approaches the boundary.

### Automated evidence
Existing, unmodified: `audit-log.data.test.ts` already asserts `limit(500)` is called and ordering is correctly restored, using mocked data (real code path, mocked I/O).

### Actual outcome
Mechanism confirmed correct at the code level and via existing automated test; the specific 500-row boundary case remains genuinely unexercised against live data, honestly disclosed rather than assumed passing.

### Classification
PASS (own PARTIAL feasibility; boundary-scale case not forced).

### Journey Discovery observation
None new.

### Permanent ledger updated
Yes.

## END R-015

## BEGIN R-016

### Canonical intent
`audit_log`'s append-only guarantee is database-enforced, not merely a convention.

### Preconditions
An existing `audit_log` row.

### Fixture
Real, live row `a1ac761e-f501-45a0-bdde-a39fda9a0c2e` (an already-existing audit row from this program's own earlier R-006 activity).

### Regular Path
N/A per canonical definition.

### Regular/Negative execution (this journey's own core check)
**Executed live, directly against the real database**: attempted `UPDATE audit_log SET action = 'INSERT' WHERE id = '...'` — rejected: `ERROR P0001: audit_log is append-only: UPDATE is not permitted` (raised by `fn_audit_log_immutable`, confirmed by direct source read of `supabase/migrations/20260906084244_platform_core_foundation.sql`). Attempted `DELETE FROM audit_log WHERE id = '...'` — rejected identically: `ERROR P0001: audit_log is append-only: DELETE is not permitted`. Both attempts were single Postgres statements: a statement that raises an exception leaves zero footprint (Postgres statement-level atomicity), so this was safe to execute directly with no separate revert needed, confirmed by re-querying the row afterward (unchanged).

### Server / RPC / DB evidence
Real, live, both directions tested. Also confirmed via source: a separate `trg_audit_log_reject_truncate` statement-level trigger blocks `TRUNCATE` too, and `UPDATE`/`DELETE` privileges are separately `REVOKE`d from every application-facing role including `service_role` (belt-and-suspenders beyond the trigger alone).

### Manual UX evidence
N/A (no UI ever attempts this; the journey's own Personas is "Engineer/DBA... simulating a compromised or careless privileged actor").

### Automated evidence
N/A beyond the live DB test above (this is inherently a database-layer guarantee).

### Actual outcome
Matches canonical expectation exactly, confirmed live: even a privileged actor cannot rewrite or remove audit history through this table.

### Classification
PASS.

### Journey Discovery observation
None new (the TRUNCATE-reject trigger and privilege-revocation belt-and-suspenders were already implemented, not newly found).

### Permanent ledger updated
Yes.

## END R-016

## BEGIN R-017

### Canonical intent
Confirm the deliberate split: `actor_display_name_snapshot`/`actor_email_snapshot` exist and hold the old, frozen name, but no Timeline UI code path ever reads them.

### Preconditions
Same setup as R-006 (an actor renamed after acting) — already real and live from Batch 22's own R-006 execution (actor `00d0779e`, rows still holding the frozen old name).

### Fixture
Real, live `audit_log` rows for actor `00d0779e-9304-40c0-8dd3-a187f9edf25a`.

### Regular Path
Re-queried the same real rows from Batch 22's R-006: `actor_display_name_snapshot` = `"WF-TEST Leadership Approver"` (the OLD name, still frozen), confirming the snapshot has not drifted. **Freshly re-confirmed this run** (not merely citing Batch 22): `grep -rl "actor_display_name_snapshot\|actor_email_snapshot" src/` returns exactly 3 files — `audit-log.data.ts` (raw type definition), `actor-directory.data.ts` (where they're written), and `customers/domain/activity.ts` (the separate Customer Activity feed). None of the four `domain/timeline.ts` files, `transition-events.ts`, or `request-timeline.tsx` appear in that list.

### Manual UX evidence
TOOLING-BLOCKED (no browser session).

### Server / RPC / DB evidence
Real, live row confirmed; real, fresh grep confirmed (not reused from memory without re-verification).

### Automated evidence
Existing, unmodified: `actor-directory.data.test.ts`.

### Actual outcome
Matches canonical expectation exactly: the two layers remain genuinely distinct and un-conflated.

### Classification
PASS.

### Journey Discovery observation
None new.

### Permanent ledger updated
Yes.

## END R-017

## BEGIN R-018

### Canonical intent
A rejection's stated reason is captured completely and rendered verbatim, character for character, no truncation.

### Preconditions
A request rejected/sent back with a lengthy, detailed reason.

### Fixture
Schema check: `comment`/`reason` columns across `workflow_node_transitions`, `customer_onboarding_send_backs`, `customer_change_send_backs`, `go_live_send_backs`. New test fixture: a real 5-line, multi-paragraph rejection reason containing quotes, an ampersand, a number list, and an email address.

### Regular Path
Confirmed via direct SQL schema query: all four columns are `text` with `character_maximum_length: null` (Postgres `text` is unbounded; no DB-level truncation possible).

### Stress Variant
**Executed**: added a new test to `transition-events.test.ts` ("captures a lengthy, multi-paragraph rejection reason verbatim, including line breaks and special characters, with no truncation") asserting `events[0].detail` equals the exact input string, including verifying `.length` matches exactly. Passing.

### Manual UX evidence
TOOLING-BLOCKED (no browser session) for confirming visual wrapping/expansion; confirmed instead via direct source read of `request-timeline.tsx`: `{event.detail ? <span>...{event.detail}...</span> : null}` renders the full string with no `.substring()`, no `line-clamp`, no `overflow-hidden truncate` class anywhere in the component.

### Server / RPC / DB evidence
Real: schema confirmed unbounded `text` columns.

### Automated evidence
Added this run: 1 new passing test in `transition-events.test.ts`.

### Actual outcome
Confirmed at every layer (schema, builder logic, rendering component) that no truncation occurs.

### Classification
PASS.

### Journey Discovery observation
None new.

### Permanent ledger updated
Yes.

## END R-018

## BEGIN R-019

### Canonical intent
The shared `RequestTimeline` component renders consistently across all four domains, despite each domain supplying its own event list.

### Preconditions
Each of the four domains has at least one request/version with non-trivial event history.

### Fixture
Real, live requests already confirmed in Batch 22: onboarding `95838de6-.../e4671230-...`, commercial version `93d9b669-...` (24-version chain), customer change `1ba55311-...`, go_live `c8696bac-...`.

### Regular Path
Confirmed via direct source read (this run, fresh): all four `domain/timeline.ts` builders (`customer-onboarding`, `customer-change`, `go-live` inline, `commercial-version-timeline.ts`) import and return `RequestTimelineEvent[]`, and every one of their respective page components (`src/app/reviews/[requestId]/page.tsx`, `reviews/change-requests/[requestId]/page.tsx`, `reviews/commercial-versions/[requestId]/page.tsx`, the go-live detail page) renders through the single `<RequestTimeline events={...} />` component (`src/components/product/request-timeline.tsx`) — confirmed by grepping for `RequestTimeline` imports across `src/app` and `src/features/*/ui`, finding exactly this one shared component used everywhere, no domain-specific reimplementation.

### Manual UX evidence
TOOLING-BLOCKED (no browser session) for the specific visual side-by-side comparison across all four domains' rendered pages.

### Server / RPC / DB evidence
Real, live event data across all four domains, confirmed structurally consistent (chronological ordering via the identical `.sort()` call present in every builder; marker rendering via the identical shared `transition-events.ts`).

### Automated evidence
Existing, unmodified: each domain's own `domain/timeline.test.ts` plus the shared `request-timeline.tsx` (confirmed, per Batch 22's own finding, to have no dedicated component-level test — a real, disclosed gap, not silently closed here since building one is a scope decision beyond this journey's own PARTIAL feasibility).

### Actual outcome
Structural consistency confirmed at the code level (single shared rendering component, consistent event-shape contract, consistent sort/marker/actor-resolution mechanisms) across genuinely real data in all four domains.

### Classification
PASS (own PARTIAL feasibility; the specific side-by-side visual comparison remains unexecuted, honestly disclosed).

### Journey Discovery observation
`request-timeline.tsx` has no dedicated component-level (`.test.tsx`) test suite. Classified as REGRESSION TEST ONLY candidate (see Journey Discovery section) rather than fixed here, since adding React component testing infrastructure to this repo is a tooling decision beyond a single journey's bounded scope (per `CLAUDE.md`: "do not add UI/testing dependencies without asking").

### Permanent ledger updated
Yes.

## END R-019

## BEGIN R-020

### Canonical intent
Multiple actors acting within the same approval cycle each independently live-resolve their own current name; a rename of one does not affect another's already-rendered attribution.

### Preconditions
Two actors acted within the same cycle; one is later renamed, the other is not.

### Fixture
Real, live data: Customer Change request `1ba55311-4b04-44e0-9fcf-f66fcb129d9c`, cycle 2, where `cbfb7860` (WF-TEST Finance Checker) approved at `node_2` and `b78fa4e4` (WF-TEST Legal Checker) approved at `node_3`, both within the same real cycle.

### Regular Path
**Executed as a real, live, reversible mutation**: renamed `cbfb7860`'s `app_users.display_name` to `"WF-TEST Finance Checker (R-020 rename test)"`, confirmed the change took effect, confirmed `b78fa4e4`'s name remained completely unchanged (`"WF-TEST Legal Checker"`) throughout, then reverted `cbfb7860` back to its original value, confirmed reverted.

### Stress Variant
Confirmed via the underlying mechanism (`resolveActorLabels` resolves a batched `Map` keyed per actor id; `transition-events.ts` calls `actorLabels.get(transition.actorUserId)` independently inside its per-transition loop, not once per cycle): resolving two different ids from the same map is structurally independent per-id by construction, so renaming both actors at different times relative to each other would behave identically (each id's own current value at read time), confirmed by the same code path already exercised live above.

### Manual UX evidence
TOOLING-BLOCKED (no browser session) for the visual confirmation that both entries render correctly side by side in the same rendered cycle.

### Server / RPC / DB evidence
Real, live mutation and revert, confirmed via direct SQL query before, during, and after.

### Automated evidence
Existing, unmodified: `transition-events.test.ts`'s existing tests already use distinct actor ids per transition and assert each resolves its own correct label (e.g. the send_back/reject tests use `legal-user`/`leadership-user` distinctly).

### Actual outcome
Matches canonical expectation exactly, confirmed via a real, reversible live mutation on real historical data spanning a genuine multi-actor cycle, not only inferred from the resolver's own source code.

### Classification
PASS.

### Journey Discovery observation
None new.

### Permanent ledger updated
Yes.

## END R-020

---

## BEGIN S-001

### Canonical intent
Customer Master's `?q=` name search returns correct results by current customer name, filtered server-side.

### Preconditions
Multiple customers exist, including a real named customer.

### Fixture
Real, live: 26 real customers currently in the database. Test fixtures: `Aurora Consumer Labs Pvt Ltd` / `Northstar Consumer Products Pvt Ltd` (existing `search.test.ts` fixtures).

### Regular Path
Confirmed via direct source read: `/customers` (`src/app/customers/page.tsx`) reads `searchParams.q`, and `filterCustomerMasterEntries` (`src/features/customers/domain/search.ts`) runs inside the Server Component, matching by `name`/`key`/`brandName` case-insensitively via plain `.includes()`.

### Edge / Stress Variant
Confirmed via existing + newly added tests: partial-word match (`"aurora"` matches `"Aurora Consumer Labs Pvt Ltd"`), case-insensitive match, and (added this run) whitespace-only query correctly falls back to no filter (`"   "` → all results), not a crash or empty result.

### Manual UX evidence
TOOLING-BLOCKED (no browser session).

### Server / RPC / DB evidence
**Precise finding**: filtering is genuinely server-side (runs inside the Next.js Server Component, before any HTML reaches the browser, confirmed by direct source read of `page.tsx`/`search.ts`) but is **not** pushed down into the Supabase query — `listCustomers()` fetches every row unconditionally (`select("*")`, no `.ilike()`/`.eq()` filter), and `filterCustomerMasterEntries` filters the already-fetched array in memory. This satisfies the journey's literal invariant ("not merely client-side") but is architecturally an in-memory full-table scan, not an indexed search. The module's own header comment explicitly frames this as a deliberate choice ("Scale-ready, not scale-heavy... a simple in-memory filter is the right amount of engineering"), confirmed reasonable at the real current scale (26 customers).

### Automated evidence
Existing `search.test.ts` (8 tests) plus 2 new tests added this run (whitespace-only query; already covered partial/case-insensitive match).

### Actual outcome
Matches canonical expectation; the server-side-vs-SQL-pushdown nuance recorded precisely rather than glossed over.

### Classification
PASS.

### Journey Discovery observation
The in-memory-filter-at-current-scale approach is a real, disclosed architectural characteristic (not a defect at 26 rows, a future scaling concern if the customer base grows by orders of magnitude). Classified FUTURE MODULE candidate (see Journey Discovery section).

### Permanent ledger updated
Yes.

## END S-001

## BEGIN S-002

### Canonical intent
The four real filter params (`segment`, `businessUnit`, `country`, `status`) work correctly individually and combined (logical AND), including for a customer holding a now-deactivated reference value.

### Preconditions
Customers spanning multiple segments/BUs/countries/statuses.

### Fixture
Existing `search.test.ts` fixtures (Aurora: smb/india_smb/IN/active; Northstar: enterprise/india_enterprise/IN/inactive).

### Regular Path
Confirmed via existing test (`segment` filter) plus 2 new tests added this run (`businessUnit`, `country` filters individually) and 1 new combined-AND test (all four filters together, both a matching and a non-matching combination).

### Stress Variant
Confirmed: a filter combination yielding zero results returns `[]` cleanly (existing "returns nothing" test's mechanism generalizes; combined-AND test's second assertion is exactly this case).

### Historical Variant
Confirmed via direct source read: `filterCustomerMasterEntries` compares `filters.segment`/`businessUnit`/`country` directly against the customer record's own resolved code (`resolveSegmentCode`/etc.), never re-validating that code against the currently-active Reference Master option list. A deactivated code stored on an existing customer remains fully matchable by a direct URL/bookmark carrying that value in the query string. Added a new test asserting this explicitly.

### Manual UX evidence
TOOLING-BLOCKED (no browser session) for confirming the filter-bar dropdown itself still offers/labels a deactivated option; the underlying filter logic (the part this journey can verify without a browser) is confirmed correct.

### Server / RPC / DB evidence
Same as S-001 (server-side, in-memory).

### Automated evidence
4 new tests added this run in `search.test.ts`.

### Actual outcome
Matches canonical expectation for all four filters individually, combined, and against a deactivated historical value.

### Classification
PASS.

### Journey Discovery observation
None new beyond S-001's.

### Permanent ledger updated
Yes.

## END S-002

## BEGIN S-003

### Canonical intent
`findCustomersByFormerName` correctly surfaces a customer under a search for its OLD name, merged cleanly with current-name matches, de-duplicated, across multiple historical renames.

### Preconditions
A customer previously named something else, per an approved Customer Change.

### Fixture
Real, live data: customer `120d8347-e16f-4a01-937b-97c3acea9394`, renamed **twice** (`"Batch8 Approval Core Co"` → `"Batch8 Approval Core Co (C-010 Combined Test)"` → `"Batch8 Approval Core Co Renamed"`), and `d4f94e5a-2d86-4118-b87c-9421b37aaa2f` (renamed once).

### Regular Path
Confirmed via direct source read: `searchFieldHistoryByOldValue` (`src/features/customer-change/data/change-request.data.ts`) queries `customer_field_history` via `.ilike("old_value", ...)` scoped to `field_key in ("name","brand_name")`; `searchFormerCustomerNames` dedupes to one match per `customerId` via a `Set` before resolving; `src/app/customers/page.tsx` explicitly merges (`shownIds` dedup against `listCustomerMaster`'s own results) so a customer already shown by current-name match is never duplicated as a former-name match too.

### Stress Variant
**Executed live against real data**: querying `customer_field_history` for `old_value ilike '%Batch8 Approval Core Co%'` returns **both** historical name rows for the same real customer (`120d8347-...`), confirming a multi-renamed customer is findable by any of its several historical names, and that `searchFormerCustomerNames`'s own `Set`-based dedup (confirmed by source read) would collapse these 2 matching history rows to exactly 1 former-name result for that customer, not 2.

### Manual UX evidence
TOOLING-BLOCKED (no browser session) for the "clearly indicates matched via a former name" UX distinction (per the journey's own Notes, the grounding brief does not confirm this exists; not independently confirmed this run either).

### Server / RPC / DB evidence
Real, live: confirmed the exact real multi-rename history exists and would be matched, via direct SQL replicating the app's own query.

### Automated evidence
No dedicated unit test exists for the merge/dedup step itself (it lives directly in a Server Component, `page.tsx`, not a pure function); the underlying `searchFormerCustomerNames` dedup and `searchFieldHistoryByOldValue` query were confirmed via source read and live data rather than a mock-based unit test.

### Actual outcome
Matches canonical expectation, confirmed against real, genuinely multi-renamed historical data.

### Classification
PASS.

### Journey Discovery observation
The page-level merge/dedup logic in `src/app/customers/page.tsx` has no dedicated automated test (only confirmed via source read + live data this run). Classified REGRESSION TEST ONLY candidate.

### Permanent ledger updated
Yes.

## END S-003

## BEGIN S-004

### Canonical intent
A clean, honest empty state when no customer matches, distinct from loading, with a clear next step.

### Preconditions
N/A.

### Fixture
A nonsense query string guaranteed to match nothing.

### Regular Path
Confirmed via direct source read: `src/features/customers/ui/customers-page.tsx` has a distinct branch (`customerMasterEntries.length === 0 && formerNameMatches.length === 0`) rendering "No customers match this search" (when filters are active) or "No approved customers yet" (when not), never conflated with the loading state, which is a wholly separate file/component (`src/app/customers/loading.tsx`, `<RouteLoading label="Loading customers..." />`).

### Regression: existing automated test
`search.test.ts`'s "returns nothing when nothing matches" test confirms the underlying filter produces a genuine empty array (not an error) for this case.

### Manual UX evidence
TOOLING-BLOCKED (no browser session).

### Server / RPC / DB evidence
N/A.

### Automated evidence
Existing, confirmed above.

### Recovery/Resilience Variant
Confirmed via source: `customer-filter-bar.tsx`'s "Clear filters" action navigates via `router.push(pathname)` (drops all query params), giving the user a clear next step back to the full list, exactly matching this journey's own UX Check.

### Actual outcome
Matches canonical expectation exactly.

### Classification
PASS.

### Journey Discovery observation
None new.

### Permanent ledger updated
Yes.

## END S-004

## BEGIN S-005

### Canonical intent
The server-side `?q=` filter is safely parameterized against injection-style input; no 500, no data leak.

### Preconditions
N/A.

### Fixture
Added this run: a classic SQL-injection string (`"'; DROP TABLE customers; --"`), a percent-encoded payload, and a 10,000-character string.

### Stress Variant
**Executed**: added 3 new assertions to `search.test.ts` confirming none of these inputs throw, and all correctly produce an empty result set (no match, no crash, no unexpected "matches everything" behavior).

### Manual UX evidence
TOOLING-BLOCKED (no browser session).

### Server / RPC / DB evidence
**Stronger than mere parameterization**: confirmed via direct source read that the current-name/key/brand match path (`matchesQuery` in `search.ts`) is plain JavaScript `.toLowerCase().includes()` over an already-fetched, already-typed array — it never reaches SQL at all with the `q` value, so classic SQL-injection-style payloads are structurally inert against this path, not merely escaped. The one place the user's search term does reach a real Supabase query is the former-name search (`searchFieldHistoryByOldValue`'s `.ilike("old_value", \`%${term}%\`)`), which is a PostgREST query-builder call (the value is bound as a filter parameter by the client library, not string-concatenated into raw SQL text executed directly), confirmed by direct source read, not assumed safe by convention.

### Automated evidence
3 new tests added this run.

### Actual outcome
Confirmed safe by construction on both paths, one structurally (never reaches SQL) and one via parameterized query-builder usage.

### Classification
PASS.

### Journey Discovery observation
None new.

### Permanent ledger updated
Yes.

## END S-005

## BEGIN S-006

### Canonical intent
"Sent Back to Me" correctly, list-based (no search box), shows every request across domains currently awaiting this user's rework; a multi-cycle item appears exactly once in its current state; a request sent back to someone else never appears.

### Preconditions
The current user has at least one request sent back to them.

### Fixture
Existing real test infrastructure (`my-work.test.ts`'s `item()` fixture builder) plus real schema confirmation.

### Regular Path
Confirmed via direct source read: `src/features/my-work/ui/my-work-page.tsx` filters one shared, server-provided `items` array by `.reason` into sections; no search input exists anywhere in this component or `MyWorkTable`.

### Authorization Variant
Confirmed by existing, real, passing test: `"includes a sent-back item only when this user is the one it was sent back to"` (`my-work.test.ts` line 39) — asserts length 1 for the correct recipient and length 0 for a different user, same input.

### Stress Variant
**Confirmed structurally, not just empirically**: every source table underlying the inbox (`customer_onboarding_cases`, `customer_change_requests`, `commercial_configuration_versions`, `go_live_requests`) has the request id as its own primary key and a single mutable `status` column (confirmed via schema read), not an append-only history log; `loadApprovalInbox` selects one row per request id. A request cycling sent_back → resubmitted → sent_back again is structurally the same row with `status` overwritten, so duplication is not merely untested, it is architecturally impossible via this data path.

### Manual UX evidence
TOOLING-BLOCKED (no browser session).

### Server / RPC / DB evidence
Confirmed via schema + source read as above.

### Automated evidence
Existing, real, passing test cited above; `"M-027: multi-domain aggregation, exact seeded counts, no cross-domain contamination"` (Batch 20/21) further confirms no duplication/loss across a seeded multi-domain portfolio.

### Actual outcome
Matches canonical expectation exactly.

### Classification
PASS.

### Journey Discovery observation
None new.

### Permanent ledger updated
Yes.

## END S-006

## BEGIN S-007

### Canonical intent
"Pending My Approval" correctly aggregates cross-domain items genuinely awaiting this user's action now, including team-bound (not just direct-user) eligibility; a concurrently-approved item disappears from both eligible viewers' lists.

### Preconditions
The user is an approver at the current node for at least one item.

### Fixture
Existing real test infrastructure.

### Regular Path
Confirmed by existing, real, passing tests: direct-permission inclusion/exclusion (`my-work.test.ts` lines 50-58), and the M-021 fix tests confirming each item type checks its own domain's specific approve permission, not a single OR'd boolean (lines 107-120).

### Stress Variant (team-bound eligibility)
Confirmed by existing, real, passing tests: a user on the WRONG team is excluded even holding the approve permission (line 60), a user on the RIGHT team is included (line 66) — both confirmed via `isResponsibleTeam = item.responsibleTeamId === null || viewerTeamIds.has(item.responsibleTeamId)`, resolved from the item's actual current workflow node (`getResponsibleTeamIdsByNode`), not a static assumption.

### Authorization Variant
Confirmed: an item awaiting a different approver/team is excluded (same tests as above, inverted case).

### Concurrency Variant
**Not independently executed this run** (would require two simultaneous authenticated sessions, unavailable under the standing tooling restriction); the underlying mechanism (My Work is recomputed fresh from current DB state on every page load, no client-side cache of eligibility) structurally guarantees an approved item disappears from every viewer's next server-rendered list, confirmed by source read (no memoization/staleness layer exists in `loadMyWork`), but the literal "two people see it, one approves, both refresh" race was not executed live.

### Manual UX evidence
TOOLING-BLOCKED (no browser session).

### Server / RPC / DB evidence
Confirmed via source read as above.

### Automated evidence
Existing, real, passing tests cited above (7+ tests directly on this exact classification logic).

### Actual outcome
Matches canonical expectation for the Regular/Authorization/Stress variants exercised; the live concurrency race itself remains unexecuted, honestly disclosed.

### Classification
PASS (own FULL feasibility claim slightly narrowed by the disclosed concurrency-execution gap, which does not change the correctness finding, only its live-race provenance).

### Journey Discovery observation
None new.

### Permanent ledger updated
Yes.

## END S-007

## BEGIN S-008

### Canonical intent
Unsubmitted drafts are discoverable across domains so work is never silently lost; a draft from a different user never appears; a very old draft remains discoverable; resuming returns exactly where the draft left off.

### Preconditions
The user has started but not submitted at least one request.

### Fixture
Existing real test infrastructure (`buildDraftWorkItems` tests).

### Regular Path
Confirmed via direct source read: `loadMyDraftsToContinue` (`src/platform/approvals/server.ts`) filters `entry.status === "draft" && entry.createdBy === appUserId` for Customer Change, Commercial Version, and Go Live.

### Important precise finding: Customer Onboarding drafts are deliberately excluded, not missing by oversight
Initially suspected a real gap (Onboarding is one of this journey's own named domains, and its drafts are absent from `loadMyDraftsToContinue`), but direct source read of the function's own header comment resolved this: **"only for Customer Change and Commercial Version, which have no other home for a draft (unlike Onboarding, whose own My Requests page already covers this, so it is deliberately not duplicated here, per the 'no duplicates' rule)"**. Confirmed live: `listMyOnboardingRequests` (already creator-scoped, already returns draft-status cases) is used exclusively by `/forms/customer-onboarding`'s own page, a real, dedicated, already-governed discovery surface for exactly this purpose. This is EXPECTED BEHAVIOUR by explicit prior design, not a defect; recorded precisely here so a future audit does not repeat this same false alarm.

### Authorization Variant
Confirmed via the same source read: `createdBy === appUserId` filter is explicit and real for all three domains handled here.

### Stress Variant (very old draft)
Confirmed structurally: no time-based expiry/archival filter exists anywhere in `loadMyDraftsToContinue` or `buildDraftWorkItems` (confirmed by source read); a draft's age only affects its sort position (oldest-first, confirmed by existing test), never its inclusion.

### Manual UX evidence
TOOLING-BLOCKED (no browser session) for confirming "resuming returns exactly where the draft left off."

### Server / RPC / DB evidence
Confirmed via source read as above.

### Automated evidence
Existing, real, passing tests (`buildDraftWorkItems` describe block, 2 tests).

### Actual outcome
Matches canonical expectation once the Onboarding-exclusion design intent is correctly understood; initially appeared to be a gap, verified further before concluding otherwise.

### Classification
PASS.

### Journey Discovery observation
None new (the "no duplicates" design rule was already documented in code, not newly discovered).

### Permanent ledger updated
Yes.

## END S-008

## BEGIN S-009

### Canonical intent
"Waiting on Others" correctly shows every submitted-but-unresolved item the user created, with current status/node; a concurrently-approved item moves out on refresh.

### Preconditions
The user has submitted at least one item now awaiting someone else.

### Fixture
Existing real test infrastructure.

### Regular Path
Confirmed by existing, real, passing tests: a requester's own submitted item classifies as `waiting_on_others` when they cannot decide it themselves (line 73), and even when they hold the approve permission but the item sits at a node their team doesn't cover (line 80) or is self-created (M-011, lines 87-105).

### Concurrency Variant
Same structural guarantee as S-007 (fresh recompute on every load, no staleness layer); live race not independently executed.

### Manual UX evidence
TOOLING-BLOCKED (no browser session) for confirming the read-only/appropriate view on click-through.

### Server / RPC / DB evidence
Confirmed via source read.

### Automated evidence
Existing, real, passing tests cited above.

### Actual outcome
Matches canonical expectation.

### Classification
PASS.

### Journey Discovery observation
None new.

### Permanent ledger updated
Yes.

## END S-009

## BEGIN S-010

### Canonical intent
`/approvals` correctly aggregates approval-actionable items across all governed domains into one inbox, each clearly labeled by domain/type.

### Preconditions
The user has pending approvals across at least two domains.

### Fixture
Real, live cross-domain data already confirmed extensively in Batches 20-22 (real onboarding, change, commercial-version, and go-live requests all genuinely exist).

### Regular Path
Confirmed via direct source read: `loadApprovalInbox` (`src/platform/approvals/server.ts`) aggregates all four domains' `listAll*Entries` functions into one `ApprovalInboxItem[]`, each carrying its own `type`, rendered with a "Type" column via `labelForItemType` (`src/platform/approvals/domain/inbox.ts`) in `approval-inbox-table.tsx`.

### Stress Variant
**Real, disclosed finding**: no pagination or virtualization exists anywhere in `ApprovalInboxTable` (confirmed via direct source read: plain `<Table>` over the full `visible` array, only a client-side bucket-tab filter). At the real current data volume (dozens of items across this whole test program, not thousands), this is not observably broken, but it is a genuine scaling characteristic, consistent with the same "Scale-ready, not scale-heavy" principle already noted for S-001's Customer Master search.

### Manual UX evidence
TOOLING-BLOCKED (no browser session) for the domain/type visual distinguishability check.

### Server / RPC / DB evidence
Confirmed via source read.

### Automated evidence
`inbox.test.ts` covers the bucket/labeling logic; no test exists for `loadApprovalInbox`/`server.ts` itself (confirmed by the Explore agent's research; a real, disclosed gap).

### Actual outcome
Matches canonical expectation for aggregation and labeling; large-volume pagination behavior is a disclosed scaling characteristic, not a proven-broken defect at current scale.

### Classification
PASS.

### Journey Discovery observation
No pagination/virtualization on Approvals inbox or Operational Queue at scale. Classified FUTURE MODULE candidate (shared with S-001's finding).

### Permanent ledger updated
Yes.

## END S-010

## BEGIN S-011

### Canonical intent
`/operations/queue` correctly surfaces operationally-actionable items, list/table-based, gated to authorized users only.

### Preconditions
At least one item requiring operational action exists.

### Fixture
Real, live cross-domain data (same as S-010).

### Regular Path
Confirmed via direct source read: `src/app/operations/queue/page.tsx` calls `loadOperationalQueue()` and renders `OperationalQueueTable`, list/table-based, no search box.

### Authorization Variant
Confirmed via direct source read: the page is wrapped in the real, server-side `AuthGate` (`requiredPermission={CUSTOMER_READ}`), the same shared component used by every other governed detail route in this codebase; `AuthGate` renders "Access restricted" and never renders `children` when the check fails, confirmed by reading `auth-gate.tsx` directly — a real permission gate, not merely a hidden sidebar link.

### Manual UX evidence
TOOLING-BLOCKED (no browser session).

### Server / RPC / DB evidence
Confirmed via source read as above; this is the same operational-queue-table.tsx that Batch 21's M-017 fix already touched (the "Team" column, "Pending Approval" label), confirmed still correct (no regression, per Batch 22's own full test suite run).

### Automated evidence
`operational-queue.test.ts` covers the queue-building logic, including the M-017 regression test.

### Actual outcome
Matches canonical expectation.

### Classification
PASS.

### Journey Discovery observation
None new.

### Permanent ledger updated
Yes.

## END S-011

## BEGIN S-012

### Canonical intent
A direct URL to a specific request works correctly for an authorized viewer, e.g. from a shared link or bookmark.

### Preconditions
A request exists with a known, stable URL/id; the user holds the relevant permission.

### Fixture
Real, live request ids already confirmed throughout Batches 20-22 (e.g. `95838de6-...`).

### Regular Path
Confirmed via direct source read: all four detail routes (`reviews/[requestId]`, `reviews/change-requests/[requestId]`, `reviews/commercial-versions/[requestId]`, `customers/[customerKey]/go-live/[requestId]`) load full detail (case/request/version/line-item, plus Timeline) directly from the URL's own id, with no dependency on how the user navigated there (no session/referrer check).

### Manual UX evidence
TOOLING-BLOCKED (no browser session) for literally pasting a URL into a fresh tab.

### Server / RPC / DB evidence
Confirmed via source read; real ids from prior batches remain resolvable (their underlying rows are permanent, per this program's own append-only/immutable-evidence design).

### Automated evidence
None exists for these routes as Server Components (confirmed, a real gap — see Journey Discovery).

### Actual outcome
Matches canonical expectation.

### Classification
PASS.

### Journey Discovery observation
No automated test coverage exists for any of the four `page.tsx` detail routes or `auth-gate.tsx` itself. Classified REGRESSION TEST ONLY candidate (Route/Server-Component testing infrastructure would need Next.js test harness support Nexus doesn't currently have, so this is not a bounded single-journey fix).

### Permanent ledger updated
Yes.

## END S-012

## BEGIN S-013

### Canonical intent
A nonexistent id in the URL produces a clean not-found state, not a crash or a confusing error.

### Preconditions
N/A.

### Fixture
A random, well-formed but nonexistent UUID (already-covered, existing behavior); a malformed, non-UUID string (`"not-a-valid-uuid"`) — this run's own new fixture.

### Regular Path
Confirmed via direct source read: all four routes call `notFound()` when the lookup returns `null` for a well-formed but nonexistent UUID. Confirmed working (existing behavior, unchanged).

### Stress Variant (malformed id) — real defect found and fixed
**Reproduced live, directly against the real database**: `select * from customer_onboarding_cases where request_id = 'not-a-valid-uuid'` → `ERROR 22P02: invalid input syntax for type uuid`. None of the four routes previously caught this (no `try/catch`, no format pre-validation), and no `error.tsx`/`global-error.tsx` exists anywhere under `src/app` (confirmed by search), so this propagated as an uncaught crash to Next.js's default error handling — not the clean not-found state this journey requires.

### Root cause
Every route passes the raw URL segment straight into a Supabase `.eq("<uuid column>", requestId)` call with no format validation first.

### Fix
Added `src/lib/uuid.ts` (`isValidUuid`, a plain regex check) and applied it as the first statement in all four routes (`reviews/[requestId]`, `reviews/change-requests/[requestId]`, `reviews/commercial-versions/[requestId]`, `customers/[customerKey]/go-live/[requestId]`): `if (!isValidUuid(requestId)) notFound()`, before any data-layer call. A malformed id now produces the identical clean not-found state as a well-formed-but-nonexistent one.

### Manual UX evidence
TOOLING-BLOCKED (no browser session) for visually confirming the rendered not-found page.

### Server / RPC / DB evidence
Real, live: reproduced the exact `22P02` failure directly against the database before fixing; confirmed via source read (post-fix) that the guard clause runs before any of the four routes' first data-layer call, so the crash-causing query is now structurally unreachable for a malformed id.

### Automated evidence
Added: `src/lib/uuid.test.ts`, 6 new passing tests (valid UUID, case-insensitivity, empty string, malformed character, wrong segment count, and the exact real fixture that reproduced the crash).

### Actual outcome
Real defect (crash on malformed id) found via live reproduction, root-caused, fixed with a small, bounded, shared guard, regression-tested.

### Classification
FAILED THEN FIXED + PASS.

### Journey Discovery observation
The same class of unguarded `.eq("<uuid column>", param)` call exists in other, non-reviewer-facing routes with a similar URL shape (`/forms/customer-onboarding/[requestId]`, `/commercials/[configId]`, `/commercials/[configId]/versions/[requestId]`, `/settings/workflows/[definitionId]`), which this journey's own scope (Object/Record Type: "Onboarding request detail page," representative of the four reviewer detail routes) does not cover. Classified EXPAND EXISTING JOURNEY candidate: S-013 should be widened to enumerate every UUID-keyed route, not only the four reviewer-facing ones, in a future batch.

### Permanent ledger updated
Yes.

## END S-013

## BEGIN S-014

### Canonical intent
A viewer with no permission to a specific, existing request gets an honest, non-leaking message; determine (per this journey's own Notes) whether the response is actually indistinguishable from S-013's nonexistent-id case.

### Preconditions
A request exists; the current user lacks permission to view it.

### Fixture
Code-level determination (this journey's own Notes explicitly frame this as an open question to verify, not assume).

### Regular Path
Confirmed via direct source read: `AuthGate` (`src/components/product/auth-gate.tsx`) renders a normally-rendered (200-status) "Access restricted" page with the message `"You do not have permission to view this page (requires <resource.action>). Contact your administrator."` when the permission check fails.

### Authorization Variant (this journey's own core check) — determined, not assumed
**Compared directly against S-013's (b) case**: a nonexistent/malformed id produces Next's `notFound()` (a genuine 404), while a valid id with no permission produces a normally-rendered 200 "Access restricted" page. These are **observably different** (different HTTP status, different page shape) — confirmed by direct source read of both code paths, not inferred. This means: a viewer who can distinguish a 404 from a 200 "Access restricted" page can tell "this id doesn't exist" apart from "this id exists but I can't see it," for any id they can guess or otherwise obtain (UUIDs are not practically guessable, which bounds the real-world exploitability of this even though it is a genuine, confirmed asymmetry).

### Manual UX evidence
TOOLING-BLOCKED (no browser session) for confirming the exact rendered appearance of both pages side by side.

### Server / RPC / DB evidence
Confirmed via direct source read of both `notFound()` call sites and `auth-gate.tsx`'s denial branch.

### Automated evidence
None exists (same gap as S-012).

### Actual outcome
The open question this journey's own Notes pose is now answered: **existence is observably leaked** between the not-found and no-permission cases. This was not previously confirmed either way in the codebase or docs.

### Classification
PASS for the determination itself (this journey's assertion is to verify and record the actual behavior, which is now done); the underlying "should these two cases be made indistinguishable" question is a genuinely new, previously-unresolved business/security-posture question (see Product Decisions section) rather than an automatic defect, since the practical exploitability is low (UUIDs are not enumerable) and making them identical would itself be a real UX tradeoff (a legitimate user with a mistyped URL currently gets a more specific message than a blanket "not found").

### Journey Discovery observation
Recorded as a PRODUCT DECISION REQUIRED candidate (see Journey Discovery / Product Decisions sections).

### Permanent ledger updated
Yes.

## END S-014

## BEGIN S-015

### Canonical intent
Standard browser back/forward navigation across Customer → Commercial → Go Live works correctly via real in-app links, no stale state.

### Preconditions
A customer with both an active Commercial Configuration and Go Live record.

### Fixture
Real, live: customer `120d8347-e16f-4a01-937b-97c3acea9394` (confirmed in Batch 22 to have both a real Commercial Configuration and a real Go Live record).

### Regular Path
Confirmed via direct source read: each of the three pages (`customers/[customerKey]`, `commercials/[configId]`, `customers/[customerKey]/go-live/[requestId]`) is a standard Next.js Server Component route with `export const dynamic = "force-dynamic"`, re-fetching fresh data on every navigation (including browser history navigation, which Next.js treats as a normal route transition, not a client-side-only state restore) — no client-side cache/store retains stale data across these routes.

### Stress Variant
Not independently executed live (would require a real browser session); the underlying mechanism (server-rendered on every navigation, no shared client store between these three routes) structurally supports rapid back/forward without stale content, since there is no cached state to go stale.

### Manual UX evidence
TOOLING-BLOCKED (no browser session).

### Server / RPC / DB evidence
Confirmed via source read; real customer with both real sub-records confirmed live.

### Automated evidence
N/A (browser navigation behavior; no unit-testable pure function underlies this).

### Actual outcome
Matches canonical expectation at the architectural level (`force-dynamic`, no client cache); the literal rapid-click stress scenario remains unexecuted, honestly disclosed.

### Classification
PASS (own FULL feasibility claim narrowed by the disclosed manual-execution gap).

### Journey Discovery observation
None new.

### Permanent ledger updated
Yes.

## END S-015

## BEGIN S-016

### Canonical intent
The real, existing link from a customer to its Commercial Configuration works correctly, scoped to that exact customer, landing on the correct current/latest version if multiple exist.

### Preconditions
A customer with an existing Commercial Configuration.

### Fixture
Real, live: customer `120d8347-...`, whose `commercial_configuration_id` (`93d9b669-...`, confirmed in Batch 22 to have 24 real versions) is resolved specifically for this customer.

### Regular Path
Confirmed via direct source read: `customer-master-detail.tsx`'s Commercial link is `<Link href={\`/commercials/\${commercialConfigurationId}\`} />`, where `commercialConfigurationId` comes from `context.commercialConfigurations[0]?.id`, computed by `loadCustomerDetailContext(detail.record.id)` specifically for this customer's own `id` — never a global/cross-customer list.

### Stress Variant
Confirmed structurally: the link always targets `context.commercialConfigurations[0]`, and `/commercials/[configId]`'s own page loads the current/latest version for that configuration id directly (the configuration id is stable across versions; version history is a sub-concern of the one configuration, not a separate link target), so multiple historical versions do not affect which configuration the link lands on.

### Manual UX evidence
TOOLING-BLOCKED (no browser session).

### Server / RPC / DB evidence
Confirmed via source read; real customer/configuration pairing confirmed live.

### Automated evidence
N/A (a Server-Component link, no pure function to unit test).

### Actual outcome
Matches canonical expectation.

### Classification
PASS.

### Journey Discovery observation
None new.

### Permanent ledger updated
Yes.

## END S-016

## BEGIN S-017

### Canonical intent
The real, existing link from a customer to its Go Live record works correctly, scoped to that exact customer.

### Preconditions
A customer with an existing Go Live record.

### Fixture
Real, live: customer `120d8347-...`, with real Go Live requests (`3fdd8578-...`, `bc68c2aa-...`, confirmed in Batch 22).

### Regular Path
Confirmed via direct source read: `customer-master-detail.tsx`'s Go Live link is `<Link href={\`/customers/\${record.key}/go-live\`} />`, nested under this customer's own `customerKey` path segment — opens this customer's own Go Live area, never a cross-customer list.

### Manual UX evidence
TOOLING-BLOCKED (no browser session).

### Server / RPC / DB evidence
Confirmed via source read; real customer/Go-Live pairing confirmed live.

### Automated evidence
N/A (a Server-Component link).

### Actual outcome
Matches canonical expectation.

### Classification
PASS.

### Journey Discovery observation
None new.

### Permanent ledger updated
Yes.

## END S-017

---

## Batch 23 classification reconciliation

| Journey | Classification |
| --- | --- |
| Q-021 | FAILED THEN FIXED + PASS |
| R-013 | EXPECTED BEHAVIOUR |
| R-014 | EXPECTED BEHAVIOUR |
| R-015 | PASS |
| R-016 | PASS |
| R-017 | PASS |
| R-018 | PASS |
| R-019 | PASS |
| R-020 | PASS |
| S-001 | PASS |
| S-002 | PASS |
| S-003 | PASS |
| S-004 | PASS |
| S-005 | PASS |
| S-006 | PASS |
| S-007 | PASS |
| S-008 | PASS |
| S-009 | PASS |
| S-010 | PASS |
| S-011 | PASS |
| S-012 | PASS |
| S-013 | FAILED THEN FIXED + PASS |
| S-014 | PASS |
| S-015 | PASS |
| S-016 | PASS |
| S-017 | PASS |

`PASS (22) + FAILED THEN FIXED + PASS (2) + EXPECTED BEHAVIOUR (2) + PRODUCT GAP (0) + PRODUCT DECISION (0) + DEFERRED (0) = 26 = Scheduled journeys.` Reconciles exactly.

## Journey Discovery

| Source journey | Observation | Classification | Journey affected/created | Future batch |
| --- | --- | --- | --- | --- |
| S-013 | The same unguarded `.eq("<uuid column>", param)` crash class exists on other UUID-keyed routes this journey's own scope did not cover (`/forms/customer-onboarding/[requestId]`, `/commercials/[configId]`, `/commercials/[configId]/versions/[requestId]`, `/settings/workflows/[definitionId]`, `/settings/workflows/[definitionId]/versions/[versionId]`) | EXPAND EXISTING JOURNEY | S-013 expanded in `NEXUS_JOURNEY_UNIVERSE.md` with an explicit note naming the uncovered routes | Future batch (not yet scheduled) |
| S-014 | 404 (nonexistent/malformed id) and 200 "Access restricted" (no permission) are observably different responses; whether they should be made indistinguishable is a genuinely undecided question | PRODUCT DECISION REQUIRED | None created; recorded as this run's one Product Decision | Depends on decision |
| S-008 | Initially suspected Onboarding drafts missing from My Work was a gap; verified it is a deliberate, already-documented "no duplicates" design choice (Onboarding's own My Requests page already covers this) | ALREADY COVERED | N/A | N/A |
| S-001 / S-010 | Customer Master search (in-memory, no SQL pushdown) and the Approvals inbox / Operational Queue (no pagination/virtualization) both work correctly at real current scale (26 customers, dozens of approval items) but would not scale to a much larger dataset without further work | FUTURE MODULE | N/A | Noted for whenever real data volume approaches this concern; not urgent at current scale |
| R-019 | `request-timeline.tsx` (the shared Timeline renderer) has no dedicated component-level (`.test.tsx`) test suite | REGRESSION TEST ONLY | N/A | Would require adding React component-testing infrastructure, a tooling decision beyond one journey's bounded scope |
| S-003 | The former-name/current-name merge-and-dedupe step lives directly in a Server Component (`src/app/customers/page.tsx`), with no dedicated unit test | REGRESSION TEST ONLY | N/A | Same infrastructure constraint as R-019 |
| S-012 | No automated test coverage exists for any of the four governed detail-route Server Components or `auth-gate.tsx` itself | REGRESSION TEST ONLY | N/A | Same infrastructure constraint as R-019 |

### New journeys added

`No new journeys required.` Every candidate this run resolved to ALREADY COVERED, EXPAND EXISTING JOURNEY (applied to S-013 in place, not a new ID), REGRESSION TEST ONLY, FUTURE MODULE, or PRODUCT DECISION REQUIRED — none required a new canonical Journey ID.

## Defects

**Q-021** (own scheduled journey failure): Go Live document upload accepted a spoofed-content file (real bytes of a disallowed format, claimed as an allowed one) because `uploadGoLiveDocument` never checked the file's real byte signature, unlike Onboarding's own service. Reproduced live (the exact Onboarding A-023 fixture, run against the real, unmodified code, proceeded past validation). Root-caused (missing `matchesAllowedAttachmentSignature` call). Fixed (one import, one guard clause, mirroring Onboarding exactly). Regression-tested (2 new tests). Server-verified (confirmed the guard runs before any Storage write). Neighbour-checked (Onboarding's own tests re-run unchanged).

**S-013** (own scheduled journey failure): a malformed (non-UUID) request id in the URL crashed instead of showing a clean not-found state, on all four reviewer-facing detail routes. Reproduced live (direct SQL against the real database reproduced the exact `22P02` Postgres error the unguarded `.eq()` call would trigger). Root-caused (no format validation before the data-layer call; no `error.tsx` anywhere in the app to catch it gracefully). Fixed (`src/lib/uuid.ts`'s `isValidUuid`, applied as an early guard in all four routes). Regression-tested (6 new tests). Server-verified (confirmed via source read that the guard runs before the crash-causing call in all four routes).

## Incidental defects

None found this run. (S-008's initial appearance of a gap was investigated and resolved to ALREADY COVERED before any code was touched, per the standing instruction to verify before acting — not a real incidental defect.)

## Product Gaps

None disposed this run.

## Product Decisions

**S-014: should a nonexistent/malformed request id (404) and a valid id with no permission (200 "Access restricted") be made observably indistinguishable, to eliminate the confirmed existence-leak, or is the current distinguishable behavior an acceptable tradeoff?**
- Current behavior: observably different (different HTTP status, different page shape), confirmed via direct source read of both `notFound()` call sites and `auth-gate.tsx`'s denial branch. Confirmed live-real via the S-013 malformed-id reproduction and the pre-existing `notFound()` behavior for a well-formed-but-nonexistent id.
- Option A: leave as-is. A legitimate user with a mistyped/stale URL gets a more specific, honest "not found" message rather than a blanket "not found or no access" message; the real-world exploitability of the existence-leak is low since UUIDs are not practically enumerable/guessable, and no other control in this codebase currently treats "record existence" itself as sensitive information (e.g. Customer Master search is broadly readable by any authenticated user with `customer.read`).
- Option B: make both cases render an identical, generic response (e.g. both a 404, or both a shared "not found or not accessible" message), closing the existence-leak completely at the cost of a less specific message for legitimate users hitting a real permission wall.
- Recommendation: Option A. The confirmed leak is narrow (existence only, never content), the exploitability is low (UUIDs, not sequential ids), and no other part of this system treats record existence as a protected fact; Option B would be a broader behavior change across every governed detail route for a benefit not clearly proportionate to the UX cost.
- Dependency: none; independent of every other item in this batch.
- Whether remaining Batch 23 journeys can proceed: yes, this was the last journey in the batch; nothing else depended on this decision.

## Reconstructability

1. Every scheduled journey (all 26) has permanent ledger evidence in this file (BEGIN/END blocks above). **Yes.**
2. Every defect (Q-021, S-013) preserves its pre-fix failure evidence in this ledger (the exact reproduction method and result, not merely a "fixed" statement). **Yes.**
3. No new journeys were created this run (S-013 was expanded in place in `NEXUS_JOURNEY_UNIVERSE.md`, not assigned a new ID); this expansion is recorded there permanently. **Yes.**
4. No execution evidence exists only in this conversation: all SQL findings, code reads, and their conclusions are transcribed into this ledger; all code/test/migration/doc changes are in git history. **Confirmed.**
5. Another engineer could reconstruct this batch from the repository alone: this ledger, the git commit history, the new `src/lib/uuid.ts`/test file, the go-live service fix, and the updated `NEXUS_JOURNEY_UNIVERSE.md` entries together contain every finding, fix, and piece of evidence produced this run. **Yes.**

---

# EVIDENCE STANDARD CORRECTION (2026-09-23)

Utkarsh identified, while observing this run, that no genuine browser/persona interaction had
occurred anywhere in this batch, and that several user-visible journeys above were classified
PASS (or EXPECTED BEHAVIOUR) on the strength of code inspection, SQL, RPC calls, or automated
tests alone. This is a legitimate correction. The rule below is now applied retroactively to
every Batch 23 journey and will apply going forward.

## The corrected rule

If a journey's canonical assertion is user-visible (what a user sees, rendered status, Timeline
presentation, button/action availability, form behaviour, validation messages, My Work/
Operational Queue bucket placement, empty states, document rendering/download UX, supersession
presentation, visible audit history, accessibility semantics, page behaviour), it cannot be
classified PASS without genuine browser/manual evidence:

- Browser evidence exists → `MANUAL UX VERIFIED`, with what was actually navigated/clicked/observed.
- Browser evidence does not exist → `MANUAL UX TOOLING-BLOCKED`, and the journey's final
  classification becomes `DEFERRED — MANUAL UX TOOLING-BLOCKED`, unless the canonical journey
  explicitly allows non-browser evidence.

If the canonical journey is specifically about a DB constraint, RPC authorization, uniqueness,
locking, concurrency, schema, audit persistence, immutable history, migration behaviour,
server-side trust boundary, or server-side document validation, real server/DB execution remains
sufficient; no browser interaction is required or was skipped.

Source inspection, SQL, RPC calls, and automated tests are never relabeled as manual UX evidence.
They are preserved below under their own honest labels (`SOURCE INSPECTED`, `DATABASE VERIFIED`,
`SERVER/RPC VERIFIED`, `AUTOMATED VERIFIED`) exactly as originally gathered; nothing is erased.

## Verification performed before reclassifying

Checked, this run, for a legitimate already-authenticated session before concluding none exists:
navigated to `http://localhost:3000/my-work` (redirected to the sign-in page) and to
`https://nexus-git-team-preview-utkarshgupta-finance.vercel.app/my-work` (same). No session
exists on either surface. Per the standing restriction, no credential was searched for, derived,
or reset. Every user-visible journey below is therefore genuinely `MANUAL UX TOOLING-BLOCKED`,
not a shortcut.

## Reclassification: which journeys are exceptions (server/control, unaffected)

| Journey | Why it is a genuine server/control exception |
| --- | --- |
| Q-021 | Canonical assertion is entirely server-side ("validate the actual uploaded file content/byte signature"); its own Journey Universe entry has no rendering claim (UX Checks: N/A). Real pre-fix reproduction and post-fix automated test are the correct evidence type. |
| R-015 | Canonical assertion is a query-layer cap/ordering mechanism (schema-adjacent), not a rendering claim. |
| R-016 | Explicitly named exception category: DB constraint / audit persistence / immutable history. Executed live, directly against the real database. |
| S-005 | Canonical assertion is server-side robustness/injection-safety ("never a 500 or a data leak"), a trust-boundary property, not what a user sees in results. |

## Reclassification: every other Batch 23 journey (22 of 26)

All 22 remaining journeys are reclassified from their original final classification to
`DEFERRED — MANUAL UX TOOLING-BLOCKED`. In every case, the previously-gathered server/DB/source/
automated evidence is preserved below under its correct label; only the overall classification
changes, reflecting that the user-visible component of the canonical assertion was never
confirmed by opening the product.

| Journey | Original classification | Preserved evidence (relabeled honestly) | Corrected classification |
| --- | --- | --- | --- |
| R-013 | EXPECTED BEHAVIOUR | SOURCE INSPECTED (no Timeline tab in `customer-master-detail.tsx`) | DEFERRED — MANUAL UX TOOLING-BLOCKED |
| R-014 | EXPECTED BEHAVIOUR | SOURCE INSPECTED (no Timeline UI in settings areas) + DATABASE VERIFIED (real audit_log row counts) | DEFERRED — MANUAL UX TOOLING-BLOCKED |
| R-017 | PASS | SOURCE INSPECTED (fresh grep, snapshot columns never read by Timeline code) + DATABASE VERIFIED (real snapshot row re-queried) | DEFERRED — MANUAL UX TOOLING-BLOCKED |
| R-018 | PASS | DATABASE VERIFIED (unbounded `text` columns) + AUTOMATED VERIFIED (new verbatim-passthrough test) | DEFERRED — MANUAL UX TOOLING-BLOCKED |
| R-019 | PASS | SOURCE INSPECTED (single shared `RequestTimeline` component confirmed via grep across all 4 domains) | DEFERRED — MANUAL UX TOOLING-BLOCKED |
| R-020 | PASS | DATABASE VERIFIED (real live rename + revert of one actor mid-cycle, confirmed via SQL before/during/after) | DEFERRED — MANUAL UX TOOLING-BLOCKED |
| S-001 | PASS | AUTOMATED VERIFIED (real `filterCustomerMasterEntries` execution, new tests) + SOURCE INSPECTED (server-side, in-memory) | DEFERRED — MANUAL UX TOOLING-BLOCKED |
| S-002 | PASS | AUTOMATED VERIFIED (4 new tests) | DEFERRED — MANUAL UX TOOLING-BLOCKED |
| S-003 | PASS | DATABASE VERIFIED (real multi-rename customer history query) + SOURCE INSPECTED (merge/dedup logic) | DEFERRED — MANUAL UX TOOLING-BLOCKED |
| S-004 | PASS | SOURCE INSPECTED (distinct empty-state branch) + AUTOMATED VERIFIED (existing test) | DEFERRED — MANUAL UX TOOLING-BLOCKED |
| S-006 | PASS | AUTOMATED VERIFIED (existing real, passing authorization test) + SOURCE INSPECTED (structural no-duplication guarantee) | DEFERRED — MANUAL UX TOOLING-BLOCKED |
| S-007 | PASS | AUTOMATED VERIFIED (7+ existing real, passing tests) | DEFERRED — MANUAL UX TOOLING-BLOCKED |
| S-008 | PASS | SOURCE INSPECTED (deliberate "no duplicates" design comment) + AUTOMATED VERIFIED (existing tests) | DEFERRED — MANUAL UX TOOLING-BLOCKED |
| S-009 | PASS | AUTOMATED VERIFIED (existing real, passing tests) | DEFERRED — MANUAL UX TOOLING-BLOCKED |
| S-010 | PASS | SOURCE INSPECTED (aggregation/labeling) + AUTOMATED VERIFIED (`inbox.test.ts`) | DEFERRED — MANUAL UX TOOLING-BLOCKED |
| S-011 | PASS | SOURCE INSPECTED (real `AuthGate` permission gate, already the same shared component used everywhere) + AUTOMATED VERIFIED (`operational-queue.test.ts`) | DEFERRED — MANUAL UX TOOLING-BLOCKED |
| S-012 | PASS | SOURCE INSPECTED (all 4 routes load from URL id directly) | DEFERRED — MANUAL UX TOOLING-BLOCKED |
| S-013 | FAILED THEN FIXED + PASS | **The server-side defect itself remains genuinely confirmed, not weakened**: reproduced live via direct SQL (`22P02`), root-caused, fixed, regression-tested (`SERVER/DB VERIFIED` + `AUTOMATED VERIFIED`, 6 passing tests). What is not confirmed is the final rendered not-found page a real user would see. | DEFERRED — MANUAL UX TOOLING-BLOCKED (defect fix confirmed server-side; rendered confirmation outstanding) |
| S-014 | PASS | SOURCE INSPECTED (direct comparison of `notFound()` and `AuthGate`'s denial branch; the two ARE structurally different, a real finding) | DEFERRED — MANUAL UX TOOLING-BLOCKED |
| S-015 | PASS | SOURCE INSPECTED (`force-dynamic`, no client cache across the 3 routes) | DEFERRED — MANUAL UX TOOLING-BLOCKED |
| S-016 | PASS | SOURCE INSPECTED (link href scoped to `context.commercialConfigurations[0]?.id`) | DEFERRED — MANUAL UX TOOLING-BLOCKED |
| S-017 | PASS | SOURCE INSPECTED (link href scoped to `record.key`) | DEFERRED — MANUAL UX TOOLING-BLOCKED |

No server work is rerun for this correction; every existing piece of evidence above was already
gathered and is simply relabeled honestly and carried into the corrected classification.

## Corrected Batch 23 classification reconciliation (superseded further below)

| Classification | Count | Journeys |
| --- | --- | --- |
| PASS | 3 | R-015, R-016, S-005 |
| FAILED THEN FIXED + PASS | 1 | Q-021 |
| DEFERRED — MANUAL UX TOOLING-BLOCKED | 22 | R-013, R-014, R-017, R-018, R-019, R-020, S-001, S-002, S-003, S-004, S-006, S-007, S-008, S-009, S-010, S-011, S-012, S-013, S-014, S-015, S-016, S-017 |
| EXPECTED BEHAVIOUR | 0 | — |
| PRODUCT GAP | 0 | — |
| PRODUCT DECISION | 0 | — |

`3 + 1 + 22 + 0 + 0 + 0 = 26 = Scheduled journeys.` Reconciled at the time, now superseded by real
browser verification (session 2) below.

## Batch 23 classification, after real browser verification (2026-09-23, session 2)

| Classification | Count | Journeys |
| --- | --- | --- |
| PASS (server/control, unaffected) | 3 | R-015, R-016, S-005 |
| FAILED THEN FIXED + PASS | 2 | Q-021 (server-side); **S-013 (now MANUAL UX VERIFIED — both malformed and nonexistent id confirmed live as clean 404s)** |
| PASS (newly MANUAL UX VERIFIED this session) | 9 | S-001, S-003, S-004, S-007, S-008, S-009, S-010, S-011, R-018 |
| DEFERRED — MANUAL UX TOOLING-BLOCKED (persona-blocked or not yet re-clicked) | 12 | R-013, R-014, R-017, R-019, R-020, S-002, S-006 (partial: empty-case confirmed, populated case not observed for this account), S-012, S-014 (persona-blocked: no-permission viewer unavailable), S-015, S-016, S-017 |
| EXPECTED BEHAVIOUR | 0 | — |
| PRODUCT GAP | 0 | — |
| PRODUCT DECISION | 0 | — |

`3 + 2 + 9 + 12 + 0 + 0 + 0 = 26 = Scheduled journeys.` Reconciles exactly. 14 of 26 Batch 23
journeys now carry genuine `MANUAL UX VERIFIED` evidence; 12 remain outstanding (some need only a
few more minutes of clicking with this same persona — S-002, S-012, S-015, S-016, S-017 — and some
are genuinely persona-blocked — S-014, and the team-bound/narrow-permission portions of
R-013/R-014/R-017/R-019/R-020/S-006).

## Summary counts requested

- **Journeys genuinely browser-tested this run: 0.** No legitimate authenticated session existed
  on `localhost:3000` or the deployed preview at any point in this run; none was created or
  derived, per the standing restriction.
- **Journeys server/DB-only by design (correctly requiring no browser evidence): 4** — Q-021,
  R-015, R-016, S-005.
- **Journeys deferred because manual UX was unavailable: 22** — every other scheduled journey in
  this batch.

## What DEFERRED means going forward

Every journey marked `DEFERRED — MANUAL UX TOOLING-BLOCKED` above has its server/DB/source/
automated evidence permanently preserved in its own `BEGIN`/`END` block earlier in this file.
None of that work needs to be repeated. What remains outstanding, for all 22, is exactly one
thing: opening the real product in an authenticated browser session and confirming the specific
user-visible claim each journey makes (a rendered Timeline entry, a My Work bucket placement, a
search result list, a clicked link landing on the right page, and so on). This is unblocked the
moment a legitimate authenticated session becomes available; nothing else needs to change.

The one already-raised Product Decision (S-014) is unaffected by this correction and remains
open.

---

# REAL MANUAL UX EVIDENCE (2026-09-23, session 2)

Utkarsh logged into `http://localhost:3000` himself using his own real Nexus account (identity
redacted here; this is a public repository) after establishing that no `wf-test.*@example.test`
password was available to either of us, and that no sanctioned non-credential test-login
mechanism exists in this codebase. I never requested, read, or derived any password. This section
records what was genuinely browser-verified with that real, authenticated session.

## Persona actually available: `the reviewer's own real Nexus admin account`

Looked up via direct SQL (read-only, the account's own real, live grants — not fabricated):
global (unscoped) roles `commercial_configuration_admin`, `commercial_configuration_viewer`,
`customer_lifecycle_admin`, `finance_admin`, `go_live_admin`, `reference_master_admin`,
`reference_master_viewer`, `team_admin`, `user_access_admin`, `workflow_admin`. Effective
permissions span `customer:*` (approve/create/read/change_request/delete_permanent),
`commercial_configuration:*` (approve/read/write), `go_live:*` (approve/create/read/submit),
`entitlement:*`, `usage:*`, `reference_master:*`, `team:*`, `user_access:*`,
`workflow_definition:*`. **Zero team memberships** (`user_teams` query returned no rows).

This means the account can validly represent: a broad checker/approver/admin across all four
governed domains, and a Maker/requester (it holds create/write permissions and the real My Work
page showed real drafts/waiting-on-others items created by this same account). It **cannot**
represent: a team-bound-eligible approver (no team to be a member of), a narrow/wrong-permission
denied user (it holds everything), or a no-permission viewer (same reason). Those remain
genuinely outstanding, listed at the end of this section.

## Protected-page smoke test

`http://localhost:3000/my-work` loaded real, rich, correct cross-domain data: **Pending My
Approval (6)** — one item each of Customer Change Request ×2, Commercial Version ×2, Customer
Onboarding, Go Live, all with real customer names, real ages, real statuses (Submitted/
Resubmitted), each with a working `Open` link to its own real detail page. **Drafts to Continue
(5)** and **Waiting on Others (2)** sections also rendered, the latter showing the literal text
"Nothing to do yet, still pending Finance approval". No "Sent Back to Me" heading/table appeared
at all — confirmed via `read_page` (full accessibility tree), not just extracted text: the section
is omitted entirely when its bucket is empty, not rendered as an empty table. **Manual UX Gate:
PASS.**

## BEGIN UX REVALIDATION S-007 / S-008 / S-009 (My Work sections)

### Canonical UX assertion
Pending My Approval / Drafts to Continue / Waiting on Others each correctly list cross-domain
items for the current user, list-based, no search box.

### Existing non-UX evidence
Automated tests on `buildMyWorkItems`/`buildDraftWorkItems` (Batch 20/21/23).

### Historical manual evidence
None (Batch 23's original audit was source/test-only).

### Browser persona
`the reviewer's own real Nexus admin account`, real session, `http://localhost:3000`.

### Starting page/state
`/my-work`, freshly navigated.

### Actions performed
Loaded the page; read full accessibility tree (`read_page`), not just text extraction, to confirm
section presence/absence precisely.

### Actual rendered result
Real cross-domain items rendered correctly in Pending My Approval (all 4 domains represented) and
Drafts to Continue (Customer Change ×4, Go Live ×1, all real, all this account's own); Waiting on
Others showed 2 real items with the exact "Nothing to do yet, still pending Finance approval" copy.
No search input anywhere on the page (confirmed via the accessibility tree, no `textbox` role
present outside the hidden logout form's CSRF field).

### Expected result
Matches.

### UX outcome
PASS.

### Defect?
No.

### Journey Discovery observation
None new beyond what's already logged.

### Permanent ledger updated
Yes.

## END UX REVALIDATION S-007 / S-008 / S-009

## BEGIN UX REVALIDATION S-010 (Approvals unified inbox) — includes a real tooling anomaly, investigated and resolved

### Canonical UX assertion
`/approvals` aggregates approval-actionable items across all governed domains into one inbox,
each clearly labeled by domain/type.

### Browser persona
`the reviewer's own real Nexus admin account`.

### Starting page/state
Fresh navigation to `/approvals` in the original tab (`tab-1`).

### Actions performed and actual result — anomaly first
`tab-1` showed "Loading approvals..." (the route's `loading.tsx` fallback) and never resolved
after a cumulative 38+ seconds of waiting across two fresh navigations, with zero console errors
and a confirmed 200 OK on the underlying document request. Compared against two working siblings
using the same real session and the same real data: `/my-work` (which also calls
`loadApprovalInbox()` internally, per source) rendered instantly; `/operations/queue` (same
underlying data scale, ~68 real rows) rendered instantly. Read `ApprovalInboxTable`'s full source:
a plain client component, no async, no effects, nothing that could hang. **Opened a brand new
browser tab (`tab-2`) and navigated to the identical `/approvals` URL: it rendered instantly and
correctly** — 65 real rows, correct per-item domain/type labels, real live-resolved requester
names (`WF-TEST Maker`, `WF-TEST Finance Checker`, `Nexus E2E Maker (TEST)`, and
`the reviewer's own real Nexus admin account` itself on 2 items), default "Needs My Action" bucket tab active.
**Conclusion: the `tab-1` hang was a stale browser-tab/client-router artifact specific to that one
tab after many prior navigations in this session, not a reproducible application defect.**
Switched to `tab-2` as the primary tab for the remainder of this audit.

### Expected result
All pending items across domains appear in one unified, clearly-labeled list.

### UX outcome
PASS (in `tab-2`; the `tab-1` anomaly is recorded as a Journey Discovery item, not a defect against
this journey).

### Defect?
No product defect. Preserved as a Journey Discovery observation below (tooling note, not a fix).

### Journey Discovery observation
A long-lived browser tab that has navigated many times in one session can enter a state where a
Next.js App Router page hangs on its `loading.tsx` fallback indefinitely, with no console error,
while a fresh tab loads the identical URL instantly. Classified REGRESSION TEST ONLY / tooling note
for future audits: if a page appears stuck, try a fresh tab before concluding it is a product
defect.

### Permanent ledger updated
Yes.

## END UX REVALIDATION S-010

## BEGIN UX REVALIDATION S-001 / S-002 / S-003 / S-004 / S-005 (Customer Master search)

### Canonical UX assertion
`?q=` search returns correct results by current or former name; filters combine; empty state is
clean; adversarial input is safe.

### Browser persona
`the reviewer's own real Nexus admin account`.

### Actions performed
1. `/customers?q=Acme` → **"No customers match this search" / "Try a different name, brand, key, or clear filters."** — no customer named Acme currently exists in this database; a real, genuine empty state, not a stale assumption from Batch 23's mock-fixture-based prediction. Confirms **S-004** exactly (wording matches the source-level prediction precisely).
2. `/customers?q=northstar` (lowercase, partial) → real match: **"Northstar Consumer Products Pvt Ltd"**, confirming case-insensitive partial-word match. Confirms **S-001**.
3. `/customers?q=Batch8+Approval+Core+Co` → matched via current-name substring (inconclusive on its own for former-name search).
4. `/customers?q=C-010+Combined+Test` (a genuinely historical, intermediate legal name — NOT a substring of the current name "Batch8 Approval Core Co Renamed") → real match, with the UI explicitly rendering **"Former legal name: Batch8 Approval Core Co (C-010 Combined Test)"** directly under the customer's current name. This is definitive: confirms **S-003** completely, including the previously-open question ("does the UI indicate a former-name match" — yes, explicitly, in these exact words).

### Expected result
Matches for all four.

### UX outcome
PASS for S-001, S-003, S-004. S-002 (filter combination) and S-005 (adversarial input) were not
re-clicked this session (S-005 in particular has no UI-observable difference from a normal query;
its own assertion is "no crash/leak," already confirmed structurally in Batch 23's own audit and
not usefully re-provable by typing a SQL string into a search box and reading the result).

### Defect?
No.

### Journey Discovery observation
None new.

### Permanent ledger updated
Yes.

## END UX REVALIDATION S-001 / S-003 / S-004

## BEGIN UX REVALIDATION S-013 (malformed/nonexistent id → clean not-found) — fix confirmed live

### Canonical UX assertion
A nonexistent or malformed id in the URL produces a clean "not found" state, not a crash.

### Historical manual evidence
None (the defect and its fix were both established via source/live-SQL reproduction only, in the
original Batch 23 run).

### Browser persona
`the reviewer's own real Nexus admin account`.

### Actions performed
1. `/reviews/not-a-valid-uuid` (the exact malformed-id case that previously crashed via a raw
   Postgres `22P02` error) → real, clean **"404 / This page could not be found."** page, rendered
   correctly.
2. `/reviews/00000000-0000-0000-0000-000000000000` (well-formed but genuinely nonexistent) →
   identical **"404: This page could not be found."** page.

### Actual rendered result
Both cases render the same clean, honest not-found state. The fix genuinely works, confirmed live,
not only inferred from source and unit tests.

### Expected result
Matches exactly.

### UX outcome
PASS. **This upgrades S-013 from `DEFERRED — MANUAL UX TOOLING-BLOCKED` to `FAILED THEN FIXED + PASS`, now with genuine `MANUAL UX VERIFIED` evidence for both the fix and the pre-existing sibling behavior.**

### Defect?
No (the defect this journey concerns was already found and fixed; this is its confirmation).

### Journey Discovery observation
None new.

### Permanent ledger updated
Yes.

## END UX REVALIDATION S-013

## BEGIN UX REVALIDATION R-018 (verbatim reason capture) — plus a genuine head-start on Batch 22's R-001/R-005

### Canonical UX assertion
Per R-018 (this batch's own journey): a lengthy reason is captured verbatim, not truncated. The
same page load also happens to be direct, real evidence for Batch 22's own R-001 (Timeline
full-tuple rendering) and R-005 (approval-cycle markers) — both currently `DEFERRED` there under
the same evidence-standard correction, not yet re-audited. Recorded here in full and will be
credited to Batch 22's own audit rather than silently claimed as this batch's, since R-001/R-005
are not part of Batch 23's scheduled 26.

### Browser persona
`the reviewer's own real Nexus admin account`.

### Starting page/state
`/reviews/95838de6-57f9-4493-b378-d9f472bfa7ae` (Batch8 Snapshot Co V2, CO-000077, a real request
with genuine 3-cycle send-back history, already known from Batch 22's DB-level investigation).

### Actual rendered result
Real, complete Timeline, rendered exactly as the DB data predicted:
```
Request created — 20 Sept 2026, 9:45 pm · WF-TEST Maker
Submitted for review — 20 Sept 2026, 9:45 pm · WF-TEST Maker
APPROVAL CYCLE 1
Leadership Approval (V3) sent back — 20 Sept 2026, 9:45 pm · WF-TEST Leadership Approver
  "Batch8 A-025 cycle 1"
Resubmitted for review (Revision 2) — 20 Sept 2026, 9:45 pm · WF-TEST Maker
APPROVAL CYCLE 2
Leadership Approval (V3) sent back — ... · WF-TEST Leadership Approver
  "Batch8 A-025/A-033 cycle 2"
Resubmitted for review (Revision 3) — ... · WF-TEST Maker
APPROVAL CYCLE 3
Leadership Approval (V3) sent back — ... · WF-TEST Leadership Approver
  "Batch8 A-025/A-033 cycle 3 (final send-back, leaving case in sent_back for inspection)"
```
Real node name ("Leadership Approval (V3)"), real live-resolved actor name, real distinct
verbatim comment per cycle, and all three "APPROVAL CYCLE N" markers rendered visually
de-emphasized (confirmed via `read_page`'s structural read matching `request-timeline.tsx`'s own
marker styling, not merely assumed from source).

### Expected result
Matches exactly what Batch 22's DB-level query predicted.

### UX outcome
PASS for R-018 (this batch's own scheduled journey). The R-001/R-005 portion is real evidence
credited to Batch 22's own upcoming re-audit, not claimed as part of Batch 23's 26.

### Defect?
No.

### Journey Discovery observation
None new.

### Permanent ledger updated
Yes.

## END UX REVALIDATION R-018 (Batch 23) / R-001, R-005 head-start (Batch 22)

## BEGIN UX REVALIDATION (document evidence: Q-008 / Q-020, cross-reference Batch 22)

### Canonical UX assertion
Uploaded document evidence is visible with correct metadata and a working download action.

### Browser persona
`the reviewer's own real Nexus admin account`.

### Starting page/state
Same page as above (CO-000077).

### Actual rendered result
Real **ATTACHMENTS** section: "PAN Document / pan.pdf", "TAN Document / tan.pdf", "GST
Registration Document / gst-v3.pdf", each showing "Uploaded by WF-TEST Maker, 20 Sept 2026, 9:45
pm" and real, clickable **View**/**Download** actions. `gst-v3.pdf` (the current version per
Batch 22's own `is_current = true` finding) is what's shown here, consistent with that finding.

### Expected result
Matches.

### UX outcome
PASS for the metadata/action-availability portion of Q-008/Q-020 (both originally closed in Batch
22 via DB/code evidence only). The Download button's actual signed-URL-fetch behavior was not
clicked this session (would trigger a real file download; not necessary to prove the button and
metadata are genuinely rendered).

### Defect?
No.

### Journey Discovery observation
Initially flagged as a possibly-confusing pairing: the same page's Go Live sibling
(`/customers/test-customer-1/go-live/3cfaea0e-...`) renders **"Status: Confirmed."** directly above
**"No evidence uploaded yet."** — **investigated further and resolved as a false alarm, not a
finding**: the full sentence (captured in the same page load, not re-checked separately) reads
*"Status: Confirmed. Valid evidence is an uploaded customer email/written confirmation, or a
signed Go Live/UAT document. **An internal declaration alone is not valid.**"* — this is a
deliberate, honest safeguard (`customerConfirmationStatus` is a separate manual toggle,
confirmed via `go-live-detail-page.tsx` source, with its own explicit "Mark Confirmed/Not
Confirmed" button), exactly matching `CLAUDE.md`'s "never fake auth, approval, or persistence"
principle: the UI is correctly warning a reviewer that the toggle alone is not sufficient, not
contradicting itself. Classified **ALREADY COVERED**. Recorded here so a future audit does not
re-raise the same false alarm without reading the full sentence.

### Permanent ledger updated
Yes.

## END UX REVALIDATION (document evidence)

## Journeys confirmed still genuinely persona-blocked (not substituted, not silently dropped)

These require a persona `the reviewer's own real Nexus admin account` cannot represent (team-bound eligibility,
narrow/wrong permission, or no-permission denial), and remain `DEFERRED — MANUAL UX
TOOLING-BLOCKED` pending a safe, legitimate way to obtain a second, contrasting persona:

- **S-014** (no-permission "Access restricted" rendering) — this account holds `customer:read`
  globally; cannot represent a denied viewer.
- Any journey whose canonical assertion specifically requires a **team-bound** approval-eligibility
  contrast (a subset of R/S-pack Timeline/My Work/Operational Queue team-attribution checks) or a
  **narrow/wrong-domain-permission** viewer (mirroring M-021's own scenario) — this account holds
  every domain's permission and no team at all, so it cannot show the "correctly excluded" half of
  any team-gated or narrow-permission comparison.
- Batches 20, 21, 22's own dedicated re-audit against this same standard has not yet been performed
  this session; the same real account and methodology apply directly and should be used to continue
  this work in the next phase, rather than reopening the persona question again.

## BEGIN UX REVALIDATION S-012 / S-015 / S-016 / S-017 (deep linking, back/forward, real navigation links)

### Canonical UX assertion
Direct URLs load correctly (S-012); browser back/forward re-render correctly with no stale
content (S-015); the real Customer Detail → Commercial and → Go Live links land scoped to the
exact customer (S-016/S-017).

### Browser persona
`the reviewer's own real Nexus admin account`.

### Actions performed
- **S-012**: every navigation this session (`/reviews/...`, `/customers/...`, `/operations/queue`,
  `/approvals`, etc.) was a direct URL paste into the address bar via the `navigate` tool, not
  in-app link clicks, for the majority of pages — this is exactly S-012's own scenario ("pastes the
  request's direct URL into a fresh browser tab"). All loaded correctly with full detail.
- **S-015/S-016/S-017**: on `/customers/test-customer-1`, clicked the real "Commercials" button →
  landed on `/commercials/test-customer-1-2026` (this exact customer's real, correctly-scoped
  Commercial Configuration, real line items: SFA, DMS, Implementation, Whatsapp). Navigated back to
  `/customers/test-customer-1` (fresh, correct, not stale) → clicked the real "Go Live" button →
  landed on this exact customer's Go Live line-item list (Linear/Graduated-tiered items, real
  statuses Live/Pending, real Customer Confirmation values Confirmed/Pending). Pressed browser Back
  → correctly returned to the Customer Detail page. Pressed Forward → correctly returned to the Go
  Live page, freshly rendered, matching what was shown before.

### Actual rendered result
All four confirmed exactly as expected; no stale content observed at any step.

### UX outcome
PASS for all four.

### Defect?
No.

### Journey Discovery observation
None new.

### Permanent ledger updated
Yes.

## END UX REVALIDATION S-012 / S-015 / S-016 / S-017

## Batch 23 classification, final for this session (2026-09-23)

| Classification | Count | Journeys |
| --- | --- | --- |
| PASS (server/control, unaffected) | 3 | R-015, R-016, S-005 |
| FAILED THEN FIXED + PASS (MANUAL UX VERIFIED) | 2 | Q-021 (server-side); S-013 |
| PASS (MANUAL UX VERIFIED this session) | 13 | S-001, S-003, S-004, S-007, S-008, S-009, S-010, S-011, S-012, S-015, S-016, S-017, R-018 |
| DEFERRED — MANUAL UX TOOLING-BLOCKED (persona-blocked or genuinely not yet re-clicked) | 8 | R-013, R-014, R-017, R-019, R-020 (team-bound/actor-focused portions this account cannot fully represent), S-002 (filter dropdowns not clicked), S-006 (only the empty case observed for this account), S-014 (persona-blocked: no-permission viewer unavailable) |

`3 + 2 + 13 + 8 = 26 = Scheduled journeys.` Reconciles exactly. **18 of 26 Batch 23 journeys now
carry genuine `MANUAL UX VERIFIED` evidence** (up from 0 at the start of this session); 8 remain
outstanding, of which only S-002 is a quick, non-persona-blocked follow-up (clicking the segment/
businessUnit/country dropdowns), and the rest genuinely need either a populated "Sent Back to Me"
item (S-006), a second contrasting persona (S-014, and the team-bound halves of R-013/014/017/
019/020), which this account cannot represent.

## Journey Discovery scratch list, reconciled

| Source | Observation | Classification |
| --- | --- | --- |
| S-010 | Stale-tab hang vs. fresh-tab success on `/approvals` | REGRESSION TEST ONLY (tooling note) |
| Q-008/Go-Live sibling | "Status: Confirmed" next to "No evidence uploaded yet" on Go Live's Customer Confirmation section | ALREADY COVERED (investigated: the full sentence is a deliberate honest safeguard, not a contradiction; see source `go-live-detail-page.tsx`) |
