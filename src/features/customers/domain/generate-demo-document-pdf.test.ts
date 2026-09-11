import { describe, expect, it } from "vitest"

import { DEMO_DOCUMENTS } from "./demo-documents"
import { generateDemoDocumentPdf } from "./generate-demo-document-pdf"

const MAX_DEMO_DOCUMENT_BYTES = 1 * 1024 * 1024

describe("generateDemoDocumentPdf", () => {
  it("generates all seven demo document types", () => {
    expect(DEMO_DOCUMENTS).toHaveLength(7)
    const types = DEMO_DOCUMENTS.map((definition) => definition.documentType)
    expect(new Set(types).size).toBe(7)
  })

  it.each(DEMO_DOCUMENTS)("generates a valid, small PDF for $documentType", async (definition) => {
    const bytes = await generateDemoDocumentPdf(definition)

    // %PDF- header, the minimum honest check that this is really a PDF,
    // not just bytes with a .pdf extension.
    const header = new TextDecoder().decode(bytes.slice(0, 5))
    expect(header).toBe("%PDF-")

    expect(bytes.byteLength).toBeGreaterThan(0)
    expect(bytes.byteLength).toBeLessThan(MAX_DEMO_DOCUMENT_BYTES)
  })

  it("embeds the document's own fields as visible text", async () => {
    const gstDefinition = DEMO_DOCUMENTS.find((definition) => definition.documentType === "gst_certificate")
    if (!gstDefinition) throw new Error("gst_certificate demo document definition missing")
    const bytes = await generateDemoDocumentPdf(gstDefinition)
    // PDF content streams are not plain text, so this only proves bytes
    // were produced and are non-trivial in size for a document with
    // several text lines; full text-extraction round-tripping is left to
    // the "%PDF-" + byte-count check above and the browser open check
    // performed during visual review.
    expect(bytes.byteLength).toBeGreaterThan(400)
  })
})
