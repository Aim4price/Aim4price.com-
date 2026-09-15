# Report and export corrections — 15 September 2026

This change intentionally improves report presentation following the report audit.

- Accountant fuel downloads use the full report history, retain asset identity when names match, exclude stock receipts from asset-usage totals and distinguish missing cost information. Issue dates and usage units are explicit. Additions/disposals honours asset selection.
- Insurance inventory lists current-policy sums with their original VAT basis and labels shared schedule amounts. It no longer picks the first amount from an arbitrary policy or calls an unknown VAT basis inclusive.
- Excel preserves cents, three-decimal quantities, six-decimal coordinates, native South African dates, and reference text. Wide sheets paginate at readable size and repeat headings/first columns. Fuel slips also have a compact printable summary.
- Fuel-slip reference fields preserve long identifiers while free-text payment information remains masked. PDFs include owner identification and a resolved logo.
- Full-register details use stacked fields in two columns (one on narrow screens), retaining the summary first. The 25-asset fixture now prints on 8 pages instead of 14. Lifecycle workbooks use protected snapshot values on every sheet; partial finance formulas are removed so edits cannot silently make sheets disagree. The UI says Export snapshot and the workbook directs assumption changes back to Aim4price. Sheet protection prevents accidental edits; it is not tamper protection.
- Accountant/admin CSV text is protected against formula interpretation.

## Verification

TypeScript and 87 report/export regression tests pass. New behavioural cases cover 100 fuel events, duplicate asset names, policy/VAT selection, numeric/reference preservation, native dates and authorized PDF generation. The existing PDF fixture suite is extended with a populated fuel-slip report.

Local Chromium runs use a pipe transport and GPU-disabled launch arguments because this environment cannot use the default launch configuration. Production renderer code is unchanged. Spreadsheet print checks use LibreOffice: the compact fuel-slip summary retains readable type, full-detail pages print at 11pt, and GPS values retain six decimals.

Follow-up: corrected five stale accountant test expectations to match the existing permission helper, modal copy, shared-header estimate link, visible scrollbar and capture-request upload endpoint. Six new behavioural tests execute the permission gates for read-only, revoked and out-of-register access. No production permission checks were weakened. Both accountant suites are included in CI. After the follow-up and rebase onto merged main, all 89 tests in the combined report, accountant, lifecycle-export and account-isolation run pass, as does TypeScript. The generated lifecycle workbook contains eight protected sheets and no partial formulas.

The first report PR (#861) was merged. This follow-up remains for review. Live follow-up: secure sign-in succeeded. The owner full-register print report opened with all 22 assets; its logo and seven asset images loaded. The deployed report uses an older layout, so this does not validate deployment of the new presentation. The XLSX download was triggered but the browser operation timed out; completion is unconfirmed. Dealer/accountant sessions and map availability remain unverified. No schema migration is required.
