import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '../../../../lib/auth-session';
import { getAccountProfile, type AccountProfile } from '../../../../lib/account-profile';
import { getAssetRegisterReportLogoUrl } from '../../../../lib/asset-registers';
import { getFuelStorageById, listFuelEventsForReport, listFuelLedger, type FuelLedgerEvent } from '../../../../lib/fuel-ledger';
import { createXlsxWorkbook, type XlsxCellStyle, type XlsxCellValue, type XlsxPrimitiveCellValue, type XlsxSheet } from '../../../../lib/simple-xlsx';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ReportFormat = 'pdf' | 'xlsx';

type KeyValueRow = {
  label: string;
  value: string;
};

type OwnerReportDetails = {
  businessName: string;
  contactDetails: string;
  businessEmail: string;
  locationAddress: string;
};

type SummaryCard = {
  label: string;
  value: string;
  subtext: string;
};

type FuelReportOptions = {
  title: string;
  subtitle: string;
  generatedAt: string;
  ownerEmail: string;
  ownerDetails: OwnerReportDetails;
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
  xlsxUrl: string;
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

function safeCardMask(last4: string): string {
  return /^\d{4}$/.test(last4) ? `************${last4}` : '';
}

function maskReportCardLikeText(value: unknown): string {
  return String(value ?? '')
    .replace(/\b\d{4,6}[\s-]*(?:[*xX]{2,}[\s-]*){1,3}\d{4}\b/g, (match) => safeCardMask(cardLast4FromValue(match)) || match)
    .replace(/\b(?:[*xX]{2,}[\s-]*){1,4}\d{4}\b/g, (match) => safeCardMask(cardLast4FromValue(match)) || match)
    .replace(/\b(?:\d[\s-]?){13,19}\b/g, (match) => safeCardMask(cardLast4FromValue(match)) || match);
}

function roundLitres(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function cardLast4FromValue(value: unknown): string {
  const text = asText(value);
  if (!text) return '';

  const masked = /(?:\b\d{4,6}[\s-]*)?(?:[*xX]{2,}[\s-]*){1,4}(\d{4})\b/.exec(text);
  if (masked) return masked[1];

  const digits = text.replace(/\D/g, '');
  if (digits.length >= 4) return digits.slice(-4);
  return '';
}

function formatCardEnding(value: unknown): string {
  const last4 = cardLast4FromValue(value);
  return /^\d{4}$/.test(last4) ? `Card ending ${last4}` : '';
}

function safeReportText(value: unknown): string {
  return maskReportCardLikeText(normalizeSpaces(value));
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

function formatExcelDateTime(value?: string | null): string {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const parts = new Intl.DateTimeFormat('en-ZA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Africa/Johannesburg',
  }).formatToParts(date);

  const valueFor = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  return `${valueFor('year')}-${valueFor('month')}-${valueFor('day')} ${valueFor('hour')}:${valueFor('minute')}`;
}

function formatLitres(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-';
  return `${value.toLocaleString('en-ZA', { maximumFractionDigits: 3 })} L`;
}

function formatNumber(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-';
  return value.toLocaleString('en-ZA', { maximumFractionDigits: 2 });
}

function formatPercent(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-';
  return `${Math.max(0, Math.min(100, Math.round(value)))}%`;
}

function percentForExcel(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(100, value)) / 100;
}

function calculateAssetDieselBeforeFill(event: FuelLedgerEvent): number | null {
  const litresIssued = event.litres;
  const beforePercent = event.assetFuelPercentBefore;
  const afterPercent = event.assetFuelPercentAfter;

  if (
    typeof litresIssued !== 'number' ||
    !Number.isFinite(litresIssued) ||
    litresIssued < 0 ||
    typeof beforePercent !== 'number' ||
    !Number.isFinite(beforePercent) ||
    typeof afterPercent !== 'number' ||
    !Number.isFinite(afterPercent)
  ) {
    return null;
  }

  const safeBefore = Math.max(0, Math.min(100, beforePercent));
  const safeAfter = Math.max(0, Math.min(100, afterPercent));
  const percentIncrease = safeAfter - safeBefore;

  if (percentIncrease <= 0) {
    return null;
  }

  return roundLitres((litresIssued * safeBefore) / percentIncrease);
}

function assetDieselBeforeFillFormula(rowNumber: number): string {
  return `IF(AND(F${rowNumber}>0,J${rowNumber}<>"",K${rowNumber}<>"",K${rowNumber}>J${rowNumber}),ROUND(F${rowNumber}*J${rowNumber}/(K${rowNumber}-J${rowNumber}),3),"")`;
}

function formatLocation(event: FuelLedgerEvent): string {
  const text = asText(event.locationText);
  if (text) return text;

  if (typeof event.latitude === 'number' && Number.isFinite(event.latitude) && typeof event.longitude === 'number' && Number.isFinite(event.longitude)) {
    return `GPS ${event.latitude.toFixed(6)}, ${event.longitude.toFixed(6)}`;
  }

  return '-';
}

function eventActivityLabel(event: FuelLedgerEvent): string {
  if (event.sourceType === 'fuel_slip') return 'Fuel Slip';
  if (event.eventType === 'opening_balance') return 'Opening balance';
  if (event.eventType === 'stock_in') return 'Fuel In / Storage Refill';
  if (event.eventType === 'asset_issue') return 'Asset filled';
  if (event.eventType === 'dip') return 'Tank dip / stock count';
  return 'Manual correction';
}

function eventDirectionLabel(event: FuelLedgerEvent): string {
  if (event.eventType === 'opening_balance' || event.eventType === 'stock_in') return 'In';
  if (event.eventType === 'asset_issue') return 'Out';
  if (event.eventType === 'dip') return 'Level check';

  if (typeof event.storageLevelBefore === 'number' && typeof event.storageLevelAfter === 'number') {
    if (event.storageLevelAfter > event.storageLevelBefore) return 'In';
    if (event.storageLevelAfter < event.storageLevelBefore) return 'Out';
  }

  return 'Adjustment';
}

function eventTargetLabel(event: FuelLedgerEvent): string {
  if (event.eventType === 'asset_issue') {
    return event.assetTitle || event.assetPlateLabel || 'Asset';
  }

  return event.storageName || 'Fuel storage';
}

function eventWorkActivityLabel(event: FuelLedgerEvent): string {
  if (event.sourceType === 'fuel_slip') {
    return asText(event.fuelSlipSupplierName) || asText(event.operatorName) || 'Fuel Slip';
  }

  return asText(event.activityText) || '-';
}

function eventWorkAreaLabel(event: FuelLedgerEvent): string {
  if (event.sourceType === 'fuel_slip') {
    return asText(event.fuelSlipFuelType) || asText(event.workAreaText) || '-';
  }

  return asText(event.workAreaText) || '-';
}

function eventNoteLabel(event: FuelLedgerEvent): string {
  if (event.sourceType !== 'fuel_slip') {
    return safeReportText(event.note) || '-';
  }

  const parts = [
    asText(event.fuelSlipSupplierName) ? `Supplier: ${asText(event.fuelSlipSupplierName)}` : '',
    asText(event.fuelSlipFuelType) ? `Fuel type: ${asText(event.fuelSlipFuelType)}` : '',
    asText(event.paymentMethod) ? `Payment: ${asText(event.paymentMethod)}` : '',
    formatCardEnding(event.cardNumberMasked),
    asText(event.documentFileUrl) ? `Document: ${asText(event.documentFileUrl)}` : '',
    asText(event.fuelSlipReviewStatus) ? `Review: ${asText(event.fuelSlipReviewStatus)}` : '',
  ].filter(Boolean);

  return safeReportText(parts.join(' · ') || 'Fuel Slip');
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

function parseReportFormat(value: string): ReportFormat {
  return value.toLowerCase() === 'xlsx' ? 'xlsx' : 'pdf';
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

function buildFormatUrl(request: NextRequest, format: ReportFormat): string {
  const url = new URL(request.url);
  url.searchParams.set('format', format);
  return `${url.pathname}${url.search}`;
}

function buildOwnerLocationAddress(profile: AccountProfile | null): string {
  if (!profile) return '';

  const address = [profile.addressLine1, profile.addressLine2, profile.townCity, profile.province]
    .map((part) => asText(part))
    .filter(Boolean)
    .join(', ');

  return address || asText(profile.marketplaceLocation);
}

function buildOwnerReportDetails(
  profile: AccountProfile | null,
  fallbackUser: { name?: unknown; email?: unknown },
): OwnerReportDetails {
  const fallbackEmail = asText(fallbackUser.email);
  const businessName =
    asText(profile?.businessName) ||
    asText(profile?.marketplaceSellerName) ||
    asText(profile?.displayName) ||
    asText(profile?.name) ||
    asText(fallbackUser.name) ||
    fallbackEmail ||
    'Aim4price account';
  const contactDetails = asText(profile?.marketplacePhone) || asText(profile?.phone);
  const businessEmail = asText(profile?.marketplaceEmail) || asText(profile?.email) || fallbackEmail;
  const locationAddress = buildOwnerLocationAddress(profile);

  return {
    businessName,
    contactDetails,
    businessEmail,
    locationAddress,
  };
}

function buildOwnerRows(ownerDetails: OwnerReportDetails): KeyValueRow[] {
  return [
    { label: 'Business Name', value: ownerDetails.businessName || '-' },
    { label: 'Contact Details', value: ownerDetails.contactDetails || '-' },
    { label: 'Business Email', value: ownerDetails.businessEmail || '-' },
    { label: 'Location / Address', value: ownerDetails.locationAddress || '-' },
  ];
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
              <strong>${escapeHtml(row.value || '-')}</strong>
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
      const note = eventNoteLabel(event);

      return `
        <tr>
          <td>${escapeHtml(formatDateTime(event.createdAtIso))}</td>
          <td>${escapeHtml(eventActivityLabel(event))}</td>
          <td><strong>${escapeHtml(eventDirectionLabel(event))}</strong></td>
          <td>${escapeHtml(event.storageName || '-')}</td>
          <td>${escapeHtml(eventTargetLabel(event))}</td>
          <td><strong>${escapeHtml(formatLitres(event.litres))}</strong></td>
          <td><strong>${escapeHtml(formatLitres(calculateAssetDieselBeforeFill(event)))}</strong></td>
          <td>${escapeHtml(formatLitres(event.storageLevelBefore))}</td>
          <td><strong>${escapeHtml(formatLitres(event.storageLevelAfter))}</strong></td>
          <td>${escapeHtml(formatPercent(event.assetFuelPercentBefore))}</td>
          <td>${escapeHtml(formatPercent(event.assetFuelPercentAfter))}</td>
          <td>${escapeHtml(formatNumber(event.assetUsageReading))}</td>
          <td>${escapeHtml(event.operatorName || '-')}</td>
          <td>${escapeHtml(formatLocation(event))}</td>
          <td>${escapeHtml(eventWorkActivityLabel(event))}</td>
          <td>${escapeHtml(eventWorkAreaLabel(event))}</td>
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
            <th>Date</th>
            <th>Activity</th>
            <th>Direction</th>
            <th>Storage Unit</th>
            <th>Asset</th>
            <th>Litres Filled</th>
            <th>Litres Before</th>
            <th>Storage Before</th>
            <th>Storage After</th>
            <th>% Before</th>
            <th>% After</th>
            <th>Odometer</th>
            <th>Operator</th>
            <th>GPS location</th>
            <th>Supplier / Activity</th>
            <th>Fuel Type / Work Area</th>
            <th>Notes / Slip Details</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function buildReportHtml(options: FuelReportOptions): string {
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
        --green: #10382f;
      }

      * {
        box-sizing: border-box;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      @page {
        size: A4 landscape;
        margin: 6mm 6mm 7mm;
      }

      html,
      body {
        margin: 0;
        padding: 0;
        background: #eef1f4;
        color: var(--ink);
        font-family: Montserrat, "Segoe UI", Arial, Helvetica, sans-serif;
        font-size: 9.2px;
        line-height: 1.35;
      }

      .assetReportScreenBar {
        position: sticky;
        top: 0;
        z-index: 10;
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: center;
        gap: 10px 16px;
        padding: 12px 16px;
        background: rgba(255, 255, 255, 0.96);
        border-bottom: 1px solid #d7dce2;
        box-shadow: 0 10px 26px rgba(17, 24, 39, 0.07);
      }

      .assetReportScreenText {
        min-width: 0;
        color: var(--muted);
        font-size: 12.5px;
        line-height: 1.4;
      }

      .assetReportScreenActions {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 8px;
        flex-wrap: nowrap;
      }

      .assetReportButton {
        appearance: none;
        min-height: 42px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex: 0 0 auto;
        padding: 0 16px;
        border: 1px solid #cfd5dd;
        border-radius: 999px;
        background: #ffffff;
        color: var(--ink);
        font: inherit;
        font-size: 12.5px;
        font-weight: 800;
        line-height: 1;
        white-space: nowrap;
        cursor: pointer;
        text-decoration: none;
      }

      .assetReportButtonPrimary {
        min-width: 150px;
        border-color: var(--green);
        background: var(--green);
        color: #ffffff;
        box-shadow: 0 12px 22px rgba(16, 56, 47, 0.18);
      }

      .assetReportButton:focus-visible {
        outline: 3px solid rgba(16, 56, 47, 0.18);
        outline-offset: 2px;
      }

      .assetReportPage {
        width: min(100%, 297mm);
        min-height: 210mm;
        margin: 18px auto;
        padding: 7mm 6mm 7mm;
        background: var(--paper);
        box-shadow: 0 16px 44px rgba(17, 24, 39, 0.13);
      }

      .assetReportInner {
        position: relative;
        display: flex;
        min-height: calc(210mm - 14mm);
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
        max-height: 18mm;
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
        font-size: 21px;
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
        font-size: 29px;
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

      .assetReportSection,
      .assetReportSideCard {
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
        gap: 8px;
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
        padding: 6px 4.5px 6px 0;
        border-bottom: 1px solid var(--line);
        color: #38404c;
        font-size: 5.75px;
        line-height: 1.32;
        text-align: left;
        vertical-align: top;
        overflow-wrap: break-word;
        word-break: normal;
        hyphens: auto;
      }

      .assetReportTable th {
        color: var(--strong);
        font-size: 5.25px;
        line-height: 1.18;
        font-weight: 800;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }

      .assetReportTable td strong {
        color: var(--strong);
        font-weight: 800;
      }

      .assetReportFuelLedgerTable th:nth-child(1),
      .assetReportFuelLedgerTable td:nth-child(1) { width: 19mm; }
      .assetReportFuelLedgerTable th:nth-child(2),
      .assetReportFuelLedgerTable td:nth-child(2) { width: 17mm; }
      .assetReportFuelLedgerTable th:nth-child(3),
      .assetReportFuelLedgerTable td:nth-child(3) { width: 10mm; }
      .assetReportFuelLedgerTable th:nth-child(4),
      .assetReportFuelLedgerTable td:nth-child(4) { width: 18mm; }
      .assetReportFuelLedgerTable th:nth-child(5),
      .assetReportFuelLedgerTable td:nth-child(5) { width: 23mm; }
      .assetReportFuelLedgerTable th:nth-child(6),
      .assetReportFuelLedgerTable td:nth-child(6) { width: 15mm; }
      .assetReportFuelLedgerTable th:nth-child(7),
      .assetReportFuelLedgerTable td:nth-child(7) { width: 16mm; }
      .assetReportFuelLedgerTable th:nth-child(8),
      .assetReportFuelLedgerTable td:nth-child(8) { width: 15mm; }
      .assetReportFuelLedgerTable th:nth-child(9),
      .assetReportFuelLedgerTable td:nth-child(9) { width: 15mm; }
      .assetReportFuelLedgerTable th:nth-child(10),
      .assetReportFuelLedgerTable td:nth-child(10),
      .assetReportFuelLedgerTable th:nth-child(11),
      .assetReportFuelLedgerTable td:nth-child(11) { width: 11mm; }
      .assetReportFuelLedgerTable th:nth-child(12),
      .assetReportFuelLedgerTable td:nth-child(12) { width: 13mm; }
      .assetReportFuelLedgerTable th:nth-child(13),
      .assetReportFuelLedgerTable td:nth-child(13) { width: 16mm; }
      .assetReportFuelLedgerTable th:nth-child(14),
      .assetReportFuelLedgerTable td:nth-child(14) { width: 24mm; }
      .assetReportFuelLedgerTable th:nth-child(15),
      .assetReportFuelLedgerTable td:nth-child(15) { width: 18mm; }
      .assetReportFuelLedgerTable th:nth-child(16),
      .assetReportFuelLedgerTable td:nth-child(16) { width: 17mm; }
      .assetReportFuelLedgerTable th:nth-child(17),
      .assetReportFuelLedgerTable td:nth-child(17) { width: 23mm; }

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
        .assetReportScreenBar {
          grid-template-columns: 1fr;
          padding: 10px 12px 12px;
        }

        .assetReportScreenText {
          font-size: 12px;
        }

        .assetReportScreenActions {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          width: 100%;
          gap: 8px;
        }

        .assetReportButton {
          width: 100%;
          min-height: 44px;
          padding: 0 10px;
          font-size: 12px;
        }

        .assetReportButtonPrimary {
          grid-column: 1 / -1;
          min-width: 0;
        }

        .assetReportPage {
          padding: 20px;
          margin: 0;
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

      @media screen and (max-width: 380px) {
        .assetReportScreenActions {
          grid-template-columns: 1fr;
        }

        .assetReportButtonPrimary {
          grid-column: auto;
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
          min-height: 197mm;
          margin: 0;
          padding: 0;
          box-shadow: none;
          overflow: visible;
        }

        .assetReportInner {
          min-height: 197mm;
        }
      }
    </style>
  </head>
  <body>
    <div class="assetReportScreenBar">
      <div class="assetReportScreenText">Save or print this fuel ledger PDF, or download the filtered Excel workbook.</div>
      <div class="assetReportScreenActions">
        <button type="button" class="assetReportButton" onclick="window.close()">Close</button>
        <a class="assetReportButton" href="${escapeHtml(options.xlsxUrl)}">Download Excel</a>
        <button type="button" class="assetReportButton assetReportButtonPrimary" onclick="window.print()">Save PDF / Print</button>
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
            ${options.ownerEmail ? `<div class="assetReportMetaLine"><span>Business Email</span><strong>${escapeHtml(options.ownerEmail)}</strong></div>` : ''}
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

            <section class="assetReportSection assetReportClientCard">
              <h2>Owner Details</h2>
              ${renderRows(buildOwnerRows(options.ownerDetails), 'No owner details available.')}
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
                <p>Each line includes the date, activity, direction, asset, litres filled, litres before fill, storage balances, odometer, operator and non-cost Fuel Slip details where available.</p>
              </div>
              <strong>${escapeHtml(String(options.eventCount))} ${options.eventCount === 1 ? 'entry' : 'entries'}</strong>
            </div>
            ${renderFuelEventTable(options.events)}
          </section>
        </div>

        <footer class="assetReportFooter">
          <div>
            <p class="assetReportPowered">Powered by Aim4price.com</p>
            <div class="assetReportDisclaimer">Fuel ledger records are operational records captured from storage QR entries and owner stock adjustments. The litres-before value is calculated from litres issued and the captured fuel-gauge percentage change, and remains subject to physical verification.</div>
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

function styled(value: XlsxPrimitiveCellValue, style: XlsxCellStyle): XlsxCellValue {
  return { value, style };
}

function buildFuelWorkbook(options: FuelReportOptions): XlsxSheet[] {
  const summaryRows: XlsxCellValue[][] = [
    [styled(options.title, 'title'), '', '', '', ''],
    [styled(options.subtitle, 'subtitle'), '', '', '', ''],
    [],
    [styled('Generated', 'metaLabel'), styled(options.generatedAt, 'metaValue')],
    [styled('Period', 'metaLabel'), styled(options.dateRangeLabel, 'metaValue')],
    [styled('Business name', 'metaLabel'), styled(options.ownerDetails.businessName, 'metaValue')],
    [styled('Contact details', 'metaLabel'), styled(options.ownerDetails.contactDetails, 'metaValue')],
    [styled('Business email', 'metaLabel'), styled(options.ownerDetails.businessEmail, 'metaValue')],
    [styled('Location / address', 'metaLabel'), styled(options.ownerDetails.locationAddress, 'metaValue')],
    [styled('Storage', 'metaLabel'), styled(options.storageName, 'metaValue')],
    [styled('Fuel type', 'metaLabel'), styled(options.storageFuelType, 'metaValue')],
    [styled('Storage code', 'metaLabel'), styled(options.storageCode, 'metaValue')],
    [],
    [styled('Storage units', 'tableHeader'), styled('Fuel issued', 'tableHeader'), styled('Fuel filled', 'tableHeader'), styled('Current stock', 'tableHeader'), styled('Entries', 'tableHeader')],
    [
      styled(options.storageCount, 'integer'),
      styled(roundLitres(options.totalIssued), 'decimal'),
      styled(roundLitres(options.totalStockIn), 'decimal'),
      styled(roundLitres(options.currentLitres), 'decimal'),
      styled(options.eventCount, 'integer'),
    ],
  ];

  const movementHeader = [
    'Date',
    'Ledger activity',
    'Direction',
    'Storage unit',
    'Asset',
    'Litres Filled',
    'Litres Before',
    'Storage Before',
    'Storage After',
    '% Before',
    '% After',
    'Odometer',
    'Operator',
    'GPS location',
    'Supplier / Activity',
    'Fuel Type / Work Area',
    'Notes / Slip Details',
  ];

  const movementHeaderRow = 7;
  const movementRows: XlsxCellValue[][] = [
    [styled('Fuel Movement Records', 'title'), '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
    [styled(`Filtered report: ${options.dateRangeLabel}`, 'subtitle'), '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
    [styled('PDF and XLSX include date, asset, odometer, fuel percentages, litres, litres before fill, operator, GPS, supplier/activity, fuel type/work area and non-cost slip details.', 'note'), '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
    [],
    [styled('Storage', 'metaLabel'), styled(options.storageName, 'metaValue'), styled('Fuel type', 'metaLabel'), styled(options.storageFuelType, 'metaValue')],
    [],
    movementHeader.map((header) => styled(header, 'tableHeader')),
    ...options.events.map((event, index) => {
      const rowNumber = movementHeaderRow + 1 + index;
      const directionLabel = eventDirectionLabel(event);

      return [
        styled(formatExcelDateTime(event.createdAtIso), 'text'),
        styled(eventActivityLabel(event), 'text'),
        styled(directionLabel, directionLabel === 'Out' ? 'statusWarn' : directionLabel === 'In' ? 'statusGood' : 'statusInfo'),
        styled(event.storageName || '', 'text'),
        styled(eventTargetLabel(event), 'text'),
        styled(roundLitres(event.litres), 'decimal'),
        {
          value: calculateAssetDieselBeforeFill(event),
          formula: assetDieselBeforeFillFormula(rowNumber),
          style: 'decimal' as XlsxCellStyle,
        },
        styled(typeof event.storageLevelBefore === 'number' ? roundLitres(event.storageLevelBefore) : null, 'decimal'),
        styled(typeof event.storageLevelAfter === 'number' ? roundLitres(event.storageLevelAfter) : null, 'decimal'),
        styled(percentForExcel(event.assetFuelPercentBefore), 'percent'),
        styled(percentForExcel(event.assetFuelPercentAfter), 'percent'),
        styled(typeof event.assetUsageReading === 'number' ? event.assetUsageReading : null, 'decimal'),
        styled(event.operatorName || '', 'text'),
        styled(formatLocation(event), 'text'),
        styled(eventWorkActivityLabel(event), 'text'),
        styled(eventWorkAreaLabel(event), 'text'),
        styled(eventNoteLabel(event), 'note'),
      ];
    }),
  ];

  return [
    {
      name: 'Summary',
      rows: summaryRows,
      columns: [28, 28, 28, 28, 16],
      merges: [
        { fromRow: 1, fromColumn: 1, toRow: 1, toColumn: 5 },
        { fromRow: 2, fromColumn: 1, toRow: 2, toColumn: 5 },
      ],
      tabColor: '10382F',
    },
    {
      name: 'Fuel Movement Records',
      rows: movementRows,
      columns: [20, 22, 14, 24, 28, 18, 18, 18, 18, 14, 14, 18, 22, 34, 24, 24, 42],
      merges: [
        { fromRow: 1, fromColumn: 1, toRow: 1, toColumn: 17 },
        { fromRow: 2, fromColumn: 1, toRow: 2, toColumn: 17 },
        { fromRow: 3, fromColumn: 1, toRow: 3, toColumn: 17 },
      ],
      freezeRow: movementHeaderRow,
      autoFilter: {
        fromRow: movementHeaderRow,
        fromColumn: 1,
        toRow: Math.max(movementHeaderRow, movementHeaderRow + options.events.length),
        toColumn: movementHeader.length,
      },
      tabColor: '176B4F',
    },
  ];
}

export async function GET(request: NextRequest) {
  const session = await getServerSession();

  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: 'You must be signed in.' }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const storageId = asText(params.get('storageId'));
  const year = parseReportYear(asText(params.get('year')));
  const month = year ? parseReportMonth(asText(params.get('month'))) : null;
  const format = parseReportFormat(asText(params.get('format')));
  const includeFuelSlips = asText(params.get('includeFuelSlips')).toLowerCase() !== 'false';
  const dateRange = buildReportDateRange(year, month);

  try {
    const [ledger, events, storage] = await Promise.all([
      listFuelLedger(session.user.id),
      listFuelEventsForReport(session.user.id, {
        storageId: storageId || undefined,
        fromIso: dateRange.fromIso,
        toIso: dateRange.toIso,
        includeFuelSlips,
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
    const ownerProfile = await getAccountProfile({
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
    });
    const ownerDetails = buildOwnerReportDetails(ownerProfile, session.user);
    const ownerEmail = ownerDetails.businessEmail;
    const generatedAt = new Intl.DateTimeFormat('en-ZA', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Africa/Johannesburg',
    }).format(new Date());
    const storageName = storage ? storage.name : includeFuelSlips ? 'All storage units + slips' : 'All storage units';
    const storageFuelType = storage ? storage.fuelType.toUpperCase() : 'All fuel types';
    const storageCode = storage ? storage.publicFuelStorageCode : includeFuelSlips ? 'All storage QR codes + slips' : 'All storage QR codes';
    const title = storage ? `${storage.name} Fuel Report` : includeFuelSlips ? 'Fuel Ledger Report' : 'Fuel Storage Report';
    const subtitle = storage
      ? includeFuelSlips
        ? `${storage.fuelType.toUpperCase()} storage and linked fuel slip report for ${dateRange.label}.`
        : `${storage.fuelType.toUpperCase()} storage report for ${dateRange.label}.`
      : includeFuelSlips
        ? `All fuel storage and fuel slip transactions for ${dateRange.label}.`
        : `All fuel storage transactions for ${dateRange.label}.`;
    const logoUrl = await getAssetRegisterReportLogoUrl(session.user.id).catch(() => '');
    const reportOptions: FuelReportOptions = {
      title,
      subtitle,
      generatedAt,
      ownerEmail,
      ownerDetails,
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
      xlsxUrl: buildFormatUrl(request, 'xlsx'),
    };
    const filenameDate = new Date().toISOString().slice(0, 10);
    const baseFileName = `${slugifyFileSegment(title)}-${filenameDate}`;

    if (format === 'xlsx') {
      const workbook = createXlsxWorkbook(buildFuelWorkbook(reportOptions));

      return new NextResponse(workbook, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${baseFileName}.xlsx"`,
          'Content-Length': String(workbook.length),
          'Cache-Control': 'no-store',
        },
      });
    }

    const html = buildReportHtml(reportOptions);

    return new NextResponse(html, {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
        'content-disposition': `inline; filename="${baseFileName}.html"`,
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
