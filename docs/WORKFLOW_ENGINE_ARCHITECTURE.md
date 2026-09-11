# Nexus: Workflow Engine Architecture

**Status: DESIGN DRAFT, NOT LOCKED.** This document records the intended
shape of Nexus's generic workflow domain contracts and a first pure rule
evaluator. Only the pieces explicitly marked IMPLEMENTED exist in the
codebase today. Everything else, including any running engine, is design
only. This document contains no real business rule, no real role name,
and no confidential process detail; every example is illustrative.

## 1. Purpose

Multiple Nexus processes need the same underlying question answered:
given a change (a new submission, a proposed edit, an exception request),
what evidence and approvals does it require, and from whom? Nexus solves
this once, generically, rather than once per feature. This is the same
`workflow` capability `docs/PLATFORM_ARCHITECTURE.md` §4 and §6 already
name; this document is that capability's own detailed design, and does
not restate or replace anything already locked there.

Intended reuse: Customer Onboarding, Customer Master Change Requests
(`docs/DATA_ARCHITECTURE.md` §15), Commercial Change, Contract Exception,
Credit Note Approval, Vendor Onboarding, and future Finance/Legal/Ops
processes not yet named.

## 2. Library-first and open-source-first

Before this stage wrote a single line of workflow code, it asked whether
a library already solves this well. Two are recorded as accepted future
technology, neither installed yet:

- **React Flow** (MIT): a future visual canvas for authoring or
  displaying workflow rules as a graph. Not needed for §5's Rule Builder
  view, and not installed in this stage.
- **XState** (MIT): generic state-transition mechanics, if a future
  running engine benefits from them. Not installed in this stage, since
  this stage builds no running engine, only pure evaluation.

Neither library is adopted here because neither is needed yet: this
stage implements pure domain contracts and a pure evaluator, no runtime
state machine, no persistence, no UI builder. `docs/ARCHITECTURE.md` §9
records the general Library-first pattern this follows.

**Relationship to the already-accepted Flowable boundary.**
`docs/PLATFORM_ARCHITECTURE.md` §13 already accepts **Flowable** as the
future engine for human/business-process orchestration: routing,
send-back, reject, resubmit, reassignment, escalation, multi-level
approvals, and decision tables. That acceptance is not superseded by
anything here. What this document adds is smaller and sits beside it: a
Nexus-owned, pure way to express *what a change requires* (which
evidence, which approvals, from which role and scope), independent of
whatever eventually executes a running process. Whether that smaller
layer is later expressed as Flowable decision tables, stays a
lightweight Nexus-only layer for simpler cases, or some combination of
both, is an open question this document does not resolve. Recording the
question honestly here is preferred over silently picking a direction
that could contradict the already-locked Flowable boundary.

## 3. What exists today (IMPLEMENTED)

`src/platform/workflow/domain/types.ts` and
`src/platform/workflow/domain/evaluator.ts`:

- Pure TypeScript types: `WorkflowDefinition`, `WorkflowVersionDefinition`,
  `WorkflowRule`, `WorkflowCondition`, `WorkflowRequirement`
  (`ApprovalRequirement` | `EvidenceRequirement`), `RoleReference`,
  `ScopeReference`, and a documented (not constructed anywhere)
  `WorkflowInstance` shape.
- A pure evaluator, `evaluateWorkflowRules`, with the signature
  `(currentValues, proposedValues, rules, context?) -> { matchedRuleKeys, approvals, evidence }`.
- Three condition operators: `changed`, `equals`, `not_equals`.
- Aggregation and deduplication across every matched rule's
  requirements, preserving distinct scoped approvals.

No feature calls this yet. No database table, migration, running
instance, approval execution, notification, or UI exists for it. See
`src/platform/workflow/domain/evaluator.test.ts` for the executable proof
of every behaviour this document describes for the evaluator.

## 4. Field-level rules and stable field identity

A `WorkflowRule` attaches to a `WorkflowVersionDefinition`, which belongs
to one `WorkflowDefinition`; a rule's conditions reference field KEYS,
never visible labels, so relabeling a field never breaks a rule. The same
field key may participate in many rules, and many rules may belong to one
workflow: there is no one-workflow-per-field design.

**Field identity is scoped to whatever produced the data being
evaluated.** For a form-driven change, that is the SurveyJS question
`name` from one specific Form Version. `docs/FORM_VERSIONING_MODEL.md`
§18 already records, as a deliberate, locked decision, that Nexus has not
built a stable field identity that survives across Form Versions. This
document does not invent one either: a workflow rule's field keys are
only meaningful against the same version they were authored against,
exactly like a Form Version's own fields. A future Rule Builder (§5)
still lets a business user pick a field by its readable path (for
example "Customer Details > Business Unit"); the rule stores the
underlying stable key from that version, not the path.

## 5. Conditions: current vs. proposed, and applicability context

A rule's conditions read from two value sets: `currentValues` (the
existing/current truth) and `proposedValues` (what a change proposes).
`changed` compares the two; `equals`/`not_equals` compare one field's
resolved value against a literal. A rule for "an address changed"
combines with "country equals IN" so a GST-specific requirement never
becomes a hardcoded global rule: it fires only where GST genuinely
applies, driven by ordinary field data, not a special-cased country
check.

