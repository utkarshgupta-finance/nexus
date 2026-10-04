# Nexus Change Governance

Permanent operating model for how Nexus evolves from Baseline V1 onward.
Companion to `docs/NEXUS_REGRESSION_PROGRAM.md` (what to test, when),
`docs/NEXUS_ENGINEERING_WAY_OF_WORKING.md` (the automated-test rule and
lessons from the baseline programme), `docs/NEXUS_JOURNEY_CHANGE_INDEX.md`
(journey state tracking), `docs/NEXUS_GOLDEN_JOURNEYS.md` (manual
confidence pack), and `docs/changes/CHANGE_SET_TEMPLATE.md` (the per-change
record). This document does not duplicate any of those; it defines the
lifecycle that ties them together.

Written: 2026-10-02. Established as of **NEXUS BASELINE V1** (see section
10).

---

## 0. Core principle

The 796-journey programme (`docs/NEXUS_JOURNEY_UNIVERSE.md`) established
what Nexus *is* as of Baseline V1. It is not a frozen specification Nexus
must match forever.

- Do **not** treat the 796 journeys as permanent product requirements.
- Do **not** rewrite historical execution evidence when the product
  intentionally changes. A PASS recorded against old behaviour stays a
  PASS against that old behaviour; it does not retroactively become a
  FAIL because the product moved on.
- Do **not** delete a journey merely because functionality changed.
- Do **not** keep testing against expected behaviour that is no longer
  what the product actually does.

Instead maintain, simultaneously, forever:

- **Historical truth** — what was true and verified at each point in
  time (the batch ledgers, unchanged).
- **Current product truth** — what Nexus does today (the Journey
  Universe's ACTIVE/UPDATED entries, plus whatever a Change Set most
  recently decided).
- **Change history** — why and when current truth diverged from
  historical truth (Change Sets, the Journey Change Index).
- **Regression coverage** — what automatically re-verifies that current
  truth stays true (`docs/NEXUS_REGRESSION_PROGRAM.md`).

The operating loop:

```
Product Change
  → Change Impact Analysis
  → Journey Impact
  → Product Decision (if required)
  → Implementation
  → Unit / integration tests
  → Targeted journey regression
  → Journey Discovery
  → Documentation reconciliation
  → New baseline (when the accumulation of changes warrants one)
```

Every section below is one stage of this loop, made concrete.

---

## 1. Change Set

The unit of work for any meaningful Nexus change. Every such change gets
exactly one Change Set, identified before implementation begins.

**ID format**: `CHG-001`, `CHG-002`, `CHG-003`, ... sequential, never
reused, never renumbered. The next available number is tracked in
`docs/NEXUS_JOURNEY_CHANGE_INDEX.md`'s own header.

**Types** (a Change Set declares exactly one; if a piece of work is
genuinely two types, it is two Change Sets):

- FEATURE
- FLOW CHANGE
- UI CHANGE
- UX CHANGE
- FUNCTIONAL CHANGE
- REMOVAL
- BUG FIX
- ARCHITECTURE CHANGE
- SECURITY CHANGE
- PERFORMANCE CHANGE
- PRODUCT DECISION IMPLEMENTATION

**What "meaningful" means**: anything that changes a user-visible
behaviour, a business rule, a permission boundary, a database object, or
an architectural pattern. A pure refactor with no behavioural change
(renaming a variable, extracting a function, reordering imports) does not
need a Change Set; if there is any doubt whether a change is "pure," it
gets one.

### Questions a Change Set must answer before implementation

1. What is changing?
2. Why?
3. What is the current behaviour?
4. What is the intended new behaviour?
5. Which domains are affected?
6. Which journeys are affected?
7. Which automated tests are affected?
8. Which permissions/security boundaries are affected?
9. Which database objects are affected?
10. What historical behaviour must remain unchanged?
11. What could break elsewhere?
12. What is the scalability impact?
13. What needs manual verification?

These map directly onto the Change Impact Analysis (section 2) and the
`docs/changes/CHANGE_SET_TEMPLATE.md` record.

---

## 2. Change Impact Analysis

Required **before** product code is modified, wherever reasonably
possible (a true emergency hotfix may compress this, but still produces
one retroactively before the Change Set is closed).

```
Change Set:
Type:
Domains affected:
Objects affected:
Permissions affected:
Database affected:
UI affected:
Existing journeys affected:
Potential new journeys:
Tier A journeys affected:
Automated tests affected:
Historical compatibility:
Data migration:
Scalability impact:
Manual UX required:
Risk level:
```

