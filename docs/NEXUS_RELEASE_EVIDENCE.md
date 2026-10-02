# Nexus Release Evidence Assessment

Not a new test. This is a strict read of the evidence already produced
across Batches 1-33 (see `docs/NEXUS_FINAL_PROGRAM_AUDIT.md` for the full
reconciliation), assessed area by area. Each area gets exactly one of:
**STRONG EVIDENCE**, **STRONG WITH KNOWN LIMITATIONS**, **PARTIALLY
EVIDENCED**, or **FUTURE CAPABILITY / NOT PRESENT**.

Date: 2026-10-02.

---

## Authentication / session handling

**STRONG WITH KNOWN LIMITATIONS**

Strongest evidence: Batch 3's unauthenticated Customer Master exposure
(DEFECT-B3-001, the highest-severity finding of the early program) was
found and fixed with a full regression suite (`redirect-target.test.ts`).
Batch 29's Z-001 (expired-session generic login) was found, decided, and
fixed with 12 new regression tests and live end-to-end re-verification.
Mid-session permission loss is proven correct at the server layer
repeatedly and independently: V-030/V-031 (Batch 28) and AB-035 (closed
2026-10-02) all confirm a stale, fully-rendered admin page cannot bypass
a live permission re-check, with network-confirmed denials and DB/audit
log evidence of zero mutation.

Residual limitation: U-019/U-020's "two simultaneous independent sessions"
dimension rests on architectural proof (code read + single-session
reasoning), not literal dual-session reproduction, because the available
browser tooling shares one cookie jar across tabs. **Not
correctness-critical**: the mechanism (server-side session derivation,
never trusting client state) is proven by every other authorization
journey in the program; this is a reproduction-method limitation, not a
behavioral gap.

Relevant journeys: U-001–U-020, Z-001, V-030, V-031, AB-035, N-014, N-018.

---

## Authorization / RBAC

**STRONG EVIDENCE**

This is the single most heavily-tested area in the program (Pack AB alone
has 43 journeys, the largest pack in the catalogue, almost entirely P0).
Every governed mutation's server-side `requirePermission` gate has been
independently exercised: direct RPC bypass attempts (DEFECT-B7-001/002),
missing PUBLIC-execute-grant revocations across 18 RPCs
(DEFECT-B7-003/AB-041), mid-session revoke-while-page-open across four
distinct Settings surfaces (V-030, V-031, AB-035, and the Workflow/Team
Master domains), self-grant-of-elevated-role documented as accepted
design (PG-029), and the per-customer/territory 4-tier scoped
authorization model (PD-005/PG-008) built and verified across 5 domains.
PG-062 (a real regression where onboarding approval silently dropped 4
governed fields) was found and fixed with both a migration and TS-layer
correction.

No residual limitation found correctness-critical enough to downgrade
this rating. The only open item in this area, Y-008 (large team-
membership scale), is an environment-scale limitation on volume, not a
mechanism gap: every governed RBAC mutation's correctness is independently
proven at small scale across dozens of other journeys.

Relevant journeys: entire Pack AB (41-43 journeys), N-001–N-031, O-018,
PD-005, V-030, V-031, AB-035, PG-062.

---

## Maker-checker

**STRONG EVIDENCE**

Self-approval is blocked server-side regardless of client layer (V-044,
reconfirmed repeatedly). Concurrent-approval races are proven correct
under real two-actor overlapping RPC calls, not simulated (V-001 through
V-004, W-003 through W-007, AB-039/AB-043/PG-036, V-028/PG-037). The
loser-experience inconsistency found in a genuine race (silent success vs.
explicit error depending on finality) was decided and fixed with a new
error token, verified against real historical data. Double-submit and
triple-approve stress (W-001/W-002, W-003 through W-007) both real-click
and programmatic.

One explicitly accepted, non-bypass gap: Reference Master has no
maker-checker at all (PG-035), a deliberate accept-as-is decision, not a
defect; every other governed domain (Onboarding, Customer Change,
Commercial Configuration, Go Live) has it and it is proven.

Relevant journeys: V-001–V-004, V-028, V-044, W-001–W-007, AB-020,
AB-039, AB-043.

---

## Workflow Builder

**STRONG WITH KNOWN LIMITATIONS**

Graph validation is proven at both the UI and RPC layer: unreachable-
subgraph rejection, End-node outgoing-edge rejection, a 30-node graph
save/replace mechanism proven atomic and correct (Y-001/Y-012), and a
real defect (Add Node not auto-selecting the new node, risking silent
overwrite of the wrong node) found and fixed the same day (PG-065).
K-030's recovery path (stale-draft refresh) is proven with a genuine
reload mechanism, not a cosmetic fix.

