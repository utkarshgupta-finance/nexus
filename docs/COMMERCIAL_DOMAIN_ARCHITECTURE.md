# Nexus: Commercial Domain Architecture

**COMMERCIAL DOMAIN ARCHITECTURE: LOCKED.**

**NO DATABASE SCHEMA YET. NO IMPLEMENTATION YET.**

**CORRECTION NOTICE**: Finance has since corrected the quantity-MUG scope
principle (originally locked principle 6, §8). The earlier interpretation
that a quantity minimum-usage-guarantee (MUG) could span multiple
Commercial Components was wrong. A quantity MUG applies to exactly one
Commercial Component; a Component may itself cover several capabilities
priced together as one commercial line, which is how one MUG can
economically cover multiple capabilities. This does not reopen any other
locked principle, and does not affect minimum spend commitments, which
remain able to apply to one or several Components together, exactly as
before.

This is the final, locked pass of this document. All eight business
questions the prior review left open have now been answered by Finance and
are incorporated below. This document distinguishes two remaining
buckets for anything not fully settled by a business answer:

- **LOCKED DOMAIN PRINCIPLE**: supported by a confirmed business answer or
  an already-settled boundary, carried forward into database design
  without further debate.
- **PROVISIONAL DESIGN DIRECTION / DATABASE DESIGN QUESTION**: the
  business intent is settled, but the exact persistence shape,
  uniqueness rule, or mechanism is not yet decided; this is left to the
  next, separate stage (Commercial Database Design), which must keep
  every reasonable shape open rather than being forced into one by this
  document.

There is no remaining **OPEN BUSINESS DECISION** bucket in this document.
All eight questions raised in the prior review have been answered by
Finance and are incorporated as locked principles or, where the business
intent is settled but the exact mechanism is not, as provisional/database
design questions. No new business question is invented to keep an open
questions section alive.

**Database design may rely on every Locked Domain Principle below.
Database design must not prematurely hardcode a Provisional or Database
Design Question as if only one shape were possible.** Every example is
generic and fictional; no real Nexus customer, contract, or negotiated
price appears anywhere in this document. This document extends
`docs/PLATFORM_ARCHITECTURE.md`, `docs/DATA_ARCHITECTURE.md`,
`docs/SUBMISSION_DATA_CONTRACT.md`, and `docs/FORM_VERSIONING_MODEL.md`,
and builds on the locked `docs/COMMERCIAL_TECH_EVALUATION.md`, which is
not modified here; no contradiction with it was found.

## 1. Commercial domain boundary (unchanged, locked)

**[LOCKED]** The Commercial domain is responsible for: defining what
commercial terms currently apply to a customer, for which
workflows/capabilities, under what pricing, commitment, billing, and
reconciliation policy, effective when, in what transaction currency, and
on what approval evidence; capturing the usage Finance actually relied on;
translating usage plus effective commercial terms into what was earned;
determining what should be billed, whether it is currently eligible to be
invoiced, and reconciling earned against billed; and owning the canonical,
contractual record of what a customer is entitled to.

**[LOCKED]** The Commercial domain is explicitly not responsible for:
actual invoice document generation or an invoicing engine; business-process
orchestration or approval workflow mechanics (owned by generic Nexus
Request/Submission Revision/future approval infrastructure, §16); accounting
revenue recognition under Ind AS; sourcing FX rates or defining statutory
FX treatment in detail; metering infrastructure (deferred indefinitely per
the locked technology evaluation); a Wallet/prepaid-balance capability
(anticipated but not current scope, §14); Nexus Customer identity itself;
and Workflow/Capability identity itself.

## 2. Locked domain principles (final, consolidated)

1. Commercial Configuration is distinct from Commercial Component.
2. One customer may have multiple Commercial Configurations, one per
   genuinely separate coherent commercial relationship (for example,
   separate contracts, separate contracting legal entities, or separate
   geographies where those are real). Commercial Configuration is never
   hardcoded as strictly one-per-customer.
3. Pricing Rule is distinct from Measurement Definition; the same rule
   kind can rate any measurement basis.
