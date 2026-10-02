# Nexus Permanent Regression Program

The 796-journey universe (`docs/NEXUS_JOURNEY_UNIVERSE.md`) is a
one-time release-readiness sweep, not a thing to rerun wholesale after
every change. This document defines what actually needs to run, when,
using the existing journey catalogue and the automated suite as the two
available instruments, rather than inventing a new testing mechanism.

Principle: **business truth → journey → implementation → automated
protection → targeted journey regression.** Every defect this program
found and fixed got a regression test at the code level (migration or
unit/integration test); the journey itself is the standing definition of
*why* that test exists and *what it would mean* if it ever broke again.
Rerunning the full 796 after a small change would bury that signal in
noise; rerunning nothing would lose it entirely. This program is the
middle path.

---

## Tier A — MUST NEVER BREAK

The P0 concentration the Coverage Matrix itself identifies (247 of 796
journeys, 31%): permissions, maker/checker, workflow transition
correctness, commercial truth, Go Live truth, entitlements/billing/
settlement, audit/history, security, idempotency. A regression here is
not a bug report, it's an incident.

**Automated tests**: the full `vitest` suite (1117+ tests as of Batch 33)
must stay green on every commit. This is the first and cheapest layer;
every Tier A journey that found a real defect already has a
corresponding unit/integration test (see `docs/NEXUS_FINAL_PROGRAM_AUDIT.md`
section 5 for the full defect-to-test trace). `tsc --noEmit` must stay
clean.

**Journey families** (run the Manual UX + Server/DB dimensions, not just
unit tests, since several Tier A defects were only ever caught by live
browser evidence, not unit tests alone):
- Every `requirePermission` gate: Pack AB in full (41-43 journeys),
  focusing on the P0 subset.
- Maker-checker and concurrent-approval correctness: V-001–V-004,
  V-028/PG-037, AB-039/AB-043/PG-036, W-001–W-007.
- Workflow transition correctness: J-001–J-030, L-001–L-028, H-020/AA-023.
- Commercial/Go Live truth: PD-006, PG-057, PG-062, PG-064, H-027, H-043.
- Entitlement/billing/settlement: I-012, I-021, I-022, PG-012, PG-013.
- Audit/history snapshot integrity: V-033, V-038, PG-057, PG-058.

**DB/security checks**: `scripts/verify-governed-rpc-grants.ts` (added
after DEFECT-B7-003, checks all governed RPCs for the PUBLIC-execute-grant
regression that defect introduced) must run and pass. RLS policy presence
on every governed table (the 9-table gap closed in `docs/TECH_DEBT.md`'s
history) should be checked by an equivalent script, not just trusted.

**Trigger**: every merge to `team-preview` that touches
`src/platform/permissions/`, `src/platform/workflow/`,
`src/platform/approvals/`, `src/platform/audit/`, or any
`src/features/*/actions.ts`/`*.service.ts` file in Customer Onboarding,
Customer Change, Commercial Configuration, or Go Live. Before any
Production promotion, unconditionally.

---

## Tier B — DOMAIN REGRESSION

Run the journey family for whichever domain a change actually touches,
not the whole catalogue.

