/**
 * S-013 (Batch 23, defect found and fixed): every governed detail route
 * takes its record id straight from the URL and passes it to a Supabase
 * `.eq("<uuid column>", id)` lookup. Postgres rejects a non-UUID string
 * with a raw `22P02` error before any application code runs, which none
 * of these routes previously caught, so a malformed id in the URL
 * crashed instead of showing the same clean not-found state a
 * well-formed but nonexistent id already gets. Checking this first lets
 * every route treat "malformed" and "nonexistent" identically.
 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isValidUuid(value: string): boolean {
  return UUID_PATTERN.test(value)
}

export { isValidUuid }
