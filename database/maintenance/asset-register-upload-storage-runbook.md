# Asset Register upload storage repair

This repair does not create a Railway service, bucket, deployment, or plan change.
The SQL steps remain manual so the production database is never altered by merging
the pull request alone.

## Safe order

1. Keep a current database backup or export using the existing backup process.
2. Deploy the application change that writes uploads only to `data`.
3. Upload and download one disposable test file successfully.
4. During a quiet window, run
   `database/migrations/79-deduplicate-asset-register-upload-storage.sql` in
   DBeaver. If the five-second lock timeout fires, wait for a quieter window and
   rerun the complete migration.
5. Confirm that `file_bytes` is absent and existing uploads still open.
6. With DBeaver Auto-commit enabled, run
   `database/maintenance/reclaim-asset-register-upload-storage.sql`.
7. Confirm the reported database and upload-table sizes decreased.

Migration 79 runs in one transaction. A missing canonical payload, mismatched
payload, unexpected legacy column type, lock timeout, or statement timeout rolls
back the migration without dropping `file_bytes`.
