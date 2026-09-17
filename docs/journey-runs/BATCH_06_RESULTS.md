# Batch 6 Journey Run Ledger

Persistent, live-updated record for NEXUS END-TO-END BUSINESS JOURNEY
VALIDATION BATCH 6 (O-018 through O-025, P-001 through P-017, 25
journeys total). Created before execution begins per the mandatory
persistent ledger requirement; updated as each journey completes.

Allowed Final Status values: PASS / FAILED THEN FIXED + PASS / BLOCKED /
PRODUCT GAP CONFIRMED / EXPECTED BEHAVIOR CONFIRMED EMPIRICALLY.

If a journey fails and is later fixed, both Original Status: FAILED and
Final Status: FAILED THEN FIXED + PASS are preserved. History is never
rewritten to make a journey look like it passed the first time.

---

## O-018: Last Remaining Active Member of a Team Removed While a Request Waits (Real, Unhandled Gap)

- Journey ID: O-018
- Journey Name: Last Remaining Active Member of a Team Removed While a Request Waits at That Team's Node
- Started At: TBD
- Completed At: TBD
- Priority: P1
- Automation Feasibility: FULL
- Personas: team_admin, M (sole active member)
- Test Data / Record References: TBD
- Starting State: Team X has exactly one active member, M; a request sits at an Approval node responsible to Team X
- Actions Executed: TBD
- Expected Result: Admin revokes M's membership, leaving Team X with zero active members; the request remains stuck at its node with no automatic reassignment/alert/escalation; admin assigns a new member, who can then act on the previously stuck request
- Actual Result: TBD
- Regular Path Result: TBD
- Stress Variant Result: N/A (multiple stuck requests not separately seeded; the mechanism has no per-request special-casing)
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: TBD
- Recovery Result: TBD
- UX Result: TBD
- Historical Result: N/A
- Performance Result: N/A
- Original Status: TBD
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: TBD
- Notes: Directly corresponds to PERMISSION-CHANGE scenario 10; a real, disclosed-by-design operational risk, not to be redesigned in this pass.

---

## O-019: User Moves From One Team to a Different Team Between Two Approval Levels

- Journey ID: O-019
- Journey Name: User Moves From One Team to a Different Team Between Two Approval Levels of the Same Workflow
- Started At: TBD
- Completed At: TBD
- Priority: P1
- Automation Feasibility: FULL
- Personas: team_admin, M
- Test Data / Record References: TBD
- Starting State: A multi-step workflow with level 1 responsible to Team Finance and level 2 responsible to Team Legal; M starts as an active Finance member only
- Actions Executed: TBD
- Expected Result: M approves level 1 as Finance; before level 2, M's Finance membership is revoked and Legal membership granted; M can approve level 2 as Legal, correctly reflecting membership at that later point, not at request creation
- Actual Result: TBD
- Regular Path Result: TBD
- Stress Variant Result: N/A
- Authorization Result: TBD (if M had NOT been granted Legal, correctly cannot act at level 2 despite approving level 1)
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: TBD
- Recovery Result: N/A
- UX Result: N/A
- Historical Result: TBD
- Performance Result: N/A
- Original Status: TBD
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: O-009, O-015
- Final Status: TBD
- Notes: Directly corresponds to PERMISSION-CHANGE scenario 11.

---

## O-020: Search and Filter the Team List

- Journey ID: O-020
- Journey Name: Search and Filter the Team List
- Started At: TBD
- Completed At: TBD
- Priority: P3
- Automation Feasibility: FULL
- Personas: team_admin
- Test Data / Record References: TBD
- Starting State: Multiple teams exist, active and inactive
- Actions Executed: TBD
- Expected Result: Admin searches by team code/name and/or filters by active/inactive; result set narrows correctly
- Actual Result: TBD
- Regular Path Result: TBD
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: N/A
- Recovery Result: N/A
- UX Result: TBD
- Historical Result: N/A
- Performance Result: N/A
- Original Status: TBD
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N-027 (Batch 5, same shape of finding on the User Access list)
- Final Status: TBD
- Notes: N/A

---

## O-021: Team Membership Assignment Requires team.write, Separate From user_access.write

