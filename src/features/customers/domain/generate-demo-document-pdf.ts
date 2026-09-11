import { PDFDocument, StandardFonts, rgb } from "pdf-lib"

import type { DemoDocumentDefinition } from "./demo-documents"

/**
 * Generates one single-page demo PDF from a document definition.
 * Deterministic and pure aside from pdf-lib's own byte encoding: the
 * same definition always produces the same visible content. No network
 * call, no file system access, no secret. Used by the on-demand demo
 * document API route (src/app/api/demo/customer-documents/[documentType]/
 * route.ts); nothing here persists the result anywhere.
 *
 * Library-first: pdf-lib (MIT, pure JavaScript, no native dependencies,
 * self-hostable) was added because no PDF-capable dependency already
 * existed in this repository and hand-authoring raw PDF byte structure
 * (xref tables, object offsets) for even a single-page document is a
 * realistic source of a corrupted file, which would fail this task's
 * own "documents can actually be opened" requirement. See this task's
 * final report for the full Library-First evaluation.
 */
async function generateDemoDocumentPdf(definition: DemoDocumentDefinition): Promise<Uint8Array> {
  const pdfDocument = await PDFDocument.create()
  const page = pdfDocument.addPage([595, 842]) // A4 in points
  const font = await pdfDocument.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdfDocument.embedFont(StandardFonts.HelveticaBold)

  const marginX = 56
  let cursorY = 780

  function drawLine(text: string, options: { bold?: boolean; size?: number; color?: [number, number, number] } = {}) {
    page.drawText(text, {
      x: marginX,
      y: cursorY,
      size: options.size ?? 11,
      font: options.bold ? boldFont : font,
      color: options.color ? rgb(...options.color) : rgb(0.1, 0.1, 0.1),
    })
    cursorY -= (options.size ?? 11) + 10
  }

  drawLine("DEMO DOCUMENT", { bold: true, size: 14, color: [0.7, 0.1, 0.1] })
  drawLine("NOT A REAL LEGAL / TAX / COMMERCIAL DOCUMENT", { bold: true, size: 10, color: [0.7, 0.1, 0.1] })
  drawLine("FOR NEXUS DEVELOPMENT AND UI TESTING ONLY", { bold: true, size: 10, color: [0.7, 0.1, 0.1] })
  cursorY -= 14

  drawLine(definition.title, { bold: true, size: 16 })
  cursorY -= 6

  for (const field of definition.fields) {
    drawLine(`${field.label}: ${field.value}`)
  }

  if (definition.extraNotice) {
    cursorY -= 10
    drawLine(definition.extraNotice, { size: 10, color: [0.35, 0.35, 0.35] })
  }

  cursorY -= 20
  drawLine("SYNTHETIC / DEMO DATA. NOT A REAL CUSTOMER.", { size: 9, color: [0.5, 0.5, 0.5] })
  drawLine(`Document ID: ${definition.documentId}`, { size: 9, color: [0.5, 0.5, 0.5] })

  return pdfDocument.save()
}

export { generateDemoDocumentPdf }
