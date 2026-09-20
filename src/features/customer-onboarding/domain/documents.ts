/**
 * Attachment upload constraints and immediate client-side validation.
 *
 * One shared policy governs every attachment this feature collects (tax
 * documents, Commercial Documents, the Signed Agreement): the limit,
 * allowed types, and validation message shape live here once, not
 * scattered as literals through each upload site or any future
 * server-side check. This started as a tax-document-only module; it is
 * now generic because Commercial Documents and Agreement & Approval need
 * the identical policy, not a second copy of it.
 *
 * This stage validates a browser `File` before it is ever sent anywhere.
 * There is no upload to Supabase Storage yet: see ../domain/types.ts's
 * `PersistedOnboardingDocumentMetadata` for the documented future shape,
 * and this module's callers (the upload UI) for how a validated file is
 * currently held only as local, in-session state.
 */

const MAX_ATTACHMENT_BYTES = 1 * 1024 * 1024
const MAX_ATTACHMENT_SIZE_LABEL = "1 MB"

const ALLOWED_ATTACHMENT_MIME_TYPES = ["application/pdf", "image/jpeg"] as const
const ALLOWED_ATTACHMENT_EXTENSIONS = [".pdf", ".jpg", ".jpeg"] as const
const ALLOWED_ATTACHMENT_HELP_TEXT = "PDF, JPG or JPEG"

type AttachmentValidationResult = { valid: true } | { valid: false; reason: string }

function getFileExtension(fileName: string): string {
  const dotIndex = fileName.lastIndexOf(".")
  return dotIndex === -1 ? "" : fileName.slice(dotIndex).toLowerCase()
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${Math.round(kb)} KB`
  const mb = kb / 1024
  return `${mb.toFixed(1)} MB`
}

const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46] // "%PDF"
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff]

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  return signature.every((byte, index) => bytes[index] === byte)
}

/**
 * Real content check (server-side only: a browser `File`'s reported
 * `type` and its filename extension are both just labels the client
 * attached, never the file's actual bytes). Accepts the file if its
 * first bytes match either allowed format's real signature, regardless
 * of which one the name/type claimed, since a genuine PDF renamed to
 * `.jpg` is not a security concern the way a disguised executable is.
 */
function matchesAllowedAttachmentSignature(firstBytes: Uint8Array): boolean {
  return startsWith(firstBytes, PDF_SIGNATURE) || startsWith(firstBytes, JPEG_SIGNATURE)
}

/**
 * Validates a picked file against type and size rules, immediately (task
 * spec: never deferred to Submit). `documentLabel` is the human-readable
 * field name ("GST Registration Document") used in the size-limit
 * message; the type-rejection message uses the file's own name instead.
 */
function validateAttachmentFile(
  file: { name: string; type: string; size: number },
  documentLabel: string
): AttachmentValidationResult {
  const extension = getFileExtension(file.name)
  const typeAllowed =
    (ALLOWED_ATTACHMENT_MIME_TYPES as readonly string[]).includes(file.type) ||
    (ALLOWED_ATTACHMENT_EXTENSIONS as readonly string[]).includes(extension)

  if (!typeAllowed) {
    return {
      valid: false,
      reason: `'${file.name}' cannot be uploaded. Allowed file types are PDF, JPG and JPEG. Maximum file size is ${MAX_ATTACHMENT_SIZE_LABEL}.`,
    }
  }

  if (file.size > MAX_ATTACHMENT_BYTES) {
    return {
      valid: false,
      reason: `${documentLabel} is ${formatFileSize(file.size)}. Maximum allowed size is ${MAX_ATTACHMENT_SIZE_LABEL}. Please upload a smaller PDF, JPG or JPEG.`,
    }
  }

  return { valid: true }
}

/**
 * The core of the attachment-continuity fix (Platform Operating
 * Expansion, Phase A): finds the currently-persisted document, if any,
 * for one attachment slot. `documents` is already scoped to one request
 * and already filtered to `isCurrent` by the caller
 * (`listOnboardingDocumentsWithUploader`), so this only needs to match by
 * type; it never decides currency itself.
 */
function findPersistedDocument<T extends { documentType: OnboardingDocumentTypeLike }>(
  documents: T[],
  documentType: OnboardingDocumentTypeLike
): T | null {
  return documents.find((document) => document.documentType === documentType) ?? null
}

// Kept as a loose string type here (not importing OnboardingDocumentType
// from ./types) so this module never needs to know the full closed set;
// callers already have a real OnboardingDocumentType to pass in.
type OnboardingDocumentTypeLike = string

export {
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENT_SIZE_LABEL,
  ALLOWED_ATTACHMENT_MIME_TYPES,
  ALLOWED_ATTACHMENT_EXTENSIONS,
  ALLOWED_ATTACHMENT_HELP_TEXT,
  formatFileSize,
  validateAttachmentFile,
  matchesAllowedAttachmentSignature,
  findPersistedDocument,
}
export type { AttachmentValidationResult }
