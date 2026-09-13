# Customer Lifecycle

Status: **PARTIALLY IMPLEMENTED.** The Onboarding Case lifecycle and its
atomic approval into a real Customer Master + Commercial Configuration are
implemented and persisted. Customer Change Requests, Commercial Version
2+ (draft/activate), and Permanent Customer Deletion are designed below
but not yet built; see each section's own status line.

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

## 3. Customer Master: read-only, not yet governed by Change Requests

Customer Master (`customers`) remains read-only through the application
today; only `approve_customer_onboarding_case` writes to it. There is no
Customer Master Change Request table, UI, or workflow evaluation wired
up yet. `docs/DATA_ARCHITECTURE.md` §15 already names the target shape
("Customer Master Change Request": current value + proposed value per
changed attribute, evaluated by the Workflow rule evaluator in
`src/platform/workflow/domain/evaluator.ts` for required
approvals/evidence) and remains the authoritative design for that future
work; nothing here supersedes it.

## 4. Commercial Version 2+ (draft/activate): not yet built

Creating a new Commercial Change against an existing Configuration
(`createCommercialChangeForConfiguration`) is real and already used by
the Commercial Rate promotion panel, but there is no draft/activate
split: calling it creates a live, immediately-effective Change. A true
"Draft Version 2, edited, then Submitted/Approved/Activated, closing the
prior version's effective period" flow is not implemented.

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

Seeded this round: `customer.create`, `customer.read`, `customer.approve`,
`customer.change_request`, `customer.delete_permanent`, and one role,
`Customer Lifecycle Admin`, holding all five. `customer.change_request`
and `customer.delete_permanent` exist as permissions now so the schema
and role model are ready for §3/§5 above; nothing currently checks them.