**Journeys affected must be identified by searching the Journey
Universe before coding**, not reconstructed afterward from memory. Use
`grep`/search over `docs/NEXUS_JOURNEY_UNIVERSE.md` for the domain,
object, and permission terms involved; cross-check against
`docs/NEXUS_JOURNEY_CHANGE_INDEX.md` for anything already mid-evolution.

**After implementation, run Journey Discovery again.** The same
Journey Discovery Execution Protocol `docs/NEXUS_JOURNEY_EXECUTION_PLAN.md`
already established for the baseline programme applies here: building
the feature frequently exposes an edge case, a new recovery path, or a
new permission interaction the pre-implementation search could not have
found, because it did not exist yet. Pre-implementation search finds
what the Change Set *should* touch; post-implementation Journey
Discovery finds what it actually *did* touch.

---

## 3. Journey lifecycle

A journey's evolution state is tracked in
`docs/NEXUS_JOURNEY_CHANGE_INDEX.md`, never by deleting or silently
rewriting its entry in `docs/NEXUS_JOURNEY_UNIVERSE.md`.

| State | Meaning | Used when |
|---|---|---|
| **ACTIVE** | Current expected product behaviour; this is the default state for every one of the 796 Baseline V1 journeys and stays so until a Change Set says otherwise | No change has touched this journey since its last confirmed state |
| **UPDATED** | Same business objective and invariant, but the implementation, UI, or steps changed | A Change Set altered *how* the behaviour is reached without altering *what* the behaviour guarantees |
| **SUPERSEDED** | The business behaviour itself intentionally changed; the old journey text no longer represents current expected behaviour | A Product Decision or Change Set deliberately changes what "correct" means for this scenario |
| **RETIRED** | The underlying functionality was intentionally removed | A Change Set of type REMOVAL eliminates the capability this journey tested |
| **FUTURE** | The capability is intentionally not available yet | Matches the existing Journey Universe usage (Forms Hub, MRR Recognition, and similar); a Change Set can move a journey from ACTIVE/none into FUTURE only in the rare case a shipped capability is deliberately pulled back to "not yet," which should be treated with the same care as RETIRED |
| **MERGED** | Two or more journeys genuinely became one behavioural assertion | The Change Set's Journey Impact analysis finds that what were two separate journeys now test the exact same thing through the exact same path, with no remaining distinguishing dimension |
| **SPLIT** | One journey became multiple materially distinct assertions | The Change Set's Journey Impact analysis finds a single journey now covers two or more behaviours that can fail independently of each other |

**Rule: historical evidence is never rewritten.** A journey moving to
SUPERSEDED, RETIRED, MERGED, or SPLIT keeps its original PASS/FAIL/
PARTIAL record in the batch ledger exactly as it was executed. The
Journey Change Index entry adds, it does not erase:

```
Valid through: <last Change Set / date under which the old behaviour was still current>
Superseded by Change Set: <CHG-XXX>
New canonical behaviour: <one line>
Replacement journey(s): <ID(s), or "none, functionality retired">
```

---

## 4. Update vs. new vs. supersede vs. retire

**UPDATE the existing journey** (state → UPDATED) when:
- The business objective stays the same.
- The invariant stays the same.
- Only the UI steps, wording, route, implementation, or component
  changed.

**CREATE A NEW journey** when:
- A new business behaviour appears that no existing journey's objective
  covers.
- A new permission boundary appears.
- A new lifecycle state appears (a new status a record can be in).
- A new recovery path appears.
- A new concurrency case appears.
- A new financial/commercial rule appears.
- An existing journey is found, during impact analysis or Journey
  Discovery, to actually contain two materially independent assertions
  (this also triggers a SPLIT on the original, per section 3).
- Journey Discovery finds a genuinely uncovered path the Change Set
  exposed.

**SUPERSEDE** (state → SUPERSEDED on the old journey, a new or updated
journey becomes canonical) when:
- An intentional Product Decision changes what counts as correct
  behaviour for a scenario an existing journey already covers. The old
  journey's PASS remains true for its own era; it is no longer the
  current answer.

**RETIRE** (state → RETIRED) when:
- Functionality is deliberately removed. See section 9 for the full
  removal process.

**Do not create a duplicate journey merely because the implementation
changed.** If a button becomes a dropdown but the server-side invariant
and business objective are identical, that is an UPDATE, not a new
journey, even if every UI step in the journey's text needs rewriting.

---

## 5. Targeted regression (impact-based, not exhaustive)

Do **not** rerun all 796 journeys after a change. `docs/
NEXUS_REGRESSION_PROGRAM.md` already defines Tier A/B/C and the trigger
schedule; a Change Set's own regression obligation is derived from that
program, scoped to what the Change Impact Analysis actually found
affected.

