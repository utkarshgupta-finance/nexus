# Nexus Journey Execution Plan

Companion to [NEXUS_JOURNEY_UNIVERSE.md](NEXUS_JOURNEY_UNIVERSE.md) and [NEXUS_JOURNEY_COVERAGE_MATRIX.md](NEXUS_JOURNEY_COVERAGE_MATRIX.md). This plan originally sequenced all 782 current-executable journeys into 32 batches of 25 (the final batch holds 7); Batch 1 execution added K-030, making Batch 2 a 26-journey batch and the total 783. After Batch 16, the Stage A Journey Universe Expansion Audit (`docs/journey-runs/JOURNEY_UNIVERSE_EXPANSION_AUDIT.md`) added 8 further journeys (E-029, E-030, E-031, E-032, H-044, AA-023, AB-042, ACC-002), bringing the total to 793 and inserting a new Batch 18 dedicated to them; every batch from the former Batch 18 onward shifted down by one number (former Batch 18 is now Batch 19, and so on through former Batch 32, now Batch 33). Batch 17's own scope was deliberately left unchanged, since none of the 8 new journeys are a prerequisite for it. No journey has been executed as part of producing this plan; it exists to make later execution efficient and dependency-safe.

**Product Decision Closure (2026-09-22):** all three product decisions left open after Stage A and Batch 17 (Commercial Configuration deactivate/reactivate, I-015 entitlement reversal, I-024 settlement reversal) were decided and reconciled before Batch 18 began. D-003/D-004/D-015/D-021, I-015, and I-024 were rewritten in `NEXUS_JOURNEY_UNIVERSE.md` to test the decided/implemented behavior; no journey count, batch membership, or batch numbering changed as a result (the Journey Discovery Check for this closure work, in `docs/journey-runs/BATCH_17_RESULTS.md`, found zero new journey candidates). Batch 18's own scope (E-029 through ACC-002, above) is unaffected.

## Sequencing rationale

Batches are not alphabetical. They follow the dependency order in which a real environment would actually need to be built up: you cannot approve a Commercial Version before a Customer exists, you cannot test a workflow race before a workflow is published and active, and you cannot meaningfully test historical/legacy behavior before some real history has accumulated. The macro-phase order used here is:

1. **Foundation** (Workflow Builder, Workflow Versioning, Authentication/Sessions, Users/Roles/Permissions, Teams, Reference Masters). These must exist and be exercised first because every later phase assumes real users, real teams, real permission grants, real published workflows, and real reference values already exist.
2. **Customer Lifecycle** (Onboarding, one Accessibility check, Customer Master, Customer Change). Onboarding approval is the one path that creates the first real Customer Master and Commercial Configuration, so it must run before Commercial-only batches can have real data to work against.
3. **Commercial** (Commercial Configuration, Commercial Change, Pricing Models, MUG/Slab/Progressive/Designation).
4. **Go Live** (Go Live, Entitlement), which require an approved Commercial Configuration Version to exist first.
5. **Workflow Runtime + Approvals** (Workflow Runtime node-type/decision/team-routing depth, My Work/Approvals/Waiting on Others), exercised once there is enough real in-flight and completed work across the prior phases to observe.
6. **Documents**, **Audit**, **Search**, **Settings**, **Security** in turn, each needing the real requests, teams, and history the earlier phases produced.
7. **Concurrency**, **Idempotency**, **Chaos**, **Historical**, **Cross-Domain**, **Performance** last, since these cross-cutting and stress packs deliberately race against, retry, break, age, chain, or scale up the same objects and mechanisms proven correct in the earlier phases. Running them last means a cross-cutting failure can be triaged against a known-good baseline rather than against an untested one.

Reusable test data (personas, teams, published workflows, at least one approved customer and commercial version, at least one live Go Live line item) is deliberately built in the earliest batches and referenced by ID in every later batch's fixtures, rather than re-created per batch.

