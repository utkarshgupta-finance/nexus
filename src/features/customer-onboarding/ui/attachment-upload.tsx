"use client"

import { useEffect, useId, useMemo, useRef, useState } from "react"
import { EyeIcon, FileIcon, InfoIcon, UploadIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { DocumentViewer } from "@/components/product/document-viewer"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  ALLOWED_ATTACHMENT_HELP_TEXT,
  formatFileSize,
  MAX_ATTACHMENT_SIZE_LABEL,
  validateAttachmentFile,
} from "../domain/documents"
import { uploadOnboardingDocumentAction, getOnboardingDocumentDownloadUrlAction } from "../actions"
import { formatTimestamp } from "@/lib/date"
import type { OnboardingDocumentType, SelectedOnboardingDocument } from "../domain/types"

type SelectedAttachmentFile = { kind: "selected"; file: File; metadata: SelectedOnboardingDocument }

/**
 * An attachment already persisted from an earlier save (Platform
 * Operating Expansion, Phase A): closes the real defect where reopening
 * a Sent Back request showed every attachment slot as empty even though
 * the document was still there. Carries no `File`/bytes (nothing local
 * to preview from); viewing it fetches a signed URL on demand, the same
 * mechanism the reviewer-facing Evidence list already uses.
 */
type PersistedAttachmentValue = {
  kind: "persisted"
  documentId: string
  fileName: string
  mimeType: string
  sizeBytes: number
  uploadedByLabel: string | null
  uploadedAt: string
}

type AttachmentValue = SelectedAttachmentFile | PersistedAttachmentValue

type UploadStatus = "idle" | "uploading" | "uploaded" | "error"

/**
 * A real browser file picker with immediate client-side validation: a
 * file is checked the moment it is selected, never deferred to Submit.
 * A valid selection previews instantly from the local File AND uploads
 * in the background to real, persistent Storage (task Phase D:
 * `uploadOnboardingDocumentAction`), so the evidence survives a closed
 * tab or a later review, closing the gap
 * ../domain/documents.ts's own header used to document as missing.
 * Shared by every attachment across all five Customer Onboarding stages
 * (Tax & Registration, Commercial Documents, Agreement & Approval), one
 * policy, one component.
 */
