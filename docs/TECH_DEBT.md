# Nexus: Tech Debt and Scaling Trigger Register

A concise, honest record of known debt and the trigger points at which a
currently-deferred capability should actually be built. Entries here are
real findings from actual review, not a wishlist. Update this file when
debt is created, closed, or a trigger point is reached; do not let it grow
into a second backlog.

## Now (worth doing soon, not urgent)

- **No admin UI screen for granting a scoped role (PD-005, Batches 1-13
  Ledger Audit product decision closure).** `grant_scoped_user_role`
  (`supabase/migrations/20260930110000_scoped_authorization_foundation.sql`)
  is real and enforced, but only callable directly; the existing User
  Access page's role-grant control (`src/platform/user-access/ui/
  user-access-page.tsx`) still only performs a global grant via
  `grant_user_role`. Build a scope picker (Business Unit / Territory /
  Customer / Global) alongside the existing role dropdown once a real
  admin needs to grant a scoped role through the UI rather than a script.
- **Go Live and Entitlement Source creation share the already-accepted
  create-with-client-UUID idempotency gap (NEXUS FULL PRODUCT
  READINESS).** `create_go_live_request` and `create_entitlement_source`
  both insert with a client-minted UUID and no dedup, same class as the
  three `create_*` RPCs already accepted below. `create_entitlement_source`
  is the more consequential of the two: `invoice_quantity` feeds directly
  into `generate_allocation_schedule`'s math, so a retry-duplicate would
  double an invoiced entitlement pool. Same mitigation as the existing
  entry applies today (creation happens via a single navigation, not a
  repeatable button) and the same deferral reasoning holds; listed here
  so a future idempotency-key pass covers five RPCs, not three.
  **Partially mitigated for `create_entitlement_source` (Product Gap
  Closure, 2026-09-22):** the unique constraint added for I-034
  (`uq_entitlement_sources_customer_invoice_reference`) incidentally
  catches a same-invoice-reference retry too, since that is exactly the
  duplicate-key case it was built to reject. It is not a purpose-built
  idempotency key (a retry with a client-minted UUID but a mistyped or
  differently-formatted reference would still slip through), so this
  entry stays open for `create_go_live_request` and as a reminder that a
  real idempotency-key pass is still the correct eventual fix, not this
  side effect.
  `record_settlement`, the one RPC in this family with no natural
  create-then-retry shape at all (no client id, and its own derived
  status directly sums every row), was fixed this round with a real
  unique constraint rather than deferred, since a duplicate there
  silently double-counts a real settled quantity, a materially worse
  outcome than a duplicate shell row.
- **Customer domain has no `services/customers.service.ts`.** Every
  other domain follows actions → service → data → RPC; Customer's
  `actions.ts` calls `data/customers.data.ts` (`setCustomerActive`) and
  `data/deletion.data.ts` (`deleteCustomerPermanently`) directly. Works
  correctly today and Customer reads already have a real second caller
  (`/api/v1/customers`), so this is a layering deviation, not a bug.
  Add a service layer before Customer writes need a second caller
  (an API write route, a bulk import) rather than as a standalone
  refactor.
- **Commercial has no `actions.ts`.** Commercial Version mutations are
  triggered from `customer-onboarding/actions.ts` (thin, correct) and
  also directly from `app/commercials/[configId]/versions/new/page.tsx`,
  a Server Component that calls `requirePermission` and the service
  layer on render rather than through a Server Action. This still goes
  through the real service layer (no bypass to `data.ts`/Supabase), so
  it is a pattern that is easy to misuse if copied elsewhere, not a
  live defect. Add a proper `actions.ts` the next time this route needs
  a second entry point.
- **`user-access.service.ts` imports `@/platform/team/data/team.data`
  directly**, bypassing Team's own service layer for a cross-domain
  read. Minor, but sets a precedent worth not repeating; route through
  `@/platform/team/server` instead next time this file is touched.
- **`useReferenceMasterSnapshot`/`ReferenceMasterSnapshotProvider` are
  imported directly from `reference-data/ui/snapshot-context.tsx` at
  10+ call sites** across `customer-onboarding`, `customer-change`, and
  several routes, never through `reference-data/index.ts` (which does
  not re-export them). Functionally harmless (still inside the feature's
  own public surface area conceptually), but breaks the stated barrel
  convention at a scale worth eventually promoting to the barrel or
  documenting as an accepted UI-context exception.
- **`entitlement.service.ts`'s `resolveLineItemContext` fetches an
  entire customer's line items to find one by `stableComponentKey`**,
  via the same `listCurrentLineItemsForCustomer` call the Go Live list
  page uses. Called on every usage submission/finalization, a hotter
  path than a detail-page view. Correct, just wasteful; worth a
  single-component lookup if usage submission volume ever grows past
  today's low, manual-entry scale.
- **Two cross-feature imports bypass a feature's own barrel**:
  `go-live/services/documents.service.ts` imports
  `validateAttachmentFile` from `customer-onboarding/domain/documents`
  directly (not re-exported by onboarding's `server.ts`/`index.ts`), and
  `customer-onboarding/ui/customer-commercial-configuration-view.tsx`
  imports `VersionHistoryTable` from `commercial/ui/version-history-table`
  directly (same gap). Neither is a security or correctness issue; both
  are candidates for promoting the shared piece into the owning
  feature's real public surface, or into `platform/`, the next time
  either file is touched.

- **Two Server Actions contain small business branches that belong in a
  service function.** `customer-onboarding/actions.ts`'s
  `checkForDuplicateCustomersAction` inline-maps tax identities + customer
  rows into `ExistingCustomerIdentity[]`; `customer-change/actions.ts`'s
  `createChangeRequestAction` inline-checks `!customer.is_active`. Both are
  single call sites today, so the risk is low, but a second caller of
  either capability (a future API adapter, per
  `docs/API_INTEGRATION_ARCHITECTURE.md` §1) would either duplicate the
  branch or have to know it lives in the wrong layer.
- **Further closed: real data-layer idempotency/retry tests (Platform
  Scale Closure, Phase C).** `case.test.ts` covers the pure domain guards
  (previous round). This round adds `case.data.test.ts` and
  `customers.data.test.ts`, real tests of the RPC-calling data layer
  itself (mocking only the Supabase client, never the RPC's documented
  behavior): submit-twice surfaces the RPC's own exception, approve-twice
  and set-active-twice pass an idempotent-replay response straight
  through with no extra client-side mutation, and the exact RPC parameter
  names are asserted so a silent rename can't regress silently (an RPC
  call is a `Record<string, unknown>`, so TypeScript gives no protection
  against that class of bug). `set_customer_active` itself gained a real
  idempotent-replay guard this round
  (`20260914170000_fix_set_customer_active_idempotency.sql`); previously
  a redundant deactivate/reactivate call bumped `customers.row_version`
  unconditionally, which could invalidate an unrelated in-flight Customer
  Change Request's `base_customer_row_version` for no real reason.
  Still open, deliberately not fixed: the three `create_*` RPCs (onboarding
  case, change request, commercial version) rely on a client-minted UUID
  with no reuse across a retry, so a retried creation currently produces
  a second, independent row (`case.data.test.ts` locks in this exact
  behavior so a future change to it is a conscious decision). Building
  idempotency-key infrastructure to close this is explicitly deferred per
  the Platform Scale Closure's own guardrail against building that ahead
  of a real external API caller; the existing mitigation is that
  creation happens via a single navigation (`/forms/customer-onboarding/new`
  and its two siblings), not a repeatable in-page button. `*.service.ts`
  files (`case.service.ts`/`change-request.service.ts`/
  `commercial-version.service.ts`) still have no test file: their
  `server-only` guard blocks a direct import, and their business logic
  (reference snapshot resolution, commercial component mapping) is
  heavier to mock meaningfully than the thin data-layer wrappers now
  covered. `customer_change_requests`/`commercial_configuration_versions`
  still have no pure domain module to test transitions against (their
  transition logic lives only in SQL).
- **No test proves cross-revision data integrity after send-back/resubmit.**
  `case.test.ts` proves non-mutation within one function call; nothing
  proves revision 1's stored data is still byte-for-byte intact after a
  send-back -> resubmit -> second send-back cycle.
- **`customer_change_requests` and `commercial_configuration_versions`
  status transitions live only in SQL**, with zero TypeScript test
  surface (no domain function encodes them, unlike
  `customer_onboarding_cases`, which `case.ts`/`case.test.ts` cover well).
- **The commercial version effective-date ordering guard
  (`COMMERCIAL_VERSION_EFFECTIVE_DATE_OUT_OF_ORDER`) is not recognized
  anywhere in TypeScript.** `CommercialErrorKind` has no case for it, so it
  falls through to a generic/unknown error bucket in the UI if ever
  raised.
- **`customer_onboarding_documents` upload had no server-side MIME/size
  revalidation before this round** (client-side `validateAttachmentFile`
  only). Fixed this round: `documents.service.ts`'s `uploadOnboardingDocument`
  now re-validates server-side using the same policy, and
  `document-paths.ts`'s `extensionFor` now allowlists the extension shape
  before it reaches a Storage key.
- **RLS was missing on all nine tables created from the Customer Lifecycle
  work onward** (`customer_onboarding_cases` and eight others). Fixed this
  round (`20260914150000_foundation_hardening_rls_indexes.sql`): RLS
  enabled with zero policies, matching every other table's convention.
  Privilege revocation from `anon`/`authenticated` was already correct on
  all nine; only the RLS backstop underneath it was missing.
- **Several FK/query-pattern indexes were missing**, most notably
  `customer_onboarding_cases` (zero indexes beyond its primary key) and
  `customers`/`capabilities` (same). Fixed this round for the columns
  real queries actually filter/sort by (`created_by`, `status`,
  `updated_at`, plus FK completeness on the busiest tables). Lower-traffic
  backend tables (`usage_facts`, `earned_results`, `billing_calculations`,
  and similar reconciliation tables) were deliberately left unindexed on
  their `created_by`/`updated_by` columns: no confirmed query pattern
  justifies them yet (see "Later" below for the trigger).
- **`commercial_configuration_versions` had no guard against two
  concurrent open (draft/submitted) versions per configuration.** Fixed
  this round: `uq_commercial_configuration_versions_one_open_per_config`,
  mirroring `form_versions`' own `uq_form_versions_one_active_draft`
  pattern.
- **Several N+1 query patterns fixed this round**: the onboarding
  review-queue/My-Requests/duplicate-check services each looped
  `getLatestRevisionForRequest`/`listRevisionsForRequest` once per row
  (the only genuinely *sequential*, non-`Promise.all`'d one, and the
  highest-value fix); `platform/approvals/server.ts` and the My Requests
  page each resolved customers one at a time instead of via a batched
  `getCustomersByIds`. Not yet batched (lower value, only 2 call sites):
  `getCommercialConfiguration` resolution in `platform/approvals/server.ts`
  and `/reviews/commercial-versions/page.tsx`.
- **Further N+1/redundancy fixes this round (Platform Scale Closure,
  Phase V)**: the Customer detail route fetched Change Requests, Field
  History, the onboarding origin, and the Reference Master snapshot
  twice each (once directly, once again inside the Activity timeline
  builder); consolidated into one `loadCustomerDetailContext` composer
  both now share. Change Requests and Commercial Versions each carried a
  3-query and 2-query-per-row fan-out (`loadChangeRequest`/`loadVersion`
  called once per row instead of batched); both now use one `.in()`
  query for revisions/requirements across all rows plus reuse of the
  already-fetched list row instead of a redundant single-row re-fetch.
  `listAuditLogForRow` (Customer Activity/History) had no bound at all;
  now capped at the 500 most recent rows (Phase O), fetched newest-first
  and reversed back to the ascending order callers expect. Still not
  batched (lower value, unchanged from last round): `getCommercialConfiguration`
  resolution in `platform/approvals/server.ts`/My Work, and unique actor
  email resolution in the same two places, both one round trip per
  item/actor concurrently rather than a single `.in()`/bulk call; today's
  volume does not justify it, see `docs/PLATFORM_ARCHITECTURE.md` §12a.
- ~~Three orphaned list routes: `/reviews`, `/reviews/change-requests`,
  `/reviews/commercial-versions`~~ — **closed (Platform Scale Closure,
  Phase X)**. Confirmed zero inbound links from anywhere (sidebar, any
  other page, or code) before removing; the three post-decision
  redirects that used to point at them (Phase J) were already moved to
  `/approvals` in the same program. Their *detail* routes (`/reviews/[id]`,
  etc.) are untouched: still live, still linked from Approvals.
- ~~`formatCurrency` in `src/lib/format.ts` had zero importers anywhere
  in `src`~~ — **closed (Platform Scale Closure, Phase X)**. Removed;
  `formatFxSnapshot` in the same file is real and unaffected.
- ~~Sidebar had four placeholder nav items with no backing route~~ —
  **closed (Platform Scale Program, Phase M)**. Go-Live, Ledger,
  Suspensions, and Legal (`app-shell.tsx`) were removed from navigation
  entirely rather than left 404ing; add each back only in the same
  change that adds its real route.
- **A few raw-status/raw-id UI spots were fixed this round** (Commercial
  Version and Customer Change requester/reviewer screens showed raw
  `sent_back`-style codes and raw UUIDs in page descriptions instead of
  `labelForCaseStatus`/`formatChangeRequestId`/`formatCommercialVersionId`).
  Two lower-priority ones deliberately left as-is: `customer-master-detail.tsx`'s
  "Customer ID" field shows the raw UUID (Customer Master has no
  Human-Friendly ID format at all yet, unlike onboarding/change-
  request/commercial-version; inventing one is a real schema decision, not
  a UI patch) and `commercial-component-detail-sheet.tsx`'s subtitle
  (an admin-facing detail sheet, lower visibility).
- **Reference Data Settings save controls don't use `PendingButton`**
  (`reference-master-settings.tsx`): they disable while saving but never
  swap their label or show a spinner, unlike every other save surface in
  the app.
- **Two silent `catch {}` blocks in `app/customers/page.tsx`** (former-name
  search, reference snapshot) fail with no user-visible indication at all,
  unlike the third catch in the same file which does surface a message.
- **Former-name search shows the most-recently-changed historical value, not necessarily the one that matched the search term (found live during the Batch 8/morning-catch-up execution of journey B-007).** `searchFormerCustomerNames`'s dedup (`change-request.service.ts`) keeps only the first row per customer in a most-recent-first ordering. When a customer has multiple historical names that share overlapping substrings (e.g. "Acme" then "Acme Global" then "Acme Global India"), searching for the earliest name still correctly finds the customer, but the "Former legal name: X" label shown can be a different, later historical value than the one actually searched for. The customer is always found correctly; only the specific label can be imprecise in this narrow case. Not fixed, since a real fix requires a small design choice (return the best-matching historical value per customer, or all matching values, rather than always the most recent) rather than being an unambiguous bug; revisit alongside any other former-name search change.

- **My Work's `canApprove` imprecision now spans a fourth request type.**
  `/my-work` ORs `customer.approve` with `go_live.approve` into one
  boolean, same pre-existing approximation already accepted for
  `commercial_configuration.approve` (`src/app/my-work/page.tsx`).
  "Pending my approval" is still an approximation across every request
  type until per-type routing exists; not made worse by Go Live, just
  extended to it.
- **Entitlement scheduling has no formal "Entitlement Period" table.**
  `ADD_TO_EXISTING_ENTITLEMENT_PERIOD` and `CREATE_NEW_ENTITLEMENT_PERIOD`
  are both just "insert more `entitlement_schedule_months` rows"; there is
  no row that represents a period as its own entity, only the schedule
  rows it produced (`docs/GO_LIVE_ENTITLEMENT_ARCHITECTURE.md` §7.3). Fine
  today, since nothing needs to list, name, or reason about a "period" as
  a first-class object; revisit if that need appears.
- **MRR Recognition is only an integration boundary, not a module.**
  `monthly_entitlement_ledger.recognition_status = 'pending_mrr_recognition'`
  rows accumulate for Slab/Progressive/Designation-based pricing with no
  process yet to resolve them into a real recognized outcome (`docs/
  GO_LIVE_ENTITLEMENT_ARCHITECTURE.md` §7.7). Expected and explicitly
  scoped out of this program; revisit once MRR Recognition itself is
  designed.

- **`go_live_requests.request_number` has no explicit unique index (found live during Batch 16's H-039), unlike
  the sibling `customer_change_requests.request_number` (`create unique index
  idx_customer_change_requests_request_number`).** Not an open defect: the backing sequence
  (`go_live_request_number_seq`) is itself race-safe (`nextval()` is atomic; confirmed empirically with 8
  concurrent creations, all unique, no gaps), and no code path anywhere ever sets `request_number` outside the
  column's own default. A pure defense-in-depth consistency gap versus the sibling domain, worth closing the
  next time this table's own migration file is touched for an unrelated reason, not urgent enough for a
  dedicated migration on its own.

- **Required fields do not consistently expose `aria-required` to assistive technology (found live during Batch 8's ACC-001).** The Country field on Customer Onboarding is visually marked required (a red asterisk) but its underlying Base UI combobox renders `aria-required="false"`, so a screen-reader user is not told the field is mandatory purely from focusing it. Not fixed in that pass, since a proper fix means auditing every required field across both SurveyJS-rendered stages and Base UI form controls app-wide for consistency, broader than the one keyboard-navigation-order finding ACC-001 was scoped to that round (which did get a real fix: a "Skip to main content" link, since the app had none anywhere and every page's tab order forced 7 stops through the sidebar and Log out button first). Revisit as part of a dedicated accessibility pass.

- **`create_commercial_change_for_configuration`, a legacy ungoverned RPC, remains live at the database level with zero application-layer caller (D-017, Batch 11; E-020, Batch 12).** It performs an unconditional component-closure step, without opening a replacement, and with zero awareness of a concurrently in-progress governed change. Confirmed live during the Batches 10-12 evidence reconciliation (2026-09-26), on a disposable test configuration with no real history: a governed Commercial Change left genuinely pending review, combined with an independent legacy-path change against the same configuration, produces a real gap in effective commercial terms once the governed change is later approved. Neither path corrupts or overwrites the other's own data; the resulting inconsistency is a business-data gap (a period with no active terms), not data loss. Fix direction: either remove the function entirely (if genuinely dead) or gate it behind the same governed path, once a real decision is made that it should not exist as a bypass.
- **A designation-based commercial component can be approved with zero rate rows (E-022, Batch 12), confirmed live (Batches 10-12 evidence reconciliation, 2026-09-26).** The invariant a designation-based component is meant to uphold, that it always prices at least one designation, is not enforced as a minimum-row-count check at either the schema-shape or the application-domain layer; both layers currently only confirm the rates structure is present, not that it is non-empty. Live-verified via the approval path: a component with no rate rows was accepted and persisted as a real, permanently open component with no effective pricing. Fix direction: add an explicit minimum-one-row check at whichever layer is intended to be authoritative (schema, domain validation, or both), once a business decision confirms a designation-based component must always carry at least one rate.

## Soon (real, but not urgent; revisit within the next few feature rounds)

- **Customer Master has no Human-Friendly ID.** Every other governed
  request type (onboarding, change request, commercial version) has one;
  Customer Master itself does not, so a raw UUID is the only identity ever
  shown for it in admin/detail contexts. Worth adding once a real product
  need surfaces (search-by-id, a future API `customerNumber` field per
  `docs/API_INTEGRATION_ARCHITECTURE.md` §3).
- **`/reviews/[requestId]`'s "Customer Details" section and the Customer
  Activity timeline's field-change events both rendered raw governed codes
  instead of resolved labels before this round.** Both fixed; kept as a
  debt entry only as a reminder to grep for `resolveOption` usage the next
  time a new screen renders a governed field, rather than re-deriving a
  label inline.
- ~~Date formatting was ad hoc across 13+ call sites~~ — **mostly closed
  (Platform Scale Closure, Phase H)**. `src/lib/date.ts` is now the
  shared utility (`formatTimestamp`/`formatTimestampDate`/
  `formatBusinessDate`), centralized at the shared `RequestTimeline`,
  Approvals inbox, My Requests, the three review screens' decided-on
  lines, and Customer Master detail. A few lower-traffic call sites
  (the now-removed `/reviews/*` list pages had some, already deleted in
  Phase X) were not individually swept; revisit only if a new one is
  found still calling `.toLocaleDateString()`/`.toLocaleString()`
  directly instead of the shared utility.
- **Two Supabase security-linter findings, real but out of scope for
  this closure pass (Platform Scale Closure, Phase S).** 61 functions
  (every `SECURITY DEFINER`-style RPC in the schema, including ones
  touched this program) have a mutable `search_path`, a standard
  Postgres hardening gap (`function_search_path_mutable`), pre-existing
  across the entire function set, not introduced by this round.
  Fixing it means adding `SET search_path = ''` (or a fixed schema) to
  every one, a real, sizable, dedicated pass, not a byproduct of an
  unrelated program; do not fix a handful ad hoc, since consistency
  matters here. Separately, Supabase Auth's leaked-password protection
  (HaveIBeenPwned check) is disabled at the project level
  (`auth_leaked_password_protection`), a dashboard/infrastructure
  setting, not a code change.
- ~~JS-side floating-point arithmetic for monetary calculations~~ — **closed
  (Platform Scale Program, Phase G)**. `commercial-rate-fx.ts`'s `toInr`
  now rounds explicitly to 2 decimal places instead of leaving a raw
  `amount * rate`. The Money Policy is now documented explicitly
  (`docs/COMMERCIAL_DOMAIN_ARCHITECTURE.md` §18a): authoritative
  calculations round in the one canonical calculation module (§18b);
  display-only derived values round to a fixed precision at the point
  they are produced. No evidence of an actual observed discrepancy was
  ever found; this closed the policy gap before it could become one.

## Later (explicit trigger points, do not build early)

- **`measurement_definitions` is a fully-designed, currently-unused future
  capability (Product Decision, Pre-Batch-21, 2026-09-22, see
  `docs/GO_LIVE_ENTITLEMENT_ARCHITECTURE.md` §7.2).** The table, the
  `MeasurementDefinition` type, `commercial_components.measurement_definition_id`,
  and several read-model call sites all exist, but the table has zero rows
  and the column is null on every one of the 72 live commercial components
  in the shared database; nothing writes to it today.
  `commercial_components.pricing_rule_parameters ->> 'pricingUnit'` is the
  real, current, canonical billed-metric source of truth, and I-035's
  metric-consistency check (Batch 19 Product Gap Closure) is built against
  it, not `measurement_definitions`. Build the migration to
  `measurement_definitions` (backfilling values, wiring
  `add_commercial_component` callers to populate
  `measurement_definition_id`, re-pointing I-035's check and any other
  metric-label rendering) only if a real product need for
  `measurement_definitions`'s richer shape (unit, counting rule, period
  basis, dimension keys, expected source, active/deprecated status) beyond
  a plain code + label actually appears; until then, `pricingUnit` remains
  sufficient and this stays parked.
- **No dedicated Maker/Checker screen exists** (NEXUS FULL PRODUCT
  READINESS product surface audit). Who is a Maker versus a Checker is
  only visible by cross-referencing role names inside the generic User
  Access role-grant UI; matches the already-documented `docs/
  AUTHORIZATION_MODEL.md` §19 position that a dedicated Access Profile
  concept is DESIGN DRAFT, not built. Build a real "who can approve what"
  screen once a second, more complex authorization shape (a scoped or
  per-team approval matrix) makes the current role-name-only view
  genuinely hard to reason about; today's role count is still small
  enough to read directly.
- **No global audit/history viewer exists.** Activity/History is only
  ever a per-customer tab; Settings mutations (Reference Master, Team
  Master, Workflow publish/discard) are captured in `audit_log` (`docs/
  AUTHORIZATION_MODEL.md` §21) but have no UI surface at all beyond
  informal "Last Updated by" columns. Build a cross-entity audit viewer
  once a real compliance/support need to search audit history by actor
  or time range (not by customer) appears; the data already supports it.
  Covers N-029 (a user's role grant/revoke history) and O-023 (a user's
  team membership history): both confirmed the underlying `user_roles`/
  `user_teams` data is fully correct and immutable, only the viewing
  surface is missing (Product Gap Triage, Batches 3-6).
- **No self-service "My Access" view exists.** A user with no special
  permission has no way to see their own current roles, teams, or
  derived permissions short of asking an admin, or, if they happen to
  hold `user_access.read`/`write` themselves, finding their own row in
  the all-users admin list. The underlying data already resolves
  correctly everywhere else (roles, teams, permission unions); only a
  new "self" scoped route and query are missing. Build once a material
  volume of "why can't I do X" support requests appears that an admin
  currently has to manually look up each time (N-026, Product Gap
  Triage, Batches 3-6).
- **No Credit Note document lifecycle wired to Entitlement (Product
  Decision Closure, 2026-09-22, Batch 17 I-015).** The decided business
  rule is that invoice-created entitlement persists unless reduced or
  reversed by a real Credit Note. Nexus has no such document lifecycle
  connected to `entitlement_sources` today; the `invoice_evidence`/
  `credit_note` concept in `docs/COMMERCIAL_MIGRATION_10_BILLING_INVOICE_RECONCILIATION_DESIGN.md`
  is a separate billing-reconciliation bounded context with no
  structural link to Entitlement. Build a real CN-driven entitlement
  reduction/reversal mechanism once Nexus has an actual Credit Note
  document concept for Entitlement to reference; until then, the only
  bounded correction made was ensuring `cancel_entitlement_source` has
  zero effect on any Invoice entitlement, past or future, recognized or
  not (see `docs/GO_LIVE_ENTITLEMENT_ARCHITECTURE.md` §7.2).
- **Invoice Frequency cadence has no freeze mechanism, unlike Currency's
  `fx_snapshot_rate`.** `commercial_components.billing_cadence` stores
  only an opaque code string; the one function that would resolve a live
  numeric cadence value (`getInvoiceFrequencyCadence`) has zero real
  call sites anywhere in the codebase (confirmed by grep, most recently
  during the Batches 3-6 triage). This is currently a latent gap, not a
  live one: no feature today derives a real financial outcome from a
  numeric cadence value, so there is nothing to retroactively revalue.
  Decide whether cadence needs the same freeze-at-creation-time
  treatment `fx_snapshot_rate` already gives currency
  (`docs/COMMERCIAL_DOMAIN_ARCHITECTURE.md` §22a) only at the moment a
  real caller is added for `getInvoiceFrequencyCadence`, or any other
  code begins deriving a live financial outcome (an invoice schedule, a
  billing calculation) from the numeric cadence value; do not decide it
  implicitly by leaving the question unexamined once that happens (P-012,
  Product Gap Triage, Batches 3-6).
- **Documents platform duplication assessed, not generalized (NEXUS
  FULL PRODUCT READINESS, Phase 15).** `docs/ARCHITECTURE.md` §4 names
  `attachments` as a shared platform capability, but no
  `platform/attachments/` module exists: Customer Onboarding and Go Live
  each have their own `documents.data.ts`/`documents.service.ts`,
  identical in shape (private bucket, opaque path, `is_current`-only
  mutation, signed-URL download), sharing only the pure
  `validateAttachmentFile` function. Two real consumers now exist, which
  is exactly the trigger point `docs/API_INTEGRATION_ARCHITECTURE.md` §1
  already named for evaluating a shared capability. Not generalized in
  this pass because both consumers' actual persistence shape and RLS
  posture are already correct and identical; extracting a shared module
  now would move working code without fixing a real defect, purely for
  structural tidiness (abstraction theater the task's own principle
  guards against). Revisit when a third consumer (Agreement Lifecycle,
  MRR Recognition, Invoice/CN evidence) needs the same shape: at three
  real, independently-evolving consumers, a shared `platform/attachments/`
  module pays for itself.
- **Customer Detail's "Documents" tab renders synthetic demo PDFs
  (`/api/demo/customer-documents/[documentType]`), not the real
  persisted documents from Onboarding or Go Live.** These are two
  genuinely separate systems today: the Documents tab is a pre-existing,
  clearly-labeled demo fixture (`Badge: "Demo / Fixture"`), while real
  evidence lives in `customer_onboarding_documents`/`go_live_documents`
  and is only viewable from each request's own review/detail screen.
  Not fixed in this pass (would require a new cross-request document
  read model, a real feature, not a bug fix); flagged so a future task
  does not assume the Documents tab already shows real evidence.

- **Move to a shared `DataTable` component** (per `docs/UI_SYSTEM.md` §19,
  documented but never built) when a list page needs real sorting/
  filtering/column-state/virtualization. Every current list (Customers,
  My Requests, Approvals, My Work) is small and simple enough that
  composing raw `components/ui/table` primitives per page remains correct;
  do not adopt TanStack Table or similar until a list genuinely needs
  those features. Covers N-027 (User Access list search/filter) and
  O-020 (Team Master list search/filter): both confirmed low current
  impact given today's low user/team count (Product Gap Triage, Batches
  3-6).
- **Index the remaining `created_by`/`updated_by` columns on backend/
  reconciliation tables** (`usage_facts`, `earned_results`,
  `billing_calculations`, `commercial_components`, and similar) once a
  real interactive query filters or sorts by them. These tables are
  currently written by trusted backend RPCs and read in bulk, not scanned
  interactively; indexing them now would be speculative.
- **Batch `getCommercialConfiguration` resolution** in
  `platform/approvals/server.ts` and `/reviews/commercial-versions/page.tsx`
  (add a `getCommercialConfigurationsByIds` alongside the existing
  single-row lookup) once commercial version volume is high enough that
  the current per-entry `Promise.all` fan-out becomes visible in practice;
  today's volume (K is typically small) makes this a "correct to do
  eventually" fix, not a "will time out" one, unlike the onboarding
  revision N+1 that was fixed this round.
- **A dedicated Postgres search feature (Elasticsearch/Algolia/etc.)**
  only once Customer Search genuinely needs full-text ranking, typo
  tolerance, or facet aggregation beyond what indexed Postgres `ILIKE`/
  trigram search can do. Not needed at today's customer count.
- **`external_resource_references`** (or equivalent) only once a real
  external system integration exists to validate the shape against; see
  `docs/API_INTEGRATION_ARCHITECTURE.md` §4 for the shape to build then.
- **Idempotency-key infrastructure** only once the first external
  integration/API caller that needs safe-retry-under-ambiguity exists; see
  `docs/API_INTEGRATION_ARCHITECTURE.md` §5.
- **Service principal / machine identity** only once a real system-to-
  system integration needs to authenticate as something other than a
  human; see `docs/API_INTEGRATION_ARCHITECTURE.md` §7. Do not build a DIY
  API key scheme ahead of that need.
- **Scoped (non-global) RBAC** only once a real requirement needs a role
  limited to one customer/business unit/legal entity; the extension path
  (`user_roles.scope_resource_id` already exists, unpopulated) is
  preserved, per `docs/AUTHORIZATION_MODEL.md` §5.
- ~~Go Live domain and Entitlement Ledger coverage~~ — **superseded (Go Live +
  Entitlement Ledger program, Phases F-N; live-tested end to end in Batches
  15-16).** The note this replaced said these two domains were "[NOT
  DESIGNED, correctly out of scope]"; that is no longer accurate. Both are
  now real, built, and exercised through the real UI and RPC layer across
  Batch 15 (H-001 through H-023, G-025/G-026) and Batch 16 (H-024 through
  H-043, I-001 through I-005): request lifecycle, workflow approval,
  optimistic locking, attachment upload, direct-mutation defense-in-depth,
  and manual Entitlement Source creation with Go-Live-anchored allocation
  scheduling are all real and tested. `docs/GO_LIVE_ENTITLEMENT_ARCHITECTURE.md`
  is the current, accurate design record. Agreement lifecycle and
  Legal-Commercial coverage remain genuinely not built; see the two
  separate entries below for their own status.
- **Agreement lifecycle and Legal-Commercial coverage** (Platform
  Operating Expansion, Phases Q-T) were deliberately not built in that
  program and remain not built as of Batch 16. Building either means
  inventing what triggers them, who approves them, and what they gate,
  exactly the kind of business rule this project does not fabricate
  without a product brief. Build each only once a real product brief
  defines its business meaning.
- **API-sourced and Import/Bulk-sourced Entitlement Source creation**
  (confirmed live during Batch 16's I-003/I-004; product decision made in
  the Stage A closure that followed). `entitlement_sources.source_type`
  already allows `'API'`/`'IMPORT'` at the schema level, and both
  `docs/API_INTEGRATION_ARCHITECTURE.md` §1 and
  `docs/GO_LIVE_ENTITLEMENT_ARCHITECTURE.md` §7.2 already named this as
  future scope, but `create_entitlement_source`'s own RPC parameter list
  has no `p_source_type` at all, so every call today unconditionally
  produces `MANUAL`. **Decided (Stage A, post-Batch 16): Entitlement
  Source creation stays manual-only for now; this is an intentional
  product-scope decision, not an oversight.** Build real API/Import
  support only once both of these are true: (1) a real, scoped external
  integration or bulk-import requirement actually exists (not built
  speculatively ahead of one), and (2) the non-interactive caller
  authentication model this would need
  (`docs/API_INTEGRATION_ARCHITECTURE.md` §7, "Service principal / machine
  identity", DESIGNED / IMPLEMENTATION DEFERRED) has itself been designed
  first. Do not add a `p_source_type` parameter or any import-file
  handling opportunistically ahead of that trigger.
- **PARKED: Post-Journey Automated Test Coverage Audit** (recorded
  2026-09-25, explicitly not to be started until the trigger below is
  met). Different question from "does the existing test suite pass"
  (`vitest` green does not establish that all meaningful Nexus business
  logic has adequate automated coverage). Once due, the audit assesses:
  statement/branch/function/line coverage; automated coverage broken down
  by Nexus domain; production modules with zero or weak tests;
  authorization invariants; financial invariants; concurrency/data-
  integrity controls; workflow controls; missing regression coverage; and
  a P0/P1/P2 ranking of automated-test gaps. Objective is NOT artificial
  100% coverage; it is that important Nexus business/control invariants
  have appropriate automated protection, while Journey/Manual UX testing
  continues to prove the real product experience. **Trigger: only after
  the entire historical Journey/Manual UX revalidation program (all
  batches, all Journey Discovery follow-ups, all defects, and all Product
  Decisions arising from that program) is fully reconciled.** Do not
  start this audit opportunistically ahead of that trigger, and do not
  let ordinary batch work expand into it.
