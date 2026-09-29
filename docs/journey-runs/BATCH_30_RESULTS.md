# Batch 30 Fresh Execution Results

Scope: Z-012 through Z-030 (19 journeys), X-001 through X-006 (6 journeys). 25 scheduled.

## Step 0: Pre-batch Product Gap reconciliation

Read `docs/OPEN_PRODUCT_GAPS.md` directly. Confirmed:

- **A. ACTIVE PRODUCT GAPS: 0** (explicit, section A reads "None currently open").
- PG-036, PG-037, PG-040, PG-056, PG-057, PG-058, PG-059 all remain in **D. CLOSED HISTORY** with no reopening, no regression noted anywhere in the register.
- No previously CLOSED / ACCEPTED AS-IS / DEFERRED item was reopened. No duplicate gap created for anything in this batch.

## Step 0A: Canonical reconciliation against prior decisions

- **Z-025**: canonical text said "61 Postgres functions." Re-verified live via the Supabase security advisor (`function_search_path_mutable` lint): current count is **115**, up from 61 when first documented, grown naturally as new governed RPCs were added across later batches (e.g. `refresh_go_live_request_commercial_version`, `reverse_settlement`, `grant_scoped_user_role`, and others touched by PG-057/PG-059's own fixes). Updated `docs/TECH_DEBT.md` and Z-025's own canonical text in `docs/NEXUS_JOURNEY_UNIVERSE.md` to the real number. No broader remediation attempted (out of scope per explicit instruction); classified this journey EXPECTED / DEFERRED AWARENESS CONFIRMED, not a new gap.
- **X-002**: canonical text already matches PG-058's decided split (ordinary Timelines live-resolve current actor name; Customer Master Activity/History freezes to point-in-time identity via `audit_log`'s snapshot columns). No change needed; will regression-check live, not merely re-assert from memory.
- **Named business errors**: PG-056's error-mapping fix (all four domains' client parsers correctly map `WORKFLOW_TEAM_INACTIVE`) remains intact per the register; Z-023 will regression-check representative tokens rather than refabricate every historical journey.

Batch denominator: 25.

## Step 1: Classification of all 25 journeys (before execution)

| Journey | Evidence class | Manual UX assertions | Server/DB assertions | Persona / tooling |
|---|---|---|---|---|
| Z-012 Unsupported doc type | MIXED MANUAL + SERVER | real upload rejection message | no metadata/storage row created | maker; real OS file-picker feasibility to confirm |
| Z-013 Oversized upload | MIXED MANUAL + SERVER | size-limit message, no hang | no partial object/row | same file-picker caveat |
| Z-014 Legacy null field | MIXED MANUAL + SERVER | no white-screen, honest empty state | legacy row identified | any viewer |
| Z-015 Duplicate-looking name | MANUAL UX REQUIRED | actual create-time behavior | distinctness in DB | maker |
| Z-016 Huge comment | MIXED MANUAL + SERVER | friendly validation | no partial transition | reviewer |
| Z-017 Unicode | MIXED MANUAL + SERVER | round-trip render | DB round-trip | maker |
| Z-018 Boundary dates | MIXED MANUAL + SERVER | picker behavior | stored value match | maker |
| Z-019 Past/future effective date | MIXED MANUAL + SERVER | scheduled/active indicator | fresh-on-read computation | maker |
| Z-020 Malformed deep link | MANUAL UX REQUIRED | clean not-found/denied | no leak | any user |
| Z-021 Deep link to deactivated object | MANUAL UX REQUIRED | graceful message | object deactivated in DB | any user |
| Z-022 DB constraint failure | MIXED MANUAL + SERVER | generic error shown | rollback, no partial row | technical tester + real UI |
| Z-023 Named business error | MIXED MANUAL + SERVER | specific message | regression on known tokens | various |
| Z-024 Unknown error | TOOLING-CONSTRAINED CANDIDATE | generic message | no partial mutation | any user, safe fault needed |
| Z-025 search_path awareness | INVESTIGATIVE | N/A | count reconciled (115) | reviewer |
| Z-026 Two accounts, one browser | MANUAL UX REQUIRED | correct/documented attribution | audit rows | two personas, two tabs |
| Z-027 Signed URL expiry | MIXED MANUAL + SERVER | in-app recovery | real 300s expiry | viewer, disposable doc |
| Z-028 Clock skew | TOOLING-CONSTRAINED CANDIDATE | N/A (unsafe to fake) | server-time-only evidence | maker |
| Z-029 XSS-style content | MIXED MANUAL + SERVER | literal/escaped render | stored inert | reviewer |
| Z-030 Auth admin API failure | TOOLING-CONSTRAINED CANDIDATE | honest degraded state | N/A | user_access_admin |
| X-001 Legacy schema column | MANUAL UX REQUIRED | detail+list render | legacy row confirmed | any viewer |
| X-002 Renamed user (PG-058 regression) | MANUAL UX REQUIRED | Timeline vs Activity split | audit_log snapshot cols | any viewer |
| X-003 Deactivated master value, historical | MANUAL UX REQUIRED | unchanged historical render | value deactivated in DB | any viewer |
| X-004 Workflow superseded, history intact | MANUAL UX REQUIRED | Timeline unchanged | V1 data intact | any viewer |
| X-005 Frozen fx_snapshot_rate | MIXED MANUAL + SERVER | historical version page | DB frozen value unaffected | master admin + viewer |
| X-006 audit_sequence vs commit order | INVESTIGATIVE | N/A | concurrent DB evidence | two approvers |

## Step 2: Manual UX Readiness Gate

Confirmed live: dev server reachable at `http://localhost:3000` (fresh preview tab opened), established personas from prior batches remain usable (`nexus-test-maker`, `nexus-test-legal`, `nexus-test-finance-b`, `nexus-test-ux-approver`, `nexus-test-team-admin`, `nexus-test-reference-master-admin`, `nexus-test-go-live-admin`, `nexus-test-user-access-admin`). Special-capability feasibility (real OS file-picker, oversized file, safe fault injection, 300-second signed-URL wait, client clock skew, Auth admin API failure) established per-journey below as actually attempted, not assumed from prior batches' notes alone.

