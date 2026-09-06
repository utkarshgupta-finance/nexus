# Nexus: Form Capability Register

This is a capability discovery register, not a build backlog. It exists to
capture form-related requirements as we discover them, so the architecture
stays aware of them, without automatically forcing every requirement into
SurveyJS just because SurveyJS is the form-runtime foundation
(`docs/PLATFORM_ARCHITECTURE.md` §13). Nothing in this document authorizes
building the capabilities it lists; each row is a note for future design,
not a commitment.

No real Nexus product rule, threshold, role name, or field list is
represented here. Every example is generic and fictional.

## Architecture boundaries

These responsibilities stay distinct in code, comments, and docs. SurveyJS
is deliberately not allowed to become the owner of all of them.

| Layer | Owns |
|---|---|
| SurveyJS | What fields/sections/pages are shown and how the user completes the form. |
| Nexus form wrapper | How SurveyJS fits into Nexus UX and application conventions: presentation modes, role-aware field state, section-level editability, response inspection. |
| Decision Engine (later) | Which reusable business conditions evaluate to true. |
| Approval Matrix (later) | What approval authorities are required. |
| Flowable (later) | How the business process moves. |
| Task Engine (later) | Who specifically has work right now. |
| Notification Engine (later) | Who needs awareness/reminders. |
| Authorization/RBAC | Who is allowed to see or change what, independent of form or workflow state. |
| Evidence/Attachments | Storage, validation, and access control for uploaded files. |
| Integration/API | Sourcing values/options from systems outside the form itself. |
| Commercial Master (later) | Canonical source of module/product commercial definitions. |
| Nexus Form Data Source Resolver (later) | Controlled bridge between a form field and canonical/reference data; forms never query Commercial Master or any database table directly. |
| Entitlement Engine/Ledger (later) | Effective customer/module rights over time. Separate from Commercial Master (which defines what a module *is*) and from this register (which is about how a form *selects* one). |

## Capability table

