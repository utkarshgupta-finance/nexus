/**
 * Nexus-owned Customer Onboarding domain types.
 *
 * Customer Onboarding is a multi-stage CUSTOMER CREATION PROCESS. Stages
 * are named for the information they collect (Customer Details, Tax &
 * Registration, ...), never for a department or role: creation access is
 * broad ("any appropriately authenticated Nexus user"), while approval
 * authority is a separate, future, role-scoped concern. This stage
 * implements Customer Details and Tax & Registration; see ./process.ts
 * for the stage list.
 *
 * A Customer Onboarding Case is historical evidence of what was entered
 * and how it moved through review, not the current Customer Master
 * truth. Nothing here rewrites history: a Reference Master value used at
 * submission time may later be deactivated, and Customer Master itself
 * may later change, without altering what this case recorded (see
 * docs/DATA_ARCHITECTURE.md for the platform-wide version of this
 * principle).
 *
 * Revision shape mirrors the real `submission_revisions` migration
 * exactly (supabase/migrations/20260907044335_submission_data_foundation.sql):
 * `status` is only ever `draft` or `submitted` at the revision level.
 * "Sent back", "resubmitted", and "approved" are CASE-level workflow
 * states layered on top of a sequence of revisions, not revision
 * statuses themselves, matching how the real architecture separates
 * `submission_revisions` (one immutable snapshot at a time) from the
 * workflow/approval layer that decides what happens next. There is no
 * TypeScript service layer yet on top of that migration, and no
 * per-user authorization boundary to safely call its write RPCs from a
 * user-facing surface, so every actor id below is nullable: the
 * eventual server boundary supplies real authenticated identity, this
 * layer never fabricates one.
 */

type CustomerOnboardingStageKey =
  | "customer_details"
  | "tax_registration"
  | "commercial_documents"
  | "commercial_rate"
  | "agreement_approval"

/**
 * Plain string alias, not a branded/nominal type: matches the precedent
 * already set in src/features/commercial/domain/types.ts (no existing
 * bug class in this codebase has justified branded ids yet).
 */
type AppUserId = string

// =============================================================================
// Revision: one immutable snapshot, matching submission_revisions exactly
// =============================================================================

type CustomerOnboardingRevisionStatus = "draft" | "submitted"

/**
 * `data` is deliberately `Record<string, unknown>`: it is SurveyJS's own
 * `survey.data` shape for whichever form definition produced it. SurveyJS
 * owns configurable form definitions (`docs/PLATFORM_ARCHITECTURE.md`
 * §13); Nexus does not re-declare a parallel strongly-typed field
 * interface duplicating what the form definition already declares.
 */
type CustomerOnboardingRevision = {
  revisionNumber: number
  status: CustomerOnboardingRevisionStatus
  data: Record<string, unknown>
  createdBy: AppUserId | null
  createdAt: string
  updatedBy: AppUserId | null
  updatedAt: string
  submittedBy: AppUserId | null
  submittedAt: string | null
}

// =============================================================================
// Case: the onboarding request as a whole, across its revision history
// =============================================================================

type CustomerOnboardingCaseStatus = "draft" | "submitted" | "sent_back" | "resubmitted" | "approved"

type CustomerOnboardingSentBack = {
  reason: string
  sentBackBy: AppUserId | null
  sentBackAt: string
  targetStageKey: CustomerOnboardingStageKey | null
}

/**
 * `requestId` is the case's own stable identity (conceptually
 * "REQ-00124"), independent of any Customer Master record: an onboarding
 * case exists, and is visible in the Customers area's Onboarding Cases
 * list, well before any Customer Master row does. Only an approved case
 * ever feeds Customer Master creation (see ./case.ts's header), and the
 * approved record may retain a link back to `requestId`, never the
 * reverse.
 */
type CustomerOnboardingCase = {
  requestId: string
  status: CustomerOnboardingCaseStatus
  /** Which stage the submitter was last working in, for the Onboarding Cases list (task spec §6). */
  currentStageKey: CustomerOnboardingStageKey
  currentRevision: CustomerOnboardingRevision
  sentBack: CustomerOnboardingSentBack | null
  approvedBy: AppUserId | null
  approvedAt: string | null
}

// =============================================================================
// Tax documents: selected-local-file vs persisted-document stay distinct
// =============================================================================

/**
 * Every document type this feature collects, across all five stages:
 * India-specific tax evidence (GST/PAN/TAN), the two documents required
 * for any non-India country (evidence of the local tax/registration
 * identifier, and evidence of the legal entity/company registration
 * itself), Commercial Documents evidence, and the Agreement & Approval
 * stage's Signed Agreement. Neither non-India type is India-specific
 * naming, matching that field's own generic help text ("Upload a
 * document that confirms the registered legal entity/company name.")
 * rather than one specific document name per country. This union
 * started as tax-only (`TaxDocumentType`); it is now generic because
 * every stage's attachments share one selection/validation contract
 * (see ../domain/documents.ts).
 */
type OnboardingDocumentType =
  | "gst_certificate"
  | "pan_card"
  | "tan_card"
  | "tax_registration"
  | "company_registration"
  | "proposal_document"
  | "customer_po"
  | "pi_copy"
  | "signed_agreement"

/**
 * A file the user has picked in this browser session, already validated
 * (see ../domain/documents.ts), not yet persisted anywhere. The actual
 * `File` object is a UI-layer concern (kept in React state alongside
 * this metadata), not part of this domain type: nothing in ./case.ts or
 * ./documents.ts needs to read file bytes.
 */
type SelectedOnboardingDocument = {
  documentType: OnboardingDocumentType
  fileName: string
  mimeType: string
  sizeBytes: number
}

/**
 * The future persisted-document shape, documented so the next backend
 * stage builds toward it rather than inventing its own (task spec §15,
 * §28, §29): binary content lives in private Supabase Storage
 * (`customer-onboarding-documents` bucket, `{requestId}/{category}/
 * {documentType}/{documentId}.{extension}` path, opaque ids only, never a
 * customer name/GST/PAN/TAN/tax number in the path), PostgreSQL holds
 * only this metadata. `category` groups a document by which stage
 * produced it (for example "tax", "commercial", "agreement") since
 * Commercial Documents and Agreement & Approval now need the same
 * storage convention that started tax-only. Nothing in this stage
 * constructs a value of this type; there is no persistence layer yet
 * (see ./documents.ts's header for the current, local-only limitation).
 */
type PersistedOnboardingDocumentMetadata = {
  documentId: string
  requestId: string
  category: "tax" | "commercial" | "agreement"
  documentType: OnboardingDocumentType
  originalFileName: string
  mimeType: string
  sizeBytes: number
  storageBucket: string
  storagePath: string
  uploadedBy: AppUserId | null
  uploadedAt: string
  isCurrent: boolean
}

export type {
  CustomerOnboardingStageKey,
  AppUserId,
  CustomerOnboardingRevisionStatus,
  CustomerOnboardingRevision,
  CustomerOnboardingCaseStatus,
  CustomerOnboardingSentBack,
  CustomerOnboardingCase,
  OnboardingDocumentType,
  SelectedOnboardingDocument,
  PersistedOnboardingDocumentMetadata,
}
