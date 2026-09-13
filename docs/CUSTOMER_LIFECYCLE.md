# Customer Lifecycle

Status: **PARTIALLY IMPLEMENTED.** The Onboarding Case lifecycle, its
atomic approval into a real Customer Master + Commercial Configuration,
and the Customer Change Request lifecycle (including the Customer
workspace tabs and Field History) are implemented and persisted.
Commercial Version 2+ (draft/activate) and Permanent Customer Deletion
are designed below but not yet built; see each section's own status
line.

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
the exact same `mapOnboardingComponentToCommercialComponentInsert`
(`domain/commercial-configuration-promotion.ts`) the interactive
Commercial Rate promotion panel already uses, so a component's stored
shape is identical regardless of which path created it.

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

`create_commercial_change_for_configuration` (used by the pre-existing
interactive Commercial Rate promotion panel) is left fully intact: it
still creates a live, immediately-effective Change with no draft phase,
and remains available. Alongside it,
`supabase/migrations/20260913070000_commercial_configuration_version_lifecycle.sql`
adds a new, governed, parallel path: `commercial_configuration_versions`
extends `requests` 1:1 (the same precedent `customer_onboarding_cases`
and `customer_change_requests` both already established), with the
proposed Commercial Rate draft living in `submission_revisions`, never
duplicated.

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

## 5. Permanent Customer Deletion: not yet built

Designed, not implemented. The intended shape, consistent with
`docs/DATA_ARCHITECTURE.md` §10 (soft deletion is the default; hard
deletion is a deliberate, narrow exception): a `customer.delete_permanent`
permission (seeded, not yet granted broadly, see
`20260913040000_customer_lifecycle_onboarding_foundation.sql`), an
eligibility check inspecting the real M9/M10 tables
(`usage_facts`, `earned_results`, `billing_calculations`,
`reconciliation_adjustments`) for protected history before allowing
physical deletion, and an immutable deletion-audit row with no foreign
key back to the deleted customer (a snapshot of key/name/status/actor/
reason/time only), so the fact of deletion survives the row it describes.

## 6. Permissions

Seeded: `customer.create`, `customer.read`, `customer.approve`,
`customer.change_request`, `customer.delete_permanent`, and one role,
`Customer Lifecycle Admin`, holding all five. `customer.change_request`
now gates every requester-side Customer Change Request action
(create/save/submit); `customer.approve` gates the reviewer-side
decision (send back/reject/approve), the same role that already gated
onboarding case approval. `customer.delete_permanent` exists as a
permission now so the schema and role model are ready for §5 above;
nothing currently checks it.
