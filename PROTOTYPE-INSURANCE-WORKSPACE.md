# Insurance Broker Workspace

This implementation turns a full-register insurance share into a private, broker-owned review workspace without changing the owner's asset register.

## Deploy

1. Apply `database/migrations/53-insurance-workspaces.sql` to PostgreSQL once.
2. Deploy the changed application files through the normal Next.js build and start flow.
3. Sign in with an active account whose account type is `insurance`.
4. Open `/shared-registers`.

The migration is idempotent. It creates workspace, asset-review, option-review, general-cover, audit-event, and immutable report-snapshot tables.

## Workflow

- The portfolio lists real full-register insurance shares received by the signed-in broker account.
- Opening a share creates one workspace from the immutable snapshot and normalises all shared assets into workspace rows.
- Owner facts are read-only. Broker fields, option decisions, recommendations, and notes are stored separately.
- The four tabs are Overview, Assets, General Covers, and Reports.
- Asset edits autosave to PostgreSQL, with an explicit Save and next action for rapid review.
- Safe bulk fields are insurer, policy number, policy section, and review status.
- Summary and detailed reports are generated on the server and stored as immutable, revisioned snapshots. Open a report and use the browser print dialog to save a PDF.

## Insurance configuration

Asset categories, policy-section choices, applicable cover options, general-cover definitions, and structured exclusion reasons live in `lib/insurance-option-config.ts`.

This configuration is generic across domestic, commercial, agricultural, transport, construction, and industrial clients. It uses common insurance terminology and does not reproduce insurer-specific policy wording.

## Permissions and advice boundary

- Every read and write is scoped to `broker_user_id` from the active server session.
- A broker can open only an insurance share addressed to that broker account.
- Request bodies cannot select an owner or broker identity.
- Every workspace write produces an audit event.
- Aim4price does not infer or generate insurance recommendations. The broker records all recommendations and rationale manually.
- Reports state that Aim4price does not provide financial advice or independently confirm insurance cover.
