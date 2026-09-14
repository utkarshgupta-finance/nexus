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

Version History (`src/features/commercial/ui/version-history-table.tsx`)
shows Version/Status/Category/Effective From/To/Billing Currency/FX
Snapshot/Created At/Approved By/Actions; `toVersionSummaries` takes an
optional changeId -> actor lookup sourced from
`commercial_configuration_versions.decided_by`, blank (never fabricated)
for a version created through the older immediate-promotion path.

The Commercial Version review screen (`/reviews/commercial-versions/:requestId`)
shows a Current vs Proposed diff before Approve/Reject (task Phase G),
not the proposed rate in isolation: `getCommercialVersionDiff`
(`services/commercial-version.service.ts`) reconstructs "current" from
the configuration's active Components via the same `toDraftComponent`
inverse mapper §4 already uses to seed a new draft, and
`diffCommercialRate` (`domain/commercial-rate-diff.ts`, pure, unit-tested)
classifies every component UNCHANGED/CHANGED/ADDED/REMOVED, matching
Slab bands by position, Designation rows by designation name, and
Milestones by name (none of these carry a stable id across
reconstructions). Changed/added/removed are shown by default; unchanged
components are available behind a "Show unchanged" toggle, never
hidden entirely.

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

## 11. Commercial Version scheduling: IMPLEMENTED

A version's "is this the customer's real current terms" status is now
THREE states, derived, never stored (task Phase H):
`src/features/commercial/read-models/configuration-overview-helpers.ts`'s
`toVersionSummaries` takes an explicit `today` (ISO date) parameter and
returns `scheduled` (Components open, i.e. `effectiveTo` null, but
their own `effectiveDate` has not arrived yet), `active` (open AND
`effectiveDate` has arrived; at most one at a time), or `superseded`
(closed). Approving a future-dated Commercial Version no longer makes
it the customer-facing "current" terms early: it shows as "Approved,
Scheduled" on both the Customer Commercials header and Version History
until its own effective date arrives, at which point this same read
model resolves it as "Active" without any mutation, migration, or
scheduled job. `today` is always resolved server-side
(`new Date().toISOString().slice(0, 10)`) and passed down as a plain
prop, never read from `Date.now()` inside a Client Component, so the
result is deterministic and testable.

`approve_commercial_configuration_version`
(`supabase/migrations/20260914090000_commercial_version_effective_date_ordering_guard.sql`)
gained one new guard: it now rejects an approval whose `effective_date`
is not strictly after the currently open Components' own
`effective_from`, raising `COMMERCIAL_VERSION_EFFECTIVE_DATE_OUT_OF_ORDER`
rather than silently producing an incoherent history. Overlapping
approved effective periods were already structurally impossible within
one Commercial Configuration (this RPC always closes every open
Component before opening a new set, confirmed against real production
data before this migration shipped); this guard closes the one
remaining gap, an approval whose own effective date does not respect
that ordering.

## 12. Customer Duplicate Prevention: IMPLEMENTED

Checked once, at Submit (never at Save Draft, since a draft is not yet
a claim to a real identity): `checkForDuplicateCustomersAction`
(`src/features/customer-onboarding/actions.ts`) compares the draft's
GST/PAN/Legal Entity Name/Brand against every approved customer, using
only deterministic exact matches, never fuzzy/AI matching as an
authoritative blocker (`domain/duplicate-detection.ts`, pure,
unit-tested). GST and PAN are hard identifiers: any match blocks
Submit outright, re-checked on every attempt, with no override in this
V1. Legal Entity Name and Brand are soft signals: a match warns
("Potential existing customer", linking straight to the existing
Customer) but Submit proceeds on a second click, since two different
real businesses can legitimately share a name or brand.

GST/PAN are never promoted onto `customers` itself (docs §3), so the
check reads every approved case's own submitted revision
(`listApprovedCaseTaxIdentity`) for those two fields specifically;
Legal Entity Name/Brand are read from the real, current `customers`
row instead (more authoritative than a stale onboarding snapshot,
since a Change Request may have renamed the customer since it was
onboarded).

## 13. Human-Friendly IDs: IMPLEMENTED

Users no longer primarily see raw UUID prefixes as their reference for
a request. Every governed request-extension table gained one integer
column, backed by its own Postgres sequence
(`supabase/migrations/20260914100000_human_friendly_request_ids.sql`):
`customer_onboarding_cases.case_number` ("CO-000123"),
`customer_change_requests.request_number` ("CCR-000045"),
`commercial_configuration_versions.version_number` ("CC-000078",
distinct from that row's own business-facing "Version N" ordinal,
which stays per-configuration). A `not null default nextval(...)`
column added via `alter table` is evaluated once per already-existing
row at migration time, so every historical record got a real, never-
reassigned number too, confirmed empirically after applying.

Each number is purely a display/search convenience: `request_id`
remains the real, internal stable identity everywhere a join or
governed RPC call happens. Three tiny, colocated pure formatters
(`formatOnboardingCaseId`, `formatChangeRequestId`,
`formatCommercialVersionId`, each next to its own domain type) turn
the raw integer into its prefixed, zero-padded display form. Wired
into the Approvals inbox, all three Reviews list/detail screens, the
Onboarding Submitted confirmation screen, and the Customer workspace's
Change Requests tab.

## 14. Approval UX standardization: IMPLEMENTED (partially, honestly scoped)

Audited all three review screens against one checklist (task Phase F):
what is being requested, what changed, what evidence exists, what
requirements were triggered, who else must approve, what happens after
approval. Send Back/Reject already required a reason on every screen
(no change needed). Current vs Proposed already existed for Customer
Change Request (`FieldDiffTable`) and now exists for Commercial Version
(§4/§14, task Phase G); Onboarding has no equivalent "prior version" to
diff against, since a resubmission simply replaces the same evidence
under review. "Who else must approve" only ever applied to Customer
Change Request's own Workflow rule requirements (§3b), correctly absent
from the other two. Each screen's Review Decision section now states
plainly, in its own real governed vocabulary, what Approve/Send Back/
Reject actually does before the reviewer clicks anything.

