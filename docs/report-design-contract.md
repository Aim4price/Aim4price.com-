# Aim4price report design contract

## Approved visual references

The report styling is locked to the user-approved PDFs reviewed on 25 August 2026:

- `Aim4price-Estimate-Kubota-M8540.pdf` (generated 03 August 2026)
- `Maintenance Report(1).pdf` (generated 10 August 2026)

The reference PDFs contain live client information and are intentionally not committed to the repository.

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

Changing locked report CSS requires all of the following in the same pull request:

1. State explicitly that the pull request intentionally changes report design.
2. Generate representative valuation and multi-page maintenance PDFs.
3. Visually compare every page for typography, spacing, borders, page breaks, headers and footers.
4. Obtain explicit design approval.
5. Update the fingerprints in `tests/report-design-lock.test.mjs`.
6. Keep `npm run test:report-design` passing.

Do not update a fingerprint merely to make an incidental feature pull request pass.
