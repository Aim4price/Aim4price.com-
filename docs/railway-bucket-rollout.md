# Railway Bucket rollout for Aim4price uploads

This rollout is deliberately staged. Merging the foundation code and applying
migration 80 does **not** create a Railway Bucket, upload an object, or change the
current PostgreSQL upload behaviour.

## What the foundation provides

- `AIM4PRICE_UPLOAD_STORAGE_MODE=postgres` is the safe default.
- `mirror` writes PostgreSQL first, then creates and verifies an exact private
  Bucket copy. A Bucket failure never loses an accepted user upload.
- `bucket-preferred` behaves like `mirror` for writes and redirects verified
  reads to a 60-second signed Bucket URL. PostgreSQL remains the fallback.
- Object keys are generated from random upload IDs and contain no account ID,
  email address or original filename.
- Existing database files can be copied in resumable, verified batches. The
  copy command is dry-run-only unless `--apply` is supplied.
- A database deletion trigger queues mirrored objects for a 30-day deletion
  delay. The separate purge command is also dry-run-only unless explicitly
  applied.
- The Admin Dashboard measures average, median, 90th-percentile and recent
  upload use per account for future pricing decisions.

This phase intentionally retains the PostgreSQL bytes. Removing those bytes is
a later, separately reviewed migration after Bucket reads have been observed in
production and a restoration path has been tested.

## Stage 0 — no new storage charge

1. Deploy the code with `AIM4PRICE_UPLOAD_STORAGE_MODE` unset or set to
   `postgres`.
2. Smoke-test one photo and one PDF upload and download.
3. In DBeaver with Auto-commit enabled, run
   `database/migrations/80-prepare-asset-upload-object-storage.sql`.
4. Verify that uploads still work. Do not create a Bucket yet.

Migration 80 adds metadata columns, constraints, indexes, and an
object-deletion queue with its trigger. It retains
`asset_register_uploads.data NOT NULL`, copies no file bytes, and never contacts
Railway storage.

**Activation gate:** stop after Stage 0 for this foundation PR. Do not create a
Bucket, set the cost-approval variable, or enable `mirror` until the follow-up
reference/deletion work listed in Stage 4 is merged and tested. This avoids
turning existing invoice, logo, fuel and historical-snapshot cleanup gaps into
Bucket leaks.

## Stage 1 — requires explicit cost approval

Railway currently charges Bucket storage at **$0.015 per GB-month**, rounds any
non-zero fractional workspace Bucket usage up to a whole GB-month, and charges
service-to-Bucket traffic as normal service egress. These charges are normally
small and may fit inside Hobby plan included usage, but they are not guaranteed
to be literally zero.

Only after accepting that usage:

1. Create one private Railway Bucket in the production environment.
2. Add variable references from that Bucket to the Aim4price web service. The
   Bucket resource exposes `BUCKET`, `ENDPOINT`, `REGION`, `ACCESS_KEY_ID` and
   `SECRET_ACCESS_KEY`. Create service-side references using this mapping (the
   Railway resource name will replace `<Bucket service>`):

   | Aim4price web-service variable | Referenced Bucket variable |
   | --- | --- |
   | `AIM4PRICE_BUCKET_NAME` | `${{<Bucket service>.BUCKET}}` |
   | `AIM4PRICE_BUCKET_ENDPOINT` | `${{<Bucket service>.ENDPOINT}}` |
   | `AIM4PRICE_BUCKET_REGION` | `${{<Bucket service>.REGION}}` |
   | `AIM4PRICE_BUCKET_ACCESS_KEY_ID` | `${{<Bucket service>.ACCESS_KEY_ID}}` |
   | `AIM4PRICE_BUCKET_SECRET_ACCESS_KEY` | `${{<Bucket service>.SECRET_ACCESS_KEY}}` |

   Railway's Credentials tab may instead inject `AWS_ENDPOINT_URL`,
   `AWS_S3_BUCKET_NAME`, `AWS_DEFAULT_REGION`, `AWS_ACCESS_KEY_ID`,
   `AWS_SECRET_ACCESS_KEY`, and `AWS_S3_URL_STYLE` or
   `AWS_S3_FORCE_PATH_STYLE`; the application supports those aliases too.
3. Keep `AIM4PRICE_UPLOAD_STORAGE_MODE=postgres` for the first deployment and
   test normal uploads again.
4. Change the mode to `mirror`, add
   `AIM4PRICE_ALLOW_BUCKET_WRITES=YES_I_ACCEPT_COST`, deploy, and test one small upload. Confirm its
   database row has `storage_state = 'dual_verified'` while `data` remains
   present.

Never place Bucket credentials in browser code, screenshots, GitHub, or chat.

## Stage 2 — copy existing uploads safely

First run a dry-run from an environment containing the database variables:

```sh
node scripts/migrate-asset-register-uploads-to-bucket.mjs --limit=25
```

The dry-run does not initialise the Bucket client and makes no writes. After
reviewing the count and bytes, explicitly apply one small batch:

```sh
AIM4PRICE_ALLOW_BUCKET_WRITES=YES_I_ACCEPT_COST \
  node scripts/migrate-asset-register-uploads-to-bucket.mjs --apply --limit=10
```

Each object is uploaded, downloaded again, checked with SHA-256, and only then
marked `dual_verified`. PostgreSQL remains authoritative. Rerunning the command
skips verified rows and resumes incomplete rows.

## Stage 3 — prefer verified Bucket reads

After every row is verified, change the mode to `bucket-preferred`. Observe
uploads and downloads for at least 7–30 days. A signing/configuration failure
falls back to PostgreSQL.

Do not delete PostgreSQL bytes during this observation window.

The purge queue is a safety buffer for metadata rows that are deleted directly.
It delays object deletion; it does not by itself restore the deleted metadata,
owner link, or filename.
Do not schedule the purge command until reference tracking has been completed
and tested. When that work is complete, a due-object dry-run is:

```sh
node scripts/purge-deleted-asset-upload-objects.mjs --limit=25
```

## Stage 4 — actual recurring cost reduction

This requires a separate reviewed change that must include:

- direct browser-to-Bucket uploads so web-service egress is avoided;
- complete upload-reference tracking for assets, invoices, fuel slips, dealer
  costs, scan media, leads, logos and Marketplace use;
- 30-day soft deletion and a recoverable purge job, because Railway Buckets do
  not provide lifecycle rules or object versioning;
- a Bucket-to-PostgreSQL restoration command and an independent backup plan;
- a migration that nulls only SHA-verified PostgreSQL payloads;
- a guarded `VACUUM FULL` maintenance step after the cutover.

Only Stage 4 frees database volume. Partner-note PDFs, user-message attachments,
late fuel evidence and base64 logos use separate storage paths and require their
own later adapters.

## Pricing data to collect before charging clients

Use the Admin Dashboard figures for at least 30–90 days:

- average and median central-upload storage per account;
- 90th-percentile central-upload storage per account;
- bytes added in the last 30 days;
- verified physical Bucket bytes;
- retention and backup overhead.

Those per-account figures cover `asset_register_uploads` only. The global source
breakdown separately shows known partner PDFs, late-fuel evidence, messages and
some inline branding. Do not treat the dashboard's logical payload total as
`pg_database_size` or as actual Railway volume headroom.

Storage infrastructure is inexpensive. Client storage pricing should therefore
be a simple fair-use allowance and abuse control, not a large margin line item.