Every Change Set produces four lists:
- **Affected journeys** (from the Change Impact Analysis, section 2)
- **Tier A journeys triggered** (if the change touches any Tier A path
  per `docs/NEXUS_REGRESSION_PROGRAM.md`)
- **Adjacent journeys** (not directly changed, but sharing a mechanism,
  table, or RPC with what changed)
- **Historical regression journeys** (any journey that previously found
  and fixed a defect in the area now being touched; these are the
  highest-value regression candidates, since they are proven to catch a
  real historical failure mode)

Each journey in these lists is classified:

- **MANDATORY BEFORE MERGE**
- **RECOMMENDED**
- **CAN DEFER WITH DOCUMENTED RESIDUAL**

**Rule, not a suggestion**: any change touching authorization,
maker-checker, financial truth, commercial truth, Go Live, entitlement,
settlement, audit integrity, workflow transitions, or data integrity
**must** run its relevant Tier A / impacted journey regression before
being considered verified. This is the same release-blocker category
list `docs/NEXUS_RELEASE_READINESS_REVIEW.md` used; a Change Set touching
one of these areas is held to the same standard a release was.

For lower-risk UI/UX changes where Manual UX cannot be run immediately,
never silently call the change verified. Record instead:

```
REGRESSION PENDING

Journey:
Reason:
Risk:
Required before:
Owner type:
```

A Change Set with an open `REGRESSION PENDING` entry is not CLOSED
(section 8); it is PARTIAL until that entry is resolved or explicitly
re-classified as CAN DEFER WITH DOCUMENTED RESIDUAL by the appropriate
owner type.

---

## 6. Golden Journeys

See `docs/NEXUS_GOLDEN_JOURNEYS.md` for the full proposed pack (10-20
journeys). These exist for a different purpose than Tier A/B/C
regression: a small, fast, human-runnable set Utkarsh can execute any
time he wants direct confidence that "the basic product is working,"
independent of whether a specific Change Set's own targeted regression
has run. They are not a substitute for a Change Set's own impact-based
regression obligation in section 5.

---

## 7. Before / after comparison

Every Change Set states this explicitly, not just in prose but as
discrete fields in its record (`docs/changes/CHANGE_SET_TEMPLATE.md`):

