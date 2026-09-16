/**
 * Nexus Workflow Runtime V1, Sequential Approval Execution: reusable
 * regression suite (supabase/migrations/20260925000000_workflow_runtime_v1_sequential_execution.sql).
 *
 * Calls the real governed RPCs directly with the service role key
 * (never a raw table mutation), exactly the same RPCs the Builder UI and
 * every approve/send-back/reject Server Action call, against the
 * Customer Change domain using the existing WF-TEST fixtures (Phase 3B):
 * teams wf_test_finance/wf_test_legal/wf_test_leadership, checkers
 * wf-test.finance-checker(-b)/legal-checker/leadership-approver, and
 * wf-test.maker.
 *
 * Builds two new versions on the existing "WF-TEST Finance then Legal
 * Sequential" workflow definition (already bound to applies_to =
 * customer_change and already the sole active workflow for that
 * context, per the Task 3 active-workflow-uniqueness migration):
 *   - a Decision + multi-length-branch version (never left "current":
 *     published, then immediately superseded by the plain sequential
 *     version below, so no future request in this environment can ever
 *     hit it by accident)
 *   - a plain Start -> Finance -> Legal -> Leadership -> End version,
 *     published last, so it is "current" for the rest of this run and
 *     any future work in this environment.
 * The existing published V1 (Start -> Finance -> Legal -> End) is left
 * untouched, used only to prove version binding (Journey F).
 *
 * Idempotent to run only in the sense that WF-TEST customers/change
 * requests it creates are fictional test data; re-running builds fresh
 * change requests each time (customer_change_requests has no unique
 * constraint blocking this) rather than reusing prior runs' rows.
 *
 * Usage: npx tsx --env-file=.env.local scripts/verify-workflow-runtime-sequential-execution.ts
 */

import { createClient } from "@supabase/supabase-js"

const TEAM = {
  finance: "9a53c69d-5f05-4d23-8490-18fd91e66a6c",
  legal: "9f719de7-bc11-46d2-b37b-c53377370e55",
  leadership: "93809dcf-fa71-4f03-a748-08b0dc6193bf",
}

const USER = {
  financeA: "cbfb7860-bcfe-41d4-9fc3-beca6dd4e916",
  financeB: "3d039bf0-ff5d-4b56-a64b-0366ca0c5fab",
  legal: "b78fa4e4-13fb-445b-9c25-5e65228321b1",
  leadership: "00d0779e-9304-40c0-8dd3-a187f9edf25a",
  maker: "ada9b48c-96f7-4de8-aa29-7f5517a5ee57",
  workflowAdmin: "46adf22f-8bfb-4ee3-aadb-1f706aa70410",
}

const CUSTOMER_ID = "ec93474a-bdea-481c-ba55-00d3cca06ac2" // Test Customer 1
const SECOND_CUSTOMER_ID = "8c6c8e3d-ecb2-4043-bfac-aa3b0aaa6635" // Northstar Consumer Products: a distinct customer so two change requests can be approved without one's approval bumping the other's base row_version out from under it
const EXISTING_DEFINITION_ID = "a167d59c-b1b3-47e8-807a-37ddd9a2c79c" // WF-TEST Finance then Legal Sequential

let pass = 0
let fail = 0
const failures: string[] = []

function assert(condition: unknown, message: string) {
  if (condition) {
    pass++
  } else {
    fail++
    failures.push(message)
    console.error(`FAIL: ${message}`)
  }
}

function ok(message: string) {
  console.log(`  ok: ${message}`)
}

