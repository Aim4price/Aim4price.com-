import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '../../../../lib/auth-session';
import { getFuelStorageById, listFuelEventsForReport, listFuelLedger, type FuelLedgerEvent } from '../../../../lib/fuel-ledger';
import { getAssetRegisterReportLogoUrl } from '../../../../lib/asset-registers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type KeyValueRow = {
  label: string;
  value: string;
  valueHtml?: string;
};

type SummaryCard = {
  label: string;
  value: string;
  subtext: string;
};

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : String(value ?? '').trim();
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeSpaces(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function formatDate(value = new Date()): string {
  return new Intl.DateTimeFormat('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(value);
}

function formatDateTime(value?: string | null): string {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  return new Intl.DateTimeFormat('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Africa/Johannesburg',
  }).format(date);
}

function formatLitres(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-';
  return `${value.toLocaleString('en-ZA', { maximumFractionDigits: 2 })} L`;
}

function formatPercent(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-';
  return `${Math.max(0, Math.min(100, Math.round(value)))}%`;
}

function formatLocation(event: FuelLedgerEvent): string {
  const text = asText(event.locationText);
  if (text) return text;

  if (typeof event.latitude === 'number' && Number.isFinite(event.latitude) && typeof event.longitude === 'number' && Number.isFinite(event.longitude)) {
    return `GPS ${event.latitude.toFixed(6)}, ${event.longitude.toFixed(6)}`;
  }

  return '-';
}

function eventTypeLabel(value: string): string {
  if (value === 'opening_balance') return 'Opening balance';
  if (value === 'stock_in') return 'Stock in';
  if (value === 'asset_issue') return 'Asset issue';
  if (value === 'dip') return 'Manual dip';
  return 'Adjustment';
}

function slugifyFileSegment(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || 'fuel-ledger-report';
}

function parseReportYear(value: string): number | null {
  if (!/^\d{4}$/.test(value)) return null;
  const year = Number(value);
  return year >= 2000 && year <= 2100 ? year : null;
}

function parseReportMonth(value: string): number | null {
  if (!/^\d{1,2}$/.test(value)) return null;
  const month = Number(value);
  return month >= 1 && month <= 12 ? month : null;
}

function buildReportDateRange(year: number | null, month: number | null): { fromIso?: string; toIso?: string; label: string } {
  if (!year) {
    return { label: 'All available entries' };
  }

  if (month) {
    const from = new Date(Date.UTC(year, month - 1, 1));
    const to = new Date(Date.UTC(year, month, 1));
    const label = new Intl.DateTimeFormat('en-ZA', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(from);
    return { fromIso: from.toISOString(), toIso: to.toISOString(), label };
  }

  return {
    fromIso: new Date(Date.UTC(year, 0, 1)).toISOString(),
    toIso: new Date(Date.UTC(year + 1, 0, 1)).toISOString(),
    label: String(year),
  };
}

function renderRows(rows: KeyValueRow[], emptyText = 'No details available.'): string {
  const visibleRows = rows.filter((row) => asText(row.label));

  if (!visibleRows.length) {
    return `<div class="assetReportEmpty">${escapeHtml(emptyText)}</div>`;
  }

  return `
    <div class="assetReportRows">
      ${visibleRows
        .map(
          (row) => `
            <div class="assetReportRow">
              <span>${escapeHtml(row.label)}</span>
              <strong>${row.valueHtml ?? escapeHtml(row.value || '-')}</strong>
            </div>
          `,
        )
        .join('')}
    </div>
  `;
}

function renderFuelEventTable(events: FuelLedgerEvent[]): string {
  if (!events.length) {
    return '<div class="assetReportEmpty">No fuel ledger entries have been captured for this report period.</div>';
  }

  const rows = events
    .map((event) => {
      const asset = event.assetTitle || event.assetPlateLabel || '-';
      const note = normalizeSpaces(event.note) || '-';

      return `
        <tr>
          <td>${escapeHtml(formatDateTime(event.createdAtIso))}</td>
          <td>${escapeHtml(eventTypeLabel(event.eventType))}</td>
          <td>${escapeHtml(event.storageName || '-')}</td>
          <td>${escapeHtml(asset)}</td>
          <td>${escapeHtml(formatLitres(event.litres))}</td>
          <td>${escapeHtml(formatLitres(event.storageLevelBefore))}</td>
          <td>${escapeHtml(formatLitres(event.storageLevelAfter))}</td>
          <td><strong>${escapeHtml(formatPercent(event.assetFuelPercentAfter))}</strong></td>
          <td>${escapeHtml(event.operatorName || '-')}</td>
          <td>${escapeHtml(formatLocation(event))}</td>
          <td>${escapeHtml(note.length > 170 ? `${note.slice(0, 167)}...` : note)}</td>
        </tr>
      `;
    })
    .join('');

  return `
    <div class="assetReportTableWrap">
      <table class="assetReportTable assetReportFuelLedgerTable">
        <thead>
          <tr>
            <th>Date / Time</th>
            <th>Type</th>
            <th>Storage</th>
            <th>Asset</th>
            <th>Litres</th>
            <th>Before</th>
            <th>After</th>
            <th>Asset Fuel</th>
            <th>Operator</th>
            <th>Location</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function buildReportHtml(options: {
  title: string;
  subtitle: string;
  generatedAt: string;
  ownerEmail: string;
  logoUrl: string;
  dateRangeLabel: string;
  storageName: string;
  storageCode: string;
  storageFuelType: string;
  totalIssued: number;
  totalStockIn: number;
  currentLitres: number;
  storageCount: number;
  eventCount: number;
  events: FuelLedgerEvent[];
}): string {
  const cards: SummaryCard[] = [
    { label: 'Current Storage', value: formatLitres(options.currentLitres), subtext: 'Current ledger stock' },
    { label: 'Fuel Issued', value: formatLitres(options.totalIssued), subtext: 'Issued to assets' },
    { label: 'Fuel Filled', value: formatLitres(options.totalStockIn), subtext: 'Opening balance and stock in' },
    { label: 'Entries', value: options.eventCount.toLocaleString('en-ZA'), subtext: options.eventCount === 1 ? 'Fuel movement' : 'Fuel movements' },
  ];

  const reportRows: KeyValueRow[] = [
    { label: 'Period', value: options.dateRangeLabel },
    { label: 'Storage', value: options.storageName },
    { label: 'Fuel Type', value: options.storageFuelType },
    { label: 'Storage Code', value: options.storageCode },
  ];

  const summaryRows: KeyValueRow[] = [
    { label: 'Storage Units', value: options.storageCount.toLocaleString('en-ZA') },
    { label: 'Fuel Issued', value: formatLitres(options.totalIssued) },
    { label: 'Fuel Filled', value: formatLitres(options.totalStockIn) },
    { label: 'Current Stock', value: formatLitres(options.currentLitres) },
  ];

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(options.title)} - Aim4price Fuel Ledger</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
    <style>
      :root {
        color-scheme: light;
        --ink: #111827;
        --strong: #070b12;
        --muted: #5f6b7a;
        --paper: #ffffff;
        --soft: #f5f6f8;
        --soft-2: #fafbfc;
        --line: #d7dde5;
        --line-strong: #b9c2ce;
      }

      * {
        box-sizing: border-box;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      @page {
        size: A4 landscape;
        margin: 8mm 9mm 8mm;
      }

      html,
      body {
        margin: 0;
        padding: 0;
        background: #eef1f4;
        color: var(--ink);
        font-family: "Montserrat", "Segoe UI", Arial, Helvetica, sans-serif;
        font-size: 9.4px;
        line-height: 1.35;
      }

      .assetReportScreenBar {
        position: sticky;
        top: 0;
        z-index: 10;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 14px 18px;
        background: rgba(255, 255, 255, 0.96);
        border-bottom: 1px solid #d7dce2;
      }

      .assetReportScreenText {
        color: var(--muted);
        font-size: 13px;
      }

      .assetReportScreenActions {
        display: flex;
        gap: 10px;
      }

      .assetReportButton {
        appearance: none;
        min-height: 38px;
        padding: 0 16px;
        border: 1px solid #cfd5dd;
        border-radius: 999px;
        background: #ffffff;
        color: var(--ink);
        font: inherit;
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
      }

      .assetReportButtonPrimary {
        border-color: var(--strong);
        background: var(--strong);
        color: #ffffff;
      }

      .assetReportPage {
        width: min(100%, 297mm);
        min-height: 210mm;
        margin: 18px auto;
        padding: 10mm 10mm 8mm;
        background: var(--paper);
        box-shadow: 0 16px 44px rgba(17, 24, 39, 0.13);
      }

      .assetReportInner {
        position: relative;
        display: flex;
        min-height: calc(210mm - 18mm);
        flex-direction: column;
      }

      .assetReportHeader {
        display: grid;
        grid-template-columns: 22mm minmax(0, 1fr) 68mm;
        gap: 12px;
        align-items: center;
        padding-bottom: 10px;
        border-bottom: 1px solid var(--line-strong);
      }

      .assetReportLogoWrap {
        display: flex;
        align-items: center;
        justify-content: flex-start;
        min-height: 18mm;
      }

      .assetReportLogo {
        display: block;
        width: 18mm;
        height: auto;
        object-fit: contain;
      }

      .assetReportDocumentTitle strong {
        display: block;
        color: var(--strong);
        font-size: 16px;
        line-height: 1.05;
        font-weight: 800;
        letter-spacing: -0.025em;
      }

      .assetReportDocumentTitle span {
        display: block;
        margin-top: 5px;
        color: var(--muted);
        font-size: 8.9px;
        font-weight: 600;
        letter-spacing: 0.01em;
      }

      .assetReportHeaderMeta {
        display: grid;
        gap: 4px;
        color: var(--muted);
        font-size: 8.3px;
      }

      .assetReportMetaLine {
        display: grid;
        grid-template-columns: 24mm minmax(0, 1fr);
        gap: 7px;
        align-items: baseline;
      }

      .assetReportMetaLine span {
        color: var(--muted);
        font-weight: 600;
      }

      .assetReportMetaLine strong {
        color: var(--strong);
        font-weight: 700;
        text-align: right;
        word-break: break-word;
      }

      .assetReportOverview {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 68mm;
        align-items: stretch;
        margin-top: 11px;
        border: 1px solid var(--line-strong);
        background: #ffffff;
      }

      .assetReportIdentity {
        min-width: 0;
        padding: 11px 13px 12px;
      }

      .assetReportKicker {
        margin: 0 0 6px;
        color: var(--muted);
        font-size: 8.1px;
        font-weight: 800;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }

      .assetReportTitle {
        margin: 0;
        color: var(--strong);
        font-size: 21.5px;
        line-height: 1.05;
        font-weight: 800;
        letter-spacing: -0.045em;
      }

      .assetReportMeta {
        margin: 7px 0 0;
        color: #3f4652;
        font-size: 9.2px;
        line-height: 1.35;
        font-weight: 600;
      }

      .assetReportValuationCard {
        display: flex;
        flex-direction: column;
        justify-content: center;
        padding: 11px 12px;
        border-left: 1px solid var(--line-strong);
        background: var(--soft-2);
      }

      .assetReportValuationCard h2 {
        margin: 0 0 6px;
        color: #2b313b;
        font-size: 8.8px;
        line-height: 1.1;
        font-weight: 800;
        letter-spacing: 0.07em;
        text-transform: uppercase;
      }

      .assetReportValue {
        display: block;
        margin: 0;
        color: var(--strong);
        font-size: 30px;
        line-height: 0.96;
        font-weight: 800;
        letter-spacing: -0.055em;
        white-space: nowrap;
      }

      .assetReportVat {
        display: block;
        margin-top: 4px;
        color: var(--muted);
        font-size: 8.5px;
        font-weight: 600;
      }

      .assetReportValueMeta {
        display: grid;
        gap: 4px;
        margin-top: 10px;
        padding-top: 8px;
        border-top: 1px solid var(--line);
      }

      .assetReportValueMeta div,
      .assetReportRecordRows .assetReportRow {
        display: grid;
        grid-template-columns: 26mm minmax(0, 1fr);
        gap: 7px;
        min-height: 17px;
        align-items: baseline;
      }

      .assetReportValueMeta span,
      .assetReportRecordRows .assetReportRow span {
        color: var(--muted);
        font-size: 8.2px;
        font-weight: 700;
      }

      .assetReportValueMeta strong,
      .assetReportRecordRows .assetReportRow strong {
        color: var(--strong);
        font-size: 8.3px;
        font-weight: 700;
        text-align: right;
        word-break: break-word;
      }

      .assetReportContentGrid {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 68mm;
        gap: 12px;
        align-items: start;
        margin-top: 12px;
      }

      .assetReportMainStack,
      .assetReportFullStack {
        display: grid;
        gap: 10px;
      }

      .assetReportFullStack {
        margin-top: 10px;
      }

      .assetReportSection,
      .assetReportSideCard {
        break-inside: avoid;
      }

      .assetReportSection {
        padding: 10px 11px 11px;
        border: 1px solid var(--line-strong);
        background: #ffffff;
      }

      .assetReportSection h2,
      .assetReportSideCard h2 {
        margin: 0 0 8px;
        color: var(--strong);
        font-size: 10.8px;
        line-height: 1.1;
        font-weight: 800;
        letter-spacing: -0.01em;
      }

      .assetReportRows {
        width: 100%;
        border-top: 1px solid var(--line);
      }

      .assetReportRow {
        display: grid;
        grid-template-columns: 34mm minmax(0, 1fr);
        min-height: 20px;
        align-items: center;
        border-bottom: 1px solid var(--line);
      }

      .assetReportRow span {
        color: #38404c;
        font-size: 8.8px;
        line-height: 1.3;
        font-weight: 600;
      }

      .assetReportRow strong {
        color: var(--strong);
        font-size: 9px;
        line-height: 1.3;
        font-weight: 700;
        word-break: break-word;
      }

      .assetReportEmpty {
        padding: 8px 0;
        color: var(--muted);
        font-size: 8.8px;
        font-weight: 600;
      }

      .assetReportSide {
        display: grid;
        gap: 10px;
      }

      .assetReportSideCard {
        padding: 10px 10px 9px;
        border: 1px solid var(--line-strong);
        background: #ffffff;
      }

      .assetReportWideSection {
        width: 100%;
        break-inside: auto;
      }

      .assetReportSectionHeading {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 12px;
        align-items: start;
        margin-bottom: 8px;
      }

      .assetReportSectionHeading h2 {
        margin-bottom: 4px;
      }

      .assetReportSectionHeading p {
        margin: 0;
        max-width: 204mm;
        color: var(--muted);
        font-size: 8px;
        line-height: 1.35;
        font-weight: 600;
      }

      .assetReportSectionHeading > strong {
        display: inline-flex;
        min-width: 24mm;
        min-height: 22px;
        align-items: center;
        justify-content: center;
        padding: 3px 8px;
        border: 1px solid var(--line);
        background: var(--soft-2);
        color: var(--strong);
        font-size: 8px;
        font-weight: 800;
        text-transform: uppercase;
        white-space: nowrap;
      }

      .assetReportTableWrap {
        width: 100%;
        overflow: visible;
        border-top: 1px solid var(--line);
      }

      .assetReportTable {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
      }

      .assetReportTable th,
      .assetReportTable td {
        padding: 6px 5px 6px 0;
        border-bottom: 1px solid var(--line);
        color: #38404c;
        font-size: 7.25px;
        line-height: 1.35;
        text-align: left;
        vertical-align: top;
        overflow-wrap: anywhere;
        word-break: normal;
      }

      .assetReportTable th {
        color: var(--strong);
        font-size: 6.6px;
        line-height: 1.2;
        font-weight: 800;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }

      .assetReportTable td strong {
        color: var(--strong);
        font-weight: 800;
      }

      .assetReportFuelLedgerTable th:nth-child(1),
      .assetReportFuelLedgerTable td:nth-child(1) { width: 23mm; }
      .assetReportFuelLedgerTable th:nth-child(2),
      .assetReportFuelLedgerTable td:nth-child(2) { width: 18mm; }
      .assetReportFuelLedgerTable th:nth-child(3),
      .assetReportFuelLedgerTable td:nth-child(3) { width: 24mm; }
      .assetReportFuelLedgerTable th:nth-child(4),
      .assetReportFuelLedgerTable td:nth-child(4) { width: 26mm; }
      .assetReportFuelLedgerTable th:nth-child(5),
      .assetReportFuelLedgerTable td:nth-child(5),
      .assetReportFuelLedgerTable th:nth-child(6),
      .assetReportFuelLedgerTable td:nth-child(6),
      .assetReportFuelLedgerTable th:nth-child(7),
      .assetReportFuelLedgerTable td:nth-child(7),
      .assetReportFuelLedgerTable th:nth-child(8),
      .assetReportFuelLedgerTable td:nth-child(8) { width: 14mm; }
      .assetReportFuelLedgerTable th:nth-child(9),
      .assetReportFuelLedgerTable td:nth-child(9) { width: 23mm; }
      .assetReportFuelLedgerTable th:nth-child(10),
      .assetReportFuelLedgerTable td:nth-child(10) { width: 34mm; }

      .assetReportFooter {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 10px;
        align-items: end;
        margin-top: auto;
        padding-top: 12px;
        border-top: 1px solid var(--line-strong);
      }

      .assetReportPowered {
        margin: 0 0 4px;
        color: var(--strong);
        font-size: 8.2px;
        font-weight: 700;
      }

      .assetReportDisclaimer {
        max-width: 236mm;
        color: #323a45;
        font-size: 7.35px;
        line-height: 1.35;
        font-style: italic;
      }

      .assetReportPageNumber {
        color: var(--strong);
        font-size: 8px;
        font-weight: 700;
        white-space: nowrap;
      }

      @media screen and (max-width: 760px) {
        .assetReportPage {
          padding: 24px;
        }

        .assetReportHeader,
        .assetReportOverview,
        .assetReportContentGrid,
        .assetReportSectionHeading {
          grid-template-columns: 1fr;
        }

        .assetReportValuationCard {
          border-left: 0;
          border-top: 1px solid var(--line-strong);
        }

        .assetReportHeaderMeta,
        .assetReportMetaLine strong,
        .assetReportValueMeta strong,
        .assetReportRecordRows .assetReportRow strong {
          text-align: left;
        }
      }

      @media print {
        html,
        body {
          background: #ffffff;
        }

        .assetReportScreenBar {
          display: none !important;
        }

        .assetReportPage {
          width: auto;
          min-height: 194mm;
          margin: 0;
          padding: 0;
          box-shadow: none;
          overflow: visible;
        }

        .assetReportInner {
          min-height: 194mm;
        }
      }
    </style>
  </head>
  <body>
    <div class="assetReportScreenBar">
      <div class="assetReportScreenText">Choose <strong>Save as PDF</strong> in the print dialog to download this fuel ledger report.</div>
      <div class="assetReportScreenActions">
        <button type="button" class="assetReportButton" onclick="window.close()">Close</button>
        <button type="button" class="assetReportButton assetReportButtonPrimary" onclick="window.print()">Print / Save PDF</button>
      </div>
    </div>

    <main class="assetReportPage">
      <div class="assetReportInner">
        <header class="assetReportHeader">
          <div class="assetReportLogoWrap">${options.logoUrl ? `<img class="assetReportLogo" src="${escapeHtml(options.logoUrl)}" alt="Logo" />` : ''}</div>
          <div class="assetReportDocumentTitle">
            <strong>Fuel Ledger Report</strong>
            <span>Aim4price fuel tracking system</span>
          </div>
          <div class="assetReportHeaderMeta">
            <div class="assetReportMetaLine"><span>Generated</span><strong>${escapeHtml(options.generatedAt)}</strong></div>
            ${options.ownerEmail ? `<div class="assetReportMetaLine"><span>Email</span><strong>${escapeHtml(options.ownerEmail)}</strong></div>` : ''}
          </div>
        </header>

        <section class="assetReportOverview">
          <div class="assetReportIdentity">
            <p class="assetReportKicker">Fuel Ledger</p>
            <h1 class="assetReportTitle">${escapeHtml(options.title)}</h1>
            <p class="assetReportMeta">${escapeHtml(options.subtitle)}</p>
          </div>

          <aside class="assetReportValuationCard">
            <h2>${escapeHtml(cards[1].label)}</h2>
            <strong class="assetReportValue">${escapeHtml(cards[1].value)}</strong>
            <span class="assetReportVat">${escapeHtml(cards[1].subtext)}</span>
            <div class="assetReportValueMeta">
              <div><span>Period</span><strong>${escapeHtml(options.dateRangeLabel)}</strong></div>
              <div><span>Entries</span><strong>${escapeHtml(String(options.eventCount))}</strong></div>
            </div>
          </aside>
        </section>

        <div class="assetReportContentGrid">
          <div class="assetReportMainStack">
            <section class="assetReportSection">
              <h2>Fuel Summary</h2>
              ${renderRows(cards.map((card) => ({ label: card.label, value: `${card.value} - ${card.subtext}` })), 'No fuel summary available.')}
            </section>
          </div>

          <aside class="assetReportSide">
            <section class="assetReportSideCard assetReportRecordRows">
              <h2>Report Filters</h2>
              ${renderRows(reportRows, 'No report filters available.')}
            </section>

            <section class="assetReportSideCard assetReportRecordRows">
              <h2>Ledger Totals</h2>
              ${renderRows(summaryRows, 'No ledger totals available.')}
            </section>
          </aside>
        </div>

        <div class="assetReportFullStack">
          <section class="assetReportSection assetReportWideSection">
            <div class="assetReportSectionHeading">
              <div>
                <h2>Fuel Movement Records</h2>
                <p>Each line shows stock movement, asset issue details, storage balance before and after, operator and GPS location where available.</p>
              </div>
              <strong>${escapeHtml(String(options.eventCount))} ${options.eventCount === 1 ? 'entry' : 'entries'}</strong>
            </div>
            ${renderFuelEventTable(options.events)}
          </section>
        </div>

        <footer class="assetReportFooter">
          <div>
            <p class="assetReportPowered">Powered by Aim4price.com</p>
            <div class="assetReportDisclaimer">Fuel ledger records are operational records captured from storage QR entries and owner stock adjustments. They support internal fuel-control and asset-management workflows. Final fuel use and stock levels remain subject to physical verification.</div>
          </div>
          <div class="assetReportPageNumber">Page 1 of 1</div>
        </footer>
      </div>
    </main>

    <script>
      (function () {
        function waitForImages() {
          var images = Array.prototype.slice.call(document.images || []);
          if (!images.length) return Promise.resolve();
          return Promise.all(images.map(function (image) {
            if (image.complete) return Promise.resolve();
            return new Promise(function (resolve) {
              image.addEventListener('load', resolve, { once: true });
              image.addEventListener('error', resolve, { once: true });
            });
          }));
        }

        function waitForFonts() {
          if (document.fonts && document.fonts.ready) {
            return Promise.race([
              document.fonts.ready.catch(function () { return undefined; }),
              new Promise(function (resolve) { window.setTimeout(resolve, 900); }),
            ]);
          }
          return Promise.resolve();
        }

        function openPrintDialog() {
          Promise.all([waitForImages(), waitForFonts()]).then(function () {
            window.setTimeout(function () {
              window.focus();
              window.print();
            }, 250);
          });
        }

        if (document.readyState === 'complete') {
          openPrintDialog();
        } else {
          window.addEventListener('load', openPrintDialog, { once: true });
        }
      })();
    </script>
  </body>
</html>`;
}

export async function GET(request: NextRequest) {
  const session = await getServerSession();

  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: 'You must be signed in.' }, { status: 401 });
  }

  const storageId = asText(request.nextUrl.searchParams.get('storageId'));
  const year = parseReportYear(asText(request.nextUrl.searchParams.get('year')));
  const month = year ? parseReportMonth(asText(request.nextUrl.searchParams.get('month'))) : null;
  const dateRange = buildReportDateRange(year, month);

  try {
    const [ledger, events, storage] = await Promise.all([
      listFuelLedger(session.user.id),
      listFuelEventsForReport(session.user.id, {
        storageId: storageId || undefined,
        fromIso: dateRange.fromIso,
        toIso: dateRange.toIso,
      }),
      storageId ? getFuelStorageById(session.user.id, storageId) : Promise.resolve(null),
    ]);

    if (storageId && !storage) {
      return NextResponse.json({ ok: false, error: 'Fuel storage not found.' }, { status: 404 });
    }

    const totalIssued = events
      .filter((event) => event.eventType === 'asset_issue')
      .reduce((sum, event) => sum + event.litres, 0);
    const totalStockIn = events
      .filter((event) => event.eventType === 'stock_in' || event.eventType === 'opening_balance')
      .reduce((sum, event) => sum + event.litres, 0);
    const ownerEmail = asText(session.user.email);
    const generatedAt = new Intl.DateTimeFormat('en-ZA', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Africa/Johannesburg',
    }).format(new Date());
    const storageName = storage ? storage.name : 'All storage units';
    const storageFuelType = storage ? storage.fuelType.toUpperCase() : 'All fuel types';
    const storageCode = storage ? storage.publicFuelStorageCode : 'All storage QR codes';
    const title = storage ? `${storage.name} Fuel Report` : 'Fuel Ledger Report';
    const subtitle = storage
      ? `${storage.fuelType.toUpperCase()} storage report for ${dateRange.label}.`
      : `All fuel storage and issue transactions for ${dateRange.label}.`;
    const logoUrl = await getAssetRegisterReportLogoUrl(session.user.id).catch(() => '');

    const html = buildReportHtml({
      title,
      subtitle,
      generatedAt,
      ownerEmail,
      logoUrl,
      dateRangeLabel: dateRange.label,
      storageName,
      storageCode,
      storageFuelType,
      totalIssued,
      totalStockIn,
      currentLitres: storage ? storage.currentLitres : ledger.summary.currentLitres,
      storageCount: storage ? 1 : ledger.summary.totalStorageUnits,
      eventCount: events.length,
      events,
    });

    return new NextResponse(html, {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
        'content-disposition': `inline; filename="${slugifyFileSegment(title)}-${formatDate(new Date()).replace(/\s+/g, '-').toLowerCase()}.html"`,
      },
    });
  } catch (error) {
    console.error('fuel report failed', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to build fuel report.' },
      { status: 500 },
    );
  }
}
