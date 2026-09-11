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
import type { OnboardingDocumentType, SelectedOnboardingDocument } from "../domain/types"

type SelectedAttachmentFile = { file: File; metadata: SelectedOnboardingDocument }

/**
 * A real browser file picker with immediate client-side validation: a
 * file is checked the moment it is selected, never deferred to Submit,
 * and a rejected file never enters `value`. `value` is the SELECTED
 * LOCAL FILE only, never uploaded anywhere from this Client Component;
 * see ../domain/types.ts's `PersistedOnboardingDocumentMetadata` for the
 * documented future persisted shape. Shared by every attachment across
 * all five Customer Onboarding stages (Tax & Registration, Commercial
 * Documents, Agreement & Approval), one policy, one component.
 */
function AttachmentUpload({
  documentType,
  label,
  helpText,
  value,
  onChange,
}: {
  documentType: OnboardingDocumentType
  label: string
  /** Extra guidance shown under the label, for a document whose exact name varies (task spec: Company Registration / Incorporation Document). */
  helpText?: string
  value: SelectedAttachmentFile | null
  onChange: (next: SelectedAttachmentFile | null) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [viewerOpen, setViewerOpen] = useState(false)
  const inputId = useId()

  // Derived, not stored in state: recomputes only when the selected file
  // itself changes. The cleanup-only effect below revokes the previous
  // object URL once it stops being the current one (on Replace, Remove,
  // or unmount), so nothing holds a browser resource open longer than the
  // file it points to is actually selected.
  const previewUrl = useMemo(() => (value ? URL.createObjectURL(value.file) : null), [value])
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
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
    onChange({
      file,
      metadata: { documentType, fileName: file.name, mimeType: file.type, sizeBytes: file.size },
    })
  }

  function handleRemove() {
    setError(null)
    setViewerOpen(false)
    onChange(null)
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
            <span className="truncate text-xs font-medium text-foreground">{value.metadata.fileName}</span>
            <span className="text-[0.7rem] text-muted-foreground">
              {value.metadata.mimeType === "application/pdf" ? "PDF" : "JPEG"} &middot;{" "}
              {formatFileSize(value.metadata.sizeBytes)}
            </span>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <Button type="button" variant="outline" size="sm" onClick={() => setViewerOpen(true)}>
              <EyeIcon data-icon="inline-start" className="size-3.5" />
              View
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
              Replace
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Remove ${label}`}
              onClick={handleRemove}
            >
              <XIcon className="size-3.5" />
            </Button>
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
          documentName={value.metadata.fileName}
          mimeType={value.metadata.mimeType}
          url={previewUrl}
        />
      ) : null}
    </div>
  )
}

export { AttachmentUpload }
export type { SelectedAttachmentFile }
