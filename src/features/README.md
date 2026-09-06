# features/

One folder per business feature (e.g. `customers`, `registration`,
`commercial-terms`, `go-live`, `entitlement-ledger`). Nothing lives here yet.
Features are added one at a time, in later steps.

Each feature folder is expected to be self-contained:

```
features/<feature-name>/
  components/   -- feature-specific UI, not reused elsewhere
  domain/        -- business/domain logic, validation
  data/          -- data access for this feature
  types.ts
```

Rules:

- A feature must not import another feature's internals directly. Shared
  behaviour belongs in `platform/`, not copy-pasted or cross-imported.
- If a component built for one feature turns out to be needed by another,
  promote it to `components/product/`, don't import it across features.

See `docs/ARCHITECTURE.md` for the full rationale.