| Capability | Generic example | Likely owner | SurveyJS support | Nexus work needed | Status / notes |
|---|---|---|---|---|---|
| Multi-page forms | A long form split into steps | SurveyJS native | Yes (`pages`) | None | Proven, Stage 5B1A |
| Sections/panels | Grouping related fields within a page | SurveyJS native | Yes (`panel`) | None | Proven, Stage 5B1A |
| Conditional fields | A field appears based on another answer | SurveyJS native | Yes (`visibleIf`) | None | Proven, Stage 5B1A |
| Conditional sections | A panel appears based on one or more answers | SurveyJS native | Yes (`visibleIf` on `panel`) | None | Proven, Stage 5B1A |
| Conditional pages | A whole page appears based on an answer | SurveyJS native | Yes (`visibleIf` on page) | None | Proven, Stage 5B1A |
| Branching form journey | Request type changes which pages the user sees at all | SurveyJS native | Yes (combination of page `visibleIf`) | None for the journey itself | Proven, Stage 5B1A |
| Conditional requiredness | A field becomes required based on another answer | SurveyJS native | Yes (`requiredIf`) | None | Proven, Stage 5B1A |
| Conditional enable/read-only | A field becomes editable or locked based on another answer | SurveyJS native | Yes (`enableIf`) | None | Proven, Stage 5B1A |
| Calculated values | A derived field computed from other answers | SurveyJS native | Yes (`expression`) | See item I below: not authoritative merely because the browser computed it | Proven, Stage 5B1A, with caveat |
| Cross-field validation | End date cannot be before start date | SurveyJS native | Yes (expression validators) | None | Proven, Stage 5B1A |
| Repeatable sections | An unbounded list of line items | SurveyJS native | Yes (`paneldynamic`) | Canonical storage shape is a Stage 5B1C decision, not decided here | Proven this stage (presentation only) |
| Long-form progress/navigation | Clear steps, current step, remaining steps | SurveyJS native | Yes (`progressBarType: pages`, `navigationTitle`) | None | Proven, Stage 5B1A |
| Whole-form read-only | Reviewing a submitted form without editable controls | SurveyJS native | Yes (`survey.mode`) | Deciding *when* read-only applies is Nexus form wrapper + Authorization/RBAC, not SurveyJS | Proven, Stage 5B1A |
| Process journey | Where a request is in the business process | Nexus form wrapper | No native concept | Nexus builds the component; data eventually sourced from Flowable | Proven this stage, static demo data only |
| Current / Next / Waiting With / Your Action | Compact request status strip | Nexus form wrapper | No native concept | Nexus builds the component; data eventually sourced from Flowable + Task Engine | Proven this stage, static demo data only |
| Field-level role behavior | Finance sees a field read-only, CS can edit it | Authorization/RBAC, Nexus form wrapper | `enableIf`/`readOnly` can express the result once role is known | Role-to-field-state mapping that feeds SurveyJS at render time | Needs investigation |
| Pre-populated fields | Form opens with some answers already filled | Nexus form wrapper, Integration/API | Yes, `Model` accepts initial `data` | Sourcing and mapping the initial data | Mechanism proven; source needs investigation |
| Dependent dropdowns | Selecting a region filters which entities are selectable | SurveyJS native | Yes, basic chaining supported (`choicesVisibleIf`, cascading choices) | Needed if options come from Nexus master data rather than static JSON | Needs investigation |
| API-sourced values/options | Dropdown options loaded from an external system | SurveyJS native, Integration/API | Yes, `choicesByUrl`/dynamic choices exist | Nexus must own the endpoint, auth, and caching | Needs investigation |
| Attachments | Uploading supporting files | Evidence/Attachments | `file` question type exists for the upload UI | Storage, scanning, and access control | Needs investigation |
| Comments against a field | A reviewer leaves a note on one specific answer | Nexus form wrapper | No native per-field comment thread | Nexus would build this alongside the field | Needs investigation |
| Multiple people completing different sections | Section A by requester, Section B by Finance | Nexus form wrapper, Task Engine, Authorization/RBAC | No native multi-editor session concept | Section ownership, assignment, and merge logic | Needs investigation, see item A |
| Send back only one section | Only the flagged section becomes editable again | Approval Matrix, Flowable, Nexus form wrapper | Mode/read-only is whole-form or per-question, not natively "reopen on demand" | Per-section editability computed from workflow state at render time | Needs investigation, see item C |
| Lock approved sections | A section that already passed review becomes permanently read-only | Approval Matrix, Flowable, Nexus form wrapper | Same as above | Same as above | Needs investigation |
| Show what changed since previous submission | Approver sees a diff between versions | Nexus form wrapper | No native diffing | Store and diff prior response JSON versions | Needs investigation, see item D |
| Carry data forward from an earlier approved request | New request pre-fills from a prior record | Integration/API, Nexus form wrapper | Same mechanism as pre-populated fields | Sourcing from a prior Nexus record instead of static master data | Needs investigation, see item H |
| Reference/master-data-driven options | Choices come from Nexus reference data, not hardcoded JSON (e.g. modules from Commercial Master) | Integration/API, Nexus form wrapper | Choices can be set programmatically from any source | Nexus Form Data Source Resolver bridging a logical data source (e.g. `commercial_master.modules`) to Commercial Master | Needs investigation, see "Master-data-backed form fields" below |
| Draft autosave | In-progress answers are saved automatically | Nexus form wrapper, Integration/API | No native backend autosave | Persisting partial responses and a save cadence | Needs investigation |
| Restore draft | Reopening a form resumes a saved draft | Nexus form wrapper, Integration/API | Same mechanism as pre-populated fields | Loading and validating a saved partial response | Needs investigation |
| File/evidence requirements | Certain requests must include a document | Evidence/Attachments | `file` question type exists | Storage, validation, and enforcement | Needs investigation |
| Conditional evidence requirements | A document becomes required based on another answer | Evidence/Attachments, SurveyJS native | Same mechanism as conditional requiredness | Applies to file questions once file upload is built | Needs investigation |

## Explicitly recorded future needs (A-J)

These came directly out of the Form Lab discussion. None are solved here;
each is recorded so the architecture stays aware of it.

| Item | Need | Likely owner(s) | Note |
|---|---|---|---|
| A | One person fills Section A, another fills Section B of the same request | Nexus form wrapper, Task Engine, Authorization/RBAC | SurveyJS has no multi-editor session concept; needs section-level task assignment and a merge/consistency strategy. |
| B | Finance sees a field read-only while CS can edit the same field | Authorization/RBAC, Nexus form wrapper | Same field, different state per viewer role. SurveyJS's `enableIf`/`readOnly` can express the *result*, but SurveyJS itself is role-blind; the Nexus form wrapper must inject role-aware state at render time. |
| C | A submitted form is sent back and only selected sections become editable | Approval Matrix, Flowable, Nexus form wrapper | Whole-form `mode` is not enough. Per-section editability must be computed from current workflow state every time the form renders. |
| D | An approver can see exactly what changed between submission versions | Nexus form wrapper | Requires storing and diffing prior response JSON versions. No SurveyJS built-in; this is Nexus-side history, not the same thing as Activity History (Stage 5B1A explicitly defers Activity History itself). |
| E | Some fields are populated from Nexus master data rather than typed manually | Integration/API, Nexus form wrapper | SurveyJS accepts any initial `data`; sourcing and mapping it from Nexus reference data is Nexus's job, not SurveyJS's. |
| F | Some dropdown options come from external APIs | Integration/API | SurveyJS supports `choicesByUrl`/dynamic choices as a mechanism; Nexus must own the endpoint, authentication, and caching. |
| G | Attachments/evidence can be required because of another answer | Evidence/Attachments | The conditional mechanism (`requiredIf`-equivalent) is the same one already proven for ordinary fields; the file storage/validation layer underneath it is separate, unbuilt work. |
| H | A request can pre-populate information from an existing customer/agreement/resource | Integration/API, Nexus form wrapper | Same mechanism as pre-population (item E), but the source is a specific prior Nexus record rather than general master data. |
| I | A calculated value is visible but cannot become authoritative merely because the browser calculated it | Decision Engine, Nexus form wrapper | SurveyJS `expression` fields run client-side and are re-derivable (and forgeable) by anyone with the page open. Any Finance-material calculation must be re-verified or re-computed server-side before being treated as fact. |
| J | A form branch may influence a future workflow route, but SurveyJS must not own the workflow decision | Flowable, Decision Engine | A field like request type is a data point that Flowable or a Decision Engine reads. SurveyJS's page-level branching (this stage) is presentation only: it changes what the user sees, not what the business process does. |

