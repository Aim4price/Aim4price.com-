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

## Stage 4: automatic current-input updates

Production startup installs migration 140 before starting the internal worker.
There is no public worker endpoint and no additional cron secret. The worker polls
at five-second intervals on the existing long-running Node/Railway service. It
processes up to five assets per batch; this is eventual updating, not a guarantee
that every value changes within five seconds under load.

A database trigger records changed current usage, year, condition, replacement
price and supported calculation-setting fields in an outbox in the same
transaction as the input change. This covers owner/dealer app edits, website
edits, shared edits, QR/offline updates, fuel writes and explicit assisted-capture
usage updates. Historical records alone do not enqueue work. Existing flagged
calculated assets are recovered at installation; manual assets are excluded.

One job per asset coalesces repeated changes. A new input change resets retry
state and invalidates an older claim. Workers claim jobs using `SKIP LOCKED` with
a two-minute lease, reread the latest asset, and use the stage-3 atomic save.
Successful persistence clears the queue in that same transaction. A lost response
after commit cannot repeat a queued save. A crash before commit leaves the job
recoverable after its lease expires. Five unsuccessful attempts stop automatic
retries and leave a visible Retry update action. Retry delays start at 30 seconds
and double; new input changes create a fresh attempt cycle.

The register and owner summary distinguish queued, retrying and failed values,
label the old amount as the previous value, and refresh while work is pending.
The owner app does not refresh editing drafts. Saleability assessments stay saved
separately; their existing basis comparison marks outdated results for review.

Ordinary owner edits lock the asset and preserve calculated values/approved
anchors. QR writes also lock the asset before comparing readings. Delayed offline
scans remain in history without overwriting newer current readings, condition,
fuel or location; current-reading decreases still require a correction path.
The revalue endpoint enforces trusted origin and owner-app asset/manage scope.

Operational requirements: apply the existing depreciation-history schema and
run a persistent Node service. `AIM4PRICE_AUTOMATIC_VALUATIONS_DISABLED=1` stops the
worker for incident response; installed triggers continue capturing work. No
production deployment or live database change is performed by this PR.

Remaining stages: a richer status/history experience if needed, Saleability
history UX, annual refresh/notification and the optional valuation walkthrough.
Direct explicit revalue HTTP requests do not yet have client request-id replay
semantics; queued automatic recalculations are coalesced and revision protected.
