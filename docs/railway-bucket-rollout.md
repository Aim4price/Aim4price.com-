# Railway Bucket rollout for new Aim4price uploads

This rollout moves **new** central uploads to a private Railway Bucket. It does
not copy, rewrite, or delete any existing PostgreSQL upload. Existing upload
URLs continue to read their original PostgreSQL bytes.

The code is disabled by default. Merging it, deploying it, and applying
migration 81 do not contact a Bucket and do not create Bucket usage.

## What this release changes

- `AIM4PRICE_UPLOAD_STORAGE_MODE=postgres` remains the default.
- Migration 81 creates a separate metadata-only table named
  `asset_register_bucket_uploads`. It contains no `bytea` file column.
- New Bucket IDs start with `bkt-`; legacy IDs keep their existing read path.
- A new Bucket upload is accepted only after it has been uploaded, downloaded
  again, and verified byte-for-byte with SHA-256.
- A known Bucket-only file returns HTTP 503 during a Bucket configuration or
  signing outage instead of falling through to a false 404.
- Account deletion puts exact object keys into a 30-day recovery queue. The
  queue does not physically delete anything by itself.
- A metadata-only deletion tombstone prevents an already-authorized request
  from creating a new Bucket object after account cleanup has started.
- The Admin Dashboard includes ready Bucket bytes, pending/error counts, and
  combined logical storage per account for pricing measurements.

This first release sends uploads through the Aim4price web service. That keeps
the application change small and covers every existing central upload caller.
Direct browser-to-Bucket uploads can be added later if traffic becomes large
enough for the one-time service egress to matter.

## Release A — merge and apply metadata migration (no Bucket cost)

1. Merge and deploy the PR with `AIM4PRICE_UPLOAD_STORAGE_MODE` unset or set to
   `postgres`.
2. Smoke-test one normal photo and PDF upload/download. They must still use the
   existing PostgreSQL path.
3. Back up PostgreSQL.
4. In DBeaver, run the whole file
   `database/migrations/81-add-new-bucket-upload-catalog.sql` as one script.
   Run it in a quiet period. It has a five-second lock timeout and fails safely
   if the expected migration-80 schema is not present.
5. Verify the migration:

```sql
select
  to_regclass('public.asset_register_bucket_uploads') as upload_catalog,
  to_regclass('public.asset_register_bucket_upload_purge_queue') as purge_queue,
  to_regclass('public.asset_register_bucket_deleted_accounts') as deletion_guard;

select count(*) as new_bucket_upload_rows
from public.asset_register_bucket_uploads;
```

All three relation names must be returned. The count should initially be zero. No
existing row is copied or changed by this migration.

## Release B — create the private Bucket

Creating or using a Bucket can create a small Railway usage charge. Do this
only after Release A is healthy.

1. Open the production environment in Railway.
2. Select **Add** and create a **Bucket** in the same production environment.
3. Keep the Bucket private. Do not publish its credentials or place them in
   browser code.
4. On the Aim4price web service, create variable references to the Bucket
   resource. Replace `<Bucket service>` with the exact Railway service name:

| Aim4price web-service variable | Railway Bucket reference |
| --- | --- |
| `AIM4PRICE_BUCKET_NAME` | `${{<Bucket service>.BUCKET}}` |
| `AIM4PRICE_BUCKET_ENDPOINT` | `${{<Bucket service>.ENDPOINT}}` |
| `AIM4PRICE_BUCKET_REGION` | `${{<Bucket service>.REGION}}` |
| `AIM4PRICE_BUCKET_ACCESS_KEY_ID` | `${{<Bucket service>.ACCESS_KEY_ID}}` |
| `AIM4PRICE_BUCKET_SECRET_ACCESS_KEY` | `${{<Bucket service>.SECRET_ACCESS_KEY}}` |

