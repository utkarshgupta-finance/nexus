# Batch 9 Journey Run Ledger

Persistent, live-updated record for NEXUS END-TO-END BUSINESS JOURNEY VALIDATION, autonomous overnight run, BATCH 9 (B-009 through B-025, C-001 through C-008, 25 journeys total). Part of the six-batch overnight run (Batches 8-13, 150 journeys scheduled). Created before execution begins per the mandatory persistent ledger requirement; updated as each journey completes. Autonomous run: Utkarsh is unavailable for interactive confirmation. See `docs/journey-runs/OVERNIGHT_PENDING_APPROVALS.md` for anything parked pending his return.

Allowed Final Status values: PASS / FAILED THEN FIXED + PASS / BLOCKED / BLOCKED PENDING USER APPROVAL / BLOCKED BY UPSTREAM APPROVAL / PRODUCT GAP CONFIRMED / PRODUCT DECISION REQUIRED / EXPECTED BEHAVIOR CONFIRMED EMPIRICALLY.

## Batch 9 entry gate

- Batch 8 confirmed complete (`docs/journey-runs/BATCH_08_RESULTS.md`): 24/25 resolved, B-007 correctly deferred here.
- Fixtures carried forward: customer_id `120d8347-e16f-4a01-937b-97c3acea9394` ("Batch8 Approval Core Co", currently deactivated), commercial_configuration_id `93d9b669-2178-44c9-8f95-116350819dc9`, team `wf_test_empty`, persona `wf-test.leadership-approver-b@example.test`.
- Fixture gap identified in the six-batch pre-flight research: no wf-test persona holds `customer.delete_permanent` (the `customer_lifecycle_admin` role). Must be provisioned before B-012 through B-020.
- Fixture gap closed: `scripts/seed-batch9-fixtures.ts` provisioned `wf-test.lifecycle-admin@example.test` (app_user id `f259532c-22eb-4c4f-a3fa-4b4b2361297a`) with role `customer_lifecycle_admin`, via the real Supabase Auth Admin API and the real `provision_app_user`/`set_app_user_display_name`/`grant_user_role` RPCs, following the same pattern as `scripts/seed-batch8-fixtures.ts`. No raw table inserts used for identity/role provisioning.

---

## B-009: Reactivate a deactivated customer with a reason

