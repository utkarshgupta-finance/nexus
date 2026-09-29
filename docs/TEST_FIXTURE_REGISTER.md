# Nexus: Test Fixture Register

Canonical allowlist of fixtures explicitly safe for destructive, chaos,
concurrency, or mutation testing during journey execution. This is the
answer to "am I allowed to mutate this?" Nothing outside this register, and
outside the "created specifically for this journey/run" rule, may be
destructively mutated. See `CLAUDE.md`'s "Test fixture safety" section and
`docs/NEXUS_JOURNEY_EXECUTION_PLAN.md`'s pre-mutation check for the rule
this register supports; see `docs/journey-runs/TEST_DATA_INCIDENTS.md` for
the incident that made this register necessary.

**Default rule, always prefer this over anything below:** create a fresh
record for the current journey/run (a new draft, a new Commercial Version, a
new disposable Storage object under a clearly test-named path) and mutate
that instead of anything pre-existing. Only reach for a listed fixture below
when a journey genuinely requires an existing, already-approved/mature
record (e.g. a workflow definition that must already be published, a team
that must already have real membership history).

Do not add a real/shared customer to this register merely because it has
convenient existing data. A customer accumulating multi-batch history is
valuable precisely because it is *not* mutated further; several historical/
regression journeys (X-001 through X-006, Z-014, and others) depend on that
history staying exactly as it is.

---

## ACTIVE fixtures approved for destructive testing

### `WF-TEST Legal` (team)
- **Domain:** Workflow / Team Master
- **Purpose:** Purpose-built team fixture for team-status and membership
  chaos testing (deactivate/reactivate, remove/re-add members, zero-active-
  member scenarios).
- **Safe mutation types:** toggling `is_active` (deactivate/reactivate);
  adding/removing team membership.
- **Unsafe mutation types:** renaming the team; deleting the team outright
  (Team Master has no hard-delete by design, per PG-033); any mutation left
  unreverted at the end of the journey that created it.
- **Cleanup required:** yes, always. Every prior use (Z-007, Z-009) fully
  reversed team-active-status and membership to their original state
  immediately after capturing evidence.
- **Immutable history may remain:** no (membership/status changes are not
  immutable; they must be reverted, not merely disclosed).
- **Owner/source:** created for this journey-testing program's workflow
  chaos-testing pack (Z-pack), first used Batch 29/30.
- **Status:** ACTIVE.

### `WF-TEST Empty` (team)
- **Domain:** Workflow / Team Master
- **Purpose:** A deliberately unwired, disposable team fixture for zero-
  active-member scenarios where no real routing history needs preserving.
- **Safe mutation types:** any (membership, active-status); it is not
  referenced by any real in-flight request by design.
