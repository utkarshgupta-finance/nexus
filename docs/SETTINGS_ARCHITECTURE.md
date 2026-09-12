# Nexus Customer Onboarding Settings Architecture

**[IMPLEMENTED]** This document is the authoritative source for the
Customer Onboarding Settings workspace (`/settings/customer-onboarding`,
`src/features/reference-data/ui/reference-master-settings.tsx`): its
information architecture, the three configuration levels it governs, and
the honest boundary between what is real domain/UI behavior today and
what is still local-session-only. It formalizes and extends the
governance model first introduced piecemeal in
`docs/COMMERCIAL_DOMAIN_ARCHITECTURE.md` §22; that document's own
Commercial-specific subsection now points back here as the canonical
source, and this document does not duplicate `docs/DATA_ARCHITECTURE.md`
§6's own generic reference-data principles, only builds on them.

## 1. Purpose

Every controlled, selectable value Customer Onboarding and Commercial
Rate offer a user (Industry, Segment, Business Unit, Tax Identifier Type,
Currency, Pricing Unit, Invoice Frequency, and the fixed business/
calculation vocabularies Commercial Rate depends on) is governed in one
place, under one consistent lifecycle, rather than as scattered hardcoded
option arrays inside individual forms. Before this document, some of
these lists were already Reference Master governed (Industry, Segment,
Business Unit, Currency, Pricing Unit); Tax Identifier Type was still a
hardcoded array inside the Tax & Registration form definition, and the
Settings screen itself was one flat list switcher with no organizing
structure. This document fixes both: Tax Identifier Type is now Reference
Master governed like everything else, and the workspace is organized into
three groups that make its own shape legible.

## 2. Settings workspace structure

Three groups, selected by a top-level toggle, each with its own
second-level list switcher (`reference-master-settings.tsx`'s
`GROUPS`/`LIST_CONFIGS`):

- **Customer Setup**: Industry / Category, Segment, Business Unit, Tax
  Identifier Type. Every one of these is Level 1, Configurable Reference
  Data (§3).
- **Commercial Setup**: Currency (with its own INR Conversion Rate
  column), Pricing Units, Invoice Frequency (with its own Cadence
  column). Currency and Invoice Frequency are Level 2, Governed Business
  Parameters; Pricing Unit is Level 1.
- **System Rules**: Commercial Nature, Pricing Models, Invoice Timing,
  Slab Methods, Revenue Recognition Methods. All five are Level 3,
  System-Supported Logic: View/Search/Activate/Deactivate only, never
  Add, each with a short, compact help-text line explaining what it means
  rather than a paragraph of prose per row.

