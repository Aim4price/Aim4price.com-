/**
 * Shared Asset Map visual language, intentionally adopted for all reports
 * on 14 September 2026. Layout-specific columns remain in each builder.
 * Append this after the report's structural CSS, never after its HTML.
 */
export const REPORT_THEME_CSS = `
  :root {
    color-scheme: light;
    --ink: #173c32; --strong: #103f35; --text: #173c32;
    --muted: #60756d; --faint: #81928c;
    --paper: #ffffff; --soft: #f1f7f4; --soft-2: #f8fbf9;
    --line: #d6e4dd; --line-strong: #b9d0c5;
    --brand: #103f35; --brand-secondary: #197454;
    --brand-soft: #eaf5ef; --brand-wash: #f5faf7;
    --bg: #edf4f0; --paper-soft: #f8fbf9;
    --brand-dark: #103f35; --brand-mid: #197454;
  }
  html, body { background: #edf4f0; color: var(--ink); font-family: "Montserrat", "Segoe UI", Arial, sans-serif; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .assetReportPage, .fullRegisterPage, .reportPage, .assetMapReportPage {
    border-radius: 10px; box-shadow: 0 16px 44px rgba(16,63,53,.13);
  }
  .assetReportHeader, .fullRegisterHeader, .topbar {
    border-color: var(--line-strong); break-inside: avoid;
  }
  .assetReportOverview, .fullRegisterHero, .reportPage .hero {
    border-radius: 8px; border-color: var(--line-strong);
  }
  .assetReportIdentity, .fullRegisterPanel, .reportPage .heroMain {
    background: linear-gradient(135deg,#fff,var(--brand-wash)); border-radius: 8px 0 0 8px;
  }
  .assetReportValuationCard, .fullRegisterValuePanel, .reportPage .heroStatus {
    background: var(--brand-soft); border-radius: 0 8px 8px 0;
  }
  .assetReportKicker, .fullRegisterPanelLabel, .fullRegisterAssetType, .reportPage .eyebrow {
    color: var(--brand-secondary); letter-spacing: .08em; font-weight: 700;
  }
  .assetReportTitle, .fullRegisterOwnerName, .reportPage .heroTitle {
    color: var(--brand); font-weight: 700; line-height: 1.12; overflow-wrap: anywhere;
  }
  .assetReportDocumentTitle strong, .fullRegisterTitleBlock strong, .reportPage .brand h1 {
    color: var(--brand); font-weight: 700; line-height: 1.15;
  }
  .assetReportSection, .assetReportSideCard, .assetReportMediaCard, .fullRegisterPanel,
  .fullRegisterAssetCard, .fullRegisterNoteCard, .assetReportNoteCard,
  .reportPage .panel, .reportPage .recordsSection {
    border-color: var(--line-strong); border-radius: 8px;
  }
  .assetReportSection h2, .assetReportSideCard h2, .fullRegisterSectionTitle,
  .reportPage .panel h2, .reportPage .sectionHeading h2 {
    color: var(--brand); font-weight: 700; line-height: 1.2;
    break-after: avoid;
  }
  .fullRegisterStatCard, .reportPage .statusGrid {
    border-color: var(--line-strong); border-radius: 7px; background: var(--brand-soft);
  }
  .fullRegisterStatCard { padding: 9px 11px; }
  .assetReportMaintenanceCard, .reportPage .maintenanceCard {
    border-radius: 7px; border-color: var(--line); background: #fff;
  }
  .assetReportMaintenanceHeader, .reportPage .maintenanceCardHead {
    background: var(--brand-wash); border-radius: 7px 7px 0 0;
  }
  .assetReportRow span, .assetReportMeta, .assetReportSummaryRow span,
  .assetReportValuationCard h2, .reportPage .heroMeta { color: var(--muted); }
  .assetReportRow { column-gap: 8px; padding: 3px 0; }
  .assetReportValue, .fullRegisterAssetValue strong, .fullRegisterValuePanel strong {
    max-width: 100%; white-space: normal; overflow-wrap: anywhere; line-height: 1.1;
    font-variant-numeric: tabular-nums;
  }
  .assetReportSummaryHeader { background: var(--brand-soft); padding: 5px 7px; }
  .assetReportSummaryRow { padding: 4px 7px; }
  .assetReportSummaryRow:nth-child(odd) { background: var(--brand-wash); }
  .assetReportTable thead th { background: var(--brand-soft); color: var(--strong); border-color: var(--line); }
  .assetReportTable td { border-color: var(--line); color: var(--ink); overflow-wrap: anywhere; }
  .assetReportTable tbody tr:nth-child(even) td { background: var(--brand-wash); }
  .assetReportTableWrap { border-color: var(--line); border-radius: 6px; }
  thead { display: table-header-group; }
  tr, figure { break-inside: avoid; }
  .assetReportMediaTile, .assetReportNotePhotoGrid figure, .fullRegisterNotePhotoGrid figure,
  .assetReportMaintenancePhoto {
    border: 1px solid var(--line); border-radius: 7px; background: var(--brand-wash);
  }
  .assetReportMediaTile img, .assetReportMaintenancePhoto img {
    object-fit: contain; background: var(--soft); border-radius: 6px 6px 0 0;
  }
  .assetReportScreenBar, .screenBar {
    border-color: var(--line); box-shadow: 0 10px 26px rgba(16,63,53,.08);
  }
  .assetReportButton, .screenButton {
    border-color: var(--line-strong); color: var(--strong); font-weight: 700;
  }
  .assetReportButtonPrimary, .screenButtonPrimary {
    background: var(--brand); border-color: var(--brand); color: #fff;
    box-shadow: 0 12px 22px rgba(16,63,53,.18);
  }
  .assetReportButton:focus-visible, .screenButton:focus-visible, .assetMapReportButton:focus-visible {
    outline: 3px solid #197454; outline-offset: 3px;
  }
  .assetReportScreenActions, .screenBarActions { flex-wrap: wrap; }
  .assetReportFooter, .fullRegisterFooter, .reportPage .footer {
    position: static; margin-top: 14px; padding-top: 9px;
    border-color: var(--line-strong); break-inside: avoid;
  }
  .assetReportDisclaimer, .fullRegisterDisclaimer, .reportPage .footer p { color: var(--muted); }
  /* A report can grow beyond one page. Never reserve or clip a fixed sheet. */
  .assetReportInner { padding-bottom: 0; }
  .assetReportWideSection:has(table), .assetReportWideSection:has(.assetReportMaintenanceList), .assetReportSummaryStack { break-inside: auto; }
  .assetReportPageNumber, .fullRegisterFooterRight { display: none; }
  .reportFullAsset { break-inside: avoid; }
  .reportFullAsset p { margin: 3px 0; line-height: 1.4; overflow-wrap: anywhere; }
  .reportFullDetails { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 20px; }
  .reportFullDetails > div { min-width: 0; }
  @media screen and (max-width: 600px) { .reportFullDetails { grid-template-columns: minmax(0, 1fr); } }
  .reportFullRegisterHeading { break-inside: avoid; padding: 9px 11px; background: var(--brand-soft); border: 1px solid var(--line-strong); border-radius: 8px; break-after: avoid; }
  .reportFullRegisterHeading h2 { margin: 0 0 4px; color: var(--brand); }
  .reportFullRegisterHeading p { margin: 0; color: var(--muted); }
  @media screen {
    .assetReportInner > *, .assetReportMainStack, .assetReportFullStack,
    .assetReportSection, .assetReportSideCard, .assetReportTableWrap { min-width: 0; max-width: 100%; }
    .assetReportMainStack, .assetReportFullStack { grid-template-columns: minmax(0, 1fr); }
    .assetReportTableWrap { overflow-x: auto; }
  }
  @media screen and (max-width: 900px) {
    .assetMapReportInner > *, .assetMapReportKeyRows { min-width: 0; }
    .assetMapReportKeyRow { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .assetMapReportMarkerNumber, .assetMapReportAssetCell { grid-column: 1 / -1; }
    .assetMapReportPage { padding: 20px 16px; }
    .assetMapReportPhotoGrid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .assetMapReportPhotoGrid .assetMapReportPhotoTile { grid-column: auto; }
  }
  @media screen and (max-width: 760px) {

    .assetReportPage, .fullRegisterPage, .reportPage { width: calc(100% - 20px); padding: 20px 16px; }
    .assetReportValuationCard, .fullRegisterValuePanel, .reportPage .heroStatus { border-radius: 0 0 8px 8px; }
    .assetReportIdentity, .reportPage .heroMain { border-radius: 8px 8px 0 0; }
    .assetReportTableWrap { overflow-x: auto; }
    .assetReportScreenActions { display: flex; flex-wrap: wrap; }
    .assetReportScreenActions > * { flex: 1 1 120px; width: auto; }
  }
  @media print {
    :root, html, body { background: #fff; }
    .assetReportScreenBar, .screenBar, .assetMapReportScreenBar { display: none !important; }
    .assetReportPage, .fullRegisterPage, .reportPage, .assetMapReportPage {
      width: auto; height: auto; min-height: 0; margin: 0; padding: 0;
      border-radius: 0; box-shadow: none; overflow: visible;
    }
    .assetReportInner, .assetMapReportInner { height: auto; min-height: 0; padding-bottom: 0; }
    .assetReportTableWrap { overflow: visible; }
    .assetReportFooter, .fullRegisterFooter, .reportPage .footer { position: static; margin-top: 12px; }
    .assetReportSection:has(table), .assetReportNotesSection { break-inside: auto; }
    .assetReportSectionHeading, .assetReportSection h2, .reportPage .sectionHeading { break-after: avoid; page-break-after: avoid; }
    .assetReportSection:has(.assetReportEmpty) { break-inside: avoid; }
    .reportPage .footerPage::after { content: none; }
    .page h2, .page h3 { break-after: avoid; page-break-after: avoid; }
    /* Grid containers can move a whole register onto the next sheet. */
    .assetReportSummaryStack, .fullRegisterAssetList { display: block; break-inside: auto; }
    .assetReportSummaryStack > * + * { margin-top: 10px; }
    .fullRegisterAssetSection { break-inside: auto; }
    .fullRegisterAssetList > * + * { margin-top: 3.8mm; }
  }
`;