4. Commitment/MUG is distinct from Pricing; it is a modifier applied
   around pricing, never a pricing algorithm itself.
5. A minimum quantity commitment (MUG) is always assessed monthly,
   independent of billing cadence, billing timing, and reconciliation
   cadence.
6. **[Corrected]** A minimum quantity commitment (MUG) applies to exactly
   one Commercial Component; it never spans multiple Commercial
   Components. A Commercial Component may itself cover one or several
   capabilities priced together as one commercial line, so one quantity
   MUG can economically cover multiple capabilities only when those
   capabilities belong to the same Component. A Component may have no
   quantity MUG at all. Two Components may share the same numerical rate
   and still remain separate Components if another commercial term
   differs, for example one carries a MUG and the other does not;
   numerical rate equality never merges two commercial lines into one. A
   minimum spend commitment is unaffected by this correction and may
   still apply to one Commercial Component, to multiple Commercial
   Components together, or none, exactly as previously locked.
7. Billing Calculation is distinct from Earned: "what should be invoiced"
   and "what was actually earned" are different questions, answerable at
   different times, from different inputs.
8. Invoice Eligibility is distinct from Billing Calculation: something
   fully calculated may not yet be eligible to invoice.
9. Actual Invoice Evidence is distinct from both Invoice Eligibility and
   Billing Calculation: eligibility to invoice is not the same fact as an
   invoice having actually been produced.
10. Reconciliation is distinct from Billing, and reconciliation cadence
    may differ from billing cadence.
11. A Reconciliation Adjustment preserves both an operational
    quantity/billing-basis explanation, where a quantity comparison is
    meaningful, and the monetary impact, which is the actual Finance
    outcome; a quantity is never reverse-engineered from a monetary
    difference merely to produce an explanation when effective rates
    changed within the period.
12. Positive and negative reconciliation outcomes are never netted
    together; each is its own adjustment candidate, following its own
    Finance process (additional billing, or Credit Note).
13. Usage Fact is distinct from Entitlement.
14. Usage is distinct from Earned.
15. Earned is distinct from Billed.
16. Commercial Earned is distinct from accounting revenue recognition.
17. Transaction currency is distinct from constant-currency management FX
    and from accounting FX; the original transaction-currency amount is
    never overwritten by a converted figure.
18. Historical Finance facts must not be silently overwritten; a
    correction is always a new, explicit, traceable fact, never a silent
    mutation of an earlier one.
19. An authorized Finance user may override a source usage quantity only
    with explicit, traceable provenance (reason, evidence/reference,
    actor, timestamp, approval authority where applicable); the original
    source quantity is preserved, never deleted or silently overwritten,
    and the override becomes the quantity downstream Finance calculations
    rely on only where the override is valid.
20. Customer-specific capability combinations must not require a fake
    global Plan or Product.
21. Manual usage capture must be replaceable later by another input
    method without changing downstream Finance logic.
22. All commercial edits agreed or performed as part of one commercial
    event belong to exactly one Commercial Change business event, even
    when that event affects several Commercial Components; components
    are never treated as unrelated changes merely because more than one
    was touched by the same negotiated event.
23. Generic Nexus Request/Submission Revision/future approval
    infrastructure owns request and process mechanics (draft, submission,
    revisions, process journey, approval); the Commercial domain owns the
    meaning of a Commercial Change (which commercial terms changed, its
    effective date, its business provenance, and the resulting approved
    commercial state), and never duplicates the generic Request lifecycle
    inside Commercial.
24. Package/block pricing is deferred and is not part of current
    Commercial Pricing scope; a future Wallet/prepaid-balance capability
    is anticipated as a distinct, later concept, never a required
    dependency of current Commercial architecture.

## 3. Central aggregate: Commercial Configuration (final)

**[LOCKED]** A Commercial Configuration represents one coherent
commercial arrangement or contracting relationship. It is a stable
identity that anchors the commercial components, entitlements, and
history belonging to that relationship; it does not itself carry
lifecycle status, effective dates, or pricing. "What commercial terms
currently apply under this Configuration" is answered by querying the
components effectively attached to it.

