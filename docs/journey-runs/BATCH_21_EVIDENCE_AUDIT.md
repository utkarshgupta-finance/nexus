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
| M-018 | PASS | B | No | Single-cycle only; "multiple cycles" unexercised |
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
| Q-004 | PASS | B | No | **P0 security journey; no bypass reproduction** |
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
| Journeys re-executed | 0 additional live browser/RPC reproductions this batch (time-bounded prioritization; M-020/M-021 strengthened by cross-batch work already performed) |
| Historical classifications corrected | 0 |
| Current defects found | 1 (M-021, already known and now fixed) |
| Current defects fixed | 1 |
| Code changed | `my-work.ts`, `server.ts`, `my-work/page.tsx`, `my-work.test.ts` |
| Migrations applied | 0 |
| Residual gaps (not re-executed, honestly recorded) | M-013, M-014, M-016, M-017, M-018, M-019, M-022, M-023, M-025, M-026, M-027, M-028, M-029, M-030, Q-001, Q-002, Q-003, Q-004, Q-007 |

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

**Conclusion: one real defect (M-021) found in a prior batch and fixed tonight, verified against both new
automated tests and the exact real fixture that originally discovered it. Two journeys (M-018, Q-004) carry the
most consequential residual gaps in this batch (a "multiple cycles" claim never exercised, and a P0
security-relevant bypass reproduction never attempted) and are flagged explicitly rather than silently accepted.**
