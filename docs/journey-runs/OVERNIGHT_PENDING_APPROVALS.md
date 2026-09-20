# Overnight Run Pending Approvals (Batches 8-13)

Created at the start of the NEXUS END-TO-END BUSINESS JOURNEY VALIDATION overnight autonomous run (Batches 8-13). Maintained continuously throughout the run. Never erase historical entries; update Status instead.

**Pending approvals: 0**
**Pending product decisions: 1** (carried over from Batch 7: A-036)
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

---

## Pending Approvals

(None at run start. Entries added below as they occur, in chronological order, never removed.)

---

## Log

- Run start: overnight baseline confirmed — local HEAD, `origin/team-preview`, and the Vercel stable alias all match `b967a5e5b7c5bce2c13073b5b8158b8db66cb463`; `origin/main` (Production) untouched at `04aba7a77e3bb13888ad83e17faac471facb1206`; working tree clean; all migrations in sync (local = remote); governed RPC grant guard reports 0 exposed backend-only mutation RPCs (trust-boundary pre-flight PASS).
