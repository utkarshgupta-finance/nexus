# Nexus Engineering Way of Working

Two things live here: the permanent automated-test rule every future code
change follows, and the lessons this project actually learned from
executing 796 journeys across 33 batches. Companion to `docs/
NEXUS_CHANGE_GOVERNANCE.md` (the change lifecycle this rule plugs into)
and `docs/NEXUS_REGRESSION_PROGRAM.md` (what runs when).

Written: 2026-10-02.

---

## 1. The automated-test rule

Every product code change answers one question:

**What automated protection proves this logic?**

For every code change, one of two things is recorded, in the Change Set
(`docs/changes/CHANGE_SET_TEMPLATE.md`):

**ADD / UPDATE TEST** — naming the test file and what it now proves.

**or, explicitly:**

```
NO AUTOMATED TEST APPROPRIATE
Reason:
```

"Existing tests pass" is never sufficient on its own if new logic was
introduced without its own coverage. A green suite proves nothing broke
that was already tested; it says nothing about whether the new logic is
correct.

### Test hierarchy (complementary, not substitutable)

- **UNIT** — small, deterministic business logic (a pure function, a
  validation rule, a single RPC's decision logic in isolation).
- **INTEGRATION** — multiple application components, the database, or an
  RPC interacting together (a Server Action calling a real RPC against a
  test database, a multi-step service flow).
- **REGRESSION** — a specific historical defect must never recur. Every
  defect this programme found and fixed (`docs/
  NEXUS_FINAL_PROGRAM_AUDIT.md` section 5's full trace) has one of these;
  a new Change Set that touches the same code path inherits the
  obligation to keep it green, not to re-litigate whether it's still
  needed.
- **JOURNEY** — real business behaviour working end-to-end, Manual UX
  and Server/DB evidence together, per `docs/NEXUS_JOURNEY_UNIVERSE.md`'s
  own format.

**Unit tests do not replace journey evidence.** A passing unit test on
`deriveLineItemGoLiveStatus` does not prove the Entitlement page actually
renders the right label (this exact gap is why I-037 required a genuine,
if code-inspection-based, journey-level check, not just a function test).

**Journey tests do not replace unit tests.** A journey's PASS proves one
walked-through scenario works; it does not exercise every input
combination a unit test would, and it is far more expensive to rerun. Use
unit tests for the combinatorial cases, journeys for the real end-to-end
guarantee.

---

## 2. Lessons from the baseline journey programme

Derived from this project's own history, not generic software-engineering
advice. Each lesson states what actually happened and the permanent rule
it produced.

### UI evidence cannot substitute for server authorization
**What happened**: Pack AB's entire premise, and defects like
DEFECT-B7-002 (any `customer.create` holder could edit another maker's
draft, with no UI control exposing this), proved repeatedly that a
missing button is not the same claim as a denied request. V-030, V-031,
and AB-035 each independently proved the server re-derives permission
fresh on every call, never trusting what the client last rendered.
**Rule**: every authorization claim requires its own server-side
evidence (a network response, a DB state check), never inferred from "the
UI didn't show a control for it."

### Server evidence cannot substitute for Manual UX
**What happened**: journeys marked SOURCE INSPECTED or SERVER/RPC
VERIFIED (Q-015, S-006, and others) were explicitly never silently
promoted to a full PASS claiming UX evidence; each was later, deliberately
upgraded to genuine MANUAL UX VERIFIED with its own live browser
transcript before being trusted as complete.
**Rule**: a server-only proof is labeled exactly what it is; it earns
full PASS only when live UX evidence is added, not by assumption that the
server proof implies the UI must be fine.

### Stale browser state matters
**What happened**: the entire PERMISSION-CHANGE scenario family (Pack AB,
scenarios 1-14+, including V-030/V-031/AB-035) exists because a
previously-rendered, now-stale page can mislead a user about their
current authority.
**Rule**: any permission-sensitive UI is assumed potentially stale; the
server independently re-checks at action time, every time, regardless of
what the client believes.

### Scoped authorization must be explicit
**What happened**: PD-005 built an explicit 4-tier scoping model
(Global/BU/Territory/Customer) for 5 named domains. Go Live was
deliberately left out of that scope at the time, a decision later
surfaced again as DF-009 during the Release Readiness Review.
**Rule**: when a new domain or feature touches an access boundary,
explicitly decide and document its scoping model; do not let it default
silently to "whoever holds the blanket permission sees everything."

### Maker-checker must be enforced server-side
**What happened**: DEFECT-B7-001 showed a raw RPC could bypass the UI's
own completeness/duplicate checks entirely. PG-035 (Reference Master has
no maker-checker at all) was then handled correctly: an explicit,
documented accept-as-is decision, not an accidental gap discovered later.
**Rule**: maker-checker guarantees live at the RPC layer and are verified
by direct RPC bypass attempts, not assumed from the UI's own flow; where a
domain deliberately has none, that absence is a recorded decision.

### Same-actor/retry/idempotency semantics need explicit definition
**What happened**: AB-039/AB-043/PG-036's "losing racer" question (silent
idempotent success vs. explicit error) and W-001 through W-007's
double-submit/double-approve testing both required an explicit Product
Decision, because the default emergent behaviour was inconsistent across
domains until decided.
**Rule**: for every mutating action, explicitly decide what a retry,
duplicate, or concurrent-loser experience should be; do not leave it as
an accident of implementation order.

### Historical data must remain readable after configuration changes
**What happened**: V-037 (Reference Master deactivation doesn't break
historical customer records), V-038/PG-058 (frozen actor-identity
snapshot so a later rename doesn't rewrite history), V-033/PG-057 (Go
Live locks the Commercial Version actually referenced at creation, not
whatever is current later).
**Rule**: whenever a referenced master-data value can change or
deactivate, explicitly decide whether historical references freeze
(snapshot) or stay live-resolved, and prove both the common case and the
edge case (the referenced thing changing after the fact).

### Workflow version binding matters
**What happened**: V-034 tested a new workflow version publishing while a
V1-bound request was in flight. Y-020 later found that `is_active = true`
on a workflow definition is necessary but not sufficient to explain which
version a brand-new case actually binds to; the real selection rule was
not fully identified within that batch's time budget.
**Rule**: workflow-version-to-request binding must be deterministic and
documented; never assume "the active one" is self-explanatory without
confirming the actual selection rule.

### Effective dating needs explicit rules
**What happened**: PD-006's four-phase saga (backdating exemption,
overlap guard, adjacent-date guard, non-recurring-recognition honesty)
and PD-002's backdating sanity boundary both show that "whatever the
database allows" is not an acceptable default for a date-effective
business record.
**Rule**: any date-effective record needs explicit decisions for
backdating, overlap, and adjacency before assuming current behaviour is
correct; test the boundary, not just the common case.

