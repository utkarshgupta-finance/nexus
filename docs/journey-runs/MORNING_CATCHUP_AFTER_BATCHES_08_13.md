# Nexus Morning Catch-Up — After Overnight Batches 8-13

Closes out the three categories of follow-up left by the overnight autonomous run (Batches 8-13): one real defect fix that was prepared but intentionally left unapplied pending explicit authorization, two deferred journeys (B-007, C-027), and six product-policy decisions requiring Utkarsh's input rather than a guessed implementation. **Batch 14 was not executed as part of this task.**

---

## 1. BASELINE

Re-verified live at the start of this task, not assumed from the overnight report:

- Working tree: clean.
- Local `HEAD`: `b0b975fb51ae5cc4a12e5afb7806452d5281ffc2` (matched the overnight run's own final commit exactly, confirming no drift since it closed).
- `origin/team-preview`: matched local `HEAD`.
- Vercel Preview deployment for that commit: `READY`.
- Stable Git-branch alias (`nexus-git-team-preview-utkarshgupta-finance.vercel.app`): matched, `READY`.
- `origin/main` (Production): untouched at `04aba7a77e3bb13888ad83e17faac471facb1206`, same as the overnight baseline.
- Migration state (`supabase migration list --linked`): all migrations in sync between local and remote except one, `20260930080000` (the parked B-017 fix), which showed an empty `remote` value, exactly as expected.
- Test count: 927 tests passing across 102 files.
- Governed RPC grant guard: PASS, 0 exposed backend-only mutation RPCs.

---

## 2. PARKED MIGRATION

- **Migration:** `supabase/migrations/20260930080000_fix_customer_lifecycle_guard_governed_field_write_protection.sql`
- **Status: RESOLVED.**
- **Review performed before applying:** read the full migration; byte-diffed both re-created RPC bodies (`approve_customer_change_request`, `set_customer_active`) against their currently-live definitions, confirming each differs by exactly one added `perform set_config('app.permit_customer_field_write', 'true', true);` line (plus comments) and nothing else; exhaustively grepped every migration for any `update customers` statement, confirming only these same two functions have ever written to `customers` via UPDATE across the entire migration history; diffed the migration's protected-field list against the live `governed-field-registry.ts`, confirming an exact match (25 fields) plus `is_active`; cross-checked the invariant against `docs/CUSTOMER_LIFECYCLE.md` §3, which explicitly states the trigger "was extended to allow these... columns to change, but ONLY through `approve_customer_change_request`: nothing else in the application ever writes to `customers` directly" — confirming the fix restores consistency with an already-documented invariant, not a new policy decision.
- **Applied:** via `npx supabase db push --linked`, with Utkarsh's explicit real-time authorization (sought a second time after the CLI's own first response was ambiguous, rather than assuming success).
- **Result:** `npx supabase migration list --linked` confirms `20260930080000` now shows `remote` matching `local`; all 84 migrations in sync.
- **Live verification (against a disposable test customer):**
  - A direct governed-field UPDATE is now rejected.
  - A direct `is_active` UPDATE is now rejected.
  - A direct DELETE remains rejected (unchanged from before the fix).
  - A direct UPDATE to a non-governed system column (`updated_by`) remains allowed (correctly unaffected — confirms the fix is scoped precisely to the governed set, not broader).
  - `approve_customer_change_request`'s full 3-node approval chain (Finance -> Legal -> Leadership) still correctly updates `name`/`website`, increments `row_version`, and writes accurate `customer_field_history` rows.
  - `set_customer_active` still correctly deactivates, reactivates, and idempotently no-ops on a redundant reactivate (`row_version`/`updated_at` unchanged).
  - Full vitest suite (927 tests, 102 files) re-run and confirmed green after the migration.
  - A separate, fresh onboarding case was created, submitted, and approved end to end, confirming the trigger's INSERT branch (untouched by this fix, unconditional by design) still correctly creates a new Customer Master row and its atomic Commercial Configuration.

---

## 3. B-017

- **Original overnight status:** FAILED, then PRODUCT GAP CONFIRMED (fix designed and staged, application parked pending explicit user go-ahead).
- **Morning rerun:** see Section 2 above for the full verification record.
- **Final status:** **FAILED THEN FIXED + PASS.**

---

## 4. B-007