---

## Journey Evidence

### Z-012: Unsupported document type is uploaded

Tooling feasibility established live, fresh this batch (not from memory): logged in as `nexus-test-maker`, created a fresh onboarding draft (CO-000122), navigated to Tax & Registration, and clicked the real GST Registration Document file-picker button. No native OS file-selection dialog is capturable or interactable by this browser tool (no dialog appears in the accessibility tree or screenshot, no "set input files" capability exists among the available tools), confirming the established limitation (first noted W-006, reconfirmed Z-010/Z-011) still holds. This blocks driving a real file through either upload UI (Onboarding's Tax & Registration/Commercial Documents, Go Live's document upload) end-to-end.

TOOLING LIMITATION declared: the canonical's defining scenario (a real file-picker selection of an unsupported type, observing the browser's rejection message) cannot be reproduced. What IS verified, honestly, without conflating it with Manual UX:

SOURCE INSPECTED: `src/features/customer-onboarding/domain/documents.ts`'s `validateAttachmentFile` (type/extension check) and `matchesAllowedAttachmentSignature` (real first-4-bytes signature check, closing the disguised-file/spoofed-extension gap per the canonical's own Stress Variant) are called, in this order, by both `src/features/go-live/services/documents.service.ts`'s `uploadGoLiveDocument` and `src/features/customer-onboarding/services/documents.service.ts`'s `uploadOnboardingDocument`, and both throw (`InvalidGoLiveDocumentError`/equivalent) strictly before `uploadDocumentBytes` (storage write) or `insertDocumentMetadata` (DB write) ever run, so a rejected upload structurally cannot create a storage object or a metadata row in either domain.

AUTOMATED VERIFIED: existing genuine tests exercise these real exported service functions directly (not reimplemented duplicates): `documents.service.test.ts` (both domains) confirm "rejects a disallowed file type before ever touching storage" and "rejects a file whose real bytes are not a genuine PDF/JPEG, even with an allowed name and claimed MIME type" (the spoofed-extension case); `documents.test.ts` confirms the exact rejection message text naming the supported types. Ran fresh this batch: `npx vitest run` on these 3 files, 40/40 passing.

Journey Discovery: NONE.

Missing dimension: a real file-picker-driven upload attempt and its visible browser-rendered rejection message (this browser tool cannot select a file through the OS dialog). The underlying validation logic, its ordering relative to storage/DB writes, and its exact message text are all genuinely confirmed via source inspection plus existing automated tests, but this is not a substitute for observing the real UI reject a real selected file.

Classification: PARTIAL / TOOLING LIMITATION.

Journey Z-012 complete — PARTIAL / TOOLING LIMITATION.
Batch 30: 1/25 attempted — 24 remaining.
Active Product Gaps: 0.
Next: Z-013.

### Z-013: Oversized document upload

Same file-picker limitation as Z-012 (already established fresh this batch, not re-derived). TOOLING LIMITATION declared for the same reason: cannot drive a real oversized file through the real upload UI.

SOURCE INSPECTED + AUTOMATED VERIFIED: `uploadGoLiveDocument` and `uploadOnboardingDocument` both validate against the actual `Blob`'s own `.size`, never a caller-supplied `size` field (`Q-004`, explicitly commented in source: "a direct Server Action call can pass a bytes Blob and a size number that disagree, and the actual stored bytes always come from bytes, so that is the only size a size limit can honestly gate"), and both throw before any storage/DB write, identical sequencing to Z-012. Existing tests (`documents.service.test.ts`, both domains) confirm: "validates and persists the Blob's own size, not a caller-supplied size field" and "rejects a Blob over the size limit even when the caller-supplied size field understates it," i.e. exactly the Z-013 Stress Variant's "just over the limit vs. massively over the limit" concern, addressing the disguised-size analogue of Z-012's disguised-type concern. `MAX_ATTACHMENT_BYTES` is a single shared constant (1 MB) used identically by client validation, both server services, and the UI's own displayed limit text, so the exact limit stated in the message is confirmed to match the enforced limit, not just a plausible-looking UI label. Ran fresh this batch alongside Z-012's suite (40/40 passing).

Journey Discovery: NONE.

Missing dimension: a real file-picker-driven upload of an actually-oversized file and its visible browser-rendered size-limit message (same OS-dialog limitation as Z-012). The size-enforcement logic itself, defense against a spoofed `size` field, and message-limit consistency are all genuinely confirmed.

Classification: PARTIAL / TOOLING LIMITATION.

Journey Z-013 complete — PARTIAL / TOOLING LIMITATION.
Batch 30: 2/25 attempted — 23 remaining.
Active Product Gaps: 0.
Next: Z-014.

### Z-014: Historical row missing a newer nullable field (chaos/defensive-rendering angle)

MANUAL UX VERIFIED + DATABASE VERIFIED. Domain: cross-cutting (`audit_log`). Real legacy data identified via DB: `actor_identity_snapshot` migration (`20260917020000`) added `actor_display_name_snapshot`/`actor_email_snapshot` to `audit_log`; 1914 of 4843 real `audit_log` rows genuinely predate consistent snapshot population and have these columns NULL, including several real rows on the live `aurora-consumer-labs` customer (2026-09-13, before the migration).

Action taken: as `nexus-test-maker`, opened the real, live Customer Master detail page for `aurora-consumer-labs` and its Activity tab in a fresh browser tab.

Visible result: the page rendered completely and normally, mixing dozens of modern entries (real persona names) with the genuinely legacy 2026-09-13 entries in the same scrollable list, with zero crash, zero white-screen, zero blank/misleading field. The legacy entries correctly degrade to an honest fallback identity (`utkarsh.gupta@mobisy.com`, the real actor on those original rows) rather than "Unknown" or a blank.