**[LOCKED]** One customer may have multiple Commercial Configurations,
conceptually:

```
Customer
   1
   to
   many
Commercial Configurations
```

Separate Configurations exist where there are genuinely separate
contracts, contracting legal entities, geographies, or other
independently negotiated commercial relationships; a single customer with
one simple relationship has exactly one Configuration, and nothing about
this principle forces artificial multiplicity where none exists.

**[DATABASE DESIGN QUESTION]** Exactly which combination of attributes
(legal entity, geography, contract reference, or something else) formally
defines what makes two Configurations for the same customer "genuinely
separate," and what database-level uniqueness (if any) should be enforced
across them, is left to Commercial Database Design. The business rule
above (multiple Configurations are possible, each representing one
coherent relationship) is locked; the exact key structure is not.

## 4. Commercial Component (final)

**[LOCKED]** A Commercial Component is the effective-dated unit that
actually carries commercial terms: a Commercial Scope, a Pricing Rule
where applicable, a Measurement Basis where usage-based, an applicable
Commitment (§8), an applicable Billing Policy, an applicable
Reconciliation Policy, and an applicable transaction currency. A component
is never silently edited once effective; a change produces a new version
through a Commercial Change (§16).

**[LOCKED]** Multiple Commercial Components may simultaneously exist for
the same capability scope (a per-user recurring charge, a separate
AMC/platform charge, and a one-time implementation charge can all be
independently true and effective for the same scope at once). No
uniqueness rule requiring at most one component per exact scope is
imposed, and none is invented merely to make commitment modeling
convenient (§8 resolves commitment scope independently of component
uniqueness).

**[LOCKED, corrected]** A Commercial Scope may contain more than one
canonical capability; this does not by itself imply more than one
Commercial Component. Whether two capabilities are represented as one
Component (one commercial line, priced and committed together) or as two
separate Components (two independent commercial lines) depends entirely
on whether they are commercially priced together under the same
applicable terms, not on how many capabilities are involved. The
Commercial Component is the priced commercial line; capabilities describe
what that line covers.

**[DATABASE DESIGN QUESTION]** Whether Commercial Component is the single
correct granularity for every kind of charge line, or whether some
future concept (for example, a commitment mechanism, §8) is better
modeled as its own attachment rather than a component in its own right, is
left open for Commercial Database Design to decide against real schema
tradeoffs.

## 5. Workflow / Capability scope (unchanged, locked)

**[LOCKED]** A Capability/Workflow Master, owned outside the Commercial
domain, is the canonical registry of what a workflow or capability *is*.
A Commercial Scope is the set of one or more capability references a
commercial unit prices together, carried as data on that unit, never as a
shared, reusable, global Plan or Product catalog entry. Adding a new
workflow to a customer's commercial arrangement is a Commercial Change,
never a silent mutation of an existing component's scope.

## 6. Pricing Rule domain (final)

**[LOCKED]** The pricing primitives: linear, graduated, volume
(all-units), dimension (rate varies by a dimension such as designation),
and flat (a fixed, non-usage-based amount). A Pricing Rule is independent
of Measurement Basis: the same rule kind can rate any measurement basis.

**[LOCKED]** For historical replay, Nexus must be able to identify exactly
which rule kind, with exactly which parameters, and which version of the
Nexus Pricing Kernel's implementation for that rule kind, produced a given
historical Earned result, so that an auditor can explain any past amount
without depending on the kernel's current behavior. No storage shape or
exact versioning mechanism is prescribed here.

**[PROVISIONAL]** Rounding policy (convention, decimal places) must be
explicit and identifiable per calculation; the exact rule is not decided.

**[LOCKED]** Package/block pricing is deferred; it is not a current
Pricing Rule primitive and is not built into the current Pricing Kernel.
Whether it eventually belongs with Pricing or with a future Wallet/
Entitlement-balance capability (§14) is deferred along with the capability
itself, not decided now.

## 7. Measurement Basis / Measurement Definition (unchanged, locked)

