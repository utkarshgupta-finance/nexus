# Nexus Golden Journeys

A small, human-runnable pack Utkarsh can execute any time he wants direct
confidence that "the basic product is working" — not a compliance audit,
not a scale test, not another 796-journey programme. Companion to
`docs/NEXUS_CHANGE_GOVERNANCE.md` section 6.

**Not executed.** This document is a proposal, reviewed once against the
fundamental product truths below; no Golden Journey has been run as part
of producing it.

---

## 1. Review of the original 16-journey proposal

The original pack (first written 2026-10-02) is reviewed here against
eight fundamental product truths (A-H) and the explicit rules: prefer one
connected journey over several tiny ones, no rare edge cases, include a
negative permission case, include send-back/resubmit, include a
historical/audit check, include the Commercial → Go Live relationship,
and land roughly 12-18 total.

| Original # | Journey | Assessment |
|---|---|---|
| 1 | Login/session | **KEEP** |
| 2 | Customer search/read | **KEEP** |
| 3 | Onboarding create+save | **KEEP** |
| 4 | Onboarding submit | **KEEP** |
| 5 | Checker approves Onboarding | **KEEP** |
| 6 | Customer Change create+diff | **KEEP** (strengthened: now also hosts the self-approval check merged from #16) |
| 7 | Send-back/resubmit | **KEEP** (strengthened: now also carries the multi-node routing confirmation merged from #11) |
| 8 | Commercial Configuration view/approve | **KEEP** (explicitly cross-referenced to #9 to satisfy the Commercial → Go Live rule) |
| 9 | Go Live | **KEEP** (explicitly cross-referenced to #8; this pair is the Commercial → Go Live relationship check) |
| 10 | Permission denial | **KEEP** (the required negative case) |
| 11 | Workflow routing, multi-node | **REMOVE** — redundant: #5 and #7 already exercise multi-node transitions with distinct approver personas; keeping it separate was the "several tiny journeys" pattern the review rules warn against |
| 12 | History/Timeline | **KEEP** (the required historical/audit check) |
| 13 | Entitlement/Usage/Settlement | **KEEP** |
| 14 | Reference Master read | **REMOVE** — not one of the eight required truths; already implicitly exercised by #3's dropdown usage (Segment/Industry fields) |
| 15 | User Access/Team Master read | **REMOVE** — not one of the eight required truths; the RBAC infrastructure it would confirm is already exercised by #1 (login) and #10 (denial) |
| 16 | Self-approval blocked | **MERGE into #6/#7** — a real, important invariant, but folded into the existing Customer Change chain as an additional confirm-step rather than kept as its own row, since it reuses the exact fixture #6/#7 already create |

**Tally**: KEEP 12, REPLACE 0, MERGE 1 (folded into existing rows, not
counted as a separate final row), REMOVE 3.

**One gap found**: none of the original 16 covered fundamental truth H
(basic recovery: a representative validation/error/retry path behaving
cleanly). **Added**: G13 below, a simple, low-effort validation-error
check (submit Onboarding with a required field missing, confirm a clean
specific error, not a crash).

**Final count: 13.** Starting from 16: remove 3 (11, 14, 15) and fold 1
into an existing row (16, now part of G06/G07) leaves 12 distinct rows;
adding 1 new row for the previously-uncovered truth H gives **13 total**,
within the requested 12-18 range.

---

## 2. The proposed pack (13 journeys)

Use only canonical TEST personas already provisioned
(`.env.nexus-test.local`, shared password across all test personas per
this programme's own standing practice) and disposable fixtures created
fresh for the run. Never a real customer or real user. Run in order
listed; later rows reuse earlier rows' fixtures.

| Golden ID | Canonical Journey ID(s) | What Utkarsh will actually do | Why it's Golden | Persona | Approx. effort | Mutation? | Cleanup? | What to visually confirm | Server/business invariant exercised |
|---|---|---|---|---|---|---|---|---|---|
| G01 | U-001 pattern | Log in, look at the landing page, log out | If this fails, nothing else in the pack is worth running | Any canonical TEST persona | 1 min | NO | NO | Login succeeds, lands on the expected default page, logout clears the session | Session establishment and teardown (truth A) |
| G02 | B-001 pattern | Search for a known test customer, open its detail page | Customer Master is the foundation every other domain reads from | `nexus-test-finance-admin` | 2 min | NO | NO | Customer list loads, search finds the customer, detail page renders correct fields | Read-path correctness, `customer.read` (truth B) |
| G03 | A-001 pattern | Create a fresh Onboarding draft, save it, reopen it | Onboarding is the entry point for every new customer | `nexus-test-maker` | 3 min | YES (new draft) | YES (leave as a disposable, clearly-test-named draft) | Draft saves and reopens showing exactly what was entered, including a Reference Master dropdown value (Segment/Industry) rendering correctly | Draft persistence; Reference Master dropdowns feeding a real form (truth B) |
| G04 | A-011 pattern | Submit the draft from G03 | Submission is the moment a draft becomes a real governed request | `nexus-test-maker` (same draft) | 2 min | YES (submit) | NO, feeds G05 | Case moves to a review state; the correct approver persona can see it waiting | Maker-side submission gate (truth D) |
| G05 | H-027/A-011 approval pattern | Approve the case from G04 | A maker-to-checker handoff completing is the single most important end-to-end guarantee in the product | The approver persona for G04's case | 2 min | YES (approval) | NO, acceptable as a disposable test customer | Approval succeeds, the record becomes a live customer, Timeline shows the real approval event with the correct actor | Checker-side approval gate; customer creation atomicity (truth D) |
| G06 | C-009 pattern, plus a self-approval attempt (V-044 pattern) | Create a Customer Change request against an existing test customer, view its diff, then attempt to approve it as the same maker who created it | Customer Change is the only path to modify approved truth; self-approval must be blocked server-side, the single highest-stakes maker-checker guarantee in the product | `nexus-test-maker` | 4 min | YES (new CCR) | YES (leave as draft, or cancel) | Diff view correctly shows proposed vs. current values; the self-approval attempt is denied with a clear message, not a silent success | Change-request diff correctness; self-approval block (truth B, D) |
| G07 | Y-003/send-back pattern, including multi-node transition | Send the G06 CCR back with a reason, then resubmit it and walk it to final approval through its real approval chain | Send-back/resubmit is a recurring, historically defect-prone mechanism; this is also where multi-node routing gets exercised, so a separate routing-only check is unnecessary | Maker + the relevant approver persona(s) | 5 min | YES | NO, disposable fixture | Send-back reason is recorded and visible; resubmit restarts from the correct node, not mid-graph; each node requires the correct team/persona; final approval completes | Send-back/resubmit correctness; `workflow_cycle_number` increment; multi-node team-based routing (truth D) |
| G08 | D-001 pattern | View an existing Commercial Configuration Version, or approve a draft one if available | Commercial Configuration is where financial terms live | `nexus-test-commercial-viewer` (and an approver if approving) | 2-4 min | Optional (NO if read-only; YES if approving a draft) | NO if read-only | Components render correctly; if approving, the version transitions to current correctly | Commercial truth rendering (truth C) |
| G09 | H-001 pattern, explicitly using G08's own Commercial Version | Create and approve a Go Live request on a disposable test customer, against the exact Commercial Version viewed/approved in G08 | Go Live is the one domain with a real, durable live-billing effect; this pair is the Commercial → Go Live relationship check | `nexus-test-go-live-admin` | 3 min | YES (new Go Live request) | NO, disposable | The line item transitions to Live; the Commercial Context shown matches exactly what was true in G08 at creation time, not silently updated to whatever is current later | Go Live truth; Commercial-Version-at-creation locking (truth C, E) |
| G10 | AB-001 pattern | Attempt an action a logged-in persona does not have permission for | Authorization denial must be a clear, server-enforced "no," not a silent failure or raw error | A persona deliberately lacking the relevant permission | 1 min | NO | NO | The action is denied with a clear message; nothing changes in the underlying record | The required negative permission case (truth A) |
| G11 | R-012 pattern | Open the Timeline/Activity tab for the record created in G06/G07 or G09 | History/Timeline is how every other confirmation in this pack gets independently verified | Any read persona | 1 min | NO | NO | The Timeline shows the real events in correct chronological order, correctly attributed to the real actors from G06/G07/G09 | Audit/Timeline integrity (truth F) |
| G12 | I-012 pattern | Submit usage and record a settlement on a disposable fixture | Entitlement/Usage/Settlement is the ledger of financial truth | `nexus-test-finance-admin` | 3 min | YES (submit usage, record settlement) | NO, disposable | The ledger reflects the submitted usage correctly; the settlement reduces the outstanding balance by exactly the right amount | Entitlement/usage/settlement truth (truth G) |
| G13 | A representative validation-error path (e.g. attempt to submit G03's draft with a required field cleared) | Clear a required field on a draft, attempt to submit, observe the error, fix it, submit successfully | A basic validation/error/retry path must behave cleanly, not crash or silently fail | `nexus-test-maker` | 2 min | NO beyond G03's own fixture (no new mutation; the failed submit attempt itself does not persist) | NO | A clear, specific validation error is shown (not a raw crash or generic 500); fixing the field and resubmitting succeeds normally | Basic recovery / validation-error presentation (truth H) |

**Total new fixtures across the full pack: 3** (one Onboarding case from
G03-G05, one Customer Change request from G06-G07, one Go Live request
from G09, plus whatever Commercial draft G08 touches if one is
available). **Total approximate effort: 30-35 minutes** for all 13, run
in order so later rows reuse earlier rows' fixtures.

---

## 3. Execution model

Three ways to use this pack. **None are being run now.**

### Quick Confidence Run
**Purpose**: "I changed things recently. Does Nexus basically work?"

**~7 highest-value journeys**: G01, G03, G06, G09, G10, G11, G12.

Chosen for maximum independent signal per minute: a clean login (G01),
a full onboarding create-through-submit path (G03, which also proves the
draft layer), the Customer Change + self-approval-block pair (G06, the
single highest-stakes maker-checker check), the Commercial → Go Live
relationship (G09), the required negative permission case (G10), History/
Timeline verification (G11), and financial-truth coverage (G12). Skips
the longer multi-node send-back/resubmit walk (G07) and the approval
hand-off and validation-error rows (G04, G05, G08, G13) for speed; add
them back in if the recent change specifically touched those areas.

### Full Golden Run
**Purpose**: "I want confidence in the overall product before an
important release or demo."

All 13: G01 through G13, in order.

### Targeted Golden Run
**Purpose**: "I changed Commercial Configuration. Show me the relevant
human flows."

Change-Set-driven: not a fixed list. The Change Set's own Change Impact
Analysis (`docs/NEXUS_CHANGE_GOVERNANCE.md` section 2) names the domains
affected; map those domains to the Golden Journeys that exercise them and
run only those, plus G01 and G10 as a baseline sanity pair (session and
authorization are load-bearing for every other row, so they are included
in every Targeted Run regardless of domain).

| Domain touched | Golden Journeys to run |
|---|---|
| Authentication/session | G01, G10 |
| Customer Master | G01, G02, G10 |
| Customer Onboarding | G01, G03, G04, G05, G10, G11 |
| Customer Change | G01, G06, G07, G10, G11 |
| Commercial Configuration | G01, G08, G09, G10 |
| Go Live | G01, G08, G09, G10, G11 |
| Entitlement/Usage/Settlement | G01, G09, G10, G12 |
| Workflow Builder/Runtime | G01, G04, G05, G06, G07, G10 |
| Audit/Timeline | G01, G11 |
| User Access/Teams/Reference Master | G01, G02, G03, G10 (these aren't covered by a dedicated Golden row per section 1's review; the closest proxies are used) |

This table is a starting point, not a substitute for actually reading the
Change Set's own Change Impact Analysis; a change narrow enough to touch
only part of a domain may need fewer rows, and a cross-domain change
needs the union of every row its domains map to.

---

## 4. What this pack is not

Not a compliance audit, not a scale test, not an exhaustive regression
run, not a replacement for a Change Set's own targeted regression
obligation (`docs/NEXUS_CHANGE_GOVERNANCE.md` section 5). It is a
separate, faster instrument for a different purpose: general product
confidence a human can act on directly, in minutes, without touching the
journey-testing machinery at all.
