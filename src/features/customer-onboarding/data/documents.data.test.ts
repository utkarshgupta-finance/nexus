import { describe, expect, it, vi, beforeEach } from "vitest"

/**
 * Real data-layer test (Platform Operating Expansion, Phase A): proves
 * `listDocumentsForRevision` actually joins the revision snapshot back
 * to document metadata, not just that the query chain compiles. This
 * file has no `server-only` guard of its own, so it can be imported
 * directly once its one dependency, `getSupabaseServiceRoleClient`, is
 * mocked away.
 */

const fromMock = vi.fn()

vi.mock("@/lib/supabase/server-client", () => ({
  getSupabaseServiceRoleClient: () => ({ from: fromMock }),
}))

beforeEach(() => {
  fromMock.mockReset()
})

describe("listDocumentsForRevision", () => {
  it("returns nothing, and never queries documents, when the revision has no snapshot rows", async () => {
    const { listDocumentsForRevision } = await import("./documents.data")
    fromMock.mockReturnValueOnce({
      select: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) }),
    })

    const result = await listDocumentsForRevision("r1", 1)

    expect(result).toEqual([])
    expect(fromMock).toHaveBeenCalledTimes(1)
  })

  it("reconstructs the exact documents that backed a specific revision via the snapshot table, independent of current is_current state", async () => {
    const { listDocumentsForRevision } = await import("./documents.data")
    fromMock
      .mockReturnValueOnce({
        select: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: [{ document_id: "doc-1" }, { document_id: "doc-2" }], error: null }) }) }),
      })
      .mockReturnValueOnce({
        select: () => ({
          in: (_column: string, ids: string[]) =>
            Promise.resolve({
              data: ids.map((id) => ({ document_id: id, is_current: id === "doc-2" })),
              error: null,
            }),
        }),
      })

    const result = await listDocumentsForRevision("r1", 1)

    expect(result.map((row) => row.document_id)).toEqual(["doc-1", "doc-2"])
    // The whole point: doc-1 is returned even though it is no longer
    // is_current, because it is what THIS revision actually had.
    expect(result.find((row) => row.document_id === "doc-1")?.is_current).toBe(false)
  })
})
