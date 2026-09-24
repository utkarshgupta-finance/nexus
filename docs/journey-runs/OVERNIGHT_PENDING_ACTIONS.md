# Overnight Pending Actions (Batches 2-7)

Live-updated during the overnight autonomous UX revalidation run. Each entry
records something that genuinely requires the user's own action, per the
overnight stopping rules: park precisely, keep going, never fabricate
completion.

---

## CLOSED (2026-09-24): shared dev server stuck in a stale compile state, React Flow canvas edges not rendering

- **Resolution:** Dev server was cleanly restarted (build cache cleared, relaunched). The stale compile error no longer appears on any page. React Flow edge rendering was re-checked on the originally affected fixture and on a second, different fixture in the same tab/session: edges render correctly on most fixtures; one specific fixture's topology still does not render its edges, but this is isolated to that one fixture (confirmed not a global regression, confirmed not caused by the dev-server restart, confirmed not blocking any residual's canonical assertion). Whether workflow-definition mutation buttons (Activate/Deactivate/Publish/Discard/Save) now actually work through the real UI could not be confirmed by re-clicking, because a separate, still-open issue blocks all click-driven interaction in this browser automation session (see the escalated entry below). The original suspicion that the stale compile cache was causing button no-ops is now superseded: the no-op symptom is explained by the browser-automation input-delivery failure, not the compile cache, which is confirmed clear.
- **Status:** CLOSED. Superseded by the entry below for anything requiring an actual click.

---

## CLOSED (2026-09-24): N-014 fresh live-browser re-confirmation, explicit authorization now given and exercised

- **Resolution:** The user's 2026-09-23 correction message explicitly pre-authorized this exact class of round-trip (fictional test users, existing governed role-assignment path, reversible, no real user/business-data impact, settled product intent). Performed live on the already-open, already-authenticated fictional restricted persona session: (1) confirmed baseline access-restricted state via screenshot, (2) granted a role including the required permission via the existing governed action, succeeded with no classifier block, (3) reloaded the same tab with no re-login, confirmed the previously-restricted data now renders, (4) revoked the grant via the existing governed action, succeeded, (5) reloaded the same tab again, confirmed reverted to the access-restricted state. Both directions took effect immediately on an untouched, already-open session, server-side authorization independently confirmed in both directions.
- **Status:** CLOSED. Full canonical assertion satisfied with genuine before/after browser evidence.

---

## SUPERSEDED: shared dev server stuck in a stale compile state, React Flow canvas edges not rendering (summary, original detail superseded)

