# Nexus: Product Gap Register

Canonical, current-state source of truth for every confirmed Product Gap this
journey-testing program has ever found, across Batches 1 through 27 plus the
Journey Universe Expansion Audit and the overnight-run reconciliation files.
Batch ledgers (`docs/journey-runs/BATCH_<N>_RESULTS.md`) remain the
evidence/history record of how each gap was found, decided, and verified.
This register answers one question only: **is it still open right now?**

Built via a full audit of Batches 1-27 (2026-09-28), not from memory or
`RUN_STATE.json` summaries alone. See the Journey Execution Protocol's
Product Gap Register and Immediate-Closure Protocol
(`docs/NEXUS_JOURNEY_EXECUTION_PLAN.md`) for the process this file supports.

Status values: `OPEN` / `DECISION REQUIRED` / `DECIDED` (not yet implemented)
/ `FIX IN PROGRESS` / `FIXED` / `ACCEPTED AS-IS` / `SUPERSEDED`. Only `OPEN`,
`DECISION REQUIRED`, `DECIDED`, and `FIX IN PROGRESS` entries stay in the
active section below. Everything else moves to the closed/historical
section, keeping full history without cluttering the active view.

---

## ACTIVE (currently open, decision required, decided-but-not-implemented, or in progress)

### PG-035: Reference Master has no maker-checker / self-approval protection

Status: DECISION REQUIRED

First discovered:
Journey ID: AB-020
Batch: 26

Related journeys: AB-020

Domain: Reference Master (Settings)

Gap:
Every mutating action in `src/features/reference-data/actions.ts` and
`data/reference-master.data.ts` is gated solely by
`requirePermission("reference_master","write")`. There is no approve/
send-back RPC, no checker sign-off, no `SELF_APPROVAL_NOT_ALLOWED`-equivalent
check anywhere in this domain, unlike AB-016/AB-018/AB-019's other governed
domains.

Current behaviour:
Any single holder of `reference_master.write` can create, edit, or
deactivate a reference value with no second person ever reviewing it.

Expected / desired behaviour:
Unresolved. The canonical journey expects maker-checker protection
analogous to other governed domains; current architecture is deliberately
single-permission direct-apply.

Business consequence:
A single actor can silently change reference data (segments, business
units, pricing model options, etc.) that downstream governed workflows
depend on, with no independent review.

Control / security / financial consequence:
Low likelihood, but reference data changes can silently alter behaviour
across every domain that reads it (routing, pricing, tiering).

Product Decision required: YES

Decision question:
Should Reference Master gain maker-checker approval, or should the
canonical expectation be amended to match the current single-permission
direct-apply design?

Decision:
(blank, awaiting Utkarsh)

Implementation required: YES (once decided)

Fix / treatment:
Not started.

Regression protection:
None yet.

Journey rerun required:
AB-020, once decided.

Closed by:
(not yet closed)

Notes:
Logged to Morning Residual Queue. Can retry independently: YES once
decided.

---

### PG-036: Concurrent-approval loser's experience differs by whether the winning approval was final

Status: DECISION REQUIRED

First discovered:
Journey ID: AB-039
Batch: 26

Related journeys: AB-039, AB-043 (discovered mid-run, same mechanism)

Domain: cross-cutting (all four governed approve RPCs share the pattern)

Gap:
Two genuinely distinct, genuinely overlapping approve calls are correctly
serialized at the DB level (exactly one winner, no corruption), but the
losing racer's experience depends on an implementation accident: an early
`if status = 'approved' then return` short-circuit runs ahead of the
node-key mismatch check whenever the winning approval was the request's
FINAL decision, producing a silent, success-shaped, idempotent response
with no error. When the winning approval was NOT final (a mid-graph node),
the loser instead gets an explicit `WORKFLOW_NODE_ALREADY_ADVANCED` error.

Current behaviour:
Loser at a final approval: silent success, indistinguishable from having
approved it themselves. Loser at a non-final node: explicit denial.

Expected / desired behaviour:
The canonical journey expects a friendly "already actioned" message for
the loser in both cases.

Business consequence:
A checker who lost a race at a request's final step has no way to know
someone else already decided it; not a corruption risk (confirmed no
double-approval, no corrupted audit trail in either case).

Control / security / financial consequence:
None found; purely a UX/consistency question.

Product Decision required: YES

Decision question:
Should the final-approval loser also see an explicit "already actioned"
error for consistency, or is the current silent idempotent-success return
the accepted, simpler behaviour, with only the non-final case's explicit
error being the exception?

Decision:
(blank, awaiting Utkarsh)

Implementation required: YES (once decided; a small, bounded RPC change)

Fix / treatment:
Not started.

Regression protection:
None yet.

Journey rerun required:
AB-039, AB-043, once decided.

Closed by:
(not yet closed)

Notes:
Re-confirmed independently across three domains (AB-039/AB-043 at Customer
Change, V-002 at Customer Onboarding, V-003 at a genuine 5-node graph,
V-004 at Commercial Configuration). AB-039 and AB-043 track ONE decision;
do not double-count.

---