**[LOCKED]** Two measurement bases sharing a label are not necessarily the
same business fact ("active users" and "licensed users" are different
things even though both might be called "users"); Nexus must preserve
enough business meaning to know exactly what quantity was measured for a
given historical calculation.

**[PROVISIONAL]** The exact Measurement Definition shape (business
meaning, unit, counting rule, period basis, source expectation) is an
illustrative direction, not a locked field list.

## 8. MUG / Commitment domain (final)

**[LOCKED]** Two commitment kinds are distinct and never conflated: a
minimum quantity commitment (a floor on the chargeable/earned quantity,
applied before pricing, since it changes what quantity gets priced) and a
minimum spend commitment (a floor on the resulting money amount, applied
after pricing, since it compares an already-rated amount against a money
floor).

**[LOCKED, corrected]** A minimum quantity commitment (MUG) applies to
exactly one Commercial Component; it never spans multiple Commercial
Components. Fictional example, corrected: SFA and DMS priced together at
one common rate, with one combined monthly quantity commitment of 150
users, are represented as **one** Commercial Component with Commercial
Scope = {SFA, DMS}, not as two components with a commitment somehow
spanning both. A separate, genuinely independent SFA component may carry
its own quantity commitment, and a third component (say, a flat AMC)
may carry none; each Component's own quantity commitment, if any, applies
only to that one Component.

**[LOCKED]** A minimum spend commitment is unaffected by the correction
above and may apply to one Commercial Component, to multiple Commercial
Components together, or a component may carry no spend commitment at
all. Fictional example, unchanged in substance: a customer-level minimum
spend floor could plausibly span SFA and DMS components together, each
still billed under its own Billing Policy. No physical join structure is
designed here; only the business shape (a spend commitment applies to a
set of one or more applicable components) is locked. This is a genuinely
different business shape from quantity MUG, not a relaxed version of the
same rule; the two are never assumed to share a persistence mechanism
merely because both are called "commitment."

**[LOCKED]** A minimum quantity commitment is always assessed monthly,
independent of billing cadence, billing timing, and reconciliation
cadence. Fictional worked example: monthly MUG = 100; January actual = 90,
earned quantity = 100; February actual = 120, earned quantity = 120;
March actual = 80, earned quantity = 100. The customer may still be billed
quarterly, half-yearly, or annually; the MUG assessment itself always
happens month by month regardless. Commitment period is not made a freely
configurable dimension for the currently known MUG concept; monthly is the
locked answer. If a future, different, non-MUG commitment type is ever
introduced with a genuinely different period need, that would be
evaluated on its own terms at that time, not assumed to reopen this
answer.

## 9. Billing Policy domain (unchanged, locked)

**[LOCKED]** Three independent dimensions describe what should be
invoiced: cadence (monthly, quarterly, half-yearly, annual), timing
(advance or postpaid/arrears), and, only when timing is advance, a billing
quantity basis (a minimum commitment, the previous period's actual usage,
or a fixed amount for non-usage-based components). Every effective
Commercial Component has an applicable Billing Policy, an applicable
Reconciliation Policy, and an applicable transaction currency; how a
person configuring commercial terms conveniently defaults or inherits
these values is an authoring-convenience concern for a later stage, not
domain structure.

## 10. Reconciliation domain (final)

**[LOCKED]** Reconciliation is separate from Billing; its cadence is
independent of billing cadence. It compares Earned against Billed over its
own window.

**[LOCKED, part A: quantity and amount]** Reconciliation preserves an
operational quantity or billing-basis difference wherever a quantity
comparison is meaningful, and separately preserves the monetary
difference, which is the actual Finance outcome. Sufficient effective-rate
and commercial-period provenance is preserved to explain the monetary
amount. Nexus never manufactures a fabricated quantity by dividing a
monetary difference by a single rate when more than one rate was
effective during the period; where doing so would produce a meaningless
figure (a fictional example: a monetary adjustment that would only
resolve to a fractional "13.64 users" because different rates applied
across the period), the monetary difference stands on its own, supported
by rate/period provenance, without a forced quantity explanation.

