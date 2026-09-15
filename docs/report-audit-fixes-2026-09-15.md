# Report and export corrections — 15 September 2026

This change intentionally improves report presentation following the report audit.

- Accountant fuel downloads use the full report history, retain asset identity when names match, exclude stock receipts from asset-usage totals and distinguish missing cost information. Issue dates and usage units are explicit. Additions/disposals honours asset selection.
- Insurance inventory lists current-policy sums with their original VAT basis and labels shared schedule amounts. It no longer picks the first amount from an arbitrary policy or calls an unknown VAT basis inclusive.
- Excel preserves cents, three-decimal quantities, six-decimal coordinates, native South African dates, and reference text. Wide sheets paginate at readable size and repeat headings/first columns. Fuel slips also have a compact printable summary.
- Fuel-slip reference fields preserve long identifiers while free-text payment information remains masked. PDFs include owner identification and a resolved logo.
- Full-register details are stacked. Lifecycle workbooks explicitly identify their snapshot behaviour; finance formulas remain local to the comparison sheet.
- Accountant/admin CSV text is protected against formula interpretation.

## Verification

TypeScript and 87 report/export regression tests pass. New behavioural cases cover 100 fuel events, duplicate asset names, policy/VAT selection, numeric/reference preservation, native dates and authorized PDF generation. The existing PDF fixture suite is extended with a populated fuel-slip report.

Local Chromium runs use a pipe transport and GPU-disabled launch arguments because this environment cannot use the default launch configuration. Production renderer code is unchanged. Spreadsheet print checks use LibreOffice: the compact fuel-slip summary retains readable type, full-detail pages print at 11pt, and GPS values retain six decimals.

The broader accountant workspace suite has five failures also present on unchanged main: permission-source assertion, manage-modal copy, estimate navigation, filter styling and fuel extraction UI assertion. These are outside this report correction.

Keep this PR draft for review. Live authenticated owner/dealer/accountant downloads and external map/image availability still need acceptance checking. No schema migration is required.