- Journey ID: O-021
- Journey Name: Team Membership Assignment Requires team.write, a Permission Separate From user_access.write
- Started At: TBD
- Completed At: TBD
- Priority: P1
- Automation Feasibility: FULL
- Personas: user_access_admin lacking team.write
- Test Data / Record References: TBD
- Starting State: A user holds user_access_admin (user_access.write) but has never been granted team_admin (team.write)
- Actions Executed: TBD
- Expected Result: This user attempts to assign a team membership; requirePermission(team, write) throws missing_permission even though the user has full user_access.write
- Actual Result: TBD
- Regular Path Result: N/A
- Stress Variant Result: N/A
- Authorization Result: TBD (this IS the authorization variant)
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: TBD
- Recovery Result: N/A
- UX Result: N/A
- Historical Result: N/A
- Performance Result: N/A
- Original Status: TBD
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: O-022, N-008
- Final Status: TBD
- Notes: N/A

---

## O-022: A team.write Holder Without user_access.write Can Manage Teams but Not Roles

- Journey ID: O-022
- Journey Name: A team.write Holder Without user_access.write Can Manage Teams but Not Roles
- Started At: TBD
- Completed At: TBD
- Priority: P1
- Automation Feasibility: FULL
- Personas: team_admin lacking user_access.write
- Test Data / Record References: TBD
- Starting State: A user holds team_admin (team.write) only, no user_access_admin
- Actions Executed: TBD
- Expected Result: This user successfully manages teams; attempts to grant a role via grant_user_role and is denied with missing_permission for user_access.write
- Actual Result: TBD
- Regular Path Result: N/A
- Stress Variant Result: N/A
- Authorization Result: TBD (this IS the authorization variant)
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: TBD
- Recovery Result: N/A
- UX Result: N/A
- Historical Result: N/A
- Performance Result: N/A
- Original Status: TBD
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: O-021
- Final Status: TBD
- Notes: N/A

---

## O-023: Full Historical Team Membership Timeline for a User

- Journey ID: O-023
- Journey Name: Full Historical Team Membership Timeline for a User
- Started At: TBD
- Completed At: TBD
- Priority: P1
- Automation Feasibility: FULL
- Personas: team_admin, auditor
- Test Data / Record References: TBD
- Starting State: A user with several team membership cycles
- Actions Executed: TBD
- Expected Result: Every historical user_teams row is visible in order with granted_by/granted_at and revoked_by/revoked_at where applicable; none missing or overwritten; DELETE structurally forbidden
- Actual Result: TBD
- Regular Path Result: TBD
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: TBD
- Recovery Result: N/A
- UX Result: TBD
- Historical Result: TBD
- Performance Result: N/A
- Original Status: TBD
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: O-009, O-010, N-029 (Batch 5, same shape of finding: data intact, no viewing UI)
- Final Status: TBD
- Notes: N/A

---

## O-024: New Team Is Immediately Assignable

- Journey ID: O-024
- Journey Name: New Team Is Immediately Assignable
- Started At: TBD
- Completed At: TBD
- Priority: P3
- Automation Feasibility: FULL
- Personas: team_admin
- Test Data / Record References: TBD
- Starting State: N/A
- Actions Executed: TBD
- Expected Result: Admin creates a team; in the same session, immediately assigns a member to it, succeeding with no additional activation step
- Actual Result: TBD
- Regular Path Result: TBD
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: N/A
- Recovery Result: N/A
- UX Result: N/A
- Historical Result: N/A
- Performance Result: N/A
- Original Status: TBD
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: O-001 (Batch 5)
- Final Status: TBD
- Notes: Already substantially proven in Batch 5 (O-001 creates the team, O-008/O-013 immediately assign it without any activation step); this entry formalizes that combined evidence.

---

## O-025: Two Admins Simultaneously Assign the Same User to the Same Team

- Journey ID: O-025
- Journey Name: Two Admins Simultaneously Assign the Same User to the Same Team
- Started At: TBD
- Completed At: TBD
- Priority: P2
- Automation Feasibility: PARTIAL
- Personas: two team_admins acting concurrently
- Test Data / Record References: TBD
- Starting State: User has no active membership in Team X
- Actions Executed: TBD
- Expected Result: Both admins submit an assign-membership action for the same user/team pair at nearly the same instant; exactly one active row results, never two
- Actual Result: TBD
- Regular Path Result: N/A
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: TBD (this IS the concurrency variant)
- Idempotency Result: N/A
- Audit/Data Integrity Result: TBD
- Recovery Result: N/A
- UX Result: TBD
- Historical Result: N/A
- Performance Result: N/A
- Original Status: TBD
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: O-008 (Batch 5)
- Final Status: TBD
- Notes: PARTIAL automation feasibility per the Universe doc; test via two simultaneous RPC calls, matching the O-002 concurrency pattern already used in Batch 5.