Every list still shows View, Search, and (where its level allows) Add,
Activate, Deactivate; a compact "Used By" line under each list's title
names the real consumer, so an administrator can see impact without a
separate dependency map (task-driven design constraint: "do not overbuild
dependency mapping").

### Country and Phone Country Code are deliberately excluded

Geography (Country, State, City) is not part of this workspace's
navigation, on purpose. Country and Phone Country Code remain Reference
Master **shaped** (`ReferenceOption`-compatible, for the same
historical-resolution guarantee everything else gets), and are still
derived from the real canonical `countries-list` catalogue
(`src/features/reference-data/domain/countries.ts`), never hand-typed.
What changed is only that this Settings screen no longer surfaces them as
an editable list: geography stays governed by its own dataset and the
`/api/geography/*` services (State and City are not Reference Master at
all, they come from that live geography API), not a hand-curated Settings
row set. Nothing about how Customer Details selects a Country changed;
only this workspace's own navigation does not feature it.

## 3. The three configuration levels

**Level 1, Configurable Reference Data.** Industry, Segment, Business
Unit, Tax Identifier Type, Pricing Unit. Pure administrative data: View,
Search, Add, Activate, Deactivate, all through the identical generic flow
(`handleAddStandard` in `reference-master-settings.tsx`). A new value
needs no code change to work; the moment it is added and active, it is
selectable everywhere its list is read from.

**Level 2, Governed Business Parameters.** Currency's own INR Conversion
Rate, Invoice Frequency's own Cadence. The list of values can still grow
like Level 1, but each value additionally carries a governed number with
real calculation meaning, editable only within its defined semantics
(a positive INR rate; a positive integer cadence in months), never free
text, and never editable from the form that consumes it (Commercial Rate
only ever reads these, see §4-5 below).

**Level 3, System-Supported Logic.** Commercial Nature, Pricing Models,
Invoice Timing, Slab Methods, Revenue Recognition Methods. A new value
needs new application or calculation code before it means anything at
all, so Settings never allows adding one for any of these five;
Activate/Deactivate remains available since it costs nothing extra and
causes no harm to expose, but see the honesty note in §7 about which of
these five actually gate real UI today.

## 4. Currency and FX governance

Reference Master's `currency` list carries an `inrConversionRate` field:
"1 unit of this currency = X INR" (USD → 91 means 1 USD = INR 91; GBP →
121 means 1 GBP = INR 121). INR's own row is fixed at exactly 1, never
Settings-editable, since it is definitionally true rather than a business
choice. Adding a new currency (`handleAddCurrency`) validates its code
against a real ISO 4217 catalogue derived from the already-installed
`countries-list` package (`src/features/reference-data/domain/
currency-codes.ts`, `isValidIsoCurrencyCode`), never a hand-typed
plausibility check and never a new dependency; a newly added currency
starts with `inrConversionRate: null` (not configured), never an invented
number, until a Settings user sets a real rate afterward.

Commercial Rate (`src/features/customer-onboarding/domain/
commercial-rate-fx.ts`) only ever reads this governed rate
(`inrConversionRateFor`), shows it read-only next to Billing Currency, and
blocks the stage from Complete when a foreign Billing Currency has no
configured rate. There is no customer-level FX override anywhere in
Commercial Rate. `docs/COMMERCIAL_DOMAIN_ARCHITECTURE.md`'s own FX
snapshot principle (§22) still applies unchanged and is not re-litigated
here: a governed rate changing later must not silently revalue an
already-approved historical Commercial Configuration version, and no live
persistence path exists yet to capture that snapshot (see §6 below).

## 5. Invoice Frequency cadence governance

Reference Master's `invoice_frequency` list carries a `cadenceMonths`
field: Monthly = 1, Quarterly = 3, Half-Yearly = 6, Annual = 12. The
reserved "One-Time" row alone carries `cadenceMonths: null`, and this is
exactly what protects it from being silently re-created or impersonated:
adding a new recurring frequency (`handleAddInvoiceFrequency`) always
requires a positive whole-number cadence, so a `null` cadence can only
ever mean the one true system row, never a user-created one pretending to
be non-recurring. The display label alone is never trusted to carry this
meaning (a business rule this correction exists specifically to enforce);
a caller needing the real cadence reads `cadenceMonths` (or the
`getInvoiceFrequencyCadence` service helper), never parses the label
text.

## 6. Persistence status: real, database-backed, since 2026-09-12

**[IMPLEMENTED]** Every Reference Master list this workspace shows,
except `country`/`phone_country_code` (§2), is now persisted in Supabase:
`supabase/migrations/20260912080000_reference_master_foundation.sql`
creates `reference_lists` (the migration-managed catalog of the twelve
list categories) and `reference_options` (the generic option row: stable
`code`, editable `label`, `is_active`, `sort_order`, and two typed,
list-scoped governed columns, `inr_conversion_rate` and
`cadence_months`), exactly the shape `docs/DATA_ARCHITECTURE.md` §6
already locked. This closes the gap that section's own text used to
describe: "no such table exists" is no longer true.

**Read path.** `src/features/reference-data/domain/service.ts` is
unchanged in spirit: `getActiveOptions`, `getAllOptions`, `resolveOption`,
`getInrConversionRate`, `getInvoiceFrequencyCadence` are still pure,
synchronous functions. What changed is where the data they operate on
comes from: every one of them now takes an explicit
`ReferenceMasterSnapshot` parameter (a plain `Record<ReferenceListKey,
ReferenceOption[]>`) instead of reading a module-level fixture import.
`src/features/reference-data/server.ts` (`server-only`, following the
identical trust-boundary pattern as `src/features/commercial/server.ts`
and `src/features/customers/server.ts`) builds that snapshot for real:
`loadReferenceMasterSnapshot()` reads every `reference_options` row via
the service-role Supabase client, groups it by list
(`src/features/reference-data/domain/snapshot.ts`'s pure
`buildPersistedSnapshot`, kept out of `server.ts` specifically so it has
a normal, importable unit test, see `domain/snapshot.test.ts`), and fills
in `country`/`phone_country_code` from the same real `countries-list`
catalogue (`domain/countries.ts`) as before. A Server Component route
(`src/app/forms/customer-onboarding/page.tsx`,
`src/app/settings/customer-onboarding/page.tsx`,
`src/app/customers/page.tsx`, `src/app/customers/[customerKey]/page.tsx`)
loads this snapshot once per request and passes it down: directly as a
prop for a component one hop away (`ReferenceMasterSettings`,
`CustomersPage`, `CustomerMasterDetail`), or through
`src/features/reference-data/ui/snapshot-context.tsx`'s
`ReferenceMasterSnapshotProvider`/`useReferenceMasterSnapshot` for the
deeply nested Commercial Rate component tree, where prop-drilling through
every intermediate component would be needlessly invasive. Every pure
domain function still receives the snapshot as an explicit argument at
its own call site; only the UI layer reads the context.

**Write path.** `server.ts` also exports `addReferenceOption`,
`setReferenceOptionActive`, `updateCurrencyInrConversionRate`,
`updateInvoiceFrequencyCadence`, each a thin call into
`src/features/reference-data/data/reference-master.data.ts` (plain
PostgREST `insert`/`update` through the service-role client, no RPC,
matching the exact pattern `src/features/customers/data/customers.data.ts`
already established for a table with no complex multi-step write). Real
Next.js Server Actions (`src/features/reference-data/actions.ts`,
`"use server"`) wrap these for the Settings screen: `addStandardOptionAction`,
`addCurrencyOptionAction`, `addInvoiceFrequencyOptionAction`,
`setOptionActiveAction`, `updateCurrencyRateAction`. Each one calls
`revalidatePath` for every route that reads a snapshot after a successful
write, so the change is visible on next load anywhere in the app, not
only inside the Settings tab that made it. `ReferenceMasterSettings`
calls these actions directly (a Client Component may call a Server Action
without a form submission) and applies the server's own confirmed
response into its local render state, never assuming the mutation
succeeded from client-side optimism alone.

**What this closes.** The propagation this task originally described as
partial ("Settings change reflected in new Commercial Rate selection" was
real only at the shared-fixture level, not across browser
tabs/sessions) is now real end to end: add a Pricing Unit in Settings,
reload `/forms/customer-onboarding` in a different tab, and it is there,
because both routes load the same `reference_options` table, not two
independent copies.

**What is still local-only.** Nothing changed about Commercial
Configuration itself (§4's FX snapshot principle, still just a shape
proven out, no real promotion write path). Fixture role after this
migration, see §6a below.

### 6a. Fixture's role now: tests and seed data only

`src/features/reference-data/domain/fixtures.ts`
(`REFERENCE_MASTER_FIXTURES`) is never read by production code path
anymore: every route loads a real snapshot via `server.ts`. The fixture
still serves two purposes, both legitimate:

- **Tests.** Every existing domain test (`service.test.ts`,
  `commercial-rate-summary.test.ts`, and similar) passes
  `REFERENCE_MASTER_FIXTURES` as the `ReferenceMasterSnapshot` argument
  to the same pure functions production code calls, proving the domain
  logic without a database.
- **Seed data source.** The migration's own seed `INSERT` statements were
  authored by hand from this fixture's values at migration-authoring
  time (task correction §13: "do not invent new values"), not read from
  it at runtime. The fixture and the seeded table can, in principle,
  drift apart after this point (an Add in Settings changes the table,
  never the fixture); this is expected and correct, not a bug, since the
  fixture's only remaining job is to give tests deterministic input.

### 6b. Error states: honest, never silently empty

`loadReferenceMasterSnapshot()` throws on a real backend failure (a
missing credential, a network error, an RLS/permission problem); it never
catches and returns an empty snapshot itself (task correction §23, "do
not pretend empty list means there are no values"). Every calling route
wraps the call in its own `try`/`catch`, matching the exact pattern
`src/app/customers/page.tsx` already established for Customer Master, and
passes an explicit `snapshotUnavailable: boolean` down so the UI shows a
visible, honest banner ("Reference Master could not be reached...")
rather than an indistinguishable empty list. Settings additionally
disables Add/Activate/Deactivate while unavailable, since a write against
data that might already be stale is worse than no write at all.

### 6c. Caching and freshness

Every Reference-Master-reading route is `export const dynamic =
"force-dynamic"` (the same requirement `CLAUDE.md`'s Deployment section
already states for any live-backend read): Next.js never freezes a
snapshot at build time. Freshness after a Settings write is explicit, not
implicit: each Server Action calls `revalidatePath` for every route that
reads a snapshot (`/settings/customer-onboarding`,
`/forms/customer-onboarding`, `/customers`) immediately after a
successful write, so the very next request to any of those routes gets a
fresh read, never a stale cached one. There is no time-based revalidation
window to reason about; a write is visible the moment its own request
completes.

### 6d. Audit

`reference_options` carries the same generic, database-enforced audit
trigger (`fn_audit_row('id')`) as every other Platform Core table
(`docs/DATA_ARCHITECTURE.md` §9): every INSERT/UPDATE/DELETE attempt is
captured in `audit_log`, including the rejected DELETE attempts the
lifecycle trigger blocks. `reference_lists` (the list-category catalog)
is deliberately not audited, matching the identical precedent already
set for `resource_types`: migration-only structural metadata with a text
primary key, not row-audit shaped. `actor_user_id` on every audit row is
`null` for all current Reference Master writes: Nexus has no
authenticated session yet to populate it from (§6e), and this module
never fabricates one.

### 6e. Authorization honesty

Unchanged from the rest of this app's own stated limitation
(`src/features/commercial/server.ts`'s header, `src/features/customers/
server.ts`'s header): `server.ts`'s write functions take `actorUserId` as
an explicit parameter, and every current call site
(`src/features/reference-data/actions.ts`) passes `null`, since there is
no real Nexus user identity anywhere yet. `service_role` (the credential
every write ultimately authenticates as) bypasses RLS entirely; RLS on
`reference_lists`/`reference_options` denies `anon`/`authenticated` all
direct access, the same deny-by-default posture as every other Platform
Core table. This means: the write path is safe from an unauthenticated
browser reaching the database directly, but Settings' own Add/Activate/
Deactivate buttons are not yet gated by any real per-user permission
check, because that platform capability does not exist in Nexus at all
yet. Add that check at the Server Action call site once it does; do not
invent a parallel one here.

## 7. Reference Master reuse, not one table per dropdown

Every list in this workspace, Configurable, Governed, or System-Supported
alike, is modeled through the exact same `ReferenceListKey`/
`ReferenceOption` shape and the same four functions in
`src/features/reference-data/domain/service.ts`. Adding Tax Identifier
Type, Slab Method, and Revenue Recognition Method to this workspace
required zero new stores, zero new fixture shapes, and zero new
resolution functions: each is one more entry in the same
`REFERENCE_MASTER_FIXTURES` record and the same `LIST_CONFIGS` array. This
is a deliberate constraint, not an accident: a future generic reference
table (§6) replaces the fixture once, behind these same four functions,
without every consumer needing to change.

**Honesty note on Level 3, updated 2026-09-12:** all five System Rules
lists now respect Settings' active/inactive state. `pricing_model` and
`invoice_timing` already read `getActiveOptions` via `OptionSelect`.
`commercial_nature`'s three fixed sections (`NATURE_SECTIONS` in
`commercial-rate-section.tsx`) now check `getActiveOptions(snapshot,
"commercial_nature")` before showing that section's own Add button: a
deactivated Nature can no longer start a new component, but its section,
and every component it already contains, keeps rendering unconditionally
(task correction §21, "existing saved/historical values remain
resolvable... do not allow an inactive rule to destroy historical
rendering"). `slab_method`'s and `revenue_recognition_method`'s
`ToggleGroup` choices are filtered the same way: only active options are
offered for a **new** choice, but whichever value a component already
carries always keeps its own toggle item rendered even if later
deactivated, so an existing selection is never hidden or force-changed.
No automated component test covers this (this codebase's test suite is
domain/service-level only, `vitest.config.ts` scopes to `*.test.ts`, no
`.test.tsx`/React Testing Library anywhere yet); it is verified live in
the browser instead, the same way every other UI behavior in this
feature has been verified in every prior round.

## 8. Used By

Each list's own `usedBy` string in `LIST_CONFIGS` names its real
consumer(s): Industry/Segment/Business Unit/Tax Identifier Type are all
"Used by Customer Details"; Currency is "Used by Commercial Rate and
future Revenue"; Pricing Unit and Invoice Frequency are "Used by
Commercial Rate"; each System Rule names the specific Commercial Rate
mechanism it governs. This is a static, hand-maintained label, not a
computed dependency graph: it exists to answer "where does this matter"
at a glance, not to replace a real impact-analysis tool.
