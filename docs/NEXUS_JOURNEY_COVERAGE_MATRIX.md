# Nexus Journey Coverage Matrix

Companion to [NEXUS_JOURNEY_UNIVERSE.md](NEXUS_JOURNEY_UNIVERSE.md). All counts below were regenerated mechanically (by parsing the structured fields of every journey record in that document) as part of the 2026-09-16 reconciliation pass, after several journeys were rewritten from open-gap findings into regression journeys for fixes now confirmed applied to the live database. 782 current-executable journeys across 29 packs; the two FUTURE packs, Forms Hub and MRR Recognition, are excluded from every table here since their lighter-weight record format carries no dimension/priority fields to count. A dimension is counted as "covered" for a journey when that journey's corresponding field is populated with something other than "N/A".

This matrix exists to make under-tested areas visible at a glance, not to imply every cell should be non-zero. A pricing-model pack correctly has zero Concurrency coverage of its own (races belong to Pack V, which references pricing-model journeys where relevant); an Audit pack correctly has near-total Audit coverage and near-zero Concurrency coverage. Read gaps in context, not as automatic defects.

## 1. Coverage by pack and test dimension

| Pack | Name | Total | Regular | Stress | Authorization | Concurrency | Idempotency | Audit | Recovery | UX | Historical |
|---|---|---|---|---|---|---|---|---|---|---|---|
| A | Customer Onboarding | 35 | 35 | 25 | 12 | 12 | 12 | 33 | 13 | 32 | 5 |
| B | Customer Master | 25 | 25 | 13 | 8 | 4 | 4 | 24 | 2 | 17 | 2 |
| C | Customer Change | 35 | 35 | 18 | 8 | 7 | 7 | 25 | 7 | 20 | 3 |
| D | Commercial Configuration | 24 | 24 | 21 | 5 | 8 | 2 | 23 | 3 | 22 | 8 |
| E | Commercial Change | 28 | 28 | 25 | 9 | 9 | 7 | 27 | 7 | 24 | 4 |
| F | Pricing Models | 22 | 21 | 20 | 0 | 0 | 0 | 20 | 0 | 14 | 0 |
| G | MUG / Slab / Progressive / Designation Pricing | 26 | 26 | 21 | 0 | 0 | 0 | 26 | 0 | 17 | 6 |
| H | Go Live | 43 | 42 | 26 | 18 | 12 | 8 | 41 | 20 | 39 | 2 |
| I | Entitlement | 38 | 38 | 30 | 12 | 9 | 9 | 36 | 9 | 32 | 1 |
| J | Workflow Runtime | 30 | 30 | 14 | 3 | 4 | 0 | 27 | 6 | 18 | 1 |
| K | Workflow Builder | 29 | 29 | 7 | 7 | 2 | 0 | 18 | 6 | 10 | 0 |
| L | Workflow Versioning | 28 | 28 | 14 | 0 | 6 | 1 | 18 | 8 | 9 | 2 |
| M | My Work / Approvals / Waiting on Others | 30 | 30 | 8 | 5 | 2 | 0 | 3 | 0 | 14 | 0 |
| N | Users / Roles / Permissions | 31 | 31 | 9 | 10 | 4 | 6 | 18 | 7 | 16 | 5 |
| O | Teams | 25 | 25 | 6 | 8 | 5 | 5 | 19 | 4 | 12 | 5 |
| P | Reference Masters | 23 | 19 | 4 | 4 | 2 | 4 | 23 | 3 | 19 | 7 |
| Q | Documents / Evidence | 20 | 14 | 7 | 1 | 1 | 2 | 18 | 4 | 16 | 3 |
| R | Audit / Timeline | 20 | 18 | 11 | 0 | 0 | 0 | 18 | 0 | 10 | 7 |
| S | Search / Navigation / Discovery | 24 | 18 | 12 | 6 | 2 | 1 | 5 | 3 | 15 | 2 |
| T | Settings | 24 | 19 | 5 | 7 | 1 | 5 | 13 | 4 | 9 | 3 |
| U | Authentication / Sessions | 20 | 11 | 4 | 9 | 2 | 2 | 3 | 6 | 9 | 0 |
| V | Concurrency | 47 | 47 | 24 | 15 | 25 | 0 | 45 | 12 | 40 | 4 |
| W | Idempotency / Retry | 21 | 21 | 17 | 0 | 0 | 21 | 21 | 3 | 17 | 0 |
| X | Historical / Legacy Data | 21 | 21 | 11 | 0 | 1 | 0 | 21 | 1 | 5 | 21 |
| Y | Performance / Large Records | 20 | 20 | 16 | 0 | 0 | 0 | 20 | 2 | 16 | 7 |
| Z | Failure / Recovery / Chaos | 30 | 29 | 12 | 0 | 1 | 2 | 22 | 13 | 27 | 3 |
| ACC | Accessibility | 1 | 1 | 0 | 0 | 0 | 0 | 1 | 0 | 1 | 0 |
| AA | Cross-Domain Customer Lifecycle | 22 | 22 | 17 | 4 | 7 | 1 | 20 | 7 | 15 | 8 |
| AB | Security / Direct Action / Server Enforcement | 40 | 40 | 7 | 36 | 5 | 1 | 36 | 10 | 11 | 0 |
| **Total** | | **782** | **747** | **404** | **187** | **131** | **100** | **624** | **160** | **506** | **109** |

