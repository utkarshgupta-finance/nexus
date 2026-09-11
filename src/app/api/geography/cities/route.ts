import { NextResponse } from "next/server"

import { searchCitiesForCountry } from "@/features/customer-onboarding/server/geography"

const DEFAULT_PAGE_SIZE = 50
const MAX_PAGE_SIZE = 100

/**
 * Same-origin, search-driven city lookup, never a third-party API call
 * (task spec §15). Always paginated: some states/countries have
 * thousands of cities in the underlying dataset, so this never returns
 * an unbounded list regardless of query.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const country = params.get("country")
  if (!country) {
    return NextResponse.json({ error: "country is required" }, { status: 400 })
  }

  const stateCode = params.get("state")
  const search = params.get("search") ?? ""
  const skip = Math.max(0, Number(params.get("skip") ?? 0) || 0)
  const take = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(params.get("take") ?? DEFAULT_PAGE_SIZE) || DEFAULT_PAGE_SIZE))

  const result = searchCitiesForCountry({ countryIso2: country, stateCode, search, skip, take })
  return NextResponse.json(result)
}
