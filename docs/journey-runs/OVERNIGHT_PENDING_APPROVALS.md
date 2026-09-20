# Overnight Run Pending Approvals (Batches 8-13)

Created at the start of the NEXUS END-TO-END BUSINESS JOURNEY VALIDATION overnight autonomous run (Batches 8-13). Maintained continuously throughout the run. Never erase historical entries; update Status instead.

**Pending approvals: 0**
**Pending product decisions: 3** (A-036 carried over from Batch 7; PD-002/A-034 from Batch 8; PD-003/B-011 new this batch)
**Pending migrations: 1** (PM-001, found via B-017 this batch)
**Blocked downstream journeys: 0**

---

## Pending Product Decisions

### PD-001: A-036 — read visibility of another maker's onboarding draft (carried over from Batch 7)

- Journey ID: A-036
- Current behavior: any holder of `customer.create` can read (not mutate; mutation was fixed in Batch 7/DEFECT-B7-002) another maker's in-progress draft by request_id. No creator-scoped read check exists.
- Business consequence: potential exposure of pre-submission business data (customer legal name, tax IDs, contact details) to other holders of the same broad permission, ahead of that data ever being approved as Customer Master truth.
- Technical consequence: `getOnboardingCase`'s caller (the case detail route) would need a `created_by` check equivalent to what Save/Submit now enforce, if creator-only read is the desired policy.
- Option A: Restrict read to the creator only (mirrors the Save/Submit fix). Risk: could break an undocumented legitimate collaboration path if one exists (no evidence either way in this codebase).
- Option B: Leave read open to any `customer.create` holder as an intentional collaboration feature. Risk: continues the current exposure.
- Recommended default: Option A (creator-only read), since it is the more conservative, least-privilege choice and mirrors the already-established Save/Submit pattern, but this is a genuine product/business call, not purely technical.
- Exact question for Utkarsh: should viewing an in-progress onboarding draft be restricted to its own creator, matching Save/Submit, or is broader same-permission visibility an intentional collaboration feature?
- Downstream effect: Does not block Batches 8-13. Parked here per explicit instruction not to resolve overnight.
- Status: **PENDING**

### PD-002: A-034 — no server-side sanity validation on a Commercial Configuration's effective_date