Recovery/Resilience coverage rose from 155 to 160 versus the pre-reconciliation matrix: five journeys (V-001, V-011, V-012, V-014, V-015) that previously had no recovery path to describe (there was nothing to recover from once data was already silently lost) now describe a real reload-and-reapply recovery path, since the underlying data-loss defect is fixed. One journey (AA-014) moved the other way, from a populated "re-run once the fix ships" note to a correctly-N/A field now that the fix has shipped and there is nothing left to track to closure.

Read alongside Section 3 (Priority), the two dimensions with the thinnest cross-pack coverage are Idempotency (100 of 782, concentrated almost entirely in Pack W by design, since most domain packs delegate idempotency races to the shared cross-cutting pack rather than repeating them) and Historical (109 of 782, concentrated in Pack X plus a handful of domain-specific rename/supersession journeys). Both are intentional concentrations, not neglect: see the anti-duplication note in the Universe document's introduction.

## 2. Coverage by pack and automation feasibility

| Pack | Total | FULL | PARTIAL | MANUAL |
|---|---|---|---|---|
| A | 35 | 28 | 7 | 0 |
| B | 25 | 22 | 3 | 0 |
| C | 35 | 30 | 4 | 1 |
| D | 24 | 12 | 10 | 2 |
| E | 28 | 18 | 8 | 2 |
| F | 22 | 19 | 2 | 1 |
| G | 26 | 21 | 5 | 0 |
| H | 43 | 37 | 6 | 0 |
| I | 38 | 26 | 10 | 2 |
| J | 30 | 29 | 1 | 0 |
| K | 29 | 28 | 1 | 0 |
| L | 28 | 28 | 0 | 0 |
| M | 30 | 29 | 1 | 0 |
| N | 31 | 28 | 3 | 0 |
| O | 25 | 20 | 3 | 2 |
| P | 23 | 17 | 4 | 2 |
| Q | 20 | 15 | 3 | 2 |
| R | 20 | 8 | 9 | 3 |
| S | 24 | 20 | 0 | 4 |
| T | 24 | 17 | 3 | 4 |
| U | 20 | 13 | 5 | 2 |
| V | 47 | 39 | 6 | 2 |
| W | 21 | 18 | 3 | 0 |
| X | 21 | 18 | 3 | 0 |
| Y | 20 | 18 | 2 | 0 |
| Z | 30 | 21 | 8 | 1 |
| ACC | 1 | 0 | 0 | 1 |
| AA | 22 | 8 | 14 | 0 |
| AB | 40 | 27 | 12 | 1 |
| **Total** | **782** | **614** | **136** | **32** |

79% of the catalogue (614 journeys) is fully automatable today (up from 613 pre-reconciliation: AA-014 moved from PARTIAL to FULL now that it is a straightforward same-pattern regression check across all four domains rather than a partially-external, mechanics-owned-elsewhere investigation). The heaviest PARTIAL/MANUAL concentrations are Pack AA (Cross-Domain, 14 of 22 PARTIAL, since these journeys inherently require multi-domain setup a single automated script cannot always assert on cleanly), Pack R (Audit/Timeline, 9 PARTIAL + 3 MANUAL, since several of its journeys require human judgment about display comprehensibility), and Pack S (4 MANUAL, largely the Forms Hub PRODUCT GAP verification journeys, which are inherently "confirm this control does not exist" checks). Pack ACC's single journey is deliberately MANUAL, since keyboard/screen-reader comprehension is a human-judgment check by nature.

## 3. Coverage by priority