---

## P-001: Add New Level 1 Configurable Option (Segment)

- Journey ID: P-001
- Journey Name: Add New Level 1 Configurable Option (Segment)
- Started At: TBD
- Completed At: TBD
- Priority: P2
- Automation Feasibility: FULL
- Personas: Reference Master Admin
- Test Data / Record References: TBD
- Starting State: Segment list exists with an established set of active values
- Actions Executed: TBD
- Expected Result: Admin invokes addStandardOptionAction with a new label; value appears active and immediately selectable; new reference_options row inserted with is_active=true, captured by fn_audit_row with actor populated; re-submitting the identical add twice does not create duplicate rows
- Actual Result: TBD
- Regular Path Result: TBD
- Stress Variant Result: TBD (very long label, leading/trailing whitespace normalization)
- Authorization Result: N/A (see P-017)
- Concurrency Result: N/A (see P-023)
- Idempotency Result: TBD
- Audit/Data Integrity Result: TBD
- Recovery Result: N/A
- UX Result: TBD
- Historical Result: N/A
- Performance Result: N/A
- Original Status: TBD
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: TBD
- Notes: Representative of all four Level 1 categories; P-002/003/004 are analogous, not repeated in full detail.

---

## P-002: Add New Level 1 Configurable Option (Business Unit)

- Journey ID: P-002
- Journey Name: Add New Level 1 Configurable Option (Business Unit)
- Started At: TBD
- Completed At: TBD
- Priority: P3
- Automation Feasibility: FULL
- Personas: Reference Master Admin
- Test Data / Record References: TBD
- Starting State: Business Unit list has existing active values
- Actions Executed: TBD
- Expected Result: New Business Unit value added, selectable in new onboarding drafts/commercial configurations; is_active=true on insert
- Actual Result: TBD
- Regular Path Result: TBD
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: TBD
- Recovery Result: N/A
- UX Result: N/A
- Historical Result: N/A
- Performance Result: N/A
- Original Status: TBD
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: P-001
- Final Status: TBD
- Notes: N/A

---

## P-003: Add New Level 1 Configurable Option (Industry/Category)

- Journey ID: P-003
- Journey Name: Add New Level 1 Configurable Option (Industry/Category)
- Started At: TBD
- Completed At: TBD
- Priority: P3
- Automation Feasibility: FULL
- Personas: Reference Master Admin
- Test Data / Record References: TBD
- Starting State: Industry/Category list has existing active values
- Actions Executed: TBD
- Expected Result: New value added, selectable in new customer onboarding drafts; is_active=true on insert
- Actual Result: TBD
- Regular Path Result: TBD
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: TBD
- Recovery Result: N/A
- UX Result: N/A
- Historical Result: N/A
- Performance Result: N/A
- Original Status: TBD
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: P-001
- Final Status: TBD
- Notes: N/A

---

## P-004: Add New Level 1 Configurable Option (Tax Identifier Type)

- Journey ID: P-004
- Journey Name: Add New Level 1 Configurable Option (Tax Identifier Type)
- Started At: TBD
- Completed At: TBD
- Priority: P3
- Automation Feasibility: FULL
- Personas: Reference Master Admin
- Test Data / Record References: TBD
- Starting State: Tax Identifier Type list has existing active values
- Actions Executed: TBD
- Expected Result: New value added, selectable when a tax document is classified during onboarding; is_active=true on insert
- Actual Result: TBD
- Regular Path Result: TBD
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: TBD
- Recovery Result: N/A
- UX Result: N/A
- Historical Result: N/A
- Performance Result: N/A
- Original Status: TBD
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: P-001
- Final Status: TBD
- Notes: N/A

---

## P-005: Deactivate a Level 1 Value Not Currently Referenced

- Journey ID: P-005
- Journey Name: Deactivate a Level 1 Value Not Currently Referenced
- Started At: TBD
- Completed At: TBD
- Priority: P2
- Automation Feasibility: FULL
- Personas: Reference Master Admin
- Test Data / Record References: TBD
- Starting State: A Segment value exists that no customer record currently references
- Actions Executed: TBD
- Expected Result: Admin invokes setOptionActiveAction(false); it disappears from selectable lists immediately; fn_audit_row captures the update; deactivating an already-inactive value is a no-op
- Actual Result: TBD
- Regular Path Result: TBD
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: TBD
- Audit/Data Integrity Result: TBD
- Recovery Result: N/A (see P-007)
- UX Result: TBD
- Historical Result: N/A
- Performance Result: N/A
- Original Status: TBD
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: P-006, P-007
- Final Status: TBD
- Notes: N/A

