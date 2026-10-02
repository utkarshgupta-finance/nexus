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

None currently open. PG-063 (found 2026-09-30 during Batch 31's AA-006),
PG-064 (found 2026-09-30 during Batch 32's AA-015), and PG-065 (found
2026-10-01 during Batch 32's Y-001/Y-012) were all decided and closed the
same day under the Immediate-Closure Protocol; see **D. CLOSED HISTORY**
below for their decision, implementation, and verification evidence.

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

### DF-00X (PG-066): Commercial Version review decision fails silently on the client when the server rejects it

First discovered: Batch 32's Y-002 (found 2026-10-01), incidentally while
building a scale fixture, not the subject of a dedicated journey.
Domain: Commercial Configuration (`/reviews/commercial-versions/[id]`).

Confirmed behaviour: clicking "Approve & Activate" on a Commercial Version
review page, when the server-side action genuinely rejects the decision
(confirmed reproduced with a real validation failure: an effective date
that conflicts with an existing component's own start date), returns
`{ok: false, error: "..."}` with a clear, well-written message, but the
client does not surface that message anywhere. No toast, no inline error,
no visual change at all; the page simply looks exactly as it did before
the click. The request correctly remains in `Submitted` status (no
approval is silently granted and no data is corrupted), but the human
checker has no way to tell, from the UI alone, that their decision did
nothing or why.

Why deferred, not actively fixed now: this is a UX polish gap (missing
error surface), not a correctness, data-safety, or security gap; nothing
is silently approved or lost. Fixing it properly means adding a shared
toast/inline-error layer to every review-decision server action across
all four domains (Onboarding, Customer Change, Commercial Configuration,
Go Live), which is a cross-cutting change larger than a one-line fix, and
this was discovered as a side effect of Y-002's fixture-building, not
something a dedicated journey was testing for in this batch.

Current behaviour accepted meanwhile: a checker who gets no visible
feedback after clicking Approve/Reject will likely retry or check the
request's status elsewhere (Approvals list, Timeline), which does
correctly show it is still `Submitted`; this is an inconvenience, not a
silent-corruption risk.

Trigger to reopen: a dedicated journey or user report describing real
confusion from this silent failure, or when the review-decision UI is
next touched for any other reason (natural point to add the error-surface
layer in the same change).

---

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

### DF-010: No duplicate/near-duplicate customer name warning on creation
Journey: Z-015, Batch 30
Reason for deferral: the canonical journey's own Expected Business Result
frames this as worth flagging for product consideration, not a decided
requirement; `customers.name` has no uniqueness constraint (only the
generated `key` slug is unique), so two customers with an identical or
near-identical legal name remain fully distinct rows with zero forced-merge
or data-corruption risk. Live-verified: entering an exact-match legal name
of a real existing customer on a fresh onboarding draft produced no inline
warning, soft-block, or any other signal.
Accepted meanwhile: yes, no data-integrity or security impact.
Trigger to reopen: a real data-quality incident from genuinely confused
duplicate customer records, or a broader Customer Onboarding UX pass.

### DF-011 (PG-060): No UI surfaces a superseded (non-current) Customer Onboarding or Go Live document version
Journey: X-008, Batch 31
Reason for deferral: same shape as DF-006 (PG-051) — the underlying data is
fully correct and immutable, only the viewing surface is missing.
`customer_onboarding_documents`/`go_live_documents` both freeze prior
versions via `is_current = false` rather than deleting them (see also
`docs/journey-runs/TEST_DATA_INCIDENTS.md` INC-001 for the Go Live side of
this same characteristic). On the Onboarding side specifically, the data
layer even already has a ready-built, unit-tested reader for this exact case
— `listDocumentsForRevision` (`src/features/customer-onboarding/data/documents.data.ts:104-118`),
re-exported as `listOnboardingDocumentsForRevision`
(`services/documents.service.ts:126-129`, `server.ts:40`) — but it has zero
callers: no page, Server Action, or route ever invokes it. The only document
readers actually wired to a page (`listCurrentDocumentsForRequest`,
`documents.data.ts:76-86`) filter `is_current = true` unconditionally, same
as Go Live's `listDocumentsForGoLiveRequest`. Live-verified (X-008): no
"document history" or "previous revision" UI exists anywhere for either
domain.
Accepted meanwhile: yes, matching DF-006's precedent; no data-integrity risk
(nothing is lost, only unsurfaced) and no caller currently depends on
retrieving a superseded document.
Trigger to reopen: a real compliance/audit need to review a prior document
revision (e.g. disputing what was actually uploaded before a send-back), or
wiring `listOnboardingDocumentsForRevision` into a real route as part of a
broader document-history UX pass alongside DF-006.

### DF-012 (PG-061): No cross-customer report/export surface exists
Journey: X-015, Batch 31
Reason for deferral: same shape as PG-025 (no Pricing Kernel) and PG-026 (no
onboarding UI for spend commitments) — a genuinely unbuilt V1 module, not a
defect. Confirmed via source: no CSV export, no "reports" page, and no
cross-customer aggregate/tabular view exists anywhere in the app beyond the
plain Customer Master list (`src/app/customers/page.tsx`) and the paginated
JSON integration API (`src/app/api/v1/customers/route.ts`, JSON only, no
aggregation). The canonical journey's premise (verify a legacy mixed-schema
aggregate view handles heterogeneous customer data correctly) has no real
surface to exercise.
Accepted meanwhile: yes; reporting/export was never in this program's built
scope.
Trigger to reopen: a real reporting/export module gets built, at which point
re-run this journey against the real surface for legacy-schema handling.

### DF-013: Onboarding has no genuine reject/terminal state for a submitted case a reviewer will never approve
Journey: AA-008, Batch 31 (re-confirms A-020's own already-documented design
constraint, not a new discovery)
Reason for deferral: `cancelOnboardingCase` is explicitly draft-only by
design ("only a draft may be discarded", `case.service.ts:221`), confirmed
server-side; a submitted/sent-back/resubmitted case has no cancel, reject,
or admin-override control anywhere in the UI (confirmed live: a real
resubmitted case, `CO-000102`, status "Submitted", revision 2, shows only
"View Request", no cancel affordance). The only two ways out of that state
are eventual approval or perpetual send-back/resubmit cycling. A-020's own
canonical text already flags this as "a deliberate design constraint worth
flagging."
Accepted meanwhile: yes, with a partial mitigation already in place: a
stuck/pending case is not invisible, it correctly surfaces on the
Operational Queue (confirmed live, `CO-000102` appears there) for admin
attention, satisfying the canonical's minimum UX bar ("stuck cases are
visible/reportable to admins for manual attention").
Trigger to reopen: if the business wants a genuine forced-terminal/reject
path for onboarding (matching Customer Change's own reject state), this
would need a dedicated remediation workflow (admin override or an explicit
reject action), which is a real product decision, not a bounded bug fix.

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
| PG-035 | AB-020 | 26 | Reference Master has no maker-checker / self-approval protection | DECIDED (2026-09-28: accept as-is, single-permission direct-apply; no maker-checker built) | `docs/AUTHORIZATION_MODEL.md` section 26; AB-020's canonical text rewritten to test the real invariant. No code change. |
| PG-036 | AB-039, AB-043 | 26 | Concurrent-approval loser's experience differed by whether the winning approval was final | DECIDED (2026-09-28: explicit error for consistency, idempotent replay preserved for the same actor) + FIXED | migration `20261015000000_approve_rpcs_already_decided_and_segregation_of_duties.sql`; all four approve RPCs' `status = 'approved'` short-circuit now compares actor identity (`decided_by`/`approved_by`) before returning silently; new token `WORKFLOW_REQUEST_ALREADY_DECIDED` added to all four client error-mapping files with parser tests. Verified live against real historical data (`customer_change_requests` row `c6ed40bb-...`): same-actor replay returned silently, different-actor call rejected with the new token. `docs/AUTHORIZATION_MODEL.md` section 28; AB-039/AB-043 rewritten. |
| PG-037 | V-028 | 27 | Same approver could decide two sequential levels of one workflow request | DECIDED (2026-09-28: cross-node distinct-approver control, scoped across all cycles for the resource, narrowed to node-level same day after a regression check) + FIXED | same migration as PG-036; each approve RPC checks `workflow_node_transitions` for a prior `approve` row by the same actor at a DIFFERENT node than the one currently being decided (any cycle), raising `WORKFLOW_SEGREGATION_OF_DUTIES_VIOLATION`. Regression correction (migration `20261016000000_pg037_scope_to_node_level_pg040_runtime_routing_guard.sql`): the first version compared only actor and resource, which would have wrongly blocked a legitimate same-node reapproval after send-back/resubmission; narrowed to compare `from_node_key`. Verified live: cross-node block re-confirmed against real data (`customer_change_requests` row `c579a77c-...`) after narrowing; same-node reapproval-after-resubmission confirmed allowed via real historical data (`1ba55311-...`, a genuine two-cycle same-node reapproval that predates this control) where a direct predicate check showed the old check would have wrongly blocked it and the new check correctly allows it. `docs/AUTHORIZATION_MODEL.md` section 28; V-028 rewritten. |
| PG-038 | D-017, E-020 | 11, 12 | Legacy ungoverned RPC `create_commercial_change_for_configuration` remained live | DECIDED (2026-09-28: delete outright) + FIXED | migration `20261013000000_drop_legacy_create_commercial_change_for_configuration.sql`; removed all application-layer references (`configuration.data.ts`, `configuration.service.ts`, `server.ts` doc comments). Verified: `select count(*) from pg_proc where proname = 'create_commercial_change_for_configuration'` returns 0. `tsc` clean, full suite passing. D-017/E-020 rewritten. |
| PG-040 | O-005, T-019 | 5, 24 | Deactivated team still allowed its still-assigned members to approve, with no warning | DECIDED (2026-09-28, custom spec: block new assignments, keep existing in-flight work actionable, warn on the Operational Queue AND each review page, member-level removal still blocks immediately) + FIXED, corrected same day after a runtime-routing gap was found | migration `20261014000000_workflow_node_team_must_be_active.sql` adds `WORKFLOW_TEAM_INACTIVE` to both `save_workflow_version_graph` and `publish_workflow_definition_version` (authoring-time guard only). Regression found same day: this alone did not stop an ALREADY-PUBLISHED, in-flight request from being newly routed forward into a node whose team had since gone inactive. Fixed via migration `20261016000000_pg037_scope_to_node_level_pg040_runtime_routing_guard.sql`: all four approve RPCs now check the next node's team status (via `fn_resolve_workflow_next_approval`'s own `team_id`) before advancing, raising `WORKFLOW_TEAM_INACTIVE` before any mutation. `fn_require_workflow_team_membership` deliberately left unchanged (existing in-flight work stays actionable by eligible members regardless of team status). New `OperationalQueueEntry.isResponsibleTeamInactive` field renders a muted "Team inactive" badge in `operational-queue-table.tsx`; a new shared `ResponsibleTeamInactiveBanner` component renders the same warning on all four individual review pages (onboarding, change request, commercial version, go-live), via a new `getCurrentNodeResponsibleTeamStatus` helper. Verified live: authoring-time guard (save binding a node to inactive `West Region Finance` rejected, active team succeeded); runtime-routing guard (a real in-flight Go Live request's next-node team temporarily deactivated, approval rejected with zero mutation, team restored); existing-work-stays-actionable (a second real in-flight Go Live request's current-node team temporarily deactivated, an eligible member still approved and finalized it normally, team restored). `docs/AUTHORIZATION_MODEL.md` section 27; O-005/T-019 rewritten. |
| PG-044 | D-006, D-019 | 11 | Duplicate Commercial Component scope silently allowed, no dedup warning | DECIDED (2026-09-28: warn, don't block; legitimate duplicate scopes can exist) + FIXED | new `commercial-duplicate-scope.ts` (`findDuplicateScopeMatches`), warning banner added to `commercial-version-review-page.tsx` before both the diff-view and plain-table-fallback render paths. 6 new unit tests passing. D-019's canonical text rewritten; D-006 cross-referenced. |
| PG-045 | G-021 | 14 | Duplicate designation row names silently allowed within one component | DECIDED (2026-09-28: block outright; no plausible legitimate reason for duplicate names) + FIXED | `validateDesignationRowIssues` now rejects case/whitespace-insensitive duplicate names (severity `invalid`). Migration `20261012000000_fix_designation_rate_names_must_be_unique.sql` adds `fn_designation_rates_have_unique_names` as a defense-in-depth DB constraint (`NOT VALID`, preserving the pre-existing evidence row). Verified live: the DB function rejects a duplicate pair and accepts distinct names; an UPDATE against the pre-existing evidence row is correctly rejected. New unit test in `commercial-rate.test.ts`. G-021 rewritten. |
| PG-053 | B-007 | 8 | Former-name search result label may show the most-recent, not most-specific, historical match | DECIDED (2026-09-28: show the best-matching historical name, not always-most-recent) + FIXED | `searchFormerCustomerNames` rewritten with a new `matchSpecificity` helper (`change-request.service.ts`); dedup now keeps the most-specific match per customer instead of the most-recent. New test file `change-request.service.test.ts`, 5 tests passing. B-007's canonical text updated with a Notes line. |
| PG-056 | O-005, T-019 | (found via post-fix Journey Discovery, same day as PG-040) | `WORKFLOW_TEAM_INACTIVE` token unmapped in all four approve-RPC client error parsers, falling through to a generic "unexpected error" message | CONFIRMED (no product decision needed, unambiguous completeness gap) + FIXED (2026-09-28, closed same day under the Immediate-Closure Protocol) | Added `WORKFLOW_TEAM_INACTIVE` to `NAMED_TOKEN_KINDS` and its `*ErrorKind` union in all four client error parsers (`case-errors.ts`, `change-errors.ts`, `commercial-version-errors.ts`, `go-live-errors.ts`). A new shared `WORKFLOW_TEAM_INACTIVE` code and standardized message added to `src/platform/errors/domain/codes.ts` ("this request cannot move to the next approval step because that step's responsible team is inactive. Ask a Workflow Admin to update or reactivate the team."), used identically across all four domains rather than the RPC's own per-node detail (which would otherwise leak the raw node key and vary in wording by domain). Server-side PG-040 invariant and already-assigned-team behavior both explicitly unchanged; this is a client-parser-only fix. 4 new parser regression tests (one per domain), all passing. Verified live: reproduced the exact PG-040 runtime-routing rejection against a real in-flight Go Live request (`859d7124-...`, team temporarily deactivated then restored), captured the genuine raw RPC error text, and fed it through the real `parseGoLiveError` function, confirming it now maps to the standardized message with no leaked node key. Journey Discovery re-run after this fix found zero new candidates. O-005's canonical text updated with the message-surfacing detail. |
| PG-057 | V-033 | 28 | Go Live review page labeled "Commercial Context (Locked)" always showed the customer's CURRENT commercial terms, silently tracking whatever version was active at view/approval time instead of the version the request was actually created against; no warning if the two diverged | DECIDED (2026-09-29: truly lock to the creation-time Commercial Version; block approval and require an explicit refresh if superseded, rather than silently tracking current terms) + FIXED | Migration `20261017000000_pg057_go_live_locks_referenced_commercial_version.sql`: `approve_go_live_request` now raises `GO_LIVE_COMMERCIAL_VERSION_SUPERSEDED` if the referenced version's component has been closed by a later one; new governed `refresh_go_live_request_commercial_version` RPC (creator-only) rebinds to the current version, preserving the old reference on new columns `previous_commercial_version_id`/`commercial_version_refreshed_by`/`commercial_version_refreshed_at`. New pure resolver `src/features/go-live/domain/referenced-version.ts` (unit tested, 4 tests) drives both the review page's locked display and its warning banner; `go-live-detail-page.tsx` now shows the referenced version's own terms (not current), a visible warning + "Refresh to Current Commercial Version" control when superseded, and disables Approve until refreshed. Full suite (1092 tests) and tsc pass. Verified live end-to-end: a request referencing V1 was blocked once V2 superseded it (confirmed via direct RPC and the real review page, which showed "Version 6" locked with a "Version 7 is now active" warning and a disabled Approve button); the creator's real "Refresh" click in the browser rebound it to V2 (confirmed in both the UI and the DB, with V1 preserved as `previous_commercial_version_id`), after which approval proceeded normally; a separate fresh Go Live request created directly against the current version approved with no false block. V-033's canonical text updated with the decided behavior. |
| PG-058 | V-038 | 28 | Customer Master's Activity view and its History tab's Field History table ("Approved By") live-resolved the actor's CURRENT display name for every historical entry, identically to every other Timeline, despite being the one surface expected to be a frozen, point-in-time audit trail; `audit_log`'s own `actor_display_name_snapshot`/`actor_email_snapshot` columns already existed but were never read by this view | DECIDED (2026-09-29: freeze Customer Master Activity/History to the actor's point-in-time identity, sourced from `audit_log`'s existing snapshot columns; keep ordinary Timelines live-resolving, unchanged) + FIXED | `src/features/customers/domain/activity.ts`: new `buildAuditIndex`/`historicalActorLabel` (exact-match correlation on table/row id/actor id/timestamp, reliable because both the domain row's own lifecycle timestamp and `audit_log.occurred_at` are set by the identical `now()` inside the same transaction), used by `fieldChangeEvents`/`changeRequestEvents`/`commercialVersionEvents`/`onboardingOriginEvent` (the four Activity-tab builders that were live-resolving; `statusChangeEvents` already correctly used the snapshot via the pre-existing `auditRowActorLabel`). New `listAuditLogForRows` batch fetch (`src/platform/audit/data/audit-log.data.ts`) avoids an N-query fan-out. New `resolveFieldHistoryActorLabels` (`src/features/customers/server/activity.ts`) gives the separate History-tab Field History table the same point-in-time resolution, now keyed by field history entry id rather than actor id (a label keyed only by actor id could not represent the same actor's identity correctly at two different points in time). 8 new unit tests, full suite (1098 tests) and tsc pass. Verified live end-to-end: renamed a real actor (`nexus-test-legal`) with real historical approvals on a real customer; the ordinary Change Request Timeline correctly showed the new, renamed name (unchanged behavior); the same customer's Activity tab and History tab's Field History "Approved By" column both continued showing the original, pre-rename name for every one of that actor's historical entries. V-038's canonical text updated with the decided behavior; renamed test persona restored afterward. |
| PG-059 | Z-001 | 29 | An expired/revoked session (`AuthGate`'s `unauthenticated` state) redirected to the exact same generic "Sign in to continue." login form a brand-new, never-authenticated visitor sees, with no messaging distinguishing "your session expired" from an ordinary first-time login; distinct from `AuthGate`'s existing separate "Session unavailable" (backend-unreachable) message, for which no equivalent existed | DECIDED (2026-09-29: redirect to `/login?reason=session-expired` and show a persistent login-page banner; carry the reason through the existing redirect rather than adding a new client-side session watcher; preserve the existing `redirectTo` return-navigation pattern) + FIXED | New `hasSupabaseAuthCookie` (`src/lib/supabase/server-auth-client.ts`) detects a stale `sb-*-auth-token` cookie still present after `getUser()` resolves to no user, distinguishing "was authenticated, now expired" from "never authenticated" without any new client-side detection. `NexusSession`'s `unauthenticated` variant gained an optional `expired` flag (`src/platform/auth/domain/types.ts`); `getCurrentNexusSession` (`src/platform/auth/server.ts`) sets it. `AuthGate` (`src/components/product/auth-gate.tsx`) appends `&reason=session-expired` to its existing `/login` redirect only when `expired` is set. `/login`'s route (`src/app/login/page.tsx`) reads the `reason` param and passes `sessionExpired` to `LoginPage` (`src/features/auth/ui/login-page.tsx`), which renders a `warning`-styled banner ("Your session expired. Please sign in again to continue.") reusing the existing design token, distinct from the destructive-styled sign-in error message. The existing `unavailable`/`inactive`/permission-denied states and the existing `redirectTo` return-navigation mechanism were untouched. 12 new unit tests (`hasSupabaseAuthCookie` cookie-name matching, `getCurrentNexusSession`'s expired branch, `AuthGate`'s two redirect variants plus its unaffected `unavailable`/`inactive` branches, `LoginPage`'s banner rendering); full suite (1110 tests) and tsc pass. Verified live end-to-end: revoked a real fictional persona's `auth.sessions` row mid-edit, attempted a real Save Draft, confirmed the redirect carried `reason=session-expired` and a hard-navigated login page showed the banner (screenshot captured); confirmed the draft's `row_version` and content were unchanged (no partial/corrupted write, no silent success); confirmed a plain `/login` visit (no `reason` param) shows no banner; confirmed re-authenticating from the expired-session redirect correctly returned to the original draft URL with its true, unsaved-edit-lost state, not a false "success" and not an auto-replayed mutation. Unsaved client-side form state is genuinely lost across the redirect (expected and disclosed, not hidden behind the messaging fix, per the canonical's own "ideally preserved" hedge). |
| PG-062 | AA-002 (found while opening a Customer Change draft) | 31 | `approve_customer_onboarding_case`'s `customers` insert silently dropped `segment`, `business_unit`, `country`, and `industry` for every newly-onboarded customer, even though the onboarding form always collects them and Customer Change's governed-field registry treats all 4 as real, editable Customer Master columns; migration `20260913063000` had originally mapped these correctly from the submitted revision, but a later redefinition (`20261009000000`, carried forward through `20261015000000`/`20261016000000`) switched every other field to read from a new `p_customer_fields` parameter and never carried these 4 over, leaving them permanently `null` | CONFIRMED (regression, not a data-entry issue; root-caused via direct source diff across migration history, not guesswork) + FIXED | Root cause was two-layered: (1) `src/features/customer-onboarding/domain/onboarding-customer-field-mapping.ts`'s `extractGovernedCustomerFieldsFromOnboarding` never read `segment`/`business_unit`/`country`/`industry_category` off the submitted onboarding values into the `p_customer_fields` object it builds (despite its own doc comment asserting field-key parity with the governed-field registry); (2) the RPC's own `insert into customers (...)` column list never included these 4, even though `p_customer_fields ->> 'segment'` was already read elsewhere in the same function for workflow routing. Fixed both: added the 4 missing keys to the TS mapping function, and migration `20261018000000_fix_onboarding_approval_missing_governed_fields.sql` redefines `approve_customer_onboarding_case` with the 4 columns restored to the insert, sourced from `p_customer_fields` exactly like every sibling field. 4 new unit tests in `onboarding-customer-field-mapping.test.ts` (all 9 tests in the file pass); tsc clean. Live confirmation via the real UI was attempted (fresh disposable case `CO-000130`) but blocked by a known browser-automation quirk unrelated to the product (the geography-combobox's dropdown options intermittently would not register a trusted click in this automation environment, the same "trusted-click" pitfall already documented in this program's standing notes); the fix's correctness rests on the direct source diff (before/after insert column lists), the passing unit test exercising the exact broken mapping function, and the successfully-deployed migration, which together are conclusive for this direct, mechanically-simple column-list correction (unlike PG-fixes involving non-obvious runtime/timing behavior, which this program requires live proof for). AA-001's own customer (created before this fix) still has these 4 fields `null`; not backfilled, since AA-001 predates the fix and backfilling a real fixture's data directly would violate this program's own no-direct-mutation discipline. Every onboarding approval from this point forward is fixed. |
| PG-063 | AA-006 (found while building the Commercial Version "V" side of the concurrency test) | 31 | A Commercial Component's own "Effective From"/"Effective To" date fields, shown as editable in the Add/Edit Component form (`ComponentEditor` in `commercial-rate-section.tsx`), were doubly non-functional: (1) their `onChange` handler never fired no matter how the field was set (real keyboard typing confirmed via a raw `addEventListener('input'/'change', ...)` probe to genuinely fire on the native `<input type="date">`, yet React's bound `onChange` prop was never invoked, reproduced on a completely fresh page load with no prior interaction); and (2) even if a value had been captured, it would have been silently discarded anyway, since `mapOnboardingComponentToCommercialComponentInsert` (`commercial-configuration-promotion.ts:213`) never read `component.effectiveFrom`/`effectiveTo` at all, always using the single container-level effective date passed in as its 4th argument (`version.effectiveDate` for a Commercial Version, the onboarding case's own `effectiveDate` for onboarding) uniformly for every component in the submission. Confirmed identical in both call sites (`commercial-version.service.ts:136`, `case.service.ts:430`). | DECIDED (2026-09-30: remove the two misleading, non-functional input controls rather than implement real per-component override, which would be architecturally nontrivial given AA-003's own effective-date-gap rule assumes uniform per-version dating) + FIXED | Deleted the "Effective From"/"Effective To" `<Input type="date">` block from `ComponentEditor` in `commercial-rate-section.tsx`. The domain type (`CommercialComponentDraft.effectiveFrom`/`effectiveTo`), the diff view, and the summary table's own read-only "Effective From" column (correctly populated for persisted/carried-forward components from their real historical data) were all left untouched, since none of those read the broken write path. `tsc` clean; full suite 1111/1111 passing. Verified live end-to-end on a fresh page load: the Add Component form no longer offers the two controls; a newly-added component now honestly shows "-" for Effective From in the draft table (no longer a silently-broken input pretending to work); after Submit-for-Approval with the version's own Effective Date, the new component correctly received that date, confirmed via `commercial_components` (new stable_component_key, `effective_from` matching the version's date, `effective_to = null`) alongside the two carried-forward components' own additive history remaining clean and non-overlapping. AA-006's canonical text unaffected (its own City/Commercial Version concurrency hypothesis was independently confirmed true). |
| PG-064 | AA-015 | 32 | Customer Change had no equivalent to Customer Onboarding's own Submit-time GST/PAN exact-match hard duplicate blocker: a Change Request could propose a GST or PAN that exactly matched a different, already-approved customer's current value, with nothing blocking it at draft save, submit, or either approval step. Live-confirmed: two fresh disposable test customers with distinct GST/PAN were created and approved, then a Change Request on one proposing the other's exact GST value was submitted and approved with no error, leaving both live Customer Master records sharing one GST. | CONFIRMED (genuine cross-domain inconsistency, not ambiguous; decision already made: mirror Onboarding's own hard block) + FIXED (2026-09-30, closed same day under the Immediate-Closure Protocol) | Root cause: Onboarding's own "hard block" (`validateOnboardingCaseReadyForSubmit` in `case.service.ts`) is a TypeScript service-layer check that runs before the underlying RPC call, not a SQL-level constraint; Customer Change's `change-request.service.ts` had no equivalent. Added a feature-local `src/features/customer-change/domain/duplicate-detection.ts` (`findChangeRequestGstPanDuplicates`: exact-match GST/PAN only, always excludes the Change Request's own customer so a proposal repeating that customer's own current value is never flagged against itself), a new pure module rather than a shared import from Onboarding's own duplicate-detection file, per this codebase's one-feature-never-imports-another rule. Enforced server-side in `change-request.service.ts`'s `submitChangeRequest` (mirrors Onboarding's own enforcement point exactly; no migration was needed for the same reason none exists for Onboarding), gated on the current revision genuinely being a draft, matching Onboarding's identical gate. A new `checkForChangeRequestDuplicateAction` mirrors Onboarding's own `checkForDuplicateCustomersAction` for the same fast client-side pre-submit UX, wired into `change-request-page.tsx`'s Submit handler. No migration and no `supabase db push` were required. 6 new unit tests (`duplicate-detection.test.ts`), full suite 1117/1117 passing, `tsc` clean. Verified live end-to-end: created a disposable draft Change Request against an existing disposable test fixture customer, proposed a GST exactly matching a different, real, active customer's current GST, and confirmed Submit was blocked with the expected message and the request stayed in Draft (zero mutation); the disposable draft was then cancelled, leaving only its own harmless audit trail. The pre-existing, already-approved Change Request that created the original live duplicate (and its two disposable test customers) was left untouched, since an approved change request is historical business truth this codebase's own convention never edits directly; the fix applies going forward only. |
| PG-065 | Y-001 / Y-012 (found while testing Workflow Builder at a 29-node graph scale) | 32 | Workflow Builder's "Add Node" never auto-selected the newly created node; the properties panel kept showing whichever node was previously selected. An admin who clicked Add Node and immediately edited the still-displayed panel, without first clicking the new node on the canvas, silently overwrote the previously-selected node's name/team/permission/required fields on Save, since the new and the previously-selected node shared no visible distinction in that moment. Self-reproduced live against `WF-TEST Large Graph Stress` (a pre-existing 29-node test fixture): adding a node and immediately renaming it via the panel in fact renamed the pre-existing "Finance Chain 2" node (confirmed via direct `node_key` diff between the before/after saved node sets, same key, different name), not the newly added node. | CONFIRMED (live-reproduced, not ambiguous) + FIXED (2026-10-01, closed same day under the Immediate-Closure Protocol) | Root cause: `addNode` in `workflow-canvas-editor.tsx` appended the new node to local state but never updated `selectedNodeId`, so the properties panel (keyed off `selectedNodeId`) kept rendering whatever was selected before. Fixed by computing the new node's key once in `addNode` itself (rather than only inside the `setNodes` updater) and calling `setSelectedNodeId(nodeKey)` (clearing `selectedEdgeId`) immediately after adding it, so the panel always reflects the node that was just added. UI-only change, no schema or RPC impact. `tsc` and lint clean; full suite 1117/1117 passing (no test changes needed, this is UI state wiring with no unit-testable domain logic of its own). Verified live end-to-end: restored the accidentally-renamed "Finance Chain 2" node on the draft version to its original name, then redid the edit correctly (confirmed via the DOM that Add Node now immediately shows the new node's own empty defaults in the panel, not the previous selection), saved, and confirmed via direct DB query that the draft now has 30 nodes: all 29 original nodes unchanged plus one genuinely new node, with no data loss. |

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
- **Second-pass update, same day (2026-09-28):** all 8 Product Decisions
  (PG-035, PG-036, PG-037, PG-038, PG-040, PG-044, PG-045, PG-053) were
  received from Utkarsh and implemented, verified (live where the RPC/DB
  layer allowed it, unit-tested throughout), and closed in the same session.
  PG-040 used a custom 4-bullet decision rather than a plain A/B/C choice;
  see its Closed History entry for the exact spec implemented.
- After the second pass: **Active (Decision Required): 0. To Verify: 1.
  Deferred / Accepted For Now: 9. Closed (this session): 11 (PG-039,
  PG-041, PG-043 from the first pass, plus PG-035, PG-036, PG-037, PG-038,
  PG-040, PG-044, PG-045, PG-053 from the second, bringing total Closed
  History to 45).**
- **Third pass, same day (2026-09-28): regression check + mandatory
  post-fix Journey Discovery.** Utkarsh accepted PG-037/PG-040 in
  principle but required one bounded regression check on each before
  final closure:
  - PG-037: the implemented segregation-of-duties check was over-broad
    (blocked ANY second approval by the same actor, not only a different
    level). Narrowed to compare node level (`from_node_key`); re-verified
    live that cross-node blocking still holds (`c579a77c-...`) and that a
    real historical same-node reapproval-after-resubmission
    (`1ba55311-...`) is now correctly allowed. See its Closed History
    entry above for full detail.
  - PG-040: the save/publish-time guard alone left a real runtime-routing
    gap open (an already-published, in-flight request could still be
    newly routed into a since-deactivated team's node). Fixed via a new
    check inside all four approve RPCs; verified live with a real Go Live
    request (`859d7124-...`, rejected cleanly, zero mutation) and
    confirmed existing work stays actionable (`6936e419-...`, approved
    successfully despite its current team being inactive). Also added the
    "Team inactive" warning directly to all four review pages, not only
    the Operational Queue. See its Closed History entry above for full
    detail.
  - **Journey Discovery re-check (mandatory per
    `docs/NEXUS_JOURNEY_EXECUTION_PLAN.md` point E, "Discovery caused by
    fixes"):**

    ```
    Journey Discovery: COMPLETE
    New journey candidates found: 1
    ```

    | Finding | Disposition | Existing/New Journey | Action |
    |---|---|---|---|
    | PG-037: same-node reapproval after resubmission must remain allowed | EXPAND_EXISTING_JOURNEY | V-028 | V-028's own Idempotency Variant rewritten to document and live-verify this case; no new journey ID needed. |
    | PG-040: runtime-routing guard behavior (block new routing, keep existing work actionable) | EXPAND_EXISTING_JOURNEY | O-005, T-019 | Both rewritten with the live-verified runtime-routing detail; no new journey ID needed, since O-005/T-019 already exist specifically for this subject. |
    | PG-040: review-page "Team inactive" banner | EXPAND_EXISTING_JOURNEY | O-005, T-019 | Same rewrite; covered by a direct component unit test (3 cases: absent, active, inactive) rather than a new end-to-end journey. |
    | `WORKFLOW_TEAM_INACTIVE` raised by all four approve RPCs has no client-side error-kind mapping in any of the four domains' error parsers, unlike the Workflow Builder domain's own (different, permissive) error handling, which already surfaces it correctly | **NEW GAP CONFIRMED** | New: **PG-056** | Registered in section A above. Not implemented this turn (explicit instruction: "Do not change any implementation"). |

  - After this pass: **Active (Decision Required): 0. Active (implementation
    pending, no decision needed): 1 (PG-056). To Verify: 1. Deferred /
    Accepted For Now: 9. Closed History: 45 (unchanged; PG-037/PG-040's
    entries were revised in place, not re-closed as new rows).**
- **Fourth pass, same day (2026-09-28): PG-056 closed under the
  Immediate-Closure Protocol.** Implemented exactly as specified: added
  `WORKFLOW_TEAM_INACTIVE` to all four client error parsers'
  `NAMED_TOKEN_KINDS`, backed by one new shared `NexusErrorCode` and
  standardized message in `src/platform/errors/domain/codes.ts` (reused
  across all four domains rather than duplicating the literal string per
  file). Server-side PG-040 invariant and already-assigned-team behavior
  both untouched, confirmed by diff scope (only the four `*-errors.ts`
  parser files, their four test files, and `codes.ts` changed). 4 new
  parser regression tests added and passing. Verified live: reproduced the
  same real Go Live request's runtime-routing rejection used to verify
  PG-040 itself (`859d7124-...`), captured the genuine raw RPC error text,
  and fed it through the real `parseGoLiveError` function, confirming the
  standardized message surfaces with no leaked node key. **Journey
  Discovery re-run after this fix:** the new shared `NexusErrorCode` has
  no explicit case in `src/platform/api/domain/status.ts`'s
  `httpStatusForCode` switch (falls through to its default 500); checked
  and found this exactly matches the existing, accepted pattern for
  `COMMERCIAL_EFFECTIVE_DATE_CONFLICT` (also added to the shared code
  vocabulary without ever being wired into that switch, since neither code
  is reached through that path from any live caller today). Disposition:
  ALREADY_COVERED by established precedent, not a new gap. New journey
  candidates found: 0. Classified **PRODUCT GAP RESOLVED + PASS**. Moved
  to Closed History (see PG-056's row above, revised in place, original
  PRODUCT GAP CONFIRMED history preserved in full above it in this same
  entry).
  - After this pass: **Active (Decision Required): 0. Active
    (implementation pending): 0. To Verify: 1. Deferred / Accepted For
    Now: 9. Closed History: 46 (PG-056 added).**
- **Fifth pass, 2026-09-29: PG-057 registered, decided, and closed same
  day under the Immediate-Closure Protocol.** Found during Batch 28's
  V-033: the Go Live review page's "Commercial Context (Locked)" section
  always showed the customer's CURRENT commercial terms, never the
  version the request actually referenced at creation, with no warning on
  divergence. Product Decision requested and received: truly lock to the
  creation-time Commercial Version, blocking approval and requiring an
  explicit, governed refresh if superseded. Implemented (migration
  `20261017000000`, `refresh_go_live_request_commercial_version` RPC,
  `referenced-version.ts` resolver, review-page warning/lock/refresh UI),
  regression-tested (4 new unit tests, full suite 1092 passing), and
  verified live end-to-end (blocked → refreshed → approved, plus a fresh
  request against the current version never blocked). Classified
  **PRODUCT GAP RESOLVED + PASS**. Moved to Closed History.
  - After this pass: **Active (Decision Required): 0. Active
    (implementation pending): 0. To Verify: 1. Deferred / Accepted For
    Now: 9. Closed History: 47 (PG-057 added).**
- **Sixth pass, same day (2026-09-29): PG-058 registered, decided, and
  closed same day under the Immediate-Closure Protocol.** Found during
  Batch 28's V-038: Customer Master's Activity tab and its History tab's
  Field History "Approved By" column live-resolved the actor's CURRENT
  display name for every historical entry, identically to every other
  Timeline, despite being the one surface expected to freeze to
  point-in-time identity (matching its own "historical evidence, can no
  longer be changed" framing used elsewhere). Product Decision requested
  and received: freeze Customer Master Activity/History to the actor's
  point-in-time identity via `audit_log`'s existing snapshot columns;
  keep ordinary Timelines live-resolving, unchanged. Implemented
  (`buildAuditIndex`/`historicalActorLabel` exact-match correlation,
  `listAuditLogForRows` batch fetch, `resolveFieldHistoryActorLabels` for
  the History tab, Field History labels rekeyed from actor id to entry
  id), regression-tested (8 new unit tests, full suite 1098 passing), and
  verified live end-to-end (renamed a real actor with real historical
  approvals; ordinary Timeline showed the new name, Activity/History both
  continued showing the original name). Classified **PRODUCT GAP RESOLVED
  + PASS**. Moved to Closed History.
  - After this pass: **Active (Decision Required): 0. Active
    (implementation pending): 0. To Verify: 1. Deferred / Accepted For
    Now: 9. Closed History: 48 (PG-058 added).**
- **Seventh pass, 2026-09-29: PG-059 registered, decided, and closed same
  day under the Immediate-Closure Protocol.** Found during Batch 29's
  Z-001: an expired/revoked session redirected to the exact same generic
  "Sign in to continue." login form a brand-new visitor sees, with no
  messaging distinguishing "your session expired" from an ordinary
  first-time login, distinct from `AuthGate`'s existing separate "Session
  unavailable" message. Product Decision requested and received: redirect
  to `/login?reason=session-expired` and show a persistent login-page
  banner, carrying the reason through the existing redirect rather than
  adding a new client-side session watcher; preserve the existing
  `redirectTo` return-navigation pattern. Implemented (new
  `hasSupabaseAuthCookie` helper distinguishing "was authenticated, now
  expired" from "never authenticated" via the existing `sb-*-auth-token`
  cookie; `NexusSession`'s `unauthenticated` variant gained an optional
  `expired` flag; `AuthGate` conditionally appends the reason param;
  `LoginPage` shows a `warning`-styled banner), regression-tested (12 new
  unit tests, full suite 1110 passing), and verified live end-to-end
  (revoked a real fictional persona's session mid-edit and mid-approval,
  confirmed the banner, confirmed zero partial/corrupted write in both
  cases, confirmed a plain `/login` visit shows no banner, confirmed
  re-authentication correctly returns to the original URL showing the
  true persisted state). Classified **PRODUCT GAP RESOLVED + PASS**.
  Moved to Closed History.
  - After this pass: **Active (Decision Required): 0. Active
    (implementation pending): 0. To Verify: 1. Deferred / Accepted For
    Now: 9. Closed History: 49 (PG-059 added).**
- **Eighth pass, 2026-09-29 (Batch 30): DF-010 added.** Z-015 found, live,
  that no duplicate/near-duplicate customer name warning exists anywhere
  in Customer Onboarding; the canonical journey's own framing treats this
  as worth flagging rather than a decided requirement, and
  `customers.name` carries no uniqueness constraint, so no data-integrity
  risk exists. Registered as DF-010 in Section C, not a confirmed Product
  Gap, no Product Decision requested.
  - After this pass: **Active (Decision Required): 0. Active
    (implementation pending): 0. To Verify: 1. Deferred / Accepted For
    Now: 10 (DF-010 added). Closed History: 49 (unchanged).**
- **Final program-audit pass, 2026-10-02 (count correction only, no new
  finding).** This running tally was never updated for three Section C
  entries added after the eighth pass: DF-011 (PG-060, Batch 31), DF-012
  (PG-061, Batch 31), and DF-013 (Batch 31), plus DF-00X (PG-066, Batch 32)
  was already present in the section body but likewise never folded into
  this count. A mechanical count of this document's own `### DF-` headings
  in Section C (not this prose) gives **14**, not 10: DF-00X, DF-001
  through DF-009, DF-010, DF-011, DF-012, DF-013. Corrected here; no gap's
  disposition changed, only this summary arithmetic.
  - Corrected count: **Active (Decision Required): 0. Active
    (implementation pending): 0. To Verify: 1. Deferred / Accepted For
    Now: 14. Closed History: 53 (PG-062 through PG-065 added across
    Batches 31-32; PG-066 is DF-00X above, not Closed).**
- The zero-active-team-members mechanism (PG-005) remains the single
  most-reconfirmed gap in the project's history (O-018, A-027, C-025,
  E-028, J-011, M-025, V-027, anticipated again as Z-007/Z-009); the
  unreconciled M-025-vs-O-018 discrepancy noted in the first pass is
  carried forward unchanged, still unresolved.
- Ordinary defects (bugs found and fixed through the normal FAILED ->
  FIXED THEN PASS lifecycle) remain intentionally excluded from this
  register: never an ambiguous product question, only a bounded code
  correctness issue, fully documented in their own batch ledgers.