**[LOCKED, part B: no netting]** Positive and negative reconciliation
outcomes are never netted against each other. Fictional example: an SFA
reconciliation of +50,000 and a DMS reconciliation of -20,000 for the same
customer and cycle remain two separate adjustment candidates; Nexus never
produces a single net +30,000 figure. The positive outcome is an
additional-billing candidate, intended for a subsequent invoice; the
negative outcome is a Credit Note candidate, following its own Credit Note
process. Reconciliation may therefore produce multiple adjustment
candidates within the same broader reconciliation cycle/window, not
exactly one.

**[LOCKED]** A finalized adjustment is immutable; a later correction
produces a new adjustment referencing what it corrects, never a rewrite
of a prior finalized one.

**[PROVISIONAL]** Whether comparison ever needs to span multiple
components together in a single adjustment, versus always being scoped to
one component's own earned-vs-billed comparison, is left to Commercial
Database Design to confirm against real cases as they arise; nothing above
requires cross-component comparison, and nothing above prohibits it either.

## 11. Usage Fact domain (final)

**[LOCKED]** A Usage Fact represents the quantity Finance actually relied
upon: it must preserve the customer, the measurement meaning, the period,
the quantity, the source/evidence, provenance, and correction history,
with no silent overwrite. A correction is always a new, explicit fact
referencing what it corrects; the original remains as historical
evidence.

**[LOCKED]** An authorized Finance user may override a source usage
quantity. Fictional example: source quantity = 437, Finance-approved
quantity = 442. The original source quantity is preserved, never deleted
or silently overwritten. The override must be controlled and traceable,
preserving at minimum: the original source quantity, the Finance-approved
quantity, a reason, supporting evidence/reference, the acting user, a
timestamp, and approval/authority provenance where applicable. Only
authorized Finance users may perform this override. Where the override is
valid, the Finance-approved quantity becomes the quantity downstream
Finance calculations rely upon; the original source quantity remains
visible as evidence regardless.

**[PROVISIONAL]** The exact field list, review-state model, and whether an
override is represented as a distinct sub-kind of correction or the same
mechanism as any other correction, is left to Commercial Database Design.

## 12. Entitlement domain (unchanged, locked)

**[LOCKED]** Entitlement (what the customer may use), Usage Fact (what
they did use), and Pricing (what it costs) are three distinct questions
that must never collapse into one. An Entitlement's grant, effective
period, and source reference back to the commercial arrangement that
created it are the minimum shape needed to preserve this boundary.

**[NOT DESIGNED, correctly out of scope]** Entitlement lifecycle,
suspension, disconnection, and package/prepaid balance behavior remain
real future concerns whose boundary is preserved but which are not
designed in this document.

## 13. Earned domain (unchanged, locked)

**[LOCKED]** Earned is a commercial calculation result, distinct from
accounting revenue recognition, and must be historically explainable and
replayable without depending on any system's current state (which
component version, which pricing rule and calculation version, which
usage fact(s) after any authorized override, whether and how a commitment
was applied, and in what transaction currency, all identifiable from the
result itself).

**[PROVISIONAL]** Some mechanism to distinguish "still safe to recompute"
from "already relied upon by a downstream calculation" is a locked need;
the exact state model (whether a simple two-state lifecycle or something
else) is not.

## 14. Billed / Invoice Eligibility / Actual Invoice Evidence (final)

**[LOCKED]** Three distinct concepts, in this order:

- **Billing Calculation**: what should mathematically be billed, computed
  from the relevant Billing Policy and billing quantity basis.
- **Invoice Eligibility**: whether Finance is currently permitted or ready
  to invoice a given Billing Calculation. Something may be fully
  calculated and still not yet eligible to invoice. Illustrative reasons
  only, none of them designed here: documentation pending, approval
  pending, a commercial condition pending, a go-live condition pending, a
  contractual date not yet reached, or a manual Finance hold.
- **Actual Invoice Evidence**: a minimal reference to whatever actual
  invoice document or process eventually gets created, most likely by a
  future, separate Invoicing capability.

No blocker workflow, RBAC, or exact eligibility rule is designed in this
document; only the three-way separation itself is locked.

