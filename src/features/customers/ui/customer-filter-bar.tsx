"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { useState } from "react"
import { SearchIcon } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { FilterSelect } from "@/components/product/filter-select"
import type { ReferenceOption } from "@/features/reference-data"

/**
 * Customer Search filter bar (task Phase B): pushes plain query
 * parameters (`q`, `segment`, `businessUnit`, `country`, `status`) so
 * the Customers route stays a server component doing the actual
 * filtering, and a search is always a shareable/bookmarkable URL rather
 * than hidden client state.
 */

const ALL_VALUE = "__all__"

function updateSearchParam(current: URLSearchParams, key: string, value: string | null): URLSearchParams {
  const next = new URLSearchParams(current.toString())
  if (value && value !== ALL_VALUE) next.set(key, value)
  else next.delete(key)
  return next
}

function CustomerFilterBar({
  segmentOptions,
  businessUnitOptions,
  countryOptions,
}: {
  segmentOptions: ReferenceOption[]
  businessUnitOptions: ReferenceOption[]
  countryOptions: ReferenceOption[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [query, setQuery] = useState(searchParams.get("q") ?? "")

  function navigate(next: URLSearchParams) {
    const qs = next.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  function handleSearchSubmit(event: React.FormEvent) {
    event.preventDefault()
    navigate(updateSearchParam(searchParams, "q", query))
  }

  function handleFilterChange(key: string, value: string) {
    navigate(updateSearchParam(searchParams, key, value))
  }

  const hasActiveFilters = Array.from(searchParams.keys()).length > 0

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <form onSubmit={handleSearchSubmit} className="flex flex-1 items-center gap-2 sm:max-w-xs">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search name, brand, or key"
          className="h-8 text-xs"
        />
        <Button type="submit" variant="outline" size="sm" className="shrink-0">
          <SearchIcon data-icon="inline-start" className="size-3.5" />
          Search
        </Button>
      </form>

      <FilterSelect
        value={searchParams.get("segment") ?? ALL_VALUE}
        onValueChange={(value) => handleFilterChange("segment", value)}
        options={segmentOptions}
        allValue={ALL_VALUE}
        allLabel="All segments"
        placeholder="Segment"
      />

      <FilterSelect
        value={searchParams.get("businessUnit") ?? ALL_VALUE}
        onValueChange={(value) => handleFilterChange("businessUnit", value)}
        options={businessUnitOptions}
        allValue={ALL_VALUE}
        allLabel="All business units"
        placeholder="Business Unit"
      />

      <FilterSelect
        value={searchParams.get("country") ?? ALL_VALUE}
        onValueChange={(value) => handleFilterChange("country", value)}
        options={countryOptions}
        allValue={ALL_VALUE}
        allLabel="All countries"
        placeholder="Country"
      />

      <FilterSelect
        value={searchParams.get("status") ?? ALL_VALUE}
        onValueChange={(value) => handleFilterChange("status", value)}
        options={[
          { value: "active", label: "Active" },
          { value: "inactive", label: "Inactive" },
        ]}
        allValue={ALL_VALUE}
        allLabel="All statuses"
        placeholder="Status"
      />

      {hasActiveFilters ? (
        <Button variant="ghost" size="sm" onClick={() => { setQuery(""); router.push(pathname) }}>
          Clear filters
        </Button>
      ) : null}
    </div>
  )
}

export { CustomerFilterBar }