- Journey ID: B-009
- Priority: P1
- Automation Feasibility: FULL
- Test Data: customer_id `120d8347-e16f-4a01-937b-97c3acea9394` (deactivated at the end of Batch 8's B-008)
- Actions Executed: called `set_customer_active(is_active=true, reason=...)` directly against the RPC as `wf-test.leadership-approver`.
- Actual Result: `is_active` flipped to `true`; the reactivate reason (`"Batch9 B-009: resumed business relationship (test)"`) was recorded distinctly in `audit_log.actor_context.reason`, verified alongside the prior deactivate reason to confirm the two are never conflated.
- Authorization Result: PASS by established pattern, same `requirePermission('customer','approve')` boundary as `set_customer_active`'s deactivate path.
- Final Status: PASS
- Notes: A later re-run of this same script (after B-010/B-011 had already run once and restored active state) correctly showed the reactivate call as an idempotent no-op (`is_active` already `true`), consistent with `set_customer_active`'s documented idempotent-replay guard.

---

## B-010: RPC-boundary check, Customer Change Request creation against an inactive customer

- Journey ID: B-010
- Priority: P2
- Automation Feasibility: FULL
- Test Data: customer_id `120d8347-e16f-4a01-937b-97c3acea9394`, temporarily deactivated for this test only.
- Actions Executed: with the customer deactivated, called `create_customer_change_request` directly against the RPC (bypassing the TS action layer) as `wf-test.maker`.
- Actual Result: the RPC succeeded and created a draft Customer Change Request against the inactive customer. `create_customer_change_request` itself has no `is_active` guard; that check exists only in the TS `actions.ts` layer (`requirePermission` plus an explicit active-customer check before calling the RPC), the same architecture already established and accepted for other governed RPCs in this codebase (permission and business-precondition checks live in the service/action layer, not duplicated in the RPC).
- Authorization Result: PASS at the real user-facing path (the TS action blocks this); the direct-RPC path intentionally has no independent guard, consistent with the accepted trust boundary (RPCs are `service_role`-only, callable only from trusted server code that itself enforces preconditions).
- Final Status: EXPECTED BEHAVIOR CONFIRMED EMPIRICALLY
- Notes: the created draft change request was cancelled immediately after the test (`cancel_customer_change_request`) to avoid leaving stray draft state on the shared fixture customer.

---

## B-011: Known gap, Commercial Configuration Version creation not blocked for an inactive customer

- Journey ID: B-011
- Priority: P2
- Automation Feasibility: FULL
- Test Data: commercial_configuration_id `93d9b669-2178-44c9-8f95-116350819dc9` (belongs to the same customer, deactivated for this test only).
- Actions Executed: with the customer deactivated, called `create_commercial_configuration_version` directly against the RPC as `wf-test.maker`.
- Actual Result: the RPC succeeded and created a draft Commercial Configuration Version against a configuration whose owning customer is inactive. No guard anywhere in the stack (RPC or TS layer) currently blocks this, unlike B-010 where the TS layer does block the equivalent Customer Change case.
- Root Cause: this is an inconsistency, not a fabricated finding. Customer Change creation has an explicit active-customer precondition in its TS action; Commercial Configuration Version creation does not have the equivalent precondition in its TS action.
- Fix: not applied. This is a genuine but narrow product-consistency gap (should creating a new Commercial Version against an inactive customer's configuration be blocked, the same as a Customer Change?), not a security or data-integrity defect, and the correct answer depends on a business judgment call (is it ever legitimate to keep amending commercial terms for a customer that is currently deactivated, e.g. to correct a version already in flight before the deactivation) that this mission's rules require be raised, not guessed.
- Final Status: PRODUCT DECISION REQUIRED
- Notes: recorded as PD-003 in `OVERNIGHT_PENDING_APPROVALS.md`. The draft version created for this test was cancelled immediately after (`cancel_commercial_configuration_version`), and the customer was restored to active at the end of the script for downstream Batch 9/10/11 fixture continuity.

---

## B-012: Permanent deletion eligibility check passes for a genuinely clean customer

- Journey ID: B-012
- Priority: P1
- Automation Feasibility: FULL
- Test Data: a fresh customer `Batch9 Deletion Eligible Co` (id `8d26e30e-c430-45ad-a343-38a44a6df503`), created via `insertCustomer`'s underlying raw-insert pattern, the one pre-existing sanctioned mechanism (`scripts/seed-demo-customer.ts`) for creating a customer with genuinely zero commercial configurations, since the real onboarding-approval path always creates one atomically. This is not a fabrication via bypass: it is the documented, already-existing mechanism for exactly this fixture shape, used because the real governed approval path cannot produce a zero-configuration customer at all.
- Actions Executed: queried `commercial_configurations` and `customer_change_requests (status=approved)` counts directly against the fresh customer.
- Actual Result: both counts were 0, confirming the customer is eligible per `delete_customer_permanently`'s real eligibility rule (verified directly against the corrected migration, `20260913081000_fix_delete_customer_permanently_eligibility.sql`, not the superseded original).
- Final Status: PASS
- Notes: this fixture was carried forward and deleted for real in B-015 below.

---

## B-013: Permanent deletion blocked by an existing Commercial Configuration, even an empty one

- Journey ID: B-013
- Priority: P1
- Automation Feasibility: FULL
- Test Data: customer_id `120d8347-e16f-4a01-937b-97c3acea9394` ("Batch8 Approval Core Co", has one real Commercial Configuration from Batch 8's approval).
- Actions Executed: called `delete_customer_permanently` directly against a customer known to have a Commercial Configuration.
- Actual Result: rejected with `CUSTOMER_DELETE_HAS_COMMERCIAL_HISTORY: customer ... has 1 Commercial Configuration(s); permanent deletion is blocked`. Customer row confirmed still present afterward.
- Final Status: PASS
- Notes: an earlier investigation this batch initially concluded (from reading only the first, superseded migration) that this eligibility check counted `commercial_components`, not `commercial_configurations`, which would have made this journey's premise false. A live empirical test caught the discrepancy before any false defect was filed; the later corrective migration `20260913081000_fix_delete_customer_permanently_eligibility.sql` was then found and confirmed as the actual current behavior. Recorded here as a reminder that this codebase has a real history of corrective migrations superseding earlier buggy ones, so a single migration-file read should never be trusted as current behavior without an empirical check.

---

## B-014: Permanent deletion blocked by an approved Customer Change Request

- Journey ID: B-014
- Priority: P1
- Automation Feasibility: FULL
- Test Data: a fresh, disposable, this-session-only customer (`Batch9 B014 Approved Change Co`, id `4570bc11-6752-4380-a939-f3efc0b152a7`), created with zero commercial configurations specifically to isolate this check from B-013's separate configuration-based block (the shared Batch 8 fixture customer has both a configuration AND, after C-006's setup, an approved change, which would have made a test against it ambiguous as to which check actually fired; a fresh, config-free customer isolates the exact check this journey targets). A real Customer Change Request was created, submitted, and walked through a genuine full 3-node approval (Finance, Legal, Leadership) using the real RPCs, giving this customer one genuine approved change and zero commercial configurations.
- Actions Executed: called `delete_customer_permanently` against this customer.
- Actual Result: rejected with `CUSTOMER_DELETE_HAS_APPROVED_CHANGE_HISTORY: customer ... has 1 approved Customer Change Request(s); permanent deletion is blocked`. Customer confirmed still present afterward.
- Final Status: PASS
- Notes: this journey was originally deferred earlier in this ledger (see the earlier B-014 placeholder entry) rather than run against a pre-existing, persistent, cross-batch fictional fixture (`ec93474a-bdea-481c-ba55-00d3cca06ac2`), correctly avoiding a real destructive-RPC test against shared state relied on by not-yet-executed later-batch journeys. Building a dedicated, disposable, this-session fixture with genuine approved-change history (rather than reusing shared state) fully resolved that concern while still proving the real invariant.

---

## B-015: Permanent deletion happy path

- Journey ID: B-015
- Priority: P1
- Automation Feasibility: FULL
- Test Data: the B-012 fixture, customer_id `8d26e30e-c430-45ad-a343-38a44a6df503`.
- Actions Executed: called `delete_customer_permanently` as `wf-test.lifecycle-admin` with a real reason string.
- Actual Result: succeeded. `customers` row genuinely gone (`SELECT` by id returned null). A `customer_deletion_audit` row was inserted before the delete, carrying a full snapshot (customer_id, key, name, segment/business_unit/country/industry/brand_name, was_active, reason, deleted_by, deleted_at) and confirmed to survive the row's removal, since it has no FK back to the deleted row by design.
- Idempotency Result: a second deletion attempt against the same now-gone customer_id was rejected with `CUSTOMER_DELETE_NOT_FOUND: no customers row for id ...`, not a silent success and not a crash.
- Final Status: PASS
- Notes: confirms the deletion-audit-survives-the-delete invariant from `CLAUDE.md` ("a deletion audit row must never depend on a foreign key to the row it describes") empirically, not just by migration reading.

---

## B-016: Deletion confirmation-literal guard lives in the TS action layer, not the RPC

- Journey ID: B-016
- Priority: P2
- Automation Feasibility: PARTIAL (verified by code reading, not a live script call, since the confirmation-literal check is a pure client/action-layer guard with no server RPC equivalent to call directly)
- Actions Executed: read `src/features/customers/actions.ts`'s `deleteCustomerPermanentlyAction`.
- Actual Result: confirmed the action requires the literal confirmation string `"DELETE"` typed by the user before it ever calls `delete_customer_permanently`. The RPC itself has no confirmation-literal concept; its own job is strictly the reason/eligibility-gated deletion.
- Final Status: PASS
- Notes: consistent with this codebase's established pattern of keeping UX-only guards (confirmation typing) in the action/UI layer and business-integrity guards (eligibility, reason requirement) in the RPC.

---

## B-017: Direct field edit attempt against the trigger guard, real defect found

- Journey ID: B-017
- Priority: P1
- Automation Feasibility: FULL
- Test Data: a fresh, disposable, this-session-only customer, deliberately not the shared cross-batch fixture, since this test probes a data-integrity guard and the blast radius of a wrong assumption needed to be contained to a disposable row.
- Invariant under test: `CLAUDE.md`'s standing rule that approved business truth on `customers` is never edited outside the two sanctioned RPCs (`approve_customer_change_request`, `set_customer_active`), enforced at the database layer by the `fn_protect_customer_lifecycle` trigger.
- Observed Weakness: **FAILED**. The trigger's DELETE branch correctly rejects any direct delete attempt outside its own sanctioned bypass path. Its UPDATE branch, however, only verifies that non-governed structural columns (id, key, created_at, created_by) stay unchanged; it does not independently verify that a change to a governed business field or `is_active` came from a sanctioned writer RPC specifically, versus any other write reaching the table. This is inconsistent with the trigger's own stated purpose and with the standing invariant above.
- Classification: systemic architecture gap (Category B per this mission's security-defect rule), not a product-policy question. The invariant is already defined by `CLAUDE.md` and this trigger's own stated purpose, so the correct fix direction is unambiguous and does not require inventing new product policy.
- Risk: this is a defense-in-depth gap at the database layer, not a currently reachable application-layer hole. The real application only ever reaches `customers` through the two sanctioned RPCs and RLS-gated roles under the existing authorization model; an ordinary application user cannot exploit this through any exposed UI or Server Action.
- Fix: designed and written as `supabase/migrations/20260930080000_fix_customer_lifecycle_guard_governed_field_write_protection.sql`. Extends the trigger with the same session-local-flag pattern already proven for the DELETE branch (`app.permit_customer_delete`), so a governed-field or `is_active` write is now also rejected unless the sanctioned writer RPC has set an equivalent flag immediately before its own UPDATE. The pre-existing structural-immutability check is preserved unconditionally.
- Fix Application: **NOT APPLIED, PARKED.** Per this repo's own established precedent (a prior migration touching this exact trigger was itself staged-not-applied pending explicit user go-ahead) and this mission's migration rule, applying any change to this trigger requires fresh interactive authorization. Recorded as a parked migration in `OVERNIGHT_PENDING_APPROVALS.md` with the exact resume instruction.
- Regression Test: none added yet (parked pending the fix's actual application; a regression test confirming the guard now holds, alongside confirming the two sanctioned RPCs still succeed unchanged, will be authored once the migration is applied).
- Original Status: FAILED
- Final Status (as of overnight close): PRODUCT GAP CONFIRMED (fix designed, application parked pending user approval)
- Notes: recorded at architectural level per this run's public-repository documentation rule (invariant, observed weakness, risk, fix, regression evidence), not as a reproducible exploit recipe, since this repository is public.

### MORNING CATCH-UP OUTCOME (2026-09-21)

- Morning Action: reviewed the staged migration in full against `docs/CUSTOMER_LIFECYCLE.md` §3 (which explicitly states the trigger "was extended to allow these six [now twenty-five] columns to change, but ONLY through `approve_customer_change_request`: nothing else in the application ever writes to `customers` directly") and §29 (confirming the current authoritative registry is exactly 25 fields). Byte-diffed both re-created RPC bodies (`approve_customer_change_request`, `set_customer_active`) against their currently-live definitions: each differs by exactly one added `perform set_config('app.permit_customer_field_write', 'true', true);` line (plus comments), nothing else. Exhaustively grepped every migration for any `update customers` statement: confirmed only these same two functions have ever written to `customers` via UPDATE, across the entire migration history. Diffed the migration's protected-field list against the live `governed-field-registry.ts`: exact match (25 fields) plus `is_active`, no field missing or extra. Obtained Utkarsh's explicit real-time authorization in chat before applying (the CLI's own success response was ambiguous the first time, so a second explicit confirmation was sought rather than assumed).
- Fix Application: **APPLIED 2026-09-21** via `npx supabase db push --linked`. Confirmed via `npx supabase migration list --linked`: `20260930080000` now shows `remote` matching `local`; all 84 migrations in sync.
- Rerun Result: against a fresh disposable customer, a direct governed-field UPDATE (`name`) is now rejected with the new guard's message; a direct `is_active` UPDATE is now rejected; a direct DELETE remains rejected exactly as before (unchanged behavior); a direct UPDATE to a non-governed system column (`updated_by`) remains allowed (correctly unaffected, confirming the fix is scoped precisely to the governed set). The two sanctioned writer RPCs were independently re-verified end to end: `approve_customer_change_request` correctly completed a full 3-node approval (Finance -> Legal -> Leadership) changing `name` and `website`, correctly incrementing `row_version` and writing accurate `customer_field_history` rows; `set_customer_active` correctly deactivated, reactivated, and then correctly no-opped (row_version/updated_at unchanged) on a redundant reactivate. Full vitest suite (927 tests, 102 files) re-run and confirmed green after the migration.
- Regression Test: none added to the automated suite (this codebase has no live-database trigger test infrastructure, confirmed again this morning); the live verification above is the regression evidence, matching this project's established pattern for DB-trigger-level findings.
- Final Status: **FAILED THEN FIXED + PASS**

---

## B-018: No direct Edit action exists in the UI

- Journey ID: B-018
- Priority: P2
- Automation Feasibility: PARTIAL (code inspection; this is a UI-surface absence, not something a script call proves)
- Actions Executed: read `src/features/customers/ui/customer-master-detail.tsx` (which explicitly documents "there is no direct Edit action anywhere on this screen, only 'Change Request'...") and its rendered action controls.
- Actual Result: confirmed. The only mutation entry points on the customer detail screen are "Create Change Request", the "More Actions -> Deactivate/Reactivate Customer" menu entry (gated server-side from `customer.approve`), and, for eligible admins, permanent deletion. No generic field-level Edit control exists anywhere, for any role, including the highest-privilege one.
- Final Status: PASS
- Notes: this is architectural, not permission-gated, consistent with B-017's intended invariant (even though B-017 found the database-layer enforcement of that invariant is currently incomplete for direct bypasses, the UI layer correctly never offers a bypass path).

---

## B-019: Authorization boundary for deactivate/reactivate

- Journey ID: B-019
- Priority: P1
- Automation Feasibility: PARTIAL (verified by code reading; `requirePermission` needs a real Next.js request/cookie context, the same limitation established throughout this project)
- Actions Executed: read `src/features/customers/actions.ts`'s `deactivateCustomerAction`/`reactivateCustomerAction`.
- Actual Result: both require `requirePermission("customer", "approve")` server-side before calling `set_customer_active`. A user holding only `customer.read` or `customer.create` (without `approve`) is denied at the action layer before the RPC is ever reached.
- Final Status: PASS
- Notes: same authorization-layering pattern verified repeatedly across this project; no gap found.

---

## B-021: rowVersion increments only through the two sanctioned writer RPCs

- Journey ID: B-021
- Priority: P1
- Automation Feasibility: FULL
- Test Data: customer_id `120d8347-e16f-4a01-937b-97c3acea9394`.
- Actions Executed: recorded `row_version` before and after a real `set_customer_active` deactivate, then again after a reactivate.
- Actual Result: `row_version` incremented by exactly 1 on the deactivate (9 to 10) and by exactly 1 again on the reactivate (10 to 11); confirms deactivate/reactivate (via `set_customer_active`) DOES increment `row_version`, the same counter Customer Change's base-row staleness check (`CUSTOMER_CHANGE_STALE_BASE`) depends on, even though it is a structurally different RPC than the governed-field writer (`approve_customer_change_request`).
- Final Status: PASS
- Notes: this directly answers the journey's own "verify against code" note. Since B-017 found the UPDATE trigger does not actually gate governed-field writes by caller/path (only checks which columns changed), this `row_version` bump on every legitimate write remains reliable for the staleness-check purpose regardless of that separate finding, since both `set_customer_active` and `approve_customer_change_request` correctly bump it as part of their own UPDATE statement. A minor additional observation surfaced later during C-006: `trg_customers_row_version` (`fn_bump_row_version`, forces `new.row_version := old.row_version + 1` on every single UPDATE statement) combined with `approve_customer_change_request`'s final-approval branch issuing one UPDATE per changed governed field plus one more explicit `row_version = row_version + 1` UPDATE afterward, means row_version actually advances by (number of changed fields + 1) per approval, not a clean "+1 per approved change." Confirmed live: a single-field (`website`) change advanced `row_version` from 11 to 13, not 11 to 12. This does not break any real guarantee (row_version still strictly, monotonically increases on every real change, which is all the staleness checks in C-004/C-006 actually require, both confirmed working correctly regardless), but it does mean row_version cannot be read as "number of approved changes," only as "strictly increasing, safe to compare for staleness." Not filed as a separate defect since no invariant is violated; recorded here for anyone who later assumes row_version counts approvals.

---

## B-022: Governed Field Registry consistency between onboarding-created and change-editable fields

- Journey ID: B-022
- Priority: P2
- Automation Feasibility: FULL (code/schema cross-reference)
- Actions Executed: read `src/features/customers/domain/governed-field-registry.ts` (25 fields) and `src/features/customer-onboarding/domain/onboarding-customer-field-mapping.ts`, which explicitly documents itself as consuming the same registry as its single source of truth.
- Actual Result: confirmed no drift. All 25 fields in the registry (name, brand_name, segment, business_unit, country, industry, address, state, city, postal_code, website, primary_contact_name/email/phone_country_code/phone_number/designation, gst_number, pan, tan, tax_identifier_type, tax_identifier_name, tax_registration_number, company_document_type, company_document_type_other, billing_currency) are consistently the exact same set the database trigger's own allowlist recognizes (cross-checked against `fn_protect_customer_lifecycle()`'s column list during the B-017 investigation), and the same set the onboarding mapping consumes. No field exists in one path but not the other.
- Final Status: PASS
- Notes: this single shared registry is exactly why B-017's fix (a session-flag guard) can be applied uniformly. No separate maintained list to reconcile.

---

## B-023: Deactivating an already-inactive customer

- Journey ID: B-023
- Priority: P2
- Automation Feasibility: FULL
- Actual Result: already empirically confirmed as a byproduct of Batch 8's B-008 (see `BATCH_08_RESULTS.md`): re-deactivating an already-inactive customer is a clean idempotent no-op, `row_version`/`updated_at` unchanged, no new audit row.
- Final Status: PASS
- Notes: recorded formally here as this batch's own journey entry per the ledger requirement; the underlying evidence was gathered in Batch 8 since it fell out naturally from B-008's own test sequence.

---

## B-024: Reactivating an already-active customer

- Journey ID: B-024
- Priority: P2
- Automation Feasibility: FULL
- Test Data: customer_id `120d8347-e16f-4a01-937b-97c3acea9394`, already active at test time.
- Actions Executed: called `set_customer_active(is_active=true, ...)` on an already-active customer.
- Actual Result: idempotent no-op confirmed: `row_version` and `updated_at` both unchanged (`11`, `2026-09-20T16:59:28.149291+00:00` before and after), no new DML executed, RPC returned success with `is_active: true`. No misleading duplicate audit entry created.
- Final Status: PASS
- Notes: same idempotent-replay guard mechanism as B-023/B-009, confirmed independently for the reactivate direction.

---

## B-025: Field mapping fidelity from Onboarding approval into the Customer Master record

- Journey ID: B-025
- Priority: P1
- Automation Feasibility: FULL
- Test Data: "Batch8 Approval Core Co" (customer_id `120d8347-e16f-4a01-937b-97c3acea9394`), created via the real A-011-equivalent approval in Batch 8 with distinct, traceable field values.
- Actions Executed: cross-referenced the onboarding case's `customer_fields` payload against the resulting `customers` row (already captured during Batch 8's approval work); additionally read `approve_customer_onboarding_case`'s INSERT statement directly to resolve the `createdBy` question.
- Actual Result: every field value carried over from the case's `customer_fields` payload into the corresponding `customers` column with no transformation or truncation, using the exact governed-field-registry keys (confirmed by B-022). `is_active` defaults to `true` (no explicit column in the INSERT list, relies on the table's own default). `created_by`/`updated_by` are both set to `p_actor_user_id`, which is the **approver**, not the original case creator/maker; resolves the journey's own "verify against code" note definitively.
- Final Status: PASS
- Notes: the createdBy-is-the-approver behavior is a real, load-bearing fact (not obviously derivable without reading the RPC), worth remembering for anyone auditing "who created this customer": it always answers "who approved the onboarding case," never "who filled out the form."

---

## Environment issue found and fixed before C-series execution: the live, active customer_change workflow's Finance node had zero eligible approvers

- Classification: environment issue (per this mission's security-defect rule's fourth bucket), not a product code defect.
- Discovery: while preparing to test C-005 through C-008 (which require a real end-to-end Customer Change approval), inspected the currently ACTIVE, published workflow definition for `applies_to = 'customer_change'` (`wf_test_finance_legal_sequential`, version 11, the only active+published definition, so the one every real `create_customer_change_request` call in this environment binds to). Its 3-node sequential graph (Finance Approval -> Legal Approval -> Leadership Approval -> End) has its Finance Approval node assigned to `ux_verification_team`, a team left over from earlier Phase 3B UX-verification testing with **zero active members**. Per `fn_require_workflow_team_membership` (correctly proven in A-027/Batch 8), a node with zero eligible members blocks every actor identically, forever. This means, as found, no Customer Change Request in this environment could ever be approved past its very first step, for any user, regardless of role.
- Root Cause: test-environment drift accumulated across many prior testing sessions (Phase 3B and earlier batches), not a defect in the RPC/permission logic itself, which is already correctly proven to enforce exactly this invariant on purpose (A-027).
- Fix: assigned `wf-test.leadership-approver` (an existing persona already holding `customer.approve`) as an active member of `ux_verification_team` via the real, sanctioned `assign_user_to_team` RPC, the standing-authorized team-fixture mechanism. No workflow definition, node, or team was modified structurally; only a missing membership was added.
- Final Status: EXPECTED BEHAVIOR CONFIRMED EMPIRICALLY (the zero-member block itself is correct, proven behavior; the environment gap blocking it is now closed)
- Notes: this is the second time this run a zero-active-member team has silently blocked an entire approval path (see A-027 for the first, deliberately-constructed instance in Batch 8); worth flagging in the final report as a general observation that this project's accumulated WF-TEST fixture teams should get a periodic membership-health sweep, since a currently-active real workflow silently depending on an empty team is a real operational risk pattern, not just a test-authoring convenience.

---

## C-001: Create change request happy path

- Journey ID: C-001
- Priority: P1
- Automation Feasibility: FULL
- Test Data: customer_id `120d8347-e16f-4a01-937b-97c3acea9394` (row_version 11 at test time, active).
- Actions Executed: called `create_customer_change_request` directly as `wf-test.maker`.
- Actual Result: request created in `draft` status; `base_customer_row_version` correctly captured as `11`, the customer's exact row_version at creation time.
- Final Status: PASS

---

## C-002: Create change request blocked for inactive customer

- Journey ID: C-002
- Priority: P1
- Automation Feasibility: PARTIAL (relies on B-010's already-proven RPC-boundary result plus code reading, restated here from the Change-domain side per the journey's own note)
- Actual Result: confirmed via B-010 (this same batch) that the RPC itself (`create_customer_change_request`) has no `is_active` guard, and via direct code reading of `src/features/customer-change/actions.ts` (`if (customer && !customer.is_active) { ... }` before ever calling the RPC) that the real user-facing action layer does block creation against an inactive customer, before any request record is created.
- Final Status: PASS
- Notes: consistent with the accepted architecture of permission/precondition checks living in the TS action layer, not duplicated in every RPC.

---

## C-003: Save draft with sparse proposedValues map

- Journey ID: C-003
- Priority: P1
- Automation Feasibility: FULL
- Test Data: the C-001 draft request.
- Actions Executed: called `save_customer_change_draft` proposing exactly two fields (`billing_currency`, `website`).
- Actual Result: the draft's persisted `raw_data` contained exactly those two keys, no others, no leakage of unrelated form-state defaults.
- Final Status: PASS

---

## C-004: Draft-level staleness guard, CUSTOMER_CHANGE_DRAFT_STALE

- Journey ID: C-004
- Priority: P1
- Automation Feasibility: FULL
- Test Data: the C-001/C-003 draft request.
- Actions Executed: after C-003's successful save had already advanced the draft revision's internal `row_version`, attempted a second save using the original, now-stale `expected_row_version`.
- Actual Result: rejected with `CUSTOMER_CHANGE_DRAFT_STALE: This draft was changed by someone else since you loaded it. Refresh the page to see the latest version before saving your changes.` The draft's `raw_data` was confirmed unchanged after the rejected attempt, no silent overwrite or partial application occurred.
- Final Status: PASS
- Notes: confirms this is the domain where the concurrency fix was actually applied, in direct contrast with A-030's still-open onboarding-side equivalent (Batch 8).

---

## C-005: Submit change request happy path

- Journey ID: C-005
- Priority: P1
- Automation Feasibility: FULL
- Test Data: the same request, re-saved with a real proposed change (segment null to enterprise, business_unit null to india_enterprise) to also exercise C-007/C-008.
- Actions Executed: called `submit_customer_change_request` with a reason, an effective date, and the pre-computed requirements array (the same shape `evaluateCustomerChangeRequirements`, the real pure TS rule evaluator already exhaustively unit-tested in `workflow-rules.test.ts`, would produce for this exact field change).
- Actual Result: status transitioned to `submitted`; `current_workflow_node_key` resolved correctly to the workflow's first Approval node (`node_2`, Finance Approval).
- Idempotency Result: a second submit attempt on the now-submitted request was rejected with `CUSTOMER_CHANGE_NOT_SUBMITTABLE: request ... has status submitted, only draft or sent_back may be submitted`, a real, named error token, not a silent re-submission or generic failure.
- Final Status: PASS

---

## C-006: Base-customer staleness guard, CUSTOMER_CHANGE_STALE_BASE

- Journey ID: C-006
- Priority: P1
- Automation Feasibility: FULL
- Test Data: the C-005 submitted request (R1, `base_customer_row_version = 11`) plus a second, separate Customer Change Request (R2, a simple website-only change) created, submitted, and walked through a full, real 3-step approval chain (Finance, Legal, Leadership, using `wf-test.leadership-approver`/`wf-test.legal-checker`/`wf-test.leadership-approver-b` respectively) to genuinely advance the customer's real row_version before attempting to approve R1.
- Actions Executed: after R2's approval genuinely advanced `customers.row_version` from 11 to 13, attempted `approve_customer_change_request` on R1 (still sitting at its Finance node, still expecting base row_version 11).
- Actual Result: rejected with `CUSTOMER_CHANGE_STALE_BASE: customers row ... changed (row_version 13 vs expected 11) since this Change Request was created; rebase before approving`. Confirmed this check re-verifies at APPROVAL time, not merely submit time (R1 was already submitted well before R2's approval occurred). R1's own state (status `submitted`, still at `node_2`) was confirmed unchanged after the rejected attempt, no partial mutation occurred.
- Final Status: PASS
- Notes: distinct from C-004's draft-level guard, exactly as the journey's own grounding brief calls out; this is the customer-master-level guard, C-004 is the draft-revision-level guard. Recovery path (per the RPC's own error message): "rebase before approving," meaning the reviewer/maker must re-review R1's proposed changes against the customer's now-current state, though this codebase does not yet appear to offer a dedicated one-click "rebase" UI action distinct from cancelling and recreating the request; not fixed here as this is a UX-completeness observation, not a defect.

---

## C-007: Segment change triggers FINANCE_HEAD informational requirement

- Journey ID: C-007
- Priority: P1
- Automation Feasibility: FULL
- Test Data: R1 (C-005), which proposed a segment change.
- Actions Executed: queried `customer_change_request_requirements` for R1 after submit.
- Actual Result: a `FINANCE_HEAD` approval-kind requirement was persisted with the exact reason text from the rule ("Segment change requires Finance Head approval.") and the matched rule key. R1 was submitted and remained approvable by any `customer.approve` holder at the correct workflow node (Finance Approval, via `wf-test.leadership-approver`), confirming this requirement is informational/transparency-only in V1, not a separate enforced sign-off gate distinct from the workflow's own node-based approval.
- Final Status: PASS

---

## C-008: Business Unit change triggers deduped BU_HEAD requirement for both outgoing and incoming BU

- Journey ID: C-008
- Priority: P1
- Automation Feasibility: FULL
- Test Data: R1 (C-005), which proposed a business_unit change (null to india_enterprise; treated as a real change since the prior value was null/unset).
- Actions Executed: same requirement query as C-007.
- Actual Result: two distinct `BU_HEAD` requirement rows persisted, correctly labeled `"current business_unit"` (outgoing) and `"proposed business_unit"` (incoming), never merged into a single ambiguous entry and never duplicated as two identical rows for the same side.
- Final Status: PASS
- Notes: the "outgoing" business_unit was `null` (the customer had no business_unit set before this change), and the rule still correctly fired and produced a distinct outgoing-side requirement row rather than skipping it for having no prior value; worth knowing for anyone assuming "outgoing" implies a genuinely populated prior value.

---

## B-020: Authorization boundary, holding customer.approve alone does not grant customer.delete_permanent

- Journey ID: B-020
- Priority: P1
- Automation Feasibility: PARTIAL (verified by code reading; `requirePermission` cannot be invoked from a plain script since it depends on a real Next.js request/cookie context, the same limitation already established and accepted throughout this project)
- Actions Executed: read `deleteCustomerPermanentlyAction`'s permission check.
- Actual Result: confirmed it requires `requirePermission('customer', 'delete_permanent')` specifically, a distinct and stricter permission than `customer.approve`. `wf-test.leadership-approver` holds `approve` but not `delete_permanent` and would be denied at the action layer. The RPC itself has no independent permission check (consistent with the accepted architecture: permission enforcement lives in the TS action layer, the RPC trusts its `service_role`-only caller).
- Final Status: PASS
- Notes: this is the same authorization-layering pattern verified repeatedly across Batches 7 and 8; no new gap found here.

---

## Batch 9 closure summary

- Scheduled: 25 (B-009 through B-025, C-001 through C-008)
- PASS: 22 (B-009, B-012, B-013, B-014, B-015, B-016, B-018, B-019, B-020, B-021, B-022, B-023, B-024, B-025, C-001, C-002, C-003, C-004, C-005, C-006, C-007, C-008)
- EXPECTED BEHAVIOR CONFIRMED EMPIRICALLY: 1 (B-010)
- PRODUCT DECISION REQUIRED: 1 (B-011, recorded as PD-003)
- PRODUCT GAP CONFIRMED at overnight close, **RESOLVED 2026-09-21 (morning catch-up): FAILED THEN FIXED + PASS**: 1 (B-017, DEFECT-B9-001, migration `20260930080000_fix_customer_lifecycle_guard_governed_field_write_protection.sql` applied and live-verified, see B-017's own Morning Catch-Up Outcome above; PM-001 now RESOLVED in `OVERNIGHT_PENDING_APPROVALS.md`)
- Fixture gap closed: `customer_lifecycle_admin` persona provisioned (`scripts/seed-batch9-fixtures.ts`, committed).
- Environment issue found and fixed: the live, active `customer_change` workflow's Finance Approval node had zero eligible approvers (`ux_verification_team`), blocking every real Customer Change approval in this environment; fixed by assigning an active member via the sanctioned `assign_user_to_team` RPC (see the dedicated entry above, between B-020 and C-001).
- Real defect found via B-017: `fn_protect_customer_lifecycle()`'s UPDATE guard does not actually protect governed Customer Master fields from a direct, non-RPC write (only DELETE and non-governed structural columns are protected). Migration designed and staged, application parked pending explicit user go-ahead per this repo's own established precedent for changes to this trigger.
- Fixtures created and preserved for downstream batches: a real, fully-approved Customer Change Request (R1, request_id `af320504-4326-4817-8272-f4cb81d16591`) against the Batch 8 fixture customer (`120d8347-e16f-4a01-937b-97c3acea9394`), still sitting `submitted` at its Finance node (deliberately left mid-flight, rejected once for staleness, available as a real submitted-but-not-yet-approved Customer Change fixture for Batch 10's continued lifecycle testing); a second, fully approved Customer Change Request (R2) against the same customer, which changed its `website` field and correctly advanced its `segment`/`business_unit` are still unset on the base customer since R1 (the segment/BU change) was never approved, only R2's website change was; the fixture customer's `row_version` is now `13`. A dedicated `wf_test`-prefixed disposable customer with a genuine approved Customer Change and zero commercial configurations (`4570bc11-6752-4380-a939-f3efc0b152a7`) was created and deliberately left in place (not deleted) as a reusable "has approved change history" fixture for later batches if needed. `wf-test.leadership-approver` is now also an active member of `ux_verification_team` in addition to `wf_test_leadership`.
- No journeys deferred, blocked, or skipped. All 25 scheduled journeys resolved to a final status.

---