The full conceptual operator vocabulary considered for a future version:
`changed`, `equals`, `not_equals`, `changed_from`, `changed_to`,
`is_blank`, `is_not_blank`, `in`, `not_in`, `greater_than`, `less_than`.
Only the three implemented today are real; the rest are not promised.
Workflow conditions are never arbitrary code: only named, deterministic,
auditable operators exist, so every rule stays explainable from its own
definition.

## 6. Requirements and aggregation

A matched rule produces `WorkflowRequirement`s. Two kinds exist today:
`ApprovalRequirement` (a `RoleReference`, optionally scoped, plus a
reason) and `EvidenceRequirement` (an evidence type code plus a reason).
Two more are named as the likely next additions, not built here:
Comment/Reason and Transition/Completion Gate.

When more than one rule matches a single change (task example: a Legal
Entity Name change, a Segment change, and a Business Unit change, all in
one Customer Master Change Request), the evaluator aggregates every
matched rule's requirements into one set:

- **Evidence** deduplicates by evidence type: two rules both asking for a
  `gst_certificate` produce one requirement, with both rules' reasons
  preserved for audit.
- **Approvals** deduplicate by role *and* resolved scope together: a
  Finance Head approval merges with another Finance Head approval, but
  an old Business Unit Head and a new Business Unit Head, though both
  role `BU_HEAD`, never merge, because their resolved scope values
  differ.

## 7. Roles and scope resolution

A `RoleReference` names a role code (for example `FINANCE_HEAD`,
`LEGAL`, `BU_HEAD`), reusing whatever role vocabulary
`docs/AUTHORIZATION_MODEL.md` owns; this layer never redeclares roles.
`docs/AUTHORIZATION_MODEL.md` already distinguishes global roles from
scoped roles, which is exactly the split `RoleReference.scope` expresses.

A `ScopeReference` names where to read the scope's value from
(`current` or `proposed`) and which field: `BU_HEAD(scope =
old_business_unit)` reads the Business Unit from `currentValues`;
`BU_HEAD(scope = new_business_unit)` reads it from `proposedValues`.
Nothing here resolves *who* actually holds that role for that scope: a
future authorization-aware layer resolves the actual current holder(s)
at approval time and preserves the resolved approver's identity in
history, so a later leadership change never requires editing the
workflow rule itself (matching `docs/AUTHORIZATION_MODEL.md`'s own
principle that role names are never hardcoded into feature logic).

## 8. Template, Version, and Instance

- **WorkflowDefinition** (Template): the stable identity a workflow is
  known by (for example a conceptual `customer_master_change_request`),
  independent of any specific version's rule content.
- **WorkflowVersionDefinition**: an immutable, published set of rules for
  one template, mirroring `docs/FORM_VERSIONING_MODEL.md`'s Form Version
  philosophy exactly. A new version never rewrites an older version's
  already-running instances.
- **WorkflowInstance** (documented shape, IMPLEMENTED as a type only,
  never constructed): one running occurrence of a published version,
  attached to exactly one business resource, preserving template,
  version, current/proposed values, context, matched rules, resolved
  approvals and evidence, and outcome.

## 9. Send-back and reviewer edits (future, not implemented)

When an approval step supports Approve/Send Back, a send-back records
actor, timestamp, reason, and target status, and a correction after
send-back creates a new revision rather than mutating whatever was
originally submitted, mirroring
`src/features/customer-onboarding/domain/case.ts`'s existing
`sendBackCase`/`startNextRevision` pattern. Likewise, a reviewer edit
during workflow review creates a new revision/change event rather than
silently overwriting the record under review. Neither is implemented at
the workflow layer yet; both are named here so the first real
implementation does not invent a different shape.

## 10. Audit

A future workflow audit trail must answer: which workflow and version
ran, what triggered it, which rules matched, what requirements were
created, what evidence was supplied, who was resolved for each approval,
who approved or sent back, what changed, when, and the final outcome.
This reuses `docs/PLATFORM_ARCHITECTURE.md` §7's existing audit/domain
event distinction rather than inventing a second audit mechanism for
workflow specifically.

## 11. Forms integration

A workflow rule's `currentValues`/`proposedValues` are the same shape a
Form Submission (`docs/FORM_VERSIONING_MODEL.md`) or a future Customer
Master Change Request (`docs/DATA_ARCHITECTURE.md` §15) already produces:
a plain object keyed by stable field names. No adapter step exists yet
to feed one into the other; this document records that the shapes are
already compatible by design.

## 12. Rule Builder and future visual view (design only, not built)

Two future authoring views, neither built now:

- **Rule Builder** (primary): a structured, tabular "When / Condition /
  Then" form, not a graph: a field picker (showing a readable path like
  "Customer Details > Business Unit", backed by the stable key underneath,
  §4), an operator, a from/to value, and a "Require Approval" /
  "Require Evidence" sub-picker (role plus scope where applicable). No
  manual JSON authoring.
- **Visual Flow** (secondary, future): a React Flow canvas for the subset
  of workflows that genuinely benefit from seeing branching visually.
  Never the forced default for every rule.

**Form Field Discovery.** A future Rule Builder discovers available
fields from actual versioned Form Definitions, so a business user always
picks from what a form genuinely collects, never a manually typed key
that could drift from reality.

## 13. Explicitly not built in this stage

No workflow database schema or migration, no background worker or job,
no live approval execution, no notification, no React Flow builder, no
XState runtime, no authorization-aware role resolution. This stage proves
the domain contracts and a pure evaluator first; everything above is a
future stage's work.
