import { describe, expect, it } from "vitest"

import { buildCustomerActivityTimeline, collectActorIds } from "./activity"
import type { OnboardingOrigin, CommercialConfigurationVersion } from "@/features/customer-onboarding/server"
import type { CustomerChangeRequest, CustomerFieldHistoryEntry } from "@/features/customer-change"
import type { AuditLogRow } from "@/platform/audit/server"
import { emptySnapshot } from "@/features/reference-data/domain/snapshot"

const ACTOR_EMAILS = new Map<string, string | null>([
  ["actor-approver", "approver@example.com"],
  ["actor-requester", "requester@example.com"],
])

const ORIGIN: OnboardingOrigin = {
  requestId: "req-onboarding-1",
  createdAt: "2026-01-01T00:00:00.000Z",
  createdBy: "actor-requester",
  approvedAt: "2026-01-05T00:00:00.000Z",
  approvedBy: "actor-approver",
}

const FIELD_HISTORY: CustomerFieldHistoryEntry[] = [
  {
    id: "fh-1",
    fieldKey: "segment",
    oldValue: "smb",
    newValue: "enterprise",
    effectiveDate: null,
    changeRequestId: "req-change-1",
    requestedBy: "actor-requester",
    approvedBy: "actor-approver",
    changedAt: "2026-02-01T00:00:00.000Z",
  },
]

const CHANGE_REQUESTS: CustomerChangeRequest[] = [
  {
    requestId: "req-change-1",
    requestNumber: 1,
    customerId: "customer-1",
    status: "approved",
    reason: null,
    effectiveDate: null,
    baseCustomerRowVersion: 1,
    proposedValues: {},
    requirements: [],
    sentBack: null,
    decidedBy: "actor-approver",
    decidedAt: "2026-02-01T00:00:00.000Z",
    decisionReason: null,
    cancelledBy: null,
    cancelledAt: null,
    cancelledReason: null,
    createdBy: "actor-requester",
    createdAt: "2026-01-20T00:00:00.000Z",
    updatedAt: "2026-02-01T00:00:00.000Z",
  },
]

const COMMERCIAL_VERSIONS: CommercialConfigurationVersion[] = [
  {
    requestId: "req-version-2",
    versionNumber: 2,
    commercialConfigurationId: "config-1",
    changeCategory: "amendment",
    status: "approved",
    reason: null,
    effectiveDate: "2026-03-01",
    commercialChangeId: "change-1",
    decidedBy: "actor-approver",
    decidedAt: "2026-02-15T00:00:00.000Z",
    decisionReason: null,
    cancelledBy: null,
    cancelledAt: null,
    cancelledReason: null,
    commercialRate: null,
    createdBy: "actor-requester",
    createdAt: "2026-02-10T00:00:00.000Z",
    updatedAt: "2026-02-15T00:00:00.000Z",
  },
]

const STATUS_AUDIT_ROWS: AuditLogRow[] = [
  {
    id: "audit-1",
    resource_id: null,
    table_name: "customers",
    row_id: "customer-1",
    action: "UPDATE",
    before_value: { is_active: true },
    after_value: { is_active: false },
    occurred_at: "2026-03-10T00:00:00.000Z",
    actor_user_id: "actor-approver",
    request_id: null,
    actor_context: null,
  },
]

