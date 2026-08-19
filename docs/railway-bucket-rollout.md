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

## Stage 0.5 — reconcile upload references without a Bucket

This stage is database-only. It does not create or connect to a Railway Bucket,
does not copy an upload, and does not delete PostgreSQL bytes.

1. Keep `AIM4PRICE_UPLOAD_STORAGE_MODE=postgres` and leave all Bucket variables
   unset.
2. In DBeaver with Auto-commit enabled, run
   `database/migrations/81-asset-upload-reference-guard.sql` once. The migration
   creates a fail-closed reference ledger, installs change triggers on the
   registered source tables, gives new uploads a 24-hour pending hold, and gives
   every existing upload a non-expiring migration hold. It does not release its
   own migration holds.
3. From an environment with the production database variables, run the
   reconciliation in dry-run mode:

   ```sh
   node scripts/reconcile-asset-upload-references.mjs
   ```

   Dry-run performs `SELECT` queries only. It compares every registered raw
   source with the normalized ledger. It also audits PostgreSQL's catalog for
   every eligible column in every public base table: text/varchar/character,
   JSON/JSONB, text/JSON arrays, and scalar columns named `upload_id`,
   `uploadId` or `*_upload_id`. It scans only those columns (not file `bytea`
   payloads) for internal upload URLs and structured upload IDs, and prints:

   - missing required source tables, key columns or triggers;
   - missing and stale normalized reference rows;
   - every table containing upload-reference candidates that is not registered
     in `asset_upload_reference_sources` (`unregisteredSourceTables`);
   - references in a registered table that migration 81's row extractor would
     not place in the normalized ledger (`registeredExtractorGaps`);
   - public tables whose row-level security could hide rows from the
     reconciliation connection (`incompleteVisibilityTables`);
   - candidate IDs whose upload metadata is already missing;
   - the exact hash of both the registered catalog and the audited public-table
     schema;
   - the number of existing migration-held uploads for which no registered raw
     reference can be found (`legacyOrphanCandidates`).

4. Stop and investigate if `catalogProblems`, `unregisteredSourceTables`,
   `registeredExtractorGaps`, `missingUploadSourceTables`,
   `incompleteVisibilityTables`, `missingLedgerReferences` or
   `staleLedgerReferences` is non-zero. A dangling internal upload URL or ID is
   integrity evidence and apply fails closed until its missing metadata is
   explained or restored. An
   unregistered table must be reviewed and added to migration 81's source
   registry (with its key and trigger), then the migration and dry-run must be
   rerun. Apply fails closed while any discovered reference table is
   unregistered. Also inspect every legacy orphan before accepting the count. A
   reference that is absent from the registered catalog can turn a real
   customer file into a false orphan.
5. Only after reviewing that exact output, copy its catalog hash and orphan
   count into the guarded apply command. For example, if the dry-run reports
   catalog `0123456789abcdef` and 3 candidates:

   ```sh
   AIM4PRICE_ALLOW_REFERENCE_RECONCILIATION=YES_I_REVIEWED_THE_DRY_RUN \
     node scripts/reconcile-asset-upload-references.mjs \
       --apply \
       --confirm-catalog=0123456789abcdef \
       --confirm-legacy-orphans=3
   ```

   Apply takes a PostgreSQL advisory lock and short, bounded table locks. It
   locks registered and catalog-audited source tables in deterministic order
   before the upload table, repeats discovery, and refuses to continue if the
   catalog hash changed or an unregistered reference appeared. It then rebuilds
   only the normalized source-reference rows and verifies the result before
   committing. Referenced migration holds are removed. A reviewed migration
   hold with no raw source becomes a `legacy_orphan_hold` that expires after 24
   hours. The upload row and its bytes remain untouched throughout.
6. Rerun the dry-run immediately. Before the 24-hour orphan grace expires, the
   expected safe result is zero migration holds, zero missing/stale ledger rows,
   zero unprotected uploads, and `ledgerReady: true`.

The 24-hour grace is an inspection window, **not deletion approval**. This
script never deletes an upload row or a Bucket object. If an orphan hold expires,
the dry-run reports it as an expired temporary hold and an unprotected upload;
the bytes still remain in PostgreSQL. A later, separately reviewed retention
worker must recheck the normalized ledger and every raw registered source before
it may remove an expired hold or upload metadata. Do not manually remove expired
holds, migration holds or upload rows to make the report look clean.

**Stage 0.5 activation gate:** do not create a Bucket or enable `mirror` unless
the migration and guarded reconciliation have completed, the source catalog is
complete for the deployed application, discovery reports no unregistered
source table, and the post-apply dry-run is clean.

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
owner link, or filename. **Do not run purge APPLY as part of this handoff.** Wait
until reference tracking, restoration, backups and the full retention path have
been tested in production.

When that later gate is approved, always review a bounded dry-run first:

```sh
node scripts/purge-deleted-asset-upload-objects.mjs --limit=25
```

The report labels counts as candidates because every row is checked again
inside its apply transaction. A guarded database-only apply is:

```sh
AIM4PRICE_ALLOW_UPLOAD_PURGE=YES_I_REVIEWED_THE_DRY_RUN \
  node scripts/purge-deleted-asset-upload-objects.mjs --apply --limit=25
```

That apply can mark uploads older than 24 hours and proven unreferenced for a
30-day recovery window. Once that window expires, PostgreSQL-only upload rows
can be removed without Bucket variables or a Bucket connection. It does not
delete a Bucket object unless the separate cost/network approval is also
present:

```sh
AIM4PRICE_ALLOW_UPLOAD_PURGE=YES_I_REVIEWED_THE_DRY_RUN \
AIM4PRICE_ALLOW_BUCKET_WRITES=YES_I_ACCEPT_COST \
  node scripts/purge-deleted-asset-upload-objects.mjs --apply --limit=25
```

Review the dry-run counts again immediately before either apply. The reference
ledger, registered raw sources and catalog fallback are rechecked before final
metadata or object deletion; a failed check retains the data.

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