### Product Decisions must be resolved before testing can truthfully continue
**What happened**: journeys marked PRODUCT DECISION REQUIRED (A-034/
PD-002, D-022/PD-005, S-014/PD-008, and 13 others) genuinely blocked a
truthful PASS/FAIL claim until Utkarsh decided; guessing an answer to
keep testing moving was never an acceptable substitute.
**Rule**: when a journey surfaces a genuine ambiguity, not a bug, stop
and get an explicit decision; do not assume an answer so progress can
continue.

### Failure history must be preserved
**What happened**: every defect this programme found is recorded as
FAILED THEN FIXED + PASS, both halves visible, never silently overwritten
to a clean PASS once fixed.
**Rule**: carried forward unchanged into the Change Set system (section
3 of `docs/NEXUS_CHANGE_GOVERNANCE.md`): historical evidence is never
rewritten, regardless of how the product later changes.

### Direct DB/RPC mutation needs fixture safety gates
**What happened**: INC-001 (the Z-027 incident, Batch 30) is the one real
test-process safety failure in the entire programme, and it directly
produced the Test Fixture Safety Protocol now codified in `CLAUDE.md` and
`docs/TEST_FIXTURE_REGISTER.md`.
**Rule**: already codified; carried forward explicitly into every future
Change Set's own testing, including the Golden Journeys pack
(`docs/NEXUS_GOLDEN_JOURNEYS.md`'s own mutation/cleanup columns).

### Scale claims require actual cardinality
**What happened**: Pack Y's entire discipline, culminating in Batch 33's
explicit instruction never to say "large" or "many" without a number;
every PARTIAL classification in that pack states the exact tested count
against the exact canonical target.
**Rule**: carried forward permanently; any future scale-related claim,
in a Change Set's scalability gate or anywhere else, discloses actual
cardinality, never a vague word.

### Correctness and performance are separate
**What happened**: repeatedly distinguished throughout the final audit
and release review (e.g. "100+ components not tested" vs. "component
correctness failed" are different claims about Y-002).
**Rule**: never let an unreached scale target be miscast as a correctness
failure, and never let a genuine correctness failure hide behind "it's
just a scale issue."

### Cross-reference evidence must not hide untested canonical assertions
**What happened**: A-011's PASS rested on borrowed, out-of-batch
evidence, honestly disclosed as such. The Batch 5 N-031/O-011/O-013
self-contradiction (one passage claims closure, a same-day addendum
contradicts it) and the PG-005/M-025 citation chain (A-027 → J-011 →
M-025, each citing the last rather than independently re-checking) both
show that reused evidence can go stale silently if never independently
re-confirmed.
**Rule**: when citing prior evidence instead of re-testing, state
explicitly what is being reused and confirm it still applies; a citation
chain that is never itself independently re-checked is a known failure
mode in this project's own history, not a hypothetical risk.

### Expected behaviour must be explicit before calling something a defect
**What happened**: the EXPECTED BEHAVIOUR classification exists precisely
because intentional design (U-002's lack of client-side rate limiting,
O-005's structural single-session limitation, N-013's accepted
self-grant) could otherwise be miscast as a bug.
**Rule**: before classifying something PRODUCT GAP CONFIRMED, check
whether it is already-decided intended behaviour (search `docs/
AUTHORIZATION_MODEL.md` and similar architecture docs first).

### Journey Discovery is required after fixes
**What happened**: every batch's own protocol embedded a mandatory
Journey Discovery check after each journey and after every fix; this is
how several of the programme's own new journeys (T-025, AB-043, A-036)
were found in the first place.
**Rule**: carried forward explicitly into the Change Set lifecycle
(`docs/NEXUS_CHANGE_GOVERNANCE.md` section 2): Journey Discovery runs
again after implementation, not just before.

### Test tooling limitations must remain visible
**What happened**: PARTIAL / TOOLING LIMITATION exists as its own honest,
permanent classification, specifically to avoid a tooling gap being
silently converted into a false PASS; J-026's true-concurrency dimension
is the clearest surviving example.
**Rule**: carried forward; a tooling limitation is disclosed with its
exact missing dimension, never smoothed over.

### Documentation reconciliation needs periodic, deliberate passes
**What happened**: the Final Program Audit found five separate stale-
documentation inconsistencies that accumulated silently across 33
batches despite good-faith maintenance throughout (a miscounted Section
C, two stale Tech Debt entries, a stale revalidation paragraph, stale
"still open" Product Decision rows).
**Rule**: ad hoc reconciliation is not sufficient on its own; `docs/
NEXUS_REGRESSION_PROGRAM.md`'s own quarterly trigger exists specifically
to catch this class of drift before it accumulates across another 30+
batches or Change Sets.

### Mechanical counting beats prose summaries
**What happened**: every aggregate-number discrepancy this project ever
found (785 vs. 796, "9-10" vs. the mechanically-counted 14, "26/26" vs.
the actual 24) was caught by direct mechanical enumeration (grep,
exhaustive ID walks), never by re-reading prose more carefully.
**Rule**: any aggregate number in permanent documentation (a journey
count, a Product Gap count, a test count) must be mechanically
regenerable wherever feasible, not hand-maintained prose carried forward
by assumption.
