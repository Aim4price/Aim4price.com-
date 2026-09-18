# Daily assisted capture allowances

Each account receives 10 Cost Ledger invoice submissions and 10 Fuel Ledger slip submissions per South African calendar day. The ledgers have independent allowances. Multiple photos of the same invoice are combined into one submission by the existing upload flow. Each submission must represent one invoice or slip; document contents are not automatically inspected for bundled unrelated invoices.

Manual ledger entry and manual attachments do not use these allowances. Verified Aim4price Admin sessions, including Admin support sessions inside customer accounts, bypass the allowance and are attributed to the actual Admin in capture audit events. Customer staff with an account “admin” role do not receive this bypass. Existing Admin work-time recording remains in place.

The creation transaction serializes allowance consumption per account and ledger using a PostgreSQL advisory lock. Failed creation rolls back usage; failed file attachment releases it. Retraction does not reset usage. Dealer and accountant submissions count against the destination account. Public Invoice Drop submissions with a resolved owner use that owner's Cost allowance; unmatched public submissions remain in the existing Admin matching queue because no account can yet be charged.

On reaching the limit, the upload flow displays the standard Aim4price assistance modal. An account/actor/ledger/day record distinguishes the modal being shown from the customer actually requesting help. Requesting assistance does not authorize paid work or unlock uploads. The original 24-hour capture wording is unchanged. The modal refreshes its allowance at the South African midnight boundary.

Admin → Capture Queue → Capture limits & assistance shows account/contact, ledger, first modal display, request time, notes and follow-up status. Requested help is prioritized, with an awaiting-contact count and 30-second refresh while the page is visible. Admin can mark followed up or reopen, include completed follow-ups, and paginate. This notification is in the capture queue; it does not send external email.

## Deployment

Migration 108 creates two tables and an index. The server also initializes the same schema idempotently, matching existing application table-initialization conventions. Deployments whose database role cannot create tables must apply the migration before enabling this code. No production migration or data changes were performed during development. Usage begins for new submissions after deployment; historical captures are not backfilled. Both tables cascade on deletion of the associated authentication account.

## Validation

Behaviour tests exercise separate limits, transaction rollback, concurrent attempts (PGlite serializes test transactions; production uses the advisory lock), South African dates, failed-intake refunds, idempotent tracking, account deletion, Admin identity and access scoping. Browser checks cover desktop/mobile modal geometry and the assistance request error/retry/success flow. TypeScript checking passes.

The existing admin-capture-usage-update test contains an assertion for the sentence “Completing the ledger record does not update usage. Only this button does.” That sentence is already absent from the base branch. The behaviour assertions about explicit usage updates still pass; this unrelated stale-copy assertion is left unchanged.
