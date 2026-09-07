# Nexus: Commercial Platform Technology Evaluation

**TECHNOLOGY EVALUATION. NO DATABASE SCHEMA YET. NO IMPLEMENTATION YET.**

**NEXUS MAY USE MULTIPLE BEST-OF-BREED COMPONENTS. NEXUS REMAINS THE SOURCE OF
BUSINESS TRUTH.**

This is the second and corrected pass of this evaluation. It locks three
additional decisions on top of the first pass: Nexus may adopt only
free/self-hostable software with no mandatory paid tier; Nexus builds its
own commercial logic first, since that logic is small and deterministic;
and library-first means studying mature OSS architecture to learn from it,
not adopting it merely to avoid writing a handful of testable rating
functions. This document evaluates external open-source commercial/
billing/metering platforms against Nexus's actual commercial patterns, to
decide, capability by capability, whether Nexus should build, adopt, adopt
behind a Nexus wrapper, or defer. It does not select one vendor winner,
does not design a database schema, and does not commit to any
implementation. No real Nexus customer, contract, or pricing figure is
used anywhere in this document; every number and scenario is generic and
fictional. Research for this document was performed against current
(September 2026) official documentation, repositories, and licensing
files for each external candidate, not third-party comparison sites,
except where explicitly noted as a secondary source.

## Permanent principle: Nexus owns the business truth

External libraries may execute specific capabilities behind Nexus-owned
adapters. No external engine becomes the source of truth for Commercial
Configuration, customer-specific commercial meaning, Finance
approvals/provenance, billing policy, reconciliation policy, FX policy,
Earned/Unbilled meaning, or canonical Nexus identity. External IDs are
integration references only; Nexus IDs and Nexus commercial state remain
canonical. If an external system disappeared tomorrow, Nexus must still be
able to answer: what the customer agreed to, which pricing rule applied,
what was approved, what the effective dates were, what should have been
earned, what should have been billed, and what reconciliation should occur.
This principle governs every recommendation below and is not reopened by
any finding in this document.

## Permanent principle: free and self-hostable only

Nexus may adopt only libraries/components that are free to self-host,
usable in production without a software licence or subscription fee, carry
no mandatory paid cloud dependency, and involve no revenue share. Every
Nexus-required capability from an adopted component must exist in that
component's free/open-source edition. Infrastructure cost is not the same
thing as software licence cost and remains allowed without limit: servers,
databases, storage, Kubernetes, and voluntarily chosen managed
infrastructure are all acceptable costs. Nexus architecture must never be
designed such that it requires a paid software feature to function. Where
a candidate's paid/managed offering is referenced anywhere in this
document, it is recorded only as an informational build-vs-operate
benchmark (§8), never as an adoption requirement, and never as a factor
that changes the free-only architecture decision.

## Permanent principle: build-first for commercial logic

Nexus's expected pricing primitives (linear per-unit, graduated tier,
volume/all-units tier, designation/dimension pricing, flat pricing,
package/block pricing later, minimum quantity/MUG) are Finance business
rules, not difficult distributed-systems infrastructure. Commercial
Configuration, the Pricing Kernel, MUG, Billing Policy, Reconciliation, FX
Policy, Earned, Unbilled, and the canonical Entitlement Ledger are
permanently Nexus-owned. External libraries are not adopted merely to
avoid writing a small set of deterministic pricing functions. Every
adoption question in this document is explicitly tested against: **are we
adding more operational complexity than code complexity saved?** If yes,
BUILD.

## Permanent principle: study OSS before rebuilding hard infrastructure

Library-first still applies, and does not mean ignoring libraries; it
means reading them. Before Nexus builds genuinely difficult infrastructure
(high-volume event ingestion, deduplication, aggregation/windowing,
replay/backfill, grants/balances, expiry/rollover), Nexus should study
mature OSS implementations such as OpenMeter and Kill Bill core (both
permissively licensed, Apache 2.0) to understand their architecture,
domain boundaries, and the failure cases they solve. The goal is not to
copy an entire billing platform; it is to read, understand, learn, and
build only the Nexus-sized version actually needed. Where code reuse from
an external project is ever considered later, licensing and notice
obligations must be reviewed explicitly first; Lago's AGPLv3-licensed
implementation specifically must never be copied into Nexus without an
explicit legal/licensing review, independent of whether Lago itself is
adopted as a running service.

## 1. Commercial Pattern Map: the domain primitives

Before comparing vendors, the ten proposed independent dimensions were
reviewed against the business patterns in scope.

