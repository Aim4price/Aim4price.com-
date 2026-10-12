# Aim4price report design contract

## 14 September 2026 Asset Map redesign

The owner explicitly requested that all reports adopt the Asset Map Tracking Report styling. This supersedes the monochrome requirement below. The historical references remain documented for context.

The shared theme is `lib/report-theme.ts`: pale green screen background, white report sheet, dark green Montserrat typography, thin green borders, subtly rounded sections, tinted summary cards, consistent Close / Save PDF / Print controls, and non-clipping multi-page print flow. Each report retains its own data, width, orientation and access checks. CSV/XLSX outputs remain structured exports, not HTML reports.

This is an intentional redesign. The new fingerprints protect the proposed changes, not a claim of completed visual approval. The PR must remain draft until the generated report evidence and authenticated opening checks have been reviewed. See `docs/report-audit-2026-09-14.md` for scope and verification limitations.

## Historical approved visual references

The report styling is locked to the user-approved PDFs reviewed on 25 August 2026:

- `Aim4price-Estimate-Kubota-M8540.pdf` (generated 03 August 2026)
- `Maintenance Report(1).pdf` (generated 10 August 2026)

The reference PDFs contain live client information and are intentionally not committed to the repository.

The report-set review on 26 August 2026 also covered representative Fuel, Maintenance, Depreciation Log, Cost of Ownership and Landini valuation exports. That review approved a deliberate clarity pass without replacing the established visual language.

## Required visual language

Canonical Aim4price reports must retain:

- white A4 pages with restrained black and grey typography;
- Montserrat as the primary typeface;
- the account or Aim4price logo at the upper left;
- report title and subtitle beside the logo;
- generated date and contact metadata aligned at the upper right;
- square, thin grey bordered summary, detail and record sections;
- strong black values with understated grey labels;
- clean page breaks and compact, legible tables or record cards;
- `Powered by Aim4price.com`, the report disclaimer and page numbering in the footer.

Large coloured banners, rounded application-style cards, generic `AIM4PRICE` mastheads, Helvetica-only output and alternate simplified PDF layouts are not approved.

## Rendering rule

The canonical HTML and CSS are the report. Chromium may render that source to PDF, but the PDF layer must never reinterpret the content or silently substitute a second template. If canonical rendering fails, return an actionable error and keep the approved design intact.

## Opening rule

Normal **Open PDF** actions must open the canonical HTML document directly and invoke the browser's native Print / Save PDF flow. They must not depend on server-side Chromium being available. A blank report tab must be created synchronously from the user's click before any asynchronous preparation so browser popup blocking cannot swallow the report.

Server-side PDF rendering is reserved for an explicit binary attachment or share operation. Both paths must receive the same canonical HTML; neither may introduce another visual template. `tests/report-opening-lock.test.mjs` protects this separation across register, owner, maintenance, fuel, depreciation, cost-of-ownership, umbrella and dealer report entry points.

## Deliberate redesign process

Changing locked report CSS requires all of the following before the pull request is merged:

1. State explicitly that the pull request intentionally changes report design.
2. Generate representative valuation and multi-page maintenance PDFs.
3. Visually compare every page for typography, spacing, borders, page breaks, headers and footers.
4. Obtain explicit design approval.
5. Update the fingerprints in `tests/report-design-lock.test.mjs`.
6. Keep `npm run test:report-design` passing.

Do not update a fingerprint merely to make an incidental feature pull request pass.

## 26 August 2026 clarity refinement

The corresponding draft pull request intentionally updates the locked Maintenance and Cost of Ownership/scan-report CSS to:

- prevent minimum-height footer flow from creating misleading near-empty pages;
- leave page numbering to the canonical PDF renderer, which has the real current and total page counts;
- make maintenance records easier to scan with explicit South African time, meter-aware labels, evidence wording and more compact detail grouping; and
- preserve the existing monochrome Montserrat layout, borders, spacing system, logo placement and disclaimer treatment.

The updated fingerprints record this deliberate change and remain subject to visual approval before merge.


## 12 October 2026 fuel ledger refinement

This is an intentional fuel-report redesign requested to align the ledger with Aim4price. The canonical report retains the shared pale-green Montserrat theme, with seven readable main columns and supporting details beneath each entry. Delivery totals and opening entries are separate; stock at export is explicitly not a historical closing balance.

Gauge increases are percentage points. Estimated litres before filling are shown only for a recorded full refill with a valid starting percentage and positive litres added. These are gauge-based estimates, not measured consumption or a determination of diesel-refund eligibility.

Representative valuation (one page), maintenance (ten pages) and fuel ledger (ten pages) PDFs were rendered and visually checked across every page, alongside desktop, tablet and mobile layout checks. The fuel CSS fingerprint records this deliberate redesign. Keep the pull request in draft pending design approval and authenticated report-opening review before merge.


## 12 October 2026 fuel asset identity refinement

The owner requested clearer links between each fuel entry and its asset. This intentional refinement adds a prominent asset heading, Serial / VIN and register / plate ID to each entry, with stronger visual separation. Identifiers come from the current linked register record, including fuel-slip entries; missing serials are explicitly marked Not recorded. Excel includes matching identifier columns without shifting existing formula references.

Representative valuation (1 page), maintenance (10 pages) and fuel ledger (14 pages for 25 detailed entries) PDFs were rendered and visually checked across every page, plus 390px, 768px and 1400px layouts. The updated fuel CSS fingerprint protects this deliberate change. Keep the PR in draft pending visual approval and authenticated opening review before merge.


## 12 October 2026 fuel slip and download refinement

The owner requested the fuel-slip export to use the main fuel report design, clickable source documents and GPS links, immediate format selection, and removal of late-entry wording. The canonical fuel renderer now lives in `lib/fuel-report.ts` and is shared by both export paths. Its existing CSS fingerprint is unchanged; the design lock follows the extracted renderer. Slip reports retain their purchase amounts, identifiers, activity, source documents and GPS rather than substituting storage totals.

Generated report labels use neutral entry wording while retaining the historical issue date, date added, missing-GPS information and original audit data. No database records are rewritten. Relative document links resolve against the request origin; Excel uses native hyperlinks.

Synthetic verification covers multi-page fuel ledger and slip PDFs, actual PDF link annotations, and download dialogs at 390px, 768px and 1280px. Keep the PR in draft for review of the requested slip-report layout; production account downloads have not been exercised.
