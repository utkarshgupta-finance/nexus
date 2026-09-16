# Manual Acceptance Test Checklist

Lightweight checklist for manual acceptance testing after Program 4
Hardening + Preview Release. Not the exhaustive scenario matrix
(`docs/CUSTOMER_LIFECYCLE.md` has that); this is a fast, human-run pass
over what a real reviewer should click through before signing off.

Mark each row **PASS**, **FAIL**, **CONFUSING**, or **N/A**, and use
Notes for anything worth a follow-up. Descoped domains (Go Live,
Entitlement Ledger, Agreement Lifecycle, Legal-Commercial Coverage) are
intentionally excluded: they are not built.

## How to use this

1. Sign in with a real account.
2. Work section by section, top to bottom.
3. For any FAIL or CONFUSING result, capture: what you did, what you
   expected, what actually happened, and a screenshot if visual.
4. Where a test needs two different user accounts (maker vs. checker),
   note that in the Notes column if you only had one available.

## Authentication

| # | Test | Result | Notes |
|---|------|--------|-------|
| 1 | Sign in with a valid account reaches the app, not a blank/error page | | |
| 2 | Sign out returns to `/login` | | |
| 3 | Visiting a protected route while signed out redirects to `/login`, then back to the original page after sign-in | | |
| 4 | An unprovisioned or inactive account gets an honest "no access" message, never a crash | | |

## Navigation

| # | Test | Result | Notes |
|---|------|--------|-------|
| 5 | Every sidebar item leads to a real page, never a 404 | | |
| 6 | Settings sub-nav (Reference Master / Team Master / Workflows / User Access) only shows tabs the current session can actually read | | |
| 7 | Browser back/forward through a few pages does not break the layout | | |

## Customer Onboarding

| # | Test | Result | Notes |
|---|------|--------|-------|
| 8 | Onboarding landing page loads and lists existing cases | | |
| 9 | Starting a new onboarding case opens a fresh draft | | |
| 10 | Draft autosaves/Save Draft persists progress across a reload | | |
| 11 | No nested/inner scrollbar trapping the page; the whole page scrolls naturally | | |
| 12 | Submitting with an incomplete required stage shows which stage(s) are incomplete, not one generic error | | |
| 13 | Cancel Draft works from a draft case, and the cancelled case is clearly marked and no longer editable | | |
| 14 | No `__all__` (or similar raw sentinel) ever visible in any filter dropdown | | |

## Attachments

| # | Test | Result | Notes |
|---|------|--------|-------|
| 15 | Uploading a document shows it in the list immediately | | |
| 16 | Reopening a saved draft still shows previously uploaded attachments | | |
| 17 | Attachments survive a Send Back and remain visible on the resubmission | | |
| 18 | Downloading an attachment retrieves the correct file | | |

## Approvals

| # | Test | Result | Notes |
|---|------|--------|-------|
| 19 | The unified Approvals inbox lists items actually awaiting the signed-in user's action | | |
| 20 | Approving a case/request/version by a DIFFERENT user than its creator succeeds | | |
| 21 | The same user who created a request cannot approve it: a clear "you cannot approve your own request" message appears, not a raw error | | |
| 22 | The same self-block applies to Reject and Send Back, not only Approve | | |
| 23 | Send Back requires a reason and shows it on the requester's side | | |

## My Work

| # | Test | Result | Notes |
|---|------|--------|-------|
| 24 | My Work shows only items relevant to the signed-in user (their drafts, their pending approvals) | | |
| 25 | Completing an action (approve/send back/submit) removes the item from My Work without a manual refresh feeling necessary | | |

## Operations Queue

| # | Test | Result | Notes |
|---|------|--------|-------|
| 26 | Operations Queue shows only in-flight items, never completed/cancelled ones | | |
| 27 | Each row's "current responsibility" label is a role/team, not a hardcoded person | | |

## Customer Master

| # | Test | Result | Notes |
|---|------|--------|-------|
| 28 | Customer Search finds an existing customer by name | | |
| 29 | Customer detail page shows Primary Contact and Tax fields correctly | | |
| 30 | Field History tab shows Requested By / Approved By as real names, never a raw UUID | | |
| 31 | Customer Activity timeline reads clearly (who did what, when) for Approved/Sent Back/Cancelled/Deactivated events | | |

