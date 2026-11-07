# Desktop access: shared owner pages with scoped permissions

Implemented on top of main `5d93378a0f5028c4cf08a83a0f479a1f2879642d` (7 November 2026). Deployment is separate from this change.

## Product rule

Desktop users use the existing owner components, branding, header, asset register, umbrellas and report renderers. There is one set of records. The desktop grant determines which records and actions are available. Restricted actions display Not available; restricted values are masked on the server before placeholders are blurred in the browser.

The permission editor keeps Login details, Permissions, Asset access, Documents and Login status. Permissions are grouped into compact expandable page sections. Save access remains visible. Presets are starting points, not separate account types. Dependencies are shown in the editor and enforced by the server.

## Available controls

| Area | Explicit permissions | Scope and dependencies |
| --- | --- | --- |
| Asset register | Values, edit details, update usage, view/add photos, download register reports | Existing selected assets/registers or all current and future assets. Value visibility does not grant finance balances or operating costs. |
| Maintenance | View, complete scheduled work, download reports | Accessible assets only. Completing work does not allow changing schedules or deleting records. |
| Fuel ledger | View quantities, view prices, view tanks, add/correct/void slips, manage tanks, open original slips, download reports | Asset records follow asset scope. Tank access explicitly includes all business tanks; there is no selected-tank picker in this release. Current manual slip entry/correction/voiding requires fuel-price access. |
| Costs | View, add, edit, delete, open original invoices, download reports | Accessible assets only. Fuel-derived costs additionally require fuel-price visibility. Fuel originals require both applicable original-document permissions when accessed through Costs. |
| Budgets | View, manage | Includes cost and fuel spending, so requires cost and fuel-price visibility. Selected-asset users cannot see or create account-wide budgets. Cost-report permission controls downloads. |
| Asset map | View current positions, update locations, download map reports | Accessible assets only. Values and photos follow their own permissions. Tracker administration and location-history endpoints are not enabled. |
| Documents | Upload; separately choose No documents / Choose documents / All with exceptions | Approved originals may be opened/downloaded. Exclusions win. Every linked asset must be accessible. Uploading does not grant access to existing private documents. |
| Home, Value Asset, Marketplace | Ordinary public browsing | Saving assets, publishing listings, paid capture and acting on the holder's behalf remain unavailable. |
| Account | Owner branding and read-only Permissions modal | Holder settings, credentials, billing, ownership and user administration remain owner-only. |

There are 30 explicit permission flags. New flags default to false when normalizing existing stored grants. No migration expands existing access. Applying Manager deliberately enables all listed operational permissions, including fuel/cost originals; general document selection remains separate. Other presets preserve their existing starting permissions and can be customized per page.

## Reports and original files

Reuse owner PDF/HTML renderers for register summaries, fuel reports and slip bundles, maintenance, cost-of-ownership, budgets and maps. The layout is shared; the input records and fields are filtered by the desktop grant. With equivalent scope and visibility, these use the same owner report design. No desktop CSV or XLSX export is enabled.

Report permission never overrides asset scope, value restrictions, fuel-price restrictions or document access. A single-asset report cannot be used to request an inaccessible asset. HTML previews are also restricted; XLSX toolbar links are omitted. Original documents are not redacted: granting access includes any printed prices. A PDF report permission alone does not grant access to originals.

Owner-only report workflows such as depreciation and unrelated dealer/advert workflows are not enabled by Manager. The register's desktop single-asset valuation shortcut uses the scoped register report rather than granting unrestricted owner export access.

## Enforcement and efficiency

- `lib/team-access-policy.ts` is the permission catalogue, preset and dependency source. Unknown flags and absent flags are false. Turning off a parent removes dependent permissions.
- `lib/desktop-workspace.ts` resolves a verified membership. The caller cannot supply an owner ID. Ordinary public/owner requests without a desktop cookie avoid an extra auth lookup. React cache memoizes resolution only within a request.
- `lib/owner-workspace-access.ts` resolves the effective owner and actual actor, rejects cross-origin desktop writes, and caches accessible asset IDs per request. Owner behavior retains its existing path.
- `lib/team-workspace-policy.ts` explicitly lists permitted endpoint/method combinations. Unknown owner endpoints remain unavailable even with every flag enabled.
- Ledger projections remove forbidden values, originals, OCR, payment details, map fields and tank data before JSON is returned. Summaries are scoped; fuel's 30-day totals use a scoped aggregate query rather than only the current page of events.
- Writes validate the original and destination asset where applicable. Fuel-created costs must be corrected in the fuel ledger. Desktop manual fuel creation rejects existing record/upload references. Audit attribution uses the desktop actor.
- Map and report queries filter before calculating counts/totals or rendering. Document downloads recheck permission and asset scope. Desktop membership is retained in links.
- The client adapter keeps familiar controls but gates unsupported actions with a Not available dialog. Server checks remain authoritative when a grant changes or is revoked.

## Deliberate boundaries

This is an operational permission expansion, not owner impersonation. Quantity-only fuel entry with hidden prices, per-tank selection, stock reconciliation, QR/PIN administration, automatic invoice capture, recurring costs, maintenance scheduling/deletion, asset sharing/transfers, marketplace publishing, delegated user administration and new dealer-specific workflows are not enabled. General free-text notes and approved photographs/originals may contain information typed or photographed by users; structured-field permissions cannot redact arbitrary document content.

Each request reloads the live grant. Existing team maintenance/document transactions retain their grant-lock checks; newer ledger writes authorize at request time and do not claim atomic cancellation of an already-running write when access is revoked.

## Validation

- TypeScript: `npx tsc --noEmit`.
- Policy/routes: `node --test tests/team-access.test.cjs tests/team-workspace-permissions.test.cjs tests/dedicated-asset-reports.test.cjs`.
- Browser: `scripts/verify-team-access.cjs` and `scripts/verify-desktop-register.cjs`, including desktop/mobile sizing, owner branding, umbrellas, permission modal, masked values, restricted actions and revocation.
- Report regression suite: fuel reports/slips/integrity, maps, cost formats/budgets, asset-link reports and maintenance clear checks.

Three source-text assertions in the broad regression suite also fail on the pre-change baseline: budget warning-card fetch spelling and two desktop maintenance quick-clear assertions. They are recorded separately from the passing new permission tests; they were not weakened to hide failures. CI remains required before merging.
