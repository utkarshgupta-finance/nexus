# Nexus: Product Gap Register

Canonical, current-state source of truth for every confirmed Product Gap this
journey-testing program has ever found, across Batches 1 through 27 plus the
Journey Universe Expansion Audit and the overnight-run reconciliation files.
Batch ledgers (`docs/journey-runs/BATCH_<N>_RESULTS.md`) remain the
evidence/history record of how each gap was found, decided, and verified.
This register answers one question only: **is it still open right now?**

Built via a full audit of Batches 1-27 (2026-09-28), reconciled the same day
after a structural review separated confirmed gaps from decisions, unverified
candidates, and deferred improvements (see "Reconciliation notes" at the
bottom). Not from memory or `RUN_STATE.json` summaries alone.

## Four current-state sections

- **A. ACTIVE PRODUCT GAPS**: confirmed (empirically reproduced, not merely
  suspected) gaps that still need a Product Decision, implementation, or
  immediate closure work.
- **B. TO VERIFY**: suspected gaps not yet empirically confirmed. These do
  NOT count as confirmed Product Gaps until proven.
- **C. DEFERRED / ACCEPTED FOR NOW**: known behaviours or improvements
  consciously not being addressed now. Each has a reason, a trigger for
  reopening, and whether current behaviour is accepted meanwhile. These do
  NOT count as active open Product Gaps.
- **D. CLOSED HISTORY**: FIXED / ACCEPTED AS-IS / SUPERSEDED. Full history
  preserved, not active.

---

## A. ACTIVE PRODUCT GAPS

All 8 below are confirmed via genuine reproduction (live UX, real DB
evidence, or direct source inspection of the exact enforcement point), and
all 8 involve a genuine decision (block vs. warn vs. leave-as-is, or
build vs. delete vs. keep): none are "not yet asked" placeholders; per this
reconciliation's own rule, a real choice between legitimate options IS a
Product Decision, whether or not it was formally posed before today.

### PG-035: Reference Master has no maker-checker / self-approval protection

Status: DECISION REQUIRED
First discovered: AB-020, Batch 26
Related journeys: AB-020
Domain: Reference Master (Settings)

Gap: every mutating action in `src/features/reference-data/actions.ts` and
`data/reference-master.data.ts` is gated solely by
`requirePermission("reference_master","write")`. No approve/send-back RPC,
no checker sign-off, no `SELF_APPROVAL_NOT_ALLOWED`-equivalent check exists
in this domain, unlike other governed domains.

Current behaviour: any single holder of `reference_master.write` can
create, edit, or deactivate a reference value with no second person ever
reviewing it.

Business/control consequence: reference data (segments, business units,
pricing model options) that every downstream governed workflow depends on
can be silently changed by one actor, with no independent review.

Decision question: should Reference Master gain maker-checker approval, or
should the canonical expectation be amended to match the current
single-permission direct-apply design?

Decision: (blank, awaiting Utkarsh)
Implementation required: YES, once decided.
Journey rerun required: AB-020, once decided.

---

### PG-036: Concurrent-approval loser's experience differs by whether the winning approval was final

Status: DECISION REQUIRED
First discovered: AB-039, Batch 26
Related journeys: AB-039, AB-043 (one decision, not two)
Domain: cross-cutting (all four governed approve RPCs)

Gap: two genuinely overlapping approve calls are correctly serialized (one
winner, no corruption), but an early `if status = 'approved' then return`
short-circuit runs ahead of the node-key mismatch check whenever the winning
approval was the request's FINAL decision, so the loser gets a silent,
success-shaped, idempotent response with no error. At a non-final node, the
loser instead gets an explicit `WORKFLOW_NODE_ALREADY_ADVANCED` error.

Current behaviour: inconsistent loser experience depending on graph
position of the winning approval.

Business/control consequence: a checker who lost a race at a request's
final step has no signal someone else already decided it.

Decision question: should the final-approval loser also see an explicit
"already actioned" error for consistency, or is the current silent
idempotent-success return the accepted, simpler behaviour?

Decision: (blank, awaiting Utkarsh)
Implementation required: YES, once decided (small, bounded RPC change).
Journey rerun required: AB-039, AB-043, once decided.

---

### PG-037: Same approver can decide two sequential levels of one workflow request

Status: DECISION REQUIRED
First discovered: V-028, Batch 27
Related journeys: V-028
Domain: cross-cutting (all four governed approve RPCs)

