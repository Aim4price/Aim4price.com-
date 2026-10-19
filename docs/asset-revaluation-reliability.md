# Asset revaluation reliability

## Stage 3: transactional persistence

Both tractor and generic revaluation calculate from a saved asset snapshot outside
of a database transaction. Previews remain read-only.

A saved calculation enters `saveAssetRevaluation`, which starts a transaction,
locks the owner-scoped asset row, and checks that its revision still matches the
snapshot. Missing assets, manual valuations and stale revisions are rejected
before inserting a valuation run.

The valuation-run insert, asset update and depreciation-log insert all use the
same transaction connection. A failure rolls back these writes together. A
transactional history error propagates to the caller; existing nontransactional
history callers retain their previous best-effort behaviour. The lock remains
held until commit or rollback. Connections whose rollback fails are discarded.

The calculation formula, approved-value baseline, replacement-price/extras
handling and VAT basis are unchanged. This stage does not introduce automatic
triggers or alter manual valuations.

## Verification

`tests/asset-revaluation-save.test.cjs` exercises commit and rollback using an
embedded PostgreSQL database, rejects results based on a superseded revision,
checks owner scope/manual safeguards and verifies history error propagation.
`tests/approved-value-baseline.test.cjs` checks that previews write nothing and
that both engines pass the same transaction through their persistence helpers.
These tests do not substitute for production PostgreSQL concurrency testing.

## Following stages

- Persist update intents with request identity and input revision before enabling
  automatic route integration. Repeated requests must not create duplicate jobs.
- Implement bounded retries against the latest asset inputs, with visible pending
  and failed status. Do not retry an old computed value after a revision conflict.
- Cover replacement-price and recoverable legacy-input changes in stale detection.
- Connect owner, shared, QR/offline and fuel routes while preserving permission
  checks, explicit usage corrections and historical-record semantics.
- Keep Saleability assessments separate and mark outdated assessments for review.
- Add annual refresh and the optional walkthrough as separate changes.

A repeated *computed result* from the same asset revision is rejected today.
End-to-end request deduplication and durable background retries are not yet
implemented by this stage. Ordinary edits still use the existing update paths.
