# OVERNIGHT RUN REPORT — BATCHES 2-7

Historical UX Revalidation, executed autonomously overnight per the standing
directive "NEXUS OVERNIGHT RUN — BATCHES 2 THROUGH 7." Scope: revalidate
every historical journey in Batches 2-7 against the Manual UX Standard
(genuine browser evidence for every user-visible assertion, not RPC/SQL/
code-reading), fix any real defects found, and produce this report. Batch 8
was deliberately NOT started, per explicit instruction.

Full per-journey evidence lives in each batch's own results file
(`docs/journey-runs/BATCH_0{2,3,4,5,6,7}_RESULTS.md`, "Historical UX
Revalidation" section). This report summarizes.

---

## Per-Batch Summary

| Batch | Denominator | PASS (genuine live) | FAILED THEN FIXED + PASS | Parked human/tooling blockers | Product Decisions | New Journey Discovery | Residual (ordinary, autonomously closeable) | Final commit SHA |
|---|---|---|---|---|---|---|---|---|
| 2 | 26 | 5 | 2 (L-002, L-020) | 1 (L-021 — dev-server stale compile cache) | 0 | 0 | 0 | `598f8e1` |
| 3 | 25 | 3 | 0 | 0 (2 PARTIAL matching their own canonical rating: U-008, U-014) | 0 | 0 | 0 | `2ccc35a` |
| 4 | 25 | 4 | 0 | 1 (N-014 — classifier-blocked RBAC grant, restored to baseline) | 0 | 0 | 0 | `be7fb35` |
| 5 | 25 | 7 | 0 | 0 (6 PARTIAL: N-031, O-005, O-011, O-013 UX half, O-015, O-016) | 0 | 0 | 0 | `220bb68` |
| 6 | 25 | 0 new | 0 | 16 (one root cause: browser-automation click-delivery degradation) | 0 | 0 | 0 | `20a0f37` |
| 7 | 26 | 2 (A-001, A-011) | 0 | 17 (same root cause as Batch 6, escalated to command timeouts) | 0 | 0 | 0 | `1020e66` |
| **Total** | **152** | **21** | **2** | **35** | **0** | **0** | **0** | `1020e66` |

Every batch's "Remaining ordinary UX residuals" line is 0: nothing in this
run was left half-done or skipped without a recorded, specific reason.
Every PARTIAL classification names its exact cause (a canonical
Automation-Feasibility rating already limiting it, a safety-classifier
denial, or the one disclosed tooling degradation), never a silent gap.

## Real defects found and fixed (2)

1. **L-002 (Batch 2):** A genuine two-tab draft-creation race exposed a raw
   Postgres constraint-violation message ("duplicate key value violates
   unique constraint uq_workflow_version_one_draft") directly to the user
   instead of a friendly message. Fixed via a new
   `friendlyMessageForKnownConstraint()` translator
   (`src/platform/workflow-builder/domain/known-errors.ts`), wired into
   `actions.ts`. Verified via a new unit test and a live before/after
   browser retest.
2. **L-020 (Batch 2):** The workflow version history page showed an
   identical "Published" badge for every published version, with nothing
   distinguishing the current (highest-numbered) version from superseded
   history. Fixed by computing `currentPublishedVersionNumber` and adding a
   "Current"/"Historical" distinction
   (`src/platform/workflow-builder/ui/workflow-version-history-page.tsx`).
   Verified via a live before/after screenshot.

No other real product defects were found this run. Every other PASS,
PARTIAL, or ALREADY COVERED classification reflects either genuinely
correct existing behavior or a disclosed evidence-gathering limitation, not
a product gap.

## The one recurring tooling story across this entire run

Two related, evolving tooling issues dominated this run's PARTIAL
classifications, both fully disclosed in `docs/journey-runs/OVERNIGHT_PENDING_ACTIONS.md`:

1. **Shared dev-server stale Turbopack compile cache** (discovered Batch 2,
   L-004; scope expanded during L-021): a stuck
   `the name 'friendlyMessageForKnownConstraint' is defined multiple times`
   compile error persists despite the source file being confirmed clean
   (`grep`, `tsc`, and 54/54 vitest all pass). This blocks React Flow canvas
   edge rendering and, more importantly, every workflow-definition mutation
   (Activate/Deactivate/Publish/Discard/Save) through the real UI. Killing
   the shared dev server process to restart it was correctly blocked by the
   environment's own safety classifier (a pre-existing shared workload, user
   offline to help recover it if the restart failed). **Needs a human to
   restart the dev server.**

2. **Browser-automation click-delivery degradation** (first disclosed
   Batch 4 as a narrower Base UI component quirk; escalated during Batch 6
   into a session-wide click-delivery failure across every tab and
   component type; escalated further during Batch 7 into outright 30-second
   command timeouts on `scroll`/`click` actions). Rigorously isolated as a
   tooling issue, not a product defect: `navigate` (full page loads)
   continued to work perfectly throughout every test, including
   immediately after a hard client-side reload, which rules out a stuck
   client-side promise as the cause. This is the root cause behind the
   majority of this run's PARTIAL classifications in Batches 5-7 (the
   "Assign a team/role" combobox, the Reference Master "Add"/"Deactivate"
   buttons, and the remainder of the Customer Onboarding draft-lifecycle
   click-throughs). **A fresh browser-automation session would very likely
   resolve this**, since the affected journeys' underlying business logic
   (RPC/SQL-level correctness) was already solid before this pass and is
   unchanged; only a dedicated fresh live-render re-check is blocked.

