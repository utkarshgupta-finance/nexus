# Customer Lifecycle

Status: **IMPLEMENTED.** The Onboarding Case lifecycle, its atomic
approval into a real Customer Master + Commercial Configuration, the
Customer Change Request lifecycle (Customer workspace tabs, Field
History), the governed Commercial Configuration Version 2+ draft/
activate lifecycle, and Permanent Customer Deletion are all implemented
and persisted. Version History surfaces an "Approved By" column for
governed versions (§4), and the real human account
(`utkarsh.gupta@mobisy.com`) holds `commercial_configuration_admin` and
`reference_master_admin`, so it can exercise the Commercial Version 2
write/approve UI through a real session. A Customer Lifecycle V1 UX
pass (manual testing round) additionally added: shared loading/pending
feedback across route navigation and every mutating action, a
consistent Previous/Save Draft/Next/Submit footer across all five
Onboarding stages, a Submitted confirmation screen, an Approve success
screen linking straight to the new Customer and Commercials, and removal
of the development-only Commercial Configuration promotion panel from
the real onboarding flow (§4). Customer Search (§7), including former
legal/brand name resolution through the existing Field History, is also
implemented.

## 1. Onboarding Case lifecycle: IMPLEMENTED

Extends the existing generic `requests`/`submission_revisions` pattern
(`supabase/migrations/20260907044335_submission_data_foundation.sql`)
with a thin, case-specific table,
`customer_onboarding_cases` (`supabase/migrations/20260913040000_customer_lifecycle_onboarding_foundation.sql`),
1:1 keyed on `request_id`, exactly the same shape `commercial_changes`
already established for Commercial Configuration
(`docs/COMMERCIAL_DOMAIN_ARCHITECTURE.md`). It carries only what
`submission_revisions` itself cannot express: case-level `status`
(`draft`/`submitted`/`sent_back`/`resubmitted`/`approved`,
`src/features/customer-onboarding/domain/types.ts`'s
`CustomerOnboardingCaseStatus`), the current stage, send-back
reason/actor/time, and approval actor/time.

Real, permission-gated RPCs (all following the established
`set_config('app.current_user_id', ...)` actor-audit pattern):

- `create_customer_onboarding_case`: mints the request, its first draft
  revision, and the case row.
- `save_customer_onboarding_draft`: updates the current draft
  revision's `raw_data` and the case's current stage. Always allowed
  regardless of which fields are still missing (Save Draft is never a
  validation gate).
- `submit_customer_onboarding_case`: freezes the draft revision via the
  existing `submit_revision` RPC and transitions the case to `submitted`
  or `resubmitted` (derived from whether the case was previously
  `sent_back`).
- `send_back_customer_onboarding_case`: requires a reason, opens the
  next draft revision immediately (`create_next_revision`), and records
  who sent it back, when, and why. The reviewed revision is never
  touched.
- `approve_customer_onboarding_case`: see §2.

A submitted revision's real field data lives inside
`effective_data.values` (an empty `applicability` object alongside it:
Customer Onboarding has no conditional question logic yet, so this is an
honest empty state, not a fabricated one), matching the platform-wide
submission contract shape (`chk_submission_revisions_lifecycle`). The
mapper that unwraps this back to a flat object is
`src/features/customer-onboarding/domain/case-mappers.ts`.

TypeScript layering mirrors `src/features/commercial/` exactly:
`data/case.data.ts` (RPC wrappers) -> `services/case.service.ts` (thin
orchestration) -> `server.ts` (read-only public server entry) /
`actions.ts` (mutating Server Actions, each deriving the actor via
`requirePermission("customer", ...)`).

## 2. Approval promotion: IMPLEMENTED

`approve_customer_onboarding_case` is one atomic Postgres function
composing the existing, already-tested Commercial Configuration RPCs
(`create_system_commercial_request`,
`create_commercial_configuration_with_change`, `add_commercial_component`,
`add_commercial_commitment`) from SQL rather than sequential TypeScript
calls, so a mid-way failure rolls back the entire transaction: it is
never possible to end up with a Customer Master row and no Commercial
Configuration, or a partially-populated Commercial Configuration.
Idempotent: a case already `approved` returns its existing linkage
unchanged rather than creating a second customer or configuration on a
duplicate click.

