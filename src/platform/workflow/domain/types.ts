/**
 * Nexus Workflow: pure domain contracts.
 *
 * This module models what a workflow rule IS, not how one runs. It is
 * feature-agnostic (per `src/platform/README.md`: platform code never
 * imports from `features/`, and never encodes what any specific business
 * process means), reusable for Customer Onboarding, Customer Master
 * Change, Commercial Change, Contract Exception, Credit Note Approval,
 * Vendor Onboarding, and future Finance/Legal/Ops workflows alike.
 *
 * Status: DESIGN, PARTIALLY IMPLEMENTED. Only the pure evaluator in
 * ./evaluator.ts consumes these types today. There is no database table,
 * no running instance, no persistence, and no execution engine. See
 * `docs/WORKFLOW_ENGINE_ARCHITECTURE.md` for the full architecture,
 * including how this relates to `docs/PLATFORM_ARCHITECTURE.md` §13's
 * already-accepted Flowable boundary for human/business-process
 * orchestration.
 *
 * Field identity: `WorkflowCondition.field` is a stable field KEY scoped
 * to whatever produced `currentValues`/`proposedValues` (for a form-driven
 * change, the SurveyJS question `name` from a specific Form Version; see
 * `docs/FORM_VERSIONING_MODEL.md` §18). Nexus has deliberately not built a
 * stable cross-Form-Version field identity scheme yet, and this module
 * does not invent one: a rule's field keys are only meaningful against
 * the same version they were authored against, exactly like a Form
 * Version's own fields.
 */

// =============================================================================
// Role and scope references: WHO can satisfy an approval, never WHO DID
// =============================================================================

/**
 * A scope is a value resolved at evaluation time from the same
 * current/proposed data a rule condition reads, never a hardcoded
 * identifier. `source` picks which side of the change the value comes
 * from (task spec: "BU_HEAD(scope = old_business_unit)" reads from
 * `currentValues`, "BU_HEAD(scope = new_business_unit)" reads from
 * `proposedValues`), so two scope references naming the same role can
 * still resolve to two different, legitimately distinct approvers.
 */
type ScopeReference = {
  source: "current" | "proposed"
  field: string
}

/**
 * A role reference names WHICH role must approve, optionally scoped
 * (`docs/AUTHORIZATION_MODEL.md` already distinguishes global vs scoped
 * assignment). Nexus resolves the actual current holder(s) of this role
 * (optionally within this scope) at approval time; nothing here stores or
 * assumes a specific person. `role` is a role CODE (for example
 * "FINANCE_HEAD", "LEGAL", "BU_HEAD"), reusing whatever role vocabulary
 * `docs/AUTHORIZATION_MODEL.md` already owns, never redeclared here.
 */
type RoleReference = {
  role: string
  scope?: ScopeReference
}

// =============================================================================
// Conditions: what changed, compared against what
// =============================================================================

/**
 * The full conceptual operator vocabulary (task spec §45) is: changed,
 * equals, not_equals, changed_from, changed_to, is_blank, is_not_blank,
 * in, not_in, greater_than, less_than. Only the three needed to express
 * every rule this stage actually models are implemented; the rest are
 * recorded here as a comment, not silently promised as working. Workflow
 * conditions are never arbitrary code: only these named, deterministic,
 * auditable operators exist, by design (task spec §45).
 */
type WorkflowConditionOperator = "changed" | "equals" | "not_equals"

/**
 * `field` is resolved against `proposedValues` first, falling back to
 * `context` (see ./evaluator.ts): this lets the same condition shape
 * express both "this changed field's new value equals X" and "this
 * always-true contextual fact (for example, country) equals X", without
 * two different condition shapes. `changed` never reads `value`; it
 * compares `currentValues[field]` against `proposedValues[field]`.
 */
type WorkflowCondition = {
  field: string
  operator: WorkflowConditionOperator
  value?: unknown
}

// =============================================================================
// Requirements: what a matched rule demands
// =============================================================================

/**
 * Requirement kinds start small (task spec §49): Approval and Evidence
 * today. Comment/Reason and Transition/Completion Gate are named in the
 * architecture doc as the next two, not implemented here, so this union
 * is not extended speculatively ahead of a real caller needing them.
 */
type ApprovalRequirement = {
  kind: "approval"
  role: RoleReference
  reason: string
}

type EvidenceRequirement = {
  kind: "evidence"
  /** A stable evidence type code, for example "gst_certificate", matching the vocabulary `OnboardingDocumentType` already uses at the feature level (never redeclared here; platform stays feature-agnostic). */
  evidenceType: string
  reason: string
}

type WorkflowRequirement = ApprovalRequirement | EvidenceRequirement

// =============================================================================
// Rule: a named, versionable unit of "when this, require that"
// =============================================================================

/**
 * All conditions must match for a rule to fire (a simple, deterministic
 * AND). A rule with no conditions never fires: an empty condition list is
 * not treated as "always true", which would make a rule impossible to
 * reason about from its own definition.
 */
type WorkflowRule = {
  key: string
  description: string
  conditions: WorkflowCondition[]
  requirements: WorkflowRequirement[]
}

// =============================================================================
// Template + Version: mirrors the Form versioning philosophy exactly
// =============================================================================

/**
 * The stable identity a workflow is known by (for example
 * "customer_master_change_request"), independent of any specific
 * version's rule content.
 */
type WorkflowDefinition = {
  key: string
  name: string
  description: string
}

/**
 * An immutable, published set of rules for one template, mirroring
 * `docs/FORM_VERSIONING_MODEL.md`'s Form Version exactly: a new version
 * never rewrites an older version's already-running instances (task spec
 * §47). `status` follows the same vocabulary a Form Version uses.
 */
type WorkflowVersionStatus = "draft" | "published" | "archived"

type WorkflowVersionDefinition = {
  templateKey: string
  version: number
  status: WorkflowVersionStatus
  rules: WorkflowRule[]
}

// =============================================================================
// Instance: documented future shape, nothing here constructs one
// =============================================================================

/**
 * One running occurrence of a published Workflow Version, attached to
 * exactly one business resource (task spec §48). Documented so a future
 * persistence stage builds toward this shape rather than inventing its
 * own, exactly like `PersistedOnboardingDocumentMetadata` documents a
 * future table without this stage implementing it. Nothing in this
 * module constructs a `WorkflowInstance`; there is no persistence layer,
 * no state transition, and no approval execution here (task spec §66).
 */
type WorkflowInstance = {
  instanceId: string
  templateKey: string
  version: number
  resourceId: string
  status: "open" | "completed" | "cancelled"
  currentValues: Record<string, unknown>
  proposedValues: Record<string, unknown>
  context: Record<string, unknown>
  matchedRuleKeys: string[]
  approvals: ApprovalRequirement[]
  evidence: EvidenceRequirement[]
  createdAt: string
}

export type {
  ScopeReference,
  RoleReference,
  WorkflowConditionOperator,
  WorkflowCondition,
  ApprovalRequirement,
  EvidenceRequirement,
  WorkflowRequirement,
  WorkflowRule,
  WorkflowDefinition,
  WorkflowVersionStatus,
  WorkflowVersionDefinition,
  WorkflowInstance,
}
