import { describe, expect, it } from "vitest"

import { buildStoragePath } from "./document-paths"

describe("buildStoragePath (task Phase D)", () => {
  it("builds an opaque path with no customer-identifying value in it", () => {
    expect(buildStoragePath("req-1", "tax", "gst_certificate", "doc-1", "27ABCDE1234F1Z5.pdf")).toBe("req-1/tax/gst_certificate/doc-1.pdf")
  })

  it("preserves the file's own extension", () => {
    expect(buildStoragePath("req-1", "commercial", "customer_po", "doc-2", "po.jpeg")).toBe("req-1/commercial/customer_po/doc-2.jpeg")
  })

  it("never fabricates an extension for a file with none", () => {
    expect(buildStoragePath("req-1", "agreement", "signed_agreement", "doc-3", "agreement")).toBe("req-1/agreement/signed_agreement/doc-3")
  })
})
