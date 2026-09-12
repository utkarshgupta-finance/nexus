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

## 6. Persistence status: honest, not aspirational

Nothing in this workspace writes to a real, shared, permanent store yet.
`docs/DATA_ARCHITECTURE.md` §6 already locks the intended eventual shape
(a generic reference table: stable code, label, active flag, sort order);
no such table exists (M7 built two purpose-built tables, `customers` and
`capabilities`, not a generic one). Until it does, every Reference Master
list lives in one shared, in-repo TypeScript fixture
(`src/features/reference-data/domain/fixtures.ts`) that Customer
Onboarding and Commercial Rate both read from at request time
(`getActiveOptions`/`resolveOption`/`getInrConversionRate`/
`getInvoiceFrequencyCadence`), so those two features can never drift into
two different copies of the same list.

The Settings **screen itself** holds its own local copy of that fixture
in component state and never writes back to the shared module: an edit
made in Settings (adding a unit, deactivating a currency, changing an FX
rate) is visible only within that one page's own session, exactly like
`nexus-dev`'s other fixture-backed screens, and is gone on reload. This
means the live propagation described conceptually in this task ("Settings
change reflected in new Commercial Rate selection") is real at the level
of "Commercial Rate always reads the current shared fixture, never a
stale hardcoded copy," but not yet real at the level of "an edit made in
the Settings UI in one browser tab is immediately visible in another tab
or another page of the same session." Closing that gap requires the same
real reference-data table `docs/DATA_ARCHITECTURE.md` §6 already
anticipates, plus a safe, authorized write path (none exists yet, no
per-user authorization boundary in Nexus today, see
`src/features/commercial/server.ts`'s own header comment for the
identical constraint). This is stated plainly rather than pretended away:
the domain and UI behavior above are real and tested; "Settings edits
persist across sessions" is not true yet.

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

**Honesty note on Level 3 today:** of the five System Rules lists, only
`pricing_model` (via `OptionSelect` in the Commercial Rate editor) and
`invoice_timing` (via the same mechanism) actually read `getActiveOptions`
to decide what a user can pick. `commercial_nature` renders as three fixed
table sections (`NATURE_SECTIONS` in `commercial-rate-section.tsx`), and
`slab_method`/`revenue_recognition_method` render as fixed `ToggleGroup`
options; none of these three dynamically hide themselves when deactivated
in Settings yet. This is an honest, disclosed gap rather than a silently
broken governance promise, and closing it is a UI change to those three
call sites, not a data-model change, whenever it is prioritized.

## 8. Used By

Each list's own `usedBy` string in `LIST_CONFIGS` names its real
consumer(s): Industry/Segment/Business Unit/Tax Identifier Type are all
"Used by Customer Details"; Currency is "Used by Commercial Rate and
future Revenue"; Pricing Unit and Invoice Frequency are "Used by
Commercial Rate"; each System Rule names the specific Commercial Rate
mechanism it governs. This is a static, hand-maintained label, not a
computed dependency graph: it exists to answer "where does this matter"
at a glance, not to replace a real impact-analysis tool.
