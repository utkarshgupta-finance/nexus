import { DEMO_DOCUMENTS } from "../domain/demo-documents"
import type { DemoDocumentType } from "../domain/demo-documents"
import { generateDemoDocumentPdf } from "../domain/generate-demo-document-pdf"

/**
 * Generates a demo document's PDF bytes on request, server-side only.
 * Deliberately not backed by any storage: there is no private Supabase
 * Storage bucket or document metadata table for this yet
 * (docs/DATA_ARCHITECTURE.md §16, "future, not yet implemented"), so
 * nothing here pretends a stored file exists. Every call regenerates the
 * same deterministic bytes from ../domain/demo-documents.ts's fixed
 * definitions; nothing is written to disk or to Supabase. Returns `null`
 * for any `documentType` outside the seven known demo documents, so the
 * calling route can 404 honestly instead of generating an unexpected
 * document.
 */
async function getDemoDocumentPdf(documentType: string): Promise<{ bytes: Uint8Array; fileName: string } | null> {
  const definition = DEMO_DOCUMENTS.find((entry) => entry.documentType === (documentType as DemoDocumentType))
  if (!definition) return null
  const bytes = await generateDemoDocumentPdf(definition)
  return { bytes, fileName: definition.fileName }
}

export { getDemoDocumentPdf }