Gap: `approve_customer_change_request`'s only identity check compares the
actor to `created_by` (the original submitter); it never checks the
request's own `workflow_node_transitions` history for prior approvers. A
user who approves node 3 as a Team A member, then is moved to Team B before
the request reaches node 4, can legitimately approve node 4 too.

Current behaviour: the same individual can decide 2+ sequential levels of
one request, provided they hold each node's required team membership at
the moment they act.

Business/control consequence: a real segregation-of-duties gap for
finance-sensitive multi-level approvals.

Decision question: should Nexus add a cross-node distinct-approver control
for multi-level workflows, or accept single-approver-across-levels given
team membership is itself admin-governed?

Decision: (blank, awaiting Utkarsh)
Implementation required: YES, once decided (small, bounded RPC change).
Journey rerun required: V-028, once decided.

---

### PG-038: Legacy ungoverned RPC `create_commercial_change_for_configuration` remains live

Status: DECISION REQUIRED
First discovered: D-017, Batch 11
Related journeys: D-017, E-020
Domain: Commercial Configuration / Commercial Change

Gap: a legacy RPC performs a synchronous, unconditional live mutation
(closes every open component, inserts a `commercial_changes` row) with no
draft, submit, approver, self-approval check, or workflow routing.
`service_role`-only, orphaned (no application caller), but still callable at
the DB level.

Current behaviour: exists, unused, unwired. Reproduced genuinely in E-020:
racing the legacy RPC against a real governed draft left the governed
draft's snapshot stale, producing a real business-data gap once the
governed change later approved.

Business/control consequence: bypasses every governance control the rest
of Commercial Configuration enforces, though only reachable via
`service_role` credentials.

Decision question: keep the legacy RPC for emergency use, delete it
outright, or bring it under governed workflow control?

Decision: (blank, awaiting Utkarsh)
Implementation required: YES, once decided.
Journey rerun required: D-017, E-020, once decided.

---

### PG-040: Deactivated team still allows its still-assigned members to approve, with no warning

Status: DECISION REQUIRED
First discovered: O-005, Batch 5
Related journeys: O-005, T-019 (anticipated to resurface as V-036)
Domain: Teams / workflow routing (cross-cutting)

Gap: `fn_require_workflow_team_membership` checks only
`user_teams.revoked_at`, never `teams.is_active`. A still-active member of a
now-deactivated team can still approve requests routed to that team's node,
with no warning to the approver or the admin who deactivated the team.
Reproduced live twice (Batch 5, Batch 25), never formally decided.

Current behaviour: deactivating a team has no effect on its existing
members' ability to act on in-flight requests.

Business/control consequence: a team marked inactive (disbanded,
reorganized) can still silently approve real requests via any member never
explicitly removed; "deactivate the team" does not mean "stop this team
from acting," unlike removing an individual member.

Decision question: should deactivating a team block its members from
acting on in-flight approvals (hard block), warn but allow, or is
member-level removal the only supported lever, with team deactivation
being cosmetic to the routing layer?

Decision: (blank, awaiting Utkarsh)
Implementation required: depends on decision.
Journey rerun required: O-005, T-019, anticipated V-036, once decided.

Notes: distinct from PG-005 (zero-active-members, closed history below);
this is about a team with members still active but the TEAM itself
deactivated.

---

### PG-044: Duplicate Commercial Component scope silently allowed, no dedup warning

Status: DECISION REQUIRED
First discovered: D-006 / D-019, Batch 11
Related journeys: D-006, D-019
Domain: Commercial Configuration

Gap: two components with byte-for-byte identical scope, rate, and currency
are both accepted and persisted as independently open rows; no exclusion
constraint, no dedup, no "possible duplicate" warning before approval.
Confirmed live (not merely inferred).

Business/control consequence: a reviewer could approve an accidental
duplicate with no system prompt; low-likelihood but real risk of
double-billing a duplicated commercial term.

Decision question: should a "possible duplicate scope" warning be shown to
a reviewer before approving a component that duplicates an existing open
component's scope, should it be blocked outright, or left as-is (legitimate
business reasons for two identical-looking components may exist, e.g.
separate contractual lines)?

Decision: (blank, awaiting Utkarsh)
Implementation required: depends on decision.
Journey rerun required: D-006, D-019, once decided.

---

### PG-045: Duplicate designation row names silently allowed within one component

