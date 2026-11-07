# Desktop access: page and action permissions

Status: proposed permission expansion, not an enabled feature. The accompanying UI change only compacts the existing editor. Existing grants and server authorization remain unchanged.

Reviewed against main `52ef9d4f61918fd156789bb6be786bf09dee48c6` (7 November 2026).

## What the current implementation actually does

- `lib/team-access-policy.ts` contains nine asset-related permissions. Manager enables these nine permissions; it is not an owner-equivalent account.
- `components/AppHeader.tsx` restricts the desktop context to Asset Register and Account. It prevents Home, Value Asset and Marketplace navigation as well as operational pages.
- `app/fuel/page.tsx`, `app/my-invoices/page.tsx`, `app/budgets/page.tsx`, `app/asset-map/page.tsx`, `app/maintenance/page.tsx` and `app/documents/page.tsx` require the ordinary owner page session. A desktop grant does not currently grant access to these pages.
- `app/valuation/page.tsx` and `app/marketplace/page.tsx` have public entry flows. Browsing those flows and acting on an owner's account are distinct capabilities.
- `lib/owner-workspace-access.ts` resolves owner/app sessions. Its asset-scope and ledger-filter helpers are currently no-ops. Adding desktop sessions here without implementing filtering would expose the owner's complete ledgers.
- `app/api/my-invoices/route.ts` returns asset values, invoice amounts, embedded invoice documents and account summaries. Fuel responses also contain asset values, transactions, tank information and audit snapshots. A general page-view flag is insufficient.
- `app/api/asset-map/route.ts` returns coordinates alongside values, photos and finance/insurance status. Map access must not imply financial or photo access.
- `lib/owner-app-access.ts` has separate, broader app roles. Reusing its admin session as a desktop user would grant unintended privileges.
- Desktop maintenance currently supports viewing and completing scheduled work through `app/api/team-workspaces/[membershipId]/maintenance/route.ts`. It does not grant all owner scheduling, editing and deletion actions.
- Desktop documents and reports already have scoped endpoints. Their asset and document checks must survive reuse of the owner pages.

## Product rule

Use the owner's existing pages, components, header, logo, register, umbrellas and records. The active desktop identity contributes permissions and scope, not a second copy of the data or a different dashboard.

For every operation evaluate: account feature availability, active membership, page access, action permission, asset/register scope, sensitive-field permissions, and document scope. A role is only an editable starting preset.

## Editor

Keep Login details, Permissions, Asset access, Documents and Login status. Permissions has one expandable row per page, ordered like the site's navigation. Each closed row shows a short effective summary such as `View · Add fuel · Prices hidden`, rather than only a count.

Within each page, use readable controls for the actions that actually exist. Suggested starting choices are No access / View / Work / Manage / Custom, but do not force every page into the same actions. Browse pages need Browse / Custom. Account needs explicit administration controls. Use a short description for each choice and reveal advanced actions when expanded.

Keep Save access visible. Avoid duplicate role summaries, large role cards and nested scrolling containers. Explain dependencies inline. Show which assets are included separately from what the person can do.

Do not show an enabled toggle until its server routes, downloads and ordinary owner UI enforce it. Unsupported modules must not appear usable merely because a permission was saved.

## Page catalogue and proposed actions

| Page / area | Proposed choices and action permissions | Independent restrictions |
| --- | --- | --- |
| Home | Open ordinary home; see permitted dashboard cards | Aggregate counts and totals use accessible records only. Restricted metrics show masked placeholders. |
| Value Asset | Run a new estimate; save a new asset; apply an estimate to an existing asset | Estimating does not grant access to saved owner values. New assets need an allowed destination register; existing-asset changes need edit-values permission. Paid captures/credits are separate. |
| Asset Register | View details; view values; edit details; update usage; add assets; edit valuations; manage registers/umbrellas; archive; delete mistakes/duplicates; share externally; transfer ownership | Viewing values and changing values are separate. Moving assets cannot bypass scope. Creating a register/umbrella or changing its membership affects other users and needs its own permission. Archive/delete/share/transfer are separately granted. |
| Maintenance | View history/schedules; log completed work; report problems; resolve problems; complete scheduled work; create/change schedules; edit records; delete/cancel; download reports | Costs and attached documents stay separately controlled. A workshop user can log work without seeing expenditure. Completing a job must not silently authorize changing its recurring schedule. |
| Fuel Ledger | View litres/usage; record an issue or slip; record tank refill; record dip reading; edit/correct; void entries; manage tanks; reconcile stock; view prices/spending; download reports | Tank access needs its own selected/all scope. Asset scope alone cannot authorize shared tank history, balances, PINs or QR administration. Financial amounts, audit snapshots, receipts and reports require separate checks. |
| Cost Ledger | View cost records/amounts; add costs; edit; delete/void; upload invoice; open/download original invoice; download cost reports | Cost visibility does not enable asset values or finance balances. Invoices linked to inaccessible assets remain unavailable. Automatic fuel costs must follow the same access rules. |
| Budgets | View budgets/progress; create/change budgets; manage recurring commitments; delete; download reports | Progress reveals spending. Requires cost visibility and scope. Account-wide budgets require explicit business-wide financial scope, not merely one accessible asset. |
| Asset Map | View last-known locations; view live positions; view location history; record/update a location; pair/manage trackers; download map/history reports | Location history is more sensitive than last-known position. Respect asset scope, photo visibility and financial fields. Tracker management is distinct from viewing. |
| Documents | View/download approved originals; upload; rename/reclassify; replace; delete | Retain No documents / Choose documents / All with exceptions. Explicit exclusions always win. Future-document access must be stated. Documents linked to multiple assets require access to every linked asset. |
| Marketplace / Discovery | Browse; enquire on behalf of business; create draft listing; publish; edit; unpublish/delete; manage discovery visibility | Browsing is available by default. Publishing, contact details and sending enquiries act for the business and require explicit permissions. Public listing prices are public, even when internal asset values are hidden. |
| Advert Studio / Showroom | Preview/create an advert; download an advert; publish/manage showroom or listings | Downloading an advert can reveal photos, serial numbers and prices. Only permitted assets and fields may populate it. No public disclosure from a browse-only role. |
| Notifications | View own/permitted work alerts; mark read | Do not send owner-only finance, enquiry or document details through notification text, counts or deep links. Account-wide notification settings are administration. |
| Account | View owner branding and own permissions; optionally manage delegated business settings or users | Main-holder password, account deletion, ownership transfer and billing control remain with the holder. Delegated administrators cannot grant more than their own delegable access or remove the holder. |
| Annual review / bulk updates | View proposed changes; apply bulk replacement/valuation updates | Applying changes requires explicit value-edit/bulk-update access across every selected asset. Asset values being visible is insufficient. |
| Reports and summaries | Download each module's permitted reports using the existing owner report design | No desktop CSV option. Asset-value visibility does not grant cost/finance visibility. Full reports mean full permitted scope, not all owner records. Approved original files are not redacted PDFs. |

