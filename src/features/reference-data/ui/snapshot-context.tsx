"use client"

import { createContext, useContext } from "react"

import type { ReferenceMasterSnapshot } from "../domain/types"

/**
 * Carries one request's `ReferenceMasterSnapshot` down through a deep
 * Client Component tree (Customer Onboarding's Commercial Rate section is
 * many nested components, several levels removed from the page-level
 * component that receives the snapshot as a prop from its Server
 * Component route). Every pure domain function that resolves a Reference
 * Master label or governed rate (`../domain/service.ts`,
 * `../../customer-onboarding/domain/commercial-rate-summary.ts`,
 * `../../customer-onboarding/domain/commercial-rate-fx.ts`) still takes
 * the snapshot as an explicit parameter, never reads this context
 * directly: only the UI components that call those functions read it
 * here, so the domain layer stays framework-agnostic and just as easy to
 * unit test as before (a plain fixture-built snapshot passed as an
 * argument).
 *
 * No default value: a consumer rendered outside `ReferenceMasterSnapshotProvider`
 * is a real wiring bug, not a case to paper over with a silent empty
 * snapshot (task correction §23, "do not pretend empty list means there
 * are no values").
 */
const ReferenceMasterSnapshotContext = createContext<ReferenceMasterSnapshot | null>(null)

function ReferenceMasterSnapshotProvider({
  snapshot,
  children,
}: {
  snapshot: ReferenceMasterSnapshot
  children: React.ReactNode
}) {
  return <ReferenceMasterSnapshotContext.Provider value={snapshot}>{children}</ReferenceMasterSnapshotContext.Provider>
}

function useReferenceMasterSnapshot(): ReferenceMasterSnapshot {
  const snapshot = useContext(ReferenceMasterSnapshotContext)
  if (!snapshot) {
    throw new Error("useReferenceMasterSnapshot must be called within a ReferenceMasterSnapshotProvider")
  }
  return snapshot
}

export { ReferenceMasterSnapshotProvider, useReferenceMasterSnapshot }