- **Overnight reason for deferral:** explicitly depends on C-017/C-033 (a completed, approved Customer Change that renamed a customer, with a multi-rename history), neither of which had run yet at the point in Batch 8 where B-007 was scheduled. Correctly deferred per its own documented dependency chain, not treated as a Batch 8 failure.
- **Morning execution:** dependency confirmed satisfied (the shared fixture customer was renamed twice across Batches 10-12 via real approved Customer Change requests). Read the real production implementation end to end (`findCustomersByFormerName`, `searchFormerCustomerNames`, `searchFieldHistoryByOldValue`, and the merge/rendering logic in the Customers page), then replicated the exact same query live: searching for the customer's original name correctly finds it via a former-name match; searching for its intermediate name also correctly finds it (the stress variant: match ANY prior name); searching for its current name correctly returns zero former-name matches (never conflated with a live match). Confirmed the UI genuinely merges former-name matches into the same results table as live matches, each clearly labeled "Former legal name: X" / "Former brand: X", and a former-name match is only shown if the customer isn't already present as a live match.
- **One precise minor finding, not escalated to a defect:** when a customer's historical names share overlapping substrings, the displayed label shows the most-recently-changed matching historical value, not necessarily the one that most specifically matches the search term. The customer is always found correctly; only the specific label shown can occasionally be a different (but still genuinely historical) value. Recorded in `docs/TECH_DEBT.md` rather than fixed, since the correct behavior requires a small design choice, not an unambiguous bug fix.
- **Final status:** **PASS.**

---

## 5. C-027

- **Overnight reason for deferral:** needs a workflow with a Decision node that has no default/fallback branch. Neither real Decision-node workflow discovered across the entire overnight run (customer_change's own sequential chain has no Decision node at all; commercial_configuration's real Decision-node workflow always has an unconditional Default edge) can naturally reproduce `WORKFLOW_DECISION_NO_MATCH`. Remained genuinely unresolved through the end of the overnight run, correctly carried forward as a known, deliberately time-boxed gap rather than silently dropped.
- **Morning execution:** since no existing real workflow can reproduce this condition, closing it required purpose-building one. Read the exact resolution logic (`fn_resolve_workflow_next_approval` raises `WORKFLOW_DECISION_NO_MATCH` when no conditioned branch matches and no fallback exists) and the exact publish-time validation (a Decision node needs >= 2 branches but NOT a default branch — confirming this is a genuinely reachable, publishable product shape, not a hypothetical). Built a dedicated, temporary probe workflow for `customer_change` via the real Workflow Builder RPCs: Start -> Decision(segment) -> two conditioned branches (enterprise, sme) -> End, deliberately with zero default branch. Since only one workflow per domain may be active at a time, testing required briefly swapping the live, shared active workflow definition — a real, if narrow, risk to any concurrent request during that window. Surfaced this directly to Utkarsh in chat before proceeding; he explicitly authorized doing the swap-test-restore sequence in one uninterrupted run.
- **Result:** activated the probe workflow; created a disposable customer with a segment matching neither conditioned branch; submitted a real Customer Change Request against it. Submit correctly failed with `WORKFLOW_DECISION_NO_MATCH`. The request's own state was confirmed byte-for-byte unchanged before and after (no partial corruption). Immediately restored the original active workflow definition and confirmed via direct query that exactly one `customer_change` workflow is active again, and it is the original one.
- **Final status:** **PASS.**

---

## 6. PRODUCT DECISIONS

Six pending product-policy questions, none discovered to block anything. Full plain-English decision cards are recorded in `docs/journey-runs/OVERNIGHT_PENDING_APPROVALS.md` under "Morning Catch-Up Decision Cards (2026-09-21, plain English)"; summarized here:

