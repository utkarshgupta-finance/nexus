import { NextResponse } from "next/server"

import { getSupabaseServiceRoleClient } from "@/lib/supabase/server-client"

/**
 * Minimal health/readiness check (Platform Scale Program, Phase A): is
 * the app running, is required configuration present, is the database
 * reachable. Never exposes a secret value, a table dump, or any
 * business data, only booleans and a status string. `force-dynamic`
 * because this must reflect the current, live state, never a cached
 * build-time answer.
 */
export const dynamic = "force-dynamic"

async function checkDatabase(): Promise<boolean> {
  try {
    const supabase = getSupabaseServiceRoleClient()
    const { error } = await supabase.from("app_users").select("id").limit(1)
    return !error
  } catch {
    return false
  }
}

export async function GET() {
  const configPresent = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
  const databaseReachable = configPresent ? await checkDatabase() : false

  const checks = { app: true, config: configPresent, database: databaseReachable }
  const healthy = checks.app && checks.config && checks.database

  return NextResponse.json({ status: healthy ? "healthy" : "unhealthy", checks }, { status: healthy ? 200 : 503 })
}