## How to read a batch

Each batch lists its Batch ID, its 25 (or, for a partial batch, fewer) Journey IDs in execution order, its Purpose, the personas it needs, the fixtures/state it needs already established, an expected duration range, its risk concentration, and which prior batch it depends on.

## Journey Discovery Check (mandatory from Batch 17 onward)

Before any batch from Batch 17 onward is closed, its ledger must explicitly answer one standing question:

> Did this batch reveal any durable business behaviour, control invariant, edge condition, cross-domain interaction, or regression risk that is not adequately represented in the Journey Universe?

Every candidate this question surfaces must be classified using the same six-way taxonomy the Stage A Journey Universe Expansion Audit introduced (`docs/journey-runs/JOURNEY_UNIVERSE_EXPANSION_AUDIT.md`):

- **ALREADY COVERED** (name the existing journey ID)
- **EXPAND EXISTING JOURNEY** (name the existing journey ID and the exact variant to add)
- **NEW JOURNEY REQUIRED** (allocate the next valid ID in the relevant pack, per that pack's own contiguous numbering; do not renumber any existing ID)
- **REGRESSION TEST ONLY** (too implementation-specific for a permanent business journey; note where the regression test lives instead)
- **FUTURE MODULE** (belongs to functionality intentionally not built yet; add to the relevant future-module backlog, do not build opportunistically)
- **PRODUCT DECISION REQUIRED** (the expected business outcome is genuinely unresolved; record the question, do not invent the answer)

The batch's own ledger must record the result of this check even when nothing is found: `No new journey candidates found.` is itself a valid, sufficient answer. A batch's own scheduled-journey denominator is never changed by anything this check finds; any newly-created journey becomes a future journey, placed into a later batch per Stage A10's own precedent (dependency ordering, domain grouping, fixture requirements), not retroactively inserted into the batch that discovered it.

This requirement itself does not apply retroactively to Batches 1 through 16; those closed under the rules that existed at the time, and their own incidental findings were instead swept up in the one-time Stage A Journey Universe Expansion Audit.

---

### BATCH 1
**Journey IDs:** K-001 through K-025
**Purpose:** Prove out the Workflow Builder's authoring mechanics (node palette, node types, edge/branch authoring, save-draft-graph behavior, structural validation) before any workflow is ever published or run against real business data.
**Required personas:** Workflow Admin (workflow_definition read/write/publish)
**Required fixtures:** A fresh, empty Nexus environment; no prior workflow definitions required.
**Expected duration:** 3-4 hours
**Risk concentration:** P0/P1 concentrated in the whole-graph-replace concurrent-edit risk (K-010) and structural validation edges (K-019 through K-026).
**Depends on:** None (first batch).

### BATCH 2 (26 journeys; one over the standard 25, see note)
**Journey IDs:** K-026 through K-030, L-001 through L-021
**Purpose:** Finish Builder authoring coverage, including K-030 (a regression journey for a real Refresh/stale-recovery data-loss defect found and fixed live during Batch 1, already passing when this batch runs), then move into the Workflow Versioning lifecycle: draft, publish, one-draft-per-definition and one-active-per-context uniqueness, and the permanent version-binding guarantee.
**Required personas:** Workflow Admin
**Required fixtures:** At least one workflow definition created in Batch 1.
**Expected duration:** 3-4 hours
**Risk concentration:** P0/P1 on publish-immutability and the active-workflow-uniqueness constraint (L-003 through L-010 range); K-030 is also P0 but is a regression check for an already-fixed defect, not an open risk.
**Depends on:** Batch 1.
**Note:** K-030 was discovered and fully resolved during Batch 1's own execution (it directly extends K-010's concurrency scenario). It is placed here rather than retroactively inserted into Batch 1 to avoid disturbing Batch 1's already-executed 25-journey record; running it in Batch 2 will simply reconfirm the fix.