1. **Can other people see a customer's paperwork before it's finalized?** (A-036) — Today, yes, anyone with onboarding-create access can view (not edit) another maker's in-progress draft. Recommend restricting to the creator, but genuinely Utkarsh's call.
2. **Should there be a sanity check on backdating a new customer's contract start date?** (A-034) — Today, no limit exists at all. No recommendation offered; depends entirely on real business tolerance.
3. **Should you be able to start a pricing change for a customer who's been deactivated?** (B-011) — Today, yes for pricing changes, no for general customer-detail changes; an inconsistency, not a deliberate design. Recommend making them consistent, but Utkarsh's call on what "inactive" should mean.
4. **Same question, but for approving (not starting) a change on a now-inactive customer.** (C-030) — Today, an already-in-flight change can still be approved after deactivation, in a narrow timing window. No recommendation offered.
5. **Can a role be limited to only certain customers, or does every role see everything?** (D-022) — Confirmed, by direct evidence in `docs/AUTHORIZATION_MODEL.md` §5/§18, to be an **intended, explicitly documented current design choice** for version 1, not an accidental gap, with a designed (but unbuilt) extension path already in place. Recommend leaving as-is until a real need arises. **This finding was re-classified this morning** from the overnight report's more alarmed "most significant finding" framing, based on direct evidence rather than inference.
6. **Should "fixing a past pricing mistake" be able to reach further back in time?** (E-015) — Today, a correction can only reach back to the start of the current pricing period. No recommendation offered; depends on whether reopening old, possibly-already-invoiced periods is ever something the business wants.

---

## 7. DECISIONS BLOCKING BATCH 14

**None.** All six decisions above were confirmed, individually, to not block Batch 14 or any later known/scheduled batch, and to be safe to defer indefinitely until Utkarsh has time to weigh in.

---

## 8. TESTS

Full checkpoint suite run and passed cleanly, both immediately after applying the B-017 migration and once more as a final aggregate confirmation:

- `npx tsc --noEmit`: 0 errors.
- `npx vitest run`: 927 tests passing across 102 files (unchanged count; no automated test was added this session, consistent with this codebase having no live-database trigger test infrastructure to extend).
- `npx eslint .`: 0 errors/warnings.
- `npm run build`: succeeded.
- `npm audit`: 0 vulnerabilities.
- Governed RPC grant guard: 0 exposed backend-only mutation RPCs, holding after the migration.
- `.env.local`, `.runtime-tests`, `.claude/launch.json`: confirmed untouched throughout.
- Secret scan on every diff before each commit: clean.

---

## 9. COMMITS

Four logical commits, all on `team-preview`:

1. `8a09973` — Morning catch-up: execute B-007 (former-name search)
2. `e28e16c` — Morning catch-up: apply and verify the B-017 Customer Master fix
3. `b4f6d3b` — Morning catch-up: execute C-027 (WORKFLOW_DECISION_NO_MATCH)
4. `657903f` — Morning catch-up: reconcile pending approvals, add plain-English decision cards

No commit required redaction this session (all findings were either already resolved or recorded at an appropriate level of detail from the first draft).

---

## 10. DEPLOYMENT

- Local `HEAD`, `origin/team-preview`, the latest Vercel Preview deployment, and the stable Git-branch alias all match at `657903f5d250d9413b6114a2591fab81009fc9c7`, confirmed via the Vercel API (deployment `dpl_8AZE8tJufpxD7mG69pzY261aerYo`, state `READY`).
- `origin/main` (Production) was never touched.
- The Supabase database migration state is now fully in sync (local = remote, all 84 migrations applied).

---

## 11. OPEN ITEMS

- Six product-policy decisions remain open (Section 6), none blocking, recorded as plain-English decision cards in `docs/journey-runs/OVERNIGHT_PENDING_APPROVALS.md` for Utkarsh's review at his convenience.
- The B-007 minor finding (former-name label precision when historical names overlap) remains open in `docs/TECH_DEBT.md`, low severity, not blocking.
- The probe workflow built for C-027 (`db4303ff-e1a0-4609-96d3-8f03c6af4fbd`, inactive, clearly named "C-027 Decision No-Match Probe (temporary, morning catch-up)") remains in the database, inactive and harmless. No cleanup action needed.
- No approvals, migrations, or journeys remain PARKED or PENDING that were not already accounted for above.

---

## 12. BATCH 14 READINESS

**BATCH 14 READY WITH NON-BLOCKING PRODUCT DECISIONS.**

All morning catch-up work is complete: the parked migration is applied and verified, both deferred journeys are executed and closed, and all six product-policy decisions are triaged, correctly classified, and confirmed to not block Batch 14 or any later scheduled batch. The trust boundary holds (governed RPC guard passes), the full checkpoint suite is green, and the entire fixture chain (Customer Master, Customer Change, Commercial Configuration, Commercial Change/Pricing Models) is in a known, documented, healthy state. Batch 14 can begin whenever scheduled, with the six product decisions available for Utkarsh's input whenever convenient, not as a prerequisite.

NEXUS MORNING CATCH-UP AFTER BATCHES 8-13 COMPLETE