```
BEFORE: <current behaviour>
AFTER: <new behaviour>
UNCHANGED: <important behaviour that must remain intact>

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

Where a UI/UX change is material (see section 11's gate for what counts
as material), include visual/manual comparison evidence where practical
(a screenshot pair, a short description of the before/after flow). Do
not require this for trivial changes (a copy edit, a spacing fix); use
judgment, and when in doubt, include it, since evidence is cheap and
absence-of-evidence disputes are not.

---

## 8. Change Set reconciliation

Performed at the end of every Change Set, mirroring the same discipline
the baseline programme's own batch-closure protocol used. Verify:

- [ ] Intended behaviour implemented
- [ ] Impacted journeys reconciled (every journey in the Change Impact
  Analysis's "existing journeys affected" list has a final state)
- [ ] New journeys created if required
- [ ] Superseded journeys marked correctly (Journey Change Index updated,
  old evidence untouched)
- [ ] Retired journeys preserved historically
- [ ] Automated tests updated (section 6 of
  `docs/NEXUS_ENGINEERING_WAY_OF_WORKING.md`'s rule satisfied, not just
  "existing tests pass")
- [ ] Targeted regression run (section 5 above; no open `REGRESSION
  PENDING` unless explicitly accepted)
- [ ] Journey Discovery completed (post-implementation pass, section 2)
- [ ] Product Gaps reconciled (`docs/OPEN_PRODUCT_GAPS.md` updated if
  this Change Set found or closed one)
- [ ] Product Decisions reconciled (if this Change Set required one, it
  is recorded with its decision, not left open)
- [ ] Tech Debt updated if needed (`docs/TECH_DEBT.md`)
- [ ] Documentation updated (any architecture/domain doc this change
  touches, per `CLAUDE.md`'s own "structural changes must be documented
  in the same task" rule, which this supersedes nothing about, only adds
  journey/regression bookkeeping on top of)
- [ ] Current baseline understanding updated (does this change move the
  needle toward a new Baseline version, section 10)
- [ ] No stale expected behaviour remains (nothing in the Journey
  Universe, Golden Journeys pack, or regression program still describes
  the pre-change behaviour as current)
- [ ] No historical evidence overwritten

Then the Change Set is marked exactly one of:

**CHANGE SET CLOSED** — every box above is checked, no open residual.

**CHANGE SET PARTIAL** — at least one box is open, with the specific
open item and its owner type named explicitly. A Change Set is never
silently left half-reconciled; PARTIAL is a visible, tracked state, not
an absence of a state.

---

## 9. Product removal

What happens when the instruction is "remove this":

1. Product Decision / Change Set of type REMOVAL is created, stating
   what is being removed and why.
2. Identify affected journeys (section 2's Change Impact Analysis).
3. Mark current journeys **RETIRED** or **SUPERSEDED** (RETIRED if the
   behaviour is gone with no replacement; SUPERSEDED if something else
   now covers the same business need differently).
4. Remove the functionality.
5. Add automated tests proving the removed path is no longer accessible,
   where relevant (e.g. a route returns 404/access-restricted, a
   permission no longer exists, an RPC is dropped and a regression guard
   confirms it, mirroring `scripts/verify-governed-rpc-grants.ts`'s own
   pattern for the legacy-RPC removal precedent, PG-038).
6. Update navigation/permissions/data behaviour that referenced the
   removed capability.
7. Regression-test adjacent flows (section 5).
8. Preserve historical evidence: the RETIRED journey's old PASS record,
   and any real historical data the removed feature produced, stay
   intact and readable.

**If removal leaves historical records, explicitly test historical
readability.** This is not optional: `docs/
NEXUS_FINAL_PROGRAM_AUDIT.md`'s own evidence base is full of precedent
for exactly this requirement (V-037's Reference Master deactivation not
breaking historical records, V-038/V-033's frozen-snapshot behaviour).
Removing a feature must not make a historical record that used it
unreadable or misleading.

---

## 10. UI / UX change gate

UI/UX changes frequently alter the user's actual journey without
changing any business logic. Before treating a UI/UX change as "just
styling," answer:

**Does this change alter:**
- navigation
- discoverability
- required actions
- labels
- forms
- validation presentation
- accessibility
- error presentation
- user understanding
- number/order of steps

**If YES**: the affected journeys' Manual UX dimension must be updated
(state → UPDATED per section 3, since the business objective/invariant
is unchanged but the steps are). The before/after comparison (section 7)
applies.

**Server/business invariants must not change merely to match a UI
redesign**, unless a Product Decision explicitly changes them. A redesign
is free to change how a thing looks or is reached; it is never free to
silently change what the server guarantees, and if it does, that is a
FUNCTIONAL CHANGE or PRODUCT DECISION IMPLEMENTATION Change Set, not a UI
CHANGE one, and gets the corresponding Product Decision and regression
obligations (section 5's mandatory-before-merge list almost always
applies in that case).

---

## 11. Scalability gate

Every Change Set answers:

```
SCALABILITY IMPACT

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

Classified as exactly one of:

- **NO MATERIAL SCALE IMPACT**
- **SCALE IMPACT REVIEWED**
- **LOAD/PERFORMANCE TEST REQUIRED**
- **PRODUCTION MONITORING REQUIRED**

Do not invent a load test for every small feature; most Change Sets will
land on NO MATERIAL SCALE IMPACT or SCALE IMPACT REVIEWED. But do not
repeat Pack Y's own history: if a feature introduces an unbounded
collection, list, or query (a new list page, a new report, a new
relationship with no natural upper bound), pagination or an explicit
scaling strategy must be considered **at design time**, the same lesson
`docs/NEXUS_ENGINEERING_WAY_OF_WORKING.md`'s lessons section draws from
DF-005/DF-008's own history. A Change Set that introduces such a
collection without considering this is not reconciled (section 8) until
it does.

---

## 12. Baseline versioning

See section 10 of this document's own numbering collides with the Change
Set lifecycle step numbers above; to avoid confusion, baseline versioning
itself is specified here as its own subsection.

The current state, as established by `docs/
NEXUS_FINAL_PROGRAM_AUDIT.md`, is **NEXUS BASELINE V1**:

```
Baseline: V1
Baseline commit: 546d470 (team-preview, at the close of the Release
  Readiness Review; f447b21 added the Production Release Runbook on top,
  documentation-only, not a product change)
Journey Universe: 796 currently-executable journeys
Automated test count: 1117 (vitest)
Active Product Gaps: 0
Open Product Decisions: 0
Known defects: 0
Deferred items: 14
Future capabilities: 9
Known PARTIAL dimensions: 31 (+2 blocked)
```

**Approved rule (2026-10-02):**

**Use V1.1, V1.2, V1.3, ...** for a meaningful, reconciled set of product
changes or a release where the product has materially evolved but the
fundamental Nexus model (its domains, workflow model, commercial model,
authorization model, architecture) is unchanged. This is the default
increment for ordinary product work: a batch of closed Change Sets, a
shipped feature, a resolved deferred item, a release to Production.