### BATCH 3
**Journey IDs:** L-022 through L-028, U-001 through U-018
**Purpose:** Finish Versioning, then establish the Authentication/Sessions baseline (login, session states, session refresh, AuthGate honesty) that every later persona-driven batch depends on.
**Required personas:** Workflow Admin; at least one provisioned but not-yet-role-assigned user for the unprovisioned/inactive session-state checks.
**Required fixtures:** Published workflow version(s) from Batch 2.
**Expected duration:** 3-4 hours
**Risk concentration:** P1 on the five-state session model and the suspected login-redirect regression (U-005).
**Depends on:** Batch 2.

### BATCH 4
**Journey IDs:** U-019, U-020, N-001 through N-023
**Purpose:** Finish Authentication, then begin Users/Roles/Permissions: provisioning, activation/deactivation, role grant/revoke, and the historical (never hard-deleted) grant model.
**Required personas:** user_access_admin; several plain unprivileged users to provision.
**Required fixtures:** N/A beyond Batch 3's session baseline.
**Expected duration:** 3-4 hours
**Risk concentration:** P1 on grant/revoke correctness and the never-hard-deleted historical model.
**Depends on:** Batch 3.

### BATCH 5
**Journey IDs:** N-024 through N-031, O-001 through O-017
**Purpose:** Finish Users/Roles/Permissions (including the new usage.read/entitlement_settlement.read enforcement-gap verification, N-031), then begin Teams: creation, activation/deactivation, membership.
**Required personas:** user_access_admin, team_admin
**Required fixtures:** Roles/permissions established in Batch 4.
**Expected duration:** 3-4 hours
**Risk concentration:** P1 on N-031's permission-enforcement finding; team membership correctness feeding every later workflow-routing batch.
**Depends on:** Batch 4.

### BATCH 6
**Journey IDs:** O-018 through O-025, P-001 through P-017
**Purpose:** Finish Teams (including the last-active-member-removed orphaning case, O-018, and the team-deactivation-does-not-block-approval inconsistency), then begin Reference Masters: the three governance levels (Configurable, Governed, System-Supported).
**Required personas:** team_admin, reference_master_admin
**Required fixtures:** At least 2-3 teams with 2+ members each, so O-018's last-member-removed scenario has a safe non-destructive setup.
**Expected duration:** 3-4 hours
**Risk concentration:** P1 on O-018 (orphaned request, no fallback) and O-019/O-020-range team-deactivation inconsistency.
**Depends on:** Batch 5.

### BATCH 7
**Journey IDs:** P-018 through P-023, A-001 through A-019
**Purpose:** Finish Reference Masters, then begin Customer Onboarding: draft creation through the strict-stage submit validation.
**Required personas:** reference_master_admin, Maker
**Required fixtures:** Foundation phase fully complete: an active published workflow bound to customer_onboarding is now mandatory for case creation (`WORKFLOW_NO_ACTIVE_DEFINITION` otherwise, migration `20260930000000_workflow_creation_requires_active_definition.sql`), corrected during Batch 7 execution; the previous "recommended, though onboarding also supports running without one" wording predated that migration and described a workflow-less path that is no longer reachable (see A-013).
**Expected duration:** 4-5 hours
**Risk concentration:** P1 on duplicate detection (GST/PAN hard blockers) and stage-validation completeness.
**Depends on:** Batch 6.

### BATCH 8
**Journey IDs:** A-020 through A-035, ACC-001, B-001 through B-008
**Purpose:** Finish Onboarding through approval (the atomic Customer Master + Commercial Configuration + Version 1 creation transaction), run the one Accessibility keyboard-only journey against this exact flow, then begin Customer Master direct actions.
**Required personas:** Maker, Checker (Finance or equivalent, holding customer.approve), Workflow Admin (to confirm workflow team routing if bound)
**Required fixtures:** A fully-prepared draft onboarding case from Batch 7.
**Expected duration:** 4-5 hours
**Risk concentration:** P0 concentrated in A-030 through A-035 (the atomic creation transaction, self-approval block, zero-team-member gap).
**Depends on:** Batch 7.

