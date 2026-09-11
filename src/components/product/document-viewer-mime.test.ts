import { describe, expect, it } from "vitest"

import { isImageMimeType, isPdfMimeType } from "./document-viewer-mime"

describe("isPdfMimeType", () => {
  it("recognizes application/pdf", () => {
    expect(isPdfMimeType("application/pdf")).toBe(true)
  })

  it("rejects everything else", () => {
    expect(isPdfMimeType("image/jpeg")).toBe(false)
    expect(isPdfMimeType("")).toBe(false)
  })
})

describe("isImageMimeType", () => {
  it("recognizes any image/* type, matching the allowed JPG/JPEG uploads", () => {
    expect(isImageMimeType("image/jpeg")).toBe(true)
    expect(isImageMimeType("image/jpg")).toBe(true)
    expect(isImageMimeType("image/png")).toBe(true)
  })

  it("rejects non-image types", () => {
    expect(isImageMimeType("application/pdf")).toBe(false)
  })
})
