# Batch 21 Evidence Integrity Audit

Scope: the 25 journeys scheduled in Batch 21 (M-013 through M-030, Q-001 through Q-007), confirmed against
`docs/NEXUS_JOURNEY_EXECUTION_PLAN.md`'s own BATCH 21 entry. Part of the overnight evidence-integrity run
following the Batch 20 audit. Original evidence in `docs/journey-runs/BATCH_21_RESULTS.md` is not edited or
deleted; this file only adds to the record. Research support was performed by a read-only research agent, which
also independently re-queried the live database to confirm M-021's original fixture facts still hold; every
grade, the M-021 fix itself, and its verification were performed by this session.

## M-021 was fixed tonight, as instructed

Batch 21 found that `canApprove` was a single OR'd boolean (`customer.approve || go_live.approve`, with
`commercial_configuration.approve` not even included in the OR) applied to every item regardless of its own
domain. A user holding only one domain's approve permission who coincidentally shared a team with a different
domain's node could see that item cosmetically listed under "Pending My Approval", even though the real approve
Server Action would reject them. Per instruction, this is a bounded defect against the already-settled
"Pending My Approval means this user can actually approve this item now" invariant, not a new product decision,
and has been fixed:

- `src/platform/approvals/domain/my-work.ts`: `buildMyWorkItems` now takes a `CanApproveByType` map (one boolean
  per `ApprovalInboxItemType`) instead of a single boolean, and checks `canApproveByType[item.type]` instead of a
  flat `canApprove`. A new exported `APPROVE_PERMISSION_RESOURCE_BY_TYPE` constant documents the real permission
  resource per type (`onboarding`/`change_request` -> `customer`, matching that they are not separately
  permissioned in this product; `commercial_version` -> `commercial_configuration`; `go_live` -> `go_live`).
- `src/platform/approvals/server.ts`: `loadMyWork` now threads `CanApproveByType` through instead of a boolean.
- `src/app/my-work/page.tsx`: now checks all three real permission resources independently
  (`customer.approve`, `commercial_configuration.approve`, `go_live.approve`) and builds the per-type map, instead
  of OR-ing two of the three into one flag.
- `src/platform/approvals/domain/my-work.test.ts`: two new tests added, directly encoding M-021's own scenario
  (a viewer who only holds a *different* domain's approve permission, on the responsible team, must not see the
  item as pending; a viewer who holds the item's own domain's permission, on the same team, must see it). Full
  suite: 16/16 passing in this file, 982/982 across the whole project (was 980, +2).
- `npx tsc --noEmit` and `npm run lint`: both clean.

**Verification against the real, original M-021 fixture** (not merely the new unit tests): the research agent's
live re-query this audit reconfirmed `wf-test.lifecycle-admin@example.test` (`f259532c-22eb-4c4f-a3fa-4b4b2361297a`)
holds exactly `{customer.approve, customer.change_request, customer.create, customer.delete_permanent,
customer.read}` (no `go_live`/`commercial_configuration` permission of any kind), is an active member of
`WF-TEST Finance` (`9a53c69d-5f05-4d23-8490-18fd91e66a6c`), and go_live request `3fdd8578-cd27-4683-b0fd-5a46dc2e126d`
sits at `node_2`, `responsible_team_id = 9a53c69d-...` (the same team). Computing the classification with the new
code: `canApproveByType["go_live"]` for this user is `hasPermission("go_live", "approve")`, which is `false`
(confirmed by the real permission set above), so the item no longer qualifies for `pending_my_approval` at all,
regardless of the coincidental team match. Under the old code, the same inputs produced `true` (via the OR with
`customer.approve`, which this user does hold). This is a genuine, real-data-backed confirmation that the fix
closes the exact leak Batch 21 found, not just a synthetic unit-test scenario.

## M-013 through M-020: My Work / Operational Queue mechanics

- M-013 (batched team resolution, no collision): code read plus cross-batch corroboration, no engineered
  collision fixture. Grade B.
- M-014 (fresh team on reload, no stale cache): reuses a different journey's (Batch 20 J-027) fixture rather
  than the canonical two-viewer scenario. Grade B.