## 15. Unbilled domain (unchanged in substance, restated)

**[LOCKED]** Nexus must be able to distinguish two materially different
reasons an amount is not yet invoiced: not yet billable, because the
usage/period/commercial trigger has not matured yet, versus economically
ready (a Billing Calculation exists) but not yet eligible to invoice or
pending actual invoice evidence (§14).

**[PROVISIONAL]** Whether this distinction is best represented as one
concept with a reason, two derived views, or something else, is left to
Commercial Database Design, to be decided once Earned/Billing/Invoice
Eligibility architecture is designed further.

## 16. Commercial Change (final)

**[LOCKED]** All commercial edits agreed or performed as part of one
commercial event belong to exactly one Commercial Change business event,
even when several Commercial Components are affected. Fictional example:
one renewal/renegotiation changes an SFA rate, a MUG, adds a DMS
component, and changes billing cadence, all together; these do not appear
as unrelated changes merely because several components were touched. The
business event carries one business reason, one effective event, grouped
edits, one provenance trail, and one approval journey; the approved result
may create or change several Commercial Components.

**[LOCKED]** Generic Nexus Request/Submission Revision/future approval
infrastructure handles the request and process mechanics (draft,
submission, revisions, process journey, and approval); the Commercial
domain never duplicates that lifecycle inside its own objects. Conceptual
flow:

```
Commercial Change Request
        |
        v
    Request
        |
        v
Submission Revision(s)
        |
        v
Approval / workflow (later capability, not designed here)
        |
        v
Approved Commercial Change
        |
        v
new effective commercial terms / Commercial Component version(s)
```

The generic Request infrastructure owns draft, submission, revisions,
process journey, and approvals; the Commercial domain owns the meaning of
the Commercial Change itself (which commercial terms changed, effective
date, business provenance, and the approved resulting commercial state).

**[DATABASE DESIGN QUESTION]** Whether a small, dedicated Commercial
Change domain record is physically required in addition to the generic
Request, purely to hold Commercial-specific meaning (which terms changed,
effective date, resulting component references), or whether that meaning
can be carried entirely within the generic Request/Submission Revision
structures without a Commercial-specific companion record, is left to
Commercial Database Design. The locked rule, regardless of that later
persistence choice, is: one instance of related commercial edits equals
one Commercial Change business event.

## 17. Effective dating (unchanged, locked)

**[LOCKED]** Commercial terms must be historically reproducible: it must
always be possible to determine, for any past date, exactly which terms
were effective and produced a given historical result.

**[PROVISIONAL]** Component-level effective dating is the expected
mechanism; exact overlap rules, whether whole-configuration snapshots also
exist for audit/convenience, and how backdated changes work physically,
are left to Commercial Database Design.

## 18. Currency domain (unchanged, locked)

**[LOCKED]** Three distinct monetary views must never collapse into one:
transaction currency (what was actually contracted, immutable, the only
currency Pricing itself operates in), constant-currency management
conversion (a derived internal-FX-policy projection), and accounting FX
conversion (a derived statutory/Ind-AS projection). Neither derived view
ever overwrites the original transaction-currency amount. Any converted
amount must carry its own provenance (rate, policy/version, rate
date/period, purpose).

## 19. Scenario tests (retained, re-checked against the final positions)

Fictional data only. All scenarios remain valid under the final, locked
positions above.

1. **Graduated per-user pricing.** Scope = one workflow, measurement =
   active users, rule = graduated (1-100 at 100/unit, 101+ at 95/unit
   incremental). Usage: 120 users. Earned = 100 x 100 + 20 x 95 = 11,900.
2. **Volume/all-units pricing.** Same shape, rule = volume. Usage: 101
   users. Earned = all 101 units at 95 = 9,595.
3. **Designation-based pricing.** Rule = dimension (Salesman = 100/unit,
   Manager = 150/unit). Usage: 400 Salesmen, 50 Managers. Earned =
   47,500.
4. **Flat AMC.** Rule = flat, 15,000/month, recurring. Earned = 15,000
   per period.