async function main() {
  const url = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) {
    console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.")
    process.exitCode = 1
    return
  }
  const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })

  async function rpc<T = unknown>(name: string, params: Record<string, unknown>): Promise<{ data: T | null; error: { message: string } | null }> {
    const { data, error } = await supabase.rpc(name, params)
    if (error && process.env.DEBUG_RPC) console.error(`  [rpc ${name} error] ${error.message}`)
    return { data: data as T | null, error }
  }

  async function expectError(promise: Promise<{ data: unknown; error: { message: string } | null }>, tokenPrefix: string, label: string) {
    const { error } = await promise
    assert(error && error.message.startsWith(tokenPrefix), `${label} (expected ${tokenPrefix}, got ${error ? error.message : "no error"})`)
  }

  async function createAndSubmitChangeRequest(actorUserId: string, rawData: Record<string, unknown>, customerId: string = CUSTOMER_ID): Promise<string> {
    const requestId = crypto.randomUUID()
    const { error: createError } = await rpc("create_customer_change_request", {
      p_new_request_id: requestId,
      p_customer_id: customerId,
      p_initial_raw_data: rawData,
      p_actor_user_id: actorUserId,
    })
    if (createError) throw new Error(`create_customer_change_request failed: ${createError.message}`)
    const { error: submitError } = await rpc("submit_customer_change_request", {
      p_request_id: requestId,
      p_reason: "Workflow Runtime V1 sequential execution regression run",
      p_effective_date: "2026-12-01",
      p_requirements: [],
      p_actor_user_id: actorUserId,
    })
    if (submitError) throw new Error(`submit_customer_change_request failed: ${submitError.message}`)
    return requestId
  }

  async function getRow(requestId: string) {
    const { data, error } = await supabase.from("customer_change_requests").select("*").eq("request_id", requestId).single()
    if (error) throw new Error(`load customer_change_requests failed: ${error.message}`)
    return data as {
      status: string
      current_workflow_node_key: string | null
      workflow_cycle_number: number
      workflow_version_id: string
    }
  }

  async function getTransitions(requestId: string) {
    const { data, error } = await supabase
      .from("workflow_node_transitions")
      .select("*")
      .eq("domain", "customer_change")
      .eq("resource_id", requestId)
      .order("occurred_at", { ascending: true })
    if (error) throw new Error(`load workflow_node_transitions failed: ${error.message}`)
    return data as { from_node_key: string | null; to_node_key: string | null; action: string; actor_user_id: string; cycle_number: number }[]
  }

  console.log("=== Journey F (part 1): create a request bound to whichever version is currently published before this run adds any new ones ===")
  // Not hardcoded to EXISTING_V1_ID: a prior run of this same idempotent-ish
  // script may already have published extra versions on this definition
  // (published versions are never un-published), so "the old version" for
  // this run's own binding comparison is whichever one is actually latest
  // right now, not necessarily the original V1 fixture.
  const { data: latestPublishedBeforeThisRun, error: latestVersionError } = await supabase
    .from("workflow_definition_versions")
    .select("id")
    .eq("workflow_definition_id", EXISTING_DEFINITION_ID)
    .eq("status", "published")
    .order("version_number", { ascending: false })
    .limit(1)
    .single()
  if (latestVersionError || !latestPublishedBeforeThisRun) throw new Error(`load latest published version failed: ${latestVersionError?.message}`)
  const oldVersionId: string = latestPublishedBeforeThisRun.id

  const v1BoundRequestId = await createAndSubmitChangeRequest(USER.maker, { website: "https://v1-binding-check.example.test" })
  {
    const row = await getRow(v1BoundRequestId)
    assert(row.workflow_version_id === oldVersionId, "Request created before this run's new versions binds to whichever version was already published")
  }

  console.log("=== Setup: publish a Decision + multi-length-branch version, then a plain 3-approval sequential version ===")

  async function createPublishedVersion(nodes: Record<string, unknown>[], edges: Record<string, unknown>[]): Promise<string> {
    const { data: version, error: createVersionError } = await rpc<{ id: string; row_version: number }>("create_workflow_definition_version", {
      p_workflow_definition_id: EXISTING_DEFINITION_ID,
      p_actor_user_id: USER.workflowAdmin,
    })
    if (createVersionError || !version) throw new Error(`create_workflow_definition_version failed: ${createVersionError?.message}`)
    const { error: saveError } = await rpc("save_workflow_version_graph", {
      p_version_id: version.id,
      p_nodes: nodes,
      p_edges: edges,
      p_expected_row_version: version.row_version,
      p_actor_user_id: USER.workflowAdmin,
    })
    if (saveError) throw new Error(`save_workflow_version_graph failed: ${saveError.message}`)
    const { error: publishError } = await rpc("publish_workflow_definition_version", { p_version_id: version.id, p_actor_user_id: USER.workflowAdmin })
    if (publishError) throw new Error(`publish_workflow_definition_version failed: ${publishError.message}`)
    return version.id
  }

  function node(nodeKey: string, nodeType: string, name: string, teamId: string | null) {
    return { node_key: nodeKey, node_type: nodeType, name, responsible_team_id: teamId, required_resource: null, required_action: null, config: {}, position_x: 0, position_y: 0 }
  }
  function edge(fromKey: string, toKey: string, condition: Record<string, unknown> | null = null) {
    return { from_node_key: fromKey, to_node_key: toKey, label: null, condition }
  }

  const decisionVersionId = await createPublishedVersion(
    [
      node("node_1", "start", "Start", null),
      node("node_2", "decision", "Segment Decision", null),
      node("node_3", "approval", "Finance Approval (Enterprise)", TEAM.finance),
      node("node_4", "approval", "Legal Approval (Enterprise)", TEAM.legal),
      node("node_5", "approval", "Leadership Approval (Enterprise)", TEAM.leadership),
      node("node_6", "end", "End", null),
      node("node_7", "approval", "Finance Approval (SME)", TEAM.finance),
    ],
    [
      edge("node_1", "node_2"),
      edge("node_2", "node_3", { field: "segment", operator: "equals", value: "enterprise" }),
      edge("node_2", "node_7", { field: "segment", operator: "equals", value: "sme" }),
      edge("node_2", "node_7", null), // unconditioned fallback: this version is never left "current" (see header), but never leave a live Decision node without one regardless.
      edge("node_3", "node_4"),
      edge("node_4", "node_5"),
      edge("node_5", "node_6"),
      edge("node_7", "node_6"),
    ]
  )
  ok(`published Decision + multi-length-branch version ${decisionVersionId}`)

  console.log("=== Journey D: Decision + multi-Approval traversal, both branches, while the Decision version is current ===")
  const enterpriseRequestId = await createAndSubmitChangeRequest(USER.maker, { segment: "enterprise" })
  const smeRequestId = await createAndSubmitChangeRequest(USER.maker, { segment: "sme" }, SECOND_CUSTOMER_ID)
  {
    const enterpriseRow = await getRow(enterpriseRequestId)
    const smeRow = await getRow(smeRequestId)
    assert(enterpriseRow.workflow_version_id === decisionVersionId, "Enterprise-branch request binds to the Decision version")
    assert(enterpriseRow.current_workflow_node_key === "node_3", "Enterprise branch enters its own Finance node (node_3)")
    assert(smeRow.current_workflow_node_key === "node_7", "SME branch enters its own, distinct Finance node (node_7), never node_3")
  }
  // Enterprise: Finance -> Legal -> Leadership -> End (3 approvals)
  await rpc("approve_customer_change_request", { p_request_id: enterpriseRequestId, p_actor_user_id: USER.financeA })
  assert((await getRow(enterpriseRequestId)).current_workflow_node_key === "node_4", "Enterprise branch: Finance approval advances to Legal (node_4)")
  await rpc("approve_customer_change_request", { p_request_id: enterpriseRequestId, p_actor_user_id: USER.legal })
  assert((await getRow(enterpriseRequestId)).current_workflow_node_key === "node_5", "Enterprise branch: Legal approval advances to Leadership (node_5)")
  await rpc("approve_customer_change_request", { p_request_id: enterpriseRequestId, p_actor_user_id: USER.leadership })
  {
    const row = await getRow(enterpriseRequestId)
    assert(row.status === "approved", "Enterprise branch: Leadership approval finalizes the request (status = approved)")
    assert(row.current_workflow_node_key === "node_6", "Enterprise branch: current node lands on End (node_6) once approved")
  }
  // SME: Finance -> End (1 approval) -- "do not hardcode route length"
  await rpc("approve_customer_change_request", { p_request_id: smeRequestId, p_actor_user_id: USER.financeA })
  {
    const row = await getRow(smeRequestId)
    assert(row.status === "approved", "SME branch: a single Finance approval finalizes the request (shorter route, not hardcoded)")
    assert(row.current_workflow_node_key === "node_6", "SME branch: current node lands on the same End node (node_6)")
  }

  const sequentialVersionId = await createPublishedVersion(
    [
      node("node_1", "start", "Start", null),
      node("node_2", "approval", "Finance Approval", TEAM.finance),
      node("node_3", "approval", "Legal Approval", TEAM.legal),
      node("node_4", "approval", "Leadership Approval", TEAM.leadership),
      node("node_5", "end", "End", null),
    ],
    [edge("node_1", "node_2"), edge("node_2", "node_3"), edge("node_3", "node_4"), edge("node_4", "node_5")]
  )
  ok(`published plain sequential version ${sequentialVersionId} (now "current" for the rest of this run)`)

  console.log("=== Journey F (part 2): a new request now binds to the newly current sequential version, the old V1 request is untouched ===")
  {
    const newRequestId = await createAndSubmitChangeRequest(USER.maker, { website: "https://v3-binding-check.example.test" })
    const newRow = await getRow(newRequestId)
    assert(newRow.workflow_version_id === sequentialVersionId, "New request after publishing binds to the new current version, never an older one")
    const oldRow = await getRow(v1BoundRequestId)
    assert(oldRow.workflow_version_id === oldVersionId, "The earlier request's workflow_version_id is unchanged, never jumped forward to the new version")
  }

  console.log("=== Journey A: Start -> Finance -> Legal -> Leadership -> End, all approve ===")
  const journeyARequestId = await createAndSubmitChangeRequest(USER.maker, { website: "https://journey-a.example.test" })
  {
    const row = await getRow(journeyARequestId)
    assert(row.current_workflow_node_key === "node_2", "Journey A: submitted request's current node is Finance")
  }
  await rpc("approve_customer_change_request", { p_request_id: journeyARequestId, p_actor_user_id: USER.financeA })
  assert((await getRow(journeyARequestId)).current_workflow_node_key === "node_3", "Journey A: Finance approval advances to Legal")
  await rpc("approve_customer_change_request", { p_request_id: journeyARequestId, p_actor_user_id: USER.legal })
  assert((await getRow(journeyARequestId)).current_workflow_node_key === "node_4", "Journey A: Legal approval advances to Leadership")
  await rpc("approve_customer_change_request", { p_request_id: journeyARequestId, p_actor_user_id: USER.leadership })
  {
    const row = await getRow(journeyARequestId)
    assert(row.status === "approved", "Journey A: Leadership approval finalizes the request")
    const transitions = await getTransitions(journeyARequestId)
    assert(transitions.length === 4, `Journey A: exactly 4 transitions recorded (submit + 3 approvals), got ${transitions.length}`)
    assert(
      transitions.every((t, i) => t.action === (i === 0 ? "submit" : "approve")),
      "Journey A: transitions are submit then approve, approve, approve in order"
    )
    assert(transitions[3].to_node_key === "node_5", "Journey A: final transition's to_node_key is the End node")
  }

  console.log("=== Authorization: wrong team blocked at every node, self-approval blocked at every node ===")
  const authRequestId = await createAndSubmitChangeRequest(USER.maker, { website: "https://journey-auth.example.test" })
  await expectError(
    rpc("approve_customer_change_request", { p_request_id: authRequestId, p_actor_user_id: USER.legal }),
    "WORKFLOW_TEAM_REQUIRED",
    "Legal cannot approve while the request is sitting at the Finance node"
  )
  await expectError(
    rpc("approve_customer_change_request", { p_request_id: authRequestId, p_actor_user_id: USER.maker }),
    "SELF_APPROVAL_NOT_ALLOWED",
    "Maker cannot self-approve at the Finance node"
  )
  await rpc("approve_customer_change_request", { p_request_id: authRequestId, p_actor_user_id: USER.financeA })
  await expectError(
    rpc("approve_customer_change_request", { p_request_id: authRequestId, p_actor_user_id: USER.financeA }),
    "WORKFLOW_TEAM_REQUIRED",
    "Finance cannot approve again once the request has advanced to the Legal node"
  )
  await expectError(
    rpc("approve_customer_change_request", { p_request_id: authRequestId, p_actor_user_id: USER.maker }),
    "SELF_APPROVAL_NOT_ALLOWED",
    "Maker cannot self-approve at the Legal node either"
  )
  await rpc("approve_customer_change_request", { p_request_id: authRequestId, p_actor_user_id: USER.legal })
  await expectError(
    rpc("approve_customer_change_request", { p_request_id: authRequestId, p_actor_user_id: USER.legal }),
    "WORKFLOW_TEAM_REQUIRED",
    "Legal cannot approve again once the request has advanced to the Leadership node"
  )
  await rpc("approve_customer_change_request", { p_request_id: authRequestId, p_actor_user_id: USER.leadership })
  assert((await getRow(authRequestId)).status === "approved", "Authorization journey: request reaches approved once the correct team acts at each node in turn")

  console.log("=== Journey B: Finance approve -> Legal Send Back -> Maker edits+resubmits -> Finance must approve again -> Legal -> Leadership ===")
  const sendBackRequestId = await createAndSubmitChangeRequest(USER.maker, { website: "https://journey-b.example.test" })
  await rpc("approve_customer_change_request", { p_request_id: sendBackRequestId, p_actor_user_id: USER.financeA })
  assert((await getRow(sendBackRequestId)).current_workflow_node_key === "node_3", "Journey B: Finance approval advances to Legal before Send Back")
  await rpc("send_back_customer_change_request", { p_request_id: sendBackRequestId, p_reason: "Please clarify the effective date.", p_actor_user_id: USER.legal })
  {
    const row = await getRow(sendBackRequestId)
    assert(row.status === "sent_back", "Journey B: Legal Send Back sets status to sent_back")
    assert(row.current_workflow_node_key === null, "Journey B: Send Back clears the current node (nobody is the approver while the Maker owns it)")
    assert(row.workflow_cycle_number === 2, "Journey B: Send Back increments the workflow cycle number")
  }
  {
    const { data: revision, error: revisionError } = await supabase
      .from("submission_revisions")
      .select("id, row_version, raw_data")
      .eq("request_id", sendBackRequestId)
      .eq("status", "draft")
      .single()
    if (revisionError || !revision) throw new Error(`load draft revision failed: ${revisionError?.message}`)
    const { error: saveDraftError } = await rpc("save_customer_change_draft", {
      p_request_id: sendBackRequestId,
      p_raw_data: { ...(revision.raw_data as Record<string, unknown>), website: "https://journey-b-edited.example.test" },
      p_expected_row_version: revision.row_version,
      p_actor_user_id: USER.maker,
    })
    if (saveDraftError) throw new Error(`save_customer_change_draft failed: ${saveDraftError.message}`)
  }
  await rpc("submit_customer_change_request", {
    p_request_id: sendBackRequestId,
    p_reason: "Edited per Legal feedback",
    p_effective_date: "2026-12-01",
    p_requirements: [],
    p_actor_user_id: USER.maker,
  })
  {
    const row = await getRow(sendBackRequestId)
    assert(row.status === "resubmitted", "Journey B: resubmit sets status to resubmitted")
    assert(row.current_workflow_node_key === "node_2", "Journey B: resubmit restarts execution from the FIRST Approval node (Finance), not where it was sent back from")
    assert(row.workflow_cycle_number === 2, "Journey B: cycle number is unchanged by resubmit itself (only Send Back increments it)")
  }
  await expectError(
    rpc("approve_customer_change_request", { p_request_id: sendBackRequestId, p_actor_user_id: USER.legal }),
    "WORKFLOW_TEAM_REQUIRED",
    "Journey B: Legal cannot skip ahead and approve before Finance has re-approved post-restart"
  )
  await rpc("approve_customer_change_request", { p_request_id: sendBackRequestId, p_actor_user_id: USER.financeA })
  assert((await getRow(sendBackRequestId)).current_workflow_node_key === "node_3", "Journey B: Finance approves again (re-approval required after restart)")
  await rpc("approve_customer_change_request", { p_request_id: sendBackRequestId, p_actor_user_id: USER.legal })
  assert((await getRow(sendBackRequestId)).current_workflow_node_key === "node_4", "Journey B: Legal approves, advances to Leadership")
  await rpc("approve_customer_change_request", { p_request_id: sendBackRequestId, p_actor_user_id: USER.leadership })
  assert((await getRow(sendBackRequestId)).status === "approved", "Journey B: Leadership approves, request finalized")
  {
    const transitions = await getTransitions(sendBackRequestId)
    const sendBackTransition = transitions.find((t) => t.action === "send_back")
    assert(sendBackTransition?.cycle_number === 1, "Journey B: the Send Back transition itself is recorded under cycle 1 (the cycle that was ending)")
    const firstCycleApprovals = transitions.filter((t) => t.action === "approve" && t.cycle_number === 1)
    assert(firstCycleApprovals.length === 1, "Journey B: exactly one approval (Finance's) is recorded under cycle 1, still historically visible")
    const secondCycleApprovals = transitions.filter((t) => t.action === "approve" && t.cycle_number === 2)
    assert(secondCycleApprovals.length === 3, "Journey B: all 3 approvals of the restarted cycle are recorded under cycle 2")
  }

  console.log("=== Send Back from Leadership also restarts from the first Approval node ===")
  const sendBackFromLeadershipId = await createAndSubmitChangeRequest(USER.maker, { website: "https://journey-b-leadership.example.test" })
  await rpc("approve_customer_change_request", { p_request_id: sendBackFromLeadershipId, p_actor_user_id: USER.financeA })
  await rpc("approve_customer_change_request", { p_request_id: sendBackFromLeadershipId, p_actor_user_id: USER.legal })
  assert((await getRow(sendBackFromLeadershipId)).current_workflow_node_key === "node_4", "Send back from Leadership: request reaches the Leadership node first")
  await rpc("send_back_customer_change_request", { p_request_id: sendBackFromLeadershipId, p_reason: "Needs a leadership-level revision.", p_actor_user_id: USER.leadership })
  assert((await getRow(sendBackFromLeadershipId)).current_workflow_node_key === null, "Send back from Leadership: current node is cleared just like a send-back from any other node")
  {
    const { data: revision, error: revisionError } = await supabase
      .from("submission_revisions")
      .select("id, row_version, raw_data")
      .eq("request_id", sendBackFromLeadershipId)
      .eq("status", "draft")
      .single()
    if (revisionError || !revision) throw new Error(`load draft revision failed: ${revisionError?.message}`)
    await rpc("save_customer_change_draft", {
      p_request_id: sendBackFromLeadershipId,
      p_raw_data: { ...(revision.raw_data as Record<string, unknown>), website: "https://journey-b-leadership-edited.example.test" },
      p_expected_row_version: revision.row_version,
      p_actor_user_id: USER.maker,
    })
  }
  await rpc("submit_customer_change_request", {
    p_request_id: sendBackFromLeadershipId,
    p_reason: "Edited per Leadership feedback",
    p_effective_date: "2026-12-01",
    p_requirements: [],
    p_actor_user_id: USER.maker,
  })
  assert(
    (await getRow(sendBackFromLeadershipId)).current_workflow_node_key === "node_2",
    "Send back from Leadership: resubmit restarts from Finance, not from Leadership where it was sent back"
  )

  console.log("=== Journey C: reject is terminal at any Approval node, no partial truth applied, prior approvals stay visible ===")
  const rejectAtFinanceId = await createAndSubmitChangeRequest(USER.maker, { website: "https://journey-c-finance.example.test" })
  await rpc("reject_customer_change_request", { p_request_id: rejectAtFinanceId, p_reason: "Not approved.", p_actor_user_id: USER.financeA })
  {
    const row = await getRow(rejectAtFinanceId)
    assert(row.status === "rejected", "Journey C: Finance can reject directly at the first node")
    const { data: history } = await supabase.from("customer_field_history").select("id").eq("customer_change_request_id", rejectAtFinanceId)
    assert((history ?? []).length === 0, "Journey C: no customer_field_history row exists for a request rejected before any approval")
  }

  const rejectAtLegalId = await createAndSubmitChangeRequest(USER.maker, { website: "https://journey-c-legal.example.test" })
  await rpc("approve_customer_change_request", { p_request_id: rejectAtLegalId, p_actor_user_id: USER.financeA })
  await rpc("reject_customer_change_request", { p_request_id: rejectAtLegalId, p_reason: "Legal concerns.", p_actor_user_id: USER.legal })
  {
    const row = await getRow(rejectAtLegalId)
    assert(row.status === "rejected", "Journey C: Legal can reject after Finance already approved")
    const { data: history } = await supabase.from("customer_field_history").select("id").eq("customer_change_request_id", rejectAtLegalId)
    assert((history ?? []).length === 0, "Journey C: Finance's earlier approval never partially applied the proposed change to the Customer Master")
    const transitions = await getTransitions(rejectAtLegalId)
    assert(
      transitions.some((t) => t.action === "approve" && t.actor_user_id === USER.financeA),
      "Journey C: Finance's earlier approval remains historically visible in the transition log even after rejection"
    )
  }

  const rejectAtLeadershipId = await createAndSubmitChangeRequest(USER.maker, { website: "https://journey-c-leadership.example.test" })
  await rpc("approve_customer_change_request", { p_request_id: rejectAtLeadershipId, p_actor_user_id: USER.financeA })
  await rpc("approve_customer_change_request", { p_request_id: rejectAtLeadershipId, p_actor_user_id: USER.legal })
  await rpc("reject_customer_change_request", { p_request_id: rejectAtLeadershipId, p_reason: "Leadership concerns.", p_actor_user_id: USER.leadership })
  assert((await getRow(rejectAtLeadershipId)).status === "rejected", "Journey C: Leadership can reject after Finance and Legal both already approved")

  console.log("=== Journey E: concurrent checkers / idempotency ===")
  const raceRequestId = await createAndSubmitChangeRequest(USER.maker, { website: "https://journey-e.example.test" })
  const raceRow = await getRow(raceRequestId)
  await rpc("approve_customer_change_request", { p_request_id: raceRequestId, p_actor_user_id: USER.financeA, p_expected_current_node_key: raceRow.current_workflow_node_key })
  assert((await getRow(raceRequestId)).current_workflow_node_key === "node_3", "Journey E: checker A's approval succeeds and advances the node")
  await expectError(
    rpc("approve_customer_change_request", { p_request_id: raceRequestId, p_actor_user_id: USER.financeB, p_expected_current_node_key: raceRow.current_workflow_node_key }),
    "WORKFLOW_NODE_ALREADY_ADVANCED",
    "Journey E: checker B's approval, still expecting the old Finance node, is rejected with a clear already-advanced error, not a silent double-advance"
  )
  await expectError(
    rpc("approve_customer_change_request", { p_request_id: raceRequestId, p_actor_user_id: USER.financeB }),
    "WORKFLOW_TEAM_REQUIRED",
    "Journey E: checker B's approval without an expected node still correctly fails (node is now Legal, checker B is Finance-only)"
  )
  {
    const transitions = await getTransitions(raceRequestId)
    const approvals = transitions.filter((t) => t.action === "approve")
    assert(approvals.length === 1, `Journey E: exactly one approve transition recorded despite the race (next node created/activated exactly once), got ${approvals.length}`)
  }
  await rpc("approve_customer_change_request", { p_request_id: raceRequestId, p_actor_user_id: USER.legal })
  await rpc("approve_customer_change_request", { p_request_id: raceRequestId, p_actor_user_id: USER.leadership })
  {
    const beforeRow = await getRow(raceRequestId)
    assert(beforeRow.status === "approved", "Journey E: request reaches approved normally after the race is resolved")
    const { error: repeatError } = await rpc("approve_customer_change_request", { p_request_id: raceRequestId, p_actor_user_id: USER.leadership })
    assert(!repeatError, "Journey E: re-approving an already-approved request is a safe idempotent no-op, not an error")
    const afterRow = await getRow(raceRequestId)
    assert(afterRow.status === "approved" && afterRow.current_workflow_node_key === beforeRow.current_workflow_node_key, "Journey E: the idempotent re-approve call does not change any state")
  }

  console.log("=== Journey G: active workflow uniqueness ===")
  {
    const throwawayCode = `wf_test_throwaway_${Date.now()}`
    const { data: throwawayDefinition, error: createDefError } = await rpc<{ id: string; is_active: boolean }>("create_workflow_definition", {
      p_code: throwawayCode,
      p_name: "WF-TEST Throwaway Active-Uniqueness Check",
      p_applies_to: "customer_change",
      p_actor_user_id: USER.workflowAdmin,
    })
    if (createDefError || !throwawayDefinition) throw new Error(`create_workflow_definition failed: ${createDefError?.message}`)
    assert(throwawayDefinition.is_active === false, "Journey G: a new definition for a context that already has an active workflow is created inactive, never silently claiming the slot")

    await expectError(
      rpc("set_workflow_definition_active", { p_definition_id: throwawayDefinition.id, p_is_active: true, p_actor_user_id: USER.workflowAdmin }),
      "WORKFLOW_DEFINITION_NO_PUBLISHED_VERSION",
      "Journey G: activating a definition with no published version at all is rejected"
    )

    const { data: throwawayVersion, error: createVersionError } = await rpc<{ id: string; row_version: number }>("create_workflow_definition_version", {
      p_workflow_definition_id: throwawayDefinition.id,
      p_actor_user_id: USER.workflowAdmin,
    })
    if (createVersionError || !throwawayVersion) throw new Error(`create_workflow_definition_version failed: ${createVersionError?.message}`)
    await rpc("save_workflow_version_graph", {
      p_version_id: throwawayVersion.id,
      p_nodes: [node("node_1", "start", "Start", null), node("node_2", "end", "End", null)],
      p_edges: [edge("node_1", "node_2")],
      p_expected_row_version: throwawayVersion.row_version,
      p_actor_user_id: USER.workflowAdmin,
    })
    await rpc("publish_workflow_definition_version", { p_version_id: throwawayVersion.id, p_actor_user_id: USER.workflowAdmin })

    const { error: conflictError } = await rpc("set_workflow_definition_active", { p_definition_id: throwawayDefinition.id, p_is_active: true, p_actor_user_id: USER.workflowAdmin })
    assert(
      conflictError?.message.startsWith("WORKFLOW_DEFINITION_CONTEXT_ALREADY_ACTIVE") && conflictError.message.includes("WF-TEST Finance then Legal Sequential"),
      `Journey G: activating a second workflow for the same context is blocked, naming the currently active one by name (got: ${conflictError?.message})`
    )

    const { error: replaceError } = await rpc("replace_active_workflow_definition", { p_new_definition_id: throwawayDefinition.id, p_actor_user_id: USER.workflowAdmin })
    assert(!replaceError, `Journey G: the governed replacement path swaps the active workflow atomically without requiring database intervention (error: ${replaceError?.message})`)

    const { data: definitionsAfterReplace } = await supabase.from("workflow_definitions").select("id, is_active").in("id", [EXISTING_DEFINITION_ID, throwawayDefinition.id])
    const byId = new Map((definitionsAfterReplace ?? []).map((d) => [d.id, d.is_active]))
    assert(byId.get(throwawayDefinition.id) === true, "Journey G: the new definition is active after replacement")
    assert(byId.get(EXISTING_DEFINITION_ID) === false, "Journey G: the old definition is deactivated after replacement")

    const oldRow = await getRow(v1BoundRequestId)
    assert(oldRow.workflow_version_id === oldVersionId, "Journey G: deactivating the old workflow does not disturb a request already bound to one of its versions")

    const { error: revertError } = await rpc("replace_active_workflow_definition", { p_new_definition_id: EXISTING_DEFINITION_ID, p_actor_user_id: USER.workflowAdmin })
    assert(!revertError, `cleanup: restore "WF-TEST Finance then Legal Sequential" as the active workflow for customer_change (error: ${revertError?.message})`)
  }

  console.log(`\n${pass} passed, ${fail} failed.`)
  if (fail > 0) {
    console.log("\nFailures:")
    for (const message of failures) console.log(`  - ${message}`)
    process.exitCode = 1
  }
}

main()