## Master-data-backed form fields

Many future Nexus forms must obtain selectable values from canonical Nexus
master data rather than hardcoded choices. The primary example is
**modules**: future forms including commercial requests, revenue addition
requests, module addition requests, approvals involving modules,
entitlement-related requests, and other customer/module changes must be
able to obtain modules from the Nexus Commercial Master. A user should not
manually type a module name when a canonical module already exists.

Conceptually:

```
SurveyJS field
  -> Nexus Form Data Source Resolver
    -> Nexus application/domain service
      -> Commercial Master
```

SurveyJS may render, search, and select the options; it must not own
Commercial Master data or connect directly to a Nexus database table. A
form definition should reference a **logical data source name**, for
example `commercial_master.modules`, rather than being coupled to a
physical query or a specific endpoint. The resolver is what maps a logical
data source name to an actual lookup; the form definition never encodes
that mapping itself. None of this resolver, Commercial Master, or Supabase
access is implemented in this stage.

### Context-aware master-data filtering (future)

The future data-source mechanism must eventually support contextual
queries, not just a flat list. None of these filtering rules are
implemented; the table only classifies likely ownership.

| Contextual filter | Generic example | Likely owner |
|---|---|---|
| Active modules only | Exclude retired modules | Nexus form wrapper, Integration/API |
| Modules applicable to a legal entity | Region- or entity-specific module availability | Decision Engine |
| Modules applicable to a customer | Customer-specific eligibility | Decision Engine |
| Modules already commercially configured | Only show modules the customer already has commercially | Integration/API |
| Modules not yet entitled | Only show modules eligible to be newly granted | Entitlement Engine/Ledger (later), Decision Engine |
| Modules valid at a relevant effective date | Point-in-time correctness | Decision Engine, Integration/API |
| Who may see or select a given module at all | Visibility independent of the above | Authorization/RBAC |

### Stable identifier principle

For canonical values such as modules, a form should conceptually work with
a stable canonical identifier as the stored `value`, and a human-readable
label as the `display` text shown to the user. For example, illustratively
only: `value: MOD-003`, `display: "Retailer App"`. This is a principle, not
a schema decision; the exact identifier format is not decided here.

A master-data rename or retirement must not silently change what an old
approver saw or approved. Stage 5B1B/5B1C must determine how a historical
submission preserves enough information to prevent that, carrying forward
at least these concerns:

- the stable master-data ID the submission actually referenced
- the historically displayed label, where material to what was approved
- the effective/version context the value was valid under, where required

None of this persistence is designed or built here.

## Open design decisions carried forward

### Hidden-branch data retention

Stage 5B1A testing established a concrete SurveyJS behavior that Nexus has
not yet decided a policy for:

> When a SurveyJS page becomes hidden because the branch changes, values
> previously entered on that hidden page remain in `survey.data` by
> default.

Example: a user selects "Exception", completes the Exception page, then
changes the request type to "Standard". The Exception page disappears
from the visible journey, but the values already entered on it are still
present in the SurveyJS response state.

Nexus must deliberately decide, in Stage 5B1B or 5B1C, whether
hidden/inapplicable answers should be:

- retained as historical draft state,
- cleared,
- excluded from the submission payload, or
- retained but explicitly marked inactive/not applicable.

No policy is chosen in this task. The requirement that is already certain:
**invisible data must never silently influence a Finance decision merely
because SurveyJS happened to retain an old value.** Whatever Decision
Engine or server-side validation runs later must evaluate only the facts
Nexus considers applicable to the current submission, not everything that
happens to still be sitting in the form's client-side state.

## What this document is not

Not a schema. Not a sprint plan. Not an approval to build any "Needs
investigation" row. Not a claim that SurveyJS covers everything marked
native; native means SurveyJS has a mechanism for it, not that Nexus has
decided to use it for a real feature yet.
