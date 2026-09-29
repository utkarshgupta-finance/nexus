import { describe, expect, it } from "vitest"

import { buildCustomerActivityTimeline, collectActorIds, buildAuditIndex, historicalActorLabel } from "./activity"
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
    revisionRowVersion: 1,
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
    workflowVersionId: null,
    currentWorkflowNodeKey: null,
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
    draftRowVersion: 1,
    createdBy: "actor-requester",
    createdAt: "2026-02-10T00:00:00.000Z",
    updatedAt: "2026-02-15T00:00:00.000Z",
    workflowVersionId: null,
    currentWorkflowNodeKey: null,
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
    actor_display_name_snapshot: null,
    actor_email_snapshot: null,
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
      auditIndex: new Map(),
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
      auditIndex: new Map(),
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
      auditIndex: new Map(),
    })
    expect(timeline[0].summary).toBe("Customer deactivated: Customer requested account closure")
  })

  it("prefers the historical actor_display_name_snapshot over the actor's current live-resolved name (Program 4 Hardening)", () => {
    const snapshotRow: AuditLogRow = { ...STATUS_AUDIT_ROWS[0], actor_display_name_snapshot: "Priya Shah (as of the event)" }
    const timeline = buildCustomerActivityTimeline({
      onboardingOrigin: null,
      changeRequests: [],
      fieldHistory: [],
      commercialVersions: [],
      statusAuditRows: [snapshotRow],
      actorLabels: ACTOR_EMAILS,
      referenceMasterSnapshot: emptySnapshot(),
      auditIndex: new Map(),
    })
    expect(timeline[0].actorEmail).toBe("Priya Shah (as of the event)")
  })

  it("falls back to the actor's current live-resolved name when no snapshot exists (a row written before this column existed)", () => {
    const timeline = buildCustomerActivityTimeline({
      onboardingOrigin: null,
      changeRequests: [],
      fieldHistory: [],
      commercialVersions: [],
      statusAuditRows: [STATUS_AUDIT_ROWS[0]],
      actorLabels: ACTOR_EMAILS,
      referenceMasterSnapshot: emptySnapshot(),
      auditIndex: new Map(),
    })
    expect(timeline[0].actorEmail).toBe("approver@example.com")
  })

  it("falls back to the actor_email_snapshot when neither a name snapshot nor a live-resolved name is available", () => {
    const row: AuditLogRow = { ...STATUS_AUDIT_ROWS[0], actor_email_snapshot: "priya@example.com" }
    const timeline = buildCustomerActivityTimeline({
      onboardingOrigin: null,
      changeRequests: [],
      fieldHistory: [],
      commercialVersions: [],
      statusAuditRows: [row],
      actorLabels: new Map(),
      referenceMasterSnapshot: emptySnapshot(),
      auditIndex: new Map(),
    })
    expect(timeline[0].actorEmail).toBe("priya@example.com")
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
      auditIndex: new Map(),
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
      auditIndex: new Map(),
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
      auditIndex: new Map(),
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
      auditIndex: new Map(),
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

describe("PG-058: point-in-time actor attribution for Customer Master Activity/History", () => {
  const APPROVAL_AUDIT_ROW: AuditLogRow = {
    id: "audit-cr-decided",
    resource_id: null,
    table_name: "customer_change_requests",
    row_id: "req-change-1",
    action: "UPDATE",
    before_value: { status: "submitted" },
    after_value: { status: "approved" },
    // Matches CHANGE_REQUESTS[0].decidedAt and FIELD_HISTORY[0].changedAt exactly:
    // both are set by the same `now()` inside the same real approval
    // transaction (verified against real data before this was built).
    occurred_at: "2026-02-01T00:00:00.000Z",
    actor_user_id: "actor-approver",
    request_id: null,
    actor_context: null,
    actor_display_name_snapshot: "Priya Shah (Approver, as of Feb 2026)",
    actor_email_snapshot: "approver@example.com",
  }

  describe("historicalActorLabel", () => {
    it("prefers the audit_log snapshot from the exact correlating row (table, row id, actor, timestamp all match)", () => {
      const index = buildAuditIndex([APPROVAL_AUDIT_ROW])
      const label = historicalActorLabel("customer_change_requests", "req-change-1", "actor-approver", "2026-02-01T00:00:00.000Z", index, ACTOR_EMAILS)
      expect(label).toBe("Priya Shah (Approver, as of Feb 2026)")
    })

    it("falls back to the actor's current live-resolved label when no correlating audit_log row exists", () => {
      const label = historicalActorLabel("customer_change_requests", "req-change-1", "actor-approver", "2026-02-01T00:00:00.000Z", new Map(), ACTOR_EMAILS)
      expect(label).toBe("approver@example.com")
    })

    it("falls back when the timestamp does not match any indexed row (a different, unrelated mutation on the same row/actor)", () => {
      const index = buildAuditIndex([APPROVAL_AUDIT_ROW])
      const label = historicalActorLabel("customer_change_requests", "req-change-1", "actor-approver", "2099-01-01T00:00:00.000Z", index, ACTOR_EMAILS)
      expect(label).toBe("approver@example.com")
    })

    it("returns null for a null actor id, never fabricating an attribution", () => {
      const index = buildAuditIndex([APPROVAL_AUDIT_ROW])
      expect(historicalActorLabel("customer_change_requests", "req-change-1", null, "2026-02-01T00:00:00.000Z", index, ACTOR_EMAILS)).toBeNull()
    })
  })

  describe("buildCustomerActivityTimeline", () => {
    it("shows the point-in-time snapshot name for 'Customer Change Request approved' and the field-change entry it produced, not the actor's current (renamed) live label", () => {
      const timeline = buildCustomerActivityTimeline({
        onboardingOrigin: null,
        changeRequests: CHANGE_REQUESTS,
        fieldHistory: FIELD_HISTORY,
        commercialVersions: [],
        statusAuditRows: [],
        // The actor's CURRENT live-resolved name has since changed (e.g. a
        // real display-name rename after the approval happened); the
        // historical events must still show the frozen name, not this one.
        actorLabels: new Map([["actor-approver", "Priya Shah (Renamed, current)"]]),
        referenceMasterSnapshot: emptySnapshot(),
        auditIndex: buildAuditIndex([APPROVAL_AUDIT_ROW]),
      })

      const decided = timeline.find((event) => event.summary === "Customer Change Request approved")
      const fieldChange = timeline.find((event) => event.summary.startsWith("Segment changed"))
      expect(decided?.actorEmail).toBe("Priya Shah (Approver, as of Feb 2026)")
      expect(fieldChange?.actorEmail).toBe("Priya Shah (Approver, as of Feb 2026)")
    })

    it("still live-resolves 'Customer Change Request created' when its own creation event has no correlating audit_log row in the index", () => {
      const timeline = buildCustomerActivityTimeline({
        onboardingOrigin: null,
        changeRequests: CHANGE_REQUESTS,
        fieldHistory: [],
        commercialVersions: [],
        statusAuditRows: [],
        actorLabels: ACTOR_EMAILS,
        referenceMasterSnapshot: emptySnapshot(),
        // Only the decision's own audit row is indexed; the creation event
        // (a different timestamp/action) has nothing to correlate against.
        auditIndex: buildAuditIndex([APPROVAL_AUDIT_ROW]),
      })

      const created = timeline.find((event) => event.summary === "Customer Change Request created")
      expect(created?.actorEmail).toBe("requester@example.com")
    })
  })
})