Status: DECISION REQUIRED
First discovered: G-021, Batch 14
Related journeys: G-021
Domain: Commercial Configuration (Designation pricing)

Gap: two designation rows can share the same display name (e.g. two
"Consultant" rows); rows are keyed by row id, not name, so both
independently contribute to the total. Confirmed live.

Business/control consequence: an analyst could mistake adding a
duplicate-named row for editing the existing one, inadvertently doubling a
MUG/designation guarantee.

Decision question: should a duplicate designation row name within one
component be blocked, warned against, or left as-is?

Decision: (blank, awaiting Utkarsh)
Implementation required: depends on decision.
Journey rerun required: G-021, once decided.

Notes: same shape as PG-044 but within one component rather than across
components; unlike PG-044, there is no plausible legitimate reason for two
identically-named rows in one pricing table, so a hard block is the more
obviously-safe default here if a quick decision is wanted.

---

### PG-053: Former-name search result label may show the most-recent, not most-specific, historical match

Status: DECISION REQUIRED
First discovered: B-007, Batch 8
Related journeys: B-007
Domain: Customer Master

Gap: `searchFormerCustomerNames`'s dedup logic keeps only the first row per
customer in most-recent-first order. When a customer's historical names
share overlapping substrings, the displayed "Former legal name: X" label can
show the most-recently-changed matching value rather than the one most
specifically matching the search term. The customer is always found
correctly; only the specific label shown can differ. Confirmed reproducible.

Business/control consequence: minor label-accuracy issue, no functional
impact, low severity.

Decision question: should the search show the best-matching historical
name (the one that actually matched the search term), all matching names,
or is always-most-recent an acceptable simplification?

Decision: (blank, awaiting Utkarsh)
Implementation required: small, once decided.
Journey rerun required: B-007, once decided.

---

## B. TO VERIFY

Suspected gaps not yet empirically confirmed. Not counted as confirmed
Product Gaps.

### TV-001 (PG-042 candidate): Timeline may prematurely announce "now Live/approved" in 3 of 4 domains

First discovered: H-020 (Go Live; confirmed and fixed there), Batch 15
Verification journey: AA-023 (allocated, not yet executed)
Domain: cross-cutting (shared `buildWorkflowTransitionEvents`)