---

## P-006: Deactivate a Segment Value Referenced by an Approved Customer

- Journey ID: P-006
- Journey Name: Deactivate a Segment Value Referenced by an Approved Customer
- Started At: TBD
- Completed At: TBD
- Priority: P0
- Automation Feasibility: FULL
- Personas: Reference Master Admin, any viewer of Customer X
- Test Data / Record References: TBD
- Starting State: Customer X is approved and holds a specific Segment value; no other customer uses it
- Actions Executed: TBD
- Expected Result: Admin deactivates the value; Customer X's detail page still renders it unconditionally, exactly as before; only NEW drafts lose it as an option; Customer X's own record/audit trail shows no change
- Actual Result: TBD
- Regular Path Result: TBD
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: TBD
- Recovery Result: N/A
- UX Result: TBD
- Historical Result: TBD (this IS the historical-preservation check)
- Performance Result: N/A
- Original Status: TBD
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: P-005, P-007, P-010
- Final Status: TBD
- Notes: A core, regression-critical data-integrity guarantee explicitly called out in the grounding brief.

---

## P-007: Reactivate a Previously Deactivated Level 1 Value

- Journey ID: P-007
- Journey Name: Reactivate a Previously Deactivated Level 1 Value
- Started At: TBD
- Completed At: TBD
- Priority: P3
- Automation Feasibility: FULL
- Personas: Reference Master Admin
- Test Data / Record References: TBD
- Starting State: The P-006 value is currently inactive
- Actions Executed: TBD
- Expected Result: Admin invokes setOptionActiveAction(true); value reappears in new-draft dropdowns immediately; reactivating an already-active value is a no-op; fn_audit_row captures the second flip, full history of both flips preserved; Customer X (from P-006) is unaffected either way
- Actual Result: TBD
- Regular Path Result: TBD
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: TBD
- Audit/Data Integrity Result: TBD
- Recovery Result: N/A
- UX Result: TBD
- Historical Result: TBD
- Performance Result: N/A
- Original Status: TBD
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: P-005, P-006
- Final Status: TBD
- Notes: N/A

---

## P-008: Add a Currency Option With inrConversionRate (Level 2)

- Journey ID: P-008
- Journey Name: Add a Currency Option With inrConversionRate (Level 2)
- Started At: TBD
- Completed At: TBD
- Priority: P2
- Automation Feasibility: FULL
- Personas: Reference Master Admin
- Test Data / Record References: TBD
- Starting State: Currency list has an established set of active currencies with rates
- Actions Executed: TBD
- Expected Result: Admin invokes addCurrencyOptionAction with code, label, inrConversionRate; new currency appears active with the rate stored, distinct from is_active
- Actual Result: TBD
- Regular Path Result: TBD
- Stress Variant Result: TBD (zero/negative rate, extreme-precision decimal)
- Authorization Result: N/A (see P-017 family)
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: TBD
- Recovery Result: N/A
- UX Result: TBD
- Historical Result: N/A
- Performance Result: N/A
- Original Status: TBD
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: P-009, P-010
- Final Status: TBD
- Notes: N/A

---

## P-009: Update Currency inrConversionRate, Confirm Non-Retroactivity

- Journey ID: P-009
- Journey Name: Update Currency inrConversionRate, Confirm Non-Retroactivity
- Started At: TBD
- Completed At: TBD
- Priority: P0
- Automation Feasibility: FULL
- Personas: Reference Master Admin, Commercial Configuration viewer
- Test Data / Record References: TBD
- Starting State: A currency has a known rate; a Commercial Component was created earlier and froze that rate as fx_snapshot_rate
- Actions Executed: TBD
- Expected Result: Admin updates the rate; new components created after freeze the new rate; the pre-existing component's fx_snapshot_rate remains unchanged; a concurrent component-creation freezes whichever rate was committed at its own creation instant
- Actual Result: TBD
- Regular Path Result: TBD
- Stress Variant Result: TBD (rate updated multiple times in quick succession)
- Authorization Result: N/A (see P-019)
- Concurrency Result: TBD
- Idempotency Result: N/A
- Audit/Data Integrity Result: TBD
- Recovery Result: N/A
- UX Result: TBD
- Historical Result: TBD (the primary non-retroactivity check)
- Performance Result: N/A
- Original Status: TBD
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: P-008, P-010
- Final Status: TBD
- Notes: N/A