- **Unsafe mutation types:** none known, provided it remains genuinely
  unwired (do not assign it to a real request's node).
- **Cleanup required:** no strict requirement, but restore to empty
  membership/active state as good practice.
- **Immutable history may remain:** no.
- **Owner/source:** created as a disposable alternative to `WF-TEST Legal`
  for scenarios that do not need matching a real historical precedent.
- **Status:** ACTIVE (not preferred over `WF-TEST Legal` when a journey's
  canonical text expects an established, previously-used team; use whichever
  the specific journey's own precedent calls for).

### Reference Master test-only values (Segment, Currency, Industry lists)
- **Domain:** Reference Master (`reference_options`)
- **Object / stable identity:** any value whose `code` or `label` is
  self-evidently test-only, e.g. `gap_closure_test_segment*`,
  `batch7_p020_*`, `batch7_p023_*`, `batch6_test_segment_*`,
  `p_001_genuine_add_segment`, `p021_activity_test_industry`,
  `p_003_genuine_add_industry`, currency code `E2E` ("E2E Test Currency").
- **Purpose:** Disposable, clearly-labeled values for add/deactivate/
  reactivate/rate-change testing without touching a real business-facing
  value (`Enterprise`, `Mid Market`, `SME`, `USD`, `EUR`, `INR`, `FMCG`,
  `Retail`, etc., all of which remain off-limits, see below).
- **Safe mutation types:** activate/deactivate; rate changes (for currency
  codes); adding new test-named values.
- **Unsafe mutation types:** renaming to remove the test-identifying prefix;
  deleting outright (Reference Master values are not hard-deleted by
  design).
- **Cleanup required:** restore `is_active` to its prior state if toggled
  for a test; a genuinely new test value may be left in place (harmless,
  consistent with established practice across this program).
- **Immutable history may remain:** yes, safely (the values themselves are
  disposable and were built for this purpose).
- **Owner/source:** accumulated across many batches' Reference Master
  journeys (P-pack, Z-pack).
- **Status:** ACTIVE.

**Explicit exception, logged not registered:** Batch 30's X-003 and X-005
briefly toggled a genuine *business* reference value (Segment `mid_market`)
and a genuine *business* currency rate (`USD`), not a test-only value, because
those specific journeys' canonical text requires proving historical
preservation against a value/rate real historical records actually
reference. Both were fully restored immediately and verified via DB query
before and after. This is the one legitimate exception to "never touch a
real business reference value": when the journey's own canonical purpose is
to prove something is unaffected by a live master-data change, and the
change is reverted in the same action with a verified before/after check.
Do not generalize this exception to other mutation types.

### Disposable Storage objects (Supabase Storage, any bucket)
- **Domain:** cross-cutting (Go Live documents, Customer Onboarding
  documents, any future document bucket)
- **Purpose:** any object created fresh, this session, under a clearly
  test-named path (e.g. `z027-full-test/z027-full-test.txt`), for signed-URL,
  expiry, missing-object, or upload-validation testing.
- **Safe mutation types:** upload, delete, sign, anything, since the object
  is wholly self-created and not referenced by any real business record.
- **Unsafe mutation types:** none, provided the object was genuinely
  self-created this session and is never associated with a real, shared
  customer's document metadata row (see `INC-001` in
  `docs/journey-runs/TEST_DATA_INCIDENTS.md` for what went wrong when this
  boundary was crossed).
- **Cleanup required:** yes, always delete the object when the journey
  concludes.
- **Immutable history may remain:** no (the object itself, not being
  business data, is not subject to any immutability trigger; nothing should
  remain).
- **Owner/source:** established pattern since Batch 29 (Z-010).
- **Status:** ACTIVE.

### Fresh records created for the current journey/run (customers, onboarding cases, change requests, commercial versions, go-live requests)
- **Domain:** all four governed domains
- **Purpose:** the default, always-preferred fixture: create a brand-new
  record via the real application flow for the specific journey at hand
  (e.g. Batch 30's Z-016 through Z-020's fresh CCRs on Aurora, Z-018's
  leap-day CCR, Z-029's XSS-payload CCR).
- **Safe mutation types:** any, including terminal actions (reject, approve,
  cancel), since the record's entire existence is scoped to this test.
- **Unsafe mutation types:** none of its own; do not attach it to a real
  shared customer's other governed records in a way that would affect them
  (e.g. do not toggle a shared customer's own approved go-live/commercial
  state through it).
- **Cleanup required:** no; a genuinely new, disposable, terminal-status
  record left in place is harmless and consistent with established practice
  throughout this program.
- **Immutable history may remain:** yes, safely; it is real, honestly-
  labeled test history on a real (if long-lived) customer, not a defect.
- **Owner/source:** this is a mutation *pattern*, not a fixture with a
  stable ID; it is created new every time.
- **Status:** ACTIVE (the default rule).

---

## NOT approved for destructive testing (explicitly retired from that use)

These customers/objects remain valid for **read-only** verification,
regression checks, and historical-UX confirmation (their accumulated history
is exactly what those journeys need), but must **not** be the target of any
new destructive, chaos, concurrency, or mutation test going forward, per the
rule this register exists to enforce:

- `aurora-consumer-labs` (Aurora Consumer Labs Pvt Ltd) — the customer
  involved in `INC-001`. Extensively reused across many batches; its
  accumulated audit/history data is itself load-bearing for multiple
  historical/regression journeys (Z-014, X-001, X-002 in Batch 30 alone).
  Creating a *new* child record scoped to this customer (a fresh CCR, per
  the default rule above) remains fine; mutating its own top-level
  documents, commercial versions, or go-live request status directly does
  not.
- `test-customer-1` ("Test Customer 1 (V-043 Renamed)") — same reasoning;
  used by X-004 for its own accumulated historical workflow Timeline.
- `w007-stress-onboarding-customer` ("W007 Stress Test Customer") — same
  reasoning; carries its own accumulated stress-test history worth
  preserving as-is.
- `batch12-e021-routing-co` ("Batch12 E021 Routing Co (TEST)") — same
  reasoning, despite the "(TEST)" label; it has real accumulated workflow
  history from its own originating journey, not disposable per-run data.
- `batch8-approval-core-co` ("Batch8 Approval Core Co Renamed") — same
  reasoning; used by X-005 for its own accumulated Commercial Version
  history spanning multiple real currencies and frozen rates.

If a future journey believes it genuinely needs to destructively mutate one
of these, stop and ask first, per the pre-mutation check in
`docs/NEXUS_JOURNEY_EXECUTION_PLAN.md`; do not add it here unilaterally.
