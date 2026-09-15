# Nexus: Tech Debt and Scaling Trigger Register

A concise, honest record of known debt and the trigger points at which a
currently-deferred capability should actually be built. Entries here are
real findings from actual review, not a wishlist. Update this file when
debt is created, closed, or a trigger point is reached; do not let it grow
into a second backlog.

## Now (worth doing soon, not urgent)

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
  those features.
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
- **Go Live domain, Entitlement Ledger, Agreement lifecycle, and Legal-
  Commercial coverage** (Platform Operating Expansion, Phases Q-T) were
  deliberately not built in that program. `docs/MASTER_DATA_FOUNDATION_DESIGN.md`
  §21 already locks Go Live and Entitlement as domains whose boundary is
  preserved (they anchor to `customers.id` like Commercial Configuration
  does) but explicitly marks them "[NOT DESIGNED, correctly out of
  scope]" pending real Finance/business input; `docs/COMMERCIAL_DOMAIN_ARCHITECTURE.md`
  §14 lists "a go-live condition pending" only as an illustrative,
  undesigned example of an Invoice Eligibility gate. Building any of the
  four for real means inventing what triggers them, who approves them,
  and what they gate, exactly the kind of business rule this project does
  not fabricate without a product brief (this is also why a placeholder
  Go-Live sidebar item was removed rather than left pointing at a fake
  route, Platform Scale Program Phase M, above). Build each only once a
  real product brief defines its business meaning.