describe("buildCustomerActivityTimeline", () => {
  it("builds a readable, actor-resolved, newest-first timeline from every source", () => {
    const timeline = buildCustomerActivityTimeline({
      onboardingOrigin: ORIGIN,
      changeRequests: CHANGE_REQUESTS,
      fieldHistory: FIELD_HISTORY,
      commercialVersions: COMMERCIAL_VERSIONS,
      statusAuditRows: STATUS_AUDIT_ROWS,
      actorLabels: ACTOR_EMAILS,
      referenceMasterSnapshot: emptySnapshot(),
    })

    expect(timeline.map((event) => event.summary)).toEqual([
      "Customer deactivated",
      "Commercial Version approved",
      "Commercial Version created",
      "Segment changed from \"smb\" to \"enterprise\"",
      "Customer Change Request approved",
      "Customer Change Request created",
      "Customer Onboarding approved: Customer Master created",
    ])
    expect(timeline.every((event) => event.actorEmail === "approver@example.com" || event.actorEmail === "requester@example.com")).toBe(true)
  })

  it("never invents an onboarding event for a customer created outside onboarding", () => {
    const timeline = buildCustomerActivityTimeline({
      onboardingOrigin: null,
      changeRequests: [],
      fieldHistory: [],
      commercialVersions: [],
      statusAuditRows: [],
      actorLabels: new Map(),
      referenceMasterSnapshot: emptySnapshot(),
    })
    expect(timeline).toEqual([])
  })

  it("includes the deactivation reason in the summary when audit_log carries one (task Phase I)", () => {
    const rowWithReason: AuditLogRow = { ...STATUS_AUDIT_ROWS[0], actor_context: { reason: "Customer requested account closure" } }
    const timeline = buildCustomerActivityTimeline({
      onboardingOrigin: null,
      changeRequests: [],
      fieldHistory: [],
      commercialVersions: [],
      statusAuditRows: [rowWithReason],
      actorLabels: ACTOR_EMAILS,
      referenceMasterSnapshot: emptySnapshot(),
    })
    expect(timeline[0].summary).toBe("Customer deactivated: Customer requested account closure")
  })

  it("ignores an audit row where is_active did not actually change", () => {
    const noOpRow: AuditLogRow = { ...STATUS_AUDIT_ROWS[0], before_value: { is_active: true }, after_value: { is_active: true } }
    const timeline = buildCustomerActivityTimeline({
      onboardingOrigin: null,
      changeRequests: [],
      fieldHistory: [],
      commercialVersions: [],
      statusAuditRows: [noOpRow],
      actorLabels: new Map(),
      referenceMasterSnapshot: emptySnapshot(),
    })
    expect(timeline).toEqual([])
  })

  it("resolves a governed field's old/new values to their Reference Master labels, never the raw code (task spec: display label cleanup)", () => {
    const snapshot = { ...emptySnapshot(), segment: [{ value: "smb", label: "SMB", active: true }, { value: "enterprise", label: "Enterprise", active: true }] }
    const timeline = buildCustomerActivityTimeline({
      onboardingOrigin: null,
      changeRequests: [],
      fieldHistory: FIELD_HISTORY,
      commercialVersions: [],
      statusAuditRows: [],
      actorLabels: ACTOR_EMAILS,
      referenceMasterSnapshot: snapshot,
    })
    expect(timeline[0].summary).toBe('Segment changed from "SMB" to "Enterprise"')
  })

  it("falls back to the raw code when a governed value is no longer a valid option (never crashes, never blanks it)", () => {
    const timeline = buildCustomerActivityTimeline({
      onboardingOrigin: null,
      changeRequests: [],
      fieldHistory: FIELD_HISTORY,
      commercialVersions: [],
      statusAuditRows: [],
      actorLabels: ACTOR_EMAILS,
      referenceMasterSnapshot: emptySnapshot(),
    })
    expect(timeline[0].summary).toBe('Segment changed from "smb" to "enterprise"')
  })

  it("never fabricates an actor email for an unresolved id", () => {
    const timeline = buildCustomerActivityTimeline({
      onboardingOrigin: ORIGIN,
      changeRequests: [],
      fieldHistory: [],
      commercialVersions: [],
      statusAuditRows: [],
      actorLabels: new Map(),
      referenceMasterSnapshot: emptySnapshot(),
    })
    expect(timeline[0].actorEmail).toBeNull()
  })
})

describe("collectActorIds", () => {
  it("collects every actor id referenced anywhere in the inputs", () => {
    const ids = collectActorIds({
      onboardingOrigin: ORIGIN,
      changeRequests: CHANGE_REQUESTS,
      fieldHistory: FIELD_HISTORY,
      commercialVersions: COMMERCIAL_VERSIONS,
      statusAuditRows: STATUS_AUDIT_ROWS,
    })
    expect(new Set(ids)).toEqual(new Set(["actor-approver", "actor-requester"]))
  })
})
