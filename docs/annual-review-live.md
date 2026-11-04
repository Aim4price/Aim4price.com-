# Live annual asset review

The live route is `/annual-review`. An asset-register notice opens it for active full owner and dealer accounts, across all registers owned by that account. Shared links, installed staff-app sessions and other account types cannot apply account-wide changes. The existing `/admin/annual-review` remains a read-only simulation.

## Calendar and completion

The first review opens on 1 January 2027 at 00:00 Africa/Johannesburg. The server derives the year, so users cannot select a future year or bypass the opening date. Every following January starts a new review. No scheduler, email or automatic price write is involved: availability is checked on visits and every minute while the asset register is open. The reminder can be dismissed while leaving a link to reopen the review.

A completion receipt has a unique account/year key. Both confirming changes and confirming “keep unchanged” finish the current year. Repeated requests return the completed status without applying values again. Accounts can return later in the year until they complete their review.

## Calculation and saving

The existing eligibility rules exclude manual valuations, unknown age, fixed depreciation overrides, missing valuation dates, valuations already current for the review year, missing replacement prices and unverified extras. The percentage is applied to the asset-only replacement price. Saved extras are included once and their replacement prices stay unchanged. Usage is not increased. Estimated asset values are recalculated using the review year and existing Aim4price valuation rules, including approved value baselines.

“No, keep unchanged” saves only the annual completion receipt. A 0% adjustment through the “Yes” path still recalculates eligible asset values for the current year.

The server obtains account identity from the session, validates the request origin and percentage, locks the account review and its asset rows, verifies the complete eligible asset set and revisions, and recalculates before accepting the submitted preview values. Valuation runs, asset updates, existing valuation history and the annual receipt commit in one transaction. Any mismatch or failure rolls everything back. No client-supplied value is written directly. The receipt stores the before/after amounts and valuation-run IDs for audit.

Annual eligibility is separate from inclusion in register or combined totals. Value-inclusion switches continue to control aggregation; they do not make an otherwise eligible asset a manual valuation.

## Deployment

`npm start` invokes `prestart`, which runs `scripts/migrate-annual-review.mjs`. It applies the idempotent `151-annual-asset-reviews.sql` migration under a schema lock and stops startup on failure. Deployments using a custom command that bypasses `npm start` must run this migration before serving the live route. Local development can run `node scripts/migrate-annual-review.mjs` with database environment variables set.

## Validation

The annual-review workflow runs calendar, input validation, ownership, transactional persistence, rollback, stale-preview, repeat-submission and unchanged-choice tests. Browser fixtures cover both admin simulation and live confirmation at desktop and mobile widths without touching production accounts.
