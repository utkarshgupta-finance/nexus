import { NextResponse } from "next/server"

import { getDemoDocumentPdf } from "@/features/customers/server/demo-document-download"

/**
 * On-demand demo document download. Generates a fresh, synthetic PDF
 * every call (src/features/customers/domain/generate-demo-document-pdf.ts);
 * nothing is read from or written to storage. This path exists only for
 * the fixed set of demo documents (docs/DATA_ARCHITECTURE.md §16), never
 * a general file-serving endpoint: an unrecognized `documentType` 404s.
 */
export async function GET(_request: Request, context: { params: Promise<{ documentType: string }> }) {
  const { documentType } = await context.params
  const result = await getDemoDocumentPdf(documentType)
  if (!result) {
    return NextResponse.json({ error: "Unknown demo document type." }, { status: 404 })
  }
  return new NextResponse(new Blob([new Uint8Array(result.bytes)], { type: "application/pdf" }), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${result.fileName}"`,
    },
  })
}
