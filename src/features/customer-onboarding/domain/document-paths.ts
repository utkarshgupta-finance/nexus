function extensionFor(fileName: string): string {
  const dotIndex = fileName.lastIndexOf(".")
  return dotIndex === -1 ? "" : fileName.slice(dotIndex)
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
