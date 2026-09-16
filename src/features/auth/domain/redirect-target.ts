/**
 * Shared by both the login route (server) and the login form (client):
 * a `redirectTo` query value is untrusted input, so it is only ever
 * followed if it is a same-origin relative path. Rejects protocol-
 * relative ("//evil.com"), backslash-disguised ("/\evil.com"), and
 * absolute-URL ("https://evil.com") redirect targets to avoid an open
 * redirect, falling back to "/my-work" otherwise.
 */
function sanitizeRedirectTarget(raw: string | null | undefined): string {
  const fallback = "/my-work"
  if (!raw) return fallback
  if (!raw.startsWith("/")) return fallback
  if (raw.startsWith("//") || raw.startsWith("/\\")) return fallback
  if (raw.includes("://")) return fallback
  return raw
}

export { sanitizeRedirectTarget }