| Domain touched | Journey family to run | Automated coverage already in place |
|---|---|---|
| Customer Onboarding | Pack A (36), Y-005 | `case.service.test.ts`, duplicate-detection tests |
| Customer Master | Pack B (25), V-038, V-043, PG-053 | `change-request.service.ts` tests, Activity snapshot tests |
| Customer Change | Pack C (35), Y-003, V-003, PG-064 | `duplicate-detection.ts` tests, row_version tests |
| Commercial Configuration/Change | Pack D (24), Pack E (32), PD-006, PG-044, PG-045 | migration-backed tests for each closed gap |
| Go Live | Pack H (44), V-033, PG-057 | entitlement/go-live RPC tests |
| Entitlement/Usage/Settlement | Pack I (38), I-012, I-021, I-022 | the five-RPC idempotency test suite (`TECH_DEBT.md` #4/#12) |
| Workflow Builder | Pack K (30), Y-001/Y-012, PG-065 | `validation.test.ts`, canvas-editor tests |
| Workflow Versioning/Runtime | Pack L (28), Pack J (30), AA-023 | workflow transition tests |
| Documents/Storage | Pack Q (21), A-023, Q-019, Q-021 | byte-signature validation tests |
| User Access/Teams | Pack N (31), Pack O (25), PD-009, PD-010 | permission-map tests |
| Reference Master | Pack P (23), PG-003, PG-035 | tier-enforcement tests |
| Audit/Timeline | Pack R (20), PG-058 | snapshot-column tests |

**Trigger**: every PR that changes files under the corresponding
`src/features/<domain>/` or `src/platform/<domain>/` directory. CI should
map changed paths to the domain table above and select the matching
journey family automatically where the journey is automatable (per the
Coverage Matrix's own FULL/PARTIAL/MANUAL rating), falling back to a
manual UX pass only for the PARTIAL/MANUAL-rated journeys in that family.

---

## Tier C — UX / PRESENTATION

Search, filters, labels, navigation, layout, accessibility.

**Journey families**: Pack S (24, Search/Navigation), Pack T (25,
Settings), ACC-001/ACC-002, the UX-check dimension embedded across every
domain pack (not a separate pack, see the Coverage Matrix's own UX
column).

**Automated coverage**: component-level tests for shared UI (`DataTable`
once built per `TECH_DEBT.md` #48, `PendingButton` usage). Accessibility:
`aria-required` and skip-to-content are covered by PG-043's own tests;
nothing broader exists, consistent with `NEXUS_RELEASE_EVIDENCE.md`'s
PARTIALLY EVIDENCED rating for this area.

**Trigger**: any PR touching `src/components/ui/`, `src/components/product/`,
or shared layout/navigation files. Weekly, as a standing housekeeping
pass, for the general "does anything look visually broken" sweep that
doesn't map to a specific code change.

---

## Trigger schedule (explicit, by cadence)

| Trigger | What runs |
|---|---|
| **Every code change** | `tsc --noEmit`, the file(s)' own unit tests. Fast, local, no journey execution needed. |
| **Every merge to team-preview** | Full `vitest` suite (Tier A's automated layer), `scripts/verify-governed-rpc-grants.ts`, lint. If the merge touches a Tier A path (see above), the matching Tier A journey family's Manual UX + Server/DB dimensions, not just its unit tests. |
| **Nightly** | Full automated suite against the Preview deployment (not just local), plus a scripted re-check of the two standing residual items (J-026's concurrency Stress Variant, Y-008) to see if the environment has changed enough to attempt closing them (e.g. a genuine parallel-connection test harness, or explicit per-grant authorization for Y-008's scale-building). |
| **Weekly** | Tier C's UX/presentation sweep (Pack S, Pack T, ACC). One pass through `docs/OPEN_PRODUCT_GAPS.md` Section C to check whether any deferred item's stated "trigger to revisit" has actually fired (e.g. DF-007's "the moment any code change adds a real call site for `getInvoiceFrequencyCadence`"). |
| **Monthly** | A targeted re-run of the DEV/TEST-environment-scale Pack Y journeys (Y-002 through Y-020) to re-measure actual accumulated scale against canonical targets, since the environment's real data volume grows every month this program (or regular use) continues; re-classify any journey that has now genuinely cleared its canonical target from PARTIAL to PASS. |
| **Quarterly** | A full fresh read of `docs/OPEN_PRODUCT_GAPS.md`, `docs/TECH_DEBT.md`, and this regression program itself, the same kind of documentation-consistency pass this final audit performed, to catch staleness before it accumulates across 33+ batches again. |
| **Before any Production promotion** | Tier A in full (automated + the Manual UX/Server/DB dimensions for every P0 journey family), a fresh `docs/OPEN_PRODUCT_GAPS.md` Section A check (must be empty), a fresh git/deploy state check (HEAD matches origin, main/Production untouched until this exact promotion), and a re-read of `NEXUS_RELEASE_EVIDENCE.md` to confirm no area's rating has silently regressed. |

---

## What this program deliberately does not do

- It does not rerun all 796 journeys on any cadence. That volume of
  manual UX verification is what made this one-time sweep take 33
  batches; repeating it routinely would make every release unaffordably
  slow without adding proportional signal, since the overwhelming
  majority of journeys test mechanisms that don't change between
  releases.
- It does not treat the DEV/TEST-environment-scale PARTIAL
  classifications as blocking. They are re-measured monthly (above) as
  the environment's real data accumulates, not force-closed by
  manufacturing synthetic volume, consistent with this program's own
  standing instruction never to fake scale.
- It does not invent new automated end-to-end browser tests as a
  blanket policy. Where a journey is rated FULL automation feasibility
  in the Coverage Matrix and already has a unit/integration test from its
  defect-closure, that test is the regression protection. Where a
  journey is rated MANUAL (32 across the catalogue, concentrated in Pack
  ACC, Pack R, and a handful of cross-domain checks), it stays a human
  judgment check on the cadence above, not a brittle browser-automation
  script pretending to replace human judgment.