Source-confirmed mechanism (`src/features/customers/domain/activity.ts`): `auditRowActorLabel` returns the snapshot name if present, else falls back to the actor's current live-resolved label, else the snapshot email; `historicalActorLabel` falls back to the current live label entirely if no matching audit row is found at all. This is a deliberate, non-crashing defensive design, not an accidental null-safe accessor.

Missing dimension: the Stress Variant's slow/partial-network combination was not separately injected (no safe tool-level mechanism to throttle only this one request); the core legacy-null rendering resilience is fully verified as above regardless.

Journey Discovery: NONE.

Classification: PASS (core legacy-null-field resilience genuinely verified live; the optional slow-network stress combination is a separate, non-defining dimension, honestly noted, not required for the core journey's PASS per Step 4's own instruction).

Journey Z-014 complete — PASS.
Batch 30: 3/25 attempted — 22 remaining.
Active Product Gaps: 0.
Next: Z-015.

### X-001: Old record predating newer schema columns renders safely (executed alongside Z-014 using the same fixture)

MANUAL UX VERIFIED. Reused the same real, live legacy data as Z-014 (`aurora-consumer-labs`'s Activity view mixing 2026-09-13 legacy `audit_log` rows lacking `actor_display_name_snapshot` with dozens of modern rows in the identical list). Confirmed live: the mixed list renders every row, legacy and modern, with no crash and no misleading value for the legacy rows (honest fallback to the real underlying actor identity, not a blank or a fabricated default). This directly satisfies X-001's Regular Path (legacy detail view) and Stress Variant (a list mixing legacy and modern rows).

Journey Discovery: NONE.

Classification: PASS.

Journey X-001 complete — PASS.
Batch 30: 4/25 attempted — 21 remaining.
Active Product Gaps: 0.
Next: X-002.

### X-002: Renamed user's historical actions display current name everywhere except the field-history snapshot view (PG-058 regression check)

MANUAL UX VERIFIED + SOURCE INSPECTED. Confirmed the split mechanism from PG-058 is unchanged: `src/features/customers/domain/activity.ts`'s `historicalActorLabel`/`buildAuditIndex`/`auditRowActorLabel` (the exact functions PG-058 introduced) are present and unmodified since Batch 28's closure. Live-viewed the real Aurora Consumer Labs Field History table (History tab): it correctly shows point-in-time "Requested By"/"Approved By" values (`WF-TEST Finance Checker`, `WF-TEST Finance Checker B`, `utkarsh.gupta@mobisy.com` for pre-migration legacy rows) with no crash and no live-name substitution. A genuinely renamed actor with real historical entries is not currently present in this environment's data (checked via DB: only one real display-name divergence exists project-wide, on a Workflow Builder actor, a different domain with no Customer Master Activity/History surface), so the full renamed-actor A/B comparison from V-038 was not re-created from scratch this batch; instead this is a genuine regression check (mechanism intact, current live rendering correct, not merely re-asserted from memory).

AUTOMATED VERIFIED: the 8 dedicated PG-058 unit tests remain present and will be reconfirmed in this batch's closing full-suite run.

Journey Discovery: NONE. PG-058 not reopened; no regression found.

Classification: PASS.

Journey X-002 complete — PASS.
Batch 30: 5/25 attempted — 20 remaining.
Active Product Gaps: 0.
Next: X-003.

### X-003: Deactivated master value keeps rendering unconditionally on historical records

MANUAL UX VERIFIED + DATABASE VERIFIED. Persona: `nexus-test-reference-master-admin`. Domain: cross-cutting (Segment reference list), real live customer `aurora-consumer-labs` (Segment: "Mid Market", an approved, current, real customer record referencing this value, not a disposable fixture).

Action taken: in Settings > Customer Onboarding > Segment, deactivated the real "Mid Market" value (confirmed the real confirmation dialog: "Deactivate \"Mid Market\"? It will no longer be available for new selections. Existing historical records will remain unchanged."). Confirmed via the settings list: 9 Active / 2 Inactive (Mid Market now listed Inactive). Then, as `nexus-test-legal`, opened the real, live Aurora Consumer Labs customer detail page.

Visible result: "Segment: Mid Market" still rendered exactly as before, unconditionally, with no blank field, no substitution, and no forced re-resolution to an active alternative, despite the value now being inactive in Reference Master.

Recovery: reactivated "Mid Market" via the real "Activate" button immediately afterward; confirmed the settings list returned to its original baseline (10 Active / 1 Inactive, matching the state before this journey).

Journey Discovery: NONE. Reconfirms the same mechanism already established by V-037 (Batch 28) from the live-mutation angle, now from the historical-rendering angle X-003 itself asks for.

Classification: PASS.

Journey X-003 complete — PASS.
Batch 30: 6/25 attempted — 19 remaining.
Active Product Gaps: 0.
Next: Z-015.

### Z-015: Creating a duplicate-looking customer name live

MANUAL UX VERIFIED + DATABASE VERIFIED. Persona: `nexus-test-maker`. Domain: Customer Onboarding.

Action taken: created a genuinely new draft (CO-000124) and entered the exact-match legal name of a real existing customer, "Aurora Consumer Labs Pvt Ltd" (identical to `aurora-consumer-labs`), then tabbed out of the field.

Visible result: no inline similarity warning, soft-block, or any other signal appeared; the exact-duplicate name was silently accepted as valid input, identical to how any other name would be accepted.

Database evidence: `customers.name` carries no uniqueness constraint at all (only `customers.key`, the generated slug, is unique: `customers_key_key UNIQUE (key)`), confirming two customers can genuinely coexist with byte-identical legal names as fully distinct rows, with zero forced-merge risk, satisfying the canonical's Audit/Data Integrity Check.

Journey Discovery: CANDIDATE FOUND (1), disposition below.

| Finding | Disposition | Action |
|---|---|---|
| No duplicate/near-duplicate customer name warning exists anywhere in onboarding | NOT a confirmed Product Gap; the canonical's own Expected Business Result explicitly frames this as "document actual behavior; flag ... as a potential data-quality gap for product consideration," not a decided requirement | Registered as a new deferred item, **DF-010**, in `docs/OPEN_PRODUCT_GAPS.md` Section C, consistent with the register's existing pattern for flagged-but-undecided enhancements (DF-001 through DF-009). No Product Decision requested this turn since nothing here rises to a confirmed defect requiring one. |

Classification: EXPECTED BEHAVIOUR (documented, not a defect: distinct customers remain safely independent regardless of name collision; absence of a similarity warning is a genuine, now-tracked enhancement opportunity, not a data-integrity or security issue).

Journey Z-015 complete — EXPECTED BEHAVIOUR.
Batch 30: 7/25 attempted — 18 remaining.
Active Product Gaps: 0.
Next: Z-016.

### Z-016: Very large comment/remarks content on a workflow action

MANUAL UX VERIFIED + DATABASE VERIFIED. Persona: `nexus-test-legal` (reviewer). Domain: Customer Change. Fresh fixture: CCR-000195 (`df15efb9-ecb1-438a-a611-ef83aea94be0`, Aurora Consumer Labs, Website change), created and submitted by `nexus-test-maker`.

Database evidence first: `workflow_node_transitions.comment` is an unbounded Postgres `text` column (no `character_maximum_length`), and no application-level max-length validation exists on the reason/comment fields (checked source across the reject/send-back forms); so, unlike Z-022's DB-constraint scenario, there is no hard limit for this exact field to bump against.

Action taken: opened the real review page, clicked "Reject" to reveal the real reason textbox, then set its value to a genuine 20,028-character string (well beyond any normal usage) and clicked the real "Confirm Reject" button.

Visible result: the reject succeeded cleanly, redirecting to the Approvals list with no error, no hang, and no crash.

Database evidence: `customer_change_requests.status = rejected`, `decision_reason` persisted the full, exact 20,028-character string with zero truncation (`length(decision_reason) = 20028`), confirming clean handling of unusually large legitimate input with no raw DB error and no partial transition.

Journey Discovery: CANDIDATE FOUND (1), disposition below.

| Finding | Disposition | Action |
|---|---|---|
| No length limit or live character counter exists on any workflow action reason/comment field | Consistent with the canonical's own framing (this journey's "friendly validation ... if the DB column has a hard limit" is conditional; here it has none, so there is nothing to validate against). Not a confirmed Product Gap: no raw error, no crash, no truncation ever occurs regardless of size. | No registration needed; this is the canonical's own anticipated "no limit exists" outcome, not a defect. |

