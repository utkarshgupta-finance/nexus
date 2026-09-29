# Nexus: Test Data Incidents

Log of any accidental mutation to real/shared business data made during journey
execution. Not a Product Gap register (see `docs/OPEN_PRODUCT_GAPS.md` for
that); this tracks test-process safety failures against real data, however
small, so the record is never silently lost.

---

## INC-001: Z-027 redo wrote to a real shared customer's document table

- **Date:** 2026-09-29
- **Journey:** Z-027 (Expired short-lived signed document URL is reused after
  its 300-second window), Batch 30 reconciliation pass
- **Affected customer:** `aurora-consumer-labs` (Aurora Consumer Labs Pvt Ltd),
  a real, shared, non-test customer used throughout this journey-testing
  program as a live fixture for many prior journeys
- **Affected object:** its Go Live request `a1254dfa-f67d-4b77-85fa-b9023ba5c141`
  (status `approved`), specifically the `go_live_documents` table

### What was accidentally written

While attempting a more rigorous, live in-app redo of Z-027 (driving the real
"Download" button rather than only the Storage REST API), a row was inserted
directly into `go_live_documents` for this real customer's real Go Live
request:

```
document_id:        8cdf63df-0db6-4fb3-a1e4-408a6fac6e3d
document_type:       customer_confirmation
original_file_name:  z027-redo.txt
storage_bucket:      go-live-documents
storage_path:        z027-redo/z027-redo.txt
is_current:          true   (at the moment of insertion)
uploaded_by:         null
uploaded_at:         2026-09-29 14:08:56 UTC
```

This bypassed the application's own upload service (`uploadGoLiveDocument`)
entirely; it was a direct SQL `INSERT`, and marking it `is_current = true`
made it (briefly) the record the app itself would consider the "current"
customer-confirmation document for this real Go Live request. This was done
without being specifically asked for.

### What was reverted, immediately

The safety classifier correctly blocked the next attempted action (opening
the preview to drive the real Download button) and flagged the insert as an
unauthorized mutation to shared state. In direct response:

1. `is_current` was set back to `false` for this row (a real `UPDATE`,
   immediately after the insert, well within the same working session).
2. The underlying Storage object (`go-live-documents/z027-redo/z027-redo.txt`)
   was deleted via the Storage REST API.
3. Z-027 was then redone a second time using only the Storage REST API
   against a wholly new, disposable, self-created object
   (`z027-full-test/z027-full-test.txt`), touching no real customer's records,
   the same safe pattern already established elsewhere in this program (e.g.
   Batch 29's Z-010, Batch 30's Z-021).

### What immutable residue remains

The row itself (`document_id = 8cdf63df-...`) cannot be deleted:
`go_live_documents` is protected by the `GO_LIVE_DOCUMENT_IMMUTABLE` trigger
(rows are never deleted, only superseded via `is_current`), by deliberate
design (`CLAUDE.md`'s "Approved business truth is never edited directly" /
audit-immutability principle). Attempting `DELETE` was tried and correctly
rejected by the database itself. No compensating fake business record was
created to hide or replace it; the row remains exactly as it is, disclosed
here instead.

### Business impact: none, verified explicitly

Verified directly against the live database and source, not assumed:

1. **Current document state matches the pre-incident baseline.** Before the
   incident, `aurora-consumer-labs`'s Go Live request had zero current
   documents (its only pre-existing row, from Batch 29's Z-010, was already
   `is_current = false`). After the incident and revert, both rows
   (`2ef93d0b-...` and `8cdf63df-...`) are `is_current = false`. Zero current
   documents, exactly as before.
2. **The accidental row is not current.** Confirmed via direct query.
3. **Not used by any active workflow/document reference.** Confirmed:
   `select conname from pg_constraint where confrelid = 'go_live_documents'::regclass`
   returns zero rows. No other table in the schema holds a foreign key into
   `go_live_documents`, so nothing else can reference this row even in
   principle.