| Pack | Total | P0 | P1 | P2 | P3 |
|---|---|---|---|---|---|
| A | 35 | 16 | 16 | 3 | 0 |
| B | 25 | 8 | 13 | 3 | 1 |
| C | 35 | 15 | 16 | 4 | 0 |
| D | 24 | 10 | 7 | 5 | 2 |
| E | 28 | 9 | 14 | 4 | 1 |
| F | 22 | 5 | 9 | 6 | 2 |
| G | 26 | 9 | 11 | 6 | 0 |
| H | 43 | 20 | 18 | 5 | 0 |
| I | 38 | 20 | 13 | 4 | 1 |
| J | 30 | 8 | 12 | 8 | 2 |
| K | 29 | 7 | 13 | 8 | 1 |
| L | 28 | 13 | 10 | 3 | 2 |
| M | 30 | 4 | 15 | 10 | 1 |
| N | 31 | 6 | 15 | 9 | 1 |
| O | 25 | 2 | 12 | 7 | 4 |
| P | 23 | 7 | 3 | 8 | 5 |
| Q | 20 | 4 | 10 | 6 | 0 |
| R | 20 | 6 | 5 | 8 | 1 |
| S | 24 | 2 | 9 | 7 | 6 |
| T | 24 | 3 | 13 | 4 | 4 |
| U | 20 | 9 | 8 | 2 | 1 |
| V | 47 | 14 | 25 | 6 | 2 |
| W | 21 | 6 | 5 | 9 | 1 |
| X | 21 | 2 | 10 | 9 | 0 |
| Y | 20 | 0 | 5 | 9 | 6 |
| Z | 30 | 1 | 15 | 13 | 1 |
| ACC | 1 | 0 | 0 | 1 | 0 |
| AA | 22 | 9 | 12 | 1 | 0 |
| AB | 40 | 31 | 7 | 2 | 0 |
| **Total** | **782** | **246** | **321** | **170** | **45** |

**Reconciliation-driven priority changes.** Five journeys moved from P0 to P1 during the 2026-09-16 reconciliation pass, all downgraded because the underlying risk they guard is now confirmed fixed rather than open: A-030, E-013, and K-010 (draft optimistic locking, confirmed applied via the live Supabase migration ledger), AA-014 (the cross-domain consistency view of the same fix), and H-043 (Go Live's missing protect-trigger, downgraded rather than closed outright since the gap itself is real, but its blast radius is narrower than first framed: RLS already blocks the anon/authenticated attack surface, leaving only a privileged-database-connection exposure). Total P0 fell from 251 to 246; total P1 rose from 316 to 321. No journey moved to or from P2/P3.

**Risk concentration.** P0 (246 journeys, 31% of the catalogue) remains heavily weighted toward Pack AB (31, direct-action/server-enforcement bypass attempts), Pack H (20, Go Live's single durable live-billing effect), Pack I (20, Entitlement ledger correctness), Pack A (16, the atomic Customer Master creation transaction), Pack C (15), Pack V (14, approval-race row-lock correctness), and Pack L (13, workflow version immutability). This is expected and appropriate for a finance system of record: the majority of P0s cluster exactly where approved financial or identity truth is written, not spread evenly across the catalogue. Packs with a P0 count of 0 or near-0 (Y, ACC, S, O) are precisely the packs least likely to touch approved truth (performance/scale, accessibility, discovery, and team-catalog metadata respectively).

## 4. Where the matrix should make you look twice

- **Pack M (My Work / Approvals) has only 3 of 30 journeys with a populated Audit/Data Integrity Check**, far below every other workflow-adjacent pack (J, K, L each sit at 18-27). This is a legitimate reflection of Pack M's actual subject (list bucketing and visibility logic, not state mutation), not an oversight, but it is worth a second look before execution to confirm no bucketing-correctness journey was mistakenly left without a data check.
- **Pack S (Search/Navigation) sits at only 5 of 24 for Audit**, the lowest of any non-pricing pack; this tracks with several of its journeys being PRODUCT GAP verifications (confirming a Forms Hub capability does not exist) rather than state-mutating actions with something to audit.
- **Idempotency coverage outside Pack W is thin by design** (Onboarding 12, Change 7, Commercial Config 2, Commercial Change 7, Go Live 8, Entitlement 9, everything else in single digits or zero); confirm during execution planning that this concentration in Pack W is actually exercised early enough to catch a regression before the thinner domain-level idempotency variants would.
- **N-031 and H-043 remain real, confirmed-live product gaps** (Pack N's usage.read/entitlement_settlement.read enforcement mismatch, and Pack H's missing go_live_requests protect-trigger), not stale documentation. Both were independently re-verified by direct code and migration inspection during this reconciliation pass, distinct from the five journeys above that WERE stale and have since been corrected.
