import { describe, expect, it } from "vitest"

import {
  formatFileSize,
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENT_SIZE_LABEL,
  validateAttachmentFile,
} from "./documents"

describe("attachment validation", () => {
  it("sources the 1 MB limit from one configuration constant", () => {
    expect(MAX_ATTACHMENT_BYTES).toBe(1 * 1024 * 1024)
    expect(MAX_ATTACHMENT_SIZE_LABEL).toBe("1 MB")
  })

  it("accepts a PDF within the size limit", () => {
    const result = validateAttachmentFile(
      { name: "gst-certificate.pdf", type: "application/pdf", size: 846 * 1024 },
      "GST Registration Document"
    )
    expect(result.valid).toBe(true)
  })

  it("accepts a JPG within the size limit", () => {
    const result = validateAttachmentFile(
      { name: "pan-card.jpg", type: "image/jpeg", size: 500 * 1024 },
      "PAN Document"
    )
    expect(result.valid).toBe(true)
  })

  it("accepts a JPEG within the size limit", () => {
    const result = validateAttachmentFile(
      { name: "pan-card.jpeg", type: "image/jpeg", size: 500 * 1024 },
      "PAN Document"
    )
    expect(result.valid).toBe(true)
  })

  it("rejects an oversized file immediately with an explanatory message", () => {
    const result = validateAttachmentFile(
      { name: "gst-certificate.pdf", type: "application/pdf", size: 2.6 * 1024 * 1024 },
      "GST Registration Document"
    )
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.reason).toBe(
        "GST Registration Document is 2.6 MB. Maximum allowed size is 1 MB. Please upload a smaller PDF, JPG or JPEG."
      )
    }
  })

  it("rejects an unsupported file type immediately with an explanatory message", () => {
    const result = validateAttachmentFile(
      { name: "certificate.docx", type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", size: 100 * 1024 },
      "GST Registration Document"
    )
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.reason).toBe(
        "'certificate.docx' cannot be uploaded. Allowed file types are PDF, JPG and JPEG. Maximum file size is 1 MB."
      )
    }
  })

  it("rejects files with no allowed extension even with a plausible mime type", () => {
    const result = validateAttachmentFile({ name: "notes.txt", type: "text/plain", size: 10 }, "PAN Document")
    expect(result.valid).toBe(false)
  })

  it("rejects a png even though it is an image type", () => {
    const result = validateAttachmentFile({ name: "scan.png", type: "image/png", size: 10 * 1024 }, "PAN Document")
    expect(result.valid).toBe(false)
  })

  it("does not use a generic message for a client-side validation failure", () => {
    const result = validateAttachmentFile({ name: "scan.png", type: "image/png", size: 10 }, "PAN Document")
    if (!result.valid) {
      expect(result.reason.toLowerCase()).not.toBe("upload failed")
      expect(result.reason.length).toBeGreaterThan("Upload failed".length)
    }
  })

  it("never mentions the old 2 MB limit anywhere in a validation message", () => {
    const oversized = validateAttachmentFile(
      { name: "gst-certificate.pdf", type: "application/pdf", size: 1.5 * 1024 * 1024 },
      "GST Registration Document"
    )
    const wrongType = validateAttachmentFile({ name: "certificate.docx", type: "application/msword", size: 10 }, "PAN Document")
    if (!oversized.valid) expect(oversized.reason).not.toContain("2 MB")
    if (!wrongType.valid) expect(wrongType.reason).not.toContain("2 MB")
  })
})

describe("non-India tax documents reuse the same shared validator", () => {
  it("accepts a PDF Tax Registration Document within the size limit", () => {
    const result = validateAttachmentFile(
      { name: "tax-registration.pdf", type: "application/pdf", size: 500 * 1024 },
      "Tax Registration Document"
    )
    expect(result.valid).toBe(true)
  })

  it("accepts a JPEG Company Registration / Incorporation Document within the size limit", () => {
    const result = validateAttachmentFile(
      { name: "company-registration.jpeg", type: "image/jpeg", size: 500 * 1024 },
      "Company Registration / Incorporation Document"
    )
    expect(result.valid).toBe(true)
  })

  it("rejects an oversized Company Registration Document, naming that document in the error", () => {
    const result = validateAttachmentFile(
      { name: "company-registration.pdf", type: "application/pdf", size: 1.8 * 1024 * 1024 },
      "Company Registration / Incorporation Document"
    )
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.reason).toBe(
        "Company Registration / Incorporation Document is 1.8 MB. Maximum allowed size is 1 MB. Please upload a smaller PDF, JPG or JPEG."
      )
    }
  })

  it("rejects an unsupported file type for a Tax Registration Document immediately", () => {
    const result = validateAttachmentFile(
      { name: "tax-registration.xlsx", type: "application/vnd.ms-excel", size: 100 * 1024 },
      "Tax Registration Document"
    )
    expect(result.valid).toBe(false)
  })
})

describe("Commercial Documents and Agreement attachments reuse the same shared validator", () => {
  it("accepts a PDF Proposal Sent to Customer within the size limit", () => {
    const result = validateAttachmentFile(
      { name: "proposal.pdf", type: "application/pdf", size: 400 * 1024 },
      "Proposal Sent to Customer"
    )
    expect(result.valid).toBe(true)
  })

  it("accepts a PDF Signed Agreement within the size limit", () => {
    const result = validateAttachmentFile(
      { name: "signed-agreement.pdf", type: "application/pdf", size: 900 * 1024 },
      "Signed Agreement"
    )
    expect(result.valid).toBe(true)
  })

  it("rejects an oversized Signed Agreement", () => {
    const result = validateAttachmentFile(
      { name: "signed-agreement.pdf", type: "application/pdf", size: 1.2 * 1024 * 1024 },
      "Signed Agreement"
    )
    expect(result.valid).toBe(false)
  })
})

describe("formatFileSize", () => {
  it("formats bytes under 1KB", () => {
    expect(formatFileSize(500)).toBe("500 B")
  })

  it("formats kilobytes", () => {
    expect(formatFileSize(846 * 1024)).toBe("846 KB")
  })

  it("formats megabytes to one decimal place", () => {
    expect(formatFileSize(1.5 * 1024 * 1024)).toBe("1.5 MB")
  })
})