Residual limitation: Batch 33's Y-016 confirmed the version-list UI and
historical-graph-integrity invariants at 15 real versions (the highest
accumulated in this DEV/TEST environment), honestly short of the
canonical "dozens, stress 100+" target. This is an environment-scale
limitation on a mechanism already proven correct at the scale achieved,
not an unverified mechanism.

Relevant journeys: K-001–K-030, Y-001, Y-012, Y-016, PG-065.

---

## Workflow Runtime

**STRONG WITH KNOWN LIMITATIONS**

Node transitions, team-based routing, and the end-to-end approval chain
are proven across all four governed domains repeatedly (every Customer
Change/Onboarding/Commercial Configuration/Go Live approval cycle in the
program exercises this). H-020's premature-terminal-state Timeline defect
was found, fixed, and its cross-domain generalization explicitly verified
in the other three domains via AA-023 (Batch 18), closing TV-001.

Residual limitation: Y-020 (Batch 33) found that the deepest real
sequential-approval-node fixture in this environment (13 nodes) is not
currently request-bindable by any real onboarding case, and the
genuinely live, repeatedly-exercised chain is 2 real sequential nodes, far
short of the canonical "15+, stress 30+" target. The routing-selection
rule that determines which workflow version a new case actually binds to
was not fully identified within the time budget. This is a depth/scale
limitation on a mechanism (node-to-node transition correctness) that is
itself proven correct at every depth actually exercised.

Relevant journeys: J-001–J-030, L-001–L-028, H-020, AA-023, Y-020.

---

## Customer Onboarding

**STRONG EVIDENCE**

The full Pack A (36 journeys) exercises atomic case creation, field
validation, server-side completeness/duplicate checks (DEFECT-B7-001,
closing a real raw-RPC bypass), creator-only draft visibility (A-036/
PD-001, though its UX-confirmation half rests on unit tests rather than a
live browser click, disclosed not concealed), document upload with real
byte-signature content-sniffing (A-023, Q-021 extending the same guard to
Go Live), and GST/PAN/TAN duplicate hard-blocking (mirrored into Customer
Change as PG-064). The document mechanism's structural fixed-6-slot
design is confirmed, not a limitation, by direct testing (Y-005).

Relevant journeys: A-001–A-036, Y-005, PG-064.

---

## Customer Master

**STRONG EVIDENCE**

