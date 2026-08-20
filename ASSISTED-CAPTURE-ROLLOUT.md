# Aim4price Assisted Capture rollout

This change replaces the automatic invoice and fuel-slip readers with a 24-hour, Aim4price-verified capture workflow. Pending documents never count as financial records. Owner/accountant uploads become ledger records only after an admin verifies them; public/dealer contributions also require the asset owner's approval.

## Deployment order

1. Back up the production database.
2. Confirm migrations 80–82 are already applied, then apply `database/migrations/83-assisted-document-capture.sql` followed by `database/migrations/84-assisted-capture-file-lifecycle.sql`.
3. Configure the environment values below.
4. Deploy the application.
5. Run the capture purge worker once in dry-run mode, then schedule its approved apply mode.
6. Complete each phase's smoke test before moving to the next phase.

Do not deploy the application before migrations 83 and 84. Notification, intake and lifecycle routes deliberately fail closed when their tables or cleanup functions are unavailable.

## Required configuration

Use long, independent random values for these secrets:

```text
INVOICE_DROP_CODE_SECRET=<at least 32 random characters>
PUBLIC_INVOICE_RATE_LIMIT_SECRET=<at least 32 random characters>
PUBLIC_INVOICE_TRUST_PROXY_HEADERS=YES_I_TRUST_RAILWAY_PROXY
PUBLIC_INVOICE_TRUSTED_PROXY_HOPS=1
```

Public intake fails closed in production unless proxy-derived client identity
has been explicitly enabled. `PUBLIC_INVOICE_TRUSTED_PROXY_HOPS=1` is for the
normal direct Railway public-domain/custom-domain path. If another trusted CDN
is placed in front of Railway, verify its `X-Forwarded-For` append/overwrite
behaviour before changing the hop count; never choose the caller-controlled
left-most value by default.

Invoice Drop quarantine storage uses the existing private object-storage connection:

```text
AIM4PRICE_BUCKET_NAME=...
AIM4PRICE_BUCKET_ENDPOINT=https://...
AIM4PRICE_BUCKET_REGION=...
AIM4PRICE_BUCKET_ACCESS_KEY_ID=...
AIM4PRICE_BUCKET_SECRET_ACCESS_KEY=...
AIM4PRICE_ALLOW_CAPTURE_QUARANTINE_WRITES=YES_I_ACCEPT_PUBLIC_CAPTURE_STORAGE
```

If the provider requires path-style S3 URLs, also set `AWS_S3_FORCE_PATH_STYLE=true`. Keep the bucket private. No public bucket URL is used by the feature.

The production origin is already restricted to `https://aim4price.com` and `https://www.aim4price.com`. For a staging or custom hostname, configure one of `NEXT_PUBLIC_SITE_URL`, `BETTER_AUTH_URL` or `RAILWAY_PUBLIC_DOMAIN`; use comma-separated `AIM4PRICE_PUBLIC_INVOICE_ORIGINS` only when more than one additional trusted origin is required. An unlisted production origin is rejected.

Do **not** set an unconditional age-based bucket lifecycle rule on
`v1/capture-quarantine/`. Attached requests—including documents waiting for an
owner decision—use that prefix until finalisation, so a blanket expiry can
destroy a still-live source file. The durable cleanup queue and scheduled
worker below are the current safety net and recheck live database references
before deleting. Add an object-store lifecycle rule only after unattached
objects have a distinct prefix or immutable tag that excludes every live
capture object.

The cleanup worker is dry-run by default. Review its count output first, then schedule `npm run capture:purge -- --apply` every 15–60 minutes with:

```text
AIM4PRICE_ALLOW_CAPTURE_QUARANTINE_PURGE=YES_I_REVIEWED_CAPTURE_PURGE_QUEUE
AIM4PRICE_ALLOW_BUCKET_WRITES=YES_I_ACCEPT_COST
AIM4PRICE_CAPTURE_PURGE_BATCH=25
```

The batch value is optional and bounded to 1–100. Apply mode rechecks every live database reference before deleting an exact object or upload catalog row.

## Phase 1 — Foundation and privacy

What this enables:

- capture requests, files, audit events and revocable contribution codes;
- a shared, database-backed public-upload throttle;
- 24-hour deadlines (`due_at = submitted_at + 24 hours`);
- private document download routes and capture-to-ledger provenance.

Smoke check:

```sql
select
  to_regclass('public.document_capture_requests') as requests,
  to_regclass('public.document_capture_files') as files,
  to_regclass('public.document_capture_events') as events,
  to_regclass('public.asset_invoice_drop_codes') as drop_codes,
  to_regclass('public.public_invoice_drop_rate_limits') as public_rate_limits,
  to_regclass('public.capture_quarantine_object_purge_queue') as quarantine_purge,
  to_regclass('public.capture_asset_upload_cleanup_queue') as upload_cleanup;
```

Every result must be non-null. Then run:

```bash
npm run typecheck
node --test tests/capture-requests.security.test.mjs tests/capture-finalization.test.mjs tests/capture-lifecycle-cleanup.test.mjs
npm run capture:purge
```