The TypeScript service (`approveOnboardingCase`) reads the case's
submitted Commercial Rate draft back out and maps each component through
`mapOnboardingComponentToCommercialComponentInsert`
(`domain/commercial-configuration-promotion.ts`), the same mapping used
by Commercial Configuration Version 2+'s draft/activate path (§4), so a
component's stored shape is identical regardless of which governed path
created it.

## 3. Customer Master: governed by Change Requests

Customer Master (`customers`) was extended
(`supabase/migrations/20260913060000_customer_change_request_foundation.sql`)
with five real, governed columns: `segment`, `business_unit`, `country`,
`industry`, `brand_name` (all nullable text; `name` was already real).
`fn_protect_customer_lifecycle` (the same trigger that has always
blocked direct writes to Customer Master) was extended to allow these
six columns to change, but ONLY through
`approve_customer_change_request`: nothing else in the application ever
writes to `customers` directly.

`customer_onboarding_cases` approval
(`20260913063000_populate_customer_columns_on_onboarding_approval.sql`)
now also populates these five columns from the onboarding form's own
data at approval time, so every newly onboarded customer starts with
real values instead of nulls.

## 3a. Customer Change Request lifecycle: IMPLEMENTED

`customer_change_requests` extends `requests` 1:1, the same
precedent `customer_onboarding_cases` and `commercial_changes` both
already established. `customer_change_request_requirements` persists
the Workflow rule evaluator's own output at Submit time (see §3b).
`customer_field_history` is real, permanent, field-level business
history: one row per changed field, per approved Change Request,
written inside the same atomic transaction that updates `customers`.

Real, permission-gated RPCs (`customer.change_request` for the
requester side, `customer.approve` for the reviewer side), all
following the established `set_config('app.current_user_id', ...)`
actor-audit pattern:

- `create_customer_change_request`: mints the request, its first draft
  revision, and the change request row, capturing the customer's
  CURRENT `row_version` as `base_customer_row_version` for later
  staleness detection.
- `save_customer_change_draft`: updates the current draft revision's
  `raw_data`. Always allowed regardless of which fields are proposed.
- `submit_customer_change_request`: freezes the draft revision via
  `submit_revision`, bulk-inserts the TS-computed Workflow
  requirements, and transitions to `submitted` or `resubmitted`.
- `send_back_customer_change_request` / `reject_customer_change_request`:
  require a non-empty reason; send-back opens the next draft revision
  immediately (`create_next_revision`), reject is terminal and never
  touches `customers`.
- `approve_customer_change_request`: the atomic apply. Re-verifies
  `customers.row_version` against the Change Request's own
  `base_customer_row_version` (raising `CUSTOMER_CHANGE_STALE_BASE` if
  the customer changed since this request was created), writes one
  `customer_field_history` row per actually-changed field (skipping
  fields the proposal touches but does not actually change), updates
  `customers` in a single combined `UPDATE` statement (exactly one
  `row_version` bump per approval), and marks the request approved.
  Idempotent on `status = 'approved'`, matching the onboarding
  approval's own established idempotency pattern. Deliberately checks
  only the six known, fixed governed columns, never dynamic SQL against
  arbitrary field names.

TypeScript layering mirrors `src/features/customer-onboarding/` exactly,
in a sibling feature `src/features/customer-change/`: `domain/` (pure:
`governed-fields.ts`, `diff.ts`, `workflow-rules.ts`,
`change-request-mappers.ts`) -> `data/change-request.data.ts` (RPC
wrappers) -> `services/change-request.service.ts` -> `server.ts` /
`actions.ts`.

## 3b. Customer Change Request workflow requirements: IMPLEMENTED (informational)

`src/features/customer-change/domain/workflow-rules.ts` wires the
existing, pure Nexus Workflow rule evaluator
(`src/platform/workflow/domain/evaluator.ts`) into Customer Change
Requests with a real, non-fabricated rule set: a Segment change
requires Finance Head approval; a Business Unit change requires BOTH
the outgoing and incoming Business Unit Head's approval (kept distinct
via the evaluator's own scope-value dedup mechanism); a Legal Entity
Name change requires updated registration evidence. These are computed
fresh at Submit time from the customer's real current values vs the
draft's proposed values, persisted to `customer_change_request_requirements`,
and shown to both the requester (before Submit) and the reviewer
(before deciding).