Former-name search (B-007/PG-053, fixed and re-verified live), customer
legal-name change propagation (V-043), Activity/History frozen-actor-
identity snapshot (V-038/PG-058, a real defect found and fixed: live
name-resolution was wrongly showing a renamed actor's current name
instead of the point-in-time identity), and scoped-authorization info-
disclosure (incidentally caught and fixed during PD-005's closure) are
all proven with live, end-to-end evidence including before/after
comparisons against a real renamed actor.

Relevant journeys: Pack B (25 journeys), V-038, V-043, PG-053, PG-058.

---

## Customer Change

**STRONG EVIDENCE**

Full approval-cycle evidence including send-back/resubmit cycles (Y-003,
3 of a 10+ canonical target, honestly disclosed), concurrent-approval
races (V-003, a real row_version double-bump defect found and fixed via
migration), GST/PAN duplicate protection extended to match Onboarding
(PG-064), and PD-004's "approval survives later customer deactivation"
decision verified with a regression test asserting no `is_active` param
exists on the RPC.

Relevant journeys: Pack C (35 journeys), Y-003, V-003, PG-064, PD-004.

---

## Commercial Configuration

**STRONG WITH KNOWN LIMITATIONS**

Correction-category backdating (PD-006, 4 phases, 2 real defects found
mid-closure and fixed), duplicate-component-scope warning (PG-044), and
duplicate designation-row blocking (PG-045) are all proven live. The
legacy ungoverned RPC `create_commercial_change_for_configuration`
(D-017/E-020) was a genuinely open gap for a long stretch of the program,
closed only later as PG-038 (deleted entirely, confirmed via
`pg_proc` count=0).

Residual limitation: F-014 (no DB-level numeric validation on pricing
parameters) remains a deliberate architectural deferral pending a future
Pricing Kernel, explicitly documented in the migration's own comment, not
a silently-missed gap.

Relevant journeys: Pack D (24 journeys), Pack E (32 journeys), PD-006,
PG-038, PG-044, PG-045, F-014.

---

## Go Live

**STRONG WITH KNOWN LIMITATIONS**

The single durable live-billing-effect domain (Pack H, 44 journeys, 20
P0). H-027 (creator-only enforcement) and H-043 (defense-in-depth protect
trigger) both found and fixed with migrations and full live re-
verification. V-033/PG-057 (a real UX-truth defect: "Commercial Context
(Locked)" silently showed the *current* component instead of what was
actually referenced at creation) found, decided, fixed, and re-confirmed
across 3 later batches.

Residual limitation: Y-015 (Batch 33) confirmed the Go Live/entitlement
view loads correctly and historical months are not truncated at a
~14.5-month real span, honestly short of the canonical "several years"
target, and usage-record volume (0-7 rows found) is far short of "high
volume." Y-017 found the underlying `go_live_requests` table itself
accumulates history correctly at 11 real requests (clearing the Regular
Path's own 10+ target) but that no consolidated history-list UI exists to
browse them, a Future Capability finding (section 10 of the audit), not a
correctness defect.

Relevant journeys: Pack H (44 journeys), V-033, PG-057, Y-015, Y-017.

---

## Entitlements / Usage / Settlement

**STRONG EVIDENCE**

This is the most defect-dense area of the entire early program (Batch
17), and every defect found has a complete fix chain: silent finalization-
lock bypass (I-012), stale OPEN ledger entries on classification flips
(I-021), over-settlement with no outstanding-quantity check (I-022),
ledger-recompute-on-cancellation (PG-012, 2 phases), and settlement
reversal (PG-013, new table + RPC). `usage.read`/`entitlement_settlement.read`
enforcement (N-031/PG-004) closed by explicit product decision.

Relevant journeys: Pack I (38 journeys), I-012, I-021, I-022, PG-012,
PG-013, PG-004.

---

## Documents / Storage

**STRONG WITH KNOWN LIMITATIONS**

Real byte-signature content validation (A-023, Q-021), duplicate
`is_current` row repair under an upload race (Q-019, migration + partial
unique index), and the fixed-6-slot Onboarding document mechanism (Y-005,
a structural finding, not a limitation) are all proven live.

Residual limitation: no UI surfaces a superseded (non-current) document
version anywhere in the product (DF-011/PG-060), and no organization-wide
document report/listing surface exists at all (Y-018, Batch 33) — both
explicitly Future Capability, not defects, confirmed by source inspection
that both document tables are always case-scoped by design.

Relevant journeys: Pack Q (21 journeys), A-023, Q-019, Q-021, Y-005,
Y-018, DF-011.

---

## Audit / Timeline / History

**STRONG WITH KNOWN LIMITATIONS**

Frozen-identity snapshotting for actor attribution (V-038/PG-058) and for
Commercial Context (V-033/PG-057) are both proven with real renamed-actor
and real stale-reference scenarios. Audit ordering under concurrent writes
is proven correct per-record (X-006, Y-004, Y-009).

Residual limitation: no UI surfaces historical audit/timeline data for
several Settings areas (DF-006/PG-051, a long-standing, repeatedly-
rediscovered gap across Batches 5, 6, and 23), and no organization-wide
audit export exists (Y-019, Batch 33, Future Capability, P2 priority in
the canonical universe given its compliance framing). Both are presentation-
layer absences over data that is independently confirmed intact and
correctly ordered, not a correctness gap in the underlying audit log
itself.

Relevant journeys: Pack R (20 journeys), V-033, V-038, X-006, Y-004,
Y-009, Y-019, DF-006.

---

## Failure / Recovery / Chaos

**STRONG EVIDENCE**

Pack Z (30 journeys) is dedicated to this, and includes a real defect
found and fixed with the most rigorous evidence chain in the program
(K-030's stale-draft silent-overwrite recovery path, plus Z-001's expired-
session UX, plus the Z-027 incident itself, which proved the product's
own document-immutability design correctly limited a real accidental
mutation's blast radius to one inert row). Z-010/Z-021/Z-027's redo all
used safe, disposable fixtures after the one incident.

Relevant journeys: Pack Z (30 journeys), K-030, Z-001, Z-027, INC-001.

---

## Historical compatibility

**STRONG EVIDENCE**

Pack X (21 journeys) is dedicated to this and is 100% Historical-
dimension-populated per the Coverage Matrix. Real multi-batch-accumulated
customer history (`aurora-consumer-labs`, `test-customer-1`) is used as
read-only evidence repeatedly across Batches 30-33 specifically because
mutating it would destroy the exact value it provides. Superseded-
document-version data integrity (DF-011/PG-060) and legacy mixed-schema
aggregate reporting (DF-012/PG-061) are both confirmed as presentation-
layer absences, not data-integrity gaps: the underlying historical rows
are independently confirmed correct and complete.

Relevant journeys: Pack X (21 journeys), Y-015, Y-017.

---

## Concurrency / idempotency

**STRONG EVIDENCE**

Pack V (47 journeys, the largest non-security pack) and Pack W (21
journeys) are both dedicated to this. Real two-actor overlapping RPC
races (not simulated) are the program's standard method here: V-001
through V-004, V-003's row_version double-bump defect (found and fixed),
AB-039/AB-043/PG-036's loser-experience fix, V-028/PG-037's cross-node
same-approver fix (self-correcting a same-day regression the first fix
introduced), and W-001 through W-007's double-submit/double-approve
stress, both real-click and programmatic.

One residual, disclosed and accepted: J-026's true-simultaneous-
two-connection race cannot be produced through a sequential RPC
interface; every non-concurrent component of the same safety property is
independently reconfirmed.

Relevant journeys: Pack V (47 journeys), Pack W (21 journeys), V-003,
AB-039, AB-043, V-028, J-026.

---

## Performance / scale

**PARTIALLY EVIDENCED**

This is the one area where the rating is capped below STRONG, honestly,
by design: Pack Y (20 journeys) was deliberately scheduled last
specifically so it could draw on real accumulated DEV/TEST history rather
than synthetically bulk-inserted data (per the Execution Plan's own
stated rationale), and the environment's real accumulated scale is
consistently and honestly below each journey's canonical stress target:
16 components (Y-002), 341 of thousands of audit rows (Y-004), 39 of
tens-of-thousands customers (Y-006), 15 of dozens/100+ workflow versions
(Y-016), 1 of tens-of-thousands Reference Master references (Y-014), 2 of
15+/30+ sequential approval nodes genuinely live (Y-020). Every mechanism
these journeys test (list rendering at volume, audit ordering, version
immutability, deactivation non-destructiveness) is proven correct at the
scale actually achieved; what is not proven is behavior at production
scale, because this environment has never carried production scale.

This is a correctness-non-critical limitation for a release decision: the
mechanisms are proven; the volumes are not. It becomes correctness-
relevant only if Nexus's actual production data volume is expected to
differ qualitatively (not just quantitatively) from what's been tested,
which the program has no way to assess from within a DEV/TEST environment.

Relevant journeys: entire Pack Y (20 journeys).

---

## Accessibility / UX controls

**PARTIALLY EVIDENCED**

Pack ACC has only 2 journeys total (the smallest pack in the catalogue by
design, per the Coverage Matrix's own note that keyboard/screen-reader
comprehension is inherently a human-judgment check). ACC-001 (skip-to-
content) and ACC-002 (`aria-required` consistency) were both found,
fixed, and live-browser-verified (PG-043). This is real, positive
evidence, but it covers two specific controls, not a general accessibility
audit; no broader WCAG-level sweep was ever in this program's scope.

Relevant journeys: ACC-001, ACC-002, PG-043.

---

## Summary table

| Area | Rating |
|---|---|
| Authentication / session handling | STRONG WITH KNOWN LIMITATIONS |
| Authorization / RBAC | STRONG EVIDENCE |
| Maker-checker | STRONG EVIDENCE |
| Workflow Builder | STRONG WITH KNOWN LIMITATIONS |
| Workflow Runtime | STRONG WITH KNOWN LIMITATIONS |
| Customer Onboarding | STRONG EVIDENCE |
| Customer Master | STRONG EVIDENCE |
| Customer Change | STRONG EVIDENCE |
| Commercial Configuration | STRONG WITH KNOWN LIMITATIONS |
| Go Live | STRONG WITH KNOWN LIMITATIONS |
| Entitlements / Usage / Settlement | STRONG EVIDENCE |
| Documents / Storage | STRONG WITH KNOWN LIMITATIONS |
| Audit / Timeline / History | STRONG WITH KNOWN LIMITATIONS |
| Failure / Recovery / Chaos | STRONG EVIDENCE |
| Historical compatibility | STRONG EVIDENCE |
| Concurrency / idempotency | STRONG EVIDENCE |
| Performance / scale | PARTIALLY EVIDENCED |
| Accessibility / UX controls | PARTIALLY EVIDENCED |

No area is rated FUTURE CAPABILITY / NOT PRESENT as a whole; every area
has substantial real evidence. Where a specific future-capability finding
exists within an otherwise well-evidenced area (e.g. Go Live's missing
history-list UI, Documents' missing org-wide report), it is called out
within that area's own section rather than downgrading the whole area's
rating, since the core correctness mechanism in each case is proven.
