# Overnight Run Pending Approvals (Batches 8-13)

Created at the start of the NEXUS END-TO-END BUSINESS JOURNEY VALIDATION overnight autonomous run (Batches 8-13). Maintained continuously throughout the run. Never erase historical entries; update Status instead.

**Pending approvals: 0**
**Pending product decisions: 2** (A-036 carried over from Batch 7; PD-002/A-034 new this batch)
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

---

## Pending Approvals

(None at run start. Entries added below as they occur, in chronological order, never removed.)

---

## Log

- Run start: overnight baseline confirmed — local HEAD, `origin/team-preview`, and the Vercel stable alias all match `b967a5e5b7c5bce2c13073b5b8158b8db66cb463`; `origin/main` (Production) untouched at `04aba7a77e3bb13888ad83e17faac471facb1206`; working tree clean; all migrations in sync (local = remote); governed RPC grant guard reports 0 exposed backend-only mutation RPCs (trust-boundary pre-flight PASS).
- Batch 8 in progress: real onboarding approval executed for the first time (A-031/A-032 PASS), a real content-sniffing defect found and fixed (A-023, DEFECT-B8-001, see BATCH_08_RESULTS.md), A-020/A-021/A-022/A-024/A-025/A-026/A-027/A-029/A-033/B-001/B-002 through B-006/B-008 all PASS. Still open within Batch 8 at this point: A-028 (needs a dedicated broken-graph workflow, deferred to avoid the time cost of building one via the Builder UI mid-cycle), A-035's multi-component stress variant (single-component case already proves the core mechanism), ACC-001 (needs real keyboard-only browser interaction, not yet performed), B-007 (depends on a Customer Change rename that has not happened yet, correctly deferred per its own documented dependency on C-017/C-033).
