# Current Run Status

Live, human-readable operational dashboard, generated from `RUN_STATE.json` by `npm run journey:status`. Do not hand-edit this file. The batch ledger (`BATCH_30_RESULTS.md`) remains the authoritative evidence record; if this dashboard and the ledger ever disagree, the ledger wins and this file must be regenerated.

## Current run

- **Current Batch:** 30 (Fresh execution: Batch 30 (Z-012 through Z-030, X-001 through X-006) - CLOSED)
- **Batch status:** COMPLETE
- **Scheduled journey count:** 25
- **Completed journey count:** 25
- **Remaining journey count:** 0
- **Percentage complete:** 100%
- **Current journey ID:** None
- **Current journey execution state:** COMPLETE

> Batch 30 — COMPLETE — 25 / 25 reconciled

## Continuous run (Batches 24-25-26-27-28-29-30)

> Overall: 177 / 235 complete — 58 remaining.

## Classification counts

- **PASS:** 17
- **FAILED THEN FIXED + PASS:** 0
- **PRODUCT GAP RESOLVED + PASS:** 0
- **PRODUCT GAP CONFIRMED:** 0
- **EXPECTED BEHAVIOUR:** 3
- **PARTIAL:** 5
- **BLOCKED:** 0
- **EXTERNAL BLOCKER:** 0
- **PRODUCT DECISION REQUIRED:** 0
- **TOTAL:** 25

## Current activity

- **Last journey completed:** X-006
- **Journey currently executing:** None
- **Next 3 journeys:** None

## Findings

- **Defects found:** 0
- **Defects fixed:** 0
- **Open defects:** 0
- **Product Decisions found:** 0
- **Journey Discovery:**
  - ALREADY COVERED: 0
  - EXPAND EXISTING JOURNEY: 1
  - NEW JOURNEY REQUIRED: 0
  - REGRESSION TEST ONLY: 0
  - FUTURE MODULE: 0
  - PRODUCT DECISION REQUIRED: 0

## Environment

- **Current branch:** team-preview
- **Current HEAD:** 5d7c26b
- **Working tree:** dirty
- **Latest test checkpoint:** Batch 30 CLOSED 2026-09-29: all 25 scheduled journeys (Z-012 through Z-030, X-001 through X-006) genuinely executed. Tally: 17 PASS, 5 PARTIAL / TOOLING LIMITATION (Z-012, Z-013, Z-022, Z-028, Z-030), 3 EXPECTED BEHAVIOUR (Z-015, Z-025, Z-026), 0 PRODUCT_GAP_CONFIRMED, 0 PRODUCT_GAP_RESOLVED. No Product Gap found this batch; DF-010 registered (no duplicate-customer-name warning, a documented enhancement opportunity, not a confirmed defect) in docs/OPEN_PRODUCT_GAPS.md Section C. Z-012/Z-013 (document upload validation): real OS file-picker interaction confirmed unsupported by this browser tool; validation logic and no-early-write sequencing confirmed via source + existing automated tests. Z-014/X-001 (legacy-null rendering): genuine pre-actor-identity-snapshot-migration audit_log rows on the real aurora-consumer-labs customer rendered safely with honest fallback. X-002 (PG-058 regression): mechanism confirmed unchanged and rendering correctly. X-003 (deactivated master value, historical): real live toggle of the Mid Market segment value, customer detail page unaffected, fully restored. Z-015: real exact-duplicate customer name silently accepted, no warning exists (DF-010). Z-016 (huge comment): real 20,028-character reject reason persisted and processed cleanly, no DB limit exists. Z-017 (Unicode): real mixed-script/emoji/quote content round-tripped exactly and rendered correctly. Z-018/Z-019 (boundary/future dates): real 2028-02-29 leap-day effective date accepted exactly; real pre-existing 2027+ Commercial Versions correctly show 'Approved, Scheduled' fresh-on-read. Z-020/Z-021 (deep links): malformed/nonexistent/cross-domain/crafted ids all handled by the shared RequestUnavailable component; a genuinely deleted disposable Storage object confirmed via the real app code path (Batch 29 Z-010 mechanism, unchanged). Z-022 (DB constraint): real 23505 unique-violation triggered via direct RPC on Reference Master, clean rollback confirmed, friendly-message translation layer confirmed via source; live UI reproduction blocked by an environment rendering issue this pass. Z-023 (named errors): regression-confirmed via git history showing the four domains' error parsers unchanged since PG-056. Z-024 (unknown error): real 22P02 Postgres error triggered via a malformed RPC call, safe-degradation fallback confirmed via source. Z-025: search_path count corrected from 61 to 115 (live-verified via Supabase advisor), docs updated. Z-026 (two accounts, two tabs): live-confirmed single-shared-cookie session model, no misattribution. Z-027 (signed URL expiry): real 8-second signed URL against a disposable object, confirmed expiry enforcement. Z-028 (clock skew): client-side skew injection unsupported; server-authoritative time usage confirmed via source across every layer. Z-029 (XSS): real script/img/javascript: payload rejected a real Reject reason, rendered as literal escaped text, zero execution confirmed via console + DOM inspection. Z-030 (Auth admin API failure): source shows a try/catch already exists (contradicts the canonical's stale note describing none); live failure injection unsupported. X-004: real completed 4-node approval chain under a now-deactivated workflow definition renders its exact historical Timeline unchanged. X-005: real USD currency rate changed live from 91 to 99.5 and restored; historical fx_snapshot_rate (83.25) on real approved Commercial Versions confirmed completely unaffected throughout. X-006: audit_sequence confirmed to have zero consuming code references anywhere in the app; all real ordering is timestamp-based. tsc --noEmit exits 0. Full suite unchanged from Batch 29 (no implementation changes made this batch).
- **Blocking environment issue:** None

## Timestamp

- **Last status update:** 2026-09-29 12:20:19 UTC