5. **Per-outlet graduated pricing.** Same rule kind as scenario 1 reused
   against active outlets, confirming rule/measurement independence.
6. **Linear per-user.** Rate = 100/unit, usage = 500. Earned = 50,000.
7. **SMS/WhatsApp usage tiering.** Two independent measurement
   definitions, each with its own rule and usage fact.
8. **Monthly MUG greater than actual usage.** MUG = 100 (monthly), actual
   = 90 in the month. Quantity floor applies before pricing: earned
   quantity = 100. The 90-unit actual usage fact remains recorded as
   evidence.
9. **One combined-rate Component with one quantity MUG (corrected).** SFA
   and DMS are priced together as one commercial line: one Commercial
   Component with Commercial Scope = {SFA, DMS}, one common per-user rate,
   and one monthly quantity commitment of 150 users; a separate component
   (a flat AMC) carries none. Actual combined usage in a given month =
   130; the quantity floor applies before pricing to this one Component:
   chargeable quantity = 150. No inter-component allocation exists or is
   needed, since SFA and DMS are capabilities within one Component, not
   two components sharing a commitment.
10. **Advance billing using prior-period actual, with later
    reconciliation.** August actual = 430 users; September's advance
    Billing Calculation uses 430. September's own Earned result is
    computed independently from September's own usage fact once known.
11. **Quarterly billing, annual reconciliation, mixed-sign outcome.** Four
    quarters each produce independent Billing Calculations and Earned
    results. Annual reconciliation compares the year's total Earned
    against total Billed for SFA (result: +50,000, an additional-billing
    candidate) and separately for DMS (result: -20,000, a Credit Note
    candidate); these remain two separate adjustment candidates, never
    netted to +30,000.
12. **Customer-specific combined workflow pricing.** Scope = {SFA, DMS}
    priced together for one fictional customer at one rate; a different
    fictional customer's scope = {SFA, Attendance} at a different rate;
    neither references a shared Plan/Product.
13. **Multiple simultaneous components for the same scope.** The same
    scope carries a recurring per-user component, a separate flat AMC
    component, and a one-time implementation component, all effective at
    once.
14. **Usage correction and Finance override, distinguished.** September
    usage initially recorded as 437 (an ordinary source correction later
    updates it to 442, a new fact referencing the original). Separately,
    in a different fictional case, a Finance user reviews a source
    quantity of 437 and, with documented reason and approval authority,
    overrides it to 442 for Finance's own calculation purposes; the
    original 437 remains visible as evidence in both cases, and the
    override case additionally preserves the reviewing actor, timestamp,
    and approval provenance.
15. **Commercial price change effective mid-year, bundled into one
    Commercial Change.** One renewal event changes the SFA rate, adds a
    new DMS component, and changes billing cadence, all effective from
    the same chosen date, all traceable to one Commercial Change; the
    prior period's terms remain immutable and unaffected.
16. **Two Commercial Configurations for one customer.** A fictional
    customer has one Commercial Configuration for its primary operating
    entity and a second, separate Commercial Configuration for a
    genuinely distinct contracting entity under the same customer
    record; each has its own independent components, commitments, and
    reconciliation history, with no shared component between them.
17. **Same numerical rate, separate Components (new, corrected).**
    Component A: Scope = {SFA}, rate = 100/unit, monthly quantity MUG =
    100. Component B: Scope = {DMS}, rate = 100/unit, no quantity MUG.
    The two components share the same numerical rate but remain distinct
    commercial lines because their commercial terms differ (MUG
    applicability); numerical rate equality never merges them into one
    Component. If SFA's actual usage in a month is 80, the quantity floor
    applies only to Component A (chargeable quantity = 100); Component
    B's earned amount is computed purely from its own actual DMS usage,
    with no MUG shortfall attributed to it.

## 20. What still requires Commercial Database Design, not further business input

Every remaining item below is a persistence/mechanism question, not a
business question; none of them require Finance to decide anything
further before Commercial Database Design can proceed:

1. Exactly which attributes define uniqueness across multiple Commercial
   Configurations for one customer (§3).
