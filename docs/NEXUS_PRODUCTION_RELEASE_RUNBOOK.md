# Nexus Production Release Runbook

Planning and documentation only. This document describes the procedure to
follow when Nexus is eventually released to Production. Writing it did
not deploy anything, merge to `main`, run a Production migration, mutate
Production, run any journey, or create any fixture.

Date written: 2026-10-02.

**Important operational fact established while building this runbook**:
`git log --oneline main..team-preview` returns **342 commits**. `main`
has never received any of this programme's work. **This runbook describes
Nexus's first-ever Production release, not an incremental update.** There
is no prior Production deployment to diff against; "previous Production
commit" in the release record template (section 16) will be blank or
"none (first release)" the first time this runbook is used.

---

## 1. Purpose

Give the team a single, reusable procedure for releasing Nexus to
Production: what to confirm beforehand, what order to do things in, how
to handle migrations, how to verify the release worked, what to watch,
and exactly when and how to roll back. It translates
`docs/NEXUS_FINAL_PROGRAM_AUDIT.md`, `docs/NEXUS_RELEASE_EVIDENCE.md`,
`docs/NEXUS_RELEASE_READINESS_REVIEW.md`, and
`docs/NEXUS_REGRESSION_PROGRAM.md` into an operating procedure. It does
not re-litigate those findings; the baseline in section 2 is carried
forward unchanged.

---

## 2. Release assumptions

Carried forward from `docs/NEXUS_RELEASE_READINESS_REVIEW.md`, not
reinterpreted:

- Release blockers: **0**
- Active Product Gaps: **0**
- Open Product Decisions: **0**
- Open known defects: **0**
- **31** partial / tooling-limited journey dimensions (scale/timing
  reproduction limits on independently-proven mechanisms)
