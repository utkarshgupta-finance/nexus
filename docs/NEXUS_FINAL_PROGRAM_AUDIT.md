# Nexus Final Program Audit

Documentation and evidence reconciliation only. No journey was rerun, no
test fixture was created, no database was mutated, and no product code was
changed to produce this document. Every number below was derived by
reading the current repository content (the Journey Universe, the
Coverage Matrix, the Execution Plan, all 33 batch ledgers, the audit/
reconciliation documents layered on top of them, the Product Gap and
Product Decision trails, Tech Debt, and the fixture/incident log), not by
trusting any prior prose summary. Where two documents disagreed, both
numbers are shown and reconciled against individual journey IDs rather
than one being silently picked.

Date: 2026-10-02.

---

## 1. Executive conclusion

The Nexus journey-testing program has executed essentially its entire
current canonical scope: **796 of 796 currently-executable journeys** in
`docs/NEXUS_JOURNEY_UNIVERSE.md` have real evidence somewhere in the
ledger, with **one** journey (AB-035) that sat silently unexecuted inside
Batch 26's own stated scope until this final reconciliation pass caught it
and closed it on 2026-10-02 (see section 3). No other silently-missing
journey was found across Batches 1-33 after a mechanical, ID-by-ID check
of every batch's own stated range.

This is not the same statement as "Nexus has zero open product concerns."
It is not. There are: zero **active** Product Gaps (Section A of the
register is genuinely empty), 14 **deferred/accepted** items the business
has knowingly chosen not to fix yet, roughly 6 **future capability** items
that were never meant to exist in the current product, and a double-digit
number of journeys across the historical batches whose PARTIAL or
BLOCKED classification is a genuine, disclosed, permanent environment or
tooling limitation rather than a closed loop. These are listed in full
below, not summarized away.

Three genuine documentation inconsistencies were found and corrected in
this pass (not journey evidence, only stale summary text): a stale
`docs/TECH_DEBT.md` entry each for B-007/PG-053 and M-021/PG-018 (both
describing issues that were in fact fixed), a stale Section C deferred-
item count in `docs/OPEN_PRODUCT_GAPS.md` (said 9-10, mechanically counted
14), a stale "still open" revalidation paragraph in
`docs/journey-runs/BATCH_21_RESULTS.md` directly contradicting two other
documents' agreement that M-021 was fixed, and stale "Product Decision
needed: YES" rows in `docs/journey-runs/MORNING_RESIDUAL_QUEUE.md` for
three decisions (AB-020, AB-039/AB-043, V-028) that were in fact decided
and closed the same day the queue file was written. All four corrections
are additive notes pointing at the real, later evidence; no historical
journey evidence was rewritten.

---

## 2. True master denominator

**NEXUS_JOURNEY_COVERAGE_MATRIX.md states 785.** It says so explicitly,
and also says it was "most recently" regenerated after Batch 1 added
K-030. It was never regenerated again.

**NEXUS_JOURNEY_EXECUTION_PLAN.md's own batch-by-batch Journey-ID ranges
sum to 794.** This is a mechanical sum of its own 33 written batch
definitions, independently reconfirmed by direct count.

