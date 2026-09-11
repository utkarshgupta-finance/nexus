/**
 * Pure MIME-type classification for DocumentViewer, kept in its own
 * dependency-free module so it is directly unit-testable (this repo has
 * no component-rendering test harness; see ./document-viewer.tsx).
 */
function isPdfMimeType(mimeType: string): boolean {
  return mimeType === "application/pdf"
}

function isImageMimeType(mimeType: string): boolean {
  return mimeType.startsWith("image/")
}

export { isPdfMimeType, isImageMimeType }