### BATCH 9
**Journey IDs:** B-009 through B-025, C-001 through C-008
**Purpose:** Finish Customer Master (deactivate/reactivate, permanent deletion eligibility, search including former-name resolution), then begin Customer Change drafting.
**Required personas:** customer_lifecycle_admin, Maker
**Required fixtures:** The Customer Master record created in Batch 8.
**Expected duration:** 4-5 hours
**Risk concentration:** P0 on permanent-deletion eligibility (RESTRICT-FK correctness) and the direct-mutation-bypass protection trigger.
**Depends on:** Batch 8.

### BATCH 10
**Journey IDs:** C-009 through C-033
**Purpose:** Continue Customer Change through submit, the two distinct staleness guards (draft-level and base-customer-level), the informational workflow-rules engine, and reject-as-terminal.
**Required personas:** Maker, Checker
**Required fixtures:** Customer Master record with at least one prior approved field, to exercise base-row-version staleness meaningfully.
**Expected duration:** 4-5 hours
**Risk concentration:** P0 on CUSTOMER_CHANGE_STALE_BASE and field-history-append-only correctness.
**Depends on:** Batch 9.

### BATCH 11
**Journey IDs:** C-034, C-035, D-001 through D-023
**Purpose:** Finish Customer Change, then begin Commercial Configuration Version: draft/submit/approve, the atomic apply/activate transaction, component closure-on-approval.
**Required personas:** Maker, Checker (commercial_configuration.approve)
**Required fixtures:** The active Commercial Configuration created in Batch 8's onboarding approval.
**Expected duration:** 4-5 hours
**Risk concentration:** P0 on the atomic version-approval transaction (unconditional component closure, stable_component_key continuity).
**Depends on:** Batch 10.

### BATCH 12
**Journey IDs:** D-024, E-001 through E-024
**Purpose:** Finish Commercial Configuration, then begin Commercial Change: the structural distinction from first-time submission, the older ungoverned promotion RPC's coexistence risk.
**Required personas:** Maker, Checker
**Required fixtures:** At least one prior approved Commercial Configuration Version from Batch 11.
**Expected duration:** 4-5 hours
**Risk concentration:** P0/P1 on the ungoverned-RPC coexistence risk and change_category validation.
**Depends on:** Batch 11.

### BATCH 13
**Journey IDs:** E-025 through E-028, F-001 through F-021
**Purpose:** Finish Commercial Change, then begin Pricing Models: Per Unit, Flat Fee, Slab (Whole Quantity and Progressive), Designation Based.
**Required personas:** Maker, Checker
**Required fixtures:** An in-review Commercial Version draft to attach components to.
**Expected duration:** 4-5 hours
**Risk concentration:** P1 on pricing_rule_kind mapping correctness and the non-recurring revenue recognition "never posts a journal entry" boundary.
**Depends on:** Batch 12.

### BATCH 14
**Journey IDs:** F-022, G-001 through G-024
**Purpose:** Finish Pricing Models, then begin MUG/Slab/Progressive/Designation depth: contiguous slab-band construction, overall vs slab-wise MUG modes, MUG as a unit-quantity floor.
**Required personas:** Maker, Checker
**Required fixtures:** A draft with at least one Slab component to extend.
**Expected duration:** 4-5 hours
**Risk concentration:** P1 on MUG mode correctness and the recurring/non-recurring/on-demand "nature" schema gap.
**Depends on:** Batch 13.

### BATCH 15
**Journey IDs:** G-025, G-026, H-001 through H-023
**Purpose:** Finish MUG/Slab depth, then begin Go Live: request creation gating on an approved Commercial Version, the approve_go_live_request state machine through workflow-node advancement.
**Required personas:** Maker, Checker (go_live.approve)
**Required fixtures:** An approved Commercial Configuration Version with at least one recurring component, from Batches 11-14.
**Expected duration:** 4-5 hours
**Risk concentration:** P0 on the single-durable-effect approval mechanism and customer-confirmation gating.
**Depends on:** Batch 14.

