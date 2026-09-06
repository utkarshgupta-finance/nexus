"use client"

import { useMemo, useState } from "react"
import { SearchIcon } from "lucide-react"

import { PageHeader } from "@/components/product/page-header"
import { FilterBar } from "@/components/product/filter-bar"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import { WORK_ITEMS, WORK_SUMMARY } from "../data"
import type { WorkItem, WorkModule } from "../types"
import type { NexusStatus } from "@/components/product/status-badge"
import { WorkSummaryStrip } from "./work-summary-strip"
import { WorkQueueTable } from "./work-queue-table"
import { WorkItemDetailSheet } from "./work-item-detail-sheet"

const STATUS_OPTIONS: { value: NexusStatus | "all"; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "review", label: "In Review" },
  { value: "approved", label: "Approved" },
  { value: "attention", label: "Attention" },
  { value: "blocked", label: "Blocked" },
]

const MODULE_OPTIONS: { value: WorkModule | "all"; label: string }[] = [
  { value: "all", label: "All modules" },
  { value: "Customers", label: "Customers" },
  { value: "Commercials", label: "Commercials" },
  { value: "Go-Live", label: "Go-Live" },
  { value: "Ledger", label: "Ledger" },
  { value: "Suspensions", label: "Suspensions" },
]

function MyWorkView() {
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState<NexusStatus | "all">("all")
  const [module, setModule] = useState<WorkModule | "all">("all")
  const [owner, setOwner] = useState<string>("all")
  const [selectedItem, setSelectedItem] = useState<WorkItem | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const owners = useMemo(() => {
    const unique = new Map<string, string>()
    for (const item of WORK_ITEMS) unique.set(item.owner.name, item.owner.name)
    return Array.from(unique.values())
  }, [])

  const filteredItems = useMemo(() => {
    return WORK_ITEMS.filter((item) => {
      if (status !== "all" && item.status !== status) return false
      if (module !== "all" && item.module !== module) return false
      if (owner !== "all" && item.owner.name !== owner) return false
      if (search.trim().length > 0) {
        const query = search.trim().toLowerCase()
        const haystack = `${item.customer} ${item.item}`.toLowerCase()
        if (!haystack.includes(query)) return false
      }
      return true
    })
  }, [search, status, module, owner])

  function handleSelect(item: WorkItem) {
    setSelectedItem(item)
    setSheetOpen(true)
  }

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader title="My Work" description="Items that need your attention" />
      <WorkSummaryStrip items={WORK_SUMMARY} />

      <FilterBar>
        <div className="relative w-56">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search customer or item"
            className="pl-7"
          />
        </div>

        <Select value={status} onValueChange={(value) => setStatus(value as NexusStatus | "all")}>
          <SelectTrigger>
            <SelectValue>
              {(value: string) =>
                STATUS_OPTIONS.find((option) => option.value === value)?.label ?? "Status"
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        <Select value={module} onValueChange={(value) => setModule(value as WorkModule | "all")}>
          <SelectTrigger>
            <SelectValue>
              {(value: string) =>
                MODULE_OPTIONS.find((option) => option.value === value)?.label ?? "Module"
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {MODULE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        <Select value={owner} onValueChange={(value) => setOwner(value ?? "all")}>
          <SelectTrigger>
            <SelectValue>
              {(value: string) => (value === "all" ? "All owners" : value)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="all">All owners</SelectItem>
              {owners.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        <span className="ml-auto text-xs text-muted-foreground">
          {filteredItems.length} of {WORK_ITEMS.length}
        </span>
      </FilterBar>

      <WorkQueueTable items={filteredItems} onSelect={handleSelect} />

      <WorkItemDetailSheet
        item={selectedItem}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </div>
  )
}

export { MyWorkView }