Simplification, stated honestly: since no per-role user directory exists
in this environment (only one real human account,
`customer_lifecycle_admin`), persisted requirements are informational/
transparency-only in this V1. The actual approval gate remains a single
Approve / Send Back / Reject decision by any `customer.approve` holder,
not a per-requirement individual sign-off. This mirrors the onboarding
case review's own established simplification exactly.

## 3c. Customer workspace: IMPLEMENTED

`/customers/[customerKey]` is a tabbed workspace
(`src/features/customers/ui/customer-master-detail.tsx`): Overview,
Customer Details, Tax & Registration, Commercials, Documents, Change
Requests, History. A real governed field (`record.segment` etc.) always
wins over demo enrichment; demo enrichment is shown only as a fallback
for a field that has never been set. There is no direct Edit action
anywhere on this screen; the only mutating entry point is "Create
Change Request".

The History tab renders `customer_field_history` directly: Field / Old
Value / New Value / Effective Date / Changed At. The Change Requests tab
lists every Change Request against this customer with a link to either
its requester-facing draft screen or its reviewer-facing decision
screen, depending on status.

## 4. Commercial Version 2+ (draft/activate): IMPLEMENTED

The interactive "Promote to Commercial Configuration (development)"
panel that previously called `create_commercial_change_for_configuration`
directly from the Customer Onboarding UI has been removed from the real
user-facing flow (Customer Lifecycle V1 UX pass): the real approval
flow now creates Commercial Version 1 automatically, and every later
version goes through the governed path below. The underlying RPC itself
is untouched (still used internally by `approveOnboardingCase` for
Version 1), it is simply no longer exposed as a form asking for a raw
Customer Master id, Configuration key, or Configuration name.

`supabase/migrations/20260913070000_commercial_configuration_version_lifecycle.sql`
adds the governed, parallel path for every version after the first:
`commercial_configuration_versions` extends `requests` 1:1 (the same
precedent `customer_onboarding_cases` and `customer_change_requests`
both already established), with the proposed Commercial Rate draft
living in `submission_revisions`, never duplicated.

Real, permission-gated RPCs (`commercial_configuration.write` for the
requester side, `commercial_configuration.approve` for the reviewer
side):

- `create_commercial_configuration_version`: mints the request, its
  first draft revision (seeded from the configuration's current active
  Components via `toDraftComponent`, the exact inverse of the promotion
  mapper), and the version row.
- `save_commercial_configuration_version_draft` / `submit_commercial_configuration_version`
  / `reject_commercial_configuration_version`: mirror the Customer
  Change Request lifecycle's own shape exactly.