### BATCH 16
**Journey IDs:** H-024 through H-043, I-001 through I-005
**Purpose:** Finish Go Live (derived-status edge cases, the two historical stable_component_key regressions as regression checks, the new direct-mutation-bypass check H-043), then begin Entitlement: source creation independent of Go Live.
**Required personas:** Checker, Finance user (entitlement.write)
**Required fixtures:** At least one approved Go Live request from earlier in this batch.
**Expected duration:** 4-5 hours
**Risk concentration:** P0 on H-043 (verify empirically, do not assume parity with other domains) and future-dated approval behavior.
**Depends on:** Batch 15.

### BATCH 17
**Journey IDs:** I-006 through I-030
**Purpose:** Continue Entitlement: allocation anchoring at the Go Live month, USAGE_BEFORE_GO_LIVE boundary, monthly ledger computation, unbilled/unearned math.
**Required personas:** Finance user (entitlement.write, usage.write)
**Required fixtures:** The Go Live-approved line item and entitlement source from Batch 16.
**Expected duration:** 4-5 hours
**Risk concentration:** P0 on allocation-anchoring correctness and the usage-before-go-live rejection boundary.
**Depends on:** Batch 16.

### BATCH 18 (backlog batch, 8 journeys; inserted by the Stage A Journey Universe Expansion Audit)
**Journey IDs:** E-029, E-030, E-031, E-032, H-044, AA-023, AB-042, ACC-002
**Purpose:** Clear the 8 journeys the Stage A Journey Universe Expansion Audit (`docs/journey-runs/JOURNEY_UNIVERSE_EXPANSION_AUDIT.md`) added after Batch 16: Commercial Change correction-hardening (retroactive start date, intermediate-history overlap guard, adjacent-date guard, non-recurring-recognition UI honesty), a Go Live creation-time concurrency race never previously exercised, a cross-domain Timeline-wording risk check, a cross-cutting append-only-revocation invariant, and an accessibility follow-up. None of these are a prerequisite for Batch 17's Entitlement work, so Batch 17's own scope was deliberately left unchanged; this batch is scheduled immediately after it instead of being folded into it.
**Required personas:** Finance Analyst, Checker, Maker (two sessions for H-044's concurrency race), a screen-reader user for ACC-002, an admin attempting direct table-level grant reactivation for AB-042
**Required fixtures:** Existing Commercial Change correction fixtures from Batches 12-14 (including "WF-Test PD-002 Case A"); an approved Go Live request/stable_component_key from Batch 16 for H-044; in-flight requests across Onboarding, Customer Change, and Commercial Configuration for AA-023's Timeline check; the existing user_roles/role_permissions/user_teams revocation fixtures from Batches 4 and 16 for AB-042.
**Expected duration:** 3-4 hours
**Risk concentration:** P1 spread across the batch; H-044 (creation-time TOCTOU, never previously resolved either way) and AA-023 (an unverified defect-class risk in three domains) carry the most uncertainty going in.
**Depends on:** Batch 16 (not Batch 17).

### BATCH 19
**Journey IDs:** I-031 through I-038, J-001 through J-017
**Purpose:** Finish Entitlement (settlement flows, the new I-038 fully-settled terminal boundary), then begin Workflow Runtime depth: node-type-specific behavior, decision-node equals/not_equals/fallback, the 10-hop bound.
**Required personas:** Finance user, Workflow Admin
**Required fixtures:** Ledger entries from Batch 17; a published workflow with a Decision node bound to commercial_configuration (the only domain with real conditional routing).
**Expected duration:** 4-5 hours
**Risk concentration:** P1 on I-038 and on Decision-node inertness outside commercial_configuration (J-007 through J-009).
**Depends on:** Batch 17. (Batch 18 runs independently and does not gate this batch.)

### BATCH 20
**Journey IDs:** J-018 through J-030, M-001 through M-012
**Purpose:** Finish Workflow Runtime (team-ownership gaps, the historical RPC-overload regression as a regression check), then begin My Work/Approvals: inbox bucketing and the three-condition classification order.
**Required personas:** Maker, Checker, an Approvals-inbox viewer with mixed team memberships
**Required fixtures:** A mix of in-flight requests across all four governed domains from prior batches, at various workflow nodes.
**Expected duration:** 4-5 hours
**Risk concentration:** P1 on the zero-active-team-member orphaning gap and the "pending my approval" vs "waiting on others" classification order.
**Depends on:** Batch 19.

### BATCH 21
**Journey IDs:** M-013 through M-030, Q-001 through Q-007
**Purpose:** Finish My Work/Approvals (the canApprove cross-domain OR-imprecision investigation, M-020/M-021, and the Operational Queue's role-based-never-named-person model), then begin Documents/Evidence: upload, validation, supersede-not-delete.
**Required personas:** Approvals-inbox viewer, Maker uploading documents
**Required fixtures:** An in-flight Onboarding or Go Live request to attach documents to.
**Expected duration:** 4-5 hours
**Risk concentration:** P1 on M-021's cosmetic-vs-real-authorization-gap determination (run this one first in the batch).
**Depends on:** Batch 20.

### BATCH 22
**Journey IDs:** Q-008 through Q-020, R-001 through R-012
**Purpose:** Finish Documents (revision-document snapshotting, the demo-Documents-tab honesty check, the Customer Change/Commercial no-attachment-support confirmation), then begin Audit/Timeline: the shared RequestTimeline renderer and per-domain event composition.
**Required personas:** Maker, Checker, an auditor/reviewer persona
**Required fixtures:** Requests with a real Send Back / multi-cycle history from Batches 8-20, to give the Timeline something rich to render.
**Expected duration:** 4-5 hours
**Risk concentration:** P1 on document-metadata-without-file and the live-vs-snapshot actor-resolution behavior.
**Depends on:** Batch 21.

### BATCH 23
**Journey IDs:** R-013 through R-020, S-001 through S-017
**Purpose:** Finish Audit/Timeline (the explicit renamed-user/renamed-team/workflow-replaced/version-superseded historical-fidelity checks), then begin Search/Navigation/Discovery: the real but narrowly-scoped Customer Master search, list-based find-work surfaces.
**Required personas:** Any user with customer.read, a user whose display name will be changed mid-scenario
**Required fixtures:** A customer with a former name (via an approved rename) from Batch 9-10, and at least one user who has since changed their display name, to exercise the live-resolution-vs-snapshot journeys meaningfully.
**Expected duration:** 4-5 hours
**Risk concentration:** P2 on search recall/precision; P1 on the live-actor-resolution-after-rename confirmation.
**Depends on:** Batch 22.

### BATCH 24
**Journey IDs:** S-018 through S-024, T-001 through T-018
**Purpose:** Finish Search/Discovery (the explicit Forms Hub PRODUCT GAP verification journeys, and the new S-024 external API v1 boundary check), then begin Settings: Reference Master governance depth, deactivation non-retroactivity.
**Required personas:** Any authenticated caller for the API journey; reference_master_admin
**Required fixtures:** N/A beyond Reference Masters seeded in Batch 6.
**Expected duration:** 4-5 hours
**Risk concentration:** P1 on S-024 (a genuinely untested external surface) and Reference Master non-retroactivity guarantees.
**Depends on:** Batch 23.

### BATCH 25
**Journey IDs:** T-019 through T-024, AB-001 through AB-019
**Purpose:** Finish Settings (the team-deactivation-does-not-block-approval inconsistency as a dedicated Settings-side check, T-019), then begin Security/Direct Action: direct-URL and bypass-the-UI attempts against every governed domain.
**Required personas:** An adversarial tester with varying, deliberately mismatched permissions/teams
**Required fixtures:** In-flight requests across all four domains, at known current workflow nodes, to attempt direct-action bypass against.
**Expected duration:** 5-6 hours
**Risk concentration:** P0 concentrated almost entirely in this batch's AB journeys (server-side enforcement is the last line of defense).
**Depends on:** Batch 24.

### BATCH 26
**Journey IDs:** AB-020 through AB-041, V-001 through V-004
**Purpose:** Finish Security/Direct Action (the 14 explicit permission-change-mid-flight scenarios, plus AB-041, the governed-RPC PostgreSQL-grant sweep added during Batch 7's closure and never previously placed in this plan), then begin Concurrency: the two-editor draft race and the row-lock approval race across all four domains.
**Required personas:** Two sessions per race (Maker A/B or Checker A/B), an admin able to mutate permissions/teams mid-scenario
**Required fixtures:** Fresh drafts and in-flight approvals per domain, created specifically for controlled racing rather than reused from earlier batches (to avoid cross-contaminating other batches' end states).
**Expected duration:** 5-6 hours
**Risk concentration:** P0 throughout; this is the highest-density P0 batch in the plan.
**Depends on:** Batch 25.

### BATCH 27
**Journey IDs:** V-005 through V-029
**Purpose:** Continue Concurrency: the remaining domain-specific approval races, the Workflow Builder and per-domain two-tab draft-edit regression checks (V-011 through V-015, all confirmed-fixed via the applied optimistic-locking migration, not open gaps), admin-changes-workflow-while-request-moves, and the Permission-Change Journeys sub-section.
**Required personas:** Two-session pairs per race, plus a team/permission-mutating admin session
**Required fixtures:** Same as Batch 26.
**Expected duration:** 5-6 hours
**Risk concentration:** P0/P1 on the 14 permission-change scenarios; V-011 through V-015 are now regression checks, not risk findings, since the draft-staleness fix is confirmed live.
**Depends on:** Batch 26.

### BATCH 28
**Journey IDs:** V-030 through V-047, W-001 through W-007
**Purpose:** Finish Concurrency (the remainder of the State-Mutation Journeys sub-section, the AA-014-style cross-domain row-version consistency confirmation, and the remaining approval-node/graph races), then begin Idempotency: double-submit/approve/reject/send-back/cancel across domains.
**Required personas:** Standard Maker/Checker/Admin personas, plus a team/reference-master/workflow-mutating admin session for the State-Mutation scenarios.
**Required fixtures:** In-flight requests across all four domains for the state-mutation-while-pending scenarios.
**Expected duration:** 5-6 hours
**Risk concentration:** P1/P2 spread across the State-Mutation sub-section (Customer Master changes while a Change is pending, Commercial Version changes while Go Live is pending, workflow version publish while a request is in flight); no residual draft-staleness risk in this batch, that was reconciled into Batch 27's V-011 through V-015.
**Depends on:** Batch 27.

### BATCH 29
**Journey IDs:** W-008 through W-021, Z-001 through Z-011
**Purpose:** Finish Idempotency (refresh-then-repeat, back/forward-then-repeat), then begin Chaos/Failure/Recovery: session expiry mid-edit/mid-approval, network failure after send, browser refresh/close mid-action.
**Required personas:** Standard Maker/Checker, with the ability to force session expiry and simulate network interruption
**Required fixtures:** N/A beyond standard drafts/approvals.
**Expected duration:** 5-6 hours
**Risk concentration:** P1 on session-expiry-mid-approval recovery paths.
**Depends on:** Batch 28.

### BATCH 30
**Journey IDs:** Z-012 through Z-030, X-001 through X-006
**Purpose:** Finish Chaos (deactivated referenced team/master value, zero-eligible-team-member, storage-object-missing, boundary dates, malformed deep links, the new Z-030 User Access degraded-failure check), then begin Historical/Legacy Data.
**Required personas:** Standard Maker/Checker/Admin personas, plus direct storage/database access to simulate a missing storage object
**Required fixtures:** A Reference Master value and a team deliberately set up for deactivation mid-scenario.
**Expected duration:** 5-6 hours
**Risk concentration:** P1 concentrated on zero-eligible-team-member and Z-030 (new, unconfirmed finding).
**Depends on:** Batch 29.

### BATCH 31
**Journey IDs:** X-007 through X-021, AA-001 through AA-010
**Purpose:** Finish Historical/Legacy Data (audit_sequence-vs-commit-order nuance, superseded workflow/commercial-version fidelity), then begin Cross-Domain Customer Lifecycle: the full Onboarding-to-Entitlement chain and post-Go-Live change scenarios.
**Required personas:** Full persona set across all domains
**Required fixtures:** As much accumulated real history as possible from Batches 1-30, since Historical journeys are most meaningful against genuinely aged data rather than data created moments earlier.
**Expected duration:** 5-6 hours
**Risk concentration:** P0 on the full cross-domain chain (AA-001) and Customer Change after Go Live (AA-002).
**Depends on:** Batch 30.

### BATCH 32
**Journey IDs:** AA-011 through AA-022, Y-001 through Y-013
**Purpose:** Finish Cross-Domain Customer Lifecycle (the two new gap-analysis additions AA-021/AA-022 on segment-change routing and workflow-version independence; AA-023, this plan's other newly-added cross-domain journey, already ran in Batch 18), then begin Performance/Large Records: many send-back cycles, large workflow graphs, many components.
**Required personas:** Full persona set
**Required fixtures:** A customer with multiple concurrent governed requests from earlier batches (AA-006-style setup).
**Expected duration:** 5-6 hours
**Risk concentration:** P1 on AA-021 (segment routing correctness) and early Performance journeys (large send-back cycle counts).
**Depends on:** Batch 31.

### BATCH 33 (partial batch, 7 journeys)
**Journey IDs:** Y-014 through Y-020
**Purpose:** Finish Performance/Large Records: many documents, many approvals, large audit history read performance, and large customer/commercial history rendering.
**Required personas:** Standard Maker/Checker/Admin
**Required fixtures:** The large, accumulated data volume from all prior batches; this batch is deliberately last so it benefits from real accumulated scale rather than synthetically bulk-inserted data.
**Expected duration:** 2-3 hours
**Risk concentration:** P2/P3, this batch is about responsiveness and readability at scale, not correctness.
**Depends on:** Batch 32.

---

## Summary

- 33 batches total: 1 batch of 26 (Batch 2), 1 backlog batch of 8 (Batch 18, inserted by the Stage A Journey Universe Expansion Audit), 30 full batches of 25, 1 final batch of 7.
- Total current-executable journeys sequenced: 793 (K-030 added after Batch 1 execution; E-029, E-030, E-031, E-032, H-044, AA-023, AB-042, ACC-002 added by the Stage A Journey Universe Expansion Audit after Batch 16, `docs/journey-runs/JOURNEY_UNIVERSE_EXPANSION_AUDIT.md`).
- Estimated total execution duration if run sequentially by a single team: roughly 138-169 hours across the full plan; batches 25-28 (Security and Concurrency) and 7-20 (the full customer-to-approvals chain) are the largest time investments due to multi-session/multi-persona setup overhead.
- The two FUTURE packs (Forms Hub, MRR Recognition) are intentionally absent from this plan; they have no batches because they are not executable against the current product.
- Batches 1 through 17 are historical/immutable in scope (already executed, or, for Batch 17, executed under the plan as it existed before this audit). Batch 18 onward reflects the post-Stage-A plan; no batch number before 18 was changed.