/** Shared toolbar for reports that previously used floating print buttons. */
export const REPORT_TOOLBAR_HTML = `
  <div class="assetReportScreenBar">
    <p class="assetReportScreenText">Save or print this report.</p>
    <div class="assetReportScreenActions">
      <button type="button" class="assetReportButton" onclick="window.close()">Close</button>
      <button type="button" class="assetReportButton assetReportButtonPrimary" onclick="window.print()">Save PDF / Print</button>
    </div>
  </div>
`;

/** Standalone reports also need the toolbar's structural rules. */
export const REPORT_TOOLBAR_CSS = `
  .assetReportScreenBar { position: sticky; top: 0; z-index: 20; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 16px; background: rgba(255,255,255,.97); border-bottom: 1px solid var(--line); }
  .assetReportScreenText { margin: 0; color: var(--muted); font-size: 12px; }
  .assetReportScreenActions { display: flex; gap: 8px; flex-wrap: wrap; }
  .assetReportButton { appearance: none; display: inline-flex; align-items: center; justify-content: center; min-height: 42px; padding: 0 16px; border: 1px solid var(--line-strong); border-radius: 999px; font: inherit; font-size: 12px; font-weight: 700; background: #fff; color: var(--strong); cursor: pointer; text-decoration: none; }
  .assetReportButtonPrimary { background: var(--brand); color: #fff; }
  @media screen and (max-width: 540px) { .assetReportScreenBar { flex-direction: column; align-items: stretch; } }
  @media print { .assetReportScreenBar { display: none !important; } }
`;
