# Insurance Workspace deployment

## Deploy order

1. Back up the database.
2. Apply `database/migrations/53-insurance-workspaces.sql` if it is not already present.
3. Apply `database/migrations/54-insurance-workspace-normalized.sql`.
4. Deploy the application files in this package.
5. Run `npm run typecheck`, `npm run build`, and `node scripts/verify-insurance-workspace.cjs`.

Migration 54 is additive and idempotent. It preserves existing review data while moving application reads and writes to the normalized workspace model.

## Smoke test

- Open an owner-authorised shared register as an insurance account.
- Confirm Overview, Locations & Assets, Covers & Exposures, Policies & Schedule, Questions & Notes, and Reports load from the same workspace response.
- Refresh deterministic suggestions and confirm none are treated as current cover or a recommendation before a broker decision.
- Record a policy, section, schedule item, structured sum insured and source reference.
- Confirm replacement value, owner-provided insured value and recorded sum insured stay separate.
- Generate both reports and confirm private broker notes are absent.
- Submit a stale entity version and confirm the API returns a conflict response.

## Rollback

Roll back the application release first. Leave normalized tables in place so audit history, snapshot revisions and migrated records are not destroyed. Any database removal must be a separately reviewed data-retention operation.
