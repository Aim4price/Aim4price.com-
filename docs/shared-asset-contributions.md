# Shared asset contributions

Leads and external shared links use `SharedAssetContributionDialog` for **Add photos** and **Add cost**. The owner enables each action separately in the existing asset access settings. Existing grants default to disabled for both new permissions; migration 125 adds the internal grant columns. External links store the flags in their existing permissions JSON.

Photos append to the canonical asset gallery (12 photos maximum, JPG/PNG/WEBP, 5 MB each). Recipients cannot replace or delete existing photos. Lead card photo references are refreshed as part of the same transaction.

Costs are canonical `asset_invoices` records with date, category, description, amount excluding VAT, VAT, optional supplier/invoice number, and an optional PDF/image document (5 MB). An explicit cost grant saves directly into the owner's ledger; no second expense or approval proposal is created. Contributor identity and time remain on invoice records and the usage ledger.

Both entry points validate signed-in identity and check current permissions again inside the write transaction. Link writes retain asset/umbrella scope and revocation checks. Owners opening their own link can add photos/costs, update serial/replacement price, and create schedules even when recipient permissions are read-only. Revoked links remain unavailable to everyone.

Each successfully saved file records an upload and bytes; each photo batch or cost records one contribution. A stable form request ID prevents retry duplicates. This measures usage without enforcing allowances.

## Manual check

1. Share an asset with Add photos and Add costs enabled. Open Manage in the recipient's Leads, and in a signed-in shared link. Both should show the same forms.
2. Add a photo. Confirm the owner's existing photos remain and the new photo appears in the owner asset and shared link.
3. Save a cost with VAT and a receipt. Check the owner's cost ledger/report: one expense, the correct total, and the contributor. Refresh/retry the same request: no second cost or usage charge.
4. Disable each permission for an internal share, or use a read-only external link. The recipient must not be able to write, including by calling the API directly.
5. Open your own read-only link as the owner. Add a photo/cost or change the serial number. Only assets in that link can be edited.
6. Revoke a link while its form is open. Saving must fail. Check Admin → Sharing usage for successful uploads, uploaded bytes and contributions.

Checks: `node --test tests/shared-asset-contributions.test.cjs tests/external-share-permissions.test.cjs tests/asset-link-report-access.test.cjs`; `node scripts/verify-shared-contributions.cjs`.
