import { NextResponse } from "next/server"

import { getStatesForCountry } from "@/features/customer-onboarding/server/geography"

/**
 * Same-origin geography lookup, never a third-party API call (task spec
 * §15). Thin by design: routing and response shaping only, the actual
 * lookup lives in features/customer-onboarding/server/geography.ts.
 */
export async function GET(request: Request) {
  const country = new URL(request.url).searchParams.get("country")
  if (!country) {
    return NextResponse.json({ error: "country is required" }, { status: 400 })
  }
  return NextResponse.json({ items: getStatesForCountry(country) })
}