### PG-037: Same approver can decide two sequential levels of one workflow request

Status: DECISION REQUIRED

First discovered:
Journey ID: V-028
Batch: 27

Related journeys: V-028

Domain: cross-cutting (all four governed approve RPCs share the pattern)

Gap:
`approve_customer_change_request`'s only identity check compares the actor
to `created_by` (the original submitter). It never checks the request's
own `workflow_node_transitions` history for prior approvers. A user who
approves node 3 as a member of Team A, then is moved to Team B (node 4's
team) before the request reaches node 4, can legitimately approve node 4
too.

Current behaviour:
The same individual can decide two (or more) sequential levels of one
request, provided they hold each node's required team membership at the
moment they act.

Expected / desired behaviour:
Unresolved. Not a self-approval bug by the system's own narrow definition;
a genuine, confirmed segregation-of-duties question the canonical journey
itself anticipated.

Business consequence:
Reduces the independence of a multi-level approval chain when team
membership changes between levels.

Control / security / financial consequence:
A real segregation-of-duties control gap for finance-sensitive multi-level
approvals (Customer Change, Commercial Configuration, Go Live, Onboarding).

Product Decision required: YES

Decision question:
Should Nexus add a cross-node distinct-approver control for multi-level
workflows, or accept single-approver-across-levels given that team
membership is itself admin-governed?

Decision:
(blank, awaiting Utkarsh)

Implementation required: YES (once decided; a small, bounded RPC change:
compare the actor against prior `workflow_node_transitions` rows for the
same request)

Fix / treatment:
Not started.

Regression protection:
None yet.

Journey rerun required:
V-028, once decided.

Closed by:
(not yet closed)

Notes:
Not a duplicate of PG-035/PG-036; distinct mechanism.

---

### PG-038: Legacy ungoverned RPC `create_commercial_change_for_configuration` remains live

Status: DECISION REQUIRED

First discovered:
Journey ID: D-017
Batch: 11

Related journeys: D-017, E-020

Domain: Commercial Configuration / Commercial Change

Gap:
A legacy RPC performs a synchronous, unconditional live mutation (closes
every open component, inserts a `commercial_changes` row) with no draft, no
submit, no approver, no self-approval check, no workflow routing at all.
Grants are correctly restricted to `service_role` only and it is orphaned
in the application layer (no Server Action/page calls it), but it remains
callable at the DB level by anything holding `service_role` credentials.

Current behaviour:
The RPC exists, unused, unwired, unrestricted at the business-logic layer.
If the legacy RPC and a real governed draft both fire against the same
configuration, the governed draft's seeded snapshot can go stale
(reproduced genuinely in E-020: a governed change was left pending while
the legacy path independently closed the same open component with an
earlier effective date).

Expected / desired behaviour:
Unresolved: keep for emergency use, delete outright, or wire it into the
governed workflow.

Business consequence:
A real, reproduced business-data gap (not corruption): an approved
governed change can apply on top of state the drafting analyst never saw.

Control / security / financial consequence:
Bypasses every governance control (draft/review/approve/audit) that the
rest of Commercial Configuration enforces, though only reachable via
`service_role` credentials, not by ordinary application users.

Product Decision required: YES

Decision question:
Keep the legacy RPC for emergency use, delete it outright, or bring it
under governed workflow control?

Decision:
(blank, awaiting Utkarsh)

Implementation required: YES (once decided)

Fix / treatment:
Not started.

Regression protection:
Two `docs/TECH_DEBT.md` entries added (D-017, E-020) during the Batch 12
reconciliation pass.

Journey rerun required:
D-017, E-020, once decided.

Closed by:
(not yet closed)

Notes:
Confirmed genuinely still open through the 2026-09-26 revalidation pass
("the service-layer wrapper is still exported but has no caller").

---

### PG-039: No minimum-rate-row validation for designation-based components

Status: OPEN

First discovered:
Journey ID: E-022
Batch: 12

Related journeys: E-022

Domain: Commercial Configuration

Gap:
No explicit validation rejects a zero-length `rates` array for a
designation-based pricing component. Live-confirmed (not merely inferred):
approving a component with zero designation rate rows succeeded, producing
a real, permanently open, zero-priced component.

Current behaviour:
A component that effectively prices nothing can be submitted and approved.

Expected / desired behaviour:
At least one rate row should be required before submission/approval.

Business consequence:
A live commercial component with no pricing at all.

Control / security / financial consequence:
Revenue-integrity risk if such a component is ever billed against.

Product Decision required: NO (fix direction is unambiguous; only which
layer should own the minimum-one-row check is undecided)

Decision question:
N/A

Decision:
N/A

Implementation required: YES

Fix / treatment:
Not started.

Regression protection:
`docs/TECH_DEBT.md` entry added.

Journey rerun required:
E-022, once fixed.

Closed by:
(not yet closed)

Notes:
Reconfirmed still open (not merely code-read) via a genuine live approval
on a disposable fixture.

---

### PG-040: Deactivated team still allows its still-assigned members to approve, with no warning

Status: OPEN

First discovered:
Journey ID: O-005
Batch: 5