| Dimension | Verdict |
|---|---|
| A. Measurement Basis | Keep as its own dimension. Users, outlets, SMS, WhatsApp messages, image-recognition usage, and future bases are all the same kind of thing: a quantity Nexus counts for a customer over a period. Architecture must treat "what is being counted" as data, never as a reason to add a new pricing engine. |
| B. Pricing Algorithm | Keep as its own dimension, orthogonal to A. Linear, graduated, volume/all-units, and flat are a small, closed set of rating functions that apply to any measurement basis. Package/block pricing is a fifth, deferred but architecturally anticipated, primitive in the same set. |
| C. Commitment / MUG Rule | Keep as its own dimension, and split explicitly into two sub-kinds that must never be conflated: a **minimum quantity commitment** (a floor on the chargeable/earned quantity itself) and a **minimum spend commitment** (a floor on the resulting money amount). Both apply as a modifier on top of a measurement basis plus a pricing algorithm, not as a pricing algorithm of their own. |
| D. Billing Cadence | Keep as its own dimension: how often an invoice is produced (monthly, quarterly, half-yearly, annual). |
| E. Billing Timing | Keep as its own dimension, independent of D: advance vs. postpaid/arrears. Cadence and timing must combine freely (monthly-advance, quarterly-arrears, annual-advance, and so on); neither is a modifier of the other. |
| F. Billing Quantity Basis | Keep as its own dimension, and treat it as a modifier that only matters when Billing Timing = advance: what quantity an advance invoice is computed against (the MUG, or the previous period's actual usage). This is a real, separate business rule, not a detail of Billing Timing. |
| G. Reconciliation Cadence / Policy | Keep as its own dimension, explicitly independent of Billing Cadence. Reconciliation is its own periodic comparison of earned vs. billed, on its own schedule, producing its own adjustment outcome (true-up or credit note candidate). |
| H. Currency / FX Policy | Keep as its own dimension, and split into three distinct monetary views that must never collapse into one: the original/transaction currency (what was actually contracted), constant-currency management conversion (Nexus's own internal FX policy for management reporting), and accounting conversion (Ind AS/statutory FX treatment). None of the three is derived by silently overwriting another. |
| I. Recurring vs. Non-recurring | Keep as its own dimension, but treat it as a modifier on a commercial component (does this component repeat every billing period, or does it fire once) rather than a fifth pricing algorithm. A one-time setup fee does not need graduated/volume tiering logic; it needs a flag plus an amount. |
| J. Workflow / Capability Scope | Keep as its own dimension, and this is the one where the domain most clearly diverges from every external candidate's assumed model. A commercial component's scope (which workflow or combination of workflows it prices) is customer-specific and effective-dated data, not a reference to a shared global Product/Plan catalog entry that must exist for every negotiated combination. |

No dimension needs to be combined, renamed, or dropped. The one addition
this review surfaces: **C must be split (quantity vs. spend commitment)
explicitly**, since every external candidate researched below treats these
as genuinely different mechanisms with different (and sometimes absent)
support.

## 2. Free-only constraint applied to each candidate

**OpenMeter.** The entire product is Apache 2.0, self-hostable, single
license tier; there is no separate paid edition gating a Nexus-required
capability. Evaluated below on this self-hosted OSS capability only.
OpenMeter Cloud/Kong Konnect managed pricing is recorded in §8 purely as an
informational benchmark, never as an adoption requirement.

**Lago.** Genuine open-core split. Minimum commitments (plan-level),
charge-level spending minimums, progressive billing, real-time wallet
balance, customer portal, RBAC/SSO, automatic dunning, tax integrations,
CRM/accounting integrations, and quotes/order forms are Premium-gated and
therefore **not usable** for Nexus adoption purposes; only the free
Community/self-hosted edition counts. AGPLv3 is additionally flagged here
as its own licensing/legal-review concern, independent of the open-core
gating, because it is a copyleft license with real implications for any
code that links against it in-process. Both factors are applied to the
revised Lago verdict in §4.

**Kill Bill.** Kill Bill core (Apache 2.0) is evaluated as the only
in-scope Kill Bill candidate. Kill Bill Aviate is a paid, commercially
licensed product and is excluded from any recommendation; it is retained
in this document only as informational evidence of what Kill Bill core
does not solve (§6).

## 3. OpenMeter verdict (final: deferred indefinitely)

**Apache License 2.0** (confirmed against the GitHub repository), fully
self-hostable as one open-source codebase; "OpenMeter Cloud" is the same
product hosted by the vendor, not a separate feature-gated premium tier
the way Lago's open-core split works, so the free-only constraint does not
by itself disqualify anything OpenMeter offers. The disqualifying factor
for adoption is different and now confirmed as a fact, not an assumption:
Nexus's actual current usage process is **manual**. Finance does not
currently receive real-time integrations for WhatsApp, SMS, users,
outlets, image-recognition usage, or any other measurement basis; usage is
looked up in an internal operational tool, exported from an internal
system, received as a spreadsheet or report, or entered manually (a
fictional example only: "Customer X, September, active users = 430," or
"Customer X, 7 September, WhatsApp messages = 18,500"). There is no
current firehose of individual raw events for Nexus to ingest, and no
demonstrated requirement for event streaming, Kafka, ClickHouse, raw
event-level ingestion, event-level deduplication, or real-time aggregation.
Building any of that infrastructure now would solve a problem Nexus does
not currently have.

**Concepts (for future reference, not for near-term adoption).** `Meter`
(a named aggregation over raw usage events), `Feature` (a named capability
a customer can be entitled to), `Plan`/`Plan Version` (a versioned, shared
product-catalog template composed of `Rate Card`s), `Subscription` (a
customer's instantiation of a Plan, or of an inline `customPlan`), and
`Entitlement` (a customer's access/balance against a Feature, of type
Metered, Boolean, or Static). Plan Version gives OpenMeter a real
effective-dating mechanism for its *catalog*, conceptually similar to
Nexus's own Form Version pattern; it does not, by itself, solve
per-customer effective-dated commercial terms outside the catalog.

**Pricing algorithms.** Rate Cards support percentage/usage-based discounts
and min/max spend commitment fields; package and graduated/volume-style
tiering are supported via the product-catalog rate-card model. OpenMeter
must not be forced to own Commercial Master or pricing/rating: its
rate-card primitives overlap with, but do not replace, Nexus's own rating
logic, and this remains true independent of the deferral below.

**Custom, non-catalog pricing.** A genuine strength worth recording for
later. A Subscription does not have to reference a shared Plan: OpenMeter
supports an inline `customPlan` at subscription-creation time, and an
existing Plan-based subscription can be given a "partial edit" that
overrides just one rate card (OpenMeter's own docs label the result a
"Custom Subscription"). This is useful architectural learning even though
OpenMeter itself is not being adopted now.

**Reconciliation.** Not present as a product concept. Invoices are
explicitly immutable once created; the only documented correction path is
voiding, not amending or crediting. There is no true-up, no credit note,
and no scheduled reconciliation mechanism in current OpenMeter docs. This
confirms reconciliation, true-ups, and Credit Note issuance must be
Nexus-owned regardless of any metering-engine decision.

**Entitlements/grants.** OpenMeter's Metered/Boolean/Static entitlement
types and Grant-based balance burn-down (expiration, priority, recurrence,
rollover, queryable balance history) are real, useful architecture to
study. They remain a plausible **future** operational consumption/grant
engine, never a replacement for Nexus's own canonical Entitlement Ledger
(§5, revised).

**Minimum quantity vs. minimum spend, previous-period-base advance
billing.** Same findings as the first pass: minimum quantity commitment
was not confirmed as a distinct concept from minimum spend; basing an
advance invoice on a previous period's actual usage was not found
supported. Both remain Nexus-owned regardless of vendor.

**Self-hosting and maturity.** Requires Kafka, ClickHouse, PostgreSQL, and
(optionally) Redis for deduplication, plus Svix for webhook delivery. Both
the Docker Compose quickstart and the published Helm chart are explicitly
described in OpenMeter's own docs as development/evaluation deployments,
not a documented production-hardened reference architecture. Official SDKs
are pre-1.0 across TypeScript (beta), Python (explicitly "in preview"),
and Go (pre-v1, with an open, unpatched security advisory at the time of
this research: GO-2026-5703, SQL injection through meter creation). This
operational and maturity cost is exactly the kind of complexity Decision 2
asks Nexus to weigh against the code complexity it would actually save,
and at Nexus's current known scale it does not clear that bar.

**Final recommendation: DEFER INDEFINITELY UNTIL A REAL METERING
REQUIREMENT EXISTS.** Not "defer pending a POC," not "defer pending a
timeline." No POC is planned, nothing is installed, and Commercial Domain
Architecture must not be made to depend on OpenMeter in any way. OpenMeter
remains a real, credible, named future candidate, not a rejected one; it
is documented here only so it does not need to be re-researched if
circumstances change. A very lightweight future `UsageSource` abstraction
(§9) is preserved specifically so an `ExternalMeteringAdapter` could be
introduced later without redefining the Usage Fact or any downstream
Finance logic, but this is not a mandatory architectural engine today and
nothing is built toward it now. OpenMeter becomes an active adoption
candidate only when one or more of the following become real, not before:
event-level usage collection across operational systems; high-volume
ingestion; real-time counters; centralized metering across multiple
operational systems; complex replay/backfill; real-time prepaid
consumption; or complex grants/expiry/rollover. The current manual usage
process does not justify any of this infrastructure, and does not justify
even designing around it beyond preserving the one lightweight seam noted
above.

## 4. Lago verdict (revised: Community-only, dropped from active shortlist)

**AGPLv3** for the self-hosted core (`getlago/lago`); companion SDK
repositories are MIT. Applying the free-only constraint strictly: minimum
commitments (plan-level), charge-level spending minimums, progressive
billing, real-time ("ongoing") wallet balance, customer portal, RBAC/SSO,
automatic dunning, tax integrations, and CRM/accounting integrations are
confirmed Premium-gated and are therefore marked **unavailable for Nexus
adoption**, not merely undesirable. The eight core charge models
(standard/per-unit, graduated, volume, package, percentage, dynamic,
custom, plus one-off add-ons) remain confirmed Community/self-hosted
available. Two items remain ambiguous from the first pass and, under the
free-only constraint, must be treated as **unavailable unless proven
otherwise**: whether credit notes are Community or Premium-gated, and
whether "plan overrides" (customer-specific pricing) are Community or
Premium.

Applying Decision 1 and Decision 2 together: once minimum commitments,
plan overrides (possibly), and credit notes (possibly) are all excluded or
uncertain under the free tier, the remaining free Community capability is
essentially the same set of pricing/subscription/wallet mechanics that
Decision 2 already assigns to the Nexus Pricing Kernel and Nexus-owned
billing policy. The free Community edition does not solve a sufficiently
hard problem for Nexus to justify adopting an AGPLv3-licensed, multi-
service Rails/Sidekiq/Postgres/Redis stack around it.

**Revised recommendation: DROP FROM ACTIVE SHORTLIST.** Not recommended
for adoption in any capacity at this time. AGPLv3 remains a standing
legal/licensing concern if Lago's implementation is ever consulted for
architectural learning; per the permanent principle above, its code must
never be copied into Nexus without explicit legal review, independent of
this adoption decision.

## 5. Kill Bill core verdict (revised: dropped from active shortlist, kept as reference)

**Apache License 2.0**, mature, actively maintained. The catalog model
(Products → Plans → Phases → Prices/Usage, with `ALL_TIER`/`TOP_TIER`
tiering) maps directly onto Nexus's own graduated vs. volume distinction
(§1B) and remains genuinely useful **architectural reading material** per
the study-OSS-first principle. Core pricing checklist (linear, graduated,
volume, flat, one-time, multi-currency, multiple billing periods) is fully
present and free.

Applying Decision 1 (free-only) and Decision 2 (build-first) together: the
capability Kill Bill core is strongest at (a complete recurring/usage
billing catalog) is precisely the capability Nexus has decided to build
itself, because it is Finance business logic, not hard infrastructure.
The capability Kill Bill core is weakest at (customer-specific, non-catalog
commercial configuration, §1J) is the one capability Nexus most needs
external help with, and core's own vendor built a separate, paid product
(Aviate, §6) specifically because the free catalog model does not solve
it. Kill Bill core's operational footprint (multi-service JVM stack, Kaui,
one OSGi plugin per integration) is also the heaviest of the researched
candidates for the value it would actually contribute now.

**Revised recommendation: DROP FROM ACTIVE SHORTLIST.** Not recommended
for adoption. Retained only as architectural reference material: its
`CONSUMABLE`/`CAPACITY` and `ALL_TIER`/`TOP_TIER` usage-billing
terminology and its documented separation of core (rating) from a
dedicated metering plugin are useful patterns to study while designing
Nexus's own Pricing Kernel and future Usage Facts model (§7), never code
or infrastructure to run.

## 6. Kill Bill Aviate verdict (excluded: paid)

Aviate is a separate, commercially-licensed layer built on top of Kill
Bill core (dynamic API-driven catalog/pricing, metering, wallets/credits,
coupons, tax, invoice sequencing, control-plane tooling). Aviate features
are explicitly marked as Premium/Aviate-only throughout Kill Bill's current
documentation, with paid tiers disclosed on Kill Bill's own pricing page
(cumulative fixed-fee tiers, plus separate flat-fee support tiers; one
referenced example figure in the tens of thousands of dollars per year at
a given ARR band). Under Decision 1, Aviate is excluded outright from any
recommendation regardless of technical fit; it is recorded here only as
informational evidence that Kill Bill's own vendor concluded the OSS
static-XML catalog needed a new, separately-licensed product to handle
ad hoc customer-specific pricing, corroborating BUILD as the right call
for Nexus's Commercial Configuration (§1J, §12A). Aviate is not evaluated
further and must not appear as an adoption candidate in any future revision
of this document unless Decision 1 itself is revisited.

## 7. Nexus Pricing Kernel verdict (primary direction, not a fallback)

**Conceptual functions**, none implemented here: `rate_linear`,
`rate_graduated`, `rate_volume`, `rate_dimension`, `rate_flat`,
`rate_package`, `apply_minimum_quantity`. Seven small, pure, deterministic
functions, each taking a quantity (or quantities, for the dimension case)
and a rate structure, returning a rated amount or an adjusted quantity.

**Conceptual complexity.** Low. Every one of these is a closed-form
calculation over a small, well-understood input shape (a quantity, a list
of tier boundaries and rates, or a flat amount). None require external
state, network calls, or a runtime component; each is testable with a
handful of table-driven unit tests covering boundary conditions (exactly at
a tier edge, zero quantity, MUG above and below actual, and so on).

**Testing burden.** Low and highly tractable. Because each function is
pure and deterministic, exhaustive boundary-condition testing is cheap and
the tests themselves become executable documentation of the exact business
rule, which is directly useful for CFO-control auditability (a reviewer can
read the test cases as the specification).

**Auditability and determinism.** This is the pricing kernel's strongest
argument. A rating function Nexus owns, versioned alongside the commercial
configuration that invoked it (the same `rule_ref`/`rule_version`
provenance pattern already designed in `docs/SUBMISSION_DATA_CONTRACT.md`
§7 for calculated values), gives an auditor a complete, self-contained,
replayable explanation of any historical amount: which function, which
version, which inputs. An external engine's black-box rating call gives the
same auditor a vendor API response to trust instead.

**Future extensibility.** Package/block pricing (§1B future primitive) and
new measurement bases both fit the same shape (a new rating function, or a
new quantity source feeding an existing rating function) without requiring
a new external product or a new integration surface.

**Confirmed conclusion: yes, we would be buying large integration
complexity merely to avoid writing six or seven relatively simple, highly
testable rating functions.** None of linear, graduated, volume,
dimension/designation, flat, or minimum-quantity-commitment logic is
genuinely hard to build correctly; all three external candidates implement
some subset of these same primitives with roughly comparable conceptual
complexity to what Nexus would write itself, and none of them solve
Nexus's two hardest, most Nexus-specific requirements (minimum quantity
commitment as distinct from minimum spend; independent-cadence
reconciliation with earned-vs-billed adjustment) at all. This is the
Pricing Kernel's decisive advantage and is why Decision 2 makes it, MUG,
Billing Policy, Reconciliation, FX Policy, Earned, and Unbilled all
permanently Nexus-owned.

**What remains genuinely difficult, and should not be attempted as a
Nexus-owned build if it ever becomes real**: high-volume event ingestion,
deduplication, usage aggregation with correct windowing, event
corrections/backfill, real-time counters, entitlement balance tracking
with grants/expiration/rollover, package/prepaid consumption drawdown,
meter replay/rebuild, and billing-run orchestration infrastructure at
scale. These remain the correct trigger list for revisiting OpenMeter
adoption (§3), not a reason to adopt anything today.

## 8. Locked architecture: Nexus self-manages usage today

The usage process Nexus actually has today is manual, not automated. The
locked architecture reflects this directly rather than assuming an
automation source that does not exist:

```
        INTERNAL / OPERATIONAL SOURCE
                     |
                     v
        manual lookup / export / file
                     |
                     v
          NEXUS USAGE CAPTURE (BUILD)
                     |
                     v
      FINANCE-GRADE USAGE FACT (BUILD)
                     |
                     v
       NEXUS PRICING KERNEL (BUILD)
                     |
                     v
                  EARNED
```

Nexus is not currently, and is not being built as, a real-time metering
platform. There is no demonstrated need for event streaming, Kafka,
ClickHouse, raw event-level ingestion, event-level deduplication,
real-time aggregation, real-time metering, or OpenMeter, and none of this
infrastructure is built now. The stable Nexus business contract this
architecture is organized around is the **Usage Fact**, not a Meter: Usage
Fact is the concept every future input method and every future automation
step must feed into unchanged (§11), whereas a Meter (OpenMeter's own
concept) is specific to one possible future metering engine and is
deliberately not elevated to a mandatory architectural concept today.

Nexus Commercial Configuration and Finance truth are identical regardless
of how a given Usage Fact was captured. Nexus separately, and always, owns
billing policy, reconciliation policy, FX policy, Earned, Unbilled,
Finance provenance, approvals, effective dating, and canonical identity.

## 9. Nexus Usage Fact (conceptual only, no schema)

The Usage Fact is the important Nexus concept: it represents the quantity
Finance actually relied upon, however it was captured. Without designing a
database schema, it should be capable of preserving concepts such as:
canonical customer; commercial component / measurement basis; usage
period; quantity; dimensions where relevant (for example, designation);
source type (manual entry, file import, internal tool lookup, or, in the
future, an external metering feed); source system/report; source
reference; captured/imported by; captured/imported at; evidence/reference
where applicable; review/confirmation provenance where required; and
correction/supersession history. A historical Finance calculation must
never silently change merely because someone later edits an upstream
report or enters a different number; a correction is itself a new,
explicit, traceable fact, never a silent overwrite of an earlier one,
consistent with the append-oriented history discipline already
established in `docs/DATA_ARCHITECTURE.md` §7 and §9. This is a concept to
carry forward into the next stage, not a table design; no column list,
type, or constraint is decided here.

### Initial input methods (anticipated, not implemented)

Architecturally anticipate, without implementing any of them now: manual
entry; CSV/Excel import; copy-previous-period-and-edit; and, later, an
internal API integration. These are all future input methods into the
same Usage Fact contract; Nexus must not create a separate Finance model
per input method. See §11 for how this stays true as automation arrives
later.

### Manual capture is a Finance control surface, not a temporary hack

Because the current process is manual, Nexus can later provide real
Finance controls around manually captured usage, recorded here as a
direction, not designed now: source/evidence; prior-period comparison;
unusual-movement flag; missing-usage flag; reviewer confirmation where
required; duplicate-period protection; correction history; and
completeness status. These are Finance controls that make manual capture
auditable and safe, the same CFO-control proportionality already applied
elsewhere in Nexus, not a stopgap to be embarrassed about or to design
around. No workflow or schema for these controls is designed in this
document.

## 10. Canonical authority model

Nexus Customer ID is canonical; any external customer/account ID (an
OpenMeter customer ID, for example, if that adapter is ever built) is an
integration reference stored alongside it, never the other way round.
Nexus workflow/capability IDs are canonical; external feature/meter/
product IDs are integration references. Nexus Commercial Configuration is
the canonical commercial truth; external engine state (a meter's current
aggregate, an entitlement's current balance) would be execution/metering/
derived operational state, valuable and necessary if ever adopted, but
never authoritative over what was actually agreed, approved, or
effective-dated. If external state ever disagrees with Nexus, Nexus must
be able to detect and reconcile the difference through its own
reconciliation policy (§1G); no external system may silently redefine the
customer's commercial terms by virtue of its own internal state diverging.

## 11. Scorecard: fit versus current adoption decision

A technology may have a capability natively and still be **DO NOT ADOPT
NOW**, because the operational cost is higher than building the
Nexus-sized requirement. The scorecard below therefore separates **FIT**
(does the capability exist at all, in the free edition) from **CURRENT
ADOPTION DECISION** (should Nexus actually use it today).

`N` = Native, `A` = Possible with adapter, `C` = Custom Nexus logic
required, `P` = Poor fit, `U` = Unknown/needs targeted check, `X` =
excluded under the free-only constraint (Premium/paid only), `-` = not
applicable to this candidate's product category.

| # | Capability | OpenMeter (OSS) FIT | Lago (Community) FIT | Kill Bill core FIT | Current adoption decision (all three) |
|---|---|---|---|---|---|
| 1 | Linear per-unit | N | N | N | BUILD (Nexus Kernel) |
| 2 | Graduated tier | N | N | N | BUILD |
| 3 | Volume/all-units tier | N | N | N | BUILD |
| 4 | Designation/dimension pricing | A | A | A | BUILD |
| 5 | Flat recurring | N | N | N | BUILD |
| 6 | Package/block | N | N | C | BUILD (future) |
| 7 | Users/outlets as quantities | N | N | N | BUILD |
| 8 | SMS/WhatsApp/image usage | N | N | A | BUILD |
| 9 | Minimum quantity / MUG | U | X (spend-only, Premium) | C | BUILD |
| 10 | Minimum spend | N (rate card) | X (Premium) | C | BUILD |
| 11 | Advance billing | N | N | N | BUILD |
| 12 | Arrears billing | N | N | N | BUILD |
| 13 | Previous-period-base advance billing | C | C | C | BUILD |
| 14 | Independent reconciliation cadence | C | C | C | BUILD |
| 15 | Positive reconciliation (additional billing) | C | C | C | BUILD |
| 16 | Negative reconciliation / Credit Note | C | U (ambiguous, possibly Premium) | C | BUILD |
| 17 | Customer-specific workflow combinations | A (customPlan/overrides) | U (overrides, possibly Premium) | C (static XML catalog) | BUILD |
| 18 | One-time charges | N | N | N | BUILD |
| 19 | Multiple transaction currencies | U | N (customer-level) | N | BUILD |
| 20 | Constant-currency management FX | - | - | - | BUILD |
| 21 | Ind AS/accounting FX | - | - | - | BUILD |
| 22 | Effective-dated commercial history | A (Plan Version, catalog-only) | C | C | BUILD |
| 23 | Entitlements (contractual) | - | - | - | BUILD (Nexus Entitlement Ledger) |
| 24 | Consumption/grant balance engine | N | A (wallets, narrower scope) | C | DEFER (OpenMeter future candidate) |
| 25 | Prepaid/package balance tracking | N (Grants) | N (Wallets) | C (plugin) | DEFER |
| 26 | High-volume meter ingestion | A (Kafka/ClickHouse) | A (ClickHouse, Cloud-scoped) | C (separate plugin) | DEFER, BUILD initially at modest volume |
| 27 | Usage aggregation | N | N | C (separate plugin) | NOT A SEPARATE ENGINE CURRENTLY; simple calculations over captured Usage Facts only |
| 28 | API/integration quality | A (pre-1.0 across SDKs) | N | A (broad but some staleness) | informational only |
| 29 | Self-hosting / free production use | N (Apache 2.0, one tier) | A (AGPLv3 core; several needed features Premium) | N (Apache 2.0, heavy) | informational only |
| 30 | Operational complexity | P (dev-only documented deploy path) | A (moderate, Rails/Sidekiq stack) | P (heaviest, JVM multi-service) | informational only, weighs against adoption |
| 31 | Nexus-owned-contract friendliness | A (behind adapter, future only) | P | P | BUILD keeps this fully Nexus-owned by construction |

Where a rating is `U`, it means the specific research performed did not
confirm the capability either way; it is not a negative signal on its own,
and it does not change any BUILD/DEFER decision above, since none of those
decisions currently depend on resolving the ambiguity.

## 12. Licensing / maturity summary (free-only lens applied)

| | OpenMeter | Lago | Kill Bill core | Kill Bill Aviate |
|---|---|---|---|---|
| License | Apache 2.0 | AGPLv3 (core); MIT (SDK repos) | Apache 2.0 | Commercial |
| Free production use of Nexus-needed capabilities | Yes, single tier | Partial; several needed capabilities (minimum commitments, possibly overrides/credit notes) are Premium-gated | Yes, but the capability Nexus needs most (customer-specific pricing) is not well served even for free | No, excluded entirely (Decision 1) |
| Software licence cost if adopted today | None | None for Community edition, but several capabilities unusable without paying | None | Sales-quoted, tiered annual fee |
| Paid-feature dependency for Nexus's actual requirements | No | Yes, for minimum commitments at minimum; possibly more | No (its actual gap is architectural, not a paywall) | Yes, entirely |
| Infrastructure footprint | Kafka, ClickHouse, PostgreSQL, Redis, Svix | PostgreSQL (+pg_partman), Redis x2, API/Worker/Clock/Front, ClickHouse for Cloud-scale (self-hosted unconfirmed) | JVM, MySQL-first, Tomcat, Kaui, one OSGi plugin per integration | Adds to core's footprint |
| Operational burden | Documented dev-only deploy paths | Moderate | Heaviest of the three | Heaviest, plus commercial support relationship |
| Business logic saved if adopted | Some (rate cards, custom subscriptions) | Some (charge models, wallets) | Most complete catalog of the three | N/A, excluded |
| Hard infrastructure saved if adopted | Real (ingestion, aggregation, entitlement balances) | Real (invoice/wallet lifecycle) | Real (usage rating, though via a separate plugin) | N/A, excluded |
| Current recommendation | DEFER, future candidate | DROP from active shortlist | DROP from active shortlist, reference only | EXCLUDE |

## 13. Capability-by-capability decisions (final)

- **Commercial Configuration: BUILD.**
- **Pricing/rating: BUILD** (Nexus Pricing Kernel, §7).
- **Minimum quantity / MUG: BUILD.**
- **Billing Policy: BUILD.**
- **Reconciliation: BUILD.**
- **FX: BUILD.**
- **Earned: BUILD.**
- **Unbilled: BUILD.**
- **Canonical Entitlement Ledger: BUILD.** This is the contractual record
  of what a customer is entitled to and why (capability, effective from/
  to, status, quantity/limit where relevant, commercial source, approval
  source, change provenance), kept explicitly separate from any future
  consumption/balance engine (below). This ledger is Nexus's own answer to
  §1J and §1C and must never depend on an external system's balance state
  to know what was contractually granted.
- **Usage Capture: BUILD.** The manual lookup/export/file/entry process
  Nexus actually has today, captured as data rather than left as an
  informal, undocumented practice.
- **Finance-grade Usage Facts: BUILD.** The Nexus Usage Fact concept (§9):
  what Finance actually relied upon, with source, provenance, and
  correction history, regardless of which input method produced it.
- **Dedicated usage aggregation engine: NOT REQUIRED NOW.** Nexus may
  perform simple calculations over captured Usage Facts when required, but
  no separate aggregation subsystem is established unless a real
  requirement emerges; do not pre-optimise for volumes that are not a
  real, current requirement.
- **High-volume event ingestion: NOT REQUIRED NOW.** No current
  requirement exists; revisit only against §19's trigger list.
- **Real-time metering: NOT REQUIRED NOW**, same basis.
- **Operational prepaid/grant consumption balances: DEFER.** OpenMeter OSS
  remains the named future candidate for this specific capability only,
  never for the contractual Entitlement Ledger itself, and only once a
  real requirement exists.
- **Invoice orchestration: DEFER.** Not needed at this stage; no
  candidate's invoice lifecycle cleanly accommodates Nexus's approval/
  provenance/effective-dating requirements without leaking vendor-specific
  concepts into what should remain a Nexus-owned contract.
- **Lago: DROP.**
- **Kill Bill: DROP**, retained only as architectural reference material.
- **Kill Bill Aviate: EXCLUDE**, paid, not evaluated further.
- **OpenMeter: DEFER INDEFINITELY UNTIL A REAL METERING REQUIREMENT
  EXISTS.** Not installed, not designed around, and Commercial Domain
  Architecture does not depend on it.

## 14. Studying OSS without over-adopting it

Per the study-OSS-first principle, before Nexus builds any of the deferred
hard-infrastructure items in §13, the engineering work at that future time
should read (not run) OpenMeter's and Kill Bill core's documented
approaches to: event identity and deduplication, aggregation/windowing,
replay/backfill, grants/balances, expiry/rollover, meter/usage-record
definitions, and correction semantics, plus both projects' API boundary
design between rating and metering (Kill Bill's explicit core-vs-metering-
plugin split is a directly useful precedent for how Nexus should draw its
own future metering boundary, if and when one is ever needed). This
reading exercise produces design
learning and pattern reuse, not a running dependency and not copied code;
any code-level reuse remains subject to the explicit legal/licensing
review already required above, with Lago's AGPLv3 implementation singled
out as never to be copied without that review.

## 15. Proposed Nexus-owned interfaces and future source abstraction (illustrative only, not designed)

The stable Nexus business contract is the **Usage Fact**, not a Meter, and
today's architecture is organized around capturing it, not around a
mandatory metering-service engine:

```
PricingEngine.rate(commercial_component, quantity, effective_date)
EntitlementLedger.getEntitlement(nexus_customer_id, capability, as_of_date)
```

`PricingEngine` and `EntitlementLedger` are always Nexus's own kernel and
ledger, never a vendor adapter, and are built now. A very lightweight
future source abstraction is conceptually preserved, not designed in
detail and not introduced as a mandatory engine today:

```
UsageSource
    |-- ManualEntry
    |-- FileImport
    |-- InternalToolAdapter
    `-- ExternalMeteringAdapter (future)
```

Every branch under `UsageSource` feeds the same Usage Fact contract; none
of them is implemented now beyond what is necessary to capture today's
manual process (§9's input methods). `EntitlementBalanceEngine`-style
interfaces for operational prepaid/grant consumption tracking remain a
named future concept (§13) but are not elevated to a required
architectural engine today either. This is the same "build two floors on
a foundation that could hold a hundred" discipline already locked in
`docs/guide/NEXUS_PRINCIPLES.md` Principle 5; it does not mean running
hundred-floor infrastructure, or even designing detailed hundred-floor
APIs, on day one. Vendor SDKs, if an adapter is ever built, are never
imported by application/feature code directly, matching the
ports-and-adapters discipline already locked in
`docs/PLATFORM_ARCHITECTURE.md` §1 and §13 for SurveyJS, Flowable, and
Temporal.

### The permanent principle this preserves

Nexus should solve the usage process that exists today while preserving a
path to automate it later. Manual today must not create a dead-end
architecture. Automation later replaces the **input method**, never the
Usage Fact or any downstream Finance logic. Concretely: today,
`ManualEntry -> Usage Fact`; later, potentially
`InternalToolAdapter -> Usage Fact`; further in the future, potentially
`ExternalMeteringAdapter -> Usage Fact`. Everything downstream of Usage
Fact (Pricing, Earned, Billing/Unbilled, Reconciliation) remains unchanged
regardless of which input method produced the fact.

## 16. Exit / failure strategy

Because adoption of any external metering/entitlement engine is deferred
indefinitely, there is currently no external engine dependency to exit.
The strategy is recorded here so it is already decided if and when
OpenMeter is ever adopted per §19's trigger list: Nexus must retain its
own canonical Usage Fact records (captured at the moment of capture,
independent of whatever a future external engine stores), its own
Entitlement Ledger recording what was granted and why (kept separate from
the engine's own balance bookkeeping), external event/entity IDs stored
only as integration references alongside Nexus's own canonical IDs (§10),
and enough recorded structure to replay/rebuild an aggregate from Nexus's
own raw facts if the external engine's own aggregation must ever be
reconstructed elsewhere. No external engine should be adopted in the
future if this reconstruction would be impossible without its database.

## 17. Paid cost benchmark (informational only)

**NOT RECOMMENDED FOR CURRENT NEXUS ARCHITECTURE. INFORMATIONAL
BUILD-VS-OPERATE BENCHMARK ONLY.** This section exists so Finance can
rationally compare a future paid managed option against self-hosting OSS
infrastructure, if that question is ever revisited; it does not change the
free-only architecture decision in §2.

| Candidate | Managed/cloud pricing | Cost unit | Public or sales contact |
|---|---|---|---|
| OpenMeter Cloud / Kong Konnect Metering & Billing | Not independently confirmed as a public price list in this research pass | Usage/seat-based, per Kong's general Konnect pricing model (not itemized here) | CONTACT SALES / NOT PUBLIC (not independently verified) |
| Lago Cloud / Premium | Sales-quoted per Lago's own pricing page | Not disclosed publicly at a fixed rate | CONTACT SALES / NOT PUBLIC |
| Kill Bill Aviate | Tiered flat annual fees (Entourage/Growth/Flock/Finance product tiers, plus separate Launch/Growth/Enterprise support tiers); one illustrative figure in the tens of thousands of dollars per year referenced at a given ARR band was found on Kill Bill's own pricing page | Flat annual fee per tier, not a percentage of revenue | Public tier structure; exact current figures should be re-confirmed directly on killbill.io/pricing at decision time |

No cost figure above is invented or estimated; where a precise, current
public number was not independently confirmed in this research pass, it is
marked accordingly rather than guessed. This table must never be used to
justify adopting a paid feature; it exists solely for a future, deliberate
build-vs-operate comparison.

## 18. Library-first verdict, restated

BUILD does not mean ignoring libraries. For Commercial, library-first
means: understand mature OSS solutions; identify the genuinely hard parts
(high-volume ingestion, aggregation, replay, grants/balances); reuse
ideas, patterns, and architectural boundaries where appropriate; keep
Nexus's own contracts independent of any vendor's object model; build the
Nexus-specific, simpler implementation first; and introduce external
infrastructure only when actual scale or complexity genuinely justifies
it. This is the intended meaning of Library-first for Nexus's commercial
platform, and it is fully consistent with, not an exception to,
`docs/guide/NEXUS_PRINCIPLES.md` Principle 1.

## 19. Remaining reasons to ever adopt OpenMeter

Recorded once, precisely, so this is not silently re-litigated later:
event-level usage collection becoming necessary across operational
systems; high-volume ingestion; a real requirement for real-time counters;
centralized metering becoming necessary across multiple operational
systems; complex replay/backfill; real-time prepaid consumption; or
complex grants/expiry/rollover behavior. The current manual usage process
does not satisfy, or need, any of these. Absent at least one of these
becoming real, OpenMeter remains deferred indefinitely, with no POC, no
installation, and no design work performed around it.

## 20. What still blocks Commercial Domain Architecture

Nothing in this document blocks proceeding to the next, separate stage
(Commercial Domain Architecture, followed only later by Commercial
Database Design). This clarification did not reveal a contradiction in the
prior evaluation; it sharpened it. Two business inputs remain open and
should inform, but do not block, that next stage: a realistic expected
volume/frequency for usage-based measurement bases (confirms how long
simple, non-dedicated calculation over captured Usage Facts remains
sufficient), and whether package/block pricing is likely to become a
near-term real requirement (affects how soon the Entitlement Ledger needs
a real consumption/balance concern of its own, even before any external
balance engine is considered). This document does not start Commercial
Domain Architecture or Commercial Database Design; those remain separate,
later stages.
