import path from "node:path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    // Several test files cold-load a dynamic `import(...)` module graph
    // inside the test body (a deliberate pattern proving a real module
    // boundary, e.g. `server-only` guards). 30000ms gives real headroom
    // over Vitest's 5000ms default without masking a genuine hang
    // (nothing in this suite legitimately runs anywhere close to that
    // long).
    testTimeout: 30000,
    // Root cause of the timeout above under a full-suite run: default
    // `isolate: true` spawns one fresh fork per test file (98 files here).
    // On a memory-constrained machine that starves whichever file happens
    // to spawn under peak contention, a different file each run, not a
    // real regression. Bounding worker count caps concurrent process
    // count to what the machine can actually run without thrashing.
    maxWorkers: 4,
  },
})