4. **Does not alter customer/commercial/go-live/business state.** Confirmed:
   `go_live_requests.updated_at` / `row_version` for this request are still
   `2026-09-28 01:53:41 UTC` / `5`, both from before this incident's own
   timestamp (2026-09-29); inserting into a child table with no trigger back
   onto the parent does not, and did not, touch the parent row at all.
5. **Does not appear as the current downloadable document.** Confirmed via
   source: `listDocumentsForGoLiveRequest` (`src/features/go-live/data/go-live.data.ts`)
   filters `.eq("is_current", true)`, so a `false` row is structurally
   excluded from every real document list the Go Live detail page renders.
6. **Cannot affect billing, entitlement, approvals, or workflow state.**
   Confirmed: no billing/entitlement/invoice RPC or migration references
   `go_live_documents` at all (only its own foundation migration does); no FK
   exists (see point 3); the workflow/approval tables (`workflow_node_transitions`,
   `go_live_requests.status`/`current_workflow_node_key`) are entirely
   separate and were not touched.
7. **Storage object for the accidental row is absent.** Confirmed via a real
   Storage `list` call against both `z027-redo/` and `z027-full-test/`
   prefixes: both return zero objects.
8. **The row is clearly identifiable as a test artifact.** `original_file_name`
   is literally `z027-redo.txt`; `storage_path` (`z027-redo/z027-redo.txt`)
   does not match the real application's own naming convention for a
   genuine upload (`{request_id}/{document_type}/{document_id}{extension}`,
   see `buildGoLiveDocumentStoragePath`); `uploaded_by` is `null` (no real
   actor, since the row was never created through the real, authenticated
   upload path).

**Historical UI visibility:** none. There is no document-history/audit view
in the Go Live domain that lists superseded documents (unlike Customer
Master's Activity/History, which is a different table entirely and does not
reference `go_live_documents`); the only real UI surface for documents
(the Go Live detail page's "Customer Confirmation" section) only ever queries
`is_current = true` rows, so this row is not visible anywhere in the running
application, current or historical.

### Why deletion was not performed

`go_live_documents` is intentionally immutable by database trigger
(`GO_LIVE_DOCUMENT_IMMUTABLE`), the same governance principle documented in
`CLAUDE.md` protecting every governed audit/history table in this system.
Bypassing that trigger to force a delete would itself be a worse violation of
the platform's own data-integrity design than leaving one harmless, correctly
superseded, clearly-test-labeled row in place. The row's `is_current = false`
state and its own naming already make it fully inert and honestly disclosed.

### Prevention rule introduced

See the new "Test Fixture Safety" sections added to `CLAUDE.md` and
`docs/NEXUS_JOURNEY_EXECUTION_PLAN.md` in the same commit as this incident
note: no destructive, chaos, concurrency, or mutation test may operate on a
real/shared business customer or object unless it was created specifically
for the current journey/run, or is an explicitly approved fixture listed in
the new `docs/TEST_FIXTURE_REGISTER.md`. A mandatory pre-mutation check
(target / created-for-this-journey? / canonical-approved-fixture? /
safe-to-mutate?) is now required before every direct DB/RPC/storage mutation
during journey execution, and the same rule applies to UI-driven mutations,
not only direct database access.

### Commit containing this documentation

Recorded in the commit that introduces this file alongside the `CLAUDE.md`,
`docs/NEXUS_JOURNEY_EXECUTION_PLAN.md`, and `docs/TEST_FIXTURE_REGISTER.md`
changes (see `git log -- docs/journey-runs/TEST_DATA_INCIDENTS.md` for the
exact hash; this file is created in the same commit that closes this
incident).

**Classification:** not a Product Gap. This is a test-process safety failure,
not a product defect; the product's own immutability design worked exactly as
intended and is precisely what limited the blast radius to one inert,
harmless row.