---

## P-010: Deactivate a Currency Referenced by an Active Commercial Component

- Journey ID: P-010
- Journey Name: Deactivate a Currency Referenced by an Active Commercial Component
- Started At: TBD
- Completed At: TBD
- Priority: P0
- Automation Feasibility: FULL
- Personas: Reference Master Admin
- Test Data / Record References: TBD
- Starting State: A currency is active and referenced by an active Commercial Component with a frozen fx_snapshot_rate
- Actions Executed: TBD
- Expected Result: Admin deactivates the currency; the existing component continues to display/operate at its frozen rate; only new drafts lose it as a selectable currency
- Actual Result: TBD
- Regular Path Result: TBD
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: TBD
- Recovery Result: N/A
- UX Result: TBD
- Historical Result: TBD
- Performance Result: N/A
- Original Status: TBD
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: P-006, P-009
- Final Status: TBD
- Notes: N/A

---

## P-011: Add an Invoice Frequency Option With cadenceMonths (Level 2)

- Journey ID: P-011
- Journey Name: Add an Invoice Frequency Option With cadenceMonths (Level 2)
- Started At: TBD
- Completed At: TBD
- Priority: P2
- Automation Feasibility: FULL
- Personas: Reference Master Admin
- Test Data / Record References: TBD
- Starting State: Invoice Frequency list has existing values (e.g. Monthly=1, Quarterly=3)
- Actions Executed: TBD
- Expected Result: Admin invokes addInvoiceFrequencyOptionAction with a label and cadenceMonths; new value active and selectable in new drafts
- Actual Result: TBD
- Regular Path Result: TBD
- Stress Variant Result: TBD (cadenceMonths=0/negative, non-integer)
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: TBD
- Recovery Result: N/A
- UX Result: TBD
- Historical Result: N/A
- Performance Result: N/A
- Original Status: TBD
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: P-012
- Final Status: TBD
- Notes: N/A

---

## P-012: Update Invoice Frequency cadenceMonths After In-Flight Components Reference It

- Journey ID: P-012
- Journey Name: Update Invoice Frequency cadenceMonths After In-Flight Components Reference It
- Started At: TBD
- Completed At: TBD
- Priority: P1
- Automation Feasibility: PARTIAL
- Personas: Reference Master Admin
- Test Data / Record References: TBD
- Starting State: A cadence value is used by an existing active Commercial Component whose invoicing schedule was already generated from it
- Actions Executed: TBD
- Expected Result: Admin edits the cadence value; existing component's already-generated schedule/frozen cadence is unaffected; only new components pick up the new cadence
- Actual Result: TBD
- Regular Path Result: TBD
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: TBD
- Recovery Result: N/A
- UX Result: TBD
- Historical Result: TBD
- Performance Result: N/A
- Original Status: TBD
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: P-009, P-011
- Final Status: TBD
- Notes: Exact snapshot mechanism for cadence needs confirming against code before asserting; PARTIAL per the Universe doc until confirmed.

---

## P-013: Attempt to Add a New Level 3 System-Supported Option (Commercial Nature)

- Journey ID: P-013
- Journey Name: Attempt to Add a New Level 3 System-Supported Option (Commercial Nature)
- Started At: TBD
- Completed At: TBD
- Priority: P1
- Automation Feasibility: PARTIAL
- Personas: Reference Master Admin
- Test Data / Record References: TBD
- Starting State: Commercial Nature list shows its fixed system-supported set
- Actions Executed: TBD
- Expected Result: No "Add" control is present for this category; a direct action call attempt is rejected server-side
- Actual Result: TBD
- Regular Path Result: TBD
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: TBD (no insert audit row since no insert occurs)
- Recovery Result: N/A
- UX Result: TBD
- Historical Result: N/A
- Performance Result: N/A
- Original Status: TBD
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: P-014, P-015
- Final Status: TBD
- Notes: Must attempt the direct server action call, not just check UI absence, to confirm server-side enforcement.

---

## P-014: Deactivate a Level 3 System-Supported Value (Pricing Models)