Related journeys: O-005, T-019 (anticipated to resurface as V-036 in a
future batch)

Domain: Teams / workflow routing (cross-cutting)

Gap:
`fn_require_workflow_team_membership` checks only `user_teams.revoked_at`,
never `teams.is_active`. A still-active member of a now-deactivated team
can still approve requests routed to that team's node, with no warning
shown to the approver or to the admin who deactivated the team.

Current behaviour:
Deactivating a team has no effect on its existing members' ability to act
on in-flight requests.

Expected / desired behaviour:
Unresolved. Repeatedly reconfirmed unchanged (O-005 in Batch 5, T-019 in
Batch 25) but never formally decided either way.

Business consequence:
A team marked inactive (e.g. disbanded, reorganized) can still silently
approve real requests via any member who was never explicitly removed.

Control / security / financial consequence:
A real governance inconsistency: "deactivate the team" does not mean "stop
this team from acting," unlike removing an individual member.

Product Decision required: YES (never actually asked; only flagged)

Decision question:
Should deactivating a team block its members from acting on in-flight
approvals, or is member-level removal the only supported lever, with team
deactivation being cosmetic to the routing layer?

Decision:
(blank, awaiting Utkarsh)

Implementation required: Unknown, depends on decision.

Fix / treatment:
Not started.

Regression protection:
None yet.

Journey rerun required:
O-005, T-019, and the anticipated V-036, once decided.

Closed by:
(not yet closed)

Notes:
Distinct from PG-005 (zero-active-members); this is about a team with
members still active but the TEAM itself deactivated.

---

### PG-041: Malformed (non-UUID) request id crashes on five reviewer-adjacent routes not yet fixed

Status: OPEN

First discovered:
Journey ID: S-013
Batch: 23

Related journeys: S-013 (fixed 4 routes); this entry is the remaining,
un-scheduled expansion

Domain: cross-cutting (routing)

Gap:
S-013 fixed the malformed-UUID-crash class on the four reviewer-facing
detail routes. The identical unguarded `.eq("<uuid column>", param)` crash
class was found to exist, but not yet fixed, on: `/forms/customer-onboarding/[requestId]`,
`/commercials/[configId]`, `/commercials/[configId]/versions/[requestId]`,
`/settings/workflows/[definitionId]`, `/settings/workflows/[definitionId]/versions/[versionId]`.

Current behaviour:
A malformed id on any of these five routes reproduces a raw Postgres
`22P02` crash instead of a clean not-found page.

Expected / desired behaviour:
Same `isValidUuid` early-guard pattern already applied to the four fixed
routes.

Business consequence:
A broken/mistyped/bookmarked link crashes instead of showing a normal
not-found page.

Control / security / financial consequence:
Minor information disclosure (a raw stack/error) but no data exposure or
mutation risk.

Product Decision required: NO

Decision question:
N/A

Decision:
N/A