- `approve_commercial_configuration_version`: the atomic apply/activate.
  Mints a real request via `create_system_commercial_request`, closes
  the prior active version's Components (`effective_to = new effective
  date - 1`, the same closure logic `create_commercial_change_for_configuration`
  already used, now gated on approval instead of firing at draft
  creation), inserts the new `commercial_changes` row, and materializes
  every Component (with its FX snapshot preserved from draft time, never
  recomputed) via the existing `add_commercial_component`/
  `add_commercial_commitment` RPCs. Idempotent on `status = 'approved'`.
  The prior version's Components are never edited or deleted, only
  closed: Version 1 stays immutable and fully visible in Version History
  forever.

TypeScript layering lives inside `src/features/customer-onboarding/`
(not a new feature, and not `src/features/commercial/`), reusing that
feature's own Commercial Rate editor (`CommercialRateSection`),
promotion mapper (`mapOnboardingComponentToCommercialComponentInsert`),
and reconstruction helper (`toDraftComponent`) directly, since Commercial
Configuration promotion/versioning logic already lives there
(`domain/commercial-configuration-promotion.ts`,
`domain/commercial-configuration-view.ts`) and a feature must not import
another feature's internals (docs/ARCHITECTURE.md).

"Create New Version" on `/commercials/[configId]` (gated on
`commercial_configuration.write`) is the new, governed entry point.

Known gap, stated honestly: `src/features/commercial/ui/version-history-table.tsx`
and `toVersionSummaries` were not extended with an "Approved By" column
for governed versions (`commercial_configuration_versions.decided_by`);
Version History today still shows only Version/Status/Category/
Effective From/To/Billing Currency/FX Snapshot/Created At/Actions,
exactly as it did before this round. Both real Version 1 and the real
Version 2 built during this round render correctly through it; only the
new "who approved this version" fact is not yet surfaced there.

## 5. Permanent Customer Deletion: IMPLEMENTED

`supabase/migrations/20260913080000_permanent_customer_deletion.sql`
(fixed by `20260913081000_fix_delete_customer_permanently_eligibility.sql`
after direct smoke-testing caught the original eligibility bar being
unreachable, see below) adds `delete_customer_permanently`, gated on
`customer.delete_permanent` (still granted only to `Customer Lifecycle
Admin`).

Eligibility is schema-derived, never invented: a customer is eligible
for permanent deletion only when it has **zero `commercial_configurations`
rows** and zero approved `customer_change_requests`. This is a stricter
bar than "zero real Commercial Components" because `commercial_changes`
itself carries its own unconditional append-only trigger
(`fn_reject_update_delete`, from an earlier round) and
`commercial_configurations.customer_id` is a RESTRICT foreign key:
once a customer has been approved into a Commercial Configuration, even
an empty-shell one, that Configuration and its `initial_setup` Change
can never be deleted, so the customer can never be deleted either. This
was discovered by direct SQL smoke-testing before writing any
TypeScript (the original migration's "zero Commercial Components" bar
would have failed for every real onboarded customer, since
`approve_customer_onboarding_case` always creates a Commercial
Configuration, even for zero components). A genuinely never-commercialized
customer (created directly via `insertCustomer`, the same path the very
first demo customer used, never through onboarding) has zero Commercial
Configurations and remains eligible.

`customers` has carried an unconditional DELETE-rejecting trigger
(`fn_protect_customer_lifecycle`) since its own foundation migration.
This migration extends it with a narrow, session-local bypass
(`app.permit_customer_delete`), set only by
`delete_customer_permanently` for the duration of its own transaction.

`customer_deletion_audit` follows the exact same "no FK back to the
described row" discipline `audit_log.row_id` already established: a
plain, unconstrained snapshot column (key/name/segment/business unit/
country/industry/brand/was-active/reason/actor/time), append-only via
its own `fn_reject_update_delete` trigger, so a deletion's evidence
survives the row it describes, permanently, and cannot itself be
altered or removed.

Customer -> More Actions -> "Permanently Delete Customer"
(`src/features/customers/ui/delete-customer-panel.tsx`) checks real
eligibility before enabling anything, requires a Reason and typing
"DELETE" to confirm, and offers "Deactivate Instead" (sets `is_active =
false`, the customer stays fully intact) when blocked.

## 6. Permissions

Seeded: `customer.create`, `customer.read`, `customer.approve`,
`customer.change_request`, `customer.delete_permanent`, and one role,
`Customer Lifecycle Admin`, holding all five. `customer.change_request`
now gates every requester-side Customer Change Request action
(create/save/submit); `customer.approve` gates the reviewer-side
decision (send back/reject/approve), the same role that already gated
onboarding case approval. `customer.delete_permanent` is enforced
server-side wherever it matters: `requirePermission("customer",
"delete_permanent")` gates every Server Action in §5 (eligibility
check, delete, deactivate), the Customer page resolves the same
permission server-side to decide whether "More Actions" renders at
all, and `delete_customer_permanently` itself is only grantable to
`service_role` (`revoke execute ... from anon, authenticated`), so a
client cannot call it directly even bypassing the Server Action layer.

## 7. Customer Search: IMPLEMENTED

`/customers` filters server-side by plain query parameters
(`q`/`segment`/`businessUnit`/`country`/`status`), read by
`src/app/customers/page.tsx` and applied by the pure
`filterCustomerMasterEntries` (`src/features/customers/domain/search.ts`):
substring match on legal entity name, brand, and customer key, plus
exact-code match on Segment/Business Unit/Country and active/inactive
status. No fuzzy matching, no search index: the dataset is Nexus's own
governed customer base, not a general-purpose corpus.

A query that does not match any customer's CURRENT name/brand may still
match a name it used to carry: `searchFormerCustomerNames`
(`src/features/customer-change/services/change-request.service.ts`)
searches `customer_field_history` (the same permanent, field-level
history the Customer -> History tab already renders, §3a) for a
`name`/`brand_name` row whose `old_value` matches, and
`findCustomersByFormerName` (`src/features/customers/server/former-name-search.ts`)
resolves each match back to its current Customer Master record. The
Customers page renders these as a separate, clearly annotated group
("Former legal name: X" / "Former brand: X"), never merged silently into
the current-name result set, and never shown at all for a customer
already matched on its current fields. This reuses the existing Field
History table exactly as it already exists; no second alias/identity
table was introduced.

Fixed alongside this (Customer Lifecycle V1 journey hardening): the
Customers list page previously read Brand/Country/Segment/Business
Unit/Billing Currency only from the legacy demo enrichment fixture,
never from `customers`' own real governed columns, so every real
onboarded customer showed blank values in those columns even though the
Customer detail page already resolved them correctly. Both pages now
share one resolver module, `src/features/customers/domain/display-fields.ts`
("a real governed value always wins over demo enrichment, which is a
fallback only for a field that has never been set"), so the list and
detail page can never drift into two different answers again.

## 8. Customer Activity: IMPLEMENTED

The Customer workspace's new Activity tab
(`src/features/customers/ui/customer-activity-timeline.tsx`) is one
readable, newest-first event stream built from data Nexus already
persists, never raw `audit_log` JSON and never a fabricated feed:
Customer Onboarding approval (the "how did this customer come to
exist" event), Customer Field History (every governed field change,
already plain old/new values), Customer Change Request lifecycle
transitions (created/sent back/approved/rejected), Commercial
Configuration Version lifecycle transitions (created/approved/
rejected), and `customers`' own `is_active` audit trail (deactivated/
reactivated), read narrowly (only the `is_active` before/after, nothing
else from that row's audit JSON).

`src/features/customers/domain/activity.ts` is the pure builder (no
I/O, directly unit-testable); `src/features/customers/server/activity.ts`
gathers every input in parallel and hands off to it.

This also introduces a genuinely new, small, reusable platform
capability: `src/platform/audit/server.ts`. `app_users` deliberately
holds no profile fields (name/email), so resolving an actor id to
something a human can read required one new helper,
`resolveActorEmails`, backed by the Supabase Auth admin API
(`auth.admin.getUserById`), batched once per timeline build rather than
once per event. `listAuditLogForRow` is a generic, reusable read over
`audit_log` for any table/row, so a future feature never needs to
reimplement this query.

Known gap, stated honestly: Commercial Version History
(`src/features/commercial/ui/version-history-table.tsx`) still renders
"Approved By" as a raw UUID prefix rather than through this same
resolver; wiring it through is a small, isolated follow-up, not done in
this round.

## 9. Unified Approvals inbox: IMPLEMENTED

`/approvals` (`src/app/approvals/page.tsx`) replaces the sidebar's
previously fragmented three-page Reviews flow (Onboarding Reviews,
Change Request Reviews, Commercial Version Reviews, each a separate
route cross-linked only by small text links) with one operational
list across all three lifecycles, filterable by Needs My Action / Sent
Back / Completed / All. Each row still opens the same real, unchanged
`/reviews/*` decision screen for that request type; this is a unified
list, not a new decision surface, so no governed RPC, permission, or
approval logic was touched.

New platform capability: `src/platform/approvals/` (`domain/inbox.ts`
is the pure bucket/sort/filter logic, directly unit-tested;
`server.ts` gathers a "list every request of this type regardless of
status" read from each of the three features and resolves customer
names and requester emails via `platform/audit`). Each feature gained
one additive `listAll*Entries` data/service function alongside its
existing `listAllCasesAwaitingReview`-style queue reads; nothing about
the existing per-type review queues changed.

The sidebar's "Reviews" entry was removed in favor of the "Approvals"
entry it already listed (previously a dead link: no `/approvals` route
existed yet). The Customers page's "Onboarding Requests" link now
points to `/approvals` for the same reason.

## 10. Customer Summary: IMPLEMENTED

The Customer workspace's Overview tab gained a "Summary" section for a
Finance reader who wants the state of a customer without clicking
through every tab: Segment, Business Unit, Country, Status, the
originating Onboarding Request (linking to its `/reviews/:requestId`
decision screen, or "Created directly" for a customer never onboarded
through the governed flow), the most recent Change Request (linking to
its own draft or decision screen depending on status), and Created
At/Last Changed At. No fabricated metric (MRR, health score, and
similar) was added: every value here is a real column or a real
request already persisted elsewhere in this document.
