"use client"

import { useState } from "react"
import { DownloadIcon, EyeIcon, FileIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { DocumentViewer } from "@/components/product/document-viewer"
import { formatTimestamp } from "@/lib/date"
import { getOnboardingDocumentDownloadUrlAction } from "../actions"
import { labelForOnboardingDocumentType } from "../domain/document-labels"
import type { PersistedOnboardingDocumentView } from "../domain/types"

/**
 * Real, persisted attachments for one Onboarding Case (Platform Operating
 * Expansion, Phase E): each entry leads with its exact business purpose
 * (task spec, e.g. "GST Registration Document / gst-certificate.pdf")
 * rather than a generic category, and shows who uploaded it and when. A
 * signed URL is fetched on demand, never stored: this bucket is private,
 * so there is no long-lived or public URL for any document.
 */

function OnboardingAttachmentsList({ documents }: { documents: PersistedOnboardingDocumentView[] }) {
  const [viewing, setViewing] = useState<{ document: PersistedOnboardingDocumentView; url: string } | null>(null)
  const [pendingDocumentId, setPendingDocumentId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function resolveUrl(document: PersistedOnboardingDocumentView): Promise<string | null> {
    setError(null)
    setPendingDocumentId(document.documentId)
    const result = await getOnboardingDocumentDownloadUrlAction(document.documentId)
    setPendingDocumentId(null)
    if (!result.ok) {
      setError(result.error)
      return null
    }
    return result.url
  }

  async function handleView(document: PersistedOnboardingDocumentView) {
    const url = await resolveUrl(document)
    if (url) setViewing({ document, url })
  }

  async function handleDownload(document: PersistedOnboardingDocumentView) {
    const url = await resolveUrl(document)
    if (url) window.open(url, "_blank", "noopener,noreferrer")
  }

  if (documents.length === 0) {
    return <p className="text-xs text-muted-foreground">No attachments have been uploaded for this request yet.</p>
  }

  return (
    <div className="flex flex-col gap-2">
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {documents.map((document) => (
        <div key={document.documentId} className="flex items-center gap-2 rounded-md border bg-muted/20 px-3 py-2">
          <FileIcon className="size-3.5 shrink-0 text-muted-foreground" />
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-xs font-medium text-foreground">
              {labelForOnboardingDocumentType(document.documentType)} / {document.originalFileName}
            </span>
            <span className="text-[0.7rem] text-muted-foreground">
              Uploaded by {document.uploadedByLabel ?? "an unknown user"}, {formatTimestamp(document.uploadedAt)}
            </span>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <Button type="button" variant="outline" size="sm" disabled={pendingDocumentId === document.documentId} onClick={() => handleView(document)}>
              <EyeIcon data-icon="inline-start" className="size-3.5" />
              View
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pendingDocumentId === document.documentId}
              onClick={() => handleDownload(document)}
            >
              <DownloadIcon data-icon="inline-start" className="size-3.5" />
              Download
            </Button>
          </div>
        </div>
      ))}

      {viewing ? (
        <DocumentViewer
          open={viewing !== null}
          onOpenChange={(open) => {
            if (!open) setViewing(null)
          }}
          documentName={viewing.document.originalFileName}
          mimeType={viewing.document.mimeType}
          url={viewing.url}
        />
      ) : null}
    </div>
  )
}

export { OnboardingAttachmentsList }