function AttachmentUpload({
  requestId,
  category,
  documentType,
  label,
  helpText,
  value,
  onChange,
}: {
  requestId: string
  category: "tax" | "commercial" | "agreement"
  documentType: OnboardingDocumentType
  label: string
  /** Extra guidance shown under the label, for a document whose exact name varies (task spec: Company Registration / Incorporation Document). */
  helpText?: string
  value: AttachmentValue | null
  onChange: (next: AttachmentValue | null) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [viewerOpen, setViewerOpen] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle")
  const [persistedViewerUrl, setPersistedViewerUrl] = useState<string | null>(null)
  const [resolvingViewerUrl, setResolvingViewerUrl] = useState(false)
  const inputId = useId()

  // Derived, not stored in state: recomputes only when the selected file
  // itself changes. The cleanup-only effect below revokes the previous
  // object URL once it stops being the current one (on Replace, Remove,
  // or unmount), so nothing holds a browser resource open longer than the
  // file it points to is actually selected. A persisted value has no
  // local File to preview from at all; its own view path fetches a
  // signed URL on demand instead (handleView below).
  const previewUrl = useMemo(() => (value?.kind === "selected" ? URL.createObjectURL(value.file) : null), [value])
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    // Reset so choosing the same file again after removal still fires onChange.
    event.target.value = ""
    if (!file) return

    const result = validateAttachmentFile(file, label)
    if (!result.valid) {
      setError(result.reason)
      onChange(null)
      return
    }

    setError(null)
    setPersistedViewerUrl(null)
    onChange({
      kind: "selected",
      file,
      metadata: { documentType, fileName: file.name, mimeType: file.type, sizeBytes: file.size },
    })

    setUploadStatus("uploading")
    const formData = new FormData()
    formData.set("file", file)
    const uploadResult = await uploadOnboardingDocumentAction(requestId, category, documentType, formData)
    setUploadStatus(uploadResult.ok ? "uploaded" : "error")
    if (!uploadResult.ok) setError(uploadResult.error)
  }

  function handleRemove() {
    setError(null)
    setViewerOpen(false)
    setUploadStatus("idle")
    onChange(null)
  }

  async function handleView() {
    if (value?.kind !== "persisted") {
      setViewerOpen(true)
      return
    }
    setResolvingViewerUrl(true)
    const result = await getOnboardingDocumentDownloadUrlAction(value.documentId)
    setResolvingViewerUrl(false)
    if (result.ok) {
      setPersistedViewerUrl(result.url)
      setViewerOpen(true)
    } else {
      setError(result.error)
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-medium text-foreground">{label}</span>
        <Tooltip>
          <TooltipTrigger aria-label={`${label} upload requirements`}>
            <InfoIcon className="size-3.5 text-muted-foreground" />
          </TooltipTrigger>
          <TooltipContent side="right">
            <div className="flex flex-col gap-0.5">
              <span>Allowed file types: PDF, JPG, JPEG</span>
              <span>Maximum file size: {MAX_ATTACHMENT_SIZE_LABEL} per file</span>
            </div>
          </TooltipContent>
        </Tooltip>
      </div>

      {helpText ? <p className="text-[0.7rem] text-muted-foreground">{helpText}</p> : null}

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept=".pdf,.jpg,.jpeg,application/pdf,image/jpeg"
        className="sr-only"
        onChange={handleFileChange}
      />

      {!value ? (
        <label
          htmlFor={inputId}
          className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground hover:border-ring hover:text-foreground"
        >
          <UploadIcon className="size-3.5 shrink-0" />
          <span>Choose file</span>
          <span className="ml-auto text-[0.7rem] text-muted-foreground/80">
            {ALLOWED_ATTACHMENT_HELP_TEXT} &middot; Max {MAX_ATTACHMENT_SIZE_LABEL}
          </span>
        </label>
      ) : (
        <div className="flex items-center gap-2 rounded-md border bg-muted/20 px-3 py-2">
          <FileIcon className="size-3.5 shrink-0 text-muted-foreground" />
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-xs font-medium text-foreground">
              {value.kind === "selected" ? value.metadata.fileName : value.fileName}
            </span>
            <span className="text-[0.7rem] text-muted-foreground">
              {value.kind === "selected" ? (
                <>
                  {value.metadata.mimeType === "application/pdf" ? "PDF" : "JPEG"} &middot;{" "}
                  {formatFileSize(value.metadata.sizeBytes)}
                  {uploadStatus === "uploading" ? " · Saving..." : uploadStatus === "uploaded" ? " · Saved" : ""}
                </>
              ) : (
                <>
                  Uploaded{value.uploadedByLabel ? ` by ${value.uploadedByLabel}` : ""}, {formatTimestamp(value.uploadedAt)}
                </>
              )}
            </span>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <Button type="button" variant="outline" size="sm" onClick={handleView} disabled={resolvingViewerUrl}>
              <EyeIcon data-icon="inline-start" className="size-3.5" />
              {resolvingViewerUrl ? "Opening..." : "View"}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
              Replace
            </Button>
            {value.kind === "selected" ? (
              <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove ${label}`} onClick={handleRemove}>
                <XIcon className="size-3.5" />
              </Button>
            ) : null}
          </div>
        </div>
      )}

      {error ? (
        <p role="alert" className="text-[0.7rem] text-destructive">
          {error}
        </p>
      ) : null}

      {value ? (
        <DocumentViewer
          open={viewerOpen}
          onOpenChange={setViewerOpen}
          documentName={value.kind === "selected" ? value.metadata.fileName : value.fileName}
          mimeType={value.kind === "selected" ? value.metadata.mimeType : value.mimeType}
          url={value.kind === "selected" ? previewUrl : persistedViewerUrl}
        />
      ) : null}
    </div>
  )
}

export { AttachmentUpload }
export type { SelectedAttachmentFile, PersistedAttachmentValue, AttachmentValue }
