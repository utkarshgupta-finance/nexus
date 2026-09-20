# Product Gap Triage: Batches 3-6

Originally a triage-only document (no product behavior changed to
produce it): docs-only analysis of the 11 journeys across Batches 3-6
whose Final Status is PRODUCT GAP CONFIRMED. A subsequent Product Gap
Closure pass then implemented the FIX NOW gaps and the two decisions
below; see IMPLEMENTATION OUTCOME at the end of this document for what
actually happened. The triage classifications and reasoning below are
preserved exactly as originally written, not rewritten as if the
implementation had already happened at triage time.

## Mechanical verification of the gap count

Grepped every batch ledger for `Final Status: PRODUCT GAP CONFIRMED`:

- `docs/journey-runs/BATCH_03_RESULTS.md`: 0 matches (own Final Report
  confirms `PRODUCT GAP CONFIRMED: 0`).
- `docs/journey-runs/BATCH_04_RESULTS.md`: 0 matches (own Final Report
  confirms `PRODUCT GAP CONFIRMED: 0`).
- `docs/journey-runs/BATCH_05_RESULTS.md`: 6 matches: N-026, N-027,
  N-029, N-030, N-031, O-011 (own Final Report confirms
  `PRODUCT GAP CONFIRMED: 6` and lists the same six IDs).
- `docs/journey-runs/BATCH_06_RESULTS.md`: 5 matches: O-018, O-020,
  O-023, P-012, P-013 (own Final Report confirms
  `PRODUCT GAP CONFIRMED: 5 (O-018, O-020, O-023, P-012, P-013)`).

**Total: 11.** Matches the overnight report's stated count exactly. No
discrepancy to explain.

### Explicitly excluded, and why

These journeys were considered because Step 5 of the triage brief named
them, but their actual Final Status in the ledger is not
`PRODUCT GAP CONFIRMED`, so they are excluded here:

