# Nexus Golden Journeys

A small, human-runnable pack Utkarsh can execute any time he wants direct
confidence that "the basic product is working," independent of whether a
specific Change Set's own targeted regression has run
(`docs/NEXUS_CHANGE_GOVERNANCE.md` section 6). This is a proposal, not an
execution record. **None of these have been run as part of producing this
document.**

Derived from the existing Journey Universe; every row below references a
real journey ID whose canonical definition and prior evidence already
exist in `docs/NEXUS_JOURNEY_UNIVERSE.md` and the Batch 1-33 ledgers.
Where a row's assertion draws on the general pattern a journey family
established rather than one single ID's exact wording, it is marked
"pattern" so it is not overclaimed as a verbatim replay.

Use only canonical TEST personas already provisioned
(`.env.nexus-test.local`, shared password across all test personas per
this programme's own standing practice) and disposable fixtures created
fresh for the run. Never a real customer or real user.

16 journeys, covering every category the operating system's Step 8
required.

| # | Journey ID | Why it's Golden | Persona | Approx. effort | Mutation? | Cleanup? | What a human should visually confirm |
|---|---|---|---|---|---|---|---|
| 1 | U-001 pattern | Baseline login/session; if this fails nothing else matters | Any canonical TEST persona | 1 min | NO | NO | Login succeeds, lands on the expected default page, a later logout clears the session |
| 2 | B-001 pattern | Customer Master is the foundation every other domain reads from | `nexus-test-finance-admin` | 2 min | NO | NO | Customer list loads, search finds a known test customer, the detail page renders the correct fields |
| 3 | A-001 pattern | Onboarding is the entry point for every new customer | `nexus-test-maker` | 3 min | YES (new draft) | YES (leave as a disposable, clearly-test-named draft, or delete if garbage-data rules allow) | A fresh draft saves, reopens, and shows exactly what was entered |
| 4 | A-011 pattern | Submission is the moment a draft becomes a real governed request | `nexus-test-maker` (same draft as #3) | 2 min | YES (submit) | NO, feeds into #5 | The case moves to a review state and the correct approver persona can see it waiting |
| 5 | H-027/A-011 approval pattern | A maker-to-checker handoff completing is the single most important end-to-end guarantee in the product | The approver persona for the case from #4 | 2 min | YES (approval) | NO, acceptable as a disposable test customer | Approval succeeds, the record becomes a live customer, the Timeline shows the real approval event with the correct actor |
| 6 | C-009 pattern | Customer Change is the only path to modify approved truth | `nexus-test-maker` | 3 min | YES (new CCR against an existing test customer) | YES (leave as draft, or cancel) | The diff view correctly shows proposed vs. current values, nothing else on the customer record appears changed yet |
| 7 | Y-003/send-back pattern | Send-back/resubmit is a recurring, historically defect-prone mechanism (L-021, J-027) | Maker + the relevant approver persona | 4 min | YES | NO, disposable fixture | The send-back reason is recorded and visible; resubmitting restarts from the correct node, not mid-graph |
| 8 | D-001 pattern | Commercial Configuration is where financial terms live | `nexus-test-commercial-viewer` (and an approver if a draft version exists to approve) | 2-4 min | Optional (NO if only reading an existing version; YES if approving a draft) | NO if read-only | Components render correctly; if approving, the version transitions to current correctly |
| 9 | H-001 pattern | Go Live is the one domain with a real, durable live-billing effect | `nexus-test-go-live-admin` | 3 min | YES (new Go Live request on a disposable test customer) | NO, disposable | The line item transitions to Live; the Commercial Context shown is locked to what was true at creation, not silently updated to whatever is current |
| 10 | AB-001 pattern | Authorization denial must be a clear, server-enforced "no," not a silent failure or raw error | A persona deliberately lacking the relevant permission (e.g. `nexus-test-reference-master-viewer` attempting a write) | 1 min | NO (a denied action does not mutate) | NO | The action is denied with a clear message; nothing changes in the underlying record |
| 11 | J-001/J-021 pattern | Multi-node workflow routing is the mechanism every approval in the product depends on | Two distinct approver personas in sequence | 4 min | YES (two real approvals) | NO, disposable fixture | `current_workflow_node_key` advances correctly at each step; only the correct persona/team can act at each node |
| 12 | R-012 pattern | History/Timeline is how every other confirmation in this pack gets independently verified | Any read persona | 1 min | NO | NO | The Timeline for a record touched earlier in this pack (e.g. #6 or #9) shows the real events in correct chronological order, correctly attributed |
| 13 | I-012 pattern | Entitlement/Usage/Settlement is the ledger of financial truth | `nexus-test-finance-admin` | 3 min | YES (submit usage, record a settlement on a disposable fixture) | NO, disposable | The ledger reflects the submitted usage correctly; the settlement reduces the outstanding balance by exactly the right amount |
| 14 | P-001 pattern | Reference Master values feed every dropdown in the product; a break here is invisible until someone tries to pick a value | Any read persona | 1 min | NO | NO | Dropdown values render correctly in a real form (e.g. Segment or Industry on the Onboarding form) |
| 15 | N-001/O-001 pattern | User Access and Team Master underlie every permission check in this entire pack | `nexus-test-user-access-admin` | 2 min | NO | NO | The user list and team list render correctly with accurate role/membership display |
| 16 | V-044 pattern | Self-approval must be blocked server-side; this is the single highest-stakes maker-checker guarantee in the product | The same persona who created a fixture earlier in this pack (e.g. #6's CCR), attempting to approve their own submission | 1 min | NO (denied) | NO | The self-approval attempt is denied with a clear message, not a silent success |

**Total new mutations across the full pack, if run start to finish: 6**
(rows 3, 4, 5, 6, 7, 9, 11, 13 share and build on a small number of
disposable fixtures; several rows reuse the same record rather than each
creating a new one). **Total approximate effort: 30-40 minutes** for all
16, run in the order listed so later rows can reuse earlier rows' fixtures
(e.g. row 12 reads the Timeline of records created in rows 6/9, row 16
attempts self-approval on row 6's own fixture).

This pack is not a substitute for a Change Set's own targeted regression
obligation (`docs/NEXUS_CHANGE_GOVERNANCE.md` section 5); it is a
separate, faster instrument for a different purpose, general product
confidence, not change-specific verification.