Railway may instead inject the generic names `AWS_ENDPOINT_URL`,
`AWS_S3_BUCKET_NAME`, `AWS_DEFAULT_REGION`, `AWS_ACCESS_KEY_ID`,
`AWS_SECRET_ACCESS_KEY`, and `AWS_S3_URL_STYLE` or
`AWS_S3_FORCE_PATH_STYLE`. The application accepts those aliases too.

5. Leave the storage mode as `postgres`, deploy the credential references, and
   verify the application still behaves normally.

## Release C — enable new Bucket-only uploads

Bucket-only means the new file has no PostgreSQL payload fallback. Railway
Buckets are private primary storage, but this release does not create an
independent backup or object version history. Keep irreplaceable source
documents elsewhere until a separate backup/restore policy has been approved.

Add all three exact values to the Aim4price web service:

```text
AIM4PRICE_UPLOAD_STORAGE_MODE=bucket-only-new
AIM4PRICE_ALLOW_BUCKET_WRITES=YES_I_ACCEPT_COST
AIM4PRICE_ALLOW_BUCKET_ONLY=YES_I_ACCEPT_NO_POSTGRES_COPY
```

Deploy, then upload one small image and one small PDF. Verify:

```sql
select id, storage_state, byte_size, object_key, verified_at, last_error
from public.asset_register_bucket_uploads
order by created_at desc
limit 10;
```

Successful rows must have `bkt-` IDs, `storage_state = 'ready'`, a `v2/`
object key, `verified_at`, and no error. Open both returned application URLs to
confirm downloads work.

Do not run either old-file copy script. This design intentionally leaves all
legacy PostgreSQL uploads where they are.

## Safe rollback

To stop new Bucket writes, set:

```text
AIM4PRICE_UPLOAD_STORAGE_MODE=postgres
```

Keep migration 81, the Bucket resource, and all Bucket credential references.
Already-created `bkt-` URLs are Bucket-only and still need those credentials to
be readable. A write rollback affects only future uploads.

## Deferred physical deletion

Deleting an account removes its Bucket metadata and queues the exact private
object for at least 30 days. Nothing is automatically scheduled in Railway and
no extra service or cron is required.

This release deliberately retains ready files removed from an individual asset
until the owning account is deleted. Aim4price copies upload URLs into scans,
invoices, leads and historical snapshots, so deleting an object from a single
screen is not yet proof that the object is globally unreferenced. This favours
data safety over a small amount of cheap retained storage; the dashboard counts
that retained storage conservatively.

Dry-run the due queue manually:

```sh
node scripts/purge-deleted-bucket-only-uploads.mjs --limit=25
```

Only after reviewing the dry-run may an operator apply it:

```sh
AIM4PRICE_ALLOW_BUCKET_WRITES=YES_I_ACCEPT_COST \
AIM4PRICE_ALLOW_BUCKET_PURGE=YES_I_REVIEWED_30_DAY_QUEUE \
  node scripts/purge-deleted-bucket-only-uploads.mjs --apply --limit=25
```

The apply command rechecks each locked queue row and refuses deletion if a live
catalog row still uses the same ID or object key. Queue audit rows remain after
successful deletion.

## Pricing measurements

Measure logical active bytes per account for 30–90 days before finalising
customer allowances. The Admin Dashboard now combines legacy central uploads
and ready Bucket-only uploads for account average, median, 90th percentile, and
30-day growth.

Those figures measure bytes at rest, not web-service egress or other Railway
resource usage. Reconcile them against the actual Railway usage statement and
invoice before treating any rand-per-GB figure as the full cost to serve.

Initial commercial hypothesis only:

- include 2 GB of logical active storage in the annual subscription;
- sell additional 5 GB annual blocks at R60 per year, VAT-inclusive where
  applicable;
- do not invoice tiny monthly storage amounts separately;
- revise the allowance after observing real file sizes and retention.

Railway Bucket storage is inexpensive, but it is not literally free. The
customer price also needs to absorb recovery retention, failed/pending objects,
foreign-exchange movement, and payment/admin overhead.