2. Whether Commercial Component is the correct granularity for every
   charge line, or whether some concepts (a commitment mechanism, for
   example) are better modeled as their own attachment (§4).
3. The exact physical shape of a minimum spend commitment's
   applicable-component set (§8; a quantity MUG's shape is now settled:
   exactly one Component, no join structure needed), the exact
   Measurement Definition field list (§7), and rounding policy mechanics
   (§6).
4. Whether cross-component reconciliation comparison is ever needed in
   practice, beyond the per-component case already fully supported (§10).
5. The exact field list and review-state model for a Usage Fact
   correction versus a Finance override (§11).
6. The exact state model distinguishing a still-open Earned result from
   one already relied upon downstream (§13).
7. The exact representation of the Unbilled distinction (one concept with
   a reason, or two derived views) (§15).
8. Whether a small, dedicated Commercial Change record is physically
   needed alongside the generic Request, or whether the generic
   Request/Submission Revision structures alone are sufficient (§16).
9. The exact mechanics of component-level effective dating (overlap
   handling, whether configuration-level snapshots also exist, backdating)
   (§17).

None of these block locking this domain architecture; they are exactly
the kind of question Commercial Database Design exists to answer against
real schema tradeoffs, not a gap in the business decisions already
captured above.

## 21. Domain map (final)

```
Customer
   |
   v
one or more Commercial Configurations
  (each: one coherent commercial relationship/contract/entity/geography)
   |
   v
Commercial Components (effective-dated; multiple components may coexist
  for the same scope)
  |-- Commercial Scope (capability references, no fake global Plan)
  |-- Measurement Definition where applicable
  |-- Pricing Rule (kind + parameters + calculation version)
  |-- Billing Policy (cadence, timing, billing quantity basis)
  `-- Reconciliation Policy

Quantity Commitment / MUG (optional; always monthly; corrected)
   |
   v
exactly one Commercial Component
  (a Component may itself cover several capabilities priced together as
  one commercial line; a Component may have no quantity MUG)

Minimum Spend Commitment (optional; unaffected by the quantity-MUG
  correction)
   |
   v
one or more applicable Commercial Components
  (one component, several components together, or none)

Usage Fact (what Finance actually relied upon)
   |
   v
Finance override, if authorized and applied
  (original source quantity always preserved as evidence)
   |
   v
Finance relied-upon usage
   +
Effective Commercial Terms
   |
   v
Commercial Earned (replayable; not accounting revenue recognition)

Billing Policy
   |
   v
Billing Calculation
   |
   v
Invoice Eligibility
   |
   v
Actual Invoice Evidence

Earned + Billed
   |
   v
Reconciliation (own cadence, own window; quantity explanation where
  meaningful, monetary impact always preserved)
   |
   v
separate Adjustment Candidates, never netted
  |-- positive: additional-billing candidate
  `-- negative: Credit Note candidate

Commercial Change Request
   |
   v
generic Request / Submission Revision(s) / future approval
   |
   v
one approved Commercial Change business event
   |
   v
one or more affected Commercial Component versions

Entitlement remains separate from Usage and Pricing (§12).
Wallet / prepaid-balance capability remains deferred (§2, item 24; §6).

Currency: transaction currency lives on Commercial Component and Earned;
constant-currency management FX and accounting FX are separate, derived,
provenanced projections, never overwriting the original.
```

## 22. What this document is not

Not a database schema. Not an implementation. Not a decision on Flowable,
approval workflow mechanics, Entitlement Ledger implementation,
Earned/Unbilled implementation, Invoicing, or Wallet. Every `[LOCKED]`
statement above is available for the next, separate stage (Commercial
Database Design) to translate into tables; every remaining
`[PROVISIONAL]`/`[DATABASE DESIGN QUESTION]` item in §20 must remain a
real, open choice in that design, not silently resolved by a schema
decision made without deliberate consideration.
`docs/COMMERCIAL_TECH_EVALUATION.md` remains locked and unchanged; no
contradiction between it and this final document was found.

**COMMERCIAL DOMAIN ARCHITECTURE: LOCKED. Ready to inform Commercial
Database Design as a separate, later stage.**
