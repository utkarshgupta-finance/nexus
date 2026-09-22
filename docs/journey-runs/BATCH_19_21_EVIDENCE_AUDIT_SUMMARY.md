# Batches 19-21 Evidence Integrity Audit: Summary

Overall summary of the overnight evidence-integrity run covering Batches 19, 20, and 21, following the same run
that closed Batch 18 (`docs/journey-runs/BATCH_18_EVIDENCE_AUDIT.md`). Full detail for each batch is in its own
file: `BATCH_19_EVIDENCE_AUDIT.md`, `BATCH_20_EVIDENCE_AUDIT.md`, `BATCH_21_EVIDENCE_AUDIT.md`.

| Batch | Journeys | Grade A | Grade B | Grade C | Grade D | Re-executed | Classification corrections | Current defects found | Integrity status |
| --- | --: | --: | --: | --: | --: | --: | --: | --: | --- |
| 18 (prior run) | 8 | 5 | 3 | 0 | 0 | 3 | 0 | 0 | PASS |
| 19 | 25 | 18 | 7 | 0 | 0 | 2 (+1 attempted, blocked) | 0 | 1 (fixed) | PASS with recorded gaps |
| 20 | 25 | 7 | 18 | 0 | 0 | 1 | 0 | 0 | PASS with recorded gaps |
| 21 | 25 | 7 | 18 | 0 | 0 | 0 (strengthened by cross-batch work) | 0 | 1 (fixed) | PASS with recorded gaps |
| **19-21 total** | **75** | **32** | **43** | **0** | **0** | **3 fully, 1 attempted** | **0** | **2 found, 2 fixed** | See below |

No journey across any of the three batches graded C or D: nothing required full re-execution, and no historical
PASS classification was found to be outright wrong. The grade distribution shifts meaningfully across the three
batches (Batch 19 mostly A, Batches 20-21 mostly B), which itself is a genuine, useful finding, not noise: it
reflects that Batch 19's own execution style favored full, real RPC/UI chains per journey, while Batch 20 and 21
increasingly relied on reusing a smaller number of fixtures across many journeys, often from a domain other than
the one a given journey's own canonical definition names. Every individual B-grade item is itemized, with its
specific reasoning, in its own batch's audit file; none are silently accepted.

## Two real, live-reproduced defects were found and fixed this run

1. **`submit_go_live_request` regression** (found via I-031's revalidation, Batch 19 audit). Migration
   `20261005000000` (itself a legitimate fix for J-014) silently regressed two things in this one function: the
   `app.permit_go_live_write` defense-in-depth write guard (making every go_live submission in the product
   fail) and the `GO_LIVE_REQUEST_SUBMIT_NOT_OWNER` ownership check (a real, if masked, cross-user
   authorization gap). Neither Batch 20 nor Batch 21 exercised a fresh submit call after this regression landed,
   so it went undetected until tonight. Fixed via migration `20261007000000`
   (`local == remote` confirmed), retested live (happy path, ownership rejection, cross-user rejection all
   confirmed working), full test suite green afterward.
2. **M-021, `canApprove` cross-domain OR-imprecision** (originally found in Batch 21, left as an open PRODUCT
   GAP at the time). Reclassified during this audit as a bounded defect against the already-settled "Pending My
   Approval means this user can actually approve this item now" invariant, per explicit instruction not to
   reopen it as a new product decision. Fixed: `buildMyWorkItems` now takes a per-item-type permission map
   instead of one OR'd boolean; `/my-work` checks all three real permission resources independently. Verified
   via two new automated tests (982/982 total passing) and against the exact real fixture Batch 21's own
   discovery used.

## What the recurring Grade-B pattern actually represents

The dominant Grade-B pattern in Batches 20 and 21 is not fabricated or missing evidence; every cited fixture and
RPC/UI call in the original ledgers is real. The pattern is: a journey's canonical `Domain` field names one
specific governed domain, but the live evidence cited was gathered in a different domain (most often because a
convenient, already-in-flight fixture was reused across several journeys), or a canonical Stress/Authorization/
Concurrency Variant was reasoned about rather than actually reproduced. Because several of the underlying
mechanisms (`fn_require_workflow_team_membership`, `fn_resolve_workflow_next_approval`, `isResponsibleTeam`,
`bucketForStatus`) are confirmed domain-agnostic by direct code reads repeated across all three batches, the
practical risk each individual gap carries is real but bounded, not the same as a genuinely untested code path.
One journey explicitly flagged P0 in the canonical plan (Batch 20's M-008) was independently, freshly
revalidated live in its own domain during this audit specifically to test this "domain-agnostic mitigates"
reasoning empirically rather than merely asserting it, and it held.

The two residual gaps judged most consequential and NOT closed tonight, given time constraints, are:

- **M-018** (Batch 21): the canonical "send back 3 times, confirm the counter increments 1->2->3" scenario was
  never constructed; every cited fixture shows exactly one send-back.
- **Q-004** (Batch 21, P0, explicitly framed as security-relevant): the canonical scenario is a direct API call
  bypassing the browser entirely to prove server-side re-validation of file size; only a code read and a
  pre-existing unit test stand in for an actual bypass reproduction.

Both are named explicitly, with recommended next action, in the parked-items section of the final morning
report, rather than silently left for a reader to rediscover.

## Reconstructability

Every grade and every piece of live revalidation performed in this run is independently reconstructable from the
repo alone: real request/fixture UUIDs, real RPC call sequences, real SQL queries, and (for the two fixes) real
diffs and a real applied migration, all recorded in the three batch-specific audit files. No claim in this
summary or in any of the three underlying files rests on this session's own memory alone.
