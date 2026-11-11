# Isolated Aim4price Manager QA

Run `npm ci`, then `npm run test:manager-qa` from a clean checkout.

The runner starts the real Next.js application against a fresh, disposable PGlite database over PostgreSQL's wire protocol. It seeds five synthetic Manager logins from the shared desktop permission templates: View only, Operator, Workshop, Office and Manager. Passwords and signing secrets are generated for each run. No authentication bypass or production account is used.

The fixture contains one assigned tractor and three unassigned assets (active, retired and QR-deleted). Tests cover real password authentication, scoped lists and direct URLs, financial response redaction, permitted usage writes, denied writes, stale edits, permission removal, account deactivation and unchanged financial values. Browser checks submit the actual login form, use the real mobile detail pages and styles, and save permitted usage edits back to the database at 320px and 393px, including blur placeholders and disabled uploads. Chromium runs with web security enabled so browser Origin checks are exercised normally; the package default `--disable-web-security` is deliberately removed.

`npm run dev:manager-qa` starts the same environment for manual exploration. Its terminal output identifies the local URL and a private temporary JSON file containing the synthetic logins. Stop with Ctrl+C. The database is discarded and the credential file removed. Do not publish the credential file.

The launcher refuses checkouts containing `.env` files and passes only explicitly constructed local configuration to Next.js. It never accepts an external database URL. No live customer database, payment, email or storage credentials are inherited. Logs and synthetic screenshots remain in the temporary directory printed by the runner.

## Boundaries

This is repeatable local/CI regression coverage, not a hosted staging deployment or a guarantee that every production flow works. PGlite is not a production PostgreSQL concurrency/load test. The base fixture intentionally includes only the catalogue/schema fields needed by these flows; runtime schema initializers remain real. Production desktop permission editing, live QR camera scanning, physical device/offline behavior, storage uploads, fuel and maintenance submission still need separate end-to-end coverage. The inactive assets are outside the assigned scope here; lifecycle filtering within an assigned scope is covered by the operational-asset tests, not this scenario.

The app design and production routes are not replaced by test pages. Any future feature should extend this suite with realistic data and explicit allowed/denied assertions.