## Customer Change

| # | Test | Result | Notes |
|---|------|--------|-------|
| 32 | "Change Customer" entry point from Customer Master offers Customer Details / Commercials / Both | | |
| 33 | Customer Details option opens a governed Change Request with the correct current values pre-filled | | |
| 34 | Commercials option routes into a governed Commercial Version draft | | |
| 35 | Current vs Proposed diff clearly shows only the fields that actually changed | | |
| 36 | Cancel Draft works and the cancelled request shows a clear "Cancelled" status, not still-actionable | | |
| 37 | Self-approval is blocked here too (see Approvals #21-22) | | |

## Commercials

| # | Test | Result | Notes |
|---|------|--------|-------|
| 38 | Commercial Configuration detail page loads with current components | | |
| 39 | Creating a new Commercial Version opens a governed draft | | |
| 40 | Version History shows Approved By as a real name and the correct status badge | | |
| 41 | Effective-date validation rejects a date that would be out of order with the current active period | | |

## User Access

*Requires an account holding `user_access.read`/`write`. If none exists yet, mark N/A and see Phase 3 finding in `docs/AUTHORIZATION_MODEL.md` §22.*

| # | Test | Result | Notes |
|---|------|--------|-------|
| 42 | `/settings/user-access` loads and lists provisioned users | | |
| 43 | Editing a user's display name persists and shows up everywhere that user is referenced as an actor | | |
| 44 | Team assignment column shows the correct team(s) | | |
| 45 | Roles column correctly shows Maker/Checker/other roles held | | |
| 46 | Granting a role to a user works and takes effect immediately (that user can now do what the role permits) | | |
| 47 | Deactivating a user blocks their next sign-in attempt with an honest message | | |

## Team Master

*Requires an account holding `team.read`/`write`.*

| # | Test | Result | Notes |
|---|------|--------|-------|
| 48 | `/settings/teams` loads and lists teams | | |
| 49 | Creating a team works and it appears immediately in User Access's team selector | | |
| 50 | Activate/Deactivate a team works and is reflected everywhere the team is referenced | | |
| 51 | Assigning a user to a team, then viewing that user in User Access, shows the assignment | | |

## Maker/Checker

*Requires two accounts: one Maker, one Checker (or one account holding both roles, to test the self-approval block specifically).*

| # | Test | Result | Notes |
|---|------|--------|-------|
| 52 | A Maker can create and submit a request | | |
| 53 | The same user, if also a Checker, cannot approve/reject/send back their own submission (see Approvals #21) | | |
| 54 | A different, genuinely separate Checker CAN approve/reject/send back that request | | |
| 55 | A Maker without Checker permission never sees an Approve/Reject/Send Back control at all | | |

## Workflow Builder

*Requires an account holding `workflow_definition.read`/`write`/`publish`. This is the highest-priority visual check: the canvas editor could not be exercised visually in the prior build session.*

| # | Test | Result | Notes |
|---|------|--------|-------|
| 56 | `/settings/workflows` lists workflow definitions with correct Version/Status/Last Updated/Updated By columns | | |
| 57 | Creating a new workflow definition works | | |
| 58 | Opening a definition shows its version history | | |
| 59 | "New Draft Version" is only offered when no draft currently exists | | |
| 60 | The canvas actually renders (background grid, controls, minimap visible) | | |
| 61 | Adding a node from the palette places it on the canvas | | |
| 62 | Dragging a node moves it, and the position persists after Save Draft + reload | | |
| 63 | Connecting two nodes by dragging creates a visible edge | | |
| 64 | Selecting a node opens its configuration panel (name, responsible team, required permission, required fields) | | |
| 65 | Selecting an edge opens its label editor | | |
| 66 | Zoom and pan work smoothly, no visual glitches | | |
| 67 | Save Draft persists the graph; reloading the page shows the same graph | | |
| 68 | Validate & Publish on an invalid graph (missing Start or End) shows a clear, specific error, not a generic failure | | |
| 69 | Validate & Publish on a valid graph succeeds and the version becomes read-only/immutable | | |
| 70 | A published version's canvas shows no edit controls (no palette, no config panel, nodes not draggable) | | |
| 71 | "Discard Draft" removes an unwanted draft and allows starting a new one | | |
| 72 | No overlapping UI elements, no unusable internal scroll region, no blank canvas from a CSS sizing bug | | |
| 73 | No hydration errors or console errors while using the canvas | | |

## Settings

| # | Test | Result | Notes |
|---|------|--------|-------|
| 74 | Reference Master settings load and edits save correctly | | |
| 75 | Settings sub-nav correctly reflects the signed-in user's actual permissions (no tab for something they can't read) | | |

## Audit / Actor Identity

| # | Test | Result | Notes |
|---|------|--------|-------|
| 76 | Every "Approved by" / "Sent back by" / "Cancelled by" label shows a human name, never a raw UUID | | |
| 77 | Every governed action's timestamp is visible alongside the actor name | | |
| 78 | Changing a user's display name in User Access updates how they appear in NEW events; past events remain a separate question covered by the actor snapshot (see `docs/AUTHORIZATION_MODEL.md` §21) | | |

## Error Handling

| # | Test | Result | Notes |
|---|------|--------|-------|
| 79 | Attempting an action without the required permission shows a clear, human message, not a raw error code | | |
| 80 | A self-approval attempt shows "You cannot approve your own request..." verbatim, not a stack trace or SQL error | | |
| 81 | A network/server error during a save shows a retry-friendly message, not a silent failure | | |

## Security

| # | Test | Result | Notes |
|---|------|--------|-------|
| 82 | Signed out, directly visiting an API route or a protected page redirects to login rather than exposing data | | |
| 83 | A user without `customer.approve` never sees an Approve/Reject/Send Back button, even if they know the URL | | |
| 84 | Self-approval is blocked at the server, confirmed by attempting it as the request's own creator | | |

## Mobile / Responsive

| # | Test | Result | Notes |
|---|------|--------|-------|
| 85 | Core pages (Onboarding, Customer Master, Approvals) remain usable at a narrow (mobile) viewport width | | |
| 86 | The Workflow Builder canvas is explicitly out of scope for mobile; confirm it at least does not crash the page on a small screen | | |

## Resilience

| # | Test | Result | Notes |
|---|------|--------|-------|
| 87 | Reloading mid-draft does not lose already-saved progress | | |
| 88 | Double-clicking a submit/approve button does not create a duplicate submission/decision | | |
| 89 | Navigating away and back to a list page shows up-to-date data, not a stale cached view | | |

## Go Live

| # | Test | Result | Notes |
|---|------|--------|-------|
| 90 | A recurring line item with no Go Live request shows "Pending" status and a "Create Go Live" action | | |
| 91 | An On-Demand line item shows "Go Live: Not Required" in its own section, never a misleading "No Go Live" | | |
| 92 | Creating a Go Live request locks the Commercial context (component, pricing model, MUG, version) and only allows editing Go Live Date and Prorate First Month | | |
| 93 | Prorate First Month defaults to No/unchecked | | |
| 94 | Saving a Go Live draft, then reloading the page, shows the saved date and prorate value | | |
| 95 | Submitting a Go Live request before customer confirmation is marked Confirmed succeeds (submission is not gated on confirmation) | | |
| 96 | Approving a Go Live request while customer confirmation is still Pending is blocked with an honest message | | |
| 97 | Uploading a Customer Confirmation Email or a Signed UAT Document, then marking confirmation Confirmed, unblocks Approve | | |
| 98 | Approving a request the current user submitted themselves is blocked (self-approval) | | |
| 99 | Send Back requires a reason and moves the request to Sent Back, then Resubmitted after the maker resubmits | | |
| 100 | Cancelling a draft Go Live request is only available to its own creator, and only while still in draft | | |
| 101 | An approved Go Live request shows in My Work / Approvals for anyone with `go_live.approve`, and in My Requests style "drafts to continue" for its own creator while still draft | | |

## Entitlement Ledger: allocation anchoring

| # | Test | Result | Notes |
|---|------|--------|-------|
| 102 | Recording an Invoice Entitlement (source) for a recurring line item succeeds even before that line item has an approved Go Live request | | |
| 103 | Generating a schedule for that same source is blocked with an honest message until the line item's Go Live request is approved | | |
| 104 | Once Go Live is approved, previewing a new schedule anchors the first month at the Go Live month, never the invoice date | | |
| 105 | An uneven division (for example 1,000 over 3 months) places the rounding remainder in the final month, never dropping a unit | | |
| 106 | Previewing an "Add To Existing Entitlement Period" schedule anchors at one month after the latest month the existing schedule already covers | | |
| 107 | Previewing a schedule that overlaps existing months shows an explicit overlap warning and still requires a conscious confirm click | | |

## Entitlement Ledger: MUG consumption

| # | Test | Result | Notes |
|---|------|--------|-------|
| 108 | Usage above entitlement (with a MUG below entitlement) caps consumption at entitlement and puts the excess in Unbilled | | |
| 109 | Usage below entitlement with MUG equal to entitlement results in zero Unbilled and zero Unearned | | |
| 110 | Usage below entitlement with no MUG results in the shortfall landing entirely in Unearned | | |
| 111 | Actual usage shown on the ledger always matches what was submitted, never silently overwritten by the consumption calculation | | |
| 112 | A Slab/Progressive/Designation-based pricing model's ledger row shows actual usage but leaves consumption/Unbilled/Unearned at zero with a "Pending MRR Recognition" label | | |
| 113 | An October Unbilled entry and a November Unearned entry for the same component both remain visible and open; neither is netted against the other | | |

## Entitlement Ledger: usage, additional invoices, settlement

| # | Test | Result | Notes |
|---|------|--------|-------|
| 114 | Submitting Monthly Usage for a recurring line item before its Go Live month is blocked with an honest message | | |
| 115 | Submitting Monthly Usage for an On-Demand line item succeeds with no Go Live check at all | | |
| 116 | An On-Demand line item with usage submitted, but no entitlement source ever created, shows that full usage quantity as Unbilled | | |
| 117 | Finalizing a draft Monthly Usage row is only available to a user with `usage.finalize`, a distinct permission from submitting it | | |
| 118 | A finalized Monthly Usage row can no longer be edited; a correction requires a new submission that supersedes it as current | | |
| 119 | Recording a second Invoice Entitlement for the same component (an additional invoice) and choosing "Add To Existing" extends the schedule without duplicating already-allocated months | | |
| 120 | Recording a settlement against an open Unbilled entry with a quantity less than the total moves it to Partially Settled, not Settled | | |
| 121 | Recording a settlement that brings the cumulative settled quantity to the entry's full total moves it to Settled | | |

## Full Product Readiness: discoverability and bootstrap

| # | Test | Result | Notes |
|---|------|--------|-------|
| 122 | With go_live_admin/finance_admin/workflow_admin/user_access_admin/team_admin granted, the sidebar's single "Settings" link, once inside, shows cross-navigation tabs to Reference Master, Team Master, Workflows, and User Access all at once | | |
| 123 | Customer Detail shows a "Go Live" tab (not only a header button) with a summary of recurring/on-demand line item counts and Live/Pending/Not Started counts | | |
| 124 | Clicking "Open Go Live and Entitlement" from the new Go Live tab lands on the same `/customers/[key]/go-live` page the header button reaches | | |
| 125 | A session with none of the five newly-granted roles still sees the Go Live button/tab and the Settings sidebar link (if it holds `reference_master.read`), but is denied with an honest message on the pages themselves, never a silent blank screen | | |

## Workflow Builder

| # | Test | Result | Notes |
|---|------|--------|-------|
| 126 | `/settings/workflows` lists existing workflow definitions with Name/Applies To/Version/Status/Last Updated/Updated By | | |
| 127 | Creating a new Workflow Definition opens the canvas editor with an empty graph | | |
| 128 | Adding nodes (Approval, and any other node types available) and connecting them with edges persists on Save | | |
| 129 | The canvas shows a minimap, background grid, and zoom/pan controls; nodes remain readable at default zoom | | |
| 130 | Discarding a draft version removes it without affecting any previously published version | | |
| 131 | Publishing a version runs validation (for example, rejects an incomplete or disconnected graph if that is a real rule) before marking it published | | |
| 132 | A published version becomes immutable: editing it again creates a new draft version rather than mutating the published one | | |
| 133 | Go Live's own workflow_version_id is snapshotted at request creation: publishing a newer Workflow version after a Go Live request already exists does not change that request's own bound graph | | |
| 134 | The Operational Queue's "Responsible Team" column (if populated) reflects the bound graph's Approval node, and is clearly documented/understood as informational, never the actual permission gate | | |

## Team Master and User Access (now reachable end-to-end)

| # | Test | Result | Notes |
|---|------|--------|-------|
| 135 | `/settings/teams` lists teams with Code/Name/Description/Status/Last Updated, and Add Team works for a user with `team.write` | | |
| 136 | Deactivating a team is one-way-reversible (can be reactivated), and an inactive team no longer appears in the "assign a team" dropdown on User Access | | |
| 137 | `/settings/user-access` lists every provisioned user with status, team(s), and roles | | |
| 138 | Granting a role to a user takes effect on their next request (no stale session caching observed) | | |
| 139 | Revoking a role removes access on the next request | | |
| 140 | Self-approval remains blocked even for a user holding every admin role: they cannot approve a Go Live/Customer/Commercial Version request they created themselves | | |

## Honesty checks (things that look real but are not)

| # | Test | Result | Notes |
|---|------|--------|-------|
| 141 | Customer Detail's "Documents" tab is clearly labeled as demo/fixture data (badge), never presented as the real Onboarding/Go Live evidence, which lives only on each request's own review/detail screen | | |
| 142 | `/commercials` (no customer context) shows its own "Legacy design-reference screen, not live data" banner and is not reachable from any navigation | | |

## Workflow Runtime V1: Sequential Execution, Timeline, and stale-approval UX

*Requires a workflow with at least 3 Approval nodes (Start -> Finance -> Legal -> Leadership -> End) and at least two checker accounts on different teams. Covers `docs/WORKFLOW_ENGINE_ARCHITECTURE.md` §3b and §10, and `docs/CUSTOMER_LIFECYCLE.md` §19a.*

| # | Test | Result | Notes |
|---|------|--------|-------|
| 143 | Submitting a request against a 3-Approval-node workflow assigns it to the first node's team only; a different team's checker does not see it as actionable | | |
| 144 | Approving as the first node's team advances the request to the second node; the first team's task disappears and the second team's appears (My Work) | | |
| 145 | Sending back from a later node (not the first) returns the request to the Maker; prior approvals from earlier nodes remain visible in the Timeline | | |
| 146 | After editing and resubmitting a sent-back request, approval restarts at the FIRST Approval node, never resuming from where it was sent back | | |
| 147 | Rejecting at any node (first, middle, or last) is terminal: no proposed change is ever applied, and every prior approval on that request remains visible | | |
| 148 | The request Timeline shows real node names ("Finance Approval", "Legal Approval") and real actor names for every approve/send-back/reject event, never a raw node key, team UUID, or user id | | |
| 149 | A request sent back and resubmitted at least once shows its Timeline grouped under "Approval cycle 1" / "Approval cycle 2" markers; a request approved in one cycle shows no cycle markers at all | | |
| 150 | The final approval line names the actual last node ("Leadership Approval approved"), never a second, generic "Approved" entry alongside it | | |
| 151 | If a request is approved elsewhere while a checker has its review page open, clicking Approve on that now-stale page shows a plain, friendly message ("This approval has already moved to the next step...") — never a raw `WORKFLOW_NODE_ALREADY_ADVANCED` or SQL error | | |
| 152 | Clicking Refresh after that stale message shows the current, correct state (including the updated Timeline) and clears the stale message itself, not just the underlying data | | |
| 153 | Settings > Workflows shows an Active/Inactive column; activating a second workflow for a context that already has an active one is blocked with a message naming the currently active workflow, never silently swapped | | |
| 154 | The governed replacement action (Activate on an inactive workflow) atomically deactivates whichever other workflow held that context's active slot and activates the new one in one step | | |