- Journey ID: A-034
- Current behavior: `approve_customer_onboarding_case` accepts any `p_effective_date`, including a date 6+ years in the past (live-verified), with no minimum/maximum boundary check anywhere in the approval path.
- Business consequence: a commercial configuration could be backdated (or dated arbitrarily far in the future) with real downstream billing/revenue-recognition implications, with no system-level guardrail against a data-entry mistake.
- Technical consequence: none currently; this is purely a missing validation, not a broken invariant.
- Option A: Add a reasonable server-side boundary (e.g. effective_date must not be more than N days in the past, and not more than M years in the future), matching whatever this business's actual backdating/future-dating tolerance is.
- Option B: Leave unconstrained; effective-dating flexibility (e.g. legitimate backdated corrections, per Commercial Change's own documented "correction" category) may be an intentional design choice for a system already used to backdate corrections elsewhere.
- Recommended default: not offered; this requires knowing the actual business tolerance for backdating/future-dating, which is not something to infer.
- Exact question for Utkarsh: should Commercial Configuration effective dates have a server-enforced sanity boundary (and if so, what range), or is unconstrained dating intentional given Commercial Change's own "correction" category already implies legitimate backdating use cases?
- Downstream effect: does not block Batches 8-13; every fixture created this run uses reasonable near-future dates regardless of whether the server would reject an unreasonable one.
- Status: **PENDING**

### PD-003: B-011 — Commercial Configuration Version creation is not blocked for an inactive customer, unlike Customer Change creation

- Journey ID: B-011
- Current behavior: `create_customer_change_request`'s TS action layer explicitly blocks creation against an inactive customer; `create_commercial_configuration_version`'s TS action layer has no equivalent check, and the underlying RPC succeeds either way (live-verified against a deliberately, temporarily deactivated customer).
- Business consequence: commercial terms can continue being amended for a customer that is currently deactivated, which may or may not be intentional (e.g. finishing a version already mid-flight before deactivation could be legitimate; opening a brand-new version against a deactivated customer might not be).
- Technical consequence: none currently broken; this is an inconsistency between two structurally similar governed-change action layers, not a data-integrity defect.
- Option A: Add the same active-customer precondition to Commercial Configuration Version creation, matching Customer Change's existing behavior, for consistency.
- Option B: Leave as-is; deactivation may be intentionally scoped to block only Customer Master field changes, not commercial-term amendments, as a deliberate design choice.
- Recommended default: Option A (match Customer Change's existing precondition), for consistency, but this is a genuine business-policy call about what "deactivated" is meant to freeze.
- Exact question for Utkarsh: should creating a new Commercial Configuration Version be blocked for an inactive customer, the same way creating a new Customer Change already is, or is that an intentional asymmetry?
- Downstream effect: does not block Batches 8-13; no fixture in this run relies on creating a version against a deactivated customer outside this one deliberate test.
- Status: **PENDING**

---

## Pending Approvals

(None at run start. Entries added below as they occur, in chronological order, never removed.)

---

## Pending Migrations

### PM-001: fix_customer_lifecycle_guard_governed_field_write_protection (found via B-017)

- Journey ID: B-017 (Batch 9)
- Migration path: `supabase/migrations/20260930080000_fix_customer_lifecycle_guard_governed_field_write_protection.sql`
- Reason parked: this migration redefines `fn_protect_customer_lifecycle()`, a data-integrity guard trigger on the `customers` master table. A prior migration touching this exact function (`20260924000000_fix_customer_lifecycle_guard_stale_allowlist.sql`) was itself staged-not-applied pending explicit user go-ahead, per its own header comment, an established working agreement this run continues to honor. Applying it also requires the Supabase CLI (`supabase db push --linked`), which needs CLI authentication this run does not have standing authorization to perform unattended.
- Defect being fixed: `fn_protect_customer_lifecycle()`'s UPDATE branch currently blocks direct writes to non-governed structural columns (id, key, created_at, created_by) but does NOT block direct writes to the governed Customer Master business fields (name, address, tax fields, etc.) or `is_active` themselves, confirmed empirically against a disposable test customer (full detail in `docs/journey-runs/BATCH_09_RESULTS.md`, journey B-017). This contradicts the standing `CLAUDE.md` invariant that approved business truth is never edited directly outside the two sanctioned RPCs.
- Affected journey/chain: B-017 only, directly. No other Batch 8-13 journey depends on this fix being applied; it is a defense-in-depth database-layer gap, not a currently-reachable application-layer hole (the real app only ever reaches `customers` through the two sanctioned RPCs and RLS-gated roles).
- Tests already passing: none yet (the fix has not been applied; a regression test will be authored once it is).
- Exact resume instruction: review `supabase/migrations/20260930080000_fix_customer_lifecycle_guard_governed_field_write_protection.sql`, then run `npx supabase db push --linked` (requires `supabase login` or `SUPABASE_ACCESS_TOKEN` and the project database password) once approved. After applying, live-verify against a disposable test customer that the guard now holds and that the two sanctioned writer RPCs still succeed unchanged; add automated regression coverage if this codebase's test infrastructure is extended to support live-database trigger tests.
- Status: **PARKED**

---

## Log

- Run start: overnight baseline confirmed — local HEAD, `origin/team-preview`, and the Vercel stable alias all match `b967a5e5b7c5bce2c13073b5b8158b8db66cb463`; `origin/main` (Production) untouched at `04aba7a77e3bb13888ad83e17faac471facb1206`; working tree clean; all migrations in sync (local = remote); governed RPC grant guard reports 0 exposed backend-only mutation RPCs (trust-boundary pre-flight PASS).
- Batch 8 in progress: real onboarding approval executed for the first time (A-031/A-032 PASS), a real content-sniffing defect found and fixed (A-023, DEFECT-B8-001, see BATCH_08_RESULTS.md), A-020/A-021/A-022/A-024/A-025/A-026/A-027/A-029/A-033/B-001/B-002 through B-006/B-008 all PASS. Still open within Batch 8 at this point: A-028 (needs a dedicated broken-graph workflow, deferred to avoid the time cost of building one via the Builder UI mid-cycle), A-035's multi-component stress variant (single-component case already proves the core mechanism), ACC-001 (needs real keyboard-only browser interaction, not yet performed), B-007 (depends on a Customer Change rename that has not happened yet, correctly deferred per its own documented dependency on C-017/C-033).
- Batch 8 closed: 24/25 resolved (21 PASS, 2 FAILED THEN FIXED + PASS, 1 PRODUCT DECISION REQUIRED/PD-002), B-007 correctly deferred to its own documented dependency.
- Batch 9 closed: 25/25 resolved (22 PASS, 1 EXPECTED BEHAVIOR CONFIRMED EMPIRICALLY, 1 PRODUCT DECISION REQUIRED/PD-003, 1 PRODUCT GAP CONFIRMED with a parked fix migration/PM-001). A real defect (B-017: `fn_protect_customer_lifecycle`'s UPDATE guard does not protect governed fields from a direct non-RPC write) was found, fixed as a migration, and parked (not applied) per this repo's established precedent for changes to this trigger. A real environment issue (the live `customer_change` workflow's Finance Approval node had zero eligible approvers) was found and fixed by adding a team membership via the sanctioned RPC. Full detail in BATCH_09_RESULTS.md.