Finance balances/agreement details, insurance details/insured values and licence details should be explicit subgroups under Asset Register. They must not be bundled into `View asset values`. Original finance/insurance documents remain governed by Documents even when structured details can be viewed.

For dealers/businesses/middlemen, show applicable sections only: Leads, client registers, tracking/maintenance, client costs, Advert Studio, Showroom and Parts. A permission cannot create a module the parent account does not have. Client registers need isolation from the dealer's own stock and from other clients. Sharing/lead handling, parts-list visibility and parts uploads require separate action checks; desktop report CSV restrictions do not change the dealer's existing parts-import workflow.

## Starting presets

All ordinary presets can open Home, use the public estimation flow and browse Marketplace. These do not include adding assets, publishing listings or spending credits.

| Preset | Suggested starting access | Restricted by default |
| --- | --- | --- |
| View only | Permitted asset details and photos | Writes, financial information, private documents, location history, downloads |
| Operator | Usage, fuel issue/entry for assigned assets/tanks, report problems, add photos | Historical spending, asset values, invoices, scheduling, deletion and publication |
| Workshop | Maintenance history, completed work, problems, schedules where granted, photos, uploads | Asset values, finance, cost history, private documents and destructive actions |
| Office | Record upkeep, costs/invoices, fuel records, approved document handling and reports | Asset valuations, finance agreements, deletion, publication and user administration unless explicitly enabled |
| Manager | Broad operational access, costs, fuel, budgets, maps, reports, asset values | Private-document exceptions, account administration, sharing, deletion, transfer and publication remain explicit choices |
| Administrator | Explicitly delegated operational and user-management permissions | Holder credentials, ownership, billing authority and account deletion remain holder-controlled |

Existing users must not gain new powers automatically when these presets are introduced. Preserve existing stored flags; new permissions default off for existing grants. The owner deliberately reapplies a preset or selects new options.

A shared computer is a device arrangement, not a shared user identity. Use separate usernames and record the actual actor for each change. A shared workstation login, if ever introduced, must explicitly warn that individual attribution is lost and should have narrow entry-only access.

## Important behaviour

- `View` never includes add, edit, delete, publish, share, transfer or paid actions.
- `Add` may show the data entered during that operation without exposing all historical records. Granting historical ledger visibility is a separate decision.
- For a worker recording litres with prices hidden, use a quantity-only fuel-entry path. Do not expose a receipt containing prices or silently send financial fields to the browser.
- Generated PDF summaries mask or omit forbidden fields on the server. Hidden amounts must not remain in HTML, JSON, tooltips, totals, audit snapshots or downloads.
- Original approved invoices/receipts can contain prices. Their access is an explicit document permission, not something CSS blur can enforce.
- Restricted buttons keep the familiar owner layout and show a small Not available dialog. A masked placeholder may be blurred; actual secret values must never be sent to the browser.
- All pages retain active workspace identity and owner branding. A desktop user must not switch to a personal or owner session because a page uses a different authentication helper.
- Access changes, expiry and revocation apply to open pages, API requests and downloads, not just the next login.

## Implementation boundaries

1. Establish a shared desktop workspace context (actor, owner, grant, scope, capabilities). Keep ordinary owner sessions unchanged. Never substitute the owner's unrestricted session for a desktop session.
2. Reuse the owner components with an access adapter. Route all their reads/writes through checked handlers; avoid duplicated desktop screens.
3. Implement scoped projections for fuel, cost, budgets and maps before enabling those page controls. Recalculate summaries from the filtered records. Add explicit tank scope and business-wide budget scope.
4. Expand one module end to end: page, action buttons, API, field filtering, attachments, report endpoints, actor attribution and automated tests.
5. Add page summaries and presets only for implemented capabilities. Migrate existing grants without privilege expansion.
6. Consolidate policy lookups per request; avoid fetching permissions separately for every card. Use short-lived request memoization, not a stale cross-request authorization cache.

## Required acceptance checks

Test direct URLs and API calls as well as disabled buttons. Cover each role with all-assets and selected-assets scope; values on/off independently of costs; permitted and excluded documents; full and selected PDF reports; selected tanks; account-wide and asset-specific budgets; current location versus history; estimate-only versus save; browse versus publish; sharing and deletion; actor attribution; grant changes during an open modal; revoked/expired access; mobile/desktop; owner behaviour unchanged. Test guessed IDs, attachment URLs, nested records, audit logs and mixed-scope documents. No permission editor option is complete until its corresponding enforcement tests pass.