The last command must report `"mode": "dry-run"` and make no storage or database changes.

## Phase 2 — Existing Aim4price users

What this enables:

- Cost Ledger invoice uploads go to the Capture Queue instead of an automatic reader;
- Fuel Ledger slip uploads collect the usage/operator/work context first, then go to the queue;
- owners and accountants see a separate “Being captured” status card;
- admin can privately inspect a file, record its security decision, match the owner/asset, save a draft and complete it;
- a verified owner/accountant upload immediately creates the correct Cost or Fuel Ledger record.

Test one Cost Ledger invoice:

1. Sign in as an owner, open **Cost Ledger → Add Cost → Upload for Aim4price capture**, choose a known asset, attach the invoice and select **Send for capture**.
2. Confirm the UI returns an `A4P-INV-…` reference and a 24-hour deadline. Confirm no invoice has entered totals yet.
3. Open **Admin → Capture Queue**. Claim the request.
4. Inspect the private preview, mark the security check passed, confirm the asset match and enter the verified fields.
5. Select **Create verified ledger record**.
6. Return to the owner Cost Ledger. Confirm one invoice was created, the status request disappeared from the active list and the original document opens only while signed in.

Repeat from **Fuel Ledger → Add fuel slip → Upload for Aim4price capture**. Choose the asset/tank, complete the operational fields, attach the slip and select **Send for capture**. Confirm the saved slip contains the user-supplied usage, operator, activity and work-area context.

Automated checkpoint:

```bash
node --test tests/assisted-capture-ledger-ui.test.mjs tests/admin-capture-queue.test.mjs
```

## Phase 3 — Public Invoice Drop

What this enables:

- a homepage **Drop an invoice** entry point and public `/drop-invoice` page;
- one PDF or JPG/PNG/WEBP image, with content-signature and size validation (use one multi-page PDF when needed);
- routing by an owner-issued contribution code, or admin matching from a serial/VIN/reference;
- generic receipts that do not reveal whether a code or asset matched;
- a private quarantine and durable per-connection rate limit.

Test the code path:

1. In the owner Cost Ledger, select **Manage contribution code**, choose an asset and create a code.
2. In a signed-out/private browser, open `/drop-invoice` from the homepage.
3. Submit a real test PDF/image with the code and sender contact details.
4. Confirm the public page returns only an `A4P-INV-…` receipt and 24-hour message—never an owner or asset name.
5. Confirm the request appears in the admin queue already matched to the correct asset.

Test the reference path:

1. Submit another document with a serial/VIN instead of a code.
2. Confirm it appears as **Needs matching**.
3. Search and select the correct customer/asset from the admin workbench.

Automated checkpoint:

```bash
node --experimental-strip-types --test tests/public-invoice-drop.test.mjs
node --test tests/invoice-drop-code-management.test.mjs
```

## Phase 4 — Owner approval and operations

What this enables:

- admin verification of dealer/public documents moves them to **Awaiting owner** rather than creating a financial record;
- the owner receives a priority notification linking to the Cost Ledger review;
- the owner sees the captured fields and original private document, then approves or declines;
- approval creates exactly one ledger record, even if a request is retried; decline creates none;
- admin queue counts show overdue, due within 24 hours, needs matching/information and awaiting-owner work.

Approval test:

1. Complete the admin capture for the public-code test request.
2. Confirm the admin result says it was sent to the owner and no invoice exists yet.
3. Sign in as the owner and open the notification or **Review** button in the Cost Ledger.
4. Check the captured total against the original document and approve it.
5. Confirm exactly one invoice exists and repeated refreshes do not create a duplicate.

Decline test:

1. Repeat with the reference-path request.
2. Decline it as the owner.
3. Confirm its status is **Declined** and it never enters Cost Ledger totals.

Automated checkpoint:

```bash
node --test tests/assisted-capture-notifications.test.mjs tests/capture-finalization.test.mjs tests/assisted-capture-ledger-ui.test.mjs
```

## Daily operating view

Use **Admin → Capture Queue** as the single work list. Work in this order:

1. overdue;
2. due within 24 hours;
3. needs matching;
4. needs information;
5. awaiting owner.

Useful production query:

```sql
select
  status,
  count(*) as requests,
  count(*) filter (where due_at < now()) as overdue
from public.document_capture_requests
where status not in ('completed', 'declined', 'rejected', 'cancelled')
group by status
order by status;
```

Pending requests are workflow records only. Financial reporting continues to read the canonical `asset_invoices` and `fuel_slips` tables, so an unverified upload cannot alter totals.

## Rollback and incident response

- To stop new public documents immediately, remove `AIM4PRICE_ALLOW_CAPTURE_QUARANTINE_WRITES`; intake will fail closed without writing a file.
- Keep the approved cleanup worker running while intake is disabled so already queued private files are still removed.
- Do not delete migration tables during a rollback. Retain requests and audit events, then redeploy the previous application version.
- A rejected or declined request is retained for audit but never linked to a canonical ledger output.
- Generic upload URLs return `404` for invoice and assisted-capture files. Owner/admin access goes through actor-authorised, private, no-store routes.