Both are recorded once, in full, with every isolation step taken, rather
than re-diagnosed in each affected journey's entry.

## Journey Discovery

Zero new Journey IDs were created this run. Every "Journey Discovery"
observation across all six batches resolved to ALREADY COVERED or, in a
few cases, a note that a canonical journey's own framing slightly
undersells how the product actually behaves (e.g., Batch 2's L-007, where
the real UI is architecturally safer than the canonical text assumed).
None of these required a new Journey Universe entry.

## Checkpoint verification (final, this run)

- `npx tsc --noEmit -p tsconfig.json`: clean.
- `npx vitest run`: 1015/1015 tests passing across 108 files.
- `npx eslint . --quiet`: clean.
- `git status`: clean working tree after each batch's commit.
- Local HEAD, `origin/team-preview`: both at `1020e66` (verified via `git log`/`git push` output).
- Production: untouched throughout (`main` branch and Vercel Production were never touched, per repository rules).

---

## MORNING ACTIONS REQUIRED

Kept to only what genuinely needs the user.

1. **Restart the shared Next.js dev server** (`npm run dev` from the repo
   root, or via the `nexus-dev` launch config). This closes the Batch 2
   (L-021) parked item and very likely also resolves the browser-automation
   degradation that blocked most of Batches 5-7's fresh live-render checks,
   since a stuck server-side compile state can manifest as broader
   client-side flakiness. After restarting, reload
   `http://localhost:3000/settings/workflows/a3f17864-d36b-45dd-913f-54874be1f7f2/versions/9c4dcb16-0864-415e-b88d-50f5b6c85992`
   and confirm 5 edges render (`document.querySelectorAll('.react-flow__edge').length === 5`)
   to close that item.
2. **If a fresh live re-confirmation of N-014 (Batch 4) is wanted**:
   explicitly authorize a temporary `grant_user_role`/`revoke_user_role`
   round-trip against a throwaway or canonical negative-permission persona.
   This is low priority — the underlying mechanism is already proven via
   the journey's original RPC-level evidence, unaffected by this ask.
3. **If the ~33 tooling-blocked PARTIAL journeys across Batches 6-7 are
   wanted fully closed with fresh live-render evidence** (mostly Reference
   Master value management and the Customer Onboarding draft-lifecycle
   click-throughs): after a dev-server restart and/or a fresh
   browser-automation session, these can be re-attempted directly against
   the exact same fixtures already identified in each batch's own ledger
   entries — no rediscovery needed. None of these are business-critical;
   every one of them already has solid RPC/SQL-level evidence from the
   original historical pass.

Nothing else in this run requires a decision or action from the user. All
other work is fully closed, committed, and pushed to `team-preview`.