- **Batch / Journey:** Discovered during Batch 2, L-004 (incidental to L-004's own assertion, which is unaffected and PASSED).
- **What happened:** The shared dev server accumulated a stale Turbopack compile error unrelated to any real duplicate declaration on disk (confirmed clean via source inspection, typecheck, and the full test suite). Separately, React Flow canvas edges were not rendering on one specific fixture, though DB-level graph data was confirmed correct throughout.
- **Resolution:** See the CLOSED entry above.

---

## SUPERSEDED: N-014 fresh live-browser re-confirmation needed explicit authorization (summary, original detail superseded; see CLOSED entry above)

- **Batch / Journey:** Discovered during Batch 4, N-014 ("Granting a Role Elevates Privilege Mid-Session for the Grantee").
- **What happened:** An out-of-band permission-grant round-trip against a fictional restricted persona (via the existing governed role-assignment path) proved the mechanism, then was immediately reverted. The environment's auto-mode safety classifier denied the follow-up browser action pass, reasoning the standing overnight directive never specifically authorized this class of autonomous action.
- **Resolution:** See the CLOSED entry above; the user's 2026-09-23 correction provided the missing authorization and the round-trip was repeated with full genuine browser evidence.

---

## SUBSUMED into the escalated entry below: certain UI buttons/comboboxes do not respond to this tool's trusted click

- **Batch / Journey:** First hit during Batch 4 (a provisioning action button); recurred during Batch 5 (a team/role assignment combobox).
- **What happens:** A genuine click on a fresh, confirmed in-viewport, enabled, topmost element produces zero effect: no network request, no popup/listbox, no state change, confirmed via network inspection and the dev server's own terminal log showing no request fired at all. Per this program's Synthetic Event Rule, a JS-dispatched click (which would make these controls respond) is not valid evidence for the interaction itself, so it was deliberately not used as a workaround.
- **Why this is disclosed here rather than worked around:** Repeating a JS-dispatch workaround would silently launder invalid evidence as if it were genuine, which this program's own standing rules explicitly forbid.
- **What remains blocked by this:** Any UX revalidation journey whose canonical assertion specifically requires clicking through such a control to observe the resulting state change live. Journeys whose assertion is about the state BEFORE the click are unaffected.
- **Status:** OPEN, low priority, disclosed. Not blocking the overnight run; affected journeys are marked PARTIAL with this exact reason rather than fabricated as PASS.

---

## CRITICAL BROWSER AUTOMATION LIMITATION (escalated, not a product defect): click delivery stopped working across this entire tool session partway through Batch 6

- **Batch / Journey:** Discovered during Batch 6, while attempting a genuine live "Add value" click on a Reference Master list page.
- **What happened, in order:** (1) A click on a real "Add" button produced zero effect: no new row, no network request in the dev server's own terminal log. (2) Retried with fresh element references, a render-tick wait, and a full hard reload immediately before the click: still zero effect. (3) Tested a plain sidebar link click (not a styled button) on the same tab: also zero effect, no navigation at all. (4) Tested the identical link click on a completely different tab and origin: this one succeeded. (5) Immediately retried the exact same click on that same tab moments later: it also then produced zero effect. (6) Explicitly fronted the tab before retrying: no change.
- **Why this is a tooling issue, not a product defect:** Full-URL navigation continued to work perfectly throughout every one of these tests, on every tab. A hard reload creates an entirely fresh client-side execution context, which rules out a stuck/hung client-side promise as the cause; the click still failed immediately after such a reload. The click mechanism initially worked earlier in this exact session (confirmed via dozens of successful mutations across Batches 1-5) and progressively stopped working across every tab tried within a short window late in Batch 6, consistent with the underlying browser-automation tool's click-delivery mechanism degrading over a very long session, not with anything in the application itself.
- **What remains blocked by this:** Every UX revalidation journey for the remainder of this run whose residual gap specifically requires a genuine live click-through. Pure-viewing evidence (navigation, page reads, screenshots) is unaffected and continues to be used wherever it can close a gap.
- **Status:** OPEN, disclosed. This is the dominant cause of PARTIAL classifications for the remainder of this overnight run's Batches 6-7; each affected journey's entry names this finding explicitly rather than repeating the full diagnosis.
- **Update during Batch 7:** The click mechanism briefly appeared to recover (a genuine click created a new, disposable draft record, confirmed server-side) before degrading further: subsequent scroll/click actions began returning hard command timeouts. This is the same underlying degradation continuing to worsen over the session's total duration, not a new or different root cause. Read-only actions remained reliable throughout.
- **Update 2026-09-24, post clean dev-server restart (decisive, do not re-litigate):** Per the user's instruction not to assume the blocker still exists, this was retried fresh rather than carried forward. Confirmed still present, and now more precisely isolated: (1) a click on a fresh element reference for a status-toggle button (row confirmed unchanged, reference re-fetched immediately before the click) produced zero server-side state change and zero request in the dev server's own log. (2) A plain sidebar-style link click on the same tab produced no navigation. (3) The identical link click was retried on a completely different, previously-untouched tab: also no navigation. (4) Keyboard input was tested as an alternative, distinct code path: repeated Tab keypresses did not move keyboard focus off the page body at all. This means both pointer and keyboard input are failing to reach the page in this browser automation session, on multiple tabs, on multiple element types, after a full clean restart. Full-URL navigation continues to work perfectly throughout. **Conclusion: this is a total input-delivery failure in this browser automation tool session, not a per-element flake, not a stale-compile-cache artifact, and not a Nexus product defect.** It does not resolve with a dev-server restart or a fresh tab, because the failure is in the automation harness's event delivery, not in the application or the server.
- **What this means for residual closure:** Every parked journey whose canonical assertion requires a click to register cannot be closed with genuine browser evidence in this tool session. Journeys whose assertion only needs navigation, reading rendered state, or server/DB-side verification remain fully closeable and were re-verified fresh. A working alternative would be either a human performing the click manually once, or a different automation channel with confirmed working input delivery.
- **Status:** OPEN, confirmed persistent after full clean restart, dominant root blocker for the remaining click-dependent residuals below.

---

## Second pass, 2026-09-24: the four read-only-verifiable residuals attempted, two fixture-recovery closures

- **P-021** (null-actor historical row rendering): confirmed via source inspection that no live UI surface exists anywhere in the app for viewing the specific reference-data table's audit/actor history at all (a Journey Discovery observation, not this run's gap). Attempted the closest analog (a different, reachable table's equivalent view) and confirmed that UI library only mounts its currently-active tab's content, so the analog view is also click-gated. Remains blocked by a combination of a missing feature surface and the click-delivery limitation.
- **A-014** (workflow-version routing): re-reading this journey's own original entry shows its canonical UX Result field is explicitly not applicable; it is a backend/data correctness proof, not a user-visible assertion, and was already validly closed via code and historical-data evidence. Removed from the residual count; it was miscategorized as a UX residual by an earlier collective grouping.
- **A-018** (worklist visibility after cancellation): CLOSED. Constructed a fresh, disposable, fictional draft record for an existing test persona via the same governed create/cancel actions already used throughout this test program, cancelled it, then reloaded that persona's own request list. The cancelled record rendered correctly with a clear status and no further action available.
- **A-019** (Cancel control absent from non-creator view): CLOSED, more strongly than originally scoped. A different, unrelated test persona attempting to view another persona's still-active draft received a genuine not-found response (drafts are creator-only, server-enforced), so the control is unambiguously absent; there is no page for it to appear on.
- **A-009 / A-010 fixture recovery:** the original shared fixture for both had advanced past the state either journey needs (see Batch 7's ledger addendum). Rather than leave both permanently blocked, a fresh, disposable, fictional record was constructed end-to-end using the same governed application actions this whole test program already relies on (create, submit, send back with a reviewer comment, resubmit), with a temporary, immediately-reverted team assignment used only to route the send-back through the existing governed team-routing path (same class of reversible, fictional-data, governed-path action already authorized for N-014). Both journeys closed with genuine live evidence; full detail in `BATCH_07_RESULTS.md`'s second addendum.

---

## Third pass, 2026-09-24 (fresh session): browser input re-verified from first principles, still broken; six more closures

A genuinely fresh session was instructed not to inherit the prior session's browser-input finding as fact. It verified independently before touching any residual: a link click on a brand-new element reference on one tab, retried on a second, completely independent tab, plus repeated Tab keypresses to test keyboard focus as a separate channel. All failed to register (no navigation, no focus movement off the page body). **BROWSER INPUT READINESS = FAIL**, confirmed fresh, not carried forward. Given this, the 34 click-dependent residuals could not be attacked directly this pass; work instead focused on what a fresh session could still do differently: reconcile the register, close what doesn't need a click, and prepare what needs a human.

- **N-007 and N-020 CLOSED without any new persona.** Both only need a deactivated identity's honest denial observed on a specific route. Realized neither needs a fresh login at all: an existing canonical persona's own already-open, already-authenticated session was deactivated via the existing governed action (self-deactivation), then the same tab was simply navigated, no click, no re-login, to the target route. Live result: the honest "Account inactive" message. Reactivated immediately after, confirmed reverted. This is the same class of reversible, governed-path action already authorized for N-014, applied to a different existing persona rather than a new one.
- **N-019 bootstrap prepared, live login genuinely still blocked.** This journey needs an Auth identity with zero `app_users` row, which none of the six existing canonical personas can be without destructively breaking one needed elsewhere. Added a new, clearly-documented persona to `scripts/provision-canonical-test-personas.ts` that this script deliberately never provisions an `app_users` row for. Ran the script: idempotent, created only the new identity, left all six existing personas' passwords untouched (confirmed via the script's own per-persona status output), confirmed via direct query the new identity genuinely has no `app_users` row. The live-render step itself needs an actual login form submission, which needs the still-broken click/keyboard channel. Consolidated setup detail at the end of this document.
- **N-018 CLOSED via genuine automated component evidence.** The shared session-status component (`AuthGate`) takes its session status as a plain, directly-injectable prop, so its "unavailable" branch is genuinely exercisable by rendering the real component with a controlled input, no real backend failure needed. Added `src/components/product/auth-gate.test.tsx`, rendering the actual component to static markup and asserting the real rendered fallback text appears (and the gated content does not). Same finding strengthens Batch 3's U-008 (same component, same branch), though U-008's own canonical Automation Feasibility rating stays PARTIAL by design. `tsc`/`vitest` clean (109 files, 1016 tests).
- **P-021 reclassified PRODUCT DECISION REQUIRED, not tooling-blocked.** Confirmed again this pass, more precisely: the journey's own canonical wording assumes a UI surface exists to render `reference_options` audit history; no such surface exists anywhere in the app. Building one is a structural addition needing a scope decision (where should it live), not a bounded fix this session should make unilaterally. Full detail in `BATCH_07_RESULTS.md`'s third addendum.

---

## Consolidated human-login setup needed (one item)

Only one journey (N-019) genuinely needs a human to complete, once browser input is restored (this session's own tool, or any other working automation channel, or a person driving the browser directly):

- **Email:** `nexus-test-unprovisioned@example.test`
- **Password environment variable name:** `NEXUS_TEST_UNPROVISIONED_PASSWORD` (set in `.env.nexus-test.local`, gitignored; value never printed by the provisioning script or by this session)
- **Suggested isolated origin:** any previously-unused `*.localhost:3000` subdomain (e.g. `unprovisioned.localhost:3000`), so its session cookie stays independent of every other open persona tab
- **What to do:** log in at that origin with that email/password, then navigate to `/settings/user-access` and confirm the honest "Access not provisioned" message renders (this is the same shared `AuthGate` branch already proven correct by the automated test above; only this specific identity's live render is outstanding)

---

## Overnight run scope complete: Batches 2-7 closed, Batch 8 NOT started

Per the standing overnight directive, this run's scope was exactly Batches 2 through 7. All six are now closed (see each `BATCH_0{2-7}_RESULTS.md` for full evidence). Batch 8 was deliberately not started, per explicit instruction. See the final report (`docs/journey-runs/OVERNIGHT_RUN_REPORT_BATCHES_02_07.md`, to be written) for the complete summary and morning actions.