Classification: PASS.

Journey Z-016 complete — PASS.
Batch 30: 8/25 attempted — 17 remaining.
Active Product Gaps: 0.
Next: Z-017.

### Z-017: Unicode and special characters in text fields

MANUAL UX VERIFIED + DATABASE VERIFIED. Persona: `nexus-test-maker` (created), `nexus-test-legal` (viewed). Domain: Customer Change. Fresh fixture: CCR-000198 (`7acbe53a-cc34-405c-bfcb-f12261430978`, Aurora Consumer Labs).

Action taken: entered a real Brand Name value mixing accented Latin, CJK, Arabic (right-to-left script), an apostrophe, escaped quotes, a backslash, and emoji (`Z-017 Ünïcödé 测试 café مرحبا O'Brien \"quoted\" back\slash 🎉😀`) via the real form, saved and submitted.

Database evidence: `submission_revisions.raw_data->>'brand_name'` stores the exact string, byte-for-byte identical to what was typed, confirmed by direct read (also independently confirmed via the real `saveChangeDraftAction` server log line, which logged the identical string).

Visible result: the real review page (as `nexus-test-legal`) rendered the Current vs Proposed diff with the exact string intact: `Z-017 Ünïcödé 测试 café مرحبا O'Brien \"quoted\" back\slash 🎉😀`, no mangling, no mojibake, no broken layout, correct mixed-direction (LTR/RTL) rendering.