Known gap noted here, closed in §15 below: "what evidence exists"
could not be added for Customer Onboarding in this pass, because
uploaded tax/company documents were not persisted anywhere yet
(`domain/documents.ts`'s own header: "There is no upload to Supabase
Storage yet... currently held only as local, in-session state"). A
reviewer cannot see evidence that was never saved. This is Customer
Documents' own gap (task Phase D), not an approval-UX gap; it is
closed for Onboarding immediately below, in the same round.

## 15. Customer Documents (Onboarding slice): IMPLEMENTED

Closes the exact gap §14 just found: every Customer Onboarding
attachment (GST/PAN/TAN, Tax Registration, Company Registration, every
Commercial Document, the Signed Agreement) now really persists, not
only local browser state. Implements exactly the shape already
documented for this in `domain/types.ts`'s
`PersistedOnboardingDocumentMetadata`: a private Supabase Storage
bucket (`customer-onboarding-documents`,
`supabase/migrations/20260914110000_customer_onboarding_documents.sql`),
an opaque `{requestId}/{category}/{documentType}/{documentId}.
{extension}` path (never a customer name/GST/PAN/TAN in the path
itself, `domain/document-paths.ts`, pure, unit-tested), and
`customer_onboarding_documents` holding only metadata, never file
bytes. No RLS policy is granted to anon/authenticated on this bucket;
every read/write goes through a Server Action using the service_role
client, the same trust boundary this whole project already relies on.

Re-uploading the same document type on the same request (a real
scenario after Send Back) never deletes or overwrites prior evidence:
the old row's `is_current` flips to false and a new row is inserted,
enforced by a protection trigger that permits ONLY that one column to
ever change after insert, mirroring `customers`' own
`fn_protect_customer_lifecycle` pattern. A document survives
permanently even once superseded.

`AttachmentUpload` (shared by all eight attachment slots across three
Onboarding stages) previews the local file instantly, exactly as
before, and now also uploads it in the background via
`uploadOnboardingDocumentAction`, showing "Saving..." then "Saved"
inline. The Onboarding review screen (§14) gained a real Evidence
section (`OnboardingEvidenceList`): a reviewer can View or Download
every current document, each via a signed URL generated on demand
(5-minute expiry, never a long-lived or public link).

Known gap, stated honestly: this closes Onboarding's own evidence gap
only. The broader cross-cutting "Customer Documents" surface (task
Phase D's full vision: Registration/Tax/Commercial/Agreement/Change
Request Evidence all in one place on the Customer workspace) is not
built in this round.

## 16. Customer Deactivation lifecycle: IMPLEMENTED

Found and fixed a real audit gap while auditing this phase: Deactivate
was a plain PostgREST `.update()` call
(`src/features/customers/data/customers.data.ts`'s own `setCustomerActive`),
which never called `set_config('app.current_user_id', ...)` first, so
`fn_audit_row`'s trigger (which reads that session setting, not the
row's own `updated_by` column) recorded every deactivate/reactivate
with a NULL actor in `audit_log`, even though `updated_by` itself was
correct. The Customer Activity timeline's own status-change events
(§10) read `audit_log.actor_user_id` directly, so this was a real,
silently-blank "who did this" every time, not a hypothetical one.

`set_customer_active`
(`supabase/migrations/20260914120000_customer_status_lifecycle.sql`)
replaces it: a real governed RPC requiring a non-empty reason, which it
persists into that same `audit_log` row's `actor_context` (now also
surfaced in the Activity timeline's summary text). Deactivate and
Reactivate are gated on `customer.approve` (not the narrower
`customer.delete_permanent` this previously, incorrectly, reused,
which stays reserved for irreversible deletion) and available as a
standalone "More Actions" entry (`CustomerStatusPanel`), independent of
Permanent Delete's own "Deactivate Instead" fallback (which now also
requires a reason). An inactive customer remains fully searchable
(Customer Search, §7) and stays intact; creating a new Customer Change
Request against one is blocked with a clear message directing the user
to reactivate first.

Known gap, stated honestly: only Customer Change Request creation is
blocked for an inactive customer in this round; creating a new
Commercial Configuration Version against an inactive customer is not
yet blocked.

## 17. Audit hardening: VERIFIED (task Phase P)

Swept every `data/*.ts` repository for a plain PostgREST `.update()`/
`.insert()` bypassing an RPC, the exact shape that caused §16's real
bug. Result: `src/features/reference-data/data/reference-master.data.ts`
already documents this precise pitfall in its own header and every
Settings write already goes through a real RPC
(`add_reference_option`/`set_reference_option_active`/etc., each
setting `app.current_user_id` before mutating, confirmed against
`supabase/migrations/20260912150000_auth_authorization_foundation.sql`);
Onboarding, Customer Change, Commercial Version, and Permanent Delete
were all already governed RPCs from their own original implementation.
§16's `setCustomerActive` was the one real instance of this bug in the
entire codebase, now fixed. No other instance found.

## 18. Customer Onboarding Operating Flow (My Requests, Send Back comments, Timeline, My Work): IMPLEMENTED

A manual-testing usability closure pass, distinct from §1-17's backend
lifecycle: the backend already existed, but a requester had no
discoverable way to find their own Draft/Sent Back/Submitted requests
in the UI, and My Work was a disconnected fixture. This section is the
authoritative record of what changed and the scenario matrix that
backs it.

### 18.1 Where things live now

- **Customer Onboarding landing** (`/forms/customer-onboarding`,
  `src/app/forms/customer-onboarding/page.tsx`): a real landing page,
  never an auto-create. "+ New Customer Onboarding" links to
  `/forms/customer-onboarding/new` (`src/app/forms/customer-onboarding/new/page.tsx`),
  the one and only route that creates a case. Below it, **My Requests**:
  every request `created_by` the signed-in user
  (`listMyOnboardingRequests`, `src/features/customer-onboarding/services/case.service.ts`),
  server-scoped off the session's `appUserId`, never a client-supplied
  id, never anyone else's requests.
- **Sent Back discoverability**: a Sent Back case shows in My Requests
  (status badge, "Review & Resubmit" action) and in My Work ("Sent Back
  to Me" section), never only reachable by a known URL.
- **Approvals** (`/approvals`) is unchanged: the workflow-focused list
  of everything currently awaiting a decision, across all three
  lifecycles.
- **My Work** (`/my-work`, `src/features/my-work/`) is now a real,
  server-scoped read model
  (`src/platform/approvals/domain/my-work.ts`'s `buildMyWorkItems`),
  built by re-scoping the same Approvals inbox items the existing
  `loadApprovalInbox` already composes, never a second read of the
  underlying tables and never a duplicated business record. "Sent Back
  to Me" is scoped to the current user's own `createdBy`; "Pending My
  Approval" is every `needs_action` item once the user holds
  `customer.approve` at all, since Customer Lifecycle V1 has no
  per-person approval routing yet (§6).

### 18.2 Status model

Backend statuses (`CustomerOnboardingCaseStatus`): `draft`,
`submitted`, `sent_back`, `resubmitted`, `approved`. There is no
`rejected`/`cancelled` for Onboarding in this version (unlike Customer
Change Request, §3a); Send Back is the only reviewer decision besides
Approve. The one canonical label map is `labelForCaseStatus`
(`src/platform/approvals/domain/inbox.ts`), shared by My Requests, My
Work, Approvals, and the onboarding review page. A derived, non-stored
"Review State" (`reviewState()` in
`src/features/customer-onboarding/ui/my-requests-table.tsx`) shows a
friendlier phrase ("Working on Tax & Registration", "Pending Approval",
"Needs Your Attention", "Completed") next to the raw status badge.

### 18.3 Send Back count, field comments, and Timeline

Two new append-only tables
(`supabase/migrations/20260914130000_customer_onboarding_send_back_history.sql`),
matching `customer_field_history`'s own precedent:

- `customer_onboarding_send_backs`: one permanent row per send-back
  (`revision_number`, `reason`, `sent_back_by`, `sent_back_at`). The
  Send Back count shown to a requester is `count(*)` over this table,
  never a manually incremented UI counter.
- `customer_onboarding_field_comments`: one permanent row per
  reviewer field comment (`revision_number`, `field_key`, `comment`,
  `reviewer_id`, `resolved`), keyed by the field's stable key (never its
  display label). Comments are never overwritten; a resubmit opens a
  new revision but every prior revision's comments stay visible.

`send_back_customer_onboarding_case` was extended (not replaced) with a
trailing `p_field_comments jsonb default '[]'` parameter, so every
existing caller keeps working unchanged.

The request Timeline (`buildOnboardingTimeline`,
`src/features/customer-onboarding/domain/timeline.ts`) is built purely
from data already persisted: the case's own `created_at`/`created_by`,
every revision's `submitted_at`/`submitted_by`, the send-back history,
and `approved_at`/`approved_by`. Rendered oldest-first via
`OnboardingTimeline` (`src/features/customer-onboarding/ui/onboarding-timeline.tsx`)
on both the requester's request view and the reviewer's Review screen.
Never raw `audit_log` JSON.

### 18.4 Requester Form Feedback

Reopening a Sent Back request highlights each commented field: the
requester's page sets `question.description` to `Needs review: <comment>`
for every field with a comment against the revision that was just
reviewed (`src/features/customer-onboarding/ui/customer-onboarding-page.tsx`),
and the overall Sent Back banner shows the reviewer's overall reason
plus a count of fields needing review. The reviewer picks a field from
a fixed, labeled list (`COMMENTABLE_ONBOARDING_FIELD_KEYS`,
`src/features/customer-onboarding/domain/field-labels.ts`) when sending
a case back (`src/features/customer-onboarding/ui/review-detail-page.tsx`).

### 18.5 Display labels

Two real raw-code display bugs were found and fixed (never a scattered
`replace('_',' ')` hack; both now go through the one canonical
`resolveOption(snapshot, listKey, code)` resolver from
`@/features/reference-data`):

- The onboarding review page's own "Customer Details" section
  (`review-detail-page.tsx`) rendered Country/Segment/Business
  Unit/Industry as raw codes (`IN`, `enterprise`, `india_enterprise`,
  `fmcg`); now resolved.
- The Customer Activity timeline's field-change events
  (`src/features/customers/domain/activity.ts`) rendered a governed
  field's old/new value as the raw stored code; now resolved, with a
  `ReferenceMasterSnapshot` threaded through `buildCustomerActivityTimeline`.

The Customers list/detail pages and the Customer Change diff view
already used `resolveOption` correctly before this pass (verified, not
re-touched). Customer Master's State/City fields are demo/fixture-only
(no real persisted column yet, `domain/demo-enrichment.ts`), so no
geography reverse-label resolver was built for them; building one now
would be speculative ahead of the real schema.

The `__all__` filter sentinel (`customer-filter-bar.tsx`) was audited
across Customers, Approvals, My Work, and Settings: every sentinel
value already pairs with an explicit human-readable label ("All
segments", "All statuses", ...); no leak found.

### 18.6 Scenario matrix

| # | Scenario | Backend state | Requester sees it | Approver sees it | Primary action | Editable? | Revision behavior | Timeline event | My Work |
|---|---|---|---|---|---|---|---|---|---|
| 1 | New request created | `draft`, revision 1 | My Requests (Continue) | Not visible (draft excluded from Approvals) | Continue | Yes | Revision 1 open | "Request created" | Not shown |
| 2 | Draft partially filled, Save Draft clicked | `draft`, revision 1 | My Requests, "Working on {stage}" | Not visible | Continue | Yes | Revision 1 updated in place | (none, Save Draft is not a timeline event) | Not shown |
| 3 | Page refreshed after Save Draft | `draft`, revision 1 | Same values restored on reopen | Not visible | Continue | Yes | Revision 1 unchanged | (none) | Not shown |
| 4 | Submit blocked: required field missing | `draft`, revision 1 | Inline validation error, stays on form | Not visible | Continue | Yes | No transition | (none) | Not shown |
| 5 | Submit blocked: duplicate GST matches an approved case | `draft`, revision 1 | Hard duplicate warning, submit blocked | Not visible | Continue | Yes | No transition | (none) | Not shown |
| 6 | Submit allowed: duplicate legal name only (soft match) | `draft` -> `submitted` | Warning shown, acknowledgeable, submit proceeds | Now visible | View | No | Revision 1 submitted | "Submitted for review" | Not shown (needs_action requires approve permission) |
| 7 | First submission | `submitted`, revision 1 | My Requests: Submitted, View | Approvals + My Work "Pending My Approval" | View (requester) / Review (approver) | No | Revision 1 frozen | "Submitted for review" | Pending My Approval |
| 8 | Approver opens Review screen | `submitted` | (unchanged) | Full Customer Details/Commercial Rate/Evidence/Timeline | Approve or Send Back | No | (unchanged) | (unchanged) | (unchanged) |
| 9 | Send Back with overall comment only | `sent_back`, revision 2 opened | My Requests: Sent Back, banner with reason | Removed from needs_action | Review & Resubmit | Yes (revision 2) | Revision 1 stays frozen; revision 2 draft opened | "Sent back: {reason}" | Sent Back to Me |
| 10 | Send Back with overall + 2 field comments | `sent_back`, revision 2 opened | Sent Back banner + 2 fields flagged "Needs review" inline | Removed from needs_action | Review & Resubmit | Yes | Same as #9 | "Sent back: {reason}" | Sent Back to Me |
| 11 | Requester reopens Sent Back request | `sent_back` | Field comments shown next to their fields, overall reason at top | (unchanged) | Review & Resubmit | Yes | (unchanged) | (unchanged) | (unchanged) |
| 12 | Requester corrects fields and resubmits | `sent_back` -> `resubmitted`, revision 2 submitted | My Requests: Resubmitted, View, Revision 2 | Back in Approvals + My Work | View / Review | No | Revision 2 frozen | "Resubmitted for review (Revision 2)" | Pending My Approval |
| 13 | Second Send Back | `sent_back`, revision 3 opened, Send Back count = 2 | Sent Back, count column shows 2 | Removed from needs_action | Review & Resubmit | Yes | Revision 3 draft opened | "Sent back: {reason}" (2nd row) | Sent Back to Me |
| 14 | Second resubmit | `resubmitted`, revision 3 submitted | Revision 3, View | Back in Approvals | View / Review | No | Revision 3 frozen | "Resubmitted for review (Revision 3)" | Pending My Approval |
| 15 | Approve | `approved` | My Requests: Approved, "Open Customer" | Removed from Approvals + My Work | Open Customer | No | Revision 3 remains the historical current revision | "Approved" | Removed entirely |
| 16 | Customer Master created on approval | `approved`, `customer_id` set | Open Customer link resolves | Commercial Configuration + Version 1 created | Open Customer / Open Commercials | No | (unchanged) | (unchanged) | (unchanged) |
| 17 | Approve clicked twice (idempotency) | `approved` (unchanged) | (unchanged) | (unchanged) | (no-op) | No | No second Customer Master created | (unchanged) | (unchanged) |
| 18 | Every prior revision stays viewable | `approved` (or any status) | Revision 1/2/3 data each still readable via `submission_revisions` | (same) | View | No | All revisions immutable once submitted | Full created->submitted->sent back->resubmitted->... sequence readable | (unchanged) |
| 19 | Another user's draft | `draft` (someone else's) | Never appears in this user's My Requests | N/A | N/A | N/A | N/A | N/A | N/A |
| 20 | User with only `customer.create` | any | My Requests works normally | Approvals/Review screens deny (no `customer.approve`) | Continue/View only | Per status | N/A | N/A | Sent Back to Me only, never Pending My Approval |
| 21 | User with only `customer.approve` | any | Cannot create a request (denied at `/forms/customer-onboarding/new`) | Full Approvals + My Work access | Review | N/A | N/A | N/A | Pending My Approval only |
| 22 | No requests at all | N/A | My Requests empty state, "Create Customer Onboarding" button | N/A | N/A | N/A | N/A | N/A | Empty state |
| 23 | Nothing needs the user's attention | N/A | (unchanged) | N/A | N/A | N/A | N/A | N/A | "Nothing needs your attention right now" |
| 24 | Visiting `/forms/customer-onboarding` twice in a row | `draft` (unchanged) | Same request, never a second one created | N/A | Continue | Yes | Unchanged | Unchanged | Unchanged |
| 25 | Final submit blocked without Commercial Rate complete | `draft` or `sent_back` | Submit blocked, stays editable | N/A (never reaches Approvals) | Continue | Yes | No transition | (none) | Not shown |


## 19. Timeline parity across all three governed lifecycles: IMPLEMENTED (Platform Scale Program, Phase I)

§18 built a real Timeline, Send Back history, and field comments for
Onboarding only. A CFO-lens review of the other two lifecycles found a
real six-months-later explainability gap: Customer Change and Commercial
Version had no Timeline at all, and Customer Change's Send Back
information was overwritten on every send-back (`sent_back_reason`/
`sent_back_by`/`sent_back_at` columns, latest-only), the exact gap
Onboarding had before §18 fixed it.

**Customer Change** (mirrors Onboarding's shape closely, since it has
the same send-back/resubmit cycle): a new append-only
`customer_change_send_backs` table
(`supabase/migrations/20260914160000_customer_change_send_back_history.sql`)
backs both the Send Back count and the Timeline
(`src/features/customer-change/domain/timeline.ts`,
`server/timeline.ts`). Unlike the earlier Onboarding fix, this migration
extended `send_back_customer_change_request` with the exact same
parameter list (no new parameter added), so `create or replace function`
safely replaced it in place with zero overload risk, the precise
lesson learned from the bug §18 had to correct for.

**Commercial Version** (does not mirror Onboarding, because it is
architecturally different): a Commercial Version has no send-back state
at all, only a terminal Reject (status: draft/submitted/approved/
rejected, no "resubmitted"), and only ever one revision. No new table
was needed; its Timeline
(`src/features/customer-onboarding/domain/commercial-version-timeline.ts`)
is a pure read-model composition over the version's own row plus its
one `submission_revisions` row.

**Shared rendering, feature-specific event building.** The actual
Timeline UI (`src/components/product/request-timeline.tsx`,
`RequestTimeline`/`RequestTimelineEvent`) is promoted to a genuinely
shared `components/product` primitive (`docs/UI_SYSTEM.md` §19's
`WorkflowTimeline`), since the event shape
(`id`/`occurredAt`/`actorEmail`/`summary`) was already fully
domain-agnostic; only where it lived was Onboarding-specific. Building
the event list itself stays in each feature's own `domain/timeline.ts`:
what counts as an event genuinely differs per lifecycle (Onboarding has
field comments and multiple revisions; Customer Change has requirements
but no field comments; Commercial Version has neither), so this was not
generalized into one shared engine, matching the Chief-Architect-lens
conclusion that a universal workflow engine is not yet justified
(`docs/WORKFLOW_ENGINE_ARCHITECTURE.md` remains design-draft, correctly).

## 20. UX operating system consistency across the three review screens: PARTIAL (Platform Scale Closure, Phase J)

A cross-screen UX audit (Onboarding/Customer Change/Commercial Version
review pages) found real inconsistencies and one false one, corrected
here rather than silently repeated.

**Evaluated and rejected: a Send Back path for Commercial Version.**
§19 already established this correctly: a Commercial Version has no
send-back state and only ever one revision, by design, not by omission.
Re-evaluated this round with the explicit question "can the current
lifecycle support Send Back consistently." It cannot without a real
schema/lifecycle change: Send Back only means something where a
revision can be edited and resubmitted (`submission_revisions`,
`status: sent_back`), and Commercial Version's RPC layer
(`submit_commercial_configuration_version`) only accepts a submission
from `status = 'draft'`, never `'sent_back'` or `'rejected'`, with no
equivalent to `create_next_revision`. Building Send Back would mean
adding a real revision-resubmit cycle to a lifecycle deliberately kept
simpler (draft, submitted, approved, rejected, one revision), for a
capability no one has asked for. Reject remains the sole terminal
decision, correctly distinct, not a stand-in for a missing Send Back.

**Corrected, not fixed: the "`isDecidable` omits `resubmitted`" claim.**
An earlier audit pass flagged `commercial-version-review-page.tsx`'s
`isDecidable` check (`canDecide && version.status === "submitted"`) as
missing a `resubmitted` case, by analogy with the other two review
pages. This was a false positive: `CommercialVersionStatus` is `"draft"
| "submitted" | "approved" | "rejected"` (`commercial-version-types.ts`),
exactly as §19 already documented. There is no `resubmitted` status to
omit; the check was already correct. Recorded here so this claim is not
repeated in a future pass.

**Fixed: no page named who currently needs to act.** All three review
headers now show a `currentResponsibilityLabel` badge
(`platform/approvals/domain/inbox.ts`) alongside the status badge:
"Waiting on Requester" (draft/sent back), "Needs Your Attention" (a
reviewer viewing a decidable request), "Pending Finance Approval"
(anyone else viewing the same request), or the terminal status label
once decided. Role-based, never a fabricated named owner, since Nexus's
approval model has no per-person routing.

**Fixed: the Commercial Version review title never named the customer.**
It read the generic "Commercial Configuration Version Review" for every
version of every customer; now shows the customer name, matching the
other two review screens.

**Fixed: three post-decision redirects pointed at the `/reviews/*` list
routes** (Onboarding send-back, Customer Change send-back/reject,
Commercial Version reject), which have no inbound link from anywhere
else in the product (`docs/TECH_DEBT.md`) and are removed this round
(§X). All three now redirect to `/approvals`.

**Evaluated and not duplicated: a dedicated post-approval "Success
State" for Customer Change and Commercial Version.** Onboarding needed
one because approval creates three new entities at once (Customer,
Commercial Configuration, Version 1) with no single natural page that
shows all three, so it needs explicit links. Approving a Customer
Change or a Commercial Version has exactly one natural destination
(the customer page, the commercial configuration page), which the
existing `router.push` already lands on immediately, itself showing
the change now applied. Building a redundant intermediate success
screen for these two would not answer "what changed/what's current"
any more clearly than the destination they already redirect to.

## 21. My Work maturity: two new sections added, two evaluated and deferred (Platform Scale Closure, Phase K)

§18 built My Work's original two sections (Sent Back to Me, Pending My
Approval), both re-scoped from the same Approvals inbox fetch, never a
duplicated read. This round evaluated the remaining candidates from
`docs/UI_SYSTEM.md`'s own permanent UX rule ("a user never has to
remember where Nexus moved their work") against real, reliably
derivable data, not fabricated ones:

- **Added: "Drafts to Continue"**, for Customer Change and Commercial
  Version only. Both had a real, previously undocumented gap: a draft
  has no other home anywhere in the product (unlike Onboarding, whose
  own My Requests page already lists a requester's drafts, so it is
  deliberately not duplicated here). Built from the same
  `listAllChangeRequestEntries`/`listAllVersionEntries` reads the
  Approvals inbox already makes, filtered to `status = 'draft'` and
  `created_by = ` the current user (`platform/approvals/server.ts`'s
  `loadMyDraftsToContinue`). This does mean My Work now makes two more
  read calls than strictly necessary on that one page (Approvals inbox's
  own contract deliberately excludes drafts, so they cannot be reused
  from its result); accepted rather than widening
  `ApprovalInboxBucket`'s type, and its documented "a draft never
  appears here" invariant, just to save two queries on a personal,
  low-traffic page.
- **Added: "Waiting on Others"**, the flip side of "Sent Back to Me":
  an item the current user created that is awaiting a decision they
  cannot make themselves. Reliably derivable from data already in hand
  (`bucket === "needs_action" && createdBy === appUserId`, checked only
  after "Pending My Approval" so a request its own creator can also
  approve shows as actionable, not merely as waiting).
- **Evaluated and deferred: "Recently Completed."** Technically
  derivable (`bucket === "completed" && createdBy === appUserId`), but
  judged not to earn its place yet: every approve/reject action already
  redirects the requester straight to the record showing the outcome
  (§20), and the Approvals inbox's own "Completed" tab already covers
  this same view for anyone who wants to look it up. Adding a third
  place to see the same information would be noise, not a real gap;
  revisit only if a real user asks where their old requests went.

## 22. Operational queue: IMPLEMENTED (Platform Scale Closure, Phase L)

A plain operational read model at `/operations/queue`, not a dashboard:
no charts, no aggregation beyond a sortable list. Answers what a manager
actually asks when checking on pending work: type, customer, status,
which role currently needs to act, how old, and how many times sent
back, across all three governed lifecycles at once.

Built from the same `loadApprovalInbox` fetch the Approvals inbox
already makes (no new base query), excluding `completed` items (a
"what is currently stuck" view, not a history report). Adds send-back
counts via two batched queries, one per lifecycle that has a send-back
concept at all: Onboarding (`customer_onboarding_send_backs`) and
Customer Change (`customer_change_send_backs`, a new batched sibling to
the existing per-request `getChangeRequestSendBackCount`). Commercial
Version has none (§19), so it always reads 0, never a fabricated count.

"Which role currently needs to act" reuses `currentResponsibilityLabel`
(`platform/approvals/domain/inbox.ts`, built for Phase J's review
headers), called with `canDecide: false` unconditionally: this is a
cross-request operational view, not "what can the current viewer
personally do," so every submitted/resubmitted request reads "Pending
Finance Approval" regardless of who is looking at the queue. Never
resolves to a named individual: Nexus's approval model has no
per-person routing to fabricate one from.

Gated by the same `customer.read` permission Approvals uses. No
dedicated manager role exists yet (`docs/AUTHORIZATION_MODEL.md` §5's
scoped-RBAC extension point remains unpopulated, correctly); this read
model is designed so a future SLA threshold or dashboard can consume it
directly once that need is real, without redesigning the underlying
data shape.

## 23. Document platform: browser-independent input contract (Platform Scale Closure, Phase R)

§15's core mechanics (MIME/size validation, storage path generation)
were already genuinely browser-agnostic: `validateAttachmentFile` takes
a duck-typed `{name, type, size}`, and `document-paths.ts`'s
`buildStoragePath` takes only strings. The one real gap was narrower
than it looked: `documents.service.ts` and `documents.data.ts`'s top
signatures still typed their upload parameter as a live browser `File`.

Both now take `DocumentUploadInput` (`{name, mimeType, size, bytes:
Blob}`), a plain, browser-independent contract. `File extends Blob` in
the DOM lib, so the one existing caller
(`uploadOnboardingDocumentAction` in `actions.ts`) is the single
adapter boundary: it is the only place a browser `File` is ever
constructed into this shape, and does so with no conversion beyond
reading three already-public fields. A future API upload endpoint or
import job can construct the same shape from a Node `Buffer` wrapped in
a `Blob`, with no browser runtime involved and no change to the service
or data layer.

Centralized already, unaffected by this change: validation, path
generation, storage, metadata, and authorization (a Server Action
behind `requirePermission`, matching every other governed mutation).
Not built, and not needed for this: a streaming upload path (files are
small, evidence documents capped by `validateAttachmentFile`'s own size
limit).

## 24. Onboarding attachment continuity: IMPLEMENTED (Platform Operating Expansion, Phase A)

Real reported defect: reopening a Sent Back onboarding request showed
every attachment slot empty, even though the requester had already
uploaded evidence. Root cause was narrower than it looked: the
persistence layer (`customer_onboarding_documents`, request-scoped,
`is_current`-flagged, append-only) and the reviewer-facing
`/reviews/[requestId]` route were already correct; the requester-facing
edit route (`/forms/customer-onboarding/[requestId]`) simply never
fetched existing documents at all, so `AttachmentUpload`'s local state
always started empty regardless of what was persisted.

Fixed by adding a real "already persisted" state to `AttachmentUpload`
(`PersistedAttachmentValue`, distinct from `SelectedAttachmentFile`,
which wraps a live browser `File` a persisted document never has):
`listOnboardingDocumentsForEditor` (a new service function, resolving
uploader display labels via the same `resolveActorEmails` every other
actor display uses) seeds each slot's initial state on reopen. Viewing
a persisted attachment fetches a signed URL on demand, the same
mechanism the reviewer's Evidence list already used; a persisted
attachment has no Remove action (documents are append-only, only
Replace is a real operation), matching the existing architecture rather
than inventing an "un-upload."

**Historical revision evidence, reconstructible without byte
duplication.** `customer_onboarding_documents` has no revision number
(by design: a re-upload supersedes, it does not duplicate), so nothing
previously recorded which specific document backed a given historical
revision's submission once a later revision replaced one attachment.
New table `customer_onboarding_revision_documents` is a thin, append-
only snapshot (one row per request/revision/document type, referencing
the existing document row, never copying bytes or metadata), populated
by `submit_customer_onboarding_case` at the moment of each submission
(same exact RPC signature, no overload risk). `listOnboardingDocumentsForRevision`
reconstructs a specific revision's exact evidence set from this
snapshot, independent of what is currently `is_current`.

**Scope boundary, honestly recorded**: the snapshot's data and service
layer are real and tested; a dedicated "browse an older revision's
evidence" UI is not built, since no lifecycle in this app has a
historical-revision browser today and the review screen already shows
the current revision's evidence correctly (the only case the snapshot
diverges from "current" is an already-decided, older revision whose
attachment was later replaced during a subsequent send-back cycle, a
genuine but rare need). Revisit if a real reviewer asks to see it.

