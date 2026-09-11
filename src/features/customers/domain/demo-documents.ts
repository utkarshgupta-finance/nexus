/**
 * Demo document definitions for the one fictional demo customer
 * (./demo-enrichment.ts). Every field here is synthetic, and every
 * generated PDF visibly states it is a demo document (see
 * ../server/generate-demo-document-pdf.ts). This is pure data: it does
 * not generate anything itself, and it is not backend truth. There is
 * no persisted document metadata table yet (docs/DATA_ARCHITECTURE.md
 * §16 "Document/attachment storage (future, not yet implemented)"), so
 * this module is that table's demo-only stand-in for exactly these
 * seven fixed documents, not a general document metadata mechanism.
 */

/** Reuses the same document-type vocabulary customer-onboarding already established, plus one non-onboarding addition. */
type DemoDocumentType =
  | "gst_certificate"
  | "pan_document"
  | "tan_document"
  | "proposal"
  | "customer_po"
  | "pi_copy"
  | "signed_agreement"

type DemoDocumentDefinition = {
  documentType: DemoDocumentType
  documentId: string
  title: string
  fileName: string
  fields: { label: string; value: string }[]
  /** Extra footnote lines a document needs beyond the standard demo notice, e.g. the no-legal-obligation statement for the agreement. */
  extraNotice?: string
  /** Always "demo": no version of this document exists in real storage. */
  source: "demo"
}

const DEMO_CUSTOMER_NAME = "Northstar Consumer Products Pvt Ltd"

const DEMO_DOCUMENTS: DemoDocumentDefinition[] = [
  {
    documentType: "gst_certificate",
    documentId: "demo-doc-gst-certificate",
    title: "GST Registration Certificate",
    fileName: "demo-gst-certificate.pdf",
    fields: [
      { label: "Legal Entity", value: DEMO_CUSTOMER_NAME },
      { label: "GSTIN", value: "29AAAAA0000A1Z5" },
      { label: "State", value: "Karnataka" },
      { label: "Status", value: "DEMO ONLY" },
    ],
    source: "demo",
  },
  {
    documentType: "pan_document",
    documentId: "demo-doc-pan-document",
    title: "PAN Document",
    fileName: "demo-pan-document.pdf",
    fields: [
      { label: "Legal Entity", value: DEMO_CUSTOMER_NAME },
      { label: "PAN", value: "AAAAA0000A" },
      { label: "Status", value: "DEMO ONLY" },
    ],
    source: "demo",
  },
  {
    documentType: "tan_document",
    documentId: "demo-doc-tan-document",
    title: "TAN Document",
    fileName: "demo-tan-document.pdf",
    fields: [
      { label: "Legal Entity", value: DEMO_CUSTOMER_NAME },
      { label: "TAN", value: "BLRA00000A" },
      { label: "Status", value: "DEMO ONLY" },
    ],
    source: "demo",
  },
  {
    documentType: "proposal",
    documentId: "demo-doc-proposal",
    title: "Demo Commercial Proposal",
    fileName: "demo-commercial-proposal.pdf",
    fields: [
      { label: "Customer", value: DEMO_CUSTOMER_NAME },
      { label: "Proposal Reference", value: "DEMO-PROP-0001" },
      { label: "Billing Currency", value: "INR" },
      { label: "Pricing", value: "Illustrative only. No real commercial terms." },
    ],
    source: "demo",
  },
  {
    documentType: "customer_po",
    documentId: "demo-doc-customer-po",
    title: "Demo Purchase Order",
    fileName: "demo-purchase-order.pdf",
    fields: [
      { label: "PO Number", value: "DEMO-PO-0001" },
      { label: "Customer", value: DEMO_CUSTOMER_NAME },
      { label: "Billing Currency", value: "INR" },
      { label: "Payment Details", value: "Not included. Illustrative only." },
    ],
    source: "demo",
  },
  {
    documentType: "pi_copy",
    documentId: "demo-doc-pi-copy",
    title: "Demo Proforma Invoice",
    fileName: "demo-proforma-invoice.pdf",
    fields: [
      { label: "PI Number", value: "DEMO-PI-0001" },
      { label: "Customer", value: DEMO_CUSTOMER_NAME },
      { label: "Billing Currency", value: "INR" },
      { label: "Payment Details", value: "Not included. Illustrative only." },
    ],
    source: "demo",
  },
  {
    documentType: "signed_agreement",
    documentId: "demo-doc-signed-agreement",
    title: "Demo SaaS Agreement",
    fileName: "demo-signed-agreement.pdf",
    fields: [
      { label: "Agreement Reference", value: "DEMO-AGR-0001" },
      { label: "Customer", value: DEMO_CUSTOMER_NAME },
      { label: "Counterparty", value: "Demo Service Provider" },
      { label: "Signature Status", value: "DEMO SIGNED COPY" },
    ],
    extraNotice: "This agreement is synthetic and creates no legal obligation.",
    source: "demo",
  },
]

export { DEMO_DOCUMENTS, DEMO_CUSTOMER_NAME }
export type { DemoDocumentType, DemoDocumentDefinition }
