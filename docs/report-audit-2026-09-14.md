# Report audit — 14 September 2026

## Scope and implementation

| Report / entry points | Implementation | Change |
| --- | --- | --- |
| Individual asset valuation; Owner App valuation | lib/report-print.ts asset sheet | Shared Asset Map theme, photo cards, print flow |
| Register, filtered and umbrella valuation/status reports | lib/report-print.ts register builder | Same theme, metrics, record sections |
| Basic/advanced estimate; enhanced estimate photos | app/api/valuation/report/route.ts; enhanced route reuses its HTML | Same theme; no valuation calculation changes |
| Asset Register summary (single/all/combined) | app/api/asset-register/export/route.ts | Session-aware opening; theme; remove print clipping through shared print rules |
| Full register PDF (single/all/combined) | same export route | Canonical themed HTML replaces the separate hand-drawn PDF on active export paths; preserve original asset detail text, group attribution and VAT bases |
| Asset/umbrella fuel, maintenance and depreciation | app/api/asset-register/scan-report/route.ts | Shared theme, tables, section borders and print flow |
| Maintenance page, umbrella scheduled/completed and dealer maintenance | lib/asset-maintenance-report.ts | Same theme, full-width non-overlapping toolbar, screen-only narrow layout |
| Ownership costs / My Invoices; owner/dealer variations | lib/my-invoices-report.ts | Same theme, invoice record cards, toolbar and print flow |
| Fuel ledger, tank and fuel-slip reports | app/api/fuel/report/route.ts | Same theme; originating-session opening |
| Asset Map | app/api/asset-map/report/route.ts | Retains map-specific layout, tile readiness and photo grids; shares palette and focus treatment |
| Retainer work report | lib/admin-work-tracker-report.ts | Branded paper, compact green summary, standard toolbar and real print margins |
| Insurance review summary and detailed review | lib/insurance-report.ts | Standard toolbar, green paper layout, softer table headers, multi-page sections |

## Structured exports

Existing XLSX exports retain formulas, numbers, sheets and filters. Accountant reports (asset register, finance position, additions/disposals, value trend, cost ledger, fuel and market/accounting comparison) are CSV-only; CSS cannot style those files. Lifecycle financial model is XLSX-only. Admin asset-name export is structured data. They are not replaced with image or HTML downloads. QR labels are a separate print workflow and excluded from this report redesign.

## Opening failure

The old canonical opener navigated an empty tab directly to the API. With no usable referrer/client realm and app cookies present, middleware treats the request as ambiguous and removes session cookies. The summary route then returns HTTP 401. The repair fetches from the originating page with an explicit website/app realm before writing the canonical HTML to the synchronously opened tab. Server authentication, signed cookies, account type checks, asset selection, accountant sharing and dealer permissions remain in force.

The shared opener checks response type, rejects external URLs and redirects, and shows a safe error/retry page instead of JSON. Owner App report/Excel links and fuel/work report openers use the same path. Embedded XLSX links use the original session too.

## Verification and review gate

The editing environment failed to initialize. Changes were prepared via GitHub, not a local checkout. Do not interpret source inspection or tests with fixtures as a successful authenticated production report download.

Before merge:
- Run TypeScript and report regression tests in CI.
- Inspect representative portrait/landscape and multi-page report PDFs, including long names and missing data.
- Open each report from a real owner, dealer and Owner App session, including a browser with both website and app cookies.
- Check summary single/all/combined, umbrella filters, evidence links and XLSX downloads.
- Retain the draft status until the visual review is complete.

The legacy hand-drawn full-register helper functions remain unused for now; active export branches use the canonical HTML/PDF renderer and no alternate fallback.
