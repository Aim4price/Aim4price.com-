# Admin review — 20 September 2026

Reviewed against main commit `6e348fd1b43dc0b89acf187e94ecf863dafe1b17` and the twelve supplied screenshots (4825–4836). This change is for manual review and merge.

## Page coverage

| Section | Review and changes |
| --- | --- |
| Accounts | Reviewed search, sorting, pagination, account actions, support access, notifications and status changes. Names/emails and account type/subtype now occupy separate lines; long identities wrap within their column. Storage total no longer squeezes its label. Invalid JSON returns 400; unknown status input cannot silently normalize to pending payment. |
| Business Directory | Reviewed list, manual creation/edit entry points and invitation tools. Load failures are distinguished from an empty directory, with a retry action; no-match results have a clear-search action. Admin writes accept trusted public origins behind the hosting proxy. No invitations were sent. |
| Dashboard | Reviewed metric sources, grouping, report links and storage breakdown. Month/year labels explicitly mean the current period. Day/month/year SQL boundaries now use South African time independently of the database timezone. Weekly activity is labelled as an estimate. Card titles can wrap, and links are retained across card groups. |
| Valuations | Reviewed report filters, selection, detail view, account access and confirmed single/bulk deletion. “Accounts” and “Guests” actually counted records; labels now say Account records and Guest records. Failed report requests restore filters to match the displayed report. Account/asset names no longer overlap adjacent cells. |
| Marketplace | Reviewed listing status, view/repeat-interest filters, activity and deletion paths. Asset metadata moves below the title; repeated model/location text is removed. Table columns remain usable with long titles/seller names. Filters reflow into readable rows. |
| Asset Map | Reviewed global asset inclusion, missing GPS handling, local filtering, owner/detail links, clustering and refresh logic. Sidebar titles and account/location details now occupy separate lines. Filters reflow. External tile delivery was not verified against production. |
| Discovery | Reviewed global report filters, participation/GPS indicators, owner contacts, activity and detail access. Table identities and contact methods occupy separate lines; monetary headings identify the VAT basis. Failed report requests restore the filters for the retained results. |
| Outcomes — Marketplace | Reviewed reason/source/date filtering, help-rate and price evidence presentation. Long row content wraps inside bounded columns. Removed the unwanted vertical scroll on the source switch. |
| Outcomes — Asset register | Reviewed disposed-asset filters and allocation/delete confirmation paths and related transfer tests. Receives the same table/filter improvements. Invalid action bodies return 400. No live assets were allocated or deleted. |
| Work tracker | Reviewed period/account selection, timer requests, history, notes and report prerequisites. Failed history loads show a retry state rather than “No work recorded”. The page explains that an account must be selected to print. Invalid JSON is rejected consistently for POST/PATCH/DELETE. |
| Capture Queue | Reviewed queue/deadline filters, destination matching, drafts, file review, usage updates and completion. Fixed a missing invoice-reading dependency that left the update action stale. Superseded debounced loads cannot replace current results. Added load-failure retry and explicit South African date formatting. Clarified that ledger completion does not update usage. |
| Lifecycle Model | Reviewed numeric editing, funding scenarios, VAT controls and export entry point with existing calculator/report tests. Existing field guidance and result basis are available in collapsed Details disclosures; toggle guidance is retained as a title. Calculation formulas are unchanged. |
| Maintenance checklists | Reviewed family filtering, shared profiles, separate family checklists, import/export and versioned saving. Uses the shared admin shell/Manage menu. Save/import/export/reload controls remain visible in a sticky toolbar. Internal navigation and import replacement prompt before discarding unsaved edits. |

The legacy `/admin/assistance-network` route remains an authenticated redirect to Accounts. It is not an additional active workspace.

## Shared behavior

- A shared error boundary offers retry or return to Accounts when a server-rendered admin page fails.
- Middleware rejects admin mutation requests from absent/untrusted origins. Existing route-level authentication remains in place. Admin API responses are private/no-store.
- The existing admin viewport is retained. Headers, tables and filters were reviewed at the admin widths; this is not a new phone-native admin interface.
- No database migration or production data mutation is required by these changes.

## Verification

- TypeScript validation passed. The production bundle compiled successfully; page-data collection then stopped because deployment database credentials are not available locally (`/api/middleman/session`).
- Existing admin, business, asset-transfer, account-deletion, maintenance-catalogue and session-isolation tests.
- New executable tests for admin mutation origins, malformed request bodies, invalid account status and South African dashboard date boundaries.
- Browser harness renders the real components for every section and both Outcomes views using synthetic APIs. It checks document overflow, all twelve navigation links, Escape/focus restoration, directory retry, failed-filter recovery, checklist discard protection, and invoice usage increases/decreases.
- Browser screenshots at 1440px for all sections, plus 980px and 1920px for the principal data tables and checklist editor. Evidence is generated under `.next/admin-review-validation` and uploaded by the admin GitHub workflow.
- Existing canonical viewport/layout unit checks.

## Production verification still required

The browser harness deliberately does not sign into production. Live account opening, actual email/notification delivery, file capture/finalization, exports backed by live data, external map tiles, and real asset allocation/deletion were not exercised against customer records. Server guards and domain regression tests were reviewed, but these results do not establish that every production record is correct.

Marketplace, map and some outcome screens still load complete datasets before filtering/paging in the client. Server pagination and query profiling are worthwhile as usage grows; this PR does not redesign those data contracts. The weekly activity metric remains an estimate derived from activity pings, not measured working time. The work tracker is the appropriate source for reportable admin work.