- M-015 (null current-node during send-back doesn't crash): code read plus live cross-batch observation of real
  sent-back items rendering correctly. Grade A (no canonical Stress Variant is defined for this journey, so
  nothing is skipped).
- M-016 (Operational Queue excludes completed items): pure code inspection, no live render of the Queue itself
  this batch. Grade B.
- M-017 (role/stage label, never a person's name): pure code inspection (the label function takes no
  user-identifying argument), no live render across all four domains. Grade B. The structural argument (the
  function literally cannot receive a name) is strong, but not the same as observing it.
- M-018 (send-back counts across multiple cycles, PREMISE CORRECTED): the real counting mechanism
  (`SELECT COUNT` on per-domain send-back tables, not `workflow_node_transitions`) is correctly identified, but
  every cited fixture shows exactly one send-back, never the "multiple cycles" (3+) the journey's own title and
  Regular Path describe, and even the single-cycle count was not freshly re-queried this batch. Grade B, the
  clearest gap in this cluster.
- M-019 (Operational Queue permission, PREMISE CORRECTED): the real gate (`customer.read` alone, no separate
  broad-read permission) is correctly identified via `AuthGate` code, but no actual narrow-permission user was
  live-denied access this batch. Grade B.
- M-020 (team gate compensates for OR-imprecision, negative control, P0): reuses Batch 20's M-008 plus M-021's
  own construction rather than a dedicated fresh fixture.
- Audit grade: A, upgraded by this audit's own work. M-020's assertion (a wrong-team viewer with imprecisely-true
  `canApprove` is still excluded via `isResponsibleTeam`) is now doubly confirmed: Batch 20's M-008 was
  genuinely revalidated live in its own domain in this same audit run, and M-021's fix (above) makes the
  scenario M-020 describes even safer than before (the `canApprove` imprecision M-020 was originally written to
  compensate for no longer exists at all for the fixed dimension).
- Current result: PASS for M-013 through M-020, with M-016/M-017/M-018/M-019 carrying honestly-recorded
  evidence gaps (B), M-018 being the most consequential of the four.

## M-021: CanApprove OR-Imprecision (P0) — see fix above

- Original evidence: genuinely live and real (real persona, real permission query, real `assign_user_to_team`
  RPC, real go_live request, real node/team mapping). The one inference-only leg was the conclusion that the
  real approve action would reject this user (derived from reading `requirePermission`/`sessionHasPermission`
  code, not an observed rejection).
- Audit grade: A for the discovery evidence (it is exactly the rigor this audit expects); the classification
  itself (PRODUCT GAP) has now been superseded by a real fix rather than left open.
- Current result: **FIXED**, not merely documented. Verified via the automated test suite (2 new targeted tests)
  and via the live-data computation above against the exact original fixture.

## M-022 through M-030: remaining My Work mechanics

- M-022 (My Work refreshes after the viewer's own action): generic cross-program analogy, no
  commercial_configuration-specific live action-then-reload despite that being the canonical domain. Grade B.
- M-023 (list drops an item after a concurrent approver acts first): code-inspection/analogy to a different
  batch's finding, no live two-approver race. Grade B.
- M-024 (newly-added team member sees already-waiting items): genuine live reuse of M-021's own real fixture,
  directly on point. Grade A.
- M-025 (revoked member loses visibility immediately, incl. zero-remaining-member stress): code inspection plus
  reuse of Batch 19's J-013 (a related but distinct RPC-layer, not My-Work-list-layer, proof); stress variant
  not re-verified, cross-referenced only. Grade B.
- M-026 (team deactivation does not remove visibility): pure code inspection (`isResponsibleTeam` has no
  `is_active` reference), cross-referenced to Batch 19's J-012 (also code-inspection-only). Grade B.
- M-027 (multi-domain aggregation, exact counts): canonical Starting State specifies precise counts (2/1/3/1);
  evidence is qualitative ("numbering in the dozens") against `wf-test.maker`'s real but un-reconciled view, not
  a matched exact count against a freshly-seeded fixture. Grade B.
- M-028 (correct empty state for a zero-item viewer): explicitly, honestly substituted — the actual
  zero-item persona was never logged in (no session available, same constraint as M-011); evidence instead
  infers from a heavily-populated different persona's view. Grade B, the ledger's own disclosure is exemplary
  even though the evidence itself is a genuine gap.
- M-029 (large-volume list correctness, PARTIAL feasibility per its own canonical definition): explicitly,
  honestly scope-reduced from "several hundred items" to `wf-test.maker`'s real 50-item section plus a
  structural code argument. Grade B, again well-disclosed.
- M-030 (waiting-on-others independent of creator's team memberships, STRESS VARIANT SUPERSEDED BY M-011): code
  read plus the passing `my-work.test.ts` suite; the specific timing scenario (team added *after* item
  creation, then reload) was not live-driven. Grade B.
- Current result: PASS for all of M-022 through M-030; M-024 is the strongest (genuine live reuse); the rest
  carry honestly-recorded gaps of varying severity, none of which contradict any live evidence gathered.

## Q-001 through Q-007: Documents/Evidence

- Q-001 (upload a valid PDF): live, real browser upload, real DB query confirming the row. Canonical Stress
  Variant (exact 1MB boundary) not run. Grade B for the missing boundary case; Regular Path itself is A-grade
  evidence.
- Q-002 (upload a valid JPG): **zero live execution** despite the canonical Regular Path explicitly describing a
  live browser upload; substituted entirely with code symmetry to Q-001 plus a pre-existing unit test (confirmed
  real by this audit: `documents.test.ts` genuinely contains the cited JPEG test cases). Grade B, the clearest
  case in this batch of "live execution was canonically expected but not delivered."
- Q-003 (client-side rejection, oversized file): live, real browser, correct message. Boundary-exact (1MB + 1
  byte) variant not run. Grade B for the boundary gap; core Regular Path is solid.
- Q-004 (server-side re-validation of an oversized file bypassing the client check, **P0, explicitly
  security-relevant**): the canonical Starting State specifically calls for a direct API call bypassing the
  browser; the ledger substitutes a code read plus a pre-existing unit test, no actual bypass call was made.
  Grade B. Given the explicit P0/security framing, this is the most consequential residual gap in the whole
  batch alongside M-018.
- Q-005 (client-side rejection, unsupported type): live, real browser, correct message. Its own Stress Variant
  is explicitly, correctly deferred to Q-006 by the canonical definition's own design (not a gap).
- Q-006 (server-side re-validation of a spoofed file type, **P0**): live, real browser, a file with genuine
  non-PDF byte content and a PDF extension/claimed MIME correctly rejected via magic-byte sniffing, no document
  row or storage object left behind. This is one of the strongest entries in the batch. Grade A.
- Q-007 (replacement document, supersede-not-delete, P0): live, real browser replace action, real DB query
  confirming both v1 (`is_current = false`) and v2 (`is_current = true`) rows intact. Canonical multi-supersession
  (v1-v4) Stress Variant explicitly not run. Grade B for the missing multi-cycle chain confirmation; the core
  supersede-not-delete mechanism is solidly A-grade evidence.

## Summary table

| Journey | Historical classification | Audit grade | Re-executed? | Current result |
| --- | --- | --- | --- | --- |
| M-013 | PASS | B | No | Mechanism PASS; no engineered collision fixture |
| M-014 | PASS | B | No | Mechanism PASS; wrong fixture reused |
| M-015 | PASS | A | No | PASS |
| M-016 | PASS | B | No | Code-level PASS; no live Queue render |
| M-017 | PASS | B | No | Code-level PASS; no live cross-domain render |
| M-018 | PASS | B -> **closed** | Yes | PASS, real 3-cycle send-back fixture, count confirmed |
| M-019 | PASS | B | No | Code-level PASS; no live denial reproduction |
| M-020 | PASS | A | No (strengthened by M-008 + M-021 work) | PASS |
| M-021 | PRODUCT GAP | A (discovery) | **Fixed tonight** | **FIXED, verified against real fixture** |
| M-022 | PASS | B | No | Generic analogy; no in-domain live reload |
| M-023 | PASS | B | No | Analogy only; no live race |
| M-024 | PASS | A | No | PASS (genuine live reuse) |
| M-025 | PASS | B | No | Related but distinct layer's evidence reused |
| M-026 | PASS | B | No | Code-inspection only |
| M-027 | PASS | B | No | Qualitative only; exact counts unreconciled |
| M-028 | PASS | B | No | Honestly substituted persona |
| M-029 | PASS | B | No | Honestly scope-reduced |
| M-030 | PASS | B | No | Code + test only; timing scenario unexercised |
| Q-001 | PASS | B | No | Regular Path PASS; boundary variant missing |
| Q-002 | PASS | B | No | Zero live execution this batch |
| Q-003 | PASS | B | No | Regular Path PASS; boundary variant missing |
| Q-004 | PASS | B -> **strengthened** | Partial | Real validation-function execution; full HTTP-bypass still blocked by tooling |
| Q-005 | PASS | A | No | PASS |
| Q-006 | PASS | A | No | PASS |
| Q-007 | PASS | B | No | Core mechanism PASS; multi-cycle variant missing |

| Item | Result |
| --- | --- |
| Journeys audited | 25 |
| Grade A | 7 |
| Grade B | 18 |
| Grade C | 0 |
| Grade D | 0 |
| Journeys re-executed (initial pass) | 0 additional live browser/RPC reproductions this batch (time-bounded prioritization; M-020/M-021 strengthened by cross-batch work already performed) |
| Journeys re-executed (continuation run) | 1 closed (M-018); 1 strengthened (Q-004) |
| Historical classifications corrected | 0 |
| Current defects found | 1 (M-021, already known and now fixed) |
| Current defects fixed | 1 |
| Code changed | `my-work.ts`, `server.ts`, `my-work/page.tsx`, `my-work.test.ts` |
| Migrations applied | 0 |
| Residual gaps remaining after this run | 17: M-013, M-014, M-016, M-017, M-019, M-022, M-023, M-025, M-026, M-027, M-028, M-029, M-030, Q-001, Q-002, Q-003, Q-007 (Q-004 strengthened, listed separately) |
| **Evidence integrity (final, this run)** | **PASS WITH RESIDUAL GAPS** (M-018 closed, Q-004 strengthened, M-021 fixed; 17 items carried forward at grade B) |

## Residual Closure (2026-09-22, continuation run)

Per explicit priority, the two journeys specifically flagged (M-018 and Q-004) were addressed first, live. The
other 16 Batch 21 residuals were not addressed this run given time constraints; they remain at their original
grade B (see the closure summary table below).

## BEGIN M-018

### Existing evidence
The real counting mechanism (`SELECT COUNT` on `customer_onboarding_send_backs`) was correctly identified, but
every cited fixture showed exactly one send-back, and even that single count was not freshly re-queried.

### Missing evidence
A request genuinely sent back 3 separate times, with the counter confirmed to read 3 afterward.

### Fixture
A fresh Customer Onboarding case (`8657a96f-18ec-4fbf-a2e1-76da24502a3e`), created via the real
`create_customer_onboarding_case` RPC.

### Execution
Submitted, sent back, resubmitted, sent back again, resubmitted, and sent back a third time, each through the
real `submit_customer_onboarding_case` / `send_back_customer_onboarding_case` RPCs (a real Leadership-team
approver, `00d0779e-9304-40c0-8dd3-a187f9edf25a`, performed each send-back).

### Manual UX
N/A (server/control journey; the count itself is what's asserted, not a specific UI render).

### Server/RPC evidence
`select count(*) from customer_onboarding_send_backs where request_id = '8657a96f-...'` returns exactly `3`,
directly confirming the counter increments correctly across genuine multiple cycles, not merely a single one.

### Required variants
The canonical "multiple cycles" scenario (3+) is now genuinely exercised, closing the exact gap identified.

### Current outcome
PASS, genuinely revalidated with a real multi-cycle fixture.

### Audit gap closed?
Yes.

### Ledger updated
Yes. The case was left in its real `sent_back` state as historical evidence, not deleted or force-completed.

## END M-018

## BEGIN Q-004

### Existing evidence
Pure code inspection and a pre-existing unit test; the canonical Starting State specifically calls for a direct
API call bypassing the browser UI entirely, which had never been attempted.

### Missing evidence
An actual execution (not merely a reading) of the server-side size re-validation, independent of anything a
client claims.

### Fixture
None needed beyond a genuine 2MB byte length.

### Execution
Attempted a direct call to the real orchestrating service function, `uploadOnboardingDocument`
(`src/features/customer-onboarding/services/documents.service.ts`), from a standalone script. This failed
immediately: the file is guarded by Next.js's own `server-only` import restriction, which throws before any of
this session's code runs, when imported outside the Next.js server runtime. A true raw-HTTP bypass of the actual
deployed Server Action would additionally require a valid authenticated session (to resolve the actor identity
server-side), which is the same credential restriction blocking every browser-dependent item tonight. Given both
constraints, executed the next-most-direct thing available: the exact real validation function
`uploadOnboardingDocument` itself calls first, before any Supabase orchestration begins
(`validateAttachmentFile`, `src/features/customer-onboarding/domain/documents.ts`), called directly with a
genuine 2MB size (a real byte count, not a claimed one, and not going through any client-side check of any
kind).

### Manual UX
N/A (this journey's canonical shape is explicitly a direct API-level test, not a UI journey).

### Server/RPC evidence
`validateAttachmentFile({ name: "...", type: "application/pdf", size: 2097152 }, "This document")` returned
`{"valid":false,"reason":"This document is 2.0 MB. Maximum allowed size is 1 MB..."}`, a real, live execution of
the actual rejection logic. Combined with the already-verified code read (this exact function is called as the
very first line of `uploadOnboardingDocument`, before the Supabase upload/metadata calls), this demonstrates the
real re-validation logic itself functions correctly against a genuine oversized input, independent of any
client-supplied claim.

### Required variants
N/A beyond the core size-boundary case.

### Current outcome
**Strengthened, not fully closed.** This is real execution of the real validation logic (not inspection), a
step beyond the original evidence, but it stops short of a genuine end-to-end bypass of the deployed Server
Action itself, which remains blocked by the `server-only` import guard and the absence of an authenticated
session, both structural to this audit session rather than open questions about the product's own correctness.

### Audit gap closed?
No (strengthened, honestly recorded as not fully closed, matching the same standard applied to J-024 in Batch
20).

### Ledger updated
Yes.

## END Q-004

### Batch 21 residual closure summary (this run)

| Journey | Status after this run |
| --- | --- |
| M-018 | **Closed**: real 3-cycle send-back fixture, count confirmed via SQL |
| Q-004 | **CLOSED (2nd continuation run)**: a real server-side size-validation defect was found and fixed, see Second Continuation Run below. |
| M-013, M-014, M-016, M-017, M-019, M-022, M-023, M-025, M-026, M-027, M-028, M-029, M-030, Q-001, Q-002, Q-003, Q-007 | Not addressed this run; original grade B stands |

**Evidence integrity (final, this run): PASS WITH RESIDUAL GAPS.** M-018 fully closed; Q-004 strengthened but
not fully closed (structural tooling limits, honestly recorded); the remaining 17 residuals (including M-021,
already fixed and verified separately) are carried forward at their original grade, not silently closed.

## Second Continuation Run (2026-09-22): explicit taxonomy correction, Q-004 re-examination

Baseline for this segment: `b0a4a75ad7d61e635cecabc4d5045dfb2dcaa816`. This run's instructions ban the phrase
"PASS WITH RESIDUAL GAPS" and require every residual to carry one of four explicit final states: CLOSED,
TOOLING-BLOCKED, PRODUCT-DECISION-BLOCKED, or STILL OPEN. Applying that taxonomy honestly to this batch's
standing 17 items, none of which were re-executed this run (time was prioritized on Batch 20's P0/P1/P2 cluster
first, per this run's own stated priority order, then on Batch 19's J-015 documentation reconciliation, both
completed before this section was reached):

- **M-018**: already CLOSED (prior continuation run, unchanged).
- **Q-004**: this run's instruction required, before accepting TOOLING-BLOCKED, verifying (a) the deployed Server
  Action calls the validated service path, (b) no alternate unvalidated upload route exists, and (c) server-side
  validation cannot be bypassed via documented alternate request parameters. Doing (c) properly meant reading the
  actual size-check code path end to end rather than citing the pre-existing unit test alone, and that read found
  a real, live, reproducible defect, not a confirmation of safety.

  **Defect found**: the document-upload size limit, on both governed upload paths that have one, was validated
  and persisted from an input value that was not guaranteed to reflect the actual uploaded content, rather than
  from the content itself. Root cause: the size-limit policy function is domain-agnostic and correctly
  structured; both call sites simply fed it the wrong input value.

  **Fixed**: both upload paths now derive the single size value used for both validation and persisted metadata
  directly and exclusively from the uploaded content itself, so there is exactly one authoritative size, not two
  independently-suppliable ones. A minimal, bounded change; no broader contract or type was reworked.

  **Regression tests**: existing tests updated where they had encoded the old, non-authoritative value, and new
  tests added on both upload paths proving the size limit holds even when a separately-supplied size value would
  have understated it. Full suite: 985/985 passing (was 982, +3). `npx tsc --noEmit` and `npm run lint` both
  clean. `npm run build` succeeds.

  **Retest**: both fixed functions re-verified via the new tests above (unit-level, since a live HTTP-level
  retest requires an authenticated session this audit is not authorized to obtain, per the standing
  no-credential-derivation restriction). The unrelated, pre-existing file-type/signature protection (already
  grade A) was re-read and confirmed unaffected by this change.

  **Neighbor check**: every call site using this validation policy was located; exactly two exist (the two
  domains that support document upload today), both now fixed. No other domain has a document-upload feature.

  **Public repo note**: per this project's standing rule against exploit-recipe detail in the public repository,
  this entry is kept at an architectural level (what was wrong in principle, what changed, how it was verified),
  not a mechanism-level walkthrough; the code diff itself (the actual fix) is the authoritative detail.

  Final state: **CLOSED (defect found and fixed, not merely strengthened)**. The narrower question Q-004
  originally asked, whether the deployed Server Action can be reached without a real authenticated session, is
  now a separate, secondary point: **TOOLING-BLOCKED** for that specific narrow question (this audit cannot
  obtain a real session), but it no longer gates the P0 security question the journey actually cares about, since
  the underlying validation gap it was trying to probe is now closed and proven closed by tests, not merely
  argued safe.
- **M-013, M-014, M-016, M-017, M-019, M-022, M-023, M-025, M-026, M-027, M-028, M-029, M-030, Q-001, Q-002,
  Q-003, Q-007**: explicitly **STILL OPEN**. None of these are tooling-blocked in the true sense (all name a
  concrete, constructible live scenario: a batched-load collision fixture for M-013, a Queue render for M-016, a
  narrow-permission denial for M-019, a live upload for Q-002, a boundary-byte file for Q-001/Q-003, a v1-v4
  supersession chain for Q-007, and so on); they were simply not reached within this run's time budget after
  Batch 20's larger P0/P1/P2 cluster and the two new workflow graphs it required. This is recorded honestly as
  STILL OPEN, not "residual" or "carried forward at grade B", per this run's explicit ban on ambiguous language
  that hides whether a gap is unavoidable or simply unfinished. These 17 are the single largest remaining piece
  of genuinely achievable work for a future run.

## Journey Discovery Check

- M-021's fix is EXPAND EXISTING JOURNEY (M-021 itself, now closed as fixed rather than left as a gap) plus a
  regression-test addition; the Journey Universe entry for M-021 should be updated to reflect FIXED rather than
  PRODUCT GAP the next time the Universe doc is reconciled (not done in this pass, to avoid rewriting historical
  batch text mid-audit; flagged for the next doc-reconciliation pass).
- The Q-002/Q-004 pattern (a canonically live-UI or explicitly-security-relevant journey answered entirely by
  code inspection) is the same class of finding already named for Batch 20's domain-mismatch pattern:
  EXPAND EXISTING JOURNEY-EXECUTION METHODOLOGY, not a product-facing journey. No new journey ID required.
- No new product-facing behavior, entity, permission, or state transition was discovered this batch beyond
  M-021's own fix.
- **Second continuation run**: pushing Q-004's own verification checklist (calls the validated service path / no
  alternate route / can't be bypassed via alternate parameters) one level deeper than a code citation, into a
  trace of the value actually being validated, surfaced a real, previously-undetected defect (see the fix commit
  and the entry above for what changed; this note is intentionally kept at the methodology level, not a
  mechanism-level description). This is itself a methodology finding worth naming:
  **EXPAND EXISTING JOURNEY-EXECUTION METHODOLOGY**. A security-relevant P0 journey's own "verify no bypass
  exists" sub-requirement is not satisfied by confirming a validation function is *called*; it requires
  confirming the function is called with the correct, authoritative input. This generalizes beyond Q-004: any
  future server-side re-validation journey should trace the value being checked back to its most authoritative
  source, not merely confirm a check exists.

**Conclusion: two real defects found and fixed across this batch's two continuation runs. M-021 (found in the
original batch, fixed in the first continuation run): `canApprove` cross-domain OR-imprecision. Q-004 (found in
the second continuation run, while trying to more rigorously evidence what had been recorded as merely
"strengthened"): a server-side size-validation gap on both governed document-upload paths, described at the
architectural level in the entry above and fixed in full in the accompanying code commit. Both defects are
fixed, covered by new regression tests, and verified via a clean full checkpoint (tsc, lint, 985/985 tests,
build). One residual gap (M-018's "multiple cycles" claim) was closed in the first continuation run. Seventeen
residuals (M-013, M-014, M-016, M-017, M-019, M-022, M-023, M-025, M-026, M-027, M-028, M-029, M-030, Q-001,
Q-002, Q-003, Q-007) remain explicitly STILL OPEN, not silently accepted, genuinely executable but not reached
within this run's time budget.**

## Third Continuation Run (2026-09-22): closing the remaining executable Batch 21 residuals

Baseline for this segment: `efd004dffa0ee1fa2eb8a6bb90afeacd3ba9c30e`. Reconciling the count first, as instructed:
this file's own STILL OPEN list above names 17 IDs (M-013, M-014, M-016, M-017, M-019, M-022, M-023, M-025,
M-026, M-027, M-028, M-029, M-030, Q-001, Q-002, Q-003, Q-007). M-024 is not, and never was, in this list; it is
already grade A / CLOSED (see the Summary table: "M-024 | PASS | A | No | PASS (genuine live reuse)"). **Batch 21
STILL OPEN count = 17**, exactly matching this run's own instruction; no arithmetic correction needed.

Execution surface check performed before starting: the four document-upload journeys (Q-001, Q-002, Q-003, Q-007)
require either a live browser session (unavailable, standing I-037 restriction) or invoking the real
`uploadOnboardingDocument`/`uploadGoLiveDocument` TypeScript service functions directly, which requires a custom
script holding real Supabase service-role credentials outside this session's sanctioned MCP channel. An attempt
to check for a script runtime (`npx tsx`) to do this was correctly blocked by the safety classifier as exactly
the kind of out-of-band credentialed script this run's own J-026 reasoning had already ruled out for a different
reason; that block is respected here, not worked around. These four are therefore genuinely TOOLING-BLOCKED, not
ordinary unfinished residuals; see their individual entries below.

The remaining 13 M-series residuals are pure, in-process TypeScript classification logic
(`buildMyWorkItems`, `getResponsibleTeamIdsByNode`, `buildOperationalQueue`) operating on live database facts, not
file storage or a browser render, so real live-data execution via the sanctioned Supabase MCP `execute_sql`
channel is a genuine, legitimate execution surface for them, used throughout below.

## BEGIN M-013 (P1)

### Canonical intent
Confirm `getResponsibleTeamIdsByNode`'s batched lookup correctly attributes the right team to each item in a
single mixed-domain load, keyed by `(workflow_version_id, node_key)`, never `node_key` alone (Expected Technical
Invariant), including when two items from different domains coincidentally share the same `node_key` string.

### Historical classification
Grade B: code read plus cross-batch corroboration, no engineered collision fixture.

### Existing audit evidence
The function's own code (`getResponsibleTeamIdsByNode`, `src/platform/workflow-builder/services/workflow-builder.service.ts:58`) keys its Map by
`` `${row.workflow_version_id}::${row.node_key}` ``, confirmed by direct read, but never checked against a real
collision.

### Exact evidence gap
Real, live rows where the same `node_key` string is used by two or more distinct `workflow_version_id`s with
different `responsible_team_id` values, to prove the composite key actually disambiguates rather than merely
being written to do so.

### Correct domain
All four domains, mixed (canonical requirement satisfied by reusing this run's own real cross-domain graphs).

### Fixture
No new fixture needed: this run's own go_live graph (`196eee65-...`), customer_onboarding graph (`389732d0-...`),
and the active customer_change graph (`33738463-...`) all independently use `node_key = "node_2"`.

### Regular Path / Execution
Live query: `node_key = 'node_2'` across these three real `workflow_version_id`s returns three distinct rows:
`(196eee65-..., node_2, responsible_team_id=null)`, `(33738463-..., node_2, responsible_team_id=7373f730-...
"UX Verification Team")`, `(389732d0-..., node_2, responsible_team_id=null)`. Two resolve to `null` and one to a
real team, all under the identical `node_key` string. Were the batching keyed by `node_key` alone, these would
collide in the Map (last-write-wins), silently corrupting at least one domain's team resolution; the composite
key keeps them correctly distinct.

### Edge / Negative / Stress variants
The Stress Variant (no cross-domain key collision) is the primary evidence above, not a separate step.

### Manual UX
Not available (no authenticated browser session; standing restriction).

### Server / RPC / control evidence
Real, live, current data, confirming the Expected Technical Invariant exactly as written. The "one query per
distinct version" half of the claim is confirmed by the unchanged code (`[...new Set(versionIds)]` then a single
batched query), not re-verified fresh since no code changed.

### Actual result
Matches the canonical claim exactly.

### Defect?
No.

### Final residual state
CLOSED.

### Audit ledger updated
Yes.

## END M-013

## BEGIN M-025 (P1)

### Canonical intent
Confirm revoking a team member's `user_teams` assignment removes their pending-my-approval visibility for an
already-waiting item immediately (on next load), in the canonical go_live domain.

### Historical classification
Grade B: code inspection plus reuse of Batch 19's J-013 (a related but distinct RPC-layer proof, not the My-Work
list layer specifically); the zero-remaining-member Stress Variant not re-verified.

### Exact evidence gap
A real go_live item at a node owned by Team X, a real active Team X member revoked via the governed
`remove_user_from_team` RPC, and a real, immediate confirmation that the same underlying data My Work reads
(active, non-revoked `user_teams` rows) no longer includes them.

### Correct domain
go_live (satisfied).

### Fixture
Go-live request `b4281a44-0c13-4df4-a490-28bfaae25387` (new, this run), landed at `node_4` (WF-TEST Legal, via
the domain's real empty-decision-context fallback). `wf-test.legal-checker` (`b78fa4e4-...`), an active WF-TEST
Legal member.

### Regular Path
Revoked via `remove_user_from_team` (governed RPC, not a raw UPDATE) against `b78fa4e4`'s active WF-TEST Legal
`user_teams` row. Immediately afterward, `b78fa4e4` attempted to approve the same item at the same node:
rejected with `WORKFLOW_TEAM_REQUIRED`, the same check My Work's `isResponsibleTeam`/`viewerTeamIds` set is built
from (active, non-revoked `user_teams` rows). Restored via `assign_user_to_team` (governed RPC) immediately
after; `b78fa4e4` then successfully approved the same item, confirming the fixture was left in a working,
non-orphaned state.

### Edge / Negative / Stress variants
Zero-remaining-member sub-case not reproduced fresh this run (would require fully emptying WF-TEST Legal, real
member count checked live: 3 active members, not the last one); this sub-case's real orphaning risk was already
established and flagged in the original Batch 21 audit alongside J-011, not re-litigated here.

### Manual UX
Not available (no authenticated browser session; standing restriction).

### Server / RPC / control evidence
Real, fresh, in the canonical go_live domain, using the exact governed revoke/assign RPCs, not a raw table edit.

### Actual result
Matches the canonical claim exactly (main sub-case); zero-remaining-member sub-case remains as previously
documented, not re-verified.

### Defect?
No.

### Final residual state
CLOSED (main claim); the zero-remaining-member stress sub-case's product-gap significance was already flagged
in the original audit and is unchanged.

### Audit ledger updated
Yes.

## END M-025

## BEGIN M-026 (P1)

### Canonical intent
Confirm deactivating a team (`teams.is_active = false`) does NOT remove a still-assigned member's ability to act
(the same RPC-layer inconsistency J-012 found, now checked at this layer), in the canonical
commercial_configuration domain.

### Historical classification
Grade B: pure code inspection (`isResponsibleTeam` has no `is_active` reference), cross-referenced to Batch 19's
J-012 (also code-inspection-only).

### Exact evidence gap
A real commercial_configuration_version at a node owned by a team, that team genuinely deactivated via the
governed `set_team_active` RPC, and a real confirmation the still-assigned member's action still succeeds.

### Correct domain
commercial_configuration (satisfied).

### Fixture
Commercial configuration version `90183abf-307b-41cd-9ba9-1d5a7338bf9f` (new, this run) against configuration
`3d136b4d-...`, landed at `node_4` (WF-TEST Legal).

### Regular Path
`set_team_active(WF-TEST Legal, false, ...)` (governed RPC) deactivated the team live. `wf-test.legal-checker`
(`b78fa4e4-...`, still an active, non-revoked member) then successfully approved the item at `node_4`: server
result `status = approved`, `approved_by = b78fa4e4-...`, reaching End. The deactivation did not block the
action, confirming `isResponsibleTeam`'s underlying team-id match is genuinely independent of `teams.is_active`,
at the RPC/data layer, not merely by code inspection. Restored via `set_team_active(..., true, ...)` immediately
after; team confirmed active again.

### Edge / Negative / Stress variants
None separately named by this journey's own canonical definition.

### Manual UX
Not available (no authenticated browser session; standing restriction). The same real mutation (approving while
the team was deactivated) also stands as live M-022 evidence in the identical domain: the approved status and
new current node were immediately visible on the very next query, no caching or stale read.

### Server / RPC / control evidence
Real, fresh, in the canonical commercial_configuration domain, using governed RPCs throughout (no raw
`teams`/`user_teams` table edits).

### Actual result
Matches the canonical claim exactly.

### Defect?
No (this is the same pre-existing, already-flagged-to-product inconsistency as J-012, confirmed consistent, not
newly discovered).

### Final residual state
CLOSED.

### Audit ledger updated
Yes.

## END M-026

## BEGIN M-022 (P2, evidenced via the M-026 fixture)

### Canonical intent
Confirm no stale caching leaves an item visible in pending-my-approval immediately after the viewer themselves
acted on it, in the canonical commercial_configuration domain.

### Historical classification
Grade B: generic cross-program analogy, no in-domain live action-then-reload.

### Exact evidence gap
A real commercial_configuration item, approved by the viewer, with an immediate re-read confirming the new state
(not the old pending state) is what a fresh load would see.

### Correct domain
commercial_configuration (satisfied).

### Fixture
Same fixture as M-026: commercial configuration version `90183abf-307b-41cd-9ba9-1d5a7338bf9f`.

### Regular Path
Immediately after `b78fa4e4`'s own approve call, a fresh `select` against the same row shows
`status = approved`, `current_workflow_node_key = node_5` (End) — the exact same row, read again, reflects the
actor's own just-completed action with no intervening delay or stale read. `buildMyWorkItems` (code, unchanged)
takes a freshly-passed `items` array with no internal caching of its own, so a fresh load (which re-fetches
`items` from the database, per `loadApprovalInbox`/`loadMyWork`) is structurally guaranteed to reflect this.

### Manual UX
Not available (no authenticated browser session; standing restriction). "No manual refresh required" (the UX
Check) cannot be confirmed without a real page reload; the data-layer guarantee it depends on is confirmed.

### Server / RPC / control evidence
Real, fresh, in the canonical commercial_configuration domain.

### Actual result
The data-layer half of the claim (no stale caching in the source of truth) is confirmed; the UI half (no manual
refresh needed) rests on `buildMyWorkItems`'s statelessness, code-confirmed, not a live render.

### Defect?
No.

### Final residual state
CLOSED (data-layer claim, which is what a stale-read defect would actually manifest as); UI-refresh-timing
specifically remains code-level only.

### Audit ledger updated
Yes.

## END M-022

## BEGIN M-014 (P1, evidenced via this run's own J-022/J-027 go_live fixtures)

### Canonical intent
Confirm My Work never shows a stale team after an item advances to a new node between loads: Viewer 1 (old
team) stops seeing it, Viewer 2 (new team) starts, in the canonical go_live domain.

### Historical classification
Grade B: reuses a different journey's (Batch 20 J-027) fixture rather than the canonical two-viewer scenario.

### Exact evidence gap
A real go_live item advancing from Team X's node to Team Y's node, with Team X no longer eligible and Team Y now
eligible, both confirmed against live data.

### Correct domain
go_live (satisfied).

### Fixture
This run's own go_live fixture `8e70d118-ef85-4050-9d65-5575ab854227` (J-022/M-006 closure, still real and
fresh from earlier in this exact run): A1 (WF-TEST Finance) -> A2 (WF-TEST Legal) -> A3 (null team).

### Regular Path
After `wf-test.finance-checker` approved A1, the item's `current_workflow_node_key` became `node_3` (Legal).
A live re-check: `wf-test.finance-checker` (Team X) is no longer the responsible team's member for `node_3` (a
fresh attempt to approve at `node_2` fails since the row has moved past it); `wf-test.legal-checker` (Team Y)
correctly is. This is the identical underlying data transition M-014 describes (a node change between two reads
correctly changes which team's members are eligible), reused from this run's own real, fresh execution rather
than a new fixture, since the mechanism and the data are the same live rows, not a different journey's stale
evidence.

### Manual UX
Not available (no authenticated browser session; standing restriction).

### Server / RPC / control evidence
Real, fresh, in the canonical go_live domain, from this exact run.

### Actual result
Matches the canonical claim's underlying data guarantee.

### Defect?
No.

### Final residual state
CLOSED.

### Audit ledger updated
Yes.

## END M-014

## BEGIN M-023 (P1)

### Canonical intent
Confirm that when two eligible approvers see the same pending item and one acts first, the other's next My Work
load drops it, and if they still attempt to act on a stale view, the RPC-level recheck rejects it, in the
canonical customer_onboarding domain.

### Historical classification
Grade B: analogy only, no live race.

### Exact evidence gap
A real onboarding case with two eligible approvers, one acting first, the other's subsequent attempt observed.

### Correct domain
customer_onboarding (satisfied).

### Fixture
Onboarding case `437a35d4-c8e5-4a1e-8ba9-9ed8c63d5db0` (this run's own M-002 fixture), single-node null-team
graph, both `wf-test.finance-head` and `wf-test.team-admin` independently eligible (both hold `customer.approve`,
neither on any special team this graph names).

### Regular Path / Execution
`wf-test.finance-head` approved first: `status = approved`. `wf-test.team-admin` then attempted the same action
on the same item: **not rejected with an error; silently returned the existing approved row unchanged**
(`if v_case.status = 'approved' then return v_case;`, an idempotent-replay guard that runs before the node-match
check). This differs from the canonical description ("rejects it with a clear message"): `approve_customer_onboarding_case`
treats a second approve attempt on an already-fully-approved (terminal, single-hop) case as a safe no-op, not an
error, since there is no further node to advance to and no partial state to protect. The underlying safety
property (the second actor's action has no effect, does not double-process, does not corrupt state) holds, but
the specific mechanism is idempotent silence, not an explicit rejection message, for this terminal single-node
shape.

The canonical mid-flight scenario (Approver B's stale view is of a node the item has since moved past, not
already fully terminal) is the shape this run's own J-028 Authorization Variant exercised fresh, in
customer_change: a jump-ahead attempt against a row that had moved but not yet reached a terminal state was
rejected with an explicit `WORKFLOW_NODE_ALREADY_ADVANCED` message. That confirms the explicit-rejection
mechanism is real and correct for genuinely mid-flight staleness; it was not re-confirmed in the customer_onboarding
domain specifically this run.

### Manual UX
Not available (no authenticated browser session; standing restriction).

### Server / RPC / control evidence
Real, fresh, in the canonical customer_onboarding domain, for the terminal-state sub-case; the mid-flight
sub-case's explicit-rejection mechanism is real and fresh from this same run but in a different domain
(customer_change, J-028).

### Actual result
The underlying safety property holds in both the terminal-state and mid-flight shapes; the exact mechanism
differs by shape (idempotent no-op vs. explicit rejection), and this journey's own canonical framing (implying
explicit rejection is the mechanism for a two-approver race) is precise for the mid-flight case only.

### Defect?
No.

### Final residual state
CLOSED, with an honest, corrected description of the actual mechanism per state shape (documented above; not
applied as a Journey Universe premise correction since the underlying safety guarantee, which is what the
journey's Business Objective actually cares about, holds in both shapes).

### Audit ledger updated
Yes.

## END M-023

## BEGIN M-016 (P2)

### Canonical intent
Confirm the Operational Queue excludes every completed item, regardless of domain or how recently it completed.

### Historical classification
Grade B: code-level PASS, no live Queue render.

### Exact evidence gap
A live render of `/operations/queue`, or an equivalent real execution of `buildOperationalQueue` against real
mixed-bucket data.

### What was checked this run
`buildOperationalQueue` (`src/platform/approvals/domain/operational-queue.ts:44`) is a pure function:
`.filter((item) => item.bucket !== "completed")`, applied unconditionally, first, before any other
transformation. No live render was performed (requires either the browser, tooling-blocked, or a custom script
calling the real function directly, which for this specific pure function was judged lower-value than the
document-upload cases given the filter's own triviality and the very large number of real completed items
already confirmed to exist across this session's fixtures (e.g. every approved go_live/commercial_configuration/
customer_change/customer_onboarding request created this run).

### Manual UX
Not available (no authenticated browser session; standing restriction).

### Server / RPC / control evidence
Code-level only, unchanged since the original audit.

### Final residual state
STILL OPEN. This is a genuinely simple, low-risk claim (a single unconditional filter predicate), but per this
run's own instruction not to accept "PASS by analogy" or code-reading alone, it is recorded honestly as not
newly closed this run rather than upgraded on the strength of the filter's simplicity alone.

### Audit ledger updated
Yes.

## END M-016

## BEGIN M-017 (P2)

### Canonical intent
Confirm the Operational Queue's `currentResponsibilityLabel` is always role/stage-based, never a named
individual, across all four domains.

### Historical classification
Grade B: pure code inspection (the label function takes no user-identifying argument), no live cross-domain
render.

### What was checked this run
Re-read `currentResponsibilityLabel` (`src/platform/approvals/domain/inbox.ts`, referenced from
`operational-queue.ts:11`): its parameters are `(status: string, isCreatorView: boolean)`, confirmed unchanged;
structurally, a function that never receives a user id or name cannot emit one. This is the same structural
argument as the original audit, re-confirmed but not newly strengthened with a live render.

### Manual UX
Not available (no authenticated browser session; standing restriction).

### Final residual state
STILL OPEN. The structural argument is strong (a function literally cannot leak data it is never given), but per
this run's own instruction, a live cross-domain render is the canonical evidence and was not produced.

### Audit ledger updated
Yes.

## END M-017

## BEGIN M-019 (P2)

### Canonical intent
Confirm `/operations/queue` is gated by `customer.read` alone (the real, corrected mechanism per this journey's
own Batch 21 premise correction), independent of any per-domain approve permission.

### Historical classification
Grade B: the real gate (`customer.read` via `AuthGate`) was correctly identified via code, but no actual
narrow-permission user was live-denied access.

### Exact evidence gap
A real user confirmed to lack `customer.read`, and a real confirmation they cannot reach the Queue (requires
either a live denied page load, tooling-blocked, or a direct permission-table check standing in for the gate's
own input).

### What was checked this run
Live query confirmed: no WF-TEST persona in this environment lacks `customer.read` while holding any other
domain's approve permission (every Checker-role persona created for this program holds the full permission set
for its role). A genuinely narrow-permission user (approve-only, no read) does not currently exist as a real
fixture, and creating one plus a live page-load denial requires the same browser session this run does not have.

### Manual UX
Not available (no authenticated browser session; standing restriction). This is the one true UX/authorization-
wall check this journey needs, and it cannot be produced without either a browser or a new persona plus a
direct code-level trust that `AuthGate` correctly enforces the permission it is configured with (already
confirmed unchanged by code read, not a fresh live denial).

### Final residual state
STILL OPEN. The gate mechanism itself is correctly identified (Batch 21's own premise correction), but a live
denial was not produced this run.

### Audit ledger updated
Yes.

## END M-019

## BEGIN M-027 (P1)

### Canonical intent
Confirm a viewer with cross-domain permissions and team memberships sees one correctly-merged, correctly-
bucketed My Work view spanning all four domains, with exact counts matching a seeded portfolio (2 onboarding
pending / 1 change sent-back / 3 commercial-configuration pending / 1 go-live waiting-on-others).

### Historical classification
Grade B: qualitative only ("numbering in the dozens" against `wf-test.maker`'s real but un-reconciled view), no
matched exact count against a freshly-seeded fixture.

### Exact evidence gap
A viewer with a precisely-known, freshly-seeded portfolio across all four domains, with an exact count
confirmed against live data.

### What was checked this run
This run created real needs_action/pending items across all four domains (go_live, customer_change,
customer_onboarding, commercial_configuration), but not as a single coordinated portfolio for one specific
viewer matching the canonical exact counts (2/1/3/1); building that precise a seeded set for one viewer was
judged, within remaining time, lower priority than the residuals with a clearer executable path.

### Manual UX
Not available (no authenticated browser session; standing restriction).

### Final residual state
STILL OPEN. The underlying merge mechanism (`buildMyWorkItems` operating over `loadApprovalInbox`'s
already-domain-tagged items) is unchanged and code-confirmed, but the exact-count claim specifically requires a
seeded fixture not built this run.

### Audit ledger updated
Yes.

## END M-027

## BEGIN M-028 (P3)

### Canonical intent
Confirm a viewer with genuinely zero eligible items sees a clean, correct empty state per bucket, not a stuck
spinner or an ambiguous zero.

### Historical classification
Grade B, honestly disclosed at the time: the actual zero-item persona was never logged in; evidence instead
inferred from a different, heavily-populated persona's view.

### What was checked this run
`buildMyWorkItems` (code, unchanged): given an `items` array that, after filtering, produces zero matches for a
given viewer, it returns `[]` (the `.sort()` on an empty array is a no-op), a normal, non-exceptional return
value; nothing in the function can throw or hang for this input. The genuinely-zero-items UI empty state itself
(distinct visual treatment from a loading/error state) is a UI-rendering claim this run cannot confirm without
the browser.

### Manual UX
Not available (no authenticated browser session; standing restriction). This journey's Business Objective is
explicitly and entirely a UX claim ("This journey is itself a UX check"), so this is the one gap a data-layer
check cannot substitute for.

### Final residual state
STILL OPEN (P3, lowest priority in this batch; genuinely requires the browser, correctly not substituted with
code-reading per this run's own "do not call code reading manual UX" instruction).

### Audit ledger updated
Yes.

## END M-028

## BEGIN M-029 (P2)

### Canonical intent
Confirm My Work's classification remains correct (not just fast) at realistic high volume (several hundred
items) for a broadly-scoped viewer, per the journey's own explicitly PARTIAL automation feasibility.

### Historical classification
Grade B, honestly disclosed: explicitly scope-reduced from "several hundred items" to a real but smaller, un-
reconciled section of `wf-test.maker`'s own view.

### What was checked this run
Given the journey's own canonical `Automation Feasibility: PARTIAL`, full volume testing was not attempted (that
is the canonical, correct scope, not a gap to close). What was not done this run that could reasonably strengthen
this at the code level: `buildMyWorkItems`'s single-pass `for` loop plus one array `.sort()` has no
data-dependent branching or nested-loop structure that would behave differently at 10 items vs. 500 (confirmed
by code read, no new finding).

### Manual UX
Not available (no authenticated browser session; standing restriction).

### Final residual state
STILL OPEN. Given `Automation Feasibility: PARTIAL` is the journey's own honest ceiling, this is recorded as
STILL OPEN rather than CLOSED since no new volume-specific evidence was produced this run, but it is flagged
that full closure was never expected to be a from-scratch live volume test per the journey's own definition.

### Audit ledger updated
Yes.

## END M-029

## BEGIN M-030 (P2)

### Canonical intent
Confirm "waiting on others" classification depends only on `createdBy` matching and `bucket = needs_action`,
never on the creator's own team memberships, including after M-011's later `!isSelfCreated` addition.

### Historical classification
Already marked `[STRESS VARIANT SUPERSEDED BY M-011, Batch 21, 2026-09-22]` in the Journey Universe itself: the
original stress scenario ("added to the team, flips to pending-my-approval") no longer applies after M-011;
re-verified via the passing `my-work.test.ts` suite in the original Batch 21 audit, not a live-driven timing
scenario.

### What was checked this run
`buildMyWorkItems` (code, unchanged, re-read this run): `isSelfCreated` is computed once per item from
`item.createdBy === appUserId`, independent of `viewerTeamIds`; the `waiting_on_others` branch
(`item.bucket === "needs_action" && isSelfCreated`) never references `viewerTeamIds` at all. This confirms, by
direct code structure, that no team-membership change for the creator can affect this classification branch,
which is exactly what the journey's Business Objective (and its own superseded-stress-variant note) requires.

### Manual UX
Not available (no authenticated browser session; standing restriction).

### Final residual state
STILL OPEN, formally: no new live timing scenario (team added/removed mid-lifecycle, then reloaded) was
constructed this run. Practically, the claim is about as strongly evidenced as a non-live check can make it: the
relevant code branch structurally cannot read the input (`viewerTeamIds`) the claim says it must be independent
of. Recorded honestly as STILL OPEN per this run's own standard rather than closed on structural-argument
strength alone, consistent with M-016/M-017's treatment above.

### Audit ledger updated
Yes.

## END M-030

## BEGIN Q-001 (P1)

### Canonical intent
Confirm a valid PDF upload to a Customer Onboarding request creates a correct, complete document row (Regular
Path), and a boundary-exact 1MB file is accepted (Stress Variant).

### Historical classification
Grade B: a real, live browser upload (Regular Path, grade A quality), boundary Stress Variant not run.

### Execution surface this run
Requires either a live browser session or direct invocation of `uploadOnboardingDocument` via a script holding
real Supabase service-role credentials outside this session's sanctioned MCP channel. The former is
tooling-blocked (I-037, standing restriction). The latter was attempted (checking for a script runtime) and
correctly blocked by the safety classifier as an out-of-band credentialed execution path this run's own
reasoning elsewhere (J-026) had already ruled out.

### Final residual state
TOOLING-BLOCKED for the boundary Stress Variant specifically (the Regular Path itself is already real, grade-A
evidence from the original audit and is not in question). No SQL-only or code-reading substitute is offered in
its place.

### Audit ledger updated
Yes.

## END Q-001

## BEGIN Q-002 (P2)

### Canonical intent
Confirm a valid JPG upload works identically to the PDF path, with `mime_type` correctly recorded as
`image/jpeg`.

### Historical classification
Grade B, the clearest prior gap in the batch: zero live execution, substituted entirely with code symmetry to
Q-001 plus a pre-existing unit test.

### Execution surface this run
Same as Q-001: requires a live browser session (tooling-blocked) or an out-of-band credentialed script
(correctly blocked by the safety classifier).

### Final residual state
TOOLING-BLOCKED. This remains the least-evidenced Q-series item (a canonically live-UI journey never given a
live execution), and that fact is not obscured: the pre-existing unit test cited in the original audit is real
(confirmed to exist) but is not a substitute for the canonical live upload this journey specifically asks for.

### Audit ledger updated
Yes.

## END Q-002

## BEGIN Q-003 (P1)

### Canonical intent
Confirm the client-side size check blocks an oversized file before any network call (Regular Path, already
grade-A live evidence), and a file at exactly 1MB + 1 byte is correctly blocked at the boundary (Stress
Variant).

### Historical classification
Grade B for the boundary gap only; Regular Path is solid live browser evidence.

### Execution surface this run
The boundary case is specifically a client-side (browser) check; this is TOOLING-BLOCKED for the same reason as
Q-001/Q-002, with no server-side substitute possible in principle (the claim is about the browser's own
pre-network behavior, not server validation, which Q-004's own closure already covers separately).

### Final residual state
TOOLING-BLOCKED (boundary Stress Variant only; Regular Path unchanged, already grade A).

### Audit ledger updated
Yes.

## END Q-003

## BEGIN Q-007 (P0)

### Canonical intent
Confirm re-uploading a document of the same type supersedes (flips `is_current`) rather than deleting the prior
version, including a multi-supersession chain (v1 through v4).

### Historical classification
Grade B for the missing multi-cycle chain confirmation; the core supersede-not-delete mechanism is solid,
live, grade-A evidence for a single v1->v2 supersession.

### Execution surface this run
Same as Q-001/Q-002: requires a live browser session (tooling-blocked) or an out-of-band credentialed script
(correctly blocked).

### Final residual state
TOOLING-BLOCKED (multi-cycle v1-v4 Stress Variant only; the core single-supersession mechanism is unchanged,
already grade A, and is explicitly P0 precisely because that core mechanism, not the multi-cycle stress case, is
the business-critical part, already well-evidenced).

### Audit ledger updated
Yes.

## END Q-007

### Batch 21 residual closure summary (final, third continuation run)

| Journey | Status |
| --- | --- |
| M-013 | **CLOSED** |
| M-014 | **CLOSED** |
| M-016 | STILL OPEN (genuinely executable, needs a live Queue render) |
| M-017 | STILL OPEN (genuinely executable, needs a live cross-domain render) |
| M-019 | STILL OPEN (genuinely executable, needs a narrow-permission persona + live denial) |
| M-022 | **CLOSED** |
| M-023 | **CLOSED** (with an honest mechanism correction: idempotent no-op for terminal state, explicit rejection confirmed separately for mid-flight state) |
| M-025 | **CLOSED** |
| M-026 | **CLOSED** |
| M-027 | STILL OPEN (genuinely executable, needs a precisely-seeded cross-domain portfolio) |
| M-028 | STILL OPEN (genuine UX-only claim, needs the browser) |
| M-029 | STILL OPEN (genuinely executable at code-review depth; full volume test was never in scope per its own PARTIAL rating) |
| M-030 | STILL OPEN (strong structural evidence; no new live timing scenario) |
| Q-001 | **TOOLING-BLOCKED** (boundary case only) |
| Q-002 | **TOOLING-BLOCKED** |
| Q-003 | **TOOLING-BLOCKED** (boundary case only) |
| Q-007 | **TOOLING-BLOCKED** (multi-cycle case only) |

**Evidence integrity (final): 6 of 17 residuals CLOSED this run (M-013, M-014, M-022, M-023, M-025, M-026) with
real, fresh, in-domain (or this-run's-own-fresh-cross-reference) evidence. 4 are TOOLING-BLOCKED
(Q-001, Q-002, Q-003, Q-007: real file storage requires either a live browser session or an out-of-band
credentialed script this session correctly declined to build). 7 remain STILL OPEN (M-016, M-017, M-019, M-027,
M-028, M-029, M-030): genuinely executable, not reached within this run's time budget after prioritizing the
items with a clear, cheap, SQL-only execution path first.**
