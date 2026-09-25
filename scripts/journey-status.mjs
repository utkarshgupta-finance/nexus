#!/usr/bin/env node
/**
 * Live journey-run status: reads the single machine-readable source of
 * truth (docs/journey-runs/RUN_STATE.json), regenerates the human-readable
 * dashboard (docs/journey-runs/CURRENT_RUN_STATUS.md), and prints a concise
 * summary to stdout. Never hand-edit CURRENT_RUN_STATUS.md; edit
 * RUN_STATE.json (or call updateRunState from another script) instead, so
 * the dashboard and the machine state can never drift apart. The per-batch
 * journey ledger (e.g. BATCH_08_RESULTS.md) remains the authoritative
 * evidence record; this file is only an operational dashboard.
 */

import { execSync } from "node:child_process"
import { readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const STATE_PATH = join(ROOT, "docs/journey-runs/RUN_STATE.json")
const DASHBOARD_PATH = join(ROOT, "docs/journey-runs/CURRENT_RUN_STATUS.md")

const CLASSIFICATION_LABELS = {
  PASS: "PASS",
  FIXED_PASS: "FAILED THEN FIXED + PASS",
  EXPECTED_BEHAVIOR: "EXPECTED BEHAVIOUR",
  PRODUCT_GAP: "PRODUCT GAP",
  PRODUCT_DECISION_REQUIRED: "PRODUCT DECISION REQUIRED",
  BLOCKED: "BLOCKED",
  EXTERNAL_BLOCKER: "EXTERNAL BLOCKER",
  PARTIAL: "PARTIAL",
}

function gitInfo() {
  const run = (cmd) => {
    try {
      return execSync(cmd, { cwd: ROOT, stdio: ["ignore", "pipe", "ignore"] }).toString().trim()
    } catch {
      return null
    }
  }
  const branch = run("git rev-parse --abbrev-ref HEAD")
  const head = run("git rev-parse --short HEAD")
  const status = run("git status --porcelain")
  return { branch, head, dirty: status !== null && status.length > 0 }
}

function loadState() {
  return JSON.parse(readFileSync(STATE_PATH, "utf8"))
}

function computeCounts(state) {
  const counts = Object.fromEntries(Object.keys(CLASSIFICATION_LABELS).map((k) => [k, 0]))
  let complete = 0
  for (const j of state.journeys) {
    if (j.status === "COMPLETE") {
      complete += 1
      if (j.classification && counts[j.classification] !== undefined) counts[j.classification] += 1
    }
  }
  const scheduled = state.scheduled ?? state.journeys.length
  const remaining = scheduled - complete
  const percent = scheduled > 0 ? Math.round((complete / scheduled) * 100) : 0
  return { counts, complete, remaining, scheduled, percent }
}

function nextJourneys(state, n = 3) {
  const idx = state.journeys.findIndex((j) => j.id === state.currentJourney)
  const startFrom = idx === -1 ? 0 : idx + 1
  return state.journeys
    .slice(startFrom)
    .filter((j) => j.status !== "COMPLETE")
    .slice(0, n)
    .map((j) => j.id)
}

function lastCompleted(state) {
  const idx = state.journeys.findIndex((j) => j.id === state.currentJourney)
  const upTo = idx === -1 ? state.journeys : state.journeys.slice(0, idx)
  const done = upTo.filter((j) => j.status === "COMPLETE")
  return done.length > 0 ? done[done.length - 1].id : "None"
}

function formatTimestamp(date) {
  return date.toISOString().replace("T", " ").replace(/\.\d+Z$/, " UTC")
}

function buildDashboardMarkdown(state, git, now) {
  const { counts, complete, remaining, scheduled, percent } = computeCounts(state)
  const closed = state.batchStatus === "COMPLETE"
  const headline = closed
    ? `Batch ${state.batch} — COMPLETE — ${complete} / ${scheduled} reconciled`
    : `Batch ${state.batch}: ${complete} / ${scheduled} complete (${percent}%)`

  const current = state.journeys.find((j) => j.id === state.currentJourney)

  const lines = []
  lines.push(`# Current Run Status`)
  lines.push(``)
  lines.push(
    `Live, human-readable operational dashboard, generated from \`RUN_STATE.json\` by \`npm run journey:status\`. Do not hand-edit this file. The batch ledger (\`BATCH_${String(state.batch).padStart(2, "0")}_RESULTS.md\`) remains the authoritative evidence record; if this dashboard and the ledger ever disagree, the ledger wins and this file must be regenerated.`
  )
  lines.push(``)
  lines.push(`## Current run`)
  lines.push(``)
  lines.push(`- **Current Batch:** ${state.batch}${state.batchLabel ? ` (${state.batchLabel})` : ""}`)
  lines.push(`- **Batch status:** ${state.batchStatus}`)
  lines.push(`- **Scheduled journey count:** ${scheduled}`)
  lines.push(`- **Completed journey count:** ${complete}`)
  lines.push(`- **Remaining journey count:** ${remaining}`)
  lines.push(`- **Percentage complete:** ${percent}%`)
  lines.push(`- **Current journey ID:** ${state.currentJourney ?? "None"}`)
  lines.push(`- **Current journey execution state:** ${state.currentExecutionState ?? (current?.executionState ?? "NOT_STARTED")}`)
  lines.push(``)
  lines.push(`> ${headline}`)
  lines.push(``)
  lines.push(`## Classification counts`)
  lines.push(``)
  for (const [key, label] of Object.entries(CLASSIFICATION_LABELS)) {
    lines.push(`- **${label}:** ${counts[key]}`)
  }
  lines.push(``)
  lines.push(`## Current activity`)
  lines.push(``)
  lines.push(`- **Last journey completed:** ${lastCompleted(state)}`)
  lines.push(`- **Journey currently executing:** ${state.currentJourney ?? "None"}`)
  lines.push(`- **Next 3 journeys:** ${nextJourneys(state).join(", ") || "None"}`)
  lines.push(``)
  lines.push(`## Findings`)
  lines.push(``)
  lines.push(`- **Defects found:** ${state.defectsFound ?? 0}`)
  lines.push(`- **Defects fixed:** ${state.defectsFixed ?? 0}`)
  lines.push(`- **Open defects:** ${state.openDefects ?? 0}`)
  lines.push(`- **Product Decisions found:** ${state.productDecisionsFound ?? 0}`)
  lines.push(`- **Journey Discovery:**`)
  const jd = state.journeyDiscovery ?? {}
  lines.push(`  - ALREADY COVERED: ${jd.ALREADY_COVERED ?? 0}`)
  lines.push(`  - EXPAND EXISTING JOURNEY: ${jd.EXPAND_EXISTING_JOURNEY ?? 0}`)
  lines.push(`  - NEW JOURNEY REQUIRED: ${jd.NEW_JOURNEY_REQUIRED ?? 0}`)
  lines.push(`  - REGRESSION TEST ONLY: ${jd.REGRESSION_TEST_ONLY ?? 0}`)
  lines.push(`  - FUTURE MODULE: ${jd.FUTURE_MODULE ?? 0}`)
  lines.push(`  - PRODUCT DECISION REQUIRED: ${jd.PRODUCT_DECISION_REQUIRED ?? 0}`)
  lines.push(``)
  lines.push(`## Environment`)
  lines.push(``)
  lines.push(`- **Current branch:** ${git.branch ?? "unknown"}`)
  lines.push(`- **Current HEAD:** ${git.head ?? "unknown"}`)
  lines.push(`- **Working tree:** ${git.dirty ? "dirty" : "clean"}`)
  lines.push(`- **Latest test checkpoint:** ${state.lastCheckpoint ?? "None run yet this batch"}`)
  lines.push(`- **Blocking environment issue:** ${state.blockingIssue ?? "None"}`)
  lines.push(``)
  lines.push(`## Timestamp`)
  lines.push(``)
  lines.push(`- **Last status update:** ${formatTimestamp(now)}`)
  lines.push(``)
  return lines.join("\n")
}

function buildConsoleSummary(state, git) {
  const { counts, complete, remaining, scheduled, percent } = computeCounts(state)
  const current = state.journeys.find((j) => j.id === state.currentJourney)
  const pad = (label, value) => `${label.padEnd(21)} ${value}`
  const lines = []
  lines.push(`NEXUS JOURNEY STATUS`)
  lines.push(``)
  lines.push(pad(`Batch ${state.batch}`, state.batchStatus))
  lines.push(pad("Progress", `${complete} / ${scheduled} (${percent}%)`))
  lines.push(pad("Current", `${state.currentJourney ?? "None"} - ${state.currentExecutionState ?? current?.executionState ?? "NOT_STARTED"}`))
  lines.push(pad("Remaining", `${remaining}`))
  lines.push(``)
  lines.push(pad("PASS", counts.PASS))
  lines.push(pad("FIXED + PASS", counts.FIXED_PASS))
  lines.push(pad("EXPECTED", counts.EXPECTED_BEHAVIOR))
  lines.push(pad("PRODUCT GAP", counts.PRODUCT_GAP))
  lines.push(pad("PRODUCT DECISIONS", counts.PRODUCT_DECISION_REQUIRED))
  lines.push(pad("BLOCKED", counts.BLOCKED + counts.EXTERNAL_BLOCKER))
  lines.push(``)
  lines.push(pad("Defects", `${state.defectsFound ?? 0} found / ${state.defectsFixed ?? 0} fixed / ${state.openDefects ?? 0} open`))
  const jd = state.journeyDiscovery ?? {}
  const newJourneys = jd.NEW_JOURNEY_REQUIRED ?? 0
  lines.push(pad("New journeys", `${newJourneys}`))
  lines.push(``)
  lines.push(pad("Last completed", lastCompleted(state)))
  lines.push(pad("Next", nextJourneys(state).join(", ") || "None"))
  lines.push(``)
  lines.push(pad("HEAD", git.head ?? "unknown"))
  lines.push(pad("Last update", formatTimestamp(new Date())))
  return lines.join("\n")
}

function main() {
  const state = loadState()
  const git = gitInfo()
  const now = new Date()
  const markdown = buildDashboardMarkdown(state, git, now)
  writeFileSync(DASHBOARD_PATH, markdown)
  console.log(buildConsoleSummary(state, git))
}

main()