- Journey ID: P-014
- Journey Name: Deactivate a Level 3 System-Supported Value (Pricing Models)
- Started At: TBD
- Completed At: TBD
- Priority: P2
- Automation Feasibility: FULL
- Personas: Reference Master Admin
- Test Data / Record References: TBD
- Starting State: Pricing Models list has its fixed system-supported set, all currently active
- Actions Executed: TBD
- Expected Result: Admin deactivates an unused value; it disappears from new-component selection; deactivating twice is a no-op; no add/edit control present alongside activate/deactivate for this category
- Actual Result: TBD
- Regular Path Result: TBD
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: TBD
- Audit/Data Integrity Result: TBD
- Recovery Result: TBD (reactivation works the same as Level 1/2)
- UX Result: TBD
- Historical Result: N/A
- Performance Result: N/A
- Original Status: TBD
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: P-013, P-015
- Final Status: TBD
- Notes: N/A

---

## P-015: Deactivate a Level 3 Value Referenced by an Existing Commercial Component (Revenue Recognition Method)

- Journey ID: P-015
- Journey Name: Deactivate a Level 3 Value Referenced by an Existing Commercial Component (Revenue Recognition Method)
- Started At: TBD
- Completed At: TBD
- Priority: P0
- Automation Feasibility: FULL
- Personas: Reference Master Admin
- Test Data / Record References: TBD
- Starting State: An active Commercial Component uses a specific Revenue Recognition Method
- Actions Executed: TBD
- Expected Result: Admin deactivates the method; the existing component continues to render/operate under it unconditionally; only new drafts lose it as an option
- Actual Result: TBD
- Regular Path Result: TBD
- Stress Variant Result: N/A
- Authorization Result: N/A
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: TBD
- Recovery Result: N/A
- UX Result: TBD
- Historical Result: TBD (same family as P-006/P-010, applied to a Level 3 value)
- Performance Result: N/A
- Original Status: TBD
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: P-006, P-010, P-013, P-014
- Final Status: TBD
- Notes: N/A

---

## P-016: View Country / Phone Country Code Lists, Confirm Not Editable

- Journey ID: P-016
- Journey Name: View Country / Phone Country Code Lists, Confirm Not Editable
- Started At: TBD
- Completed At: TBD
- Priority: P2
- Automation Feasibility: MANUAL
- Personas: Reference Master Admin
- Test Data / Record References: TBD
- Starting State: N/A (static package-sourced data)
- Actions Executed: TBD
- Expected Result: Lists render correctly but no add/activate/deactivate/edit control exists anywhere; no reference_options rows or audit entries are ever created for these lists
- Actual Result: TBD
- Regular Path Result: TBD
- Stress Variant Result: N/A
- Authorization Result: N/A (permission is irrelevant since there is nothing to write)
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: TBD
- Recovery Result: N/A
- UX Result: TBD
- Historical Result: N/A
- Performance Result: N/A
- Original Status: TBD
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: N/A
- Final Status: TBD
- Notes: An honesty-check journey, not a defect hunt; confirm the UI does not present false affordances.

---

## P-017: addStandardOptionAction Attempted Without reference_master.write

- Journey ID: P-017
- Journey Name: addStandardOptionAction Attempted Without reference_master.write
- Started At: TBD
- Completed At: TBD
- Priority: P0
- Automation Feasibility: FULL
- Personas: Non-privileged authenticated user
- Test Data / Record References: TBD
- Starting State: A user is authenticated but lacks reference_master.write
- Actions Executed: TBD
- Expected Result: Direct invocation of addStandardOptionAction throws AuthorizationError(missing_permission); no row is inserted; if attempted via UI, the Reference Master screen itself never renders the add control for this user (AuthGate)
- Actual Result: TBD
- Regular Path Result: N/A
- Stress Variant Result: N/A
- Authorization Result: TBD
- Concurrency Result: N/A
- Idempotency Result: N/A
- Audit/Data Integrity Result: TBD
- Recovery Result: N/A
- UX Result: TBD
- Historical Result: N/A
- Performance Result: N/A
- Original Status: TBD
- Defect IDs: None
- Root Cause: N/A
- Fix: N/A
- Fix Commit: N/A
- Regression Test: N/A
- Rerun Result: N/A
- Neighboring Journeys Rerun: P-018, P-019
- Final Status: TBD
- Notes: Test via direct action invocation, not only via UI, per the AuthGate-is-rendering-convenience-only principle from Pack U.