- **N-013 (Batch 4), self-grant of an elevated role via `user_access.write`.**
  Final Status: PASS. `docs/AUTHORIZATION_MODEL.md` §18's last bullet
  explicitly documents this as intended design ("this is the intended
  design, not a gap... recorded here only so a future reader does not
  rediscover and re-litigate it as if it were new"), and the ledger
  itself calls it "a real, intentional gap per the grounding brief, not
  a defect." Not included in this triage.
- **O-005 (Batch 5), deactivating a team does not block existing
  members from approving in-flight requests.** Final Status:
  `EXPECTED BEHAVIOR CONFIRMED EMPIRICALLY`, not
  `PRODUCT GAP CONFIRMED`. The ledger frames this as a documented,
  known inconsistency the mission instructed to confirm rather than
  invent as a new defect. It shares its underlying mechanism with
  O-018 below (both concern team deactivation/membership loss during
  in-flight work), so it is referenced as context inside O-018's entry,
  but it is not counted as one of the 11 and receives no separate A/B/C/D
  classification of its own.
- **No remaining Batch 3 Authentication/Session gap and no remaining
  Batch 4 User/Role/Permission gap exist.** Both ledgers' own Final
  Reports state `PRODUCT GAP CONFIRMED: 0`; every deviation in those two
  batches was either fixed (DEFECT-B3-001/002/003, DEFECT-B4-001) or
  confirmed as expected behavior (U-002's absence of client-side rate
  limiting, N-022's role_permissions recovery mechanics). Nothing from
  Batches 3-4 belongs in this triage.

## The 11 gaps

### Gap 1: N-030, grant_user_role permits assigning a deactivated role

- **Journey ID:** N-030
- **Batch:** 5
- **Domain:** Users / Roles / Permissions
- **Journey Name:** Attempt to Grant a Deactivated (is_active = false) Role
- **Original expected behavior:** Deactivated roles do not appear in the
  grant-role selector; the RPC layer independently rejects a direct
  grant attempt for a deactivated role.
- **Actual observed behavior:** The UI correctly hides deactivated
  roles from the selector (`listActiveRoles()` filters
  `is_active = true`). A direct `grant_user_role` RPC call for a role
  created with `is_active = false` succeeded with no error, creating a
  live, active `user_roles` grant row.
- **Why classified as Product Gap:** `grant_user_role`'s own SQL body
  performs no check against `roles.is_active` before inserting; it only
  checks for an existing active `user_roles` row for idempotency.
- **Current code/database mechanism:** `grant_user_role`
  (`supabase/migrations/20260916050000_user_access_foundation.sql:144-173`).
  Contrast: `getActiveGlobalRolesForUser`/`getActivePermissionsForRoles`
  (the read-side permission resolver proven in N-023/N-024) DO filter
  `roles.is_active = true` and `permissions.is_active = true` on every
  request, so a grant against a deactivated role currently contributes
  zero effective permission while the role stays deactivated.
- **Business consequence:** A dormant, out-of-policy grant can exist
  without anyone deciding to create it as a live grant.
- **Security consequence:** Low today (the grant is inert while the
  role stays deactivated), but if the role is later reactivated for an
  unrelated reason, this specific user's access resurrects with no
  fresh grant decision by anyone.
- **Financial/control consequence:** None identified today; would
  become relevant only if a deactivated role tied to a
  finance-sensitive permission set were ever reactivated while carrying
  silently-created grants.
- **Operational consequence:** An admin auditing "who currently holds
  role X" would see a grant they never consciously made once the role
  is reactivated.
- **UX consequence:** None visible; the UI already hides this
  correctly, so no admin currently sees the ability to do this.
- **Data-integrity consequence:** A `user_roles` row exists that
  represents an intent nobody actually had at the moment of insert.
- **Historical/audit consequence:** The grant is fully attributed
  (`created_by` correctly captured, per N-028's attribution proof), so
  it is auditable after the fact; it is just wrong that it could be
  created at all.
- **Blast radius:** Narrow. Requires bypassing the UI to reach
  `grant_user_role` directly for a role that is currently deactivated;
  no normal admin workflow reaches this path.
- **Existing compensating control:** The permission-resolution chain
  (N-023/N-024) already ignores permissions derived from a deactivated
  role, so this grant is inert unless/until the role is reactivated.
- **Can current behavior cause silent incorrect truth?** Yes: a
  `user_roles` row implying "this user was intentionally granted this
  role" exists without that intent ever having been real at grant time.
- **Can current behavior create orphaned work?** No.
- **Can current behavior bypass authorization/governance?** Yes, in a
  narrow sense: it bypasses the UI-enforced rule that only active roles
  are grantable, at the RPC layer.
- **Can current behavior destroy/rewrite history?** No.
- **Does it block Batch 7 or later testing?** No.
- **Recommended disposition:** A. FIX NOW, OBVIOUS INVARIANT.
- **Reason:** The read-side permission resolver already treats
  `roles.is_active` as an authoritative kill switch (N-023, N-024); the
  write-side (`grant_user_role`) should enforce the identical invariant
  before insert, exactly matching the pattern already correctly applied
  to `permissions.is_active` and `role_permissions.revoked_at`. No
  business policy choice exists here: nobody would design a system
  where knowingly granting a deactivated role is desirable, and
  N-013 already establishes (by contrast) which permissive behaviors
  ARE deliberately documented as intended in this codebase; this one
  is not among them.
- **User decision required?** No.
- **Exact question for Utkarsh, if needed:** N/A.
- **Suggested future journey/regression:** A regression test asserting
  `grant_user_role` rejects a target role with `is_active = false` with
  a clear error, and a companion test asserting it still succeeds for an
  active role (to guard against over-blocking a legitimate grant made
  moments after reactivation).
- **Notes:** The throwaway role and its one, now-revoked grant row from
  this test persist permanently as harmless, clearly-named test data,
  since roles/user_roles rows referenced by a historical grant can never
  be hard-deleted.

---

### Gap 2: O-011, assign_user_to_team cannot promote an existing membership to primary

- **Journey ID:** O-011
- **Batch:** 5
- **Domain:** Teams
- **Journey Name:** Set a Team Membership as Primary
- **Original expected behavior:** Admin flags an existing non-primary
  membership as `is_primary = true`; that membership becomes
  distinguished; re-setting the same value is a safe no-op.
- **Actual observed behavior:** `assign_user_to_team`'s dedup logic
  matches on `(user_id, team_id, revoked_at is null)` alone, ignoring
  the `is_primary` argument entirely. Re-calling it for an existing
  membership with a different `is_primary` value silently returns the
  old, unchanged row with no error; the call reports success while
  nothing changes. No UI control to promote an existing membership to
  primary exists at all.
- **Why classified as Product Gap:** The literal described scenario
  ("flag an existing non-primary membership as primary") is
  unreachable via both the UI (no such control) and the RPC (silent
  no-op).
- **Current code/database mechanism:**
  `assign_user_to_team` (`supabase/migrations/20260916060000_team_master_foundation.sql:216-245`).
  `fn_protect_team_grant` (confirmed in O-012) also blocks a direct
  `UPDATE` of `is_primary` on an existing row, since it forbids
  changing any column but `revoked_at`/`revoked_by` once a row exists.
  So there is currently no path at all, RPC or raw SQL, to change an
  existing membership's primary flag in place.
- **Business consequence:** An admin who genuinely needs to re-designate
  a user's primary team (e.g. after a reorg) has no working control to
  do it; only revoke-then-regrant achieves the same practical effect,
  which is not what the RPC's own `p_is_primary` parameter implies is
  supported.
- **Security consequence:** None identified; `is_primary` is a display/
  organizational distinction, not an authorization gate (workflow team
  routing, per O-005/O-018/O-019, checks membership existence, never
  `is_primary`).
- **Financial/control consequence:** None identified.
- **Operational consequence:** Low; an admin can still achieve the
  practical outcome via revoke-then-regrant, just not via the parameter
  that appears designed for it.
- **UX consequence:** A caller that trusts the RPC's own success
  response would believe the primary flag changed when it did not.
  This is a worse failure mode than an honest rejection.
- **Data-integrity consequence:** None; the stored data remains
  internally consistent (at most one active primary per user, per
  O-012), it just cannot be changed for an existing membership by
  intent.
- **Historical/audit consequence:** None; no incorrect history is
  written, since nothing is written at all on the no-op path.
- **Blast radius:** Narrow; affects only the specific case of
  re-designating an existing membership's primary flag.
- **Existing compensating control:** Revoke-then-regrant achieves the
  same practical business outcome, at the cost of an extra revoke/grant
  pair of historical rows rather than one clean update.
- **Can current behavior cause silent incorrect truth?** Yes: the RPC
  reports success on a call that changes nothing, which is the sharpest
  form of "silent incorrect truth" in this triage's whole gap set.
- **Can current behavior create orphaned work?** No.
- **Can current behavior bypass authorization/governance?** No.
- **Can current behavior destroy/rewrite history?** No; if anything it
  is over-protective of history (the immutable-grant trigger correctly
  blocks in-place mutation, which is why a swap mechanism is needed
  rather than a raw `UPDATE`).
- **Does it block Batch 7 or later testing?** No.
- **Recommended disposition:** A. FIX NOW, OBVIOUS INVARIANT.
- **Reason:** The specific business question ("should Nexus support a
  user having one designated primary team") is already answered by
  existing, shipped product code: `is_primary` already exists, defaults
  correctly on first assignment, and the UI already displays the
  distinction. The only open question is mechanical: how a
  already-decided, already-supported concept gets updated for an
  existing membership without violating the historical-grant-record
  invariant. That is an implementation decision (a primary-swap
  transaction: revoke the old primary row, insert a new primary row
  for the same user/team pair, honoring the existing
  `uq_user_teams_one_active_primary` partial unique index), not a
  business policy choice. The narrower, unconditional invariant this
  gap violates today, an RPC call must not report success while
  silently doing nothing, requires no business decision to fix
  regardless of which exact mechanism is chosen.
- **User decision required?** No.
- **Exact question for Utkarsh, if needed:** N/A.
- **Suggested future journey/regression:** A regression test that
  calls the fixed mechanism for an existing non-primary membership and
  asserts the row's `is_primary` state actually changes (not merely
  that the call succeeds), plus a re-run of O-012's own two-primaries
  guard against the new mechanism.
- **Notes:** The most significant functional finding in Batch 5's O-series.

---

### Gap 3: P-013, Reference Master Level 3 list tiering has no server-side enforcement

- **Journey ID:** P-013
- **Batch:** 6
- **Domain:** Reference Masters
- **Journey Name:** Attempt to Add a New Level 3 System-Supported Option
  (Commercial Nature)
- **Original expected behavior:** No "Add" control is present in the UI
  for a Level 3 (system-supported) list; a direct action call attempt
  is also rejected server-side.
- **Actual observed behavior:** The UI correctly hides the Add control
  for Commercial Nature (Level 3). A direct `add_reference_option` RPC
  call bypassing the UI for the same list succeeded with no rejection,
  inserting a new active row.
- **Why classified as Product Gap:** Level 1/2/3 tiering exists only in
  `src/features/reference-data/ui/reference-master-settings.tsx`'s
  client-facing `ConfigLevel`/`LIST_CONFIGS`, with no equivalent concept
  anywhere in the database schema or service layer.
- **Current code/database mechanism:** `add_reference_option` RPC, no
  list-tier check. `docs/SETTINGS_ARCHITECTURE.md` §3 defines the
  intended invariant explicitly: "A new value needs new application or
  calculation code before it means anything at all, so Settings never
  allows adding one for any of these five [Commercial Nature, Pricing
  Models, Invoice Timing, Slab Methods, Revenue Recognition Methods]."
- **Business consequence:** A value could be added to a Level 3 list
  that has no corresponding application/calculation code behind it,
  meaning it would appear selectable somewhere (if any UI ever reads
  this list generically) without any real behavior implemented for it.
- **Security consequence:** This is the sharpest instance in this
  triage of a pattern the codebase's own architecture explicitly warns
  against elsewhere: `docs/AUTHORIZATION_MODEL.md` §14 states plainly,
  for this exact feature area, "this is a rendering convenience only,
  the Server Action's own check is what actually enforces this." That
  principle was correctly applied to permission gating but not to
  list-tier gating within the same feature.
- **Financial/control consequence:** Low today, since the five Level 3
  lists (Commercial Nature, Pricing Models, Invoice Timing, Slab
  Methods, Revenue Recognition Methods) are read by fixed application
  code paths that switch on known, hardcoded values; an unrecognized
  added value would most likely be inert or fall through to a default/
  error case rather than silently miscalculate, but this has not been
  proven exhaustively for all five lists.
- **Operational consequence:** None observed; would only surface if
  someone actually exercised the RPC bypass, which requires direct
  database/API access, not normal UI use.
- **UX consequence:** None for a normal admin; the UI never exposes
  this path.
- **Data-integrity consequence:** A `reference_options` row could exist
  for a Level 3 list that is not one of the architecturally-intended,
  documented values for that list, and (per the no-delete lifecycle
  trigger already confirmed for `reference_options`) can never be
  removed, only deactivated.
- **Historical/audit consequence:** The insert IS captured by
  `fn_audit_row` with the correct actor, so it is fully auditable after
  the fact; the gap is that it should not have been possible to create
  at all, not that it goes unrecorded.
- **Blast radius:** Narrow; requires direct RPC/API access bypassing
  the UI. No normal Settings workflow reaches this path.
- **Existing compensating control:** The UI never exposes a way to
  reach this; the five Level 3 lists are also small, fixed, rarely
  touched sets that an admin would have little organic reason to call
  the raw RPC against.
- **Can current behavior cause silent incorrect truth?** Yes: a
  reference_options row could represent a Level 3 value with no real
  application meaning behind it, appearing to be legitimate data.
- **Can current behavior create orphaned work?** No.
- **Can current behavior bypass authorization/governance?** Yes,
  specifically the list-tier governance model documented in
  `docs/SETTINGS_ARCHITECTURE.md` §3, which this codebase's own stated
  principles (UI hiding is never sufficient) already say should not be
  UI-only.
- **Can current behavior destroy/rewrite history?** No.
- **Does it block Batch 7 or later testing?** No, but see BATCH 7
  DEPENDENCY ANALYSIS below: Batch 7 continues Reference Master testing
  (P-018 through P-023), so this is the one gap in this triage worth a
  regression check if fixed in the same window as Batch 7.
- **Recommended disposition:** A. FIX NOW, OBVIOUS INVARIANT.
- **Reason:** The correct behavior is already fully decided and
  documented (`docs/SETTINGS_ARCHITECTURE.md` §3 names exactly which
  five lists are Level 3 and states unconditionally that Settings
  should never allow adding to them); no business policy choice
  remains. Only the enforcement layer was wrong: UI-only instead of
  server-side, which is a direct violation of this codebase's own
  already-established, already-documented principle
  (`docs/AUTHORIZATION_MODEL.md` §14, "this is a rendering convenience
  only") applied to the wrong axis (permission, not tier). A bounded
  fix (a `LIST_TIERS`/`level` concept checked inside `add_reference_option`
  or the calling service, matching the already-known Level 3 list set)
  closes this without any product decision.
- **User decision required?** No.
- **Exact question for Utkarsh, if needed:** N/A.
- **Suggested future journey/regression:** A regression test asserting
  `add_reference_option` rejects a Level 3 list_key (all five: Commercial
  Nature, Pricing Models, Invoice Timing, Slab Methods, Revenue
  Recognition Methods) with a clear error, and a companion test
  confirming Level 1/2 lists remain fully addable. Re-run alongside
  Batch 7's P-018-P-023 Reference Master continuation.
- **Notes:** The test-inserted `commercial_nature` row from this
  session's testing remains in place (cannot be deleted per the
  no-delete `reference_options` lifecycle) and is clearly identifiable
  by its fictional test code.

---

### Gap 4: N-031, usage.read and entitlement_settlement.read seeded but never enforced

- **Journey ID:** N-031
- **Batch:** 5
- **Domain:** Users / Roles / Permissions (cross-referencing
  Entitlement/Usage/Settlement)
- **Journey Name:** usage.read and entitlement_settlement.read Are
  Seeded but Unenforced Anywhere
- **Original expected behavior:** A user granted only `usage.read` or
  only `entitlement_settlement.read` is denied page access, since the
  entitlement/usage/settlement page's own gate should check the
  permission an admin is told they are granting.
- **Actual observed behavior:** Zero code paths anywhere in `src/`
  check `("usage","read")` or `("entitlement_settlement","read")`. The
  page-level gate is exclusively `entitlement:read`; write-side buttons
  check `entitlement:write`, `usage:write`, `usage:finalize`,
  `entitlement_settlement:write`. Both permission rows remain seeded
  and granted to `finance_admin`, giving the impression they do
  something.
- **Why classified as Product Gap:** Re-confirmed fresh this run
  (not assumed from an earlier finding); the mismatch is unchanged.
- **Current code/database mechanism:**
  `src/app/customers/[customerKey]/entitlement/[stableComponentKey]/page.tsx:30,58`;
  `src/features/entitlement/actions.ts`;
  `supabase/migrations/20260919010000_entitlement_ledger_foundation.sql:334-355`.
- **Business consequence:** An admin who grants `usage.read` to someone
  believing it grants narrower, read-only visibility into usage data
  has actually granted nothing at all; that person still needs the
  coarser `entitlement.read` to see anything.
- **Security consequence:** Not a bypass (the coarser gate still
  correctly enforces); the risk runs the other way: an admin might
  believe they have achieved a finer-grained restriction that does not
  actually exist, and grant the coarser `entitlement.read` instead
  under a mistaken belief that the two narrower permissions provide
  meaningful separation.
- **Financial/control consequence:** Could matter if the org's real
  intent is to let some staff read usage/settlement figures without
  seeing the full entitlement record; today that separation is not
  possible no matter which permission is granted.
- **Operational consequence:** None visible today (no support ticket
  or incident traced to this).
- **UX consequence:** An admin granting `usage.read` believes they have
  given real access; they have given nothing.
- **Data-integrity consequence:** None.
- **Historical/audit consequence:** None; grants of these two
  permissions are still fully attributed and visible, they are just
  functionally inert.
- **Blast radius:** Limited to whoever currently holds only
  `usage.read` or `entitlement_settlement.read` without also holding
  `entitlement.read` (today: nobody beyond `finance_admin`, which
  already holds the coarser permission too, so nobody is actually
  under-provisioned as a live consequence right now).
- **Existing compensating control:** `finance_admin` (the only role
  granted these two permissions) also holds `entitlement.read`, so no
  real user is currently relying on the unenforced permissions for
  actual access.
- **Can current behavior cause silent incorrect truth?** No; nothing
  is misrepresented about a business record, only about what a
  permission grant accomplishes.
- **Can current behavior create orphaned work?** No.
- **Can current behavior bypass authorization/governance?** No; if
  anything it is the reverse (a permission grant is a no-op, not an
  unintended bypass).
- **Can current behavior destroy/rewrite history?** No.
- **Does it block Batch 7 or later testing?** No.
- **Recommended disposition:** C. USER PRODUCT DECISION REQUIRED.
- **Reason:** Two legitimate paths exist with materially different
  product implications, and Nexus has already made this exact call
  correctly in the FX-snapshot precedent (a real, documented decision
  point, not left ambiguous): here, no equivalent decision has yet been
  made about whether Entitlement/Usage/Settlement needs finer-grained
  read separation at all.
- **Question:** Should Nexus support a finer-grained read permission
  that lets someone see usage/settlement figures without seeing the
  full entitlement record, or should the two unused permissions be
  removed to simplify the model down to what is actually enforced?
  - **Option 1: Wire up the two permissions as real, independent read
    gates.**
    - **What it means:** Add a second-level check inside the
      entitlement/usage/settlement page and its Server Actions so a
      user with only `usage.read` sees usage data (not the full
      entitlement record), and similarly for
      `entitlement_settlement.read`.
    - **Benefit:** Enables a real, finer-grained access model matching
      what the permission names already promise; useful if there is a
      real staff group (e.g. billing operations) that should see usage
      figures without full entitlement visibility.
    - **Risk:** A genuine authorization-architecture change to a live
      governed page; requires careful design of exactly what a
      "usage-read-only" view shows versus the full entitlement view, a
      real UI/data-model decision, not a one-line fix.
  - **Option 2: Remove the two unused permission rows entirely.**
    - **What it means:** A data cleanup migration deactivating or
      removing `usage.read` and `entitlement_settlement.read` from the
      catalog, simplifying the model to exactly what is enforced today
      (`entitlement.read`/`write`, `usage.write`/`finalize`,
      `entitlement_settlement.write`).
    - **Benefit:** Removes a standing source of confusion (a permission
      that grants nothing); the model becomes fully honest with zero
      dead permissions.
    - **Risk:** If a real future need for finer-grained read separation
      emerges, the permission names would need to be re-introduced from
      scratch.
  - **My recommended default, stated but not implemented:** Option 2
    (remove), since no current role or business need actually depends
    on the finer distinction today, and a dead permission is a standing
    trap for a future admin who reasonably assumes granting it does
    something.
- **Suggested future journey/regression:** Once decided, a regression
  test proving either (a) `usage.read`-only access renders the intended
  narrower view and denies the full entitlement view, or (b) the
  permission catalog no longer contains the two removed rows and no
  role references them.
- **Notes:** This is a pre-existing, already-catalogued finding from a
  2026-09-16 reconciliation pass, re-confirmed empirically this run,
  not newly discovered.

---

### Gap 5: O-018, no proactive warning when a team's last active member is removed

- **Journey ID:** O-018
- **Batch:** 6
- **Domain:** Teams (workflow routing)
- **Journey Name:** Last Remaining Active Member of a Team Removed
  While a Request Waits at That Team's Node
- **Original expected behavior:** Admin revokes the sole active
  member's membership; the request remains stuck at its node with no
  automatic reassignment/alert/escalation; admin assigns a new member,
  who can then act on the previously stuck request.
- **Actual observed behavior:** With zero active team members, the
  approve attempt correctly failed with `WORKFLOW_TEAM_REQUIRED`; the
  request remained exactly as it was, not silently cancelled or
  auto-approved. After restoring the membership, the same approve call
  succeeded immediately with no other admin action needed. No warning
  was shown anywhere at the moment the last member was removed.
- **Why classified as Product Gap:** No code path checks "does this
  team have at least one active member" before or after a
  `remove_user_from_team`-style action.
- **Current code/database mechanism:** `remove_user_from_team`
  performs no such check; `fn_require_workflow_team_membership` (the
  runtime gate) correctly rejects the empty-team case rather than
  silently advancing, so the request cannot be wrongly approved, but
  nothing proactively surfaces the risk at removal time.
- **Business consequence:** A pending, in-flight approval can become
  stuck with no signal to the admin who caused it, until someone
  notices the request is not moving.
- **Security consequence:** None; the request cannot be wrongly
  approved or bypassed while stuck.
- **Financial/control consequence:** A time-sensitive approval (e.g. a
  Commercial Configuration change with a business deadline) could sit
  unactionable for longer than intended, with no system-level signal.
- **Operational consequence:** Recovery is trivial once noticed (assign
  a new member, the request immediately becomes actionable again, per
  O-018's own live proof), but "once noticed" depends entirely on a
  human noticing.
- **UX consequence:** No warning is shown or would be shown anywhere at
  the moment the last member is removed.
- **Data-integrity consequence:** None; the request's own row and node
  are never mutated while stuck.
- **Historical/audit consequence:** None; the revoke itself is fully
  attributed and auditable.
- **Blast radius:** Limited to teams that both (a) drop to zero active
  members and (b) currently have at least one request pending at a
  node responsible to that team; likely rare in a well-staffed
  environment but not impossible during offboarding/reorg churn.
- **Existing compensating control:** The runtime gate
  (`fn_require_workflow_team_membership`) prevents any wrong outcome
  (no silent auto-approval, no silent drop); the failure mode is purely
  "stuck until noticed," not "silently wrong."
- **Can current behavior cause silent incorrect truth?** No.
- **Can current behavior create orphaned work?** Yes: a pending
  request can become effectively orphaned (unactionable by anyone)
  until an admin happens to notice and re-assigns a team member.
- **Can current behavior bypass authorization/governance?** No.
- **Can current behavior destroy/rewrite history?** No.
- **Does it block Batch 7 or later testing?** No.
- **Recommended disposition:** C. USER PRODUCT DECISION REQUIRED.
- **Reason:** Multiple materially different, all-legitimate product
  behaviors exist (block the removal, warn but allow it, auto-escalate
  to a different team, or leave as-is), each with different tradeoffs
  and none obviously implied by existing architecture; this is a
  business decision about how much workflow self-healing Nexus should
  provide today, not a bounded correctness fix.
- **Question:** Should Nexus do anything differently when an admin
  removes the last active member of a team that currently has
  work pending at one of its workflow nodes?
  - **Option 1: Block the removal outright if pending work exists.**
    - **What it means:** `remove_user_from_team` (or its Server Action)
      checks whether removing this membership would leave the team with
      zero active members while a request is pending at one of its
      nodes, and rejects the removal with a clear error if so.
    - **Benefit:** Structurally prevents the stuck state from ever
      occurring.
    - **Risk:** Could block a legitimate, urgent offboarding (e.g. a
      departing employee must be removed today regardless of pending
      work) unless paired with an override path; adds a new
      cross-domain check (team membership logic would need to query
      every governed domain's pending-request state).
  - **Option 2: Allow the removal, but show a proactive warning at the
    moment of removal.**
    - **What it means:** The Team Master UI surfaces "This is the last
      active member of a team with N pending requests" before the admin
      confirms removal, without blocking the action.
    - **Benefit:** Informs the decision-maker without removing their
      ability to act; lower engineering cost than Option 1's
      cross-domain block.
    - **Risk:** Still relies on the admin reading and heeding the
      warning; does not help if the last member departs via a path that
      does not go through this specific UI control (e.g. a direct RPC).
  - **Option 3: Leave as-is, but add an operational visibility signal
    elsewhere (e.g. a "stuck requests" indicator on the Operations
    Queue or Team Master).**
    - **What it means:** No change to the removal action itself; add a
      passive, ongoing signal that surfaces teams with zero active
      members and pending assigned work, discoverable at any later
      time, not only at the moment of removal.
    - **Benefit:** Catches the case even if it arose some other way (a
      team created with zero members from the start, a bulk deactivation
      elsewhere); does not require blocking or interrupting the removal
      flow.
    - **Risk:** Does not prevent the stuck window from existing, only
      shortens how long it goes unnoticed.
  - **My recommended default, stated but not implemented:** Option 2
    (warn, don't block), as the narrowest change that meaningfully
    reduces the risk without introducing a cross-domain blocking
    dependency; Option 3 is a reasonable complement, not a replacement.
- **Suggested future journey/regression:** Once decided, a regression
  test exercising the chosen mechanism (a rejected removal, a shown
  warning, or a surfaced indicator) against a team with a real pending
  request at one of its nodes.
- **Notes:** Directly related to, but distinct from, O-005 (deactivating
  a team, rather than removing its last member, does not block existing
  members from approving); O-005 is Expected Behavior, not a Product
  Gap, and is not counted among the 11.

---

### Gap 6: N-027, no search/filter on the User Access list

- **Journey ID:** N-027
- **Batch:** 5
- **Domain:** Users / Roles / Permissions
- **Journey Name:** Search and Filter the User List
- **Original expected behavior:** Admin searches by name or email
  fragment and/or filters by status; result set narrows correctly.
- **Actual observed behavior:** No search box and no status filter
  exist anywhere on the User Access page; the list always renders every
  entry (up to the 200-user cap, N-015).
- **Why classified as Product Gap:** Confirmed by a full read of the
  340-line page component: the only client-side state is per-row
  editing state, never a list-wide filter.
- **Current code/database mechanism:**
  `src/platform/user-access/ui/user-access-page.tsx`.
- **Business consequence:** An admin in a larger org must visually scan
  the full list rather than narrow it.
- **Security consequence:** None.
- **Financial/control consequence:** None.
- **Operational consequence:** Low at today's user count (this
  dev-stage system has far fewer than 200 users).
- **UX consequence:** An admin has no way to narrow the list; must
  visually scan.
- **Data-integrity consequence:** None.
- **Historical/audit consequence:** None.
- **Blast radius:** Grows with org size; currently negligible.
- **Existing compensating control:** Low current user count makes
  visual scanning practical today.
- **Can current behavior cause silent incorrect truth?** No.
- **Can current behavior create orphaned work?** No.
- **Can current behavior bypass authorization/governance?** No.
- **Can current behavior destroy/rewrite history?** No.
- **Does it block Batch 7 or later testing?** No.
- **Recommended disposition:** D. SAFE TO DEFER.
- **Reason:** `docs/TECH_DEBT.md`'s "Later" section already documents
  this exact class of gap and its trigger explicitly: "Move to a shared
  `DataTable` component... when a list page needs real sorting/
  filtering/column-state/virtualization. Every current list (Customers,
  My Requests, Approvals, My Work) is small and simple enough that
  composing raw... table primitives per page remains correct; do not
  adopt TanStack Table or similar until a list genuinely needs those
  features." This is a real, already-acknowledged gap with a clean,
  pre-existing trigger, not a fresh open question.
- **Why deferral is safe:** No control, security, or data-integrity
  consequence exists; the only cost is admin convenience, which
  degrades gracefully and gradually as user count grows, not suddenly.
- **What event should trigger fixing it:** The User Access (and, per
  Gap 8 below, Team Master) list genuinely becoming hard to scan
  visually, i.e. approaching a real multi-page user/team count, per
  `docs/TECH_DEBT.md`'s own stated trigger.
- **Which later batch/domain may naturally address it:** A future
  Settings/UI-platform pass introducing the shared `DataTable`
  component `docs/UI_SYSTEM.md` §19 already documents but has not yet
  built; not tied to any specific upcoming journey batch.
- **User decision required?** No.
- **Exact question for Utkarsh, if needed:** N/A.
- **Suggested future journey/regression:** Re-run N-027 once the
  `DataTable` component exists, to confirm search/filter genuinely
  narrows the result set.
- **Notes:** Shares its root cause with Gap 8 (O-020); see CROSS-GAP
  ROOT CAUSES.

---

### Gap 7: N-029, no UI to view a user's historical role grant/revoke timeline

- **Journey ID:** N-029
- **Batch:** 5
- **Domain:** Users / Roles / Permissions
- **Journey Name:** Full Historical Role Grant/Revoke Timeline for a User
- **Original expected behavior:** Every historical `user_roles` row is
  visible in order with `granted_by`/`granted_at` and
  `revoked_by`/`revoked_at` where applicable; row count matches exact
  event count; no row ever hard-deleted.
- **Actual observed behavior:** The underlying data is fully correct
  and complete (every grant/revoke event preserved, correctly
  attributed, immutable once revoked, proven repeatedly this run).
  There is no UI anywhere that lets an admin or auditor actually view
  this history for a given user; the User Access page shows only
  currently-active roles as badges, never past ones.
- **Why classified as Product Gap:** Confirmed by direct SQL (data
  intact) plus a UI search (no viewing surface exists).
- **Current code/database mechanism:** `fn_protect_access_grant`
  (the same historical-lock trigger proven in N-010) guarantees the
  data's own correctness; no page or component reads past (revoked)
  `user_roles` rows for display.
- **Business consequence:** An auditor today must query the database
  directly; no in-product view exists.
- **Security consequence:** None; this is a presentation gap only, the
  underlying guarantee (immutable, complete history) already holds.
- **Financial/control consequence:** Could matter for a future
  compliance/audit request ("show me every role change for this user
  over the last year"), which would currently require direct database
  access rather than a supported in-product path.
- **Operational consequence:** Low today; no live incident has needed
  this view yet.
- **UX consequence:** An auditor has no in-product way to answer "what
  roles did this person hold, and when."
- **Data-integrity consequence:** None; explicitly the opposite, the
  data-integrity half of this journey is a genuine PASS.
- **Historical/audit consequence:** None negative; the underlying audit
  trail is already complete and correct, only unexposed.
- **Blast radius:** None beyond the inconvenience of needing direct
  database access for a compliance/audit question.
- **Existing compensating control:** The data itself is fully durable
  and query-able directly by anyone with database access (a small,
  trusted group today).
- **Can current behavior cause silent incorrect truth?** No.
- **Can current behavior create orphaned work?** No.
- **Can current behavior bypass authorization/governance?** No.
- **Can current behavior destroy/rewrite history?** No; the opposite,
  history is already fully protected.
- **Does it block Batch 7 or later testing?** No.
- **Recommended disposition:** D. SAFE TO DEFER.
- **Reason:** `docs/TECH_DEBT.md`'s "Later" section already documents
  this exact gap and its trigger: "No global audit/history viewer
  exists. Activity/History is only ever a per-customer tab; Settings
  mutations (Reference Master, Team Master, Workflow publish/discard)
  are captured in `audit_log`... but have no UI surface at all beyond
  informal 'Last Updated by' columns. Build a cross-entity audit
  viewer once a real compliance/support need to search audit history by
  actor or time range (not by customer) appears; the data already
  supports it."
- **Why deferral is safe:** The data-integrity guarantee this journey
  cares most about is already independently proven correct; only the
  presentation layer is missing, and nothing depends on it existing
  today.
- **What event should trigger fixing it:** A real compliance/support
  need to search audit history by actor or time range, per
  `docs/TECH_DEBT.md`'s own stated trigger.
- **Which later batch/domain may naturally address it:** A future
  cross-entity audit/history viewer feature, not tied to any specific
  upcoming journey batch.
- **User decision required?** No.
- **Exact question for Utkarsh, if needed:** N/A.
- **Suggested future journey/regression:** Re-run N-029 (and Gap 9,
  O-023) once a cross-entity audit viewer exists, to confirm it
  surfaces the already-correct data completely and in order.
- **Notes:** Shares its root cause with Gap 9 (O-023); see CROSS-GAP
  ROOT CAUSES.

---

### Gap 8: O-020, no search/filter on the Team Master list

- **Journey ID:** O-020
- **Batch:** 6
- **Domain:** Teams
- **Journey Name:** Search and Filter the Team List
- **Original expected behavior:** Admin searches by team code/name
  and/or filters by active/inactive; result set narrows correctly.
- **Actual observed behavior:** No search input or active/inactive
  filter control exists anywhere in the Team Master page; it renders
  the full unfiltered team list every time.
- **Why classified as Product Gap:** Confirmed by reading the Team
  Master page and its data-access module.
- **Current code/database mechanism:**
  `src/platform/team/ui/team-master-page.tsx`,
  `src/platform/team/data/team.data.ts`.
- **Business/Security/Financial/Operational/UX/Data-integrity/
  Historical consequence:** Identical in shape to Gap 6 (N-027); a
  missing convenience feature with no control, security, or
  data-integrity implication, low current impact given today's low
  team count.
- **Blast radius:** Grows with team count; currently negligible.
- **Existing compensating control:** Low current team count makes
  visual scanning practical today.
- **Can current behavior cause silent incorrect truth?** No.
- **Can current behavior create orphaned work?** No.
- **Can current behavior bypass authorization/governance?** No.
- **Can current behavior destroy/rewrite history?** No.
- **Does it block Batch 7 or later testing?** No.
- **Recommended disposition:** D. SAFE TO DEFER.
- **Reason:** Same `docs/TECH_DEBT.md` "Later" `DataTable` entry as
  Gap 6 already covers this exact class of gap and states the same
  trigger.
- **Why deferral is safe:** Same as Gap 6.
- **What event should trigger fixing it:** Same as Gap 6, the Team
  Master list genuinely becoming hard to scan visually.
- **Which later batch/domain may naturally address it:** Same future
  `DataTable` pass as Gap 6; both lists would naturally be migrated
  together.
- **User decision required?** No.
- **Exact question for Utkarsh, if needed:** N/A.
- **Suggested future journey/regression:** Re-run O-020 alongside N-027
  once the shared `DataTable` component exists.
- **Notes:** Shares its root cause with Gap 6 (N-027); see CROSS-GAP
  ROOT CAUSES.

---

### Gap 9: O-023, no UI to view a user's historical team membership timeline

- **Journey ID:** O-023
- **Batch:** 6
- **Domain:** Teams
- **Journey Name:** Full Historical Team Membership Timeline for a User
- **Original expected behavior:** Every historical `user_teams` row is
  visible in order with `granted_by`/`granted_at` and
  `revoked_by`/`revoked_at` where applicable; none missing or
  overwritten; DELETE structurally forbidden.
- **Actual observed behavior:** Direct query confirmed both the
  original grant/revoke and the restored grant for a real test subject
  are intact, in order, correctly attributed. The only application code
  reading `user_teams` (`src/platform/team/data/team.data.ts:36`)
  filters `revoked_at is null`, meaning no page currently surfaces the
  full history, only current active state.
- **Why classified as Product Gap:** Confirmed by direct SQL (data
  intact) plus a code search (no viewing surface exists).
- **Current code/database mechanism:** `fn_protect_team_grant` (the
  same historical-lock trigger family as `fn_protect_access_grant`)
  guarantees the data's own correctness.
- **Business/Security/Financial/Operational/UX/Data-integrity/
  Historical consequence:** Identical in shape to Gap 7 (N-029); a
  presentation-layer gap only, over data that is already fully correct
  and durable.
- **Blast radius:** None beyond the inconvenience of needing direct
  database access for a compliance/audit question.
- **Existing compensating control:** Same as Gap 7: the data is fully
  durable and directly query-able by anyone with database access.
- **Can current behavior cause silent incorrect truth?** No.
- **Can current behavior create orphaned work?** No.
- **Can current behavior bypass authorization/governance?** No.
- **Can current behavior destroy/rewrite history?** No; the opposite.
- **Does it block Batch 7 or later testing?** No.
- **Recommended disposition:** D. SAFE TO DEFER.
- **Reason:** Same `docs/TECH_DEBT.md` "No global audit/history
  viewer exists" entry as Gap 7 already covers this exact class of gap
  (it explicitly names Team Master among the mutation types captured in
  `audit_log` but not exposed) and states the same trigger.
- **Why deferral is safe:** Same as Gap 7.
- **What event should trigger fixing it:** Same as Gap 7, a real
  compliance/support need to search audit history by actor or time
  range.
- **Which later batch/domain may naturally address it:** Same future
  cross-entity audit viewer as Gap 7; both would naturally be built
  together since the underlying `audit_log` table already covers both
  Team Master and User Access mutations.
- **User decision required?** No.
- **Exact question for Utkarsh, if needed:** N/A.
- **Suggested future journey/regression:** Re-run O-023 alongside N-029
  once a cross-entity audit viewer exists.
- **Notes:** Shares its root cause with Gap 7 (N-029); see CROSS-GAP
  ROOT CAUSES.

---

### Gap 10: N-026, no self-service view of a user's own access

- **Journey ID:** N-026
- **Batch:** 5
- **Domain:** Users / Roles / Permissions
- **Journey Name:** User Views Their Own Access Summary
- **Original expected behavior:** User opens their own profile/access
  view; sees current roles, teams, derived permissions; no edit
  controls unless they separately hold `user_access.write`.
- **Actual observed behavior:** No such view exists anywhere in the
  app. A user with no special permission has no way to see their own
  current roles/teams/permissions short of asking an admin or, if they
  happen to hold `user_access.read`/`write` themselves, finding their
  own row in the all-users admin list.
- **Why classified as Product Gap:** Confirmed by a full search of
  `src/app` for any self-service route and a full read of the sidebar
  nav component.
- **Current code/database mechanism:** The underlying data (roles,
  teams, permission unions) already resolves correctly, proven
  extensively elsewhere in Batches 4-5; only a "self" scoped read query
  and a route to display it are missing.
- **Business consequence:** A user cannot self-diagnose "why can't I do
  X" without contacting an admin, contrary to the general goal of
  reducing admin support load.
- **Security consequence:** None; this would be a strictly read-only,
  self-scoped view.
- **Financial/control consequence:** None.
- **Operational consequence:** Every "why can't I do X" question
  currently requires an admin to look it up on the user's behalf.
- **UX consequence:** No self-diagnosis path exists.
- **Data-integrity consequence:** None.
- **Historical/audit consequence:** None.
- **Blast radius:** Every non-admin user, but only as an inconvenience,
  never a blocker to any actual governed action.
- **Existing compensating control:** Any admin holding
  `user_access.read` can already look up any user's full access state
  via `/settings/user-access` today.
- **Can current behavior cause silent incorrect truth?** No.
- **Can current behavior create orphaned work?** No.
- **Can current behavior bypass authorization/governance?** No.
- **Can current behavior destroy/rewrite history?** No.
- **Does it block Batch 7 or later testing?** No.
- **Recommended disposition:** D. SAFE TO DEFER.
- **Reason:** This is a genuine missing feature (a new route plus a
  new "self" scoped query), not a bounded bug fix, and no material
  control/security/data-integrity risk exists while it remains
  unbuilt; every fact it would show is already correctly derivable and
  already viewable by any admin today.
- **Why deferral is safe:** The only cost is convenience; any admin can
  already answer "what does this user have" on request, so no one is
  actually blocked from getting an answer, only from getting it
  without asking.
- **What event should trigger fixing it:** A material volume of
  support tickets/requests along the lines of "why can't I do X" that
  an admin currently has to manually look up each time, or a broader
  Settings self-service pass that would naturally include this.
- **Which later batch/domain may naturally address it:** No specific
  upcoming journey batch depends on this; a future Settings/self-service
  UI pass would naturally cover it alongside similar convenience
  features.
- **User decision required?** No.
- **Exact question for Utkarsh, if needed:** N/A.
- **Suggested future journey/regression:** Re-run N-026 once a
  self-access view exists, confirming it shows exactly the caller's own
  roles/teams/permissions with no edit controls unless they separately
  hold `user_access.write`.
- **Notes:** Unlike Gaps 6-9, no existing `docs/TECH_DEBT.md` entry
  names this specific gap; it is recorded here as newly identified and
  should be added to `docs/TECH_DEBT.md`'s "Later" section (see FIX
  NOW / ACCEPT / DEFER action plan).

---

### Gap 11: P-012, Invoice Frequency cadence retroactivity is architecturally unresolved but currently latent

- **Journey ID:** P-012
- **Batch:** 6
- **Domain:** Reference Masters (Commercial Configuration cross-reference)
- **Journey Name:** Update Invoice Frequency cadenceMonths After
  In-Flight Components Reference It
- **Original expected behavior:** Existing components' already-generated
  schedule/frozen cadence is unaffected by a later cadence-value edit;
  only new components pick up the new cadence.
- **Actual observed behavior:** A fresh `grep -rn "getInvoiceFrequencyCadence"`
  confirmed zero real application call sites (only its own definition,
  its own re-export, and its own unit tests). `commercial_components.
  billing_cadence` is read in roughly 19 files, but the one label-
  resolution function in active use (`billingCadenceLabel`, `src/features/
  commercial/domain/labels.ts:69-71`) resolves the code through a
  hardcoded static string map, never through `reference_options.
  cadence_months`.
- **Why classified as Product Gap:** The retroactivity question is
  architecturally moot today, not because it is correctly guarded, but
  because nothing live resolves `cadence_months` to a number at all.
- **Current code/database mechanism:**
  `getInvoiceFrequencyCadence` (`src/features/reference-data` domain
  `service.ts:69`); `billingCadenceLabel`
  (`src/features/commercial/domain/labels.ts:69-71`);
  `commercial_components.billing_cadence`.
- **Business consequence:** None today; `billing_cadence` is stored and
  displayed everywhere as an opaque, statically-labeled code, so a
  later edit to `cadence_months` in Settings changes nothing about any
  existing component's behavior or display, simply because nothing
  reads the numeric value live.
- **Security consequence:** None.
- **Financial/control consequence:** Contrast with currency: `docs/
  COMMERCIAL_DOMAIN_ARCHITECTURE.md` §22a documents a real, implemented
  freezing mechanism for currency rate (`fx_snapshot_rate`), because a
  currency rate directly affects invoiced INR amounts. No equivalent
  documented decision exists for cadence, because nothing currently
  computes a live financial outcome from the numeric cadence value.
- **Operational consequence:** None today.
- **UX consequence:** None today.
- **Data-integrity consequence:** None today, since no live path
  depends on the numeric value.
- **Historical/audit consequence:** None.
- **Blast radius:** Zero today (dead code path); would become live and
  material the moment any feature adds a real call site for
  `getInvoiceFrequencyCadence`, or otherwise begins relying on a
  live-resolved cadence number for a real calculation (e.g. computing an
  actual invoice due-date schedule from cadence).
- **Existing compensating control:** The function that would exploit
  this gap (`getInvoiceFrequencyCadence`) has no real caller anywhere in
  the codebase today, confirmed by grep both in this batch and in this
  triage.
- **Can current behavior cause silent incorrect truth?** Not today, no.
  It could once a live caller exists.
- **Can current behavior create orphaned work?** No.
- **Can current behavior bypass authorization/governance?** No.
- **Can current behavior destroy/rewrite history?** No.
- **Does it block Batch 7 or later testing?** No.
- **Recommended disposition:** D. SAFE TO DEFER.
- **Reason:** No live code path is affected today; the currency
  precedent (`fx_snapshot_rate`) shows Nexus already knows how to
  correctly freeze a governed numeric value when a real financial
  calculation depends on it, so the mechanism to apply here (if ever
  needed) is already a proven, well-understood pattern, not an unsolved
  design problem. Deferring costs nothing today.
- **Why deferral is safe:** The one function that would need this
  guarantee, `getInvoiceFrequencyCadence`, has zero live callers; there
  is no live financial calculation currently exposed to a retroactive
  cadence change.
- **What event should trigger fixing it:** The moment any code change
  adds a real call site for `getInvoiceFrequencyCadence`, or otherwise
  begins deriving a live financial outcome (an invoice schedule, a
  billing calculation) from the numeric cadence value. At that exact
  point, mirror the `fx_snapshot_rate` precedent (freeze the cadence at
  component-creation time) rather than leaving it live-resolved.
- **Which later batch/domain may naturally address it:** Any future
  Invoice/Billing scheduling feature that needs a real numeric cadence,
  not tied to any currently-planned journey batch.
- **User decision required?** No, not urgently; if a live caller is ever
  proposed, the decision "should cadence be frozen like currency" should
  be made explicitly at that time rather than assumed silently either
  way, but that decision is not needed now.
- **Exact question for Utkarsh, if needed:** N/A today.
- **Suggested future journey/regression:** A regression test that fails
  loudly (a grep-based structural check, similar to L-028's own
  regression-class pattern in Batch 3) if `getInvoiceFrequencyCadence`
  ever gains a real call site without a corresponding freeze mechanism
  being added at the same time, so this decision cannot be made
  silently by accident.
- **Notes:** Corrected mid-session after an Explore sub-agent's initial
  claim that `commercial-rate-summary.ts` calls
  `getInvoiceFrequencyCadence` was independently verified and found
  inaccurate; the real usage is `resolveOption(...).label` for display
  only.

---

## Cross-gap root causes

Two genuinely shared root causes were identified, not four unrelated
one-off patches:

### Root cause A: a UI-only restriction is not mirrored at the RPC/service layer

**Gaps 1 (N-030) and 3 (P-013).** In both cases, the UI correctly hides
an operation the system does not want performed (a deactivated role
from the grant selector; an Add control from a Level 3 list), but the
underlying RPC (`grant_user_role`, `add_reference_option`) has no
equivalent check and will perform the operation anyway if called
directly. This is exactly the pattern `docs/AUTHORIZATION_MODEL.md` §14
already warns against for permission gating ("this is a rendering
convenience only, the Server Action's own check is what actually
enforces this") applied correctly there but missed on two different
axes (role activity, list tier) in two different RPCs. Both are
classified A (Fix Now) individually; the shared lesson worth recording
once, not as four unrelated patches, is: **any time a UI hides a
control because a piece of state (an `is_active` flag, a tier/level
concept) says "this should not be doable," the corresponding write RPC
must independently re-check that same state before mutating,** matching
the standard this codebase already applies correctly to permission
checks. This is a review discipline to apply going forward, not a
single shared code change (the two RPCs are unrelated to each other and
each needs its own, small, independent fix).

### Root cause B: no viewing UI over already-intact historical/list data

**Gaps 6 (N-027), 7 (N-029), 8 (O-020), and 9 (O-023).** All four are
UI-surface gaps over data that is already fully correct and durable at
the database layer; none represents any data-integrity or security
risk. All four are already covered by two existing, documented
`docs/TECH_DEBT.md` entries with explicit trigger points: the shared
`DataTable` component (search/filter/sort, covering N-027 and O-020)
and the cross-entity audit/history viewer (covering N-029 and O-023).
No new debt entry is needed for these four; they should be reconciled
against the existing `docs/TECH_DEBT.md` entries (see ACCEPT/DEFER
below) rather than tracked as four separate open questions.

No other pairing rose to the level of a shared root cause. Gap 2
(O-011's silent primary-promotion no-op) is a distinct mechanism
(an idempotency check silently ignoring a non-key parameter) with no
sibling elsewhere in this gap set. Gaps 4, 5, 10, and 11 (N-031, O-018,
N-026, P-012) are each domain-specific business questions with no
shared underlying code pattern.

## Security and control override review

For each gap, whether a malicious or accidental direct Server
Action/RPC call could bypass what the UI appears to prohibit:

- **Gap 1 (N-030):** Yes. `grant_user_role` called directly for a
  deactivated role succeeds where the UI selector would prevent it.
  The actual enforcement boundary that needs the fix is the RPC's own
  insert path, not the UI selector.
- **Gap 3 (P-013):** Yes. `add_reference_option` called directly for a
  Level 3 list succeeds where the UI's Add control is absent. The
  actual enforcement boundary that needs the fix is the RPC/service
  layer, not the UI's `LIST_CONFIGS`.
- **Gap 2 (O-011):** No bypass in the exploitable sense; the RPC
  behaves identically (silently no-ops) whether called from the UI or
  directly, so there is no UI-vs-RPC asymmetry to exploit here, only a
  broken feature.
- **All other gaps (4, 5, 6, 7, 8, 9, 10, 11):** No bypass exists; each
  is either a missing feature (no control to bypass) or an already
  correctly-enforced boundary at a coarser grain (Gap 4).

No exploit recipe, credential, live ID, or step-by-step reproduction is
included above beyond the architectural description already needed to
fix and regression-test each gap; this repository is public.

## Batch 7 dependency analysis

Per journey, whether it blocks Batch 7:

| Gap | Journey | Blocks Batch 7? | Reasoning |
|---|---|---|---|
| 1 | N-030 | DOES NOT BLOCK | Batch 7 (P-018-P-023, A-001-A-019) does not exercise role-grant mechanics at all. |
| 2 | O-011 | DOES NOT BLOCK | Batch 7 does not exercise team-primary-membership mechanics. |
| 3 | P-013 | DOES NOT BLOCK, but see note | Batch 7 continues Reference Master testing (P-018 through P-023). None of those journey IDs are Level 3 list-tier journeys, so nothing in Batch 7 depends on this fix existing first; if this gap is fixed in the same window as Batch 7, re-run a quick regression alongside P-018-P-023 to confirm no unintended new rejection. |
| 4 | N-031 | DOES NOT BLOCK | Batch 7 does not touch Entitlement/Usage/Settlement. |
| 5 | O-018 | DOES NOT BLOCK | Batch 7 does not touch Teams. |
| 6 | N-027 | DOES NOT BLOCK | Batch 7 does not touch User Access list UI. |
| 7 | N-029 | DOES NOT BLOCK | Batch 7 does not touch User Access history. |
| 8 | O-020 | DOES NOT BLOCK | Batch 7 does not touch Team Master list UI. |
| 9 | O-023 | DOES NOT BLOCK | Batch 7 does not touch Team membership history. |
| 10 | N-026 | DOES NOT BLOCK | Batch 7 does not touch self-service access views. |
| 11 | P-012 | DOES NOT BLOCK | Dead code path; Batch 7's Reference Master journeys (P-018-P-023) do not exercise cadence retroactivity. |

**None of the 11 gaps blocks a specific later batch either**: Batch 8
(Onboarding completion, Accessibility, Customer Master direct actions)
and Batch 9 (Customer Master completion, Customer Change drafting) do
not depend on any of these 11 findings being resolved first.

**Batch 7 READY.** This confirms, from a dependency-analysis angle
distinct from the overnight report's own general checkpoint-based call,
that no open Product Gap from Batches 3-6 stands between the current
state and starting Batch 7.

## Triage summary table

| # | Journey | Domain | Gap | Risk | Classification | User Decision? | Blocks Batch 7? | Recommended Next Action |
|---|---|---|---|---|---|---|---|---|
| 1 | N-030 | Users/Roles | `grant_user_role` allows granting a deactivated role | Medium | A: Fix Now | No | No | Add a `roles.is_active` check to `grant_user_role`, reject with a clear error |
| 2 | O-011 | Teams | Cannot promote an existing team membership to primary; RPC silently no-ops | Medium | A: Fix Now | No | No | Add a primary-swap mechanism (revoke old primary, insert new primary) to `assign_user_to_team` or a dedicated RPC |
| 3 | P-013 | Reference Masters | Level 3 lists have no server-side tier enforcement, UI-only | Medium | A: Fix Now | No | No, but re-verify alongside Batch 7's remaining Reference Master journeys | Add a server-side Level 3 (`LIST_TIERS`) check to `add_reference_option` |
| 4 | N-031 | Users/Roles (Entitlement cross-ref) | Two permissions (`usage.read`, `entitlement_settlement.read`) are seeded but never enforced anywhere | Low | C: Needs Decision | Yes | No | Decide: wire up as real read gates, or remove the two unused permission rows |
| 5 | O-018 | Teams (workflow) | No warning when a team's last active member is removed while work is pending | Medium | C: Needs Decision | Yes | No | Decide: block removal, warn at removal time, or add a passive "stuck work" indicator |
| 6 | N-027 | Users/Roles | No search/filter on the User Access list | Low | D: Defer | No | No | Already tracked in `docs/TECH_DEBT.md`; revisit when the shared `DataTable` component is built |
| 7 | N-029 | Users/Roles | No UI to view a user's role grant/revoke history (data itself is intact) | Low | D: Defer | No | No | Already tracked in `docs/TECH_DEBT.md`; revisit when a cross-entity audit viewer is built |
| 8 | O-020 | Teams | No search/filter on the Team Master list | Low | D: Defer | No | No | Same `DataTable` tracking as Gap 6 |
| 9 | O-023 | Teams | No UI to view a user's team membership history (data itself is intact) | Low | D: Defer | No | No | Same audit-viewer tracking as Gap 7 |
| 10 | N-026 | Users/Roles | No self-service view of a user's own access | Low | D: Defer | No | No | Add a new `docs/TECH_DEBT.md` entry; revisit on support-ticket volume |
| 11 | P-012 | Reference Masters (Commercial cross-ref) | Invoice Frequency cadence has no freeze mechanism, but is currently dead code | Low | D: Defer | No, not urgently | No | Fix only if/when `getInvoiceFrequencyCadence` gains a real caller, mirroring the FX snapshot precedent |

## Prioritized action plan

### FIX NOW

Suggested implementation order (simplest, most isolated first):

1. **N-030**: Add a `roles.is_active = true` check to `grant_user_role`
   before insert, rejecting with a clear error otherwise. No business
   decision required: the read-side permission resolver
   (`getActiveGlobalRolesForUser`) already treats `roles.is_active` as
   authoritative; this closes the one remaining place that does not.
2. **P-013**: Add a server-side Level 3 tier check (a small
   `LIST_TIERS`/level constant mirroring `LIST_CONFIGS`'s existing
   Level 1/2/3 assignments) to `add_reference_option` or its calling
   service, rejecting an add for any of the five documented Level 3
   lists. No business decision required: `docs/SETTINGS_ARCHITECTURE.md`
   §3 already names exactly which five lists this applies to and states
   the intended behavior unconditionally.
3. **O-011**: Add a primary-swap mechanism to `assign_user_to_team` (or
   a dedicated new RPC) that, when called for an existing active
   membership with a different `is_primary` value, actually performs a
   revoke-old-primary-then-insert-new-primary transaction rather than
   silently returning the unchanged row. No business decision required:
   whether `is_primary` should exist and be admin-settable is already
   answered by shipped product code; only the update mechanism is
   missing.

### NEEDS UTKARSH DECISION

1. **N-031**: Should Nexus wire up `usage.read` and
   `entitlement_settlement.read` as real, independent read gates on the
   entitlement/usage/settlement page (giving finer-grained visibility),
   or remove the two permission rows since nothing currently enforces
   them and no role needs the finer distinction today?
2. **O-018**: When an admin removes the last active member of a team
   that has work pending at one of its workflow nodes, should Nexus
   block the removal, show a warning but allow it, or leave the removal
   unrestricted and instead add a passive "stuck work" indicator
   elsewhere (e.g. Operations Queue)?

### ACCEPT / DOCUMENT

Reconcile the Journey Universe against the existing, already-correct
`docs/TECH_DEBT.md` entries rather than continuing to track these as
open gaps:

- **N-027 and O-020** (list search/filter): both are already covered
  by `docs/TECH_DEBT.md`'s existing `DataTable` entry ("Later" section).
  Update `docs/NEXUS_JOURNEY_UNIVERSE.md`'s own N-027/O-020 entries to
  cross-reference that existing debt entry instead of treating this as
  a fresh open question each run.
- **N-029 and O-023** (history viewing UI): both are already covered by
  `docs/TECH_DEBT.md`'s existing "No global audit/history viewer
  exists" entry ("Later" section). Update the Journey Universe's
  N-029/O-023 entries the same way.

No gap in this batch was classified as pure "B: Intentional/Accept" in
the sense of "this was a mistake to ever flag" (none of the 11 gaps are
that); the four above are better described as D (Safe to Defer) with an
existing, already-correct trigger already on record, which is why they
appear here as a reconciliation action rather than a fresh disposition.

### DEFER

- **N-026** (self-access view): safe to defer; no existing
  `docs/TECH_DEBT.md` entry names this specific gap yet. Add one to the
  "Later" section, worded similarly to the existing entries, with the
  trigger "a material volume of 'why can't I do X' support requests."
- **P-012** (cadence retroactivity): safe to defer; genuinely dead code
  today. Trigger: the moment any code adds a real call site for
  `getInvoiceFrequencyCadence`, decide then (mirroring the FX snapshot
  precedent) rather than leaving the decision implicit.

## Validation

- Exactly 11 Product Gaps found, mechanically confirmed by grep against
  all four batch ledgers and cross-checked against each ledger's own
  Final Report tally.
- Each of the 11 appears exactly once above.
- Each of the 11 has exactly one classification (A: 3, C: 2, D: 6;
  no B; 3 + 2 + 6 = 11).
- Both C gaps (N-031, O-018) have a concrete question with named
  options, benefits, and risks for Utkarsh.
- All three A gaps (N-030, O-011, P-013) each identify the existing
  invariant or already-shipped decision proving no product decision is
  required.
- All six D gaps (N-027, N-029, O-020, O-023, N-026, P-012) each state
  a concrete deferral trigger.
- Every gap has an explicit Batch 7 dependency statement; all 11 are
  DOES NOT BLOCK.
- No already-fixed defect (DEFECT-B3-001/002/003, DEFECT-B4-001,
  DEFECT-B6-001) appears anywhere in this triage.
- No expected-behavior journey (N-013, O-005, U-002, N-022) appears
  anywhere in this triage as one of the 11; both N-013 and O-005 are
  explicitly named and excluded, with reasoning, in the exclusions
  section above.

## Deployment impact

This is a docs-only change: one new file
(`docs/journey-runs/PRODUCT_GAP_TRIAGE_BATCHES_03_06.md`). No source
code, migration, RPC, permission, workflow, reference data, or team/role
data was touched. A deployment is not required for this change to take
effect (there is no runtime behavior to deploy), but it will still be
pushed to `team-preview` per the mission's git instructions so the
document is available to the team; Preview will rebuild automatically
on push (a documentation-only build with no behavioral difference from
the prior deployment), and Production remains untouched and was never
a target.

## IMPLEMENTATION OUTCOME (Product Gap Closure pass)

Added after the triage above was acted on. The classifications and
reasoning above are unchanged; this section records what actually
happened.

- **N-030: CLOSED.** `grant_user_role` now rejects a target role with
  `roles.is_active = false` (`ROLE_INACTIVE`) before insert, matching
  migration `20260930010000_grant_user_role_requires_active_role.sql`.
  Evidence: a live throwaway-persona test confirmed an inactive-role
  grant is rejected, an identical grant against the same role
  immediately succeeds once reactivated, and a pre-existing active
  grant for an unrelated user is untouched. Regression coverage:
  live-verified against the real database (the invariant lives entirely
  in SQL); re-run alongside N-008/N-013/N-023 whenever role-grant
  mechanics are next touched.
- **P-013: CLOSED.** `add_reference_option` now rejects all five Level 3
  list_keys (`commercial_nature`, `pricing_model`, `invoice_timing`,
  `slab_method`, `revenue_recognition_method`) with
  `REFERENCE_LIST_SYSTEM_SUPPORTED` before insert, matching migration
  `20260930020000_add_reference_option_level3_enforcement.sql`.
  Evidence: a live test confirmed a direct RPC call for `commercial_nature`
  is now rejected, while a Level 1 list (`segment`) is unaffected and
  still accepts a new value. Read access, existing options, and existing
  references are unaffected; `set_reference_option_active` was
  deliberately left untouched.
- **O-011: CLOSED.** The primary-team invariant was already unambiguous
  (one active primary per user, globally, enforced by the pre-existing
  `uq_user_teams_one_active_primary` partial unique index on `user_id`
  alone; `assign_user_to_team`'s own code comment already documented the
  intended revoke-then-reinsert mechanism for switching primary between
  two teams), so no product decision was needed. A new
  `set_primary_team_membership` RPC
  (`20260930030000_set_primary_team_membership.sql`) atomically promotes
  an existing membership to primary. Live regression testing caught a
  real bug in the first version of this RPC before it was relied on:
  promoting a new primary team fully revoked the user's previous primary
  team membership instead of demoting it to a non-primary active
  membership, silently removing the user from a team that was never
  supposed to be touched. Corrected the same day
  (`20260930040000_fix_set_primary_team_membership_demotion.sql`) and
  re-verified: the previous primary team now correctly remains an
  active, non-primary membership after a promotion. Confirmed live
  through the real `/settings/user-access` UI against a genuine
  multi-team test persona: clicking "Make Primary" swapped the primary
  designation and left the old primary team intact as a non-primary
  active membership, then the same control correctly reverted it back.
  A minimal "Make Primary" control was added to the User Access UI; unit
  tests were not added for this RPC's SQL logic (the invariant lives
  entirely in the database function, mirroring N-030/P-013), but the
  live regression evidence above, including the bug catch and fix,
  stands as the record of correctness.
- **N-031: CLOSED.** Decision (Option 1 from the triage, made by
  Utkarsh): wire up `usage.read` and `entitlement_settlement.read` as
  real, independent read gates rather than removing them.
  Permission-to-surface mapping (documented in full in
  `docs/AUTHORIZATION_MODEL.md` §23): `AuthGate`'s `requiredPermission`
  now accepts a list of alternatives (`entitlement.read` OR
  `usage.read` OR `entitlement_settlement.read` admits the page at all,
  backward-compatible for every other call site which still passes a
  single requirement); within the page, Entitlement Sources/Schedule/
  Ledger check `entitlement.read`, Monthly Usage checks `entitlement.read`
  OR `usage.read`, and Unbilled/Unearned Ledger check `entitlement.read`
  OR `entitlement_settlement.read`; Commercial Context (identifying
  metadata only) remains always visible. Write-side gating
  (`entitlement.write`, `usage.write`, `usage.finalize`,
  `entitlement_settlement.write`) is completely unchanged. Evidence: a
  live throwaway persona granted only `usage.read` reached the page and
  saw exactly Commercial Context and Monthly Usage, none of the
  entitlement/settlement sections, confirmed against a real customer's
  real entitlement/usage data.
- **O-018: CLOSED.** Decision (Option 2 from the triage, made by
  Utkarsh): warn but allow, never silently allow and never absolutely
  block. Warning behavior: `checkTeamRemovalImpactAction` computes the
  real, current impact before a team membership removal completes; if
  it would leave zero active members on the team with at least one
  pending item responsible to it, a confirmation dialog states the
  exact current count ("This change will leave N pending approval(s)
  with no eligible approver on Team X. Remove this membership anyway?")
  and requires explicit confirmation; a removal with no such risk
  proceeds with no interruption. Orphan visibility behavior: the
  Operational Queue (`/operations/queue`, an existing, already-
  discoverable admin surface, not a new dashboard) now shows a summary
  banner ("N item(s) have no eligible approver"), a per-item
  "No eligible approver" badge next to the responsible team's name, and
  static recovery guidance. Recovery behavior: unchanged from before,
  assigning a new active member to the team immediately makes the
  stuck item actionable again; no auto-reassignment was invented.
  Evidence: live-verified against the real, pre-existing WF-TEST Legal
  team and its real pending item (CCR-000055): revoking both of Legal's
  active members produced "1 item has no eligible approver" with the
  correct team name and item on the Operational Queue; restoring both
  memberships (to their exact prior state, including primary flags)
  immediately cleared it. Regression coverage: `operational-queue.test.ts`
  gained cases for `hasEligibleApprover`/`responsibleTeamName` (present
  team with members, present team with zero members, no team at all,
  team entirely absent from the count map). The membership removal
  itself remains auditable through the existing `user_teams` historical-
  grant mechanism; no new, separate audit event was invented for the
  warning step itself, per the mission's own instruction.

**DEFERRED ITEMS, tracking confirmed:**

- N-027, O-020: tracked in `docs/TECH_DEBT.md`'s existing shared
  `DataTable` entry ("Later" section), now cross-referencing both
  journey IDs explicitly.
- N-029, O-023: tracked in `docs/TECH_DEBT.md`'s existing "No global
  audit/history viewer exists" entry ("Later" section), now
  cross-referencing both journey IDs explicitly.
- N-026: a new `docs/TECH_DEBT.md` entry was added ("No self-service
  'My Access' view exists," "Later" section) since none existed before.
- P-012: a new `docs/TECH_DEBT.md` entry was added ("Invoice Frequency
  cadence has no freeze mechanism," "Later" section) since none existed
  before, stating the exact trigger (a real caller for
  `getInvoiceFrequencyCadence`, or any other live financial derivation
  from the numeric cadence value).

No deferred item was implemented in this pass, per the mission's
explicit instruction.
