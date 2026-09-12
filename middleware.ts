import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

/**
 * Refreshes the Supabase Auth session cookie on every request, the
 * standard @supabase/ssr Next.js App Router pattern. This is the only
 * thing this middleware does: it does not itself enforce authentication
 * or authorization (docs/AUTHORIZATION_MODEL.md §6, enforcement lives in
 * the application-service layer, `src/platform/permissions/server.ts`,
 * not in middleware). Without this refresh, a session nearing expiry
 * would silently fail on the next Server Component render instead of
 * being renewed transparently.
 *
 * `supabase.auth.getUser()` is called (not `getSession()`) because it
 * revalidates the token against Supabase Auth on every call, rather than
 * trusting a potentially stale cookie-decoded value.
 */
export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    return supabaseResponse
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value)
        }
        supabaseResponse = NextResponse.next({ request })
        for (const { name, value, options } of cookiesToSet) {
          supabaseResponse.cookies.set(name, value, options)
        }
      },
    },
  })

  await supabase.auth.getUser()

  return supabaseResponse
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/demo|api/geography).*)"],
}
