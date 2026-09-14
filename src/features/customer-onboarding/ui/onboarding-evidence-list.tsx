"use client"

import { useState } from "react"
import { DownloadIcon, EyeIcon, FileIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { DocumentViewer } from "@/components/product/document-viewer"
import { getOnboardingDocumentDownloadUrlAction } from "../actions"
import type { PersistedOnboardingDocumentMetadata } from "../domain/types"

/**
 * Real, persisted evidence for one Onboarding Case (task Phase D/F): a
 * reviewer can now actually see what was uploaded, closing the "what
 * evidence exists?" gap Approval UX standardization (task Phase F)
 * found. A signed URL is fetched on demand, never stored: this bucket
 * is private (task Phase D), so there is no long-lived or public URL
 * for any document.
 */

const CATEGORY_LABELS: Record<PersistedOnboardingDocumentMetadata["category"], string> = {
  tax: "Tax & Registration",
  commercial: "Commercial Documents",
  agreement: "Agreement",
}

function OnboardingEvidenceList({ documents }: { documents: PersistedOnboardingDocumentMetadata[] }) {
  const [viewing, setViewing] = useState<{ document: PersistedOnboardingDocumentMetadata; url: string } | null>(null)
  const [pendingDocumentId, setPendingDocumentId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function resolveUrl(document: PersistedOnboardingDocumentMetadata): Promise<string | null> {
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

  async function handleView(document: PersistedOnboardingDocumentMetadata) {
    const url = await resolveUrl(document)
    if (url) setViewing({ document, url })
  }

  async function handleDownload(document: PersistedOnboardingDocumentMetadata) {
    const url = await resolveUrl(document)
    if (url) window.open(url, "_blank", "noopener,noreferrer")
  }

  if (documents.length === 0) {
    return <p className="text-xs text-muted-foreground">No evidence documents have been uploaded for this request yet.</p>
  }

  return (
    <div className="flex flex-col gap-2">
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {documents.map((document) => (
        <div key={document.documentId} className="flex items-center gap-2 rounded-md border bg-muted/20 px-3 py-2">
          <FileIcon className="size-3.5 shrink-0 text-muted-foreground" />
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-xs font-medium text-foreground">{document.originalFileName}</span>
            <span className="text-[0.7rem] text-muted-foreground">{CATEGORY_LABELS[document.category]}</span>
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

export { OnboardingEvidenceList }
