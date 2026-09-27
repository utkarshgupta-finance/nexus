# Morning Residual Queue

Durable queue of every non-clean item from the overnight run (Batches 26-33 plus any journeys
discovered during the run), per the Overnight Stall-Escape Protocol
(`docs/NEXUS_JOURNEY_EXECUTION_PLAN.md`, "Overnight Stall-Escape Protocol" section). Populated live as
the run finds items that cannot close within their bounded escalation ladder (up to 3 materially
different attempts); nothing here blocks the rest of the run from continuing.

Each row: Journey ID, Batch, Classification, Reason, Evidence already captured, Exact missing
evidence/action, Human input needed (YES/NO), Product Decision needed (YES/NO), Can retry independently
(YES/NO).

## Queue

_(empty as of the pre-flight readiness pass, 2026-09-27 — no journey has been attempted yet under this
protocol)_

| Journey ID | Batch | Classification | Reason | Evidence captured | Missing evidence/action | Human input needed | Product Decision needed | Can retry independently |
|---|---|---|---|---|---|---|---|---|
| — | — | — | — | — | — | — | — | — |

## Known, pre-disclosed limitations that will predictably populate this queue

These are not failures to be "fixed" — they are structural tooling limits identified during the
pre-flight review, each with an already-approved fallback. Listed here so their eventual queue entries
are recognized as expected, not surprising:

- **No genuine dual-browser-session concurrency** (this session's Browser tool shares one cookie jar
  per origin). Every "two simultaneous UI sessions" journey (V-047, Z-026, W-018, and others) will use
  the approved distinct-actor overlapping-RPC-call fallback instead (SERVER/RPC VERIFIED), per Batch 25's
  T-024 precedent. Any post-race UI truth assertion will still be verified sequentially in the browser
  as each relevant persona, where feasible.
- **No true network-mid-request-drop injection** in this real dev environment (no proxy/failpoint).
  Affected journeys (Z-003, W-012, W-013, W-020) are already canonically rated PARTIAL for this exact
  reason; approximate fallback (kill the tab mid-request) will be used and the result will be labeled
  PARTIAL / TOOLING LIMITATION, not silently upgraded to FULL.
