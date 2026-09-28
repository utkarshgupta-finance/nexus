# Overnight Discovered Journey Queue

Durable log of every journey discovered mid-run (via a `NEW JOURNEY REQUIRED` Journey Discovery
finding) during the current overnight run (Batches 24-33 — the plan's full remaining range through its
actual final batch; corrected 2026-09-27 from an earlier 24-30 framing once the run's true scope was
confirmed), per the Overnight Discovered Journey Queue protocol (`docs/NEXUS_JOURNEY_EXECUTION_PLAN.md`,
Journey Discovery Execution Protocol, section J).

Per that protocol: a discovered journey never changes the denominator of the batch that discovered it.
It changes only the overall run-level denominator (`run.scheduledTotal` in `RUN_STATE.json`, and the
executable Journey Universe total in `NEXUS_JOURNEY_UNIVERSE.md`).

## Queue

### T-025: Duplicate team display names are allowed, only team code is unique

- **Discovered:** Batch 24, during T-017's live execution (2026-09-27). Live behavior observed once
  (creating a second team with an identical display name succeeded), not itself proof of T-025's full
  scope.
- **Disposition:** NEW JOURNEY REQUIRED.
- **Canonical entry added:** `docs/NEXUS_JOURNEY_UNIVERSE.md`, Pack T - Settings, immediately after
  T-024 and before Pack U.
- **Denominator update:** did not change Batch 24's own denominator (stayed 25/25). Changed the overall
  executable Journey Universe total from 793 to 794.
- **Dependency reasoning:** no execution dependency on any other batch; belongs to Pack T / Settings,
  the same pack Batch 25 was already closing.
- **Placement:** placed directly into Batch 25 (making it a 26-journey batch: T-019 through T-025,
  AB-001 through AB-019) by explicit user confirmation on 2026-09-27, before this formal queue file
  existed. Recorded here for continuity, not re-litigated.
- **Execution:** executed in full during Batch 25, fresh (not treated as already-passed from the
  Batch 24 incidental observation). Required a real Product Decision (PD-010: disambiguate the "Assign
  a team" picker by showing team code alongside name) before it could close.
- **Status: EXECUTED, PASSED** (`docs/journey-runs/BATCH_25_RESULTS.md`, T-025 entry).

### AB-043: Losing racer's experience in a concurrent approval differs by workflow topology (end node vs mid-graph node)

- **Discovered:** Batch 26, during AB-039's live execution (2026-09-27). A genuinely dispatched two-actor
  overlapping RPC race (real distinct `app_users`, real `select ... for update` serialization at the DB)
  surfaced a topology-dependent inconsistency in the losing racer's return value: a silent idempotent
  success at an `end` node vs. an explicit `WORKFLOW_NODE_ALREADY_ADVANCED` error at a mid-graph node.
- **Disposition:** NEW JOURNEY REQUIRED (not a defect: no double-approval, no data corruption in either
  topology; a genuine Product Decision on whether the loser's experience should be made consistent).
- **Canonical entry added:** `docs/NEXUS_JOURNEY_UNIVERSE.md`, Pack AB, immediately after AB-042.
- **Denominator update:** did not change Batch 26's own denominator (stays 26/26). Changed the overall
  executable Journey Universe total from 794 to 795.
- **Dependency reasoning:** no execution dependency on any other batch; belongs to Pack AB, the same pack
  Batch 26 is already closing.
- **Placement:** executed immediately, in the same batch that discovered it (dependency-safe, no blocker).
- **Execution:** executed in full during Batch 26, using the same real race evidence that surfaced it
  (this is a same-mechanism, different-lens finding from AB-039, not requiring a separate fresh race).
- **Status: EXECUTED, PASSED (as a Product Decision Required finding, not a defect)**
  (`docs/journey-runs/BATCH_26_RESULTS.md`, AB-043 entry; `docs/journey-runs/MORNING_RESIDUAL_QUEUE.md`
  carries the actual product question).

## Overnight-run running totals (as of Batch 26, mid-execution)

```
Scheduled journeys at launch: 233 (Batches 24-33, before any mid-run discovery: 25+25+26+25+25+25+25+25+25+7)
New journeys discovered: 2 (T-025, AB-043)
New journeys executed during same run: 2 (T-025, AB-043)
New journeys passed: 2 (T-025 via PD-010; AB-043 as a Product-Decision-Required finding, not a defect)
New journeys failed then fixed: 0
New journeys parked: 0
Final Journey Universe denominator: 795 (current-executable), 235 (this overnight run's own scheduled total, 233 + T-025 + AB-043)
Unexecuted current-executable journeys: 0 discovered-and-unexecuted (both T-025 and AB-043 are executed
  and closed); the overnight run's own originally-scheduled journeys not yet executed (rest of Batch 26,
  Batches 27-33) are tracked separately in RUN_STATE.json/CURRENT_RUN_STATUS.md, not counted here.
```

Scope correction note (2026-09-27): this file's "at launch" figure and `RUN_STATE.json`'s
`run.scheduledTotal` originally read 176/177, reflecting an initial Batches-24-30 framing. The user
referenced Batch 33 (and the post-Batch-33 Overnight Discovery Catch-up phase) as the run's actual end
twice in direct instructions; corrected here and in `RUN_STATE.json` to 233/234 (Batches 24-33, the
plan's full remaining range) rather than silently carried forward or left ambiguous.

This running total will be updated in the same turn any future `NEW JOURNEY REQUIRED` finding is
recorded during Batches 26-33, and restated in full at the final overnight closure report after
Batch 33 (or after the Overnight Discovery Catch-up phase, if any discovered journey is parked to the
end of the run).