- **2** blocked dimensions (J-026's concurrency Stress Variant, Y-008)
- **14** deferred / accepted Product Gap register entries remain, by
  deliberate business decision
- **9** future-capability items remain unbuilt, by design
- Production-scale performance was **not** demonstrated; every Pack Y
  mechanism is proven correct at the real DEV/TEST volume achieved, not
  at production volume
- **DF-009** (Go Live's unscoped authorization model, versus the other 5
  domains' scoped model) requires explicit product/security acceptance
  before this release, per the Release Readiness Review's own
  recommendation

None of this is re-assessed here. If any of these numbers have changed
since 2026-10-02, this runbook's Step 1 gate (section 4) requires
re-confirming the baseline before proceeding.

---

## 3. Roles / owner types

No named individuals. Use these owner types throughout, consistent with
`docs/NEXUS_RELEASE_READINESS_REVIEW.md`'s own convention:

- **Engineering** — executes the deployment, migrations, rollback
- **Product** — DF-009 sign-off, go/no-go business decision
- **Security** — DF-009 sign-off, authorization-signal monitoring
- **Finance/Ops** — Go Live/entitlement signal monitoring, business-impact
  assessment during an incident
- **Support** — first-day/first-week user-report triage
- **Release owner** — a single accountable person (role, not name) who
  holds go/no-go authority and the rollback decision during the release
  window

---

## 4. Pre-release gates

Reusable checklist. Nothing below is marked complete by writing this
runbook; it is re-run fresh for every release.

**SOURCE CONTROL**
- [ ] Release commit identified (exact SHA on `team-preview`)
- [ ] `team-preview` working tree clean (`git status --short` empty,
  except the pre-existing local-only `.mcp.json`, which is excluded from
  the release by construction since it is untracked)
- [ ] Intended changes reviewed (diff between `main` and the release
  commit read end-to-end; given the 342-commit gap on a first release,
  this is a full review of everything being shipped, not an incremental
  diff)
- [ ] `main` baseline recorded (current `main` SHA, for the release
  record in section 16)
- [ ] No unintended local/untracked files included in the release
  artifact
- [ ] `.mcp.json` excluded
- [ ] No credentials/secrets in the diff (`.env.local`,
  `.env.nexus-test.local`, and any real key/token grepped for and absent)

**QUALITY**
- [ ] Full automated suite green: `npm test` (`vitest run`). Last known
  state per the audit documents: 1117/1117 passing.
- [ ] `npx tsc --noEmit` clean. **Note**: `package.json` has no dedicated
  `typecheck` script; this exact command is what this programme used
  throughout. Consider adding a `"typecheck": "tsc --noEmit"` script for
  future releases, not required for this one.
- [ ] `npm run lint` (`eslint`) result reviewed
- [ ] Any known lint failures classified as pre-existing: per
  `docs/journey-runs/BATCH_33_RESULTS.md`, 1 pre-existing error (an
  unescaped apostrophe in `go-live-detail-page.tsx`) and 2 warnings
  (`react-hooks/immutability`, unused `PendingButton` import), last
  touched in Batch 28, not introduced by the journey-testing programme.
  Confirm this is still the exact and only lint state before release; if
  new lint errors appear, they are not pre-cleared by this note.

**DATABASE**
- [ ] Local migration history understood: 122 files in
  `supabase/migrations/`, timestamp-named, spanning 2026-09-06 through
  2026-10-02 (file-timestamp range, not business dates)
- [ ] Preview/DEV migration state synchronized (DEV/TEST Supabase project
  used throughout this testing programme is at migration
  `20261018000000`; confirm this via `supabase migration list` against
  that project before release)
- [ ] Exact Production migration delta known: **REQUIRES HUMAN
  CONFIRMATION**. No Production Supabase project reference exists
  anywhere in this repository. Before this gate can be checked, identify
  the actual Production Supabase project (if one exists yet) and run
  `supabase migration list` against it to get its current version
- [ ] No unexpected Production-only migration (a migration applied to
  Production that does not exist in `supabase/migrations/` locally) —
  **cannot be checked until the Production project is identified**
- [ ] Migration order verified (apply in filename-timestamp order, never
  out of order; the Supabase CLI enforces this automatically via
  `supabase db push`)
- [ ] Destructive/irreversible migrations identified (see section 7's
  manifest)
- [ ] Rollback implications understood (see section 6)

**PRODUCT**
- [ ] DF-009 explicit release acceptance obtained (Product + Security,
  documented, not verbal)
- [ ] All "Mandatory Before Release" items from
  `docs/NEXUS_RELEASE_READINESS_REVIEW.md` section 8 = complete (that
  review found **0** mandatory items as of 2026-10-02; reconfirm this is
  still true)
- [ ] Accepted-risk register acknowledged (the 14 deferred items + 31
  partial dimensions + 2 blocked dimensions in section 2 above,
  specifically read, not just referenced, by the release owner)

**OPERATIONS**
- [ ] Backup/restore process confirmed (section 6; gate hard-blocks
  release if this cannot be explained)
- [ ] Rollback owner identified (a specific owner type from section 3,
  reachable for the full release window)
- [ ] Monitoring access available (whatever dashboard/log access
  corresponds to section 10's signals, confirmed reachable before T-30)
- [ ] Release observers available (at least Engineering present for the
  deployment window; Product/Security reachable if DF-009-adjacent
  behavior needs a judgment call)

---

## 5. Preview/Staging smoke test

Nexus has one non-Production deployment target: the Vercel Preview
environment that `team-preview` already deploys to automatically on push
(per `CLAUDE.md`'s own deployment section). There is no separately-named
"Staging" environment in this repository; "Preview/Staging" below refers
to that same Vercel Preview deployment.

This is a bounded Tier A smoke test (per
`docs/NEXUS_REGRESSION_PROGRAM.md`'s own Tier A definition: permissions,
maker-checker, workflow transition correctness, commercial truth, Go Live
truth, entitlement/billing/settlement, audit/history, security,
idempotency), not a re-run of the 796-journey catalogue. Use only the
canonical TEST personas/fixtures already established throughout this
programme (`.env.nexus-test.local`, password `123456789123` for all,
per this session's own standing practice); do not create new ones.

| # | Area | Journey ID(s) | Persona | Exact assertion | Mutation required? | Cleanup required? |
|---|---|---|---|---|---|---|
| 1 | Login/session | U-001 pattern | `nexus-test-maker@example.test` | Login succeeds; session persists across one navigation; logout clears it | NO | NO |
| 2 | Customer read | B-001 pattern | `nexus-test-finance-admin@example.test` | Customer Master list loads; a known customer's detail page renders with correct fields | NO | NO |
| 3 | Customer Onboarding | A-001/A-011 pattern | `nexus-test-maker@example.test` | A fresh draft can be created, saved, and its own detail page re-renders the saved value | YES (a new draft case) | YES (leave in draft state or use a disposable test-prefixed name; do not approve to `submitted`+ in Preview) |
| 4 | Customer Change | C-009 pattern | `nexus-test-maker@example.test` | A change request can be created against an existing test customer and its diff view renders correctly | YES (a new CCR) | YES (leave as draft, or cancel) |
| 5 | Commercial Configuration | D-001 pattern | `nexus-test-commercial-viewer@example.test` | An existing Commercial Configuration Version's detail page renders its components correctly | NO | NO |
| 6 | Go Live | H-001 pattern | `nexus-test-go-live-admin@example.test` | An existing customer's Go Live tab renders current line-item status correctly | NO | NO |
| 7 | Maker-checker | V-001 pattern | `nexus-test-legal@example.test` approving a fresh test CCR | A genuine approval transitions the request's `current_workflow_node_key` correctly, confirmed via one DB read | YES (approves the fixture created in row 4) | YES (leave approved; it is a disposable test-prefixed record) |
| 8 | Authorization denial | AB-001 pattern | A persona deliberately lacking the relevant permission (e.g. `nexus-test-reference-master-viewer@example.test` attempting a write action) | The write action is denied server-side with the expected error token, not a silent success | NO (a denied action, by definition, does not mutate) | NO |
| 9 | Workflow transition | J-001 pattern | Same fixture as row 7 | `workflow_node_transitions` shows exactly the expected new row for the approval in row 7, correctly ordered | NO (read-only check of row 7's own effect) | NO |
| 10 | Audit/Timeline/History | R-001 pattern | Any read persona | The Timeline/Activity tab for the fixture touched in rows 3/4/7 renders the real events in correct order | NO | NO |
| 11 | Entitlement/Usage/Settlement | I-001 pattern | `nexus-test-finance-admin@example.test` | An existing customer's Entitlement and Usage page renders its ledger sections without error | NO | NO |

**Total new mutations introduced by this smoke test: 2** (rows 3 and 4's
disposable draft case and change request, approved once in row 7). Both
use the existing TEST persona/fixture conventions already in force; no
new fixture-safety exception is required. If the Preview environment
shares the same Supabase project as the journey-testing programme's
DEV/TEST database (**REQUIRES HUMAN CONFIRMATION**: confirm this before
running the smoke test, since if Preview points at a separate database,
rows 5/6/10/11's "existing customer" references need a Preview-specific
fixture identified first), these two new records are indistinguishable
in character from the hundreds of disposable test fixtures the programme
already created throughout Batches 1-33.

---

## 6. Backup & recovery gate

**This gate is a hard stop. If it cannot be answered, the release does
not proceed (NO DEPLOY), independent of every other gate's status.**

What this repository can confirm:
- Database: Supabase Postgres (managed). Migrations are the only
  schema-change mechanism in use (`supabase/migrations/`, 122 files,
  applied via Supabase CLI `supabase db push` per `CLAUDE.md`'s explicit
  instruction never to use the MCP `apply_migration` tool for applying).
- No application-level backup/export mechanism exists in this codebase;
  whatever recovery capability exists is entirely Supabase's own
  platform-level feature (point-in-time recovery, daily backups, or
  neither, depending on the project's pricing tier).

What this repository **cannot** confirm, each is **REQUIRES HUMAN
CONFIRMATION** before this gate can pass:

| Question | Why it matters | How to answer it |
|---|---|---|
| Does a Production Supabase project already exist, and if so, what is its project ref? | Everything else in this section depends on knowing which project to check | Supabase dashboard, or `mcp__supabase__list_projects` |
| What backup/PITR capability does that project's tier provide? | Determines the actual recovery window and mechanism if something goes wrong | Supabase dashboard → Database → Backups, for the specific Production project |
| Is schema rollback alone sufficient, or does recovery require a full point-in-time restore (schema + data together)? | A schema-only rollback that leaves mismatched data could be worse than no rollback | Depends on the specific migration(s) applied; assess per-migration in section 7's manifest, not assumed generically |
| Is migration rollback automated (a committed "down" migration) or manual? | This repository's 122 migrations are all forward-only `.sql` files; **no down-migrations or rollback scripts were found in `supabase/migrations/`** | Confirmed from repo: manual only, by writing and applying a new forward migration that reverses the change, or by full restore |
| How does application rollback interact with a newer DB schema? | If the DB has already moved forward and the app is rolled back, old app code may not understand new columns/constraints | Must be assessed per-release based on the actual migrations in that release's manifest (section 7); no generic answer exists |
| Would any migration in this release make the previous application version incompatible with the new schema? | Determines whether application rollback alone is safe, or whether it must be paired with a schema rollback | Assessed per-migration in section 7's manifest column "Backward-compatible?" |

**Until a human has answered every row above for the specific Production
project and the specific migration set being released, this gate is
open, and per this runbook's own rule: NO DEPLOY.**

---

## 7. Database migration procedure

Before any Production migration:

1. **Identify current Production migration version.** `supabase
   migration list --linked` (or equivalent) against the actual Production
   project, once identified (section 6). **REQUIRES HUMAN CONFIRMATION**
   until that project is identified.
2. **Identify exact unapplied migrations.** The delta between Production's
   current version and the 122 files in `supabase/migrations/` locally.
   On a first-ever Production release, this delta is presumed to be all
   122, but this must be confirmed against the real Production project,
   not assumed.
3. **Inspect every unapplied migration individually.** Do not apply a
   migration because it exists locally; apply only what has been reviewed
   for this specific release.
4. **Classify each migration** using the manifest template below.
5. **Identify lock/runtime risk** per migration (a migration that
   rewrites a large existing table, adds a `NOT NULL` column without a
   default, or adds an index without `CONCURRENTLY` can hold a lock
   against a live table; on a first-ever release this risk is near-zero,
   since every table starts empty).
6. **Identify reversibility** per migration (see section 6: no automated
   down-migrations exist in this repo; every migration's reversal is a
   new forward migration, assessed case by case).
7. **Identify application compatibility** per migration (does the
   currently-deployed application version (none, on a first release)
   require this schema to already be present, or could it run against
   the pre-migration schema too).

### Migration manifest template

| Migration | Purpose | Risk | Backward-compatible? | Data mutation? | Expected duration | Rollback approach | Verified in DEV/Preview? | Production result |
|---|---|---|---|---|---|---|---|---|
| `<filename>` | `<one line, from the migration's own header comment>` | `<ADDITIVE / DATA BACKFILL / CONSTRAINT CHANGE / DESTRUCTIVE / SECURITY-RLS / RPC-FUNCTION / OTHER>` | `<YES/NO, and why>` | `<YES/NO>` | `<estimate, or "unknown, assess against empty tables on first release">` | `<forward-fix migration / full restore / N/A, additive only>` | `<batch/date this was applied and exercised in DEV/TEST>` | `<filled in during the actual release>` |

On this first release, every one of the 122 migrations needs its own row.
A full read of `supabase/migrations/` (done once, ahead of the actual
release window, not during it) found the large majority are additive
(new tables, new columns, new RPCs, new constraints on columns that are
empty on a first release) or constraint/RLS hardening; a targeted scan
found no wholesale table-drop or bulk `DELETE FROM` migrations. This is a
directional finding from this runbook's own preparation, **not a
substitute for the individual row-by-row manifest** required before this
specific release proceeds; every migration still gets its own
classification, since "mostly looks additive" is not the same claim as
"reviewed."

**No migration is applied simply because it exists locally.** Any
migration whose purpose cannot be confidently classified from its own
content, or whose author is unavailable to clarify intent, is treated as
**DESTRUCTIVE** by default until clarified.

---

## 8. Deployment sequence

Relative ordering, not invented clock times (this codebase has no CI/CD
workflow and no custom deployment script; the actual deployment mechanism
is Vercel's GitHub integration plus the Supabase CLI, both manually
triggered):

| Step | Action |
|---|---|
| **Preflight begins** | Section 4's full gate checklist is worked through; section 5's Preview smoke test is run and passes |
| **Backup/recovery confirmation** | Section 6's gate is explicitly answered and passed; a fresh backup or confirmed PITR window is noted for this specific release |
| **Production baseline metrics captured** | Whatever monitoring exists (section 10) is screenshotted/recorded in its pre-release state, so first-hour comparisons (section 12) have something to compare against |
| **Final go/no-go** | Section 17's one-page card is walked through explicitly by the release owner; a GO or NO-GO is recorded |
| **Migrations, if required** | `supabase link` to the Production project (session 6/7's confirmed identity), then `supabase db push`, applying only the migrations reviewed in section 7's manifest, in filename order |
| **Application deployment** | Merge the release commit to `main` (or whatever branch Vercel's Production environment is configured to deploy from — **REQUIRES HUMAN CONFIRMATION**: no `vercel.json` exists in this repo, so the exact Production branch/auto-deploy configuration lives in the Vercel project dashboard, not in this codebase); Vercel's existing GitHub integration builds and deploys automatically once that branch updates |
| **Health verification** | Confirm the new deployment is live and serving (a basic 200 response on the root route, no build-time error in the Vercel deployment log) |
| **Production smoke tests** | Section 9's bounded, mostly-read-only checklist |
| **Monitoring watch begins** | Section 12's first-hour checklist starts the moment health verification passes |

---

## 9. Production smoke test

Very small. Read-only wherever possible. **No uncontrolled Production
test data is created by this checklist.**

| # | Check | Type | Mutation? |
|---|---|---|---|
| 1 | Application loads (root route returns 200, no client-side error boundary triggered) | Read-only | NO |
| 2 | Login works for one real account | Read-only (session creation is not a data mutation) | NO |
| 3 | A critical read succeeds (Customer Master list loads for a logged-in user with `customer.read`) | Read-only | NO |
| 4 | An authorization gate functions (a user without a given permission is correctly denied that action's UI/control, or the server denies it if attempted) | Read-only | NO |
| 5 | An existing workflow renders (any real, already-approved Onboarding/Change/Commercial Configuration/Go Live record's detail page renders its current state and Timeline without error) | Read-only | NO |
| 6 | Existing historical data renders (the same record's Timeline/Activity shows real historical events in correct order) | Read-only | NO |
| 7 | No obvious RPC/migration mismatch (no "function does not exist" or "column does not exist" error surfaces anywhere touched by checks 1-6) | Read-only (observed as a side effect of 1-6) | NO |
| 8 | No obvious server errors (check Vercel's runtime logs for 500-series errors in the minutes immediately after deployment) | Read-only | NO |

**Mutation-requiring checks are explicitly out of scope for this
checklist**, since no approved Production smoke-test entity currently
exists in this codebase or its documentation. If a genuine write-path
check is later judged necessary for a specific release, and no approved
Production smoke-test fixture has been established for that purpose by
that time, mark it:

**NOT SAFE FOR PRODUCTION SMOKE.**

Do not substitute a real customer's record for this purpose under any
circumstance; this is the same Test Fixture Safety principle this entire
testing programme has operated under, applied to Production.

This checklist does **not** replay the Tier A journey set (section 5
already did that against Preview); it only confirms the newly-deployed
Production instance is serving correctly against its real data.

---

## 10. Monitoring

Translating `docs/NEXUS_RELEASE_READINESS_REVIEW.md` section 7's accepted
risks into an operational watch list. No threshold below is invented
where the evidence doesn't support one.

**AUTHORIZATION**
- `requirePermission` denial rate and distribution by resource. Trigger:
  a spike on a resource with previously near-zero denials, or any
  pattern concentrated around Go Live (DF-009's own flagged area).
- Unexpected authorization **success** (a bypass) cannot be directly
  monitored as a rate or counter; the audit strategy is the governed
  mutation's own audit trail (`audit_log`, every governed action records
  the real resolved actor). Periodic manual review of `audit_log` entries
  against expected actor/permission pairs is the only available
  detection method for this category, not a real-time alert.

**WORKFLOW**
- Failed transition rate (`WORKFLOW_NODE_ALREADY_ADVANCED`,
  `WORKFLOW_GRAPH_DEAD_END`, and similar tokens)
- Stale/current-node conflict rate (the same mechanism Y-020 and J-026
  depend on; any unexpected spike here is a genuine signal, not a known
  limitation, since the underlying mechanism is independently proven)
- Workflow dead-end errors

**APPLICATION**
- Server error rate (500-series responses)
- Page/API latency
- Failed Server Actions/RPCs

**DATABASE**
- RPC latency
- Connection pressure
- Lock waits/timeouts, if the Production Supabase project's tier exposes
  this metric (**REQUIRES HUMAN CONFIRMATION**: depends on the specific
  project's observability tier)

**SCALE** (every item below ties to a specific Pack Y PARTIAL dimension;
no threshold is invented, since this programme never reached production
volume)
- Customer Master count — **establish baseline during first Production
  week; alert on material deviation.** Largest volume ever tested in
  DEV/TEST: 39.
- Queue/worklist depth per team — same approach. Largest tested: 19.
- Commercial components per configuration — same approach. Largest
  tested: 16.
- Workflow depth per definition — **alert on any real workflow exceeding
  ~10 sequential approval nodes**, since the deepest depth ever
  live-walked end-to-end in this programme was 5 (this is the one
  scale-related threshold this runbook states with a specific number,
  because `docs/NEXUS_RELEASE_READINESS_REVIEW.md` section 7 already
  established it directly from evidence, not as a new invention here).
- Team membership size — baseline during first Production week; this
  dimension (Y-008) was never tested at all in this programme.
- Audit history volume per record — baseline during first Production
  week. Largest tested: 341 rows.
- Document volume — baseline during first Production week.

---

## 11. Rollback criteria

**ROLL BACK IMMEDIATELY** (objective, business-impacting, matches the
release-blocker categories this whole programme was built around):

- Authentication broadly unavailable (no user can log in)
- A genuine authorization bypass (a denied-by-design action succeeds)
- A genuine maker-checker bypass (self-approval succeeds, or a
  concurrent-approval race produces a double-approval or corrupted state)
- Workflows cannot progress for a material set of users (a transition
  that should succeed is universally failing)
- Incorrect commercial values are being computed or displayed as correct
- Incorrect Go Live state (a line item shows Live when it is not, or vice
  versa)
- Incorrect entitlement/billing/settlement calculation
- Data loss or corruption of any kind
- Repeated unhandled server errors on a critical path (login, approval,
  Go Live, entitlement)
- A migration failure leaves the schema in a partially-applied,
  incompatible state
- A material regression affecting multiple users, not an isolated report

**INVESTIGATE / HOTFIX POSSIBLE** (not an automatic rollback trigger):

- A cosmetic UX defect (a misleading label, a missing loading state, a
  known pre-existing lint/accessibility gap)
- A single, isolated user report with no confirmed reproduction
- Any of the 14 already-accepted deferred items (section 2) manifesting
  exactly as documented, since these were explicitly decided to be
  acceptable
- A monitoring signal crossing an un-evidenced "establish baseline"
  threshold for the first time (this is expected on a first Production
  week; it becomes a trigger only once an actual anomaly is confirmed
  against that new baseline, not on first observation)
- Latency or scale-related degradation at volumes this programme's own
  Pack Y testing already disclosed as unproven, absent an actual
  correctness failure (per `docs/NEXUS_RELEASE_READINESS_REVIEW.md`'s own
  instruction not to treat "scale not reproduced in DEV" as a blocker,
  the same principle applies to not treating it as an automatic rollback
  trigger; it is a monitoring-and-scale-work signal, not an incident,
  unless it produces one of the IMMEDIATE triggers above)

---

## 12. Rollback procedure

**Application rollback**: Vercel retains prior deployments; returning to
the previous known-good version is a redeploy of that prior deployment
(or a revert commit on whatever branch Vercel's Production environment
deploys from, per section 8's note). The exact mechanism (Vercel
dashboard "promote" / "rollback" action vs. a git revert triggering a new
build) **REQUIRES HUMAN CONFIRMATION** against the actual Vercel project
configuration, since this repository contains no `vercel.json` specifying
it.

**Database rollback**: **Never assume database migrations are
reversible.** This repository's 122 migrations are forward-only SQL
files with no companion down-migration. Confirmed from the migration
scan in section 7: the large majority are additive (safe to leave applied
even if the application is rolled back, so long as the prior application
version does not error on the presence of new, unused columns/tables,
which Postgres and this application's query patterns generally tolerate).
For any migration classified DESTRUCTIVE or CONSTRAINT CHANGE in the
actual release's manifest (section 7), the specific reversal approach
(forward-fix migration vs. full restore) must already be decided **in
that migration's own manifest row**, before deployment, not improvised
during an incident.

**When forward-fix is safer than reverse migration**: whenever the
migration has already allowed real production data to be written in the
new shape (even briefly), a reverse migration risks losing that data; a
forward-fix (a new migration correcting the issue while preserving
whatever was written) is safer in that case. Whenever no real production
data has yet depended on the new shape (true for essentially every
migration on a first-ever release, since Production starts empty), a
reverse migration is lower-risk.

**How restore would work, if necessary**: depends entirely on section
6's still-open questions (backup/PITR capability for the real Production
project). **This runbook cannot specify a restore procedure until that
gate is answered.**

**Incompatibility scenarios, stated explicitly:**

- **Old app + new DB** (DB migrated forward, application rolled back):
  safe only if every new column/table/constraint introduced is additive
  and the old application code never queries a column that no longer
  exists or violates a new constraint it doesn't know about. Each
  migration's manifest row (section 7) must state this explicitly before
  release, not be assumed.
- **New app + old DB** (application deployed forward, migration not yet
  applied or rolled back): this is the exact reason section 8's
  deployment sequence applies migrations **before** the application
  deployment, never after; a new application version that expects a
  column/RPC the database doesn't yet have will fail immediately and
  visibly (a clear 500-series error, not a silent data-correctness
  issue), which is the safer failure mode of the two.

---

## 13. First-hour checklist

High-signal only; no vanity monitoring.

**0-15 minutes**
- [ ] Confirm the deployment is live (section 8's health verification)
- [ ] Run section 9's Production smoke checklist in full
- [ ] Confirm login works for at least one real account
- [ ] Confirm no 500-series error spike in the first few minutes of
  traffic
- [ ] Confirm no "function/column does not exist" errors (migration
  mismatch signal)

**15-30 minutes**
- [ ] Spot-check one real authorization denial (an action a logged-in
  user should not be able to do is still correctly denied)
- [ ] Spot-check one real workflow transition if organic traffic produces
  one, or use a disposable test record per section 5's conventions if not
- [ ] Watch DB/RPC error rate and latency against the pre-release
  baseline captured in section 8
- [ ] Confirm no unexpected spike in authorization-denial rate

**30-60 minutes**
- [ ] Review error logs for anything novel (not already known from
  Preview/DEV testing)
- [ ] Confirm business-critical paths are reachable: a real customer
  record loads, a real Go Live/entitlement view loads, a real approval
  queue loads
- [ ] Release owner makes an explicit continue/rollback call based on
  everything above, recorded in the release record (section 16)

---

## 14. First-day checklist

- [ ] Review error logs across the full day, not just the first hour
- [ ] Inspect any failed workflow actions specifically (not just
  aggregate error rate)
- [ ] Inspect access-denied anomalies (any pattern inconsistent with
  normal usage)
- [ ] Review support/user reports received during the day
- [ ] Confirm core financial/business flows completed correctly for any
  real transactions that occurred (Go Live, entitlement, settlement, if
  any real activity touched these)
- [ ] Review migration-related errors specifically (anything suggesting
  a schema mismatch that didn't surface in the first hour)

---

## 15. First-week checklist

Establish production baselines for every area `docs/
NEXUS_RELEASE_READINESS_REVIEW.md` flagged as not demonstrated at scale,
per section 10 of this runbook:

- [ ] Customer count
- [ ] Queue/worklist depth per team
- [ ] Team membership size
- [ ] Workflow depth per definition (watch specifically for anything
  approaching the ~10-node threshold already established)
- [ ] Commercial components per configuration
- [ ] Audit history volume per record
- [ ] Document volume
- [ ] Response latency, generally

Use these baselines going forward to turn section 2's 31 scale-related
PARTIAL dimensions into observable operating thresholds, per
`docs/NEXUS_REGRESSION_PROGRAM.md`'s own monthly re-measurement cadence
for Pack Y. This is the mechanism by which "scale not reproduced in DEV"
eventually becomes "scale observed and monitored in Production," not a
one-time checklist.

---

## 16. Release record template

Filled in fresh for every release; the first filled instance for this
release is created when section 8's sequence actually runs, not before.

```
Release ID/version:
Date/time:
Release commit (team-preview SHA):
Previous Production commit: none (first release), or <SHA> for any future release
Migration list: <every filename applied, in order>
Preflight result: <section 4 gate outcome>
Backup/recovery confirmation: <section 6 gate outcome, explicit>
Approvals: <DF-009 sign-off record, go/no-go record>
Deployment result: <success / failure, with detail>
Smoke-test result: <section 9 checklist outcome>
Incidents: <none, or description>
Rollback required? YES/NO
Final status:
First-hour observations: <section 13>
First-day observations: <section 14>
```

---

## 17. Go / No-Go checklist

**GO only if every box is checked:**

- [ ] Release commit identified
- [ ] Tests green (`npm test`, full suite)
- [ ] Typecheck green (`npx tsc --noEmit`)
- [ ] Migration delta reviewed (every migration in section 7's manifest
  has its own completed row)
- [ ] Recovery path confirmed (section 6's gate explicitly answered, not
  skipped)
- [ ] DF-009 acceptance recorded (Product + Security, in writing)
- [ ] Preview/Staging smoke passed (section 5, all 11 checks)
- [ ] Monitoring available (section 10's signals are actually reachable,
  not theoretical)
- [ ] Rollback path confirmed (section 12, specifically for this
  release's actual migration set)
- [ ] Release owner ready (named role, present for the full window)

**Otherwise: NO-GO.** This is a process rule. A missing or unanswered box
is a NO-GO regardless of how low-risk it appears, including on the first
release when enthusiasm to ship is highest.