**Use V2, V3, ...** only for a meaningful redesign of core product
behaviour: a new or removed domain/module, a workflow-model change, a
commercial-model change, an authorization-model change, an architecture
change, or an accumulation of patch-level baselines that collectively
amount to a materially different product than the last major boundary.
The test is whether comparing against the prior baseline needs a clear
major boundary to stay meaningful, not whether a lot of commits
accumulated.

**Do not create a new baseline for:**
- documentation-only changes
- test-only changes
- trivial copy changes
- isolated cosmetic UI changes
- a tiny fix that does not materially alter the product baseline

Change Sets already provide granular, permanent change history (`docs/
NEXUS_JOURNEY_CHANGE_INDEX.md`); baselines are periodic reference points
on top of that history, not a record of every change. A baseline is
created when accumulated, reconciled Change Sets warrant a new reference
point, never per-commit and never for work with no product-baseline
effect.

Each baseline must allow comparison against the previous one: the same
seven-line summary above, plus a list of which Change Sets closed since
the last baseline. This is a lightweight entry appended to
`docs/NEXUS_JOURNEY_CHANGE_INDEX.md`'s own header area (see that
document), not a new file per baseline.

---

## 13. Source of truth hierarchy

Resolved against current Nexus documentation, to avoid Utkarsh (or a
future Claude session) ever having to adjudicate a conflict from
scratch:

1. **Product Decision / approved Change Set** — the most recent,
   explicitly approved decision always wins. This is deliberate human
   intent, the highest authority.
2. **Current Journey Universe** (`docs/NEXUS_JOURNEY_UNIVERSE.md`,
   reconciled via the Journey Change Index) — the canonical statement of
   current expected behaviour, as of the most recent Change Set that
   touched it.
3. **Architecture/domain specification** (`docs/ARCHITECTURE.md`,
   `docs/AUTHORIZATION_MODEL.md`, `docs/CUSTOMER_LIFECYCLE.md`, and
   similar) — the durable "how/why this is built this way" record,
   consulted when a journey's text doesn't resolve an implementation
   question.
4. **Automated test expectations** (the `vitest` suite) — what the code
   itself currently asserts; authoritative for exact mechanical behaviour,
   but subordinate to the three above when a test's assumption is found
   to be stale.
5. **Historical journey ledgers** (`docs/journey-runs/BATCH_*_RESULTS.md`)
   — proof of what happened and was verified in the past. They do **not**
   override a later intentional Product Decision; they are evidence of
   history, not a claim on the present.

When two sources disagree, resolve upward this list, and if the
resolution changes current truth, record it as a Change Set (if it's a
real product change) or a documentation correction (if it's a staleness
issue, per the same additive-correction rule `docs/
NEXUS_FINAL_PROGRAM_AUDIT.md` section 12 used).

---

## 14. Document map (avoid duplicate systems)

| Document | Purpose |
|---|---|
| `docs/NEXUS_CHANGE_GOVERNANCE.md` (this file) | The lifecycle: Change Sets, journey states, regression classification, removal, UI/UX gate, scalability gate, baseline versioning, source-of-truth hierarchy |
| `docs/NEXUS_ENGINEERING_WAY_OF_WORKING.md` | The automated-test rule (unit/integration/regression/journey hierarchy) and the lessons learned from the baseline programme |
| `docs/NEXUS_JOURNEY_CHANGE_INDEX.md` | Lightweight, machine-scannable index of which journeys have moved off ACTIVE, by which Change Set, and the baseline-to-baseline log |
| `docs/NEXUS_GOLDEN_JOURNEYS.md` | The small, human-runnable confidence pack |
| `docs/changes/CHANGE_SET_TEMPLATE.md` | The literal template every `docs/changes/CHG-XXX_<name>.md` record is built from |
| `docs/NEXUS_REGRESSION_PROGRAM.md` | What actually runs, on what cadence (Tier A/B/C); this document's section 5 only adds Change-Set-specific classification on top |
| `docs/NEXUS_JOURNEY_UNIVERSE.md` | Canonical current journey definitions (unchanged in format; evolution tracked via the Change Index, not by editing this file's history) |
| `docs/OPEN_PRODUCT_GAPS.md`, `docs/TECH_DEBT.md` | Unchanged in purpose; a Change Set reconciles against both, per section 8 |

No new document duplicates an existing one's purpose. Where this system
needed a new concept (Change Set, journey evolution state), it was given
exactly one home.
