"use client"

import { DownloadIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { isImageMimeType, isPdfMimeType } from "./document-viewer-mime"

/**
 * Reusable Nexus document viewer: inspect a PDF or image inline, without
 * leaving the page it belongs to (Customer Master, Customer Onboarding
 * attachments, and eventually Agreements/POs/invoices/tax certificates -
 * anywhere a document already has a View action). Library-first (task
 * spec §2): PDF preview uses the browser's own native `<object>` renderer,
 * which already supports pagination/scrolling in every evergreen browser,
 * so no PDF library (react-pdf, pdfjs-dist) was added for this; image
 * preview is a plain `<img>` with `object-fit: contain`, which already
 * preserves aspect ratio natively. Re-evaluate only if a requirement
 * genuinely needs annotation, text extraction, or thumbnailing, none of
 * which View needs today.
 *
 * `url` is whatever authorized source the caller already has: a
 * `URL.createObjectURL` for a locally selected file that was never
 * uploaded anywhere, an API route, or a future short-lived signed
 * Supabase Storage URL. This component never assumes the URL is public
 * and never constructs one itself (task spec §3): it only ever renders
 * the URL it is given.
 */
type DocumentViewerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  documentName: string
  mimeType: string
  /** null while a preview source is not available; the viewer shows an honest message instead of a broken embed. */
  url: string | null
  /** A separate, explicit Download action, since View must never replace Download (task spec §1). Omit when nothing is available to download (see ../../features/customer-onboarding/ui/attachment-upload.tsx's header for why a locally selected, never-uploaded file has none). */
  downloadUrl?: string
}

function DocumentViewer({ open, onOpenChange, documentName, mimeType, url, downloadUrl }: DocumentViewerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* Matching the exact `data-[side=right]:` prefix Sheet's own base classes use for width (src/components/ui/sheet.tsx) so this override actually wins the cascade: a plain `w-full` shares no specificity relationship with `data-[side=right]:w-3/4` and was losing to it on mobile, leaving a visible sliver of the page beside the viewer. */}
      <SheetContent side="right" className="flex flex-col data-[side=right]:w-full sm:data-[side=right]:max-w-2xl">
        <SheetHeader>
          <SheetTitle className="truncate">{documentName}</SheetTitle>
          <SheetDescription>{isPdfMimeType(mimeType) ? "PDF document" : isImageMimeType(mimeType) ? "Image" : mimeType}</SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col px-6">
          {!url ? (
            <p className="text-xs text-muted-foreground">Preview is not available for this document.</p>
          ) : isPdfMimeType(mimeType) ? (
            <object data={url} type="application/pdf" className="min-h-[60vh] flex-1 rounded-md border">
              <p className="p-4 text-xs text-muted-foreground">
                This browser cannot preview PDFs inline. Use Download instead.
              </p>
            </object>
          ) : isImageMimeType(mimeType) ? (
            <div className="flex min-h-[60vh] flex-1 items-center justify-center overflow-auto rounded-md border bg-muted/20 p-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary local/authorized document sources (object URLs, API routes, future signed URLs), never a static asset next/image can optimize */}
              <img src={url} alt={documentName} className="max-h-full max-w-full object-contain" />
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Preview is not available for this file type.</p>
          )}
        </div>

        {downloadUrl ? (
          <SheetFooter className="flex-row justify-end">
            <Button variant="outline" size="sm" render={<a href={downloadUrl} download />}>
              <DownloadIcon data-icon="inline-start" className="size-3.5" />
              Download
            </Button>
          </SheetFooter>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

export { DocumentViewer }
export type { DocumentViewerProps }