Implementation required: YES (mechanical, same pattern as S-013's fix)

Fix / treatment:
Not started; classified EXPAND EXISTING JOURNEY, placed in a future batch,
not yet scheduled.

Regression protection:
S-013's own 6 tests cover the 4 already-fixed routes; none yet for these 5.

Journey rerun required:
S-013 expansion, once scheduled.

Closed by:
(not yet closed)

Notes:
Low severity, mechanical fix; scheduling only, no real design ambiguity.

---

### PG-042: Timeline may prematurely announce "now Live/approved" during an intermediate workflow advance, in 3 of 4 domains

Status: OPEN

First discovered:
Journey ID: H-020 (Go Live; fixed)
Batch: 15

Related journeys: H-020 (fixed), AA-023 (allocated to verify the other 3
domains, not yet executed)

Domain: cross-cutting (shared `buildWorkflowTransitionEvents`)

Gap:
H-020 found and fixed a real defect in Go Live's Timeline: an intermediate
workflow advance was announced as "line item is now Live." The root cause
(`isFinalEvent` computed as "last transition fetched" rather than "reached
the terminal node") lives in a function shared by all four Workflow
Runtime V1 domains (Customer Onboarding, Customer Change, Commercial
Configuration, Go Live). Only Go Live's own fix and reverification were
performed; Onboarding, Customer Change, and Commercial Configuration
Timelines have never been independently confirmed either way.

Current behaviour:
Unknown for 3 of 4 domains; the underlying function was the same shared
one, so the same premature-terminal-wording risk may or may not still be
live there.

Expected / desired behaviour:
Same fix (an `isRequestFinalized` gate) should apply, if the same bug
exists in those domains.

Business consequence:
A submitted-but-not-yet-final request could misleadingly read as approved/
live in its own history.

Control / security / financial consequence:
UX-only; no data mutation, but could mislead a reader of the audit trail
about when a request truly finalized.

Product Decision required: NO

Decision question:
N/A

Decision:
N/A

Implementation required: Verification needed first; fix only if confirmed
broken (same shared function, so likely a no-op confirmation given H-020's
fix touched the shared function, but not independently reverified per
domain).

Fix / treatment:
Not started.

Regression protection:
H-020's own regression test (`transition-events.test.ts`) covers the
mechanism generally, not per-domain UI wording.

Journey rerun required:
AA-023, once scheduled.

Closed by:
(not yet closed)

Notes:
Genuinely unverified risk, not a settled fact either way.

---

### PG-043: `aria-required` not consistently exposed across required form fields

Status: OPEN

First discovered:
Journey ID: ACC-001
Batch: 8

Related journeys: ACC-001, ACC-002 (bookkeeping-corrected, not itself a
new instance)

Domain: cross-cutting (accessibility)

Gap:
The Customer Onboarding Country field (a Base UI combobox) is visually
marked required but exposes `aria-required="false"`, so a screen-reader
user isn't told it's mandatory from focus alone. Whether this is isolated
or systemic across other required fields (SurveyJS-rendered stages and
Base UI form controls app-wide) was never audited.

Current behaviour:
At least one confirmed field is visually-but-not-programmatically marked
required.

Expected / desired behaviour:
Every required field should expose `aria-required="true"`.

Business consequence:
Accessibility gap for screen-reader users on at least one governed form.

Control / security / financial consequence:
None; pure accessibility.

Product Decision required: NO

Decision question:
N/A

Decision:
N/A

Implementation required: YES (a dedicated accessibility audit across both
SurveyJS and Base UI form controls, broader than one field)

Fix / treatment:
Not started.

Regression protection:
None yet.

Journey rerun required:
A dedicated accessibility pass, not yet scheduled.

Closed by:
(not yet closed)

Notes:
`docs/TECH_DEBT.md` entry exists for this.

---

### PG-044: Duplicate Commercial Component scope silently allowed, no dedup warning

Status: OPEN

First discovered:
Journey ID: D-006 / D-019
Batch: 11

Related journeys: D-006, D-019

Domain: Commercial Configuration

Gap:
Two components with byte-for-byte identical scope, rate, and currency are
both accepted and persisted as independently open rows; no exclusion
constraint, no dedup, no "possible duplicate" warning before approval.

Current behaviour:
Confirms the deliberate no-exclusion-constraint design; flagged as a real
current-product risk area, not filed as a defect.

Expected / desired behaviour:
Unresolved; not yet escalated to a decision.

Business consequence:
A reviewer could approve an accidental duplicate with no system prompt.

Control / security / financial consequence:
Low-likelihood but real risk of double-billing a genuinely duplicated
commercial term.

Product Decision required: Not yet asked, though the underlying question
(should duplicates be warned/blocked) is real.

Decision question:
Should a "possible duplicate scope" warning be shown to a reviewer before
approving a component that duplicates an existing open component's scope?

Decision:
(blank; not yet formally asked)

Implementation required: Unknown, pending scoping.

Fix / treatment:
Not started.

Regression protection:
None yet.

Journey rerun required:
D-006, D-019, if/when scoped.

Closed by:
(not yet closed)

Notes:
Low priority; noted as a risk area in the ledger, not formally escalated.

---

### PG-045: Duplicate designation row names silently allowed within one component

Status: OPEN

First discovered:
Journey ID: G-021
Batch: 14

Related journeys: G-021

Domain: Commercial Configuration (Designation pricing)

Gap:
Two designation rows can share the same display name (e.g. two
"Consultant" rows); rows are keyed by row id, not name, so both
independently contribute to the total.

Current behaviour:
Deterministic, no crash or data loss, but an analyst could mistake adding a
duplicate-named row for editing the existing one, inadvertently doubling a
guarantee.

Expected / desired behaviour:
Unresolved; the batch's own closure explicitly declined to escalate this
as a decision-required item, framing it as "a disclosed minor UX risk."

Business consequence:
Possible accidental doubling of a MUG/designation guarantee.

Control / security / financial consequence:
Low likelihood, real financial-figure risk if it occurs.

Product Decision required: Not formally asked (disclosed only)

Decision question:
Should duplicate designation row names be blocked or warned against?

Decision:
(blank; not yet formally asked)

Implementation required: Unknown, pending scoping.

Fix / treatment:
Not started.

Regression protection:
None yet.

Journey rerun required:
G-021, if/when scoped.

Closed by:
(not yet closed)

Notes:
Low priority.

---

### PG-046: No support/debug surface exposes the raw `pricing_rule_kind` DB value

Status: OPEN

First discovered:
Journey ID: F-020
Batch: 13

Related journeys: F-020

Domain: Commercial Configuration

Gap:
No admin/debug directory exists anywhere in `src/`; every UI surface
renders only the friendly pricing-model label, with no way to map it back
to the raw DB kind value.

Current behaviour:
A support/ops engineer or auditor has no way to see the raw
`pricing_rule_kind` alongside the friendly label.

Expected / desired behaviour:
Unresolved; explicitly not escalated given low (P3) priority.

Business consequence:
Affects investigability only, not correctness.

Control / security / financial consequence:
None.

Product Decision required: NO

Implementation required: YES if ever prioritized.

Fix / treatment:
Not started.

Regression protection:
`docs/TECH_DEBT.md` entry added.

Journey rerun required:
F-020, if/when scoped.

Closed by:
(not yet closed)

Notes:
Very low priority.

---

### PG-047: Team-less Approval node has no UX warning suggestion

Status: OPEN

First discovered:
Journey ID: K-003
Batch: 1

Related journeys: K-003

Domain: Workflow Builder

Gap:
Leaving `team_id` null on an Approval node is valid/deliberate (per the
journey's own Notes), but the Notes field suggests "consider a UX warning
for team-less Approval nodes." Whether this was ever acted on has never
been confirmed one way or the other since Batch 1.

Current behaviour:
No warning shown when publishing a graph with a team-less Approval node.

Expected / desired behaviour:
Unresolved suggestion, never escalated to a decision.

Business consequence:
A workflow admin could unknowingly publish a graph with an unroutable
approval step (though this is separately caught at runtime by the
zero-active-members mechanism, PG-005).

Control / security / financial consequence:
Low; a downstream safety net already exists.

Product Decision required: NO (a dangling suggestion, not escalated)

Implementation required: Unknown.

Fix / treatment:
Not started.

Regression protection:
None.

Journey rerun required:
K-003, if/when scoped.

Closed by:
(not yet closed)

Notes:
Very low priority; oldest unresolved item in this register (Batch 1).

---

### PG-048: `provision_app_user` would surface a raw FK-violation error if ever called from a future non-UI caller

Status: OPEN

First discovered:
Journey ID: T-008
Batch: 24

Related journeys: T-008

Domain: User Access

Gap:
Calling `provision_app_user` directly with a fabricated UUID raises a raw
Postgres FK violation (`app_users_id_fkey`, `23503`) rather than a designed
"not found" response. Harmless today: every reachable UI caller only ever
iterates real Auth rows.

Current behaviour:
No live path can trigger this; purely a future-proofing note.

Expected / desired behaviour:
A friendlier guard, only if a future direct API/integration path calls
this RPC outside the current UI.

Business consequence:
None today.

Control / security / financial consequence:
None today.

Product Decision required: NO

Implementation required: Only if a future direct-API path is added.

Fix / treatment:
Not started; explicitly not filed as Tech Debt since no live path exists.

Regression protection:
None.

Journey rerun required:
T-008, only if a future API path is built.

Closed by:
(not yet closed)

Notes:
Very low priority, future-triggered only.

---

### PG-049: No self-service "my access" view

Status: OPEN

First discovered:
Journey ID: N-026
Batch: 5

Related journeys: N-026

Domain: User Access

Gap:
No route exists for an ordinary user to see their own roles/teams/derived
permissions without asking an admin.

Current behaviour:
Every fact this would show is already correctly derivable and viewable by
an admin on request; only self-service is missing.

Expected / desired behaviour:
A new "self"-scoped route/query.

Business consequence:
Admin-convenience only; no control/security/data-integrity risk.

Control / security / financial consequence:
None.

Product Decision required: NO (deferred by design, disposition D: Safe to
Defer, per the Batches 3-6 Product Gap Triage)

Implementation required: YES, once triggered.

Fix / treatment:
Not started.

Regression protection:
`docs/TECH_DEBT.md` entry added.

Journey rerun required:
N-026, once built.

Closed by:
(not yet closed)

Notes:
Trigger to fix: "a material volume of support tickets... 'why can't I do
X.'"

---

### PG-050: No search/filter on the User Access or Team Master lists

Status: OPEN

First discovered:
Journey ID: N-027
Batch: 5

Related journeys: N-027, O-020

Domain: User Access, Teams

Gap:
Neither list page has a search box or status filter; both always render
every entry (User Access up to its 200-user cap).

Current behaviour:
Confirmed low current impact given today's low user/team count.

Expected / desired behaviour:
A shared `DataTable` component with real sorting/filtering/column-state/
virtualization.

Business consequence:
Admin convenience only, degrading gradually with org size.

Control / security / financial consequence:
None.

Product Decision required: NO (disposition D: Safe to Defer)

Implementation required: YES, once triggered.

Fix / treatment:
Not started.

Regression protection:
`docs/TECH_DEBT.md` entry added (shared for both journey IDs).

Journey rerun required:
N-027, O-020, once built.

Closed by:
(not yet closed)

Notes:
Trigger to fix: the list genuinely becoming hard to scan (a real
multi-page user/team count).

---

### PG-051: No UI surfaces historical audit/timeline data for role grants, team membership, or several Settings areas

Status: OPEN

First discovered:
Journey ID: N-029
Batch: 5

Related journeys: N-029 (role grant/revoke history), O-023 (team
membership history), R-013 (no unified Customer Master Timeline), R-014
(no rendered Timeline for Settings/Team Master/User Access/Workflow
Builder, though real `audit_log` rows exist for all of them)

Domain: cross-cutting

Gap:
The underlying `user_roles`/`user_teams`/`audit_log` data is fully correct,
immutable, and complete in every case; only the viewing surface is
missing, and this same shape has now recurred across four distinct
journeys.

Current behaviour:
No page anywhere lets an admin/auditor view historical grant/revoke
timelines or a unified Customer Master Timeline.

Expected / desired behaviour:
A global audit/history viewer.

Business consequence:
Admin/compliance convenience only; data itself is provably safe.

Control / security / financial consequence:
None; a real compliance/support need to search audit history by actor or
time range would trigger building this.

Product Decision required: NO (disposition D: Safe to Defer)

Implementation required: YES, once triggered.

Fix / treatment:
Not started.

Regression protection:
`docs/TECH_DEBT.md` entry ("no global audit/history viewer exists")
already covers N-029/O-023; should be updated to also cite R-013/R-014.

Journey rerun required:
N-029, O-023, R-013, R-014, once built.

Closed by:
(not yet closed)

Notes:
This is now the most-recurring open gap in the register (4 journeys
across Batches 5, 6, and 23).

---

### PG-052: Invoice Frequency `cadence_months` retroactivity is architecturally unresolved but currently latent

Status: OPEN

First discovered:
Journey ID: P-012
Batch: 6

Related journeys: P-012

Domain: Commercial Configuration (Billing Cadence)

Gap:
`getInvoiceFrequencyCadence` (the function that would resolve
`cadence_months` to a live numeric value) has zero real call sites;
`billing_cadence` is stored/displayed everywhere as an opaque static-labeled
code. Whether a cadence change should be retroactive is unresolved but
moot today.

Current behaviour:
No live code path is affected.

Expected / desired behaviour:
Mirror the `fx_snapshot_rate` precedent (freeze-at-creation) once a real
caller exists.

Business consequence:
None today.

Control / security / financial consequence:
None today; would matter the moment a real caller is added without the
freeze mechanism.

Product Decision required: NO, not urgently (disposition D: Safe to
Defer)

Implementation required: Only once a real call site is added.

Fix / treatment:
Not started.

Regression protection:
`docs/TECH_DEBT.md` entry added, with a suggested regression test that
fails loudly if `getInvoiceFrequencyCadence` ever gains a real call site
without a corresponding freeze mechanism.

Journey rerun required:
P-012, once triggered.

Closed by:
(not yet closed)

Notes:
Very low priority; genuinely latent, not live.

---

### PG-053: Former-name search result label may show the most-recent, not most-specific, historical match

Status: OPEN

First discovered:
Journey ID: B-007
Batch: 8

Related journeys: B-007

Domain: Customer Master

Gap:
`searchFormerCustomerNames`'s dedup logic keeps only the first row per
customer in most-recent-first order. When a customer's historical names
share overlapping substrings, the displayed "Former legal name: X" label
can show the most-recently-changed matching value rather than the one most
specifically matching the search term. The customer is always found
correctly; only the specific label shown can differ.

Current behaviour:
Confirmed reproducible; the customer is never lost, only the displayed
label can be an equally-real but non-most-specific historical name.

Expected / desired behaviour:
Unresolved; requires a small design choice (best-matching label, or show
all matching labels, rather than always most-recent).

Business consequence:
Minor label-accuracy issue, no functional impact.

Control / security / financial consequence:
None.

Product Decision required: Implicitly yes, if ever addressed; not
formally asked.

Implementation required: Small, once decided.

Fix / treatment:
Not started.

Regression protection:
`docs/TECH_DEBT.md` entry added.

Journey rerun required:
B-007, if/when scoped.

Closed by:
(not yet closed)

Notes:
Very low priority.

---

### PG-054: Customer Master search and Approvals/Operational Queue lists have no server-side pagination

Status: OPEN

First discovered:
Journey ID: S-001 / S-010
Batch: 23

Related journeys: S-001, S-010

Domain: Customer Master, Approvals

Gap:
`listCustomers()` fetches every row unconditionally and filters in memory;
`ApprovalInboxTable` has no pagination/virtualization. Correct and
non-defective at current scale (26 customers, dozens of items).

Current behaviour:
Works correctly today; would degrade at materially larger scale.

Expected / desired behaviour:
SQL-level pushdown search and real pagination, once volume warrants it.

Business consequence:
None today.

Control / security / financial consequence:
None.

Product Decision required: NO

Implementation required: Only once real scale is reached.

Fix / treatment:
Not started; deliberate "Scale-ready, not scale-heavy" design per module
header comment.

Regression protection:
None yet.

Journey rerun required:
S-001, S-010, once triggered.

Closed by:
(not yet closed)

Notes:
Classified FUTURE MODULE; not urgent.

---

### PG-055: Go Live not extended to the full Business Unit / Territory / Customer scoped-authorization model

Status: OPEN

First discovered:
Journey ID: D-022 / PD-005 follow-up
Batch: 11 (PD-005 decided/implemented for 5 other domains)

Related journeys: D-022

Domain: Go Live

Gap:
PD-005's four-tier scoped authorization model was implemented for Customer
Onboarding, Customer Change, Commercial Change, Customer Master, and the
shared Approvals/My Work composer. Go Live specifically was left with only
its original coarse permission (the one confirmed information-disclosure
issue found there was separately fixed using the existing PD-005
mechanism), but full per-tier scoping for Go Live itself was never built.

Current behaviour:
Go Live authorization remains coarse-grained relative to its five sibling
domains.

Expected / desired behaviour:
Extend the same four-tier model to Go Live, once needed.

Business consequence:
Inconsistent authorization granularity across domains; no known live
disclosure risk remaining (that specific issue was fixed).

Control / security / financial consequence:
Low today; tracked explicitly as deliberate deferred debt, not an
oversight.

Product Decision required: NO (already implicitly decided as
FUTURE MODULE via PD-005's own scoping)

Implementation required: YES, once triggered.

Fix / treatment:
Not started.

Regression protection:
`docs/TECH_DEBT.md` entry exists.

Journey rerun required:
A future Go Live scoped-authorization journey, once built.

Closed by:
(not yet closed)

Notes:
Distinct from PG-008 (the core PD-005 decision itself, which IS closed).

---

## CLOSED / HISTORICAL (fixed, decided-and-accepted, or superseded: kept for traceability, not active)

Full evidence for every entry below lives in its originating batch ledger;
only a compact summary is kept here.

| ID | Journey(s) | Batch | What it was | Resolution | Evidence |
|---|---|---|---|---|---|
| PG-001 | N-030 | 5 | `grant_user_role` permitted granting a deactivated role | FIXED | commit `acfc5ba` |
| PG-002 | O-011 | 5 | `assign_user_to_team` silently no-op'd on primary-promotion | FIXED | commit `39c6c05` |
| PG-003 | P-013 | 6 | Reference Master Level 3 tiering not server-enforced | FIXED | commit `186b66d` |
| PG-004 | N-031 | 5 | `usage.read`/`entitlement_settlement.read` seeded but unenforced | DECIDED (wire up as real gates) + FIXED | commit `444226a` |
| PG-005 | O-018, A-027, C-025, E-028, J-011, M-025, V-027 | 6 (decision), recurring 8/9/13/19/21/27 | Zero-active-team-members strands every request at that node indefinitely | DECIDED ("warn but allow") + FIXED | commit `1075ecb`, Operations Queue banner + `checkTeamRemovalImpactAction`. **Verification note:** M-025 (Batch 21) states "no proactive flag anywhere in My Work or the Operational Queue," apparently in tension with this fix's own Operations Queue banner. Not reconciled in this pass; verify against current source before citing as fully closed if this resurfaces again (anticipated as Z-007, Z-009). |
| PG-006 | B-011 / PD-003 | 9 | Commercial Version creation not blocked for inactive customer | DECIDED (block) + FIXED | migration `20260930090000` + UX fix |
| PG-007 | C-030 / PD-004 | 10 | `approve_customer_change_request` has no `is_active` check | DECIDED (accept current behaviour, no code change) | regression test added |
| PG-008 | D-022 / PD-005 | 11 | No per-customer/territory data isolation in permission model | DECIDED (build 4-tier scoping) + FIXED for 5 domains + go-live info-disclosure follow-up fixed | migration `20260930110000`; admin scope-picker UI still not built (see PG-055 for Go Live's own residual) |
| PG-009 | E-015 / PD-006 | 12 | `correction` category not exempt from effective-date ordering; later, retroactive component start-date | DECIDED (exempt + allow retroactive start) + FIXED across 4 phases | migrations `20260930100000`, `20260930150000`, `20260930160000` |
| PG-010 | A-036 / PD-001 | 7 | Any onboarding-create holder could read another maker's in-progress draft | DECIDED (creator-only read) + FIXED | same-day 2026-09-21 |
| PG-011 | A-034 / PD-002 | 8 | No sanity boundary on Commercial Configuration effective_date | DECIDED (BU Head + Finance Head dual-approval exception) + FIXED | migrations `20260930120000`, `20260930140000` (atomicity fix) |
| PG-012 | I-015 | 17 | Ledger never recomputed after Entitlement Source cancellation | DECIDED + FIXED (2 phases) | migrations `20261002000000`, `20261004000000` |
| PG-013 | I-024 | 17 | No mechanism to reverse/adjust a recorded settlement | DECIDED (additive reversal) + FIXED | migration `20261002010000`, new `reverse_settlement` RPC |
| PG-014 | I-034 | 19 | Duplicate invoice reference on Entitlement Source creation | DECIDED (block, per-customer scope) + FIXED | migration `20261006000000` |
| PG-015 | I-035 | 19 | Metric mismatch between Entitlement Source and component's billed metric | DECIDED (must match) + FIXED | same migration as PG-014 |
| PG-016 | (measurement_definitions vs pricingUnit) | 19-20 | Unused parallel data path alongside the real mechanism | DECIDED (pricingUnit stays canonical; measurement_definitions future-only) | documented in `docs/GO_LIVE_ENTITLEMENT_ARCHITECTURE.md` §7.2 |
| PG-017 | M-011 | 20 | Self-created item shown as "Pending My Approval" with no warning | DECIDED + FIXED | `buildMyWorkItems` logic change |
| PG-018 | M-021 | 21 | `canApprove` cross-domain OR-imprecision could leak a coincidental-team-match item | Reclassified from open decision to bounded defect and FIXED | per-item-type permission map |
| PG-019 | T-015, T-016 / PD-009 | 24 | `team.write` holder structurally could not reach any UI to manage team membership | DECIDED + FIXED | new Team Membership section on `/settings/teams` |
| PG-020 | T-025 / PD-010 | 25 | Duplicate team display names indistinguishable in assignment picker | DECIDED (keep duplicates, disambiguate picker with team code) + FIXED | label format change, 2 files |
| PG-021 | R-012 / PD-007 | 22 | Customer name Timeline resolution: live vs. frozen snapshot | DECIDED (keep live resolution, no snapshot) | documented in `docs/CUSTOMER_LIFECYCLE.md` §19b, no code change |
| PG-022 | S-014 / PD-008 | 23 | 404 (nonexistent id) vs. 200 access-restricted (no permission) observably distinguishable | DECIDED (make indistinguishable) + FIXED | new `RequestUnavailable` component, 4 routes |
| PG-023 | D-003, D-004, D-015, D-021 | 11 | No deactivate/reactivate lifecycle for Commercial Configuration | DECIDED (will not build; customer-lifecycle is the correct path) | ACCEPTED AS-IS, journey text rewritten |
| PG-024 | P-021 | 7 | No UI for reference-data audit/actor history | DECIDED (build a per-value Activity drawer) + FIXED | new Activity Sheet, 12 tests |
| PG-025 | G-001, G-002, G-003, F-014 | 14, 13 | No Pricing Kernel (usage-to-bill engine) exists yet | ACCEPTED AS-IS / FUTURE MODULE | documented in `docs/COMMERCIAL_FOUNDATION_MIGRATION_DESIGN.md` |
| PG-026 | G-007 | 14 | `commercial_commitments kind='spend'` has no onboarding UI | ACCEPTED AS-IS / FUTURE MODULE | RPC comment documents deliberate deferral |
| PG-027 | I-003, I-004 | 16 | No way to create an API- or Import-sourced Entitlement Source | DECIDED (manual-only for now) | tracked in `docs/TECH_DEBT.md` "Later" |
| PG-028 | N-007 | 4 | No last-admin protection on self-deactivation | ACCEPTED AS-IS (documented, intentional) | journey's own text |
| PG-029 | N-013 | 4 | Self-grant of an elevated role via `user_access.write` | ACCEPTED AS-IS (documented, intentional) | `docs/AUTHORIZATION_MODEL.md` §18 |
| PG-030 | I-016 | 17 | `cancel_entitlement_source` has no creator/self-action guard | ACCEPTED AS-IS (consistent with domain precedent) | journey's own text |
| PG-031 | S-019, S-020, S-021, S-022 | 24 | No cross-domain "Forms Hub" aggregate views | ACCEPTED AS-IS / FUTURE MODULE | Forms Hub backlog |
| PG-032 | Q-013, Q-014 | 22 | Customer Change / Commercial Configuration have zero attachment support | ACCEPTED AS-IS / FUTURE MODULE (pre-existing, documented) | journeys' own Notes |
| PG-033 | T-020, T-021, T-022 | 25 | Team Master: no edit, no hard-delete (safety feature), no team-lead concept | ACCEPTED AS-IS | journeys' own text, cross-referenced R-008 |
| PG-034 | H-039, I-006 | 16, 17 | Defense-in-depth checks missing on two service-role-only surfaces, not currently exploitable | ACCEPTED AS-IS (hardening debt) | `docs/TECH_DEBT.md` entries |

---

## Reconciliation notes from this audit (2026-09-28)

- This audit found **55 distinct Product Gap mechanisms** across Batches
  1-27: 24 CLOSED/FIXED, 10 ACCEPTED AS-IS/FUTURE MODULE (settled, no
  further action), and 21 CURRENTLY OPEN (4 of which are DECISION
  REQUIRED, the rest low-priority backlog items already understood but
  never formally decided or scheduled).
- The zero-active-team-members mechanism (PG-005) is the single
  most-reconfirmed gap in the project's history: A-027 (Batch 8), C-025
  (Batch 9), O-018 (Batch 6, the decision), E-028 (Batch 13), J-011 (Batch
  19), M-025 (Batch 21), V-027 (Batch 27), anticipated again as Z-007/Z-009.
  One entry, all journeys linked, not duplicated.
- AB-039 and AB-043 (Batch 26) are one Product Decision, not two; V-027
  and O-018 are one closed decision, not two, per the explicit
  instruction not to create duplicate entries for the same underlying
  gap.
- A genuine unresolved discrepancy was found and flagged rather than
  silently resolved one way or the other: M-025's own text (Batch 21)
  says no proactive "nobody can act" flag exists in My Work or the
  Operational Queue, which appears to conflict with O-018's own fix
  (an Operations Queue "no eligible approver" banner). This is noted
  under PG-005 rather than assumed away.
- Ordinary defects (bugs found and fixed through the normal FAILED ->
  FIXED THEN PASS lifecycle) are intentionally excluded from this
  register: they were never an ambiguous product question, only a
  bounded code correctness issue, and remain fully documented in their
  own batch ledgers.
