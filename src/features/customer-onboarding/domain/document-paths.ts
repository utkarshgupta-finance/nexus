/** Only a short, safe alphanumeric extension is ever reused from a client-supplied file name; anything else (a path separator, `..`, unexpected length) is dropped rather than carried into a Storage object key. Defense in depth: the caller is expected to have already rejected a disallowed file type before this runs (../domain/documents.ts's `validateAttachmentFile`), so this is a second, independent guard, not the only one. */
function extensionFor(fileName: string): string {
  const dotIndex = fileName.lastIndexOf(".")
  if (dotIndex === -1) return ""
  const extension = fileName.slice(dotIndex)
  return /^\.[a-zA-Z0-9]{1,5}$/.test(extension) ? extension : ""
}

/**
 * Opaque Storage path only (task Phase D spec: "never a customer name/
 * GST/PAN/TAN/tax number in the path"): {requestId}/{category}/
 * {documentType}/{documentId}.{extension}. Pure, so this stays directly
 * unit-testable without the server-only Supabase client.
 */
function buildStoragePath(requestId: string, category: string, documentType: string, documentId: string, fileName: string): string {
  return `${requestId}/${category}/${documentType}/${documentId}${extensionFor(fileName)}`
}

export { extensionFor, buildStoragePath }