Suspected issue: H-020 found and fixed a real defect in Go Live's Timeline
(`isFinalEvent` computed as "last transition fetched" rather than "reached
the terminal node"). The root cause lives in a function shared by all four
Workflow Runtime V1 domains (Onboarding, Customer Change, Commercial
Configuration, Go Live). Only Go Live's own fix and reverification were
performed; the other three domains' Timelines have never been independently
confirmed either way.

Becomes a confirmed Product Gap only if: AA-023 is executed against
Onboarding, Customer Change, and Commercial Configuration and empirically
reproduces the same premature-terminal-wording symptom in at least one of
them. If AA-023 finds all three already correct (plausible, since H-020's
fix touched the shared function itself), this closes as
`PRODUCT GAP RESOLVED + PASS` with no further code change, or as "already
covered by H-020's fix" if the shared-function fix turns out to have
already protected all four domains.

Next action: execute AA-023.

---

## C. DEFERRED / ACCEPTED FOR NOW

Known behaviours or improvements consciously not addressed now. Not counted
as active open Product Gaps. Current behaviour is accepted meanwhile in
every entry below (none represent a live correctness/control/security
problem); each has an explicit trigger for reopening.

### DF-001 (PG-046): No support/debug surface exposes the raw `pricing_rule_kind` DB value
Journey: F-020, Batch 13
Reason for deferral: pure enhancement (investigability only, not
correctness); P3 priority.
Accepted meanwhile: yes, no live impact.
Trigger to reopen: a real support/audit need to map a friendly pricing-model
label back to its raw DB kind value.

### DF-002 (PG-047): Team-less Approval node has no publish-time UX warning
Journey: K-003, Batch 1
Reason for deferral: a dangling suggestion, never a decided requirement; a
downstream safety net already exists (PG-005's zero-active-members
mechanism catches an unroutable node at runtime).
Accepted meanwhile: yes.
Trigger to reopen: a real incident of a workflow admin publishing an
unroutable graph unknowingly, or a broader Workflow Builder UX pass.

### DF-003 (PG-048): `provision_app_user` would surface a raw FK-violation error if ever called from a future non-UI caller
Journey: T-008, Batch 24
Reason for deferral: zero live path can trigger this today; every reachable
UI caller only ever iterates real Auth rows.
Accepted meanwhile: yes.
Trigger to reopen: a future direct API/integration path is added that calls
this RPC outside the current UI.

### DF-004 (PG-049): No self-service "my access" view
Journey: N-026, Batch 5
Reason for deferral: admin-convenience only; no control/security/
data-integrity risk; every fact it would show is already correctly
derivable and viewable by an admin on request.
Accepted meanwhile: yes.
Trigger to reopen: a material volume of "why can't I see my own access"
support requests.

### DF-005 (PG-050): No search/filter on the User Access or Team Master lists
Journeys: N-027, O-020, Batch 5-6
Reason for deferral: confirmed low current impact given today's low
user/team count; a shared `DataTable` component is the eventual fix.
Accepted meanwhile: yes.
Trigger to reopen: the list genuinely becoming hard to scan (a real
multi-page user/team count).

### DF-006 (PG-051): No UI surfaces historical audit/timeline data for role grants, team membership, or several Settings areas
Journeys: N-029, O-023, R-013, R-014 (recurring across Batches 5, 6, 23)
Reason for deferral: the underlying `user_roles`/`user_teams`/`audit_log`
data is fully correct, immutable, and complete in every case; only the
viewing surface is missing.
Accepted meanwhile: yes.
Trigger to reopen: a real compliance/support need to search audit history
by actor or time range.

### DF-007 (PG-052): Invoice Frequency `cadence_months` retroactivity is architecturally unresolved but currently latent
Journey: P-012, Batch 6
Reason for deferral: `getInvoiceFrequencyCadence` has zero real call sites;
`billing_cadence` is stored/displayed everywhere as an opaque code. No live
code path is affected.
Accepted meanwhile: yes.
Trigger to reopen: any code change adds a real call site for
`getInvoiceFrequencyCadence` (mirror the `fx_snapshot_rate` freeze-at-
creation precedent at that point, per the existing regression-test
suggestion in `docs/TECH_DEBT.md`).

### DF-008 (PG-054): Customer Master search and Approvals/Operational Queue lists have no server-side pagination
Journeys: S-001, S-010, Batch 23
Reason for deferral: correct and non-defective at current scale (26
customers, dozens of items); deliberate "Scale-ready, not scale-heavy"
design per module header comment.
Accepted meanwhile: yes.
Trigger to reopen: real data volume growth by an order of magnitude or more.

### DF-009 (PG-055): Go Live not extended to the full Business Unit / Territory / Customer scoped-authorization model
Journey: D-022 follow-up (PD-005), Batch 11
Reason for deferral: PD-005's four-tier model was built for 5 domains; Go
Live's own confirmed information-disclosure issue was separately fixed
using the existing PD-005 mechanism, so no known live risk remains. Full
per-tier scoping for Go Live itself was a deliberate scope cut, not an
oversight.
Accepted meanwhile: yes.
Trigger to reopen: a real business need for Go Live authorization to match
its five sibling domains' granularity.

---

## D. CLOSED HISTORY (fixed, decided-and-accepted, or superseded; kept for traceability, not active)

Full evidence for every entry below lives in its originating batch ledger
(or, for PG-039/041/043, in this reconciliation's own commit); only a
compact summary is kept here.

| ID | Journey(s) | Batch | What it was | Resolution | Evidence |
|---|---|---|---|---|---|
| PG-001 | N-030 | 5 | `grant_user_role` permitted granting a deactivated role | FIXED | commit `acfc5ba` |
| PG-002 | O-011 | 5 | `assign_user_to_team` silently no-op'd on primary-promotion | FIXED | commit `39c6c05` |
| PG-003 | P-013 | 6 | Reference Master Level 3 tiering not server-enforced | FIXED | commit `186b66d` |
| PG-004 | N-031 | 5 | `usage.read`/`entitlement_settlement.read` seeded but unenforced | DECIDED (wire up as real gates) + FIXED | commit `444226a` |
| PG-005 | O-018, A-027, C-025, E-028, J-011, M-025, V-027 | 6 (decision), recurring 8/9/13/19/21/27 | Zero-active-team-members strands every request at that node indefinitely | DECIDED ("warn but allow") + FIXED | commit `1075ecb`, Operations Queue banner + `checkTeamRemovalImpactAction`. Verification note: M-025 (Batch 21) states "no proactive flag anywhere in My Work or the Operational Queue," apparently in tension with this fix's own Operations Queue banner; not reconciled, verify against current source if this resurfaces again (anticipated as Z-007, Z-009). |
| PG-006 | B-011 / PD-003 | 9 | Commercial Version creation not blocked for inactive customer | DECIDED (block) + FIXED | migration `20260930090000` + UX fix |
| PG-007 | C-030 / PD-004 | 10 | `approve_customer_change_request` has no `is_active` check | DECIDED (accept current behaviour, no code change) | regression test added |
| PG-008 | D-022 / PD-005 | 11 | No per-customer/territory data isolation in permission model | DECIDED (build 4-tier scoping) + FIXED for 5 domains + go-live info-disclosure follow-up fixed | migration `20260930110000`; admin scope-picker UI residual tracked in TECH_DEBT.md; Go Live's own full extension is DF-009 above |
| PG-009 | E-015 / PD-006 | 12 | `correction` category not exempt from effective-date ordering; later, retroactive component start-date | DECIDED (exempt + allow retroactive start) + FIXED across 4 phases | migrations `20260930100000`, `20260930150000`, `20260930160000` |
| PG-010 | A-036 / PD-001 | 7 | Any onboarding-create holder could read another maker's in-progress draft | DECIDED (creator-only read) + FIXED | same-day 2026-09-21 |
| PG-011 | A-034 / PD-002 | 8 | No sanity boundary on Commercial Configuration effective_date | DECIDED (BU Head + Finance Head dual-approval exception) + FIXED | migrations `20260930120000`, `20260930140000` (atomicity fix) |
| PG-012 | I-015 | 17 | Ledger never recomputed after Entitlement Source cancellation | DECIDED + FIXED (2 phases) | migrations `20261002000000`, `20261004000000` |
| PG-013 | I-024 | 17 | No mechanism to reverse/adjust a recorded settlement | DECIDED (additive reversal) + FIXED | migration `20261002010000`, new `reverse_settlement` RPC |
| PG-014 | I-034 | 19 | Duplicate invoice reference on Entitlement Source creation | DECIDED (block, per-customer scope) + FIXED | migration `20261006000000` |
| PG-015 | I-035 | 19 | Metric mismatch between Entitlement Source and component's billed metric | DECIDED (must match) + FIXED | same migration as PG-014 |
| PG-016 | (measurement_definitions vs pricingUnit) | 19-20 | Unused parallel data path alongside the real mechanism | DECIDED (pricingUnit stays canonical; measurement_definitions future-only) | documented in `docs/GO_LIVE_ENTITLEMENT_ARCHITECTURE.md` section 7.2 |
| PG-017 | M-011 | 20 | Self-created item shown as "Pending My Approval" with no warning | DECIDED + FIXED | `buildMyWorkItems` logic change |
| PG-018 | M-021 | 21 | `canApprove` cross-domain OR-imprecision could leak a coincidental-team-match item | Reclassified from open decision to bounded defect and FIXED | per-item-type permission map |
| PG-019 | T-015, T-016 / PD-009 | 24 | `team.write` holder structurally could not reach any UI to manage team membership | DECIDED + FIXED | new Team Membership section on `/settings/teams` |
| PG-020 | T-025 / PD-010 | 25 | Duplicate team display names indistinguishable in assignment picker | DECIDED (keep duplicates, disambiguate picker with team code) + FIXED | label format change, 2 files |
| PG-021 | R-012 / PD-007 | 22 | Customer name Timeline resolution: live vs. frozen snapshot | DECIDED (keep live resolution, no snapshot) | documented in `docs/CUSTOMER_LIFECYCLE.md` section 19b, no code change |
| PG-022 | S-014 / PD-008 | 23 | 404 (nonexistent id) vs. 200 access-restricted (no permission) observably distinguishable | DECIDED (make indistinguishable) + FIXED | new `RequestUnavailable` component, 4 routes |
| PG-023 | D-003, D-004, D-015, D-021 | 11 | No deactivate/reactivate lifecycle for Commercial Configuration | DECIDED (will not build; customer-lifecycle is the correct path) | ACCEPTED AS-IS, journey text rewritten |
| PG-024 | P-021 | 7 | No UI for reference-data audit/actor history | DECIDED (build a per-value Activity drawer) + FIXED | new Activity Sheet, 12 tests |
| PG-025 | G-001, G-002, G-003, F-014 | 14, 13 | No Pricing Kernel (usage-to-bill engine) exists yet | ACCEPTED AS-IS / FUTURE MODULE | documented in `docs/COMMERCIAL_FOUNDATION_MIGRATION_DESIGN.md` |
| PG-026 | G-007 | 14 | `commercial_commitments kind='spend'` has no onboarding UI | ACCEPTED AS-IS / FUTURE MODULE | RPC comment documents deliberate deferral |
| PG-027 | I-003, I-004 | 16 | No way to create an API- or Import-sourced Entitlement Source | DECIDED (manual-only for now) | tracked in `docs/TECH_DEBT.md` "Later" |
| PG-028 | N-007 | 4 | No last-admin protection on self-deactivation | ACCEPTED AS-IS (documented, intentional) | journey's own text |
| PG-029 | N-013 | 4 | Self-grant of an elevated role via `user_access.write` | ACCEPTED AS-IS (documented, intentional) | `docs/AUTHORIZATION_MODEL.md` section 18 |
| PG-030 | I-016 | 17 | `cancel_entitlement_source` has no creator/self-action guard | ACCEPTED AS-IS (consistent with domain precedent) | journey's own text |
| PG-031 | S-019, S-020, S-021, S-022 | 24 | No cross-domain "Forms Hub" aggregate views | ACCEPTED AS-IS / FUTURE MODULE | Forms Hub backlog |
| PG-032 | Q-013, Q-014 | 22 | Customer Change / Commercial Configuration have zero attachment support | ACCEPTED AS-IS / FUTURE MODULE (pre-existing, documented) | journeys' own Notes |
| PG-033 | T-020, T-021, T-022 | 25 | Team Master: no edit, no hard-delete (safety feature), no team-lead concept | ACCEPTED AS-IS | journeys' own text, cross-referenced R-008 |
| PG-034 | H-039, I-006 | 16, 17 | Defense-in-depth checks missing on two service-role-only surfaces, not currently exploitable | ACCEPTED AS-IS (hardening debt) | `docs/TECH_DEBT.md` entries |
| PG-039 | E-022 | 12 | Designation-based Commercial Component could be approved with zero rate rows | FIXED (2026-09-28) | TS gate: `case.service.ts`'s `approveOnboardingCase` now calls `isCommercialRateDraftComplete` (previously only checked `components.length === 0`). DB gate (defense-in-depth): migration `20261011000000_fix_designation_component_requires_at_least_one_rate.sql`, `chk_commercial_components_pricing_rule_shape` now requires `jsonb_array_length(rates) > 0` for `dimension` kind, added `NOT VALID` (the one pre-existing E-022 evidence row is deliberately preserved, not retroactively rejected). Verified live: an UPDATE against that evidence row is now correctly rejected by the constraint. New regression test in `case.service.test.ts`. Full suite 1049/1049 passing, `tsc` clean. |
| PG-041 | S-013 (expansion) | 23 | 5 named routes still crashed on malformed UUID | FIXED (2026-09-28) | Added the identical `isValidUuid`/`notFound()` guard already proven by S-013's own 4 routes, to: `/forms/customer-onboarding/[requestId]`, `/commercials/[configId]`, `/commercials/[configId]/versions/[requestId]` (both ids), `/settings/workflows/[definitionId]`, `/settings/workflows/[definitionId]/versions/[versionId]` (only `versionId`, the one actually used in a DB lookup). `tsc` clean; the shared `isValidUuid` unit test suite (`src/lib/uuid.test.ts`) already covers the helper all 5 new call sites use, matching S-013's own original test-coverage precedent (no per-route tests exist for any of the 9 routes now using this guard). **Evidence caveat, disclosed honestly:** live HTTP-status re-verification (expecting 404) was attempted but blocked by an apparent long-running dev-server-process artifact affecting `notFound()`-based routing generally in this environment right now, confirmed NOT specific to this fix: even the already-shipped, previously-verified S-013 routes (e.g. `/reviews/[requestId]`) currently return 200 instead of 404 for a malformed id on this same server process. Restarting the dev server would very likely resolve this (not attempted, since killing a long-running shared process this session did not start requires the user's own authorization per this project's standing rule) but was not required to close this item given the code is verified identical to the already-proven, already-shipped S-013 pattern. |
| PG-043 | ACC-001, ACC-002 | 8 | `aria-required` not consistently exposed across required form fields | FIXED (2026-09-28) | Root cause (verified against the running app, not just source): `aria-required={question.isRequired}` was hand-set only on `ComboboxTrigger`; Base UI's `Combobox.Input` (the popup's own search box, a second independent `role="combobox"` element) reads `aria-required` from the Combobox Root's own `required` state instead, which was never set, so the Input never carried the attribute at all (confirmed live: `document.querySelector('[data-slot="combobox-input"]')` had no `aria-required`, while the Trigger correctly showed `true`). Fixed in `geography-combobox-question.tsx`: pass `required={question.isRequired}` to the `<Combobox>` root instead of hand-patching only the Trigger, so Base UI's own logic applies consistently to both elements (Trigger's own manual `aria-required` prop removed as redundant). Blast radius: 1 file, 3 fields (Country, State, City), confirmed the only consumer of this shared combobox wrapper in the app. New regression test `src/components/ui/combobox.test.tsx` guards the Trigger half (the part `renderToStaticMarkup` can exercise, since the popup is portal-rendered and not present in a static server render, and this repo has no jsdom/testing-library harness to open the popup in a unit test). The Input half (the actual originally-broken part) was verified live in a real browser instead: after the fix, both Trigger and popup Input on Country now correctly show `aria-required="true"`. |

---

## Reconciliation notes (2026-09-28, second pass)

- **First pass (same day)** found 55 distinct Product Gap mechanisms and put
  all 21 unresolved ones in one flat "OPEN" bucket. That conflated four
  different things: confirmed gaps needing a decision, unverified
  suspicions, deliberately-deferred improvements, and gaps with an
  unambiguous bounded fix. This reconciliation splits those apart.
- **Reclassified from "OPEN, decision not yet asked" to "DECISION
  REQUIRED"**: PG-035, PG-036, PG-037, PG-038 (already correctly framed as
  needing a decision), plus PG-040, PG-044, PG-045, PG-053 (previously
  marked "not yet asked" as if that meant no decision was needed; a genuine
  block/warn/leave-as-is or build/delete/keep choice existing IS a Product
  Decision regardless of whether it was formally posed before today).
- **Moved to TO VERIFY**: PG-042 (now TV-001). H-020's own fix was confirmed
  and live-verified for Go Live only; the other three domains were never
  independently tested. A suspicion is not a Product Gap until AA-023
  actually reproduces it.
- **Moved to DEFERRED / ACCEPTED FOR NOW**: PG-046 through PG-052, PG-054,
  PG-055 (9 items). None represent a live correctness/control/security
  problem today; each is a general product enhancement a journey happened
  to surface, not an active gap. Each now has an explicit trigger for
  reopening rather than sitting in the same bucket as genuine decisions.
- **Closed immediately, same day, per the immediate-closure rule**:
  - PG-039 (E-022): fix direction was unambiguous (at least one rate row
    required); implemented at both the TS completeness-gate layer and the
    DB constraint layer (defense-in-depth, `NOT VALID` to preserve the
    pre-existing evidence row), verified live, regression-tested.
  - PG-041 (S-013 expansion): mechanical, already-proven pattern from
    S-013's own shipped fix; applied to the 5 remaining routes, `tsc`
    clean, shared unit test already covers the helper. Live HTTP-status
    re-verification was blocked by an apparent dev-server-process artifact
    unrelated to this fix (see PG-041's own Closed History entry for the
    full disclosure); not required to close given the identical,
    already-proven pattern.
  - PG-043 (ACC-001/ACC-002): root-caused precisely (Base UI's Input reads
    `aria-required` from the Root's `required` state, never set), fixed at
    the actual root, verified live in the browser for both the Trigger and
    the previously-broken popup Input.
- After this pass: **Active (Decision Required): 8. To Verify: 1. Deferred /
  Accepted For Now: 9. Closed (this session): 3 (PG-039, PG-041, PG-043,
  bringing total Closed History to 37).**
- The zero-active-team-members mechanism (PG-005) remains the single
  most-reconfirmed gap in the project's history (O-018, A-027, C-025,
  E-028, J-011, M-025, V-027, anticipated again as Z-007/Z-009); the
  unreconciled M-025-vs-O-018 discrepancy noted in the first pass is
  carried forward unchanged, still unresolved.
- Ordinary defects (bugs found and fixed through the normal FAILED ->
  FIXED THEN PASS lifecycle) remain intentionally excluded from this
  register: never an ambiguous product question, only a bounded code
  correctness issue, fully documented in their own batch ledgers.
