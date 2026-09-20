# Admin operations improvements — 20 September 2026

Follow-up to the merged admin review (#1002), based on main `d3aa09cc8491788d7b2472571fc2d1d4a81e2104`. For manual review and merge. Billing is out of scope.

## Delivered

- **Dashboard:** a Needs attention section with counts and direct filtered links for pending accounts, overdue capture, unclaimed capture, requests needing matching/information, and owner approvals. Groups explicitly overlap. A refresh button reloads server data. Unavailable attention sources show Unavailable rather than zero.
- **Accounts:** real status filtering with clickable summary cards; clearing filters resets the account scope. Exact account links open the relevant account options. Email is visible alongside existing contact/account details. Account workspaces link to that customer's capture requests, work history and Discovery assets.
- **Capture Queue:** database pagination in 50-row pages, matching total counts, Previous/Next controls, page resets after filter changes and recovery when the last page becomes empty. Adds Unclaimed and Declined filters and exposes existing needs-matching counts. Account-scoped links, refresh, customer workspace links, clearer table lines and overdue dates make work easier to follow. Global summary counts are explicitly distinguished from filtered document totals.
- **Correctness:** All requests now explicitly sends `status=all`; omitting it previously selected open requests on the server. Completed today filters by completion timestamp before pagination, rather than filtering an already capped list. Both its list and summary use South African midnight independently of database/server timezone. Invalid pages/type/channel/status return 400. Existing admin authorization and parameterized queries remain in place.
- **Work Tracker:** account links preselect both work history and the start-work account without starting a timer. Unknown accounts show an explanatory notice. Unsaved work notes prompt before link navigation or closing/reloading the tab.

## Validation

- TypeScript passed. The production bundle compiled successfully; page-data collection then failed at `/api/dealer/staff` because deployment database credentials are unavailable locally. This is not a full build pass.
- 216 admin/capture/assisted-capture tests passed, including executable API tests and PGlite checks for South African year-boundary completion counts, owner scope and unclaimed filtering.
- Updated two stale notification source assertions to accommodate existing cost-budget categories. Notification production code was unchanged.
- Browser fixtures render every admin section and both Outcomes views. Key pages are checked at 980/1440/1920 pixels; dashboard, Accounts and Capture Queue screenshots were visually inspected.
- Browser tests cover status filtering, initial account/status links, scoped queue and work-history requests, page navigation/reset, explicit All requests, and cancelling navigation with an unsaved work note, in addition to the previous recovery and invoice-usage checks.
- Browser fixtures use synthetic APIs. They do not prove production email delivery, finalization against customer data, or production query timings.

## Boundaries and follow-up

No schema migration or production data change. Existing capture claiming, reasons, notes and audit events are reused. This does not add multi-admin permissions, a global account audit log, customer billing or email delivery tracking. Marketplace, Map and Outcomes retain their existing data loading; server pagination for those reports is a separate data-contract change. Capture pagination uses the existing 100,000-row offset ceiling. Offset pages can shift if another admin changes the queue; refresh updates the current view.

Unsaved-note protection covers page links and browser unload; it does not add browser-history interception. No live customer actions were performed. Merge manually after review.
