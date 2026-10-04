# CHG-XXX — Title

Copy this file to `docs/changes/CHG-XXX_<short_name>.md`, replacing
`XXX` with the next sequential ID from `docs/
NEXUS_JOURNEY_CHANGE_INDEX.md`'s header, and `<short_name>` with a short
kebab-case slug. Fill in every section; do not delete a section merely
because it feels inapplicable, write "N/A" and the one-line reason
instead, so a reader knows it was considered, not skipped.

Full field definitions and rules live in `docs/
NEXUS_CHANGE_GOVERNANCE.md`; this file is the record, not the rulebook.

---

## Why

<The business or technical reason this change exists.>

## Current Behaviour

<What Nexus does today, precisely enough that "before" is unambiguous.>

## Intended Behaviour

<What Nexus should do after this change.>

## Scope

<Exactly what this Change Set covers.>

## Out of Scope

<What it deliberately does not cover, so a reader doesn't assume
something adjacent was also handled.>

## Product Decision

<If this Change Set required a Product Decision, record the question,
the decision, and who decided. If none was required, write "N/A, no
ambiguity requiring a decision.">

## Journey Impact Before Build

Searched `docs/NEXUS_JOURNEY_UNIVERSE.md` and `docs/
NEXUS_JOURNEY_CHANGE_INDEX.md` before implementation, per `docs/
NEXUS_CHANGE_GOVERNANCE.md` section 2.

### Unchanged
<Journeys whose behaviour this change must not affect.>

### Updated
<Journeys moving to UPDATED: same objective/invariant, different
steps/UI/implementation.>

### Superseded
<Journeys moving to SUPERSEDED: the business behaviour itself changed.>

### Retired
<Journeys moving to RETIRED: functionality removed.>

### Potential New Journeys
<Anticipated before build; confirmed or revised after Journey Discovery,
below.>

## Architecture / Data Impact

<Database objects, RPCs, migrations, architectural patterns touched. Note
in the same task per `CLAUDE.md`'s own structural-change documentation
rule if this rises to that level.>

## Permission Impact

<Permissions/security boundaries affected, including "none" stated
explicitly if true.>

## Scalability Impact

Per `docs/NEXUS_CHANGE_GOVERNANCE.md` section 11:

```
Data growth:
Query growth:
N+1 risk:
Pagination:
Index impact:
RPC complexity:
Transaction/lock impact:
Workflow-depth impact:
Team-size impact:
Document-volume impact:
Audit-history impact:
Client rendering volume:
```

Classification: NO MATERIAL SCALE IMPACT / SCALE IMPACT REVIEWED /
LOAD-PERFORMANCE TEST REQUIRED / PRODUCTION MONITORING REQUIRED

## Implementation

<What was actually built, with file/commit references.>

## Automated Tests

Per `docs/NEXUS_ENGINEERING_WAY_OF_WORKING.md` section 1:

```
ADD / UPDATE TEST: <file, what it proves>
```
or
```
NO AUTOMATED TEST APPROPRIATE
Reason:
```

## Journey Regression

Per `docs/NEXUS_CHANGE_GOVERNANCE.md` section 5:

```
Affected journeys:
Tier A journeys triggered:
Adjacent journeys:
Historical regression journeys:
```

Each classified MANDATORY BEFORE MERGE / RECOMMENDED / CAN DEFER WITH
DOCUMENTED RESIDUAL. Any `REGRESSION PENDING` entries:

```
REGRESSION PENDING
Journey:
Reason:
Risk:
Required before:
Owner type:
```

## Manual UX

<What was actually run by hand, with the result. If a UI/UX change,
confirm the gate in `docs/NEXUS_CHANGE_GOVERNANCE.md` section 10 was
applied.>

## Journey Discovery After Build

<Re-run per `docs/NEXUS_CHANGE_GOVERNANCE.md` section 2's post-
implementation requirement. NONE or CANDIDATE FOUND with disposition.>

## Product Gaps / Defects

<Anything found during this Change Set; register in `docs/
OPEN_PRODUCT_GAPS.md` if confirmed, per that document's own Immediate-
Closure Protocol.>

## Before vs After

```
BEFORE:
AFTER:
UNCHANGED:

Existing journeys unchanged:
Existing journeys updated:
Existing journeys superseded:
New journeys:
Retired journeys:

Before test count:
After test count:
Tests added:
Tests changed:
```

Include visual/manual comparison evidence where the change is material
per the UI/UX gate; skip for trivial changes.

## Residual Risk

<Anything left open and why it's acceptable, in the same register-not-
fixed style this project's whole Product Gap discipline uses.>

## Documentation Updated

<List every doc file touched: Journey Universe, architecture docs,
Tech Debt, Open Product Gaps, Journey Change Index, this Change Set
record itself.>

## Final Classification

CHANGE SET CLOSED, or CHANGE SET PARTIAL with the specific open item and
owner type named, per `docs/NEXUS_CHANGE_GOVERNANCE.md` section 8.

## Git / Release Reference

<Commit SHA(s), branch, and which baseline (if any) this Change Set rolls
into.>