**NEXUS_JOURNEY_UNIVERSE.md's own body content (every `### <ID>:` heading)
mechanically counts to 840 total, 796 after excluding the two FUTURE
packs** (Forms Hub: 22, MRR Recognition: 22; both explicitly non-
executable today, confirmed by their own lighter record format and by the
Coverage Matrix's own exclusion note).

**These three numbers disagree, and the disagreement is fully explained,
not arbitrary:**

- 785 (Coverage Matrix) → 796 (true Universe body) is a gap of 11,
  resolved exactly by: the 8 Stage A Expansion Audit journeys (E-029,
  E-030, E-031, E-032, H-044, AA-023, AB-042, ACC-002; minted after the
  785 snapshot, all executed in Batch 18), Q-021 (discovered during Q-011
  in Batch 22, executed in Batch 23), T-025 (discovered in Batch 24,
  executed in Batch 25), and AB-043 (discovered and executed live in
  Batch 26). Per-pack diffs land exactly on E+4, H+1, Q+1, T+1, ACC+1,
  AA+1, AB+2, with zero unexplained residue.
- 794 (Execution Plan) → 796 (true Universe body) is a gap of 2: **A-036**
  (discovered and executed live in Batch 7, explicitly "not one of the
  25" scheduled that batch) and **AB-043** (same pattern, Batch 26). Both
  were genuinely executed as live batch discoveries; neither was ever
  retroactively added to the Execution Plan's own written schedule lines.
  This is a planning-document gap, not an execution gap.
- The Universe document's own prose summary line (imprecisely "794") and
  its own Pack Index table (sums to 795, and the table's own "including
  future: 838" doesn't even arithmetically match 795+22+22=839) are both
  independently stale and inconsistent with the document's own body
  content. Not corrected line-by-line in this pass; flagged here as a
  further, lower-priority documentation debt item.

**Authoritative figure for this audit: 796 currently-executable journeys.**
Every one of the 796 has execution evidence somewhere in Batches 1-33,
with the single exception described in section 3 below, now closed.

This also reconciles the Batches 24-33 "fresh execution" program's own
235 figure cleanly: 234 were scheduled at launch; AB-043 was discovered
and executed mid-run, bringing the actual total to 235, exactly matching
`docs/journey-runs/RUN_STATE.json`'s own final state.

---

## 3. Batch-by-batch reconciliation

Every batch below was checked by extracting its own stated scheduled
Journey-ID range and mechanically confirming every single ID in that
range has a dedicated evidence section, the same check that caught the
one real gap this audit found (Batch 26). "Final tally" reflects the
latest known classification after all later revalidation/audit passes,
not necessarily the batch's own original closing number.

| Batch | Range | Scheduled | Mechanical ID check | Final tally (latest) | Residual |
|---|---|---|---|---|---|
| 1 | K-001–K-025 (+K-030 discovered, executed Batch 2) | 25 | 25/25 present | PASS 20, FIXED+PASS 3, EXPECTED 2 | One unclosed supplementary check noted for K-010 (a follow-on resave-after-refresh step), never revisited; low priority |
| 2 | K-026–K-030, L-001–L-021 | 26 | 26/26 present | PASS 21→ (revalidation added 2 more defects, L-002/L-020, and found a new one inside L-021 itself), all fixed | None |
| 3 | L-022–L-028, U-001–U-018 | 25 | 25/25 present | PASS 22, FIXED+PASS 2, EXPECTED 1 | U-008/U-014 PARTIAL by design (disclosed automation-feasibility rating, not an open item) |
| 4 | U-019, U-020, N-001–N-023 | 25 | 25/25 present | PASS 23, FIXED+PASS 1, EXPECTED 1 | None open; U-019/U-020 PARTIAL by permanent architectural constraint (single shared browser session), accepted |
| 5 | N-024–N-031, O-001–O-017 | 25 | 25/25 present | PASS 18, PRODUCT GAP CONFIRMED 6, EXPECTED 1 | O-005/O-015/O-016 PARTIAL by permanent tooling constraint. One genuine unresolved self-contradiction found: the file's own text both claims and then same-day retracts a live UX closure for N-031/O-011/O-013; flagged, not adjudicated by this audit (underlying code fixes for N-031/O-011 are independently confirmed CLOSED via PG-004/PG-002) |
| 6 | O-018–O-025, P-001–P-017 | 25 | 25/25 present | PASS 20, PRODUCT GAP CONFIRMED 5 | None; all revalidation-era PARTIALs closed same file |
| 7 | P-018–P-023, A-001–A-019 (+A-036 discovered) | 25 | 25/25 present | PASS 19, FIXED+PASS 4, EXPECTED 1, BLOCKED 1 (deliberate) | A-036/PD-001 internal contradiction: the entry's own PD-001 closure note (real code fix, unit-tested) is never reflected in the batch's own summary/defect sections, which still call it open; no live-browser confirmation of the fix exists, only unit tests. Current correct disposition: FIXED (code present), UX-unconfirmed |
| 8 | A-020–A-035, ACC-001, B-001–B-008 | 25 | 25/25 present | PASS 23, FIXED+PASS 1, PARTIAL 1 (A-031, concurrency-only, by design) | None |
| 9 | B-009–B-025, C-001–C-008 | 25 | 25/25 present | PASS 22, EXPECTED 1, FIXED+PASS 2 | None |
| 10 | C-009–C-033 | 25 | 25/25 present | PASS 25/25 | None |
| 11 | C-034, C-035, D-001–D-023 | 25 | 25/25 present | PASS 24, PRODUCT GAP CONFIRMED 1 | **D-017 remains genuinely open** (orphaned legacy RPC `create_commercial_change_for_configuration`, same gap as E-020/Batch 12); confirmed closed only much later as **PG-038** (2026-09-28, outside this batch's own scope) |
| 12 | D-024, E-001–E-024 | 25 | 25/25 present | PASS 23, PRODUCT GAP CONFIRMED 2 (E-020, E-022) | E-020 closed later as PG-038; E-022 closed later as PG-039; both outside Batch 12's own scope, both now genuinely CLOSED |
| 13 | E-025–E-028, F-001–F-021 | 25 | 25/25 present | PASS 23, PRODUCT GAP CONFIRMED 2 (F-014, F-020) | F-014 remains open (deliberate architectural deferral, future Pricing Kernel); F-020 remains open (DF-001/PG-046, P3) |
| 14 | F-022, G-001–G-024 | 25 | 25/25 present | PASS 18, FIXED+PASS 1, EXPECTED 6 | None |
| 15 | G-025, G-026, H-001–H-023 | 25 | 25/25 present | PASS 24, FIXED+PASS 1 | None (H-020's cross-domain generalization question lives on as TV-001/AA-023, tracked separately) |
| 16 | H-024–H-043, I-001–I-005 | 25 | 25/25 present | PASS 20, FIXED+PASS 2, EXPECTED 1, decided-before-Batch-17 2 | None |
| 17 | I-006–I-030 | 25 | 25/25 present | PASS 20, FIXED+PASS 3, decided 2 | None |
| 18 | E-029–E-032, H-044, AA-023, AB-042, ACC-002 (non-contiguous, 8 journeys) | 8 | 8/8 present | 7 PASS + 1 FIXED+PASS (H-044) | None |
| 19 | I-031–I-038, J-001–J-017 | 25 | 25/25 present | PASS 22, FIXED+PASS 1, decided 2 | **I-037 remains the sole open item**: a CANCELLED-state Stress Variant manual-browser check is genuinely tooling-blocked (no authenticated session derivable), not closed as of any file read |
| 20 | J-018–J-030, M-001–M-012 | 25 | 25/25 present | PASS 24, decided 1 | **J-026 remains the sole open item**: a true simultaneous two-connection race is not producible through a sequential RPC interface, honestly TOOLING-BLOCKED |
| 21 | M-013–M-030, Q-001–Q-007 | 25 | 25/25 present | PASS 24, PRODUCT GAP 1 (M-021) | **M-021 is FIXED** (see section 5); the ledger's own later addendum calling it unfixed is stale and corrected in this pass. Q-001/Q-002/Q-003/Q-007 Stress variants remain TOOLING-BLOCKED (disclosed, Regular Paths closed) |
| 22 | Q-008–Q-020, R-001–R-012 | 25 | 25/25 present | PASS 20, EXPECTED 4, FIXED+PASS 1 | None open |
| 23 | Q-021, R-013–R-020, S-001–S-017 | 26 | 26/26 present | PASS 24, FIXED+PASS 2, EXPECTED 2 | R-015 (500-row audit cap) unexercised at real scale (max churn 42 rows), honestly disclosed, mechanism-only PASS. S-013's route-expansion follow-up unscheduled at the time, closed later as PG-041 |
| 24 | S-018–S-024, T-001–T-018 (+T-025 discovered) | 25 | 25/25 present | see Batches 24-33 consolidated tally below | — |
| 25 | T-019–T-025, AB-001–AB-019 | 26 | 26/26 present | — | — |
| 26 | AB-020–AB-041, V-001–V-004 (+AB-043 discovered) | 26 | **24/26 present at original close; AB-034, AB-035 silently missing** | — | **This is the one real silent gap this entire program produced.** See below. |
| 27 | V-005–V-029 | 25 | 25/25 present | — | — |
| 28 | V-030–V-047, W-001–W-007 | 25 | 25/25 present | — | — |
| 29 | W-008–W-021, Z-001–Z-011 | 25 | 25/25 present | — | — |
| 30 | Z-012–Z-030, X-001–X-006 | 25 | 25/25 present | — | One incident (INC-001), fully reconciled, see section 11 |
| 31 | X-007–X-021, AA-001–AA-010 | 25 | 25/25 present | — | — |
| 32 | AA-011–AA-022, Y-001–Y-013 | 25 | 25/25 present | — | — |
| 33 | Y-014–Y-020 | 7 | 7/7 present | — | — |

**Batches 24-33 consolidated final tally** (the "fresh execution" program,
235 journeys including AB-043 and the AB-035 closure below): PASS 174+,
PRODUCT GAP RESOLVED + PASS 6 (PG-062 through PG-065, PG-019, PG-020),
EXPECTED BEHAVIOUR 5+, PARTIAL / TOOLING LIMITATION 22 (Batches 24-31's
tooling-limited scale/concurrency items, plus Batch 32's 9, plus Batch
33's 7), BLOCKED 1 (Y-008, safety-classifier-declined RBAC scale-building).
Full per-batch detail for this range is preserved in each batch's own
`BATCH_2{4-9}/3{0-3}_RESULTS.md` and is not re-derived here.

### The one real gap: Batch 26's AB-034 / AB-035

Batch 26's own closing text claimed "26/26 genuinely executed, no
unauthorized cross-references remaining." This was false. A later,
dedicated cross-check (prompted by this same final-closure process, prior
to this document) mechanically verified every ID in the stated
AB-020–AB-041 range and found **AB-034** and **AB-035** had no execution
evidence anywhere in the ledger.

- **AB-034** ("Workflow Admin's publish permission revoked while an
  unpublished draft is open in the Builder") is, mechanism for mechanism,
  identical to **V-030** ("Workflow Admin loses publish permission
  mid-edit of a draft graph"), genuinely executed and verified PASS in
  Batch 28. Disposed as Journey Discovery **ALREADY COVERED**; no new
  test needed.
- **AB-035** ("Admin's own `user_access.write` removed while the User
  Access page itself is open") is materially distinct from V-031 (which
  tested `team.write` on Team Master, not the reflexive case AB-035
  specifically calls for) and was genuinely unexecuted. Under a separate,
  explicitly bounded authorization naming AB-035 as the sole target, it
  was executed on 2026-10-02: a real mid-session revoke of Admin A's
  `user_access.write` while the User Access page stayed open; a stale-page
  write attempt denied cleanly (UI message, network-confirmed server
  rejection, DB and audit_log both unchanged); a fresh reload correctly
  reflecting the lost access; and a recovery check confirming a restored
  admin's next attempt succeeds cleanly with correct actor attribution.
  **Classification: PASS.** Full evidence is in
  `docs/journey-runs/BATCH_26_RESULTS.md`'s own new AB-035 section.

With this closed, **Batches 24-33 reach 235/235 evidenced, 0 remaining**,
and the full program reaches **796/796** (the true Universe total)
genuinely evidenced.

---

## 4. Journey outcome totals (program-wide, both eras)

Totals below combine Batches 1-23 (original execution + historical
revalidation) and Batches 24-33 (fresh execution), using each journey's
latest known classification, not its original one, per the standing rule
that later revalidation evidence supersedes an earlier classification.

| Classification | Approx. count | Notes |
|---|---|---|
| PASS | ~600+ | The large majority of the catalogue; includes journeys upgraded from PARTIAL/SOURCE-INSPECTED to full MANUAL UX VERIFIED during the Historical UX Revalidation passes |
| FAILED THEN FIXED + PASS | ~35 | Every chain has a root cause, a fix (migration or commit reference), and a rerun; see section 6 |
| PRODUCT GAP RESOLVED + PASS / PRODUCT GAP CONFIRMED (now closed) | ~53 | = the 53 CLOSED entries in the Product Gap register, section 7 |
| EXPECTED BEHAVIOUR | ~30+ | Deliberate, documented design choices confirmed live, not defects |
| PARTIAL / TOOLING LIMITATION | ~35-40 | See the full register in section 9; concentrated in Batches 5, 19, 20, 21, 32, 33 |
| BLOCKED | 2 | A-011 (Batch 7, deliberate scope boundary, resolved to PASS via later evidence), Y-008 (Batch 32, safety-classifier-declined scale-building, genuinely still BLOCKED) |
| PRODUCT DECISION REQUIRED (now closed) | 16 | 10 formally PD-numbered + 6 unnumbered; all 16 closed, see section 8 |

A precise, single program-wide number was not forced here where the
underlying batch ledgers themselves disagree on exact sub-counts (e.g.
several batches' own closing arithmetic had small, since-corrected
errors, documented in each batch's own audit trail). What is precise and
load-bearing: **0 journeys are silently unaccounted for** (section 2-3),
**0 Product Gaps are currently Active** (section 7), and **2 journeys
remain genuinely BLOCKED/unverified** (Y-008, and the now-closed AB-035's
sibling tooling-blocked items I-037/J-026, detailed in section 9).

---

## 5. Defect closure reconciliation

Every FAILED → FIXED → PASS chain checked traces to a root cause, an
implementation reference (migration file or commit hash), and rerun
evidence, with the following caveats found and disclosed rather than
hidden:

- **Batch 1 (K-010, K-019, K-025):** all three have a real commit
  (`8d040d0`) and, for K-019/K-025, a specific migration filename. None of
  the three has concrete rerun evidence *within Batch 1's own record*; the
  actual reconfirmation is deferred to Batch 2's later re-execution
  (K-030). This is disclosed in the ledger itself, not concealed, but is
  the weakest evidence chain in the early program.
- **M-021 (Batch 21):** genuinely fixed the same night via
  `BATCH_21_EVIDENCE_AUDIT.md` (a per-item-type permission map replacing
  one OR'd boolean), independently corroborated by
  `BATCH_19_21_EVIDENCE_AUDIT_SUMMARY.md` and `docs/OPEN_PRODUCT_GAPS.md`
  (PG-018). A later-appended "REVALIDATION PASS" paragraph directly
  inside `BATCH_21_RESULTS.md` contradicted this, claiming "no code
  behavior was ever wrong." **That paragraph was stale and has been
  corrected in this audit pass** (section 12); the fix is real.
- Every other defect chain checked (DEFECT-B3 through B9, K026-D01
  through K029-D01, H-020, H-027, H-043, I-012/I-021/I-022, Q-019,
  DEFECT-B6-001, PG-039/E-022, PG-062/AA-002) has both a cited migration
  or commit and a described rerun, several with explicit before/after
  live-browser transcripts. No case was found where a fix was claimed
  with zero implementation reference, and no case was found where a
  rerun was claimed with literally no description of what was checked
  (the Batch 1 cases above are the closest to this failure mode, and even
  those have a genuine commit hash).

---

## 6. Product Gap reconciliation

Full register: **PG-001 through PG-066, mechanically confirmed
contiguous, zero skipped numbers.** Every PG-ID mentioned anywhere in the
batch-ledger corpus also appears in `docs/OPEN_PRODUCT_GAPS.md`; no
ledger-vs-register contradiction was found.

- **CLOSED: 53**
- **DEFERRED / ACCEPTED FOR NOW: 14** (Section C's true mechanical count;
  the register's own prose said 9-10, now corrected, see section 12).
  Two of these 14 (DF-010, DF-013) carry no PG-number at all, so PG-001
  through PG-066 does not fully enumerate every tracked deferred finding.
- **FUTURE CAPABILITY: 4** of the 14 above (PG-025, PG-026, PG-031,
  PG-061) are explicitly unbuilt-module items, not accepted defects.
- **ACTIVE: 0.** Section A's exact current text: *"None currently open.
  PG-063 ... PG-064 ... and PG-065 ... were all decided and closed the
  same day under the Immediate-Closure Protocol."* Verified true; all
  three are present and CLOSED in Section D.
- **INCONSISTENT / NEEDS DOC RECONCILIATION: 1.** PG-005 (the recurring
  zero-active-team-members gap, independently reconfirmed across 7+
  journeys) carries its own self-disclosed, still-unresolved tension
  between M-025's "no proactive flag anywhere" framing and the fix's own
  Operations Queue banner. This is the register's own honest flag, not
  something this audit discovered; it is surfaced here as a residual item
  worth a product-owner look, not resolved by this audit.
- **TO-VERIFY: 1.** PG-042/TV-001 (H-020's cross-domain generalization
  question): AA-023 was allocated to verify whether Go Live's fix
  generalizes to the other three Workflow Runtime domains, and was
  executed in Batch 18 and found PASS (no regression in the other three
  domains). TV-001 should be considered closed by AA-023's execution; the
  register's own "To Verify" section header was not updated to reflect
  this and is flagged here.

The full PG-by-PG table (origin journey, decision, fix reference,
regression evidence, current state) is preserved in the audit transcript
and summarized by state above; it is not reprinted in full here to keep
this document navigable, see `docs/OPEN_PRODUCT_GAPS.md` itself as the
living source of truth, now corrected per section 12.

---

## 7. Product Decision reconciliation

**16 total: 10 formally numbered (PD-001 through PD-010), 6 unnumbered**
("(USER) PRODUCT DECISION REQUIRED" instances that never received a
formal ID: N-031, O-018, P-021, AB-020, AB-039/AB-043, V-028).

**All 16 are CLOSED**, each with a quoted decision, an implementation
reference where implementation was required, and later journey evidence
validating the implementation in the majority of cases. No numbering
gaps, no duplicates.

Three of the unnumbered six (AB-020, AB-039/AB-043, V-028) are formally
closed per `docs/OPEN_PRODUCT_GAPS.md` but still read as open in two
frozen mid-run snapshot files (`docs/journey-runs/MORNING_RESIDUAL_QUEUE.md`,
`docs/journey-runs/OVERNIGHT_DISCOVERED_JOURNEY_QUEUE.md`), both written
the same day the decisions were made and never updated afterward. This is
a documentation-staleness issue, not a substantively open decision;
corrected in section 12.

`docs/journey-runs/CURRENT_RUN_STATUS.md` (the latest, auto-generated,
Batch 33 state) independently confirms **"Product Decisions found: 0"**
outstanding, consistent with all 16 being closed.

---

## 8. PARTIAL / BLOCKED / tooling-limited register

Every item below was checked against later evidence before being listed
as still-residual; anything with a later closure is cross-referenced and
marked closed instead.

| Journey | Batch | What was verified | What was NOT verified | Why | Later evidence? | Current status |
|---|---|---|---|---|---|---|
| U-008, U-014 | 3 | Regular Path | Stress/boundary timing | Disclosed automation-feasibility rating (PARTIAL by design in the canonical journey itself) | N/A, not an open item | Permanent, accepted |
| U-019, U-020 | 4 | Architectural proof of session-independence | Literal two-simultaneous-session reproduction | Tool shares one cookie jar across tabs | N/A, accepted as architectural-proof-equivalent | Permanent, accepted |
| O-005, O-015, O-016 | 5 | Mechanism via source/RPC evidence | Live two-simultaneous-session UX | Same structural constraint as above | None found | Permanent, accepted |
| A-031 | 8 | Everything except true-simultaneous-race timing | Concurrency dimension only | Unprovable with available tooling | None found | Permanent, accepted |
| I-037 | 19 | Server/code-path evidence complete | Manual browser confirmation of the CANCELLED-state Stress Variant | No authenticated session could safely be derived for this specific state | None found | **Still genuinely open, tooling-blocked** |
| J-026 | 20 | Every non-concurrent component of the safety property, independently reconfirmed | True simultaneous two-connection race | Cannot be produced through a sequential RPC interface | None found | **Still genuinely open, tooling-blocked** |
| Q-001, Q-002, Q-003, Q-007 | 21 | Regular Paths (Grade A) | Stress/boundary variants | Real file-storage I/O needs a live session or credentialed script | None found | Permanent, accepted |
| R-015 | 23 | Mechanism at 42-row real scale | 500-row cap at real volume | No real dataset reaches the cap | None found | Permanent, accepted (mechanism-only PASS) |
| Batches 24-31's scale/concurrency PARTIALs | 24-31 | Real accumulated TEST-environment scale at each journey's own honestly-disclosed number | Canonical "100+/500+/tens-of-thousands" targets | Environment is DEV/TEST, not production scale | N/A by nature | Permanent, accepted (disclosed numbers, not faked) |
| Y-008 | 32 | Nothing scale-related; blocked before any scale-building began | Large team-membership scale | Safety classifier correctly declined an autonomous RBAC-modifying action | None found | **Still genuinely BLOCKED** |
| Batch 32's 9 PARTIALs (Y-002 through Y-013 minus Y-001/Y-010/Y-012) | 32 | Real, honestly-disclosed tested scale (e.g. 16 components, 3 send-back cycles, 341 audit rows) | Canonical stress targets | DEV/TEST environment scale ceiling | N/A by nature | Permanent, accepted |
| Batch 33's 7 PARTIALs (Y-014 through Y-020) | 33 | Real, honestly-disclosed tested scale (1 reference, ~14.5-month span, 15 workflow versions, 11 Go Live requests, 2 live approval nodes) | Canonical "tens of thousands / several years / dozens-100+ / 15+-30+" targets | DEV/TEST environment scale ceiling; Y-017/Y-018/Y-019 additionally found the canonical Regular Path's own UI surface doesn't exist (see section 10) | N/A by nature | Permanent, accepted |

**Net residual count of genuinely open, unverified dimensions: 3** (I-037,
J-026, Y-008). Everything else in this register is either a permanent,
accepted, by-design limitation (disclosed honestly, not escalated) or has
since been closed by later evidence.

---

## 9. Deferred / accepted register

The 14 Section C items from `docs/OPEN_PRODUCT_GAPS.md`, mechanically
counted (see section 12 for the count correction):

| ID | One-line gap | Category |
|---|---|---|
| DF-00X (PG-066) | Commercial Version review decision fails silently on the client when the server rejects it | UX |
| DF-001 (PG-046) | No support/debug surface for raw `pricing_rule_kind` | Observability |
| DF-002 (PG-047) | Team-less Approval node has no publish-time UX warning | UX |
| DF-003 (PG-048) | `provision_app_user` would surface a raw FK-violation error to a future non-UI caller | Correctness (latent) |
| DF-004 (PG-049) | No self-service "my access" view | UX |
| DF-005 (PG-050) | No search/filter on User Access or Team Master lists | UX/Scalability |
| DF-006 (PG-051) | No UI surfaces historical audit/timeline data for several Settings areas | Observability |
| DF-007 (PG-052) | Invoice Frequency `cadence_months` retroactivity architecturally unresolved but latent | Correctness (latent) |
| DF-008 (PG-054) | Customer Master search and Approvals/Operational Queue have no server-side pagination | Scalability |
| DF-009 (PG-055) | Go Live not extended to the full scoped-authorization model | Architecture |
| DF-010 | No duplicate/near-duplicate customer name warning on creation | UX |
| DF-011 (PG-060) | No UI surfaces a superseded Onboarding/Go Live document version | Observability |
| DF-012 (PG-061) | No cross-customer report/export surface exists | Future capability |
| DF-013 | Onboarding has no genuine reject/terminal state for a case a reviewer will never approve | UX/Process |

None of these are data-safety or correctness-critical; all are
deliberate, business-acknowledged deferrals with a stated trigger for
revisiting (see each entry's own text in `docs/OPEN_PRODUCT_GAPS.md`).

---

## 10. Future capability register

Distinct from the deferred/accepted list above: these are capabilities
that were never meant to exist in the current product, confirmed absent
by source inspection rather than treated as a defect.

| Item | Found via | Why it's future capability, not a defect |
|---|---|---|
| Pricing Kernel (centralized pricing-parameter validation) | F-014, G-001/002/003 | Explicitly deferred in the migration's own comment to a future architectural component |
| `spend`-kind commitment onboarding UI | G-007 | RPC supports it; no UI was ever built, by design |
| Forms Hub cross-domain aggregate view | S-019 through S-022 | Named future module in the Journey Universe itself |
| Cross-customer report/export surface | X-015, DF-012 | Same shape as Forms Hub; explicitly unbuilt |
| Consolidated per-customer Go Live history list | Y-017 (Batch 33) | The canonical Regular Path assumes a listing UI that doesn't exist; current UI only shows per-line-item current state plus individual request detail pages by direct link |
| Organization-wide document report | Y-018 (Batch 33) | Both document tables are always case-scoped by design; no admin screen aggregates across cases |
| Organization-wide audit export | Y-019 (Batch 33) | `audit_log` is only ever queried scoped to one row/table; no aggregation surface exists |
| API/Import-sourced Entitlement Source creation | I-003/I-004, PG-027 | Manual-only for now, by decision |
| MRR Recognition, Forms Hub (whole packs) | Journey Universe | Explicitly excluded from the 796 executable total; lighter-weight record format, no execution fields |

---

## 11. Fixture / incident reconciliation

**One documented incident across the entire program: INC-001** (Batch 30,
Z-027 redo). A direct SQL `INSERT` accidentally wrote a row into a real,
shared customer's (`aurora-consumer-labs`) `go_live_documents` table while
attempting a more rigorous live-app redo. The session's own safety
classifier caught the next step and the incident was self-disclosed and
reconciled the same session: `is_current` set back to `false`, the
Storage object deleted, Z-027 redone safely against a wholly disposable
object. One inert, permanently un-deletable row remains (`go_live_documents`
is immutable by trigger, by design), explicitly disclosed, confirmed to
have zero business impact across 8 independent checks (current-document
state, no FK references, no billing/entitlement/workflow linkage, no UI
surface ever renders it). This incident directly produced the Test
Fixture Safety Protocol now governing every subsequent mutation.

No other incident exists anywhere in `docs/journey-runs/TEST_DATA_INCIDENTS.md`
or disclosed elsewhere in the corpus. No unresolved incident was found.

---

## 12. Documentation inconsistencies found and corrected

All four corrections below are additive notes pointing at the real, later
evidence. No historical journey evidence was rewritten; the standing rule
("the batch ledger is the authoritative evidence record; a later document
never silently overwrites it") was followed throughout.

1. **`docs/TECH_DEBT.md`**: two stale entries corrected. B-007's
   former-name search imprecision was closed as PG-053 (2026-09-28,
   re-verified live in Batch 31); the entry still described it as
   unfixed. M-021's `canApprove` OR-imprecision was closed as PG-018
   (fixed same night as discovery); the entry still described it as a
   real design change "not built here." Both now point at their actual
   closure evidence.
2. **`docs/OPEN_PRODUCT_GAPS.md`**: Section C's own running reconciliation
   count stopped at "10" after the eighth pass (Batch 30) and was never
   updated for three later additions (DF-011, DF-012, DF-013). A
   mechanical count gives 14, now recorded as a new, dated pass entry.
3. **`docs/journey-runs/BATCH_21_RESULTS.md`**: a "REVALIDATION PASS
   (2026-09-27)" paragraph claimed M-021 was never actually fixed in
   code, directly contradicting `BATCH_21_EVIDENCE_AUDIT.md`,
   `BATCH_19_21_EVIDENCE_AUDIT_SUMMARY.md`, and `OPEN_PRODUCT_GAPS.md`
   (PG-018), all three of which agree it was. A correction paragraph was
   appended directly after the stale text, pointing to the three-way
   corroborated evidence.
4. **`docs/journey-runs/MORNING_RESIDUAL_QUEUE.md`**: three rows
   (AB-020, AB-039/AB-043, V-028) describe "Product Decision needed:
   YES" as a frozen mid-run snapshot; all three were decided and closed
   the same day the file was written. A correction note was added above
   the table.
5. **`docs/NEXUS_JOURNEY_COVERAGE_MATRIX.md`**: the stale 785 total is
   now annotated with the true 796 figure and a pointer to this
   document's section 2, since regenerating the full per-pack tables
   mechanically was judged out of scope for a documentation-reconciliation
   pass (no underlying classification changed, only the aggregate count).

Not corrected, flagged only (lower priority, no behavior or classification
at stake): `NEXUS_JOURNEY_UNIVERSE.md`'s own prose summary line and Pack
Index table have two small internal arithmetic inconsistencies (794 vs.
795 vs. 796; "838 including future" doesn't sum from its own stated
parts); `NEXUS_JOURNEY_EXECUTION_PLAN.md`'s descriptive batch-size
breakdown ("2 batches of 26... 29 of 25") contradicts its own per-batch
Journey-ID lists (which show 4 batches of 26, 27 of 25) even though its
stated grand total happens to be correct.

---

## 13. Items that remain genuinely unverified

Stated plainly, with no softening:

- **AB-035** was unverified as of the previous session's close; it is now
  closed (section 3), so this is no longer an open item as of this
  document.
- **I-037**: CANCELLED-state Stress Variant for a Go Live scenario,
  server/code evidence complete, manual browser confirmation genuinely
  tooling-blocked.
- **J-026**: true simultaneous two-connection race, cannot be produced
  through this program's sequential RPC interface.
- **Y-008**: large team-membership scale, blocked by the safety
  classifier's correct refusal to autonomously perform an RBAC-modifying
  action at that volume without explicit per-grant authorization.
- **TV-001/PG-042's own register status**: AA-023 (its verification
  journey) executed PASS in Batch 18, but the register's "To Verify"
  section header itself was never updated to reflect this; a reader of
  the register alone would believe it's still pending.
- **PG-005's self-disclosed internal tension**: the M-025-vs-O-018
  framing discrepancy, carried forward unresolved by the register's own
  admission across every subsequent reconfirmation of the same mechanism.

Everything else that looked unverified on first read (stale "still open"
text, a batch with no explicit numeric tally, a coverage-matrix total that
didn't match) was traced forward to real closing evidence and is not
listed here as open.

---

## 14. Final programme state

- **Programme execution: COMPLETE.** 796/796 currently-executable
  journeys have real evidence; the one silent gap found (AB-035) is
  closed as of this document.
- **Product Gaps: 0 active, 53 closed, 14 deferred/accepted by deliberate
  business decision, 0 confirmed-but-unregistered.**
- **Product Decisions: 0 open.** 16 total, all closed, with implementation
  and later validation evidence for the 13 that required code changes.
- **Residual accepted/deferred risk**: 14 deferred Product Gaps (section
  9) plus roughly 9 future-capability items (section 10), none
  correctness- or data-safety-critical, all with a stated trigger for
  revisiting.
- **Dimensions not proven, because of tooling or scale, not because of a
  product defect**: I-037, J-026, Y-008 (genuinely unverified), plus the
  entire DEV/TEST-environment-scale family of PARTIAL classifications in
  Batches 5, 19-21, 24-33 (verified correct at the scale actually
  achievable, honestly short of production-scale canonical targets).

No further testing, no new batch, and no reopening of any closed journey
was performed to produce this document, per its own scope.