## 25. Onboarding page scroll: VERIFIED, defensive floor added (Platform Operating Expansion, Phase B)

Investigated the reported nested-scroll defect directly: no first-party
Nexus code (the onboarding page, its stage components, or the app
shell) sets a fixed height or `overflow-y-auto` anywhere in the
onboarding stack today, so the page already scrolls naturally by
default. The only vertical-scroll regions found are SurveyJS's own
internal popup lists (`.sv-list`/`.sd-selectlist`/`.sd-menu-list`, a
dropdown's own option list) and a horizontal, non-nested
`overflow-x-auto` on the mobile stage tab strip, both legitimate,
neither a page-body-inside-a-card double scroll.

Added a defensive CSS floor in `src/platform/forms/survey-responsive.css`
forcing `.sd-root-modern`/`.sd-body`/`.sd-page` to `overflow: visible`
regardless of what a future SurveyJS version or theme update might
introduce, without touching the genuinely-scrollable dropdown/popup
regions. Recorded honestly: this closes the risk defensively; it did
not find an active bug to reproduce in the current codebase state.

## 26. Attachment language and metadata: IMPLEMENTED (Platform Operating Expansion, Phase E)

Every onboarding document type now resolves to one specific,
business-purpose label through a single registry,
`ONBOARDING_DOCUMENT_LABELS` in
`src/features/customer-onboarding/domain/document-labels.ts`
(`labelForOnboardingDocumentType` for lookup with a safe fallback), so
the requester-facing upload form, the reviewer-facing attachments list,
and any future consumer all read the same purpose text instead of each
inventing or duplicating it. The three Commercial Documents entries are
reused directly from `COMMERCIAL_DOCUMENT_DEFINITIONS` rather than
copied, so there is exactly one source of truth per document type.

The reviewer screen (`src/app/reviews/[requestId]/page.tsx` and
`review-detail-page.tsx`) renamed its "Evidence" heading to
"Attachments" and now fetches documents through
`listOnboardingDocumentsWithUploader` (previously named
`listOnboardingDocumentsForEditor`, generalized since both the
requester editor and the reviewer screen need the same uploader-label
resolution), giving it the same `PersistedOnboardingDocumentView` shape
the editor already used. The renamed `OnboardingAttachmentsList`
component (replacing `OnboardingEvidenceList`) leads each row with its
business-purpose label plus the original file name (for example "GST
Registration Document / gst-certificate.pdf") instead of the old
generic category subtitle ("Tax & Registration"/"Commercial
Documents"), and shows "Uploaded by {name}, {timestamp}" underneath,
resolved server-side the same way every other actor display in the app
resolves an uploader identity.

## 27. Draft cancel/discard: IMPLEMENTED (Platform Operating Expansion, Phase C/G)

Customer Onboarding, Customer Change Request, and Commercial
Configuration Version each gained a governed `cancelled` terminal
status, added by `supabase/migrations/20260916010000_draft_cancel_discard.sql`
alongside `cancelled_by`/`cancelled_at`/`cancelled_reason` columns on
all three tables, following the exact shape `sent_back_by`/`sent_back_at`/
`sent_back_reason` already established. A draft moves to `cancelled`
through one new RPC per domain (`cancel_customer_onboarding_case`,
`cancel_customer_change_request`, `cancel_commercial_configuration_version`),
never a physical delete, so a cancelled item remains historically
visible and reconstructible, matching every other governed lifecycle's
audit posture in this codebase.

Deliberately scoped to status `draft` only, in all three domains: a
case/request/version that has ever been submitted has real
reviewer-facing history (comments, a submitted revision, a live
approval queue entry in Commercial Version's case), so withdrawing
something already in flight is a materially bigger decision, left to
the system-wide cancel/withdraw audit (task Phase V). Each RPC also
verifies the caller is the record's own creator, server-side, before
allowing the transition, not only in the calling Server Action: "only
creator/authorized user may cancel" (task spec) holds even if a future
caller reaches the RPC directly.

A cancelled item is automatically excluded from the unified Approvals
inbox and My Work (`bucketForStatus` in
`src/platform/approvals/domain/inbox.ts` already returned `null` for
any status it does not explicitly recognize, so no code change was
needed there) but remains visible in the requester's own My Requests
list, labeled "Cancelled", sorted last, matching "historically visible,
not shown in default My Work" from the task spec exactly.

UI: each editor (`customer-onboarding-page.tsx`'s stage footer,
`change-request-page.tsx`, `commercial-version-page.tsx`) gained a
"Cancel Draft" control, visible only while status is exactly `draft`,
which reveals an inline optional-reason confirm panel before calling
the new Server Action (matching the existing Send Back inline-reveal
pattern already used on the review screens, rather than introducing a
new modal/dialog primitive). The onboarding editor shows a dedicated
"This onboarding request was cancelled" screen when reopened after
cancellation; Customer Change and Commercial Version reuse their
existing generic "already been {status} and can no longer be edited"
locked message, since it already reads correctly for `cancelled`
without a special case.

## 28. Stage-local validation: IMPLEMENTED (Platform Operating Expansion, Phase D)

Save Draft remains fully permissive (no change). Next
(`customer-onboarding-page.tsx`'s `handleNext`) now calls
`survey.validateCurrentPage()` before advancing, surfacing the CURRENT
survey stage's own inline field errors on the way out, without ever
blocking the move to the next stage: a requester who skips past a
malformed value sees it flagged rather than losing track of it
silently, exactly matching "Next doesn't necessarily block incomplete
stage but shows current-stage invalid values" from the task spec.

Submit (`handleSubmit`) is now genuinely strict across every stage that
has a real mandatory requirement: Customer Details, Tax & Registration
(including its documents), and Commercial Rate. This closes a real gap:
previously, an onboarding case could be submitted with no Commercial
Rate ever recorded, since nothing gated Submit on that stage's
completeness (`stageStatuses.commercial_rate`, already computed for the
Process Journey indicator, is now also the Submit gate). A single
`survey.validate(true, true)` call marks every invalid field across
BOTH survey pages at once (not only the current one) and focuses/
scrolls to the first invalid field, switching the current page to it if
needed; `onCurrentPageChanged` (already wired for the stage-tab sync)
keeps `activeStageKey` in lockstep with that switch. The error banner
now names every incomplete stage explicitly ("2 stages need attention
before you can submit: Tax & Registration, Commercial Rate.") instead
of the previous ad hoc single-line document-only message, which stayed
silent whenever only a survey field, not a document, was missing.

Agreement & Approval is deliberately excluded from this Submit gate:
its own `evaluateAgreementApprovalStatus` can never reach "complete" in
this build (no authenticated Legal Approval identity exists yet, see
`customer-onboarding-page.tsx`'s `legalApprovalComplete` constant), so
gating Submit on it would make submission permanently impossible. This
is the same documented, permanent design limitation `evaluateAgreementApprovalStatus`
itself already records; Phase D does not change it.

**Scope boundary, honestly recorded**: this feature has no component-
level UI tests for `customer-onboarding-page.tsx` today (only its
domain/service/data layers are unit tested), so this change is verified
by `tsc`/`eslint`/full `vitest`/production build passing clean, not by
a new render-level test, consistent with the rest of this feature's
existing test coverage boundary.

## 29. Full Customer Master governed field registry: IMPLEMENTED (Platform Operating Expansion, Phase H)

`customers` gained 19 new real columns
(`supabase/migrations/20260916020000_customer_master_governed_fields.sql`):
address/state/city/postal_code/website, the five primary-contact fields,
GST/PAN/TAN, tax_identifier_type/name, tax_registration_number,
company_document_type(_other), and billing_currency. Every one of these
was already collected by the Customer Onboarding form but silently
dropped on the floor at approval time, a real gap this closes:
`approve_customer_onboarding_case` now populates them (plus `brand_name`,
which the original approval RPC had also never written despite that
column existing since Platform Scale Closure), and
`approve_customer_change_request`'s governed-field loop grew from six
fields to all twenty-five, so any of them can now be proposed through a
governed Customer Change Request exactly like Segment or Country already
could.

**One authoritative registry**, `src/features/customers/domain/governed-field-registry.ts`
(exported client-safely through `src/features/customers/index.ts`, since
`server.ts` carries a `server-only` guard the Customer Change UI's client
components cannot import through): every field's key/label/editor
(plain text vs a Reference Master select, with the exact `ReferenceListKey`
to resolve against) lives here once. `src/features/customer-change/domain/governed-fields.ts`
now re-exports this registry instead of maintaining its own six-field
copy; `GovernedFieldsForm`, `FieldDiffTable`, and `diff.ts` all read the
registry generically (no field-specific branches to update per new
field), and `getCurrentGovernedValues` (change-request.service.ts)
already read `customer[key]` generically per `GOVERNED_FIELD_KEYS`, so
it picked up every new field with no code change of its own. This is a
new, intentional cross-feature import (`customer-change` -> `customers`),
matching the same established pattern `customer-change` and
`customer-onboarding` already use for `getCustomerById`/`listCustomerMaster`
(`src/features/customers/server.ts`); `customers` is where the governed
schema this registry describes actually lives, so it is the correct
owner, not a duplicate list re-declared per consumer.

The onboarding-form-field-key -> `customers`-column-key translation
(mostly 1:1, except `pincode` -> `postal_code`, and Billing Currency
reading from the Commercial Rate draft rather than the form's own
vestigial, never-rendered `billing_currency` field key) lives in a new,
separately-tested pure mapper,
`src/features/customer-onboarding/domain/onboarding-customer-field-mapping.ts`:
this is deliberately NOT part of the shared registry, since it is
onboarding's own promotion concern (how a NEW customer gets its initial
values), not a fact about what Customer Master's governed fields are.

`src/features/customers/domain/display-fields.ts` gained resolvers for
every new field (`resolveState`, `resolveGstNumber`, etc.), all following
the existing "a real value on `record` always wins over demo enrichment"
rule; the Customer Master detail screen's Business Classification, new
Primary Contact section, and Tax & Registration tabs now read real
values first. `demo-enrichment.ts`'s header is corrected: every field it
illustrates is now a real governed column, so it survives only as a
fallback for the one legacy fixture customer that predates this
migration, not as a description of a permanent schema gap.

**Scope boundary, honestly recorded**: `company_document_type` has no
Reference Master list backing it (the onboarding form uses a small,
locally-hardcoded choice set, not a governed one), so `GovernedFieldsForm`
renders it as free text for now rather than a select; this matches the
registry's own `editor: { kind: "text" }` for that field, not a bug.

## 30. Unified Change Customer experience: IMPLEMENTED (Platform Operating Expansion, Phase I)

The Customer detail screen's "Create Change Request" button is now
"Change Customer" (`/customers/[customerKey]/change/new`), a picker
presenting Customer Details / Commercials / Both, gated by whichever of
`customer.change_request`/`commercial_configuration.write` the viewer
actually holds. Backend truth stays exactly as governed and separated as
before: Customer Details still creates one Customer Change Request,
Commercials still creates one Commercial Configuration Version draft;
this task only unifies the DISCOVERY of two previously disconnected
entry points, never the records themselves. A real, pre-existing gap
this closes in passing: `/commercials/[configId]/versions/new` (the
"Create New Version" route) has existed since Commercial Version's own
build but had no link pointing to it anywhere in the app; it is now
reachable.

"Both" (`/customers/[customerKey]/change/new/both`) creates one Customer
Change Request and one Commercial Configuration Version together and
lands on a page showing both as a coordinated pair, each with its own
"Continue" link into its own real screen.

**Scope boundary, honestly recorded, per the task's own framing
("evaluate a lightweight parent Change Initiative if useful")**: no
persisted Change Initiative parent record was built. The two child
records created by "Both" have no database link to each other today;
they are coordinated only by this landing page having created both in
one request. Each keeps its own independent status, review, and
approval, exactly as if a requester had visited the two single-choice
paths back to back, which is what the task explicitly allows ("each
stays a separate governed record"). If a future need emerges to track
"these two changes belong to the same customer initiative" as queryable
state (for example, a combined approval view, or "3 of 5 initiatives
still have an open commercials change"), that is the trigger to add the
parent record; nothing here should be read as having decided against it
permanently.

## 31. Actor Identity permanent rule: PARTIALLY IMPLEMENTED (Platform Operating Expansion, permanent rule)

`app_users` gained its first real profile field, `display_name`
(`supabase/migrations/20260916040000_app_users_display_name.sql`), an
admin-maintained human name (task Phase J, User Access, builds the UI
that sets it). The one canonical actor-display resolver,
`resolveActorLabels` (`src/platform/audit/data/actor-directory.data.ts`),
prefers it, falling back to the Supabase Auth email for a user with no
display_name set yet, exactly matching the rule's own "existing users
without names fall back to email temporarily." Every existing consumer
that previously called `resolveActorEmails` for a human-facing display
(the unified Approvals inbox, all three domains' request Timelines, the
Customer Activity timeline, onboarding document uploader labels) now
calls `resolveActorLabels` instead, so setting one admin gets a real
name showing up everywhere that actor has ever acted, immediately, with
no per-feature change required.

**IMPLEMENTED**: a real display_name concept exists, is admin-settable
(Phase J), and every actor display resolves it consistently through one
function.

**DEFERRED, explicitly, not silently**: the rule's stronger form ("do
NOT rely only on current app_users.name for historical display since it
may change later... use current-name resolution as fallback for old
records only") implies a write-time snapshot
(`actor_display_name_snapshot`/`actor_email_snapshot`/`acted_at`) captured
at the moment of each governed action, so a later name change never
silently rewrites history. That snapshot infrastructure was not built in
this pass: every `*_by` column in this schema (sent_back_by, approved_by,
decided_by, cancelled_by, and so on) still stores only an actor id,
resolved to whatever that user's CURRENT name/email is at read time, on
every domain this session touched. This is a real, acknowledged gap, not
an oversight: adding snapshot columns to every governed action across
Onboarding, Customer Change, and Commercial Version is a schema change of
comparable size to Phase H's own governed-field migration, and doing it
well means designing one snapshot shape reused everywhere, not ad hoc
columns bolted on per table. Trigger to revisit: the first time a
`display_name` is actually changed on a live record with real historical
actions against it, and "who approved this in March" needs to show the
name as it was in March, not today.