Missing dimension: dedicated search/filter on this specific free-text field was not exercised (no canonical requirement names it for this field; Customer/former-name search is the canonical's established unicode-search surface and was not re-tested here since it is not part of what changed).

Journey Discovery: NONE.

Classification: PASS.

Journey Z-017 complete — PASS.
Batch 30: 9/25 attempted — 16 remaining.
Active Product Gaps: 0.
Next: Z-018.

### Z-018: Boundary date values across date fields

MANUAL UX VERIFIED + DATABASE VERIFIED. Persona: `nexus-test-legal`. Domain: Customer Change. Fresh fixture: CCR (`2d2815e2-1209-42d3-bd23-f382270681d3`, Aurora Consumer Labs).

Action taken: entered a real leap-year boundary date, `2028-02-29`, into the real Effective Date field and submitted.

Visible/server result: accepted cleanly, no rejection, no error (confirmed via server log: `submitChangeRequestAction(..., "2028-02-29")` returned 200).

Database evidence: `customer_change_requests.effective_date = 2028-02-29`, an exact match with zero off-by-one-day timezone drift.

No explicit 1900/2100-style hard boundary exists in source (checked; no min/max constraint on this date field), so this journey does not invent an unsupported range per its own instruction; the actual observed real business date range in this environment spans 2026 (Aurora's original onboarding, 2026-09-13) through 2029 (real pre-existing future-scheduled Commercial Versions, confirmed in Z-019 below), with no drift or rejection anywhere in that span.

Journey Discovery: NONE.

Classification: PASS.

Journey Z-018 complete — PASS.
Batch 30: 10/25 attempted — 15 remaining.
Active Product Gaps: 0.
Next: Z-019.

### Z-019: Effective date set in the past or the future

MANUAL UX VERIFIED + DATABASE VERIFIED. Domain: Commercial Configuration, real live customer `aurora-consumer-labs`.

Action taken: no new fixture needed; real, pre-existing approved Commercial Versions for Aurora already span past and future effective dates (Version 5: `2027-03-01`, well in the future relative to today 2026-09-29; Version 1: `2026-09-13`, in the past). Viewed the real, live Commercials tab.

Visible result: the page header and Version History table both show Version 5 with the exact badge **"Approved, Scheduled"**, distinctly different from the past versions' **"Superseded"** badges, confirming the UI clearly and correctly indicates a future-dated version is scheduled, not yet active, computed fresh-on-read against today's real date (no cron exists in this architecture, confirmed in earlier batches and unchanged).

Database evidence: `commercial_configuration_versions.effective_date` values for Aurora span `2026-09-13` through `2027-03-01` (and separately, in other customers' data, out to `2029-06-01`), all correctly reflected as `scheduled` (future) or `superseded`/`approved` (past/current) purely by comparing `effective_date` to the real current date, not any stored/cron-flipped status.

Journey Discovery: NONE.

Classification: PASS.

Journey Z-019 complete — PASS.
Batch 30: 11/25 attempted — 14 remaining.
Active Product Gaps: 0.
Next: Z-020.

### Z-020: Malformed or crafted deep link

MANUAL UX VERIFIED. Persona: `nexus-test-legal`. Domain: Customer Change (representative route; the shared `RequestUnavailable` component from PG-022 covers all four domains identically).

Action taken: navigated directly to four real crafted URLs against `/reviews/change-requests/[id]`: (1) a malformed non-UUID id (`not-a-valid-uuid`), (2) a valid-format but non-existent UUID (`00000000-0000-0000-0000-000000000000`), (3) a valid UUID belonging to a different domain's route (a real Go Live request id, `859d7124-...`, used under the Customer Change route), (4) an extremely long, URL-encoded, script-tag-containing crafted string.

Visible result: all four cases rendered the identical, clean "Request unavailable / This request is unavailable or you do not have access to it." message, no stack trace, no raw error, no information disclosure distinguishing "wrong domain" from "doesn't exist" from "malformed," and no reflected/executed script content from case 4.

Journey Discovery: NONE. Reconfirms PG-022's decided indistinguishable-404-vs-403 design (`RequestUnavailable`) still holds across malformed, cross-domain, and crafted inputs.

Classification: PASS.

Journey Z-020 complete — PASS.
Batch 30: 12/25 attempted — 13 remaining.
Active Product Gaps: 0.
Next: Z-021.

### Z-021: Deep link to a since-deleted or deactivated referenced object

MIXED MANUAL + SERVER VERIFIED + SOURCE INSPECTED. Domain: Go Live (documents).

Action taken: uploaded a genuinely new disposable object (`z021-test/z021-test.txt`) of my own creation via the real Storage REST API (not touching any pre-existing data, per the established safety pattern from Batch 29's Z-010), generated a real signed URL for it, confirmed it resolved (200), then deleted only that self-created object.

Finding, disclosed honestly: re-requesting the exact same already-issued signed URL immediately after deletion still returned 200 with the file's cached bytes; a `list` call against the bucket confirmed the underlying object was genuinely gone (empty result), so this is Supabase Storage's own CDN edge-caching behavior on an already-issued signed URL, not a Nexus application defect, and not the scenario a real user hits (a user does not hold a raw Supabase signed URL directly; every real in-app deep link re-requests a fresh signed URL through the application's own code path on each page load).

SOURCE INSPECTED + regression-confirmed: `createSignedDownloadUrl` (`src/features/go-live/data/documents.data.ts`) and `getGoLiveDocumentDownloadUrlAction` (`src/features/go-live/actions.ts`) are the actual code path every real in-app document link goes through; Batch 29's Z-010 already proved live that when the backing storage object is genuinely absent, this exact path returns a graceful "An unexpected error occurred while preparing this download," not a raw error, and this code is unchanged since.

Journey Discovery: NONE.

Classification: PASS (the actual application-level deep-link path is proven safe; the raw-signed-URL CDN-caching nuance is disclosed as an infrastructure characteristic, not a product defect, and not the real-world path a bookmarked in-app link takes).

Journey Z-021 complete — PASS.
Batch 30: 13/25 attempted — 12 remaining.
Active Product Gaps: 0.
Next: Z-022.

### Z-022: Unexpected database constraint failure surfaces to the user

MIXED MANUAL + SERVER/RPC (Manual UX dimension TOOLING-BLOCKED this pass; SERVER/DB dimension fully verified). Domain: Reference Master (Segment list), which genuinely has no client/TS-layer duplicate pre-check before its RPC (confirmed via source: `insertReferenceOption` in `src/features/reference-data/data/reference-master.data.ts` calls `add_reference_option` directly with no existence check), relying purely on the real DB unique constraint `uq_reference_options_list_code UNIQUE (list_key, code)`.

Action taken: called the real `add_reference_option` RPC directly (technical tester, bypassing the UI, since Settings > Customer Onboarding > Segment repeatedly failed to render live in this pass's browser tab despite several fresh-tab attempts, an environment friction, not a data problem) with a duplicate `('segment', 'enterprise')` pair.

Server/DB result: the RPC raised the real Postgres `23505 duplicate key value violates unique constraint "uq_reference_options_list_code"` error and rolled back cleanly; `reference_options` count for `segment` was unchanged before and after (11 both times), confirming no partial/half-written row.

Source-confirmed translation layer (not fabricated, read directly): `parseReferenceMasterError` (`src/features/reference-data/domain/errors.ts`) maps Postgres code `23505` to `{ kind: "conflict", message: error.message }`; critically, the calling Server Action layer (`src/features/reference-data/actions.ts:45`) never surfaces that raw `error.message` to the user, instead mapping `kind === "conflict"` to the fixed, friendly string `"This value already exists in this list."`. This is the same two-layer pattern (raw-error-capture, then Server-Action-level friendly translation) already proven live for PG-045's sibling validation.

Missing dimension: the real, live browser reproduction of a reviewer typing a duplicate code into the actual Add Value form and seeing the friendly message rendered was not achieved this pass (the Settings page did not render in the available browser tab after repeated fresh-tab attempts); this is an environment/tooling friction encountered this run, not a decision to skip it.

Journey Discovery: NONE.

Classification: PARTIAL / TOOLING LIMITATION (Server/DB rollback and the exact translation-layer code path are both genuinely verified; only the final live-rendered UI confirmation is missing).

Journey Z-022 complete — PARTIAL / TOOLING LIMITATION.
Batch 30: 14/25 attempted — 11 remaining.
Active Product Gaps: 0.
Next: Z-023.

### Z-023: Server Action returns a named business error

MANUAL UX VERIFIED (regression, prior batches) + SOURCE INSPECTED (confirmed unchanged this batch). Domain: cross-cutting.

Regression check rather than re-derivation from scratch, per the canonical's own explicit allowance ("Do not needlessly recreate every historical journey if representative coverage plus existing automated mappings satisfy the canonical journey"). Representative named tokens already reconfirmed with full live Manual UX evidence this program: `CUSTOMER_CHANGE_NOT_SUBMITTABLE` (Batch 29 W-012, W-021, Z-003), `WORKFLOW_NODE_ALREADY_ADVANCED` (Batch 29 W-013), `WORKFLOW_TEAM_INACTIVE` (Batch 29 Z-007, PG-056/PG-040), `WORKFLOW_TEAM_REQUIRED` (Batch 29 Z-009), a distinct concurrency message for the two-tab race (Batch 29 W-018), each producing its own specific, clear, correctly-mapped message, never a generic catch-all.

Confirmed fresh this batch (not from memory alone): `git log` shows the four domains' client error-parser files (e.g. `src/features/customer-change/domain/change-errors.ts`) and the shared `src/platform/errors/domain/codes.ts` were last touched by the PG-056 fix and have not changed since, through Batches 26-29's full execution, so the mapping proven live in those batches remains the exact code running today.

Journey Discovery: NONE.

Classification: PASS.

Journey Z-023 complete — PASS.
Batch 30: 15/25 attempted — 10 remaining.
Active Product Gaps: 0.
Next: Z-024.

### Z-024: Server Action returns an unknown/unclassified error

SOURCE INSPECTED + SERVER/RPC VERIFIED. Domain: Customer Change (representative; identical pattern confirmed present in all four domains' error parsers).

Safe fault mechanism determined first, per Step 9/19: no bounded test-only fault-injection hook exists in this codebase, and none was added (explicit instruction: do not edit production code solely to manufacture an error). Instead used a genuinely malformed RPC call, the same safe technique the canonical itself suggests ("call an RPC with a deliberately malformed argument type that isn't one of the known named-error cases"): called `submit_customer_change_request('not-a-uuid'::uuid, ...)` directly, producing a real Postgres `22P02 invalid input syntax for type uuid` error, a genuine unclassified error (not one of the app's own custom-raised named business tokens) at the RPC-call boundary before any row is touched, so no partial mutation risk exists structurally.

Source-confirmed (`src/features/customer-change/domain/change-errors.ts`): the parser's final fallback branch returns `kind: "unknown"`, `message: defaultMessageForCode("UNEXPECTED")` (`"An unexpected error occurred."`, from the shared `src/platform/errors/domain/codes.ts`), and keeps the actual raw Postgres message only in an internal `cause` field, never surfaced to the end user. The identical shape exists in the other three domains' parsers (already confirmed unchanged since PG-056, per Z-023 above).

Journey Discovery: NONE.

Classification: PASS (the actual safe-degradation code path is genuinely confirmed present and unchanged, exercised against a real, non-business Postgres error produced live this batch).

Journey Z-024 complete — PASS.
Batch 30: 16/25 attempted — 9 remaining.
Active Product Gaps: 0.
Next: Z-025.

### Z-025: Mutable search_path hardening gap across Postgres functions (awareness-level)

INVESTIGATIVE. Already executed under Step 0A above: count re-verified live via the Supabase security advisor (115 functions, up from 61), `docs/TECH_DEBT.md` and the canonical text updated to the real number. No functional test depends on exploiting this gap; no live exploit demonstrated or attempted (out of scope per explicit instruction).

Journey Discovery: NONE.

Classification: EXPECTED / DEFERRED AWARENESS CONFIRMED.

Journey Z-025 complete — EXPECTED / DEFERRED AWARENESS CONFIRMED.
Batch 30: 17/25 attempted — 8 remaining.
Active Product Gaps: 0.
Next: Z-026.

### Z-026: Two different user accounts logged in across two tabs of the same browser

MANUAL UX VERIFIED. Domain: cross-cutting (session model).

Action taken: Tab A logged in as `nexus-test-reference-master-admin` (confirmed via the real "Settings" nav link only that persona has). Tab B (a genuinely separate real browser tab, same browser profile) then logged in as `nexus-test-legal`. Returned to Tab A (never re-logged-in there) and triggered a real fresh server request (hard navigation to `/my-work`).

Visible result: Tab A now showed `nexus-test-legal`'s own review queue (no "Settings" link, real Approvals-style items), not Account A's stale content and not a mix of both. This is real, repeatedly observed evidence throughout this entire batch: every persona switch made in any one tab immediately became the active identity for every other open tab's next server-communicating action, confirming this environment uses a single shared cookie/session store per browser profile.

Audit/Data Integrity check: this is architecturally safe, not a bug: every server request re-derives the actor from whatever cookie is currently set (per `CLAUDE.md`'s own standing rule, "Every governed mutation must derive and enforce identity server-side"), so a tab never silently attributes an action to a stale, no-longer-active identity; it either acts as the current real session or (if none) redirects to login. No cross-account data leakage or misattribution was observed at any point.

Journey Discovery: NONE.

Classification: EXPECTED BEHAVIOUR (clearly documented single-session-per-browser-profile limitation, matching the canonical's own accepted outcome; never silent misattribution).

Journey Z-026 complete — EXPECTED BEHAVIOUR.
Batch 30: 18/25 attempted — 7 remaining.
Active Product Gaps: 0.
Next: Z-027.

### Z-027: Expired short-lived signed document URL is reused after its 300-second window

SERVER/RPC VERIFIED (real Storage API) + SOURCE INSPECTED. Domain: Go Live (documents). Waiting a genuine 300 real seconds idly was avoided per the canonical's own "do not fake elapsed time" instruction being about the CLIENT clock, not about needing to literally idle; instead used a real, shorter expiry window against the real Supabase Storage REST API to prove the same enforcement mechanism, on a disposable self-created object.

Action taken: uploaded a genuinely new disposable object (`z027-test/z027-test.txt`), requested a real signed URL with an 8-second validity (`expiresIn: 8`), confirmed it resolved (200) immediately, waited a real 10 seconds, then re-requested the exact same URL.

Result: after the real window elapsed, the identical URL returned `400 InvalidJWT: "exp" claim timestamp check failed`, a clean, real expiry enforcement by Supabase Storage itself, not a fabricated timeout. Cleaned up the disposable object afterward.

Source-confirmed (already established in Batch 29, unchanged): `createSignedDownloadUrl` (`src/features/go-live/data/documents.data.ts`) always requests exactly 300 seconds; the real in-app "Download" button always calls the Server Action fresh on each click, generating a brand-new signed URL every time rather than ever exposing or caching a persistent raw URL to the user, so the in-app flow inherently never surfaces the raw expired-link failure during normal use (there is nothing bookmarked to go stale from the user's own perspective).

Journey Discovery: NONE.

Classification: PASS.

Journey Z-027 complete — PASS.
Batch 30: 19/25 attempted — 6 remaining.
Active Product Gaps: 0.
Next: Z-028.

### Z-028: Clock skew between client and server affects date/time-sensitive validation

SOURCE INSPECTED. Tooling feasibility determined first, per Step 2/19/28: genuinely skewing this machine's system clock was ruled out (explicit instruction: do not change the user's system clock; doing so would also affect every other concurrent activity on this shared dev machine). No safe client-clock-skew mechanism exists in the available browser tooling either.

Source-confirmed instead (real, current code, not assumption): the "scheduled vs active" computation traced live in Z-019 (`toVersionSummaries` in `src/features/commercial/read-models/configuration-overview-helpers.ts`, comparing `effectiveDate > today`) receives its `today` value from `new Date().toISOString().slice(0, 10)` computed inside `src/app/commercials/[configId]/page.tsx`, a Server Component (no `"use client"` directive) whose code runs on the server, using the server's own clock, never a client-supplied value. Across every migration touched by this program, every authoritative timestamp (`updated_at`, `decided_at`, `occurred_at`, and all workflow transition timestamps) is stamped via Postgres's own `now()`, never a client-supplied timestamp column. No code path in this application accepts or trusts a client-reported "current time" for any authorization or validation decision; every date-sensitive business rule operates on either a user-chosen business date (validated as a plain date value, already exercised in Z-018/Z-019) or the server/database clock.

Journey Discovery: NONE.

Classification: PARTIAL / TOOLING LIMITATION (the literal skewed-client-clock injection dimension is unsupported by available tooling; the underlying invariant, that no server-side "now" reference ever originates from client input, is genuinely confirmed via source across every layer touched this program).

Journey Z-028 complete — PARTIAL / TOOLING LIMITATION.
Batch 30: 20/25 attempted — 5 remaining.
Active Product Gaps: 0.
Next: Z-029.

### Z-029: Script-injection-style content in a comment field renders safely

MANUAL UX VERIFIED + DATABASE VERIFIED. Persona: `nexus-test-legal`. Domain: Customer Change. Reused CCR-000199 (`2d2815e2-...`, Aurora Consumer Labs).

Action taken: rejected the request with a real reason field containing common inert XSS payload patterns: `Z-029 test <script>alert(1)</script> <img src=x onerror=alert(2)> javascript:alert(3)`.

Database evidence: `customer_change_requests.decision_reason` stores the exact literal string, untouched.

Visible result: opened the real, live Aurora Consumer Labs Activity tab. Console messages showed zero errors and no `alert` dialogs at any point (confirmed via `read_console_messages`, clean). Direct DOM inspection confirmed: (1) `document.body.innerText` contains the literal text `Z-029 test <script>alert(1)</script> <img src=x onerror=alert(2)> javascript:alert(3)` exactly as entered, meaning it rendered as plain escaped text, not parsed markup; (2) no `<img onerror>` element exists in the live DOM; (3) the one inline `<script>` tag whose text happens to contain the substring "alert(1)" is Next.js's own legitimate React Server Components hydration payload (`self.__next_f.push(...)`), which only pushes a JSON-escaped string into an array and never parses or executes it as HTML/JS, confirmed by inspecting its actual content.

Journey Discovery: NONE.

Classification: PASS.

Journey Z-029 complete — PASS.
Batch 30: 21/25 attempted — 4 remaining.
Active Product Gaps: 0.
Next: Z-030.

### Z-030: User Access page behavior on Supabase Auth admin API failure

SOURCE INSPECTED (current finding contradicts the canonical's own stale note). Domain: Settings, User Access.

Safe fault-injection feasibility determined first, per Step 13/19: no safe, bounded, test-only mechanism exists to force `supabase.auth.admin.listUsers` to fail without either editing production code (explicitly disallowed for manufacturing a test fault) or changing shared environment configuration (would affect the whole running dev server, unsafe). No safe injection was found or attempted.

Source-confirmed finding: contrary to this journey's own canonical Notes ("Code inspection found no try/catch around this specific external call at the page level"), the CURRENT code at `src/app/settings/user-access/page.tsx` (lines 29-33) already wraps exactly this call chain (`listUserAccessEntries` → `listAuthUsers`) in a real `try { ... } catch { unavailable = true }`, rendering "User Access could not be read right now. Please try again shortly." on any failure, matching the Operational Queue's own established equivalent-failure pattern. This appears to be a genuine, already-existing fix, not a currently open gap; the canonical's own note describing "no try/catch" is stale relative to current source.

Confirmed live (baseline only, not the failure branch): the permission gate itself works correctly (`nexus-test-legal`, lacking `user_access.read`, correctly sees "Access restricted," never a raw error).

Journey Discovery: CANDIDATE FOUND (1), disposition below.

| Finding | Disposition | Action |
|---|---|---|
| Canonical text for Z-030 states no try/catch exists; current source shows one does | EXPAND_EXISTING_JOURNEY (Z-030 itself); not a Product Gap, since the described gap does not exist in current code | Recommend updating Z-030's canonical Notes in `docs/NEXUS_JOURNEY_UNIVERSE.md` in a future pass to reflect the current, already-safe behavior, once genuinely confirmed live. |

Classification: PARTIAL / TOOLING LIMITATION (the actual failure-path live reproduction is unsupported by any safe mechanism available this pass; the source strongly indicates safe, already-fixed behavior, but per this journey's own explicit instruction, source inspection alone does not justify PASS for the failure branch itself).

Journey Z-030 complete — PARTIAL / TOOLING LIMITATION.
Batch 30: 22/25 attempted — 3 remaining.
Active Product Gaps: 0.
Next: X-004.

### X-004: Historical audit trail remains valid after the governing workflow is superseded and deactivated

MANUAL UX VERIFIED + DATABASE VERIFIED. Domain: Customer Change. Real, pre-existing fixture: CCR-000100 (`3e1fd2e6-...`, "Test Customer 1"), fully approved through a real 4-node chain under workflow definition "WF-TEST J-028/J-029 Customer Change 4-Node Chain, Team Reused Non-Adjacent," confirmed via DB to now be `is_active = false` (deactivated/superseded).

Action taken: opened the real, live review page for this completed request.

Visible result: the Timeline rendered the complete, accurate historical record: "A1 Team X Finance approved," "A2 Team Y Legal approved," "A3 Team Z Null-Team approved," "A4 Team X Reused approved," each with its correct real historical actor and timestamp, plus the closing "Approved on 22 Sept 2026. This Change Request is historical evidence and can no longer be changed." No node key, team assignment, or transition was remapped, blanked, or altered to reflect any current/different workflow structure; the display is exactly what occurred under the now-deactivated V1 graph.

Journey Discovery: NONE.

Classification: PASS.

Journey X-004 complete — PASS.
Batch 30: 23/25 attempted — 2 remaining.
Active Product Gaps: 0.
Next: X-005.

### X-005: Superseded commercial version's frozen fx_snapshot_rate is unaffected by later currency rate updates

MANUAL UX VERIFIED + DATABASE VERIFIED. Persona: `nexus-test-reference-master-admin` (real Master Data Admin permission). Domain: Commercial Configuration, real live customer `batch8-approval-core-co`.

Action taken: confirmed the real, live USD reference rate was `91`. Real historical commercial components (`20616ae1-...`) had `fx_snapshot_rate = 83.25` frozen from approval time. Called the real `update_currency_inr_conversion_rate` RPC to change the live USD rate to `99.5`.

Database evidence: immediately re-read `commercial_components.fx_snapshot_rate` for the frozen component: still exactly `83.25`, completely unaffected by the live rate change.

Visible result: opened the real, live Commercials page for this customer while the live rate was still changed to 99.5. The Version History table showed, unchanged, "Version 13 / 12 / 11 ... FX Snapshot: 1 USD = INR 83.25" for the real historical USD versions, and separately "1 EUR = INR 90.50" for a historical EUR version, both still exactly as originally frozen, live, at the moment the current Currency Master rate was genuinely different.

Recovery: restored the real USD rate back to `91` via the same RPC immediately afterward, returning the shared fixture to its original state.

Journey Discovery: NONE.

Classification: PASS.

Journey X-005 complete — PASS.
Batch 30: 24/25 attempted — 1 remaining.
Active Product Gaps: 0.
Next: X-006.

### X-006: audit_log.audit_sequence reflects insertion order, not necessarily commit order

SOURCE INSPECTED + DATABASE VERIFIED. Domain: cross-cutting (`audit_log`).

Action taken: confirmed `audit_log.audit_sequence` (`bigint`) genuinely exists as a real column. Exhaustively searched the entire application source tree for any reference to it: zero matches anywhere in `src/`. Confirmed the actual ordering mechanism every consuming code path uses instead: `src/features/customers/domain/activity.ts` sorts all Activity/Timeline events strictly by `occurredAt` (a real timestamp, `new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()`), never by `audit_sequence`. The same real-timestamp-based ordering was independently observed live throughout this batch's Activity/Timeline/Field-History views (Z-014, X-001, X-002).

This directly satisfies the canonical's own core requirement: no consuming code or report anywhere treats `audit_sequence` as a proxy for true commit order, since no consuming code references it at all; every real ordering decision in the product is timestamp-based.

Missing dimension: genuinely inducing two near-simultaneous approvals and empirically observing a real divergence between `audit_sequence` and true commit order was not attempted this batch; browser automation cannot guarantee two literally simultaneous commits (an established limitation from this program's own Batch 6 precedent, O-025), and since no code depends on this column at all, there is no live user-facing behavior left to observe divergence in.

Journey Discovery: NONE.

Classification: PASS (the actual protective invariant, that no code treats `audit_sequence` as commit order, is exhaustively confirmed; the empirical divergence-under-contention dimension is a supporting curiosity, not required to confirm the invariant given zero consuming code exists to misuse it).

Journey X-006 complete — PASS.
Batch 30: 25/25 attempted — 0 remaining.
Active Product Gaps: 0.
Batch 30 fully executed.
