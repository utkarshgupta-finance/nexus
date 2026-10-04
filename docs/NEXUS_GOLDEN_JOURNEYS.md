# Nexus Golden Journeys

A small, human-runnable pack Utkarsh can execute any time he wants direct
confidence that "the basic product is working" — not a compliance audit,
not a scale test, not another 796-journey programme. Companion to
`docs/NEXUS_CHANGE_GOVERNANCE.md` section 6.

**Not executed.** This document is a proposal, reviewed twice (2026-10-02
initial proposal, 2026-10-02 reconciliation correcting dependency order
and persona grounding below) against the fundamental product truths; no
Golden Journey has been run as part of producing it.

---

## 1. Review of the original 16-journey proposal

Unchanged from the first pass. The original pack (first written
2026-10-02) was reviewed against eight fundamental product truths (A-H)
and the explicit rules: prefer one connected journey over several tiny
ones, no rare edge cases, include a negative permission case, include
send-back/resubmit, include a historical/audit check, include the
Commercial → Go Live relationship, and land roughly 12-18 total.

| Original # | Journey | Assessment |
|---|---|---|
| 1 | Login/session | **KEEP** → G01 |
| 2 | Customer search/read | **KEEP** → G02 |
| 3 | Onboarding create+save | **KEEP** → G03 |
| 4 | Onboarding submit | **KEEP** → G04 |
| 5 | Checker approves Onboarding | **KEEP** → G05 |
| 6 | Customer Change create+diff | **KEEP** → G06 (self-approval moved out, see section 2's note) |
| 7 | Send-back/resubmit | **KEEP** → G07 |
| 8 | Commercial Configuration view/approve | **KEEP** → G08 (made deterministic; now also hosts the self-approval check) |
| 9 | Go Live | **KEEP** → G09 (explicitly uses G08's own resulting version; maker/checker actors corrected) |
| 10 | Permission denial | **KEEP** → G10 (made exact) |
| 11 | Workflow routing, multi-node | **REMOVE** — redundant: G05 and G07 already exercise multi-node transitions with distinct approver personas |
| 12 | History/Timeline | **KEEP** → G11 |
| 13 | Entitlement/Usage/Settlement | **KEEP** → G12 |
| 14 | Reference Master read | **REMOVE** — not one of the eight required truths; already implicitly exercised by G03's dropdown usage |
| 15 | User Access/Team Master read | **REMOVE** — not one of the eight required truths; implicitly exercised by G01/G10 |
| 16 | Self-approval blocked | **MERGE into G08** (relocated from Customer Change to Commercial Configuration during this reconciliation, see section 2's note; not removed, not a separate row) |

**Tally**: KEEP 12, REPLACE 0, MERGE 1, REMOVE 3. **Final count: 13**
(G01-G13). Golden IDs are not renumbered by execution order; the ID is a
stable label, the run sequence is defined separately in section 3.

---

## 2. The proposed pack (13 journeys)

Use only canonical TEST personas already provisioned
(`.env.nexus-test.local`, shared password across all test personas) and
disposable fixtures created fresh for the run. Never a real customer or
real user.

**Reconciliation note on G06/G08 (self-approval evidence, resolved from
live current system state, not memory):** V-044's own canonical Starting
State requires a persona who is simultaneously (a) the creator of the
request and (b) a genuinely active, eligible member of the team that
would otherwise approve it — otherwise the denial could be mistaken for
ordinary team-ineligibility rather than the self-approval rule
specifically. A direct check of current team membership found
**`nexus-test-maker` currently holds no active team membership at all**
(its prior memberships were revoked in earlier batches), so it cannot
safely demonstrate this on Customer Change; using it would conflate two
different denial reasons, exactly what the rule warns against. The one
currently-confirmed persona satisfying both conditions is
**`nexus-test-legal`**, active primary member of **WF-TEST Legal**,
holding `commercial_configuration.approve` — the exact setup
`docs/journey-runs/BATCH_28_RESULTS.md`'s own V-044 evidence already used
live (Commercial Version CC-000136). The self-approval check is therefore
hosted in **G08** (Commercial Configuration), not G06, reusing this
proven, currently-valid setup rather than fabricating a new Customer
Change persona/team arrangement with no confirmed-safe pairing. G06
itself keeps its own distinct purpose (Customer Change diff correctness)
without this sub-assertion.

**Reconciliation note on G09 (Go Live maker/checker actors, resolved from
live current system state):** the active Go Live workflow
(`WF-TEST Decision Route Finance or Legal`) routes a request to either
**WF-TEST Finance** or **WF-TEST Legal** depending on the request's own
decision branch. Confirmed current active membership and permissions:
WF-TEST Finance = `nexus-test-finance`, `nexus-test-finance-b` (both hold
`go_live.create/read/submit/approve`); WF-TEST Legal =
`nexus-test-legal`, `nexus-test-go-live-admin` (both also hold full
`go_live` permissions). No Product Decision was found granting Go Live an
exception to the blanket self-approval rule (`docs/
NEXUS_JOURNEY_UNIVERSE.md`'s V-044 entry explicitly includes Go Live in
"all four domains"), so same-actor create-and-approve is not used.
**Maker/creator: `nexus-test-go-live-admin`** (the persona already used
throughout the programme for this role, holding `go_live.create`).
**Distinct eligible approver**: if the fixture routes to WF-TEST Finance,
use `nexus-test-finance` or `nexus-test-finance-b` (both confirmed
distinct from the creator, with confirmed team membership and
permission). If it instead routes to WF-TEST Legal, `nexus-test-legal` is
on that team, but their own `go_live` permission was not independently
re-confirmed in this pass (unlike their confirmed `commercial_configuration`
permission for G08); **confirm `nexus-test-legal` holds `go_live.approve`
at run time before using them as the Legal-branch approver**, rather than
assuming it from this document.

| Golden ID | Canonical Journey ID(s) | What Utkarsh will actually do | Why it's Golden | Persona | Approx. effort | Mutation? | Fixture disposition | What to visually confirm | Server/business invariant exercised |
|---|---|---|---|---|---|---|---|---|---|
| G01 | U-001 pattern | Log in, look at the landing page, log out | If this fails, nothing else in the pack is worth running | Any canonical TEST persona | 1 min | NO | NONE | Login succeeds, lands on the expected default page, logout clears the session | Session establishment and teardown (truth A) |
| G02 | B-001 pattern | Search for a known test customer, open its detail page | Customer Master is the foundation every other domain reads from | `nexus-test-finance-admin` | 2 min | NO | NONE | Customer list loads, search finds the customer, detail page renders correct fields | Read-path correctness, `customer.read` (truth B) |
| G03 | A-001 pattern | Create a fresh Onboarding draft, save it, reopen it | Onboarding is the entry point for every new customer | `nexus-test-maker` | 3 min | YES (new draft) | RETAIN AS TEST EVIDENCE until G13 consumes it, then DISPOSABLE | Draft saves and reopens showing exactly what was entered, including a Reference Master dropdown value (Segment/Industry) rendering correctly | Draft persistence; Reference Master dropdowns feeding a real form (truth B) |
| G04 | A-011 pattern | Submit the draft from G03 (after G13 has exercised it, see section 3's order) | Submission is the moment a draft becomes a real governed request | `nexus-test-maker` (same draft) | 2 min | YES (submit) | NONE, feeds G05 | Case moves to a review state; the correct approver persona can see it waiting | Maker-side submission gate (truth D) |
| G05 | H-027/A-011 approval pattern | Approve the case from G04 | A maker-to-checker handoff completing is the single most important end-to-end guarantee in the product | The approver persona for G04's case | 2 min | YES (approval) | RETAIN AS TEST EVIDENCE, disposable test customer | Approval succeeds, the record becomes a live customer, Timeline shows the real approval event with the correct actor | Checker-side approval gate; customer creation atomicity (truth D) |
| G06 | C-009 pattern | Create a Customer Change request against an existing test customer, view its diff | Customer Change is the only path to modify approved truth | `nexus-test-maker` | 3 min | YES (new CCR) | CANCEL / CLOSE, or RETAIN if G07 continues it | Diff view correctly shows proposed vs. current values | Change-request diff correctness (truth B) |
| G07 | Y-003/send-back pattern, including multi-node transition | Send the G06 CCR back with a reason, then resubmit it and walk it to final approval through its real approval chain | Send-back/resubmit is a recurring, historically defect-prone mechanism; this is also where multi-node routing gets exercised, so a separate routing-only check is unnecessary | Maker + the relevant approver persona(s) | 5 min | YES | RETAIN AS TEST EVIDENCE, disposable fixture | Send-back reason recorded and visible; resubmit restarts from the correct node, not mid-graph; each node requires the correct team/persona; final approval completes | Send-back/resubmit correctness; `workflow_cycle_number` increment; multi-node team-based routing (truth D) |
| G08 | D-001 pattern, plus the self-approval check (V-044 pattern) | Create and submit a fresh Commercial Version amendment as `nexus-test-legal`; `nexus-test-legal` attempts to approve their own submission (must be denied); a genuinely distinct eligible approver (confirmed at run time, see note above) then completes the real approval | Commercial Configuration is where financial terms live; this is also the proven, currently-safe setting for the self-approval block, the single highest-stakes maker-checker guarantee in the product | `nexus-test-legal` (creator + self-approval attempt); a distinct confirmed approver (completion) | 5 min | YES (new Commercial Version; one denied self-approval attempt, no mutation; one real approval) | RETAIN AS TEST EVIDENCE | Components/terms render correctly; the self-approval attempt is denied with the specific `SELF_APPROVAL_NOT_ALLOWED`-class message, not a generic denial; the version is submitted through the real governed path and the distinct approver's action brings it to current/approved state | Commercial truth rendering; self-approval block (truth C, D) |
| G09 | H-001 pattern, explicitly using G08's own resulting Commercial Version | `nexus-test-go-live-admin` creates and submits a Go Live request on a disposable test customer against the exact Commercial Version approved in G08; a genuinely distinct eligible approver (per the note above) completes the approval | Go Live is the one domain with a real, durable live-billing effect; this pair is the Commercial → Go Live relationship check | `nexus-test-go-live-admin` (creator); `nexus-test-finance`/`nexus-test-finance-b` or a run-time-confirmed `nexus-test-legal` (approver) | 4 min | YES (new Go Live request, one real approval) | RETAIN AS TEST EVIDENCE | The line item transitions to Live; the Commercial Context shown matches exactly what was approved in G08, not silently updated to whatever is current later | Go Live truth; Commercial-Version-at-creation locking; maker-checker with genuinely distinct actors (truth C, E) |
| G10 | AB-001-class denial | Log in as `nexus-test-reference-master-viewer@example.test`, open Settings → Reference Master → Segment, attempt to add a new value via the real "Add value" form | Authorization denial must be a clear, server-enforced "no," not a silent failure or raw error; this exact action is zero-mutation and repeatable every run | `nexus-test-reference-master-viewer@example.test` (confirmed read-only: holds no `reference_master.write`) | 1 min | NO (denied before any write) | NONE | A clear permission-denied message is shown; the form does not submit; no new row appears in the Segment list afterward | The required negative permission case (truth A); zero DB effect confirmed |
| G11 | R-012 pattern | Open the Timeline/Activity tab for the records created in G07 and G09, run last | History/Timeline is how every other confirmation in this pack gets independently verified; running it last lets it validate events created throughout the same run | Any read persona | 2 min | NO | NONE | Timeline shows the real events from G06/G07 and G08/G09 in correct chronological order, correctly attributed to the real actors | Audit/Timeline integrity (truth F) |
| G12 | I-012 pattern | Submit usage and record a settlement on a disposable fixture | Entitlement/Usage/Settlement is the ledger of financial truth | `nexus-test-finance-admin` | 3 min | YES (submit usage, record settlement) | RETAIN AS TEST EVIDENCE | The ledger reflects the submitted usage correctly; the settlement reduces the outstanding balance by exactly the right amount | Entitlement/usage/settlement truth (truth G) |
| G13 | A representative validation-error path | Clear a required field on G03's still-editable draft, attempt to submit, observe the error, restore the field, confirm the draft is still normal (actual submission happens afterward in G04) | A basic validation/error/retry path must behave cleanly, not crash or silently fail; must run before G04/G05 since it depends on the draft still being editable | `nexus-test-maker` (same draft as G03) | 2 min | NO (the failed submit attempt does not persist; the field restoration is not a new mutation, it returns the draft to G03's own saved state) | NONE | A clear, specific validation error is shown (not a raw crash or generic 500); after restoring the field, the draft behaves normally | Basic recovery / validation-error presentation (truth H) |

**Fixture disposition legend**: NONE (no persistent fixture created),
RESTORE TO BASELINE (a toggled/changed value is reverted, e.g. Reference
Master deactivate-then-reactivate patterns elsewhere in this programme,
not used by any row above), RETAIN AS TEST EVIDENCE (a disposable,
clearly-test-named record is kept, the default for most mutating rows
since the whole programme's own practice has always been to leave
disposable test fixtures in place rather than delete them), CANCEL /
CLOSE (a draft/request is explicitly cancelled rather than carried
forward), DISPOSABLE (safe to delete outright if garbage-data rules
allow; used only for the Onboarding draft if G13's validation-error
check is run in isolation without continuing to G04).

**One connected Golden-run customer where safe**: G03's Onboarding draft
becomes G05's live customer; G06/G07's Customer Change and G12's
Entitlement/Usage/Settlement check can reuse that same customer rather
than each creating a separate one, so a full run reads as one real
customer's journey through the product rather than thirteen unrelated
fixtures. G08/G09's Commercial Version and Go Live request are their own
fixture, since Go Live requires a real commercial component the G05
customer may not yet have; reusing the G05 customer for G08/G09 is
preferred where its existing commercial setup supports a fresh version
cleanly, otherwise a second disposable customer is used and named as
such.

---

## 3. Execution order and model

**G13 depends on G03's draft still being editable and must run before
G04 submits it.** The Onboarding sequence is therefore:

```
G03 (create draft) → G13 (validation failure + correction) → G04 (submit) → G05 (approve)
```

G13 must never run after G05; by then the case is no longer an editable
draft and the same check would not exercise what it's meant to.

Golden IDs are stable labels, not run-order positions; the sequences
below reference G01-G13 by ID in the order they actually execute.

### Full Golden Run

All 13 checks, in this practical sequence:

```
G01 → G02 → G03 → G13 → G04 → G05 → G06 → G07 → G08 → G09 → G10 → G12 → G11
```

Reasoning: validation (G13) belongs before submit (G04); Customer Change
gets its complete create-through-resubmit chain (G06-G07) before moving
on; Commercial Configuration (G08) must precede Go Live (G09) since G09
consumes G08's own resulting version; the negative permission case (G10)
and financial truth (G12) run once their supporting fixtures exist;
Timeline/Activity (G11) runs last so it can validate the real events
created by every fixture-producing row before it.

Target: roughly 30-40 minutes once fixtures/personas are familiar; not
claimed more precisely than that until actually observed in a real run.

### Quick Confidence Run

**Purpose**: "I changed things recently. Does Nexus basically work?"

Seven **connected flows**, not seven isolated IDs (the original proposal's
isolated-ID selection was invalid: it included G09 without G08, which G09
depends on, and treated G03 alone as proving submission/approval, which
it does not):

```
FLOW 1 — Access:                    G01
FLOW 2 — Customer Read:             G02
FLOW 3 — Onboarding End-to-End:      G03 → G13 → G04 → G05
FLOW 4 — Commercial to Go Live:      G08 → G09
FLOW 5 — Permission Denial:          G10
FLOW 6 — Financial Truth:            G12
FLOW 7 — History / Audit:            G11 (run last)
```

Target: roughly 20-30 minutes once fixtures/personas are familiar; not
claimed more precisely than that until actually observed. G06/G07
(Customer Change, send-back/resubmit) are intentionally not part of the
Quick run; add them when the recent change specifically touched Customer
Change or workflow routing.

### Targeted Golden Run

**Purpose**: "I changed Commercial Configuration. Show me the relevant
human flows."

Change-Set-driven: not a fixed list. The Change Set's own Change Impact
Analysis (`docs/NEXUS_CHANGE_GOVERNANCE.md` section 2) names the domains
affected; map those domains to the Golden Journeys that exercise them and
run only those, respecting the dependency order above, plus G01 and G10
as a baseline sanity pair in every Targeted Run regardless of domain.

| Domain touched | Golden Journeys to run (in dependency order) |
|---|---|
| Authentication/session | G01, G10 |
| Customer Master | G01, G02, G10 |
| Customer Onboarding | G01, G03, G13, G04, G05, G10, G11 |
| Customer Change | G01, G06, G07, G10, G11 |
| Commercial Configuration | G01, G08, G10 |
| Go Live | G01, G08, G09, G10, G11 |
| Entitlement/Usage/Settlement | G01, G09, G10, G12 |
| Workflow Builder/Runtime | G01, G04, G05, G06, G07, G10 |
| Audit/Timeline | G01, G11 |
| User Access/Teams/Reference Master | G01, G02, G03, G10 (not covered by a dedicated Golden row per section 1's review; closest proxies used) |

This table is a starting point, not a substitute for reading the Change
Set's own Change Impact Analysis.

---

## 4. Golden Run report

A tiny manual result format, filled in after an actual run (none has
happened yet):

```
Golden Run:
Date:
Baseline / Change Set:
Environment:

Flow 1 Access: PASS/FAIL
Flow 2 Customer Read: PASS/FAIL
Flow 3 Onboarding: PASS/FAIL
Flow 4 Commercial -> Go Live: PASS/FAIL
Flow 5 Permission Denial: PASS/FAIL
Flow 6 Financial Truth: PASS/FAIL
Flow 7 History/Audit: PASS/FAIL

Full-only:
Customer Change / Send-back: PASS/FAIL

Unexpected observations:
Journey Discovery candidates:
Product Gap candidates:

Overall:
CONFIDENCE RUN PASS
or
CONFIDENCE RUN FAILED
```

**A user preference or UX dislike noticed during a run is not
automatically a defect.** Record it under "Unexpected observations" and
let Utkarsh decide whether it becomes a Change Set
(`docs/NEXUS_CHANGE_GOVERNANCE.md`); do not pre-classify it as a Product
Gap or failure on his behalf.

---

## 5. What this pack is not

Not a compliance audit, not a scale test, not an exhaustive regression
run, not a replacement for a Change Set's own targeted regression
obligation (`docs/NEXUS_CHANGE_GOVERNANCE.md` section 5). It is a
separate, faster instrument for a different purpose: general product
confidence a human can act on directly, in minutes, without touching the
journey-testing machinery at all.
