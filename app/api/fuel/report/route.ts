import { NextRequest, NextResponse } from 'next/server';
import { getAccountProfile, type AccountProfile } from '../../../../lib/account-profile';
import { getAssetRegisterReportLogoUrl } from '../../../../lib/asset-registers';
import { getFuelStorageById, listFuelEventsForReport, listFuelLedger, type FuelLedgerEvent } from '../../../../lib/fuel-ledger';
import { createXlsxWorkbook, type XlsxCellStyle, type XlsxCellValue, type XlsxPrimitiveCellValue, type XlsxSheet } from '../../../../lib/simple-xlsx';
import { resolveReportLogoUrlForHtml } from '../../../../lib/report-logo';
import {
  filterFuelLedgerForWorkspace,
  getWorkspaceAssetIds,
  resolveOwnerWorkspaceContext,
} from '../../../../lib/owner-workspace-access';

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
  totalWorkUseIssued: number;
  totalExcludedIssued: number;
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
  return `IF(AND(F${rowNumber}>0,L${rowNumber}<>"",M${rowNumber}<>"",M${rowNumber}>L${rowNumber}),ROUND(F${rowNumber}*L${rowNumber}/(M${rowNumber}-L${rowNumber}),3),"")`;
}

function formatLocation(event: FuelLedgerEvent): string {
  if (event.isLateEntry) return 'GPS not captured — desktop late entry';
  const text = asText(event.locationText);
  if (text) return text;

  if (typeof event.latitude === 'number' && Number.isFinite(event.latitude) && typeof event.longitude === 'number' && Number.isFinite(event.longitude)) {
    return `GPS ${event.latitude.toFixed(6)}, ${event.longitude.toFixed(6)}`;
  }

  return '-';
}

function eventActivityLabel(event: FuelLedgerEvent): string {
  if (event.isLateEntry) return 'Late Entry · Asset filled';
  if (event.adjustmentKind === 'late_entry_balance_correction') return 'Late-entry balance correction';
  if (event.adjustmentKind === 'balance_reconciliation') return 'Balance reconciliation';
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
  return asText(event.activityText) || (event.sourceType === 'fuel_slip' ? 'Fuel Slip' : '-');
}

function eventWorkAreaLabel(event: FuelLedgerEvent): string {
  return asText(event.workAreaText) || '-';
}

function eventNoteLabel(event: FuelLedgerEvent): string {
  if (event.isLateEntry) {
    return safeReportText([
      event.note ? `Note: ${event.note}` : '',
      event.lateEntryReason ? `Late-entry reason: ${event.lateEntryReason}` : '',
      event.evidenceReference ? `Evidence reference: ${event.evidenceReference}` : '',
    ].filter(Boolean).join(' · ')) || '-';
  }
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

function formatCurrency(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-';
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function eventIssuedDateTime(event: FuelLedgerEvent): string {
  if (event.sourceType === 'fuel_slip' && /^\d{4}-\d{2}-\d{2}$/.test(event.fuelSlipDocumentDate)) {
    const recordedTime = asText(event.fuelSlipDocumentTime);
    const hasRecordedTime = /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(recordedTime);
    const time = hasRecordedTime ? (recordedTime.length === 5 ? `${recordedTime}:00` : recordedTime) : '00:00:00';
    const documentDate = new Date(`${event.fuelSlipDocumentDate}T${time}+02:00`);

    if (!Number.isNaN(documentDate.getTime())) {
      return hasRecordedTime ? formatDateTime(documentDate.toISOString()) : formatDate(documentDate);
    }
  }

  if (!event.isLateEntry) return formatDateTime(event.createdAtIso);
  const date = asText(event.issueDate) || formatDateTime(event.issueAtIso || event.createdAtIso);
  return event.issueTimeRecorded && asText(event.issueTime) ? `${date} ${asText(event.issueTime).slice(0, 5)}` : `${date} · Time not recorded`;
}

function eventAddedBy(event: FuelLedgerEvent): string {
  return asText(event.addedByName) || asText(event.addedByEmail) || '-';
}

function eventEvidenceStatus(event: FuelLedgerEvent): string {
  if (!event.isLateEntry) return '-';
  return event.evidenceStatus === 'evidence_supplied_review_required'
    ? 'Evidence supplied — review required'
    : 'Internal record only — supporting evidence not supplied';
}

function eventBalanceTreatment(event: FuelLedgerEvent): string {
  if (!event.isLateEntry) return '-';
  if (event.tankBalanceTreatment === 'already_reflected') return 'Already reflected';
  if (event.tankBalanceTreatment === 'not_yet_reflected') return 'Not yet reflected — current balance corrected separately';
  if (event.tankBalanceTreatment === 'not_sure') return 'Not sure — reconciliation required';
  return '-';
}

function eventUsageLabel(event: FuelLedgerEvent): string {
  if (typeof event.assetUsageReading !== 'number') return 'Not recorded';
  if (event.assetUsageMetric === 'km') return `${formatNumber(event.assetUsageReading)} km`;
  if (event.assetUsageMetric === 'percentage') return `${formatNumber(event.assetUsageReading)}%`;
  if (event.assetUsageMetric === 'none') return 'Not recorded';
  if (event.assetUsageMetric === 'hours') return `${formatNumber(event.assetUsageReading)} hours`;
  return formatNumber(event.assetUsageReading);
}

function historicalStorageLabel(event: FuelLedgerEvent, value: number | null): string {
  if (event.isLateEntry) return 'Not recorded';
  return formatLitres(value);
}

function eventStorageBalanceLabel(event: FuelLedgerEvent): string {
  const before = historicalStorageLabel(event, event.storageLevelBefore);
  const after = historicalStorageLabel(event, event.storageLevelAfter);
  if (before === 'Not recorded' && after === 'Not recorded') return 'Not recorded';
  return `${before} to ${after}`;
}

function eventFuelGaugeLabel(event: FuelLedgerEvent): string {
  const before = formatPercent(event.assetFuelPercentBefore);
  const after = formatPercent(event.assetFuelPercentAfter);
  if (before === '-' && after === '-') return 'Not recorded';
  return `${before} to ${after}`;
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

function johannesburgMonthBoundaryIso(year: number, zeroBasedMonth: number): string {
  const boundary = new Date(Date.UTC(year, zeroBasedMonth, 1));
  const boundaryYear = boundary.getUTCFullYear();
  const boundaryMonth = String(boundary.getUTCMonth() + 1).padStart(2, '0');
  return new Date(`${boundaryYear}-${boundaryMonth}-01T00:00:00+02:00`).toISOString();
}

function buildReportDateRange(year: number | null, month: number | null): { fromIso?: string; toIso?: string; label: string } {
  if (!year) {
    return { label: 'All available entries' };
  }

  if (month) {
    const labelDate = new Date(Date.UTC(year, month - 1, 1));
    const label = new Intl.DateTimeFormat('en-ZA', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(labelDate);
    return {
      fromIso: johannesburgMonthBoundaryIso(year, month - 1),
      toIso: johannesburgMonthBoundaryIso(year, month),
      label,
    };
  }

  return {
    fromIso: johannesburgMonthBoundaryIso(year, 0),
    toIso: johannesburgMonthBoundaryIso(year + 1, 0),
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

  const rowGroups = events.map((event) => {
    const activity = event.isLateEntry
      ? `<span class="lateEntryBadge">Late Entry</span><span>Asset filled</span>`
      : escapeHtml(eventActivityLabel(event));

    const details = [
      { label: 'Operator', value: asText(event.operatorName) || '-' },
      { label: 'Activity', value: eventWorkActivityLabel(event) },
      { label: 'Work Area', value: eventWorkAreaLabel(event) },
      { label: 'GPS', value: formatLocation(event), wide: true },
      { label: 'Entry Added On', value: event.isLateEntry || event.sourceType === 'fuel_slip' ? formatDateTime(event.entryAddedAtIso) : '' },
      { label: 'Added By', value: eventAddedBy(event) },
      { label: 'Fuel Slip Supplier', value: event.sourceType === 'fuel_slip' ? event.fuelSlipSupplierName || '-' : '' },
      { label: 'Fuel Slip Total incl. VAT', value: event.sourceType === 'fuel_slip' ? formatCurrency(event.totalAmount) : '' },
      { label: 'Payment', value: event.sourceType === 'fuel_slip' ? event.paymentMethod || '-' : '' },
      { label: 'Fuel Slip Document', value: event.sourceType === 'fuel_slip' ? event.documentFileUrl || '-' : '', wide: true },
      { label: 'Fuel Slip Review', value: event.sourceType === 'fuel_slip' ? event.fuelSlipReviewStatus || '-' : '', wide: true },
      { label: 'Evidence / Review', value: eventEvidenceStatus(event), wide: true },
      { label: 'Work-use Status', value: event.eventType === 'asset_issue' ? (event.workUseExcluded ? 'Excluded from work use' : 'Included as work use') : '', wide: true },
      { label: 'Exclusion Reason', value: event.workUseExcluded ? event.workUseExclusionReason || 'Not used for work purposes' : '', wide: true },
      { label: 'Tank Balance Treatment', value: eventBalanceTreatment(event), wide: true },
      { label: 'Late-entry Reason', value: event.isLateEntry ? event.lateEntryReason || '-' : '', wide: true },
      { label: 'Notes', value: eventNoteLabel(event), wide: true },
    ].filter((detail) => asText(detail.value) && detail.value !== '-');

    const detailHtml = details.length
      ? details.map((detail) => `
          <div class="assetReportFuelDetail${detail.wide ? ' assetReportFuelDetailWide' : ''}">
            <span>${escapeHtml(detail.label)}</span>
            <strong>${escapeHtml(detail.value)}</strong>
          </div>
        `).join('')
      : '<div class="assetReportFuelNoDetails">No additional details recorded.</div>';

    return `
      <tbody class="assetReportFuelEventGroup">
        <tr class="assetReportFuelPrimaryRow">
          <td>${escapeHtml(eventIssuedDateTime(event))}</td>
          <td>${activity}</td>
          <td><strong>${escapeHtml(eventDirectionLabel(event))}</strong></td>
          <td>${escapeHtml(event.storageName || '-')}</td>
          <td>${escapeHtml(eventTargetLabel(event))}</td>
          <td><strong>${escapeHtml(formatLitres(event.litres))}</strong></td>
          <td><strong>${escapeHtml(formatLitres(calculateAssetDieselBeforeFill(event)))}</strong></td>
          <td>${escapeHtml(eventUsageLabel(event))}</td>
          <td>${escapeHtml(eventStorageBalanceLabel(event))}</td>
          <td>${escapeHtml(eventFuelGaugeLabel(event))}</td>
        </tr>
        <tr class="assetReportFuelDetailsRow">
          <td colspan="10"><div class="assetReportFuelDetails">${detailHtml}</div></td>
        </tr>
      </tbody>
    `;
  }).join('');

  return `
    <div class="assetReportTableWrap">
      <table class="assetReportTable assetReportFuelLedgerTable">
        <thead>
          <tr>
            <th>Date / Time</th><th>Activity / Source</th><th>Direction</th><th>Storage Unit</th><th>Asset / Target</th>
            <th>Litres</th><th>Litres Before Fill</th><th>Usage Reading</th><th>Storage Balance</th><th>Fuel Gauge</th>
          </tr>
        </thead>
        ${rowGroups}
      </table>
    </div>
  `;
}

function buildReportHtml(options: FuelReportOptions): string {
  const cards: SummaryCard[] = [
    { label: 'Current Storage', value: formatLitres(options.currentLitres), subtext: 'Current ledger stock' },
    { label: 'Fuel Issued', value: formatLitres(options.totalIssued), subtext: 'Issued to assets' },
    { label: 'Work-use Recorded', value: formatLitres(options.totalWorkUseIssued), subtext: 'Issued entries not excluded' },
    { label: 'Excluded', value: formatLitres(options.totalExcludedIssued), subtext: 'Marked not for work use' },
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
    { label: 'Work-use Recorded', value: formatLitres(options.totalWorkUseIssued) },
    { label: 'Excluded from Work Use', value: formatLitres(options.totalExcludedIssued) },
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

      .assetReportTable thead {
        display: table-header-group;
      }

      .assetReportTable td strong {
        color: var(--strong);
        font-weight: 800;
      }

      .lateEntryBadge {
        display: inline-flex;
        align-items: center;
        width: fit-content;
        margin: 0 0 3px;
        padding: 2px 5px;
        border: 1px solid #d6a239;
        border-radius: 999px;
        background: #fff7df;
        color: #7a4b00;
        font-size: 5px;
        line-height: 1;
        font-weight: 800;
        letter-spacing: 0.035em;
        text-transform: uppercase;
      }

      .assetReportFuelEventGroup {
        break-inside: avoid;
        page-break-inside: avoid;
      }

      .assetReportFuelEventGroup + .assetReportFuelEventGroup .assetReportFuelPrimaryRow td {
        border-top: 1px solid var(--line-strong);
      }

      .assetReportFuelPrimaryRow td {
        padding-top: 7px;
        padding-bottom: 5px;
        font-size: 6.25px;
        line-height: 1.28;
      }

      .assetReportFuelDetailsRow td {
        padding: 0 5px 7px;
        border-bottom: 1px solid var(--line);
        background: var(--soft-2);
      }

      .assetReportFuelDetails {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 4px 9px;
        padding-top: 5px;
      }

      .assetReportFuelDetail {
        min-width: 0;
      }

      .assetReportFuelDetailWide {
        grid-column: span 2;
      }

      .assetReportFuelDetail span {
        display: block;
        margin-bottom: 1px;
        color: var(--muted);
        font-size: 4.9px;
        line-height: 1.15;
        font-weight: 800;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }

      .assetReportFuelDetail strong,
      .assetReportFuelNoDetails {
        display: block;
        color: #2f3742;
        font-size: 5.75px;
        line-height: 1.3;
        font-weight: 600;
        overflow-wrap: anywhere;
      }

      .assetReportFuelNoDetails {
        grid-column: 1 / -1;
        color: var(--muted);
        font-style: italic;
      }

      .assetReportFuelLedgerTable th:nth-child(1),
      .assetReportFuelPrimaryRow td:nth-child(1) { width: 9%; }
      .assetReportFuelLedgerTable th:nth-child(2),
      .assetReportFuelPrimaryRow td:nth-child(2) { width: 9%; }
      .assetReportFuelLedgerTable th:nth-child(3),
      .assetReportFuelPrimaryRow td:nth-child(3) { width: 6%; }
      .assetReportFuelLedgerTable th:nth-child(4),
      .assetReportFuelPrimaryRow td:nth-child(4) { width: 10%; }
      .assetReportFuelLedgerTable th:nth-child(5),
      .assetReportFuelPrimaryRow td:nth-child(5) { width: 14%; }
      .assetReportFuelLedgerTable th:nth-child(6),
      .assetReportFuelPrimaryRow td:nth-child(6) { width: 8%; }
      .assetReportFuelLedgerTable th:nth-child(7),
      .assetReportFuelPrimaryRow td:nth-child(7) { width: 9%; }
      .assetReportFuelLedgerTable th:nth-child(8),
      .assetReportFuelPrimaryRow td:nth-child(8) { width: 9%; }
      .assetReportFuelLedgerTable th:nth-child(9),
      .assetReportFuelPrimaryRow td:nth-child(9) { width: 14%; }
      .assetReportFuelLedgerTable th:nth-child(10),
      .assetReportFuelPrimaryRow td:nth-child(10) { width: 12%; }

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
                <p>Each entry keeps the movement figures together, including its work-use classification, operator, work area, GPS, audit and Fuel Slip details.</p>
              </div>
              <strong>${escapeHtml(String(options.eventCount))} ${options.eventCount === 1 ? 'entry' : 'entries'}</strong>
            </div>
            ${renderFuelEventTable(options.events)}
          </section>
        </div>

        <footer class="assetReportFooter">
          <div>
            <p class="assetReportPowered">Powered by Aim4price.com</p>
            <div class="assetReportDisclaimer">Fuel ledger records are operational records. Work-use inclusion or exclusion is an owner/accountant classification and is not, by itself, a tax determination. The litres-before value is calculated from litres issued and the captured fuel-gauge percentage change, and remains subject to physical verification.</div>
          </div>
          <div class="assetReportPageNumber">Complete fuel ledger</div>
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
    [styled('Work-use recorded', 'metaLabel'), styled(roundLitres(options.totalWorkUseIssued), 'decimal')],
    [styled('Excluded from work use', 'metaLabel'), styled(roundLitres(options.totalExcludedIssued), 'decimal')],
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
    'Date / Time', 'Activity / Source', 'Direction', 'Storage Unit', 'Asset / Target', 'Litres',
    'Litres Before Fill', 'Usage Reading', 'Usage Metric', 'Historical Storage Before', 'Historical Storage After', '% Before', '% After',
    'Operator', 'Activity', 'Work Area', 'GPS', 'Entry Added On', 'Added By', 'Evidence / Review Status',
    'Evidence Type', 'Evidence Reference', 'Tank Balance Treatment', 'Late-entry Reason', 'Notes',
    'Work-use Status', 'Exclusion Reason', 'Fuel Slip Supplier', 'Total incl. VAT', 'Payment Method', 'Fuel Slip Document', 'Fuel Slip Review Status',
  ];
  const movementHeaderRow = 7;
  const movementRows: XlsxCellValue[][] = [
    [styled('Fuel Movement Records', 'title'), ...Array(movementHeader.length - 1).fill('')],
    [styled(`Filtered report: ${options.dateRangeLabel}`, 'subtitle'), ...Array(movementHeader.length - 1).fill('')],
    [styled('Late entries show their historical issue date separately from the real date added. Work-use status is a classification, not a tax determination.', 'note'), ...Array(movementHeader.length - 1).fill('')],
    [],
    [styled('Storage', 'metaLabel'), styled(options.storageName, 'metaValue'), styled('Fuel type', 'metaLabel'), styled(options.storageFuelType, 'metaValue')],
    [],
    movementHeader.map((header) => styled(header, 'tableHeader')),
    ...options.events.map((event, index) => {
      const directionLabel = eventDirectionLabel(event);
      const rowNumber = movementHeaderRow + 1 + index;
      return [
        styled(eventIssuedDateTime(event), 'text'),
        styled(eventActivityLabel(event), event.isLateEntry ? 'statusInfo' : 'text'),
        styled(directionLabel, directionLabel === 'Out' ? 'statusWarn' : directionLabel === 'In' ? 'statusGood' : 'statusInfo'),
        styled(event.storageName || '', 'text'),
        styled(eventTargetLabel(event), 'text'),
        styled(roundLitres(event.litres), 'decimal'),
        {
          value: calculateAssetDieselBeforeFill(event),
          formula: assetDieselBeforeFillFormula(rowNumber),
          style: 'decimal' as XlsxCellStyle,
        },
        styled(typeof event.assetUsageReading === 'number' ? event.assetUsageReading : null, 'decimal'),
        styled(event.assetUsageMetric || '', 'text'),
        styled(event.isLateEntry ? 'Not recorded' : typeof event.storageLevelBefore === 'number' ? roundLitres(event.storageLevelBefore) : null, event.isLateEntry ? 'text' : 'decimal'),
        styled(event.isLateEntry ? 'Not recorded' : typeof event.storageLevelAfter === 'number' ? roundLitres(event.storageLevelAfter) : null, event.isLateEntry ? 'text' : 'decimal'),
        styled(percentForExcel(event.assetFuelPercentBefore), 'percent'),
        styled(percentForExcel(event.assetFuelPercentAfter), 'percent'),
        styled(event.operatorName || '', 'text'),
        styled(eventWorkActivityLabel(event), 'text'),
        styled(eventWorkAreaLabel(event), 'text'),
        styled(formatLocation(event), 'text'),
        styled(event.isLateEntry || event.sourceType === 'fuel_slip' ? formatExcelDateTime(event.entryAddedAtIso) : '', 'text'),
        styled(eventAddedBy(event), 'text'),
        styled(eventEvidenceStatus(event), 'text'),
        styled(event.evidenceType || '', 'text'),
        styled(event.evidenceReference || '', 'text'),
        styled(eventBalanceTreatment(event), 'text'),
        styled(event.isLateEntry ? event.lateEntryReason || '' : '', 'note'),
        styled(eventNoteLabel(event), 'note'),
        styled(event.eventType === 'asset_issue' ? (event.workUseExcluded ? 'Excluded from work use' : 'Included as work use') : '', event.workUseExcluded ? 'statusWarn' : 'statusGood'),
        styled(event.workUseExcluded ? event.workUseExclusionReason || 'Not used for work purposes' : '', 'note'),
        styled(event.sourceType === 'fuel_slip' ? event.fuelSlipSupplierName || '' : '', 'text'),
        styled(event.sourceType === 'fuel_slip' ? event.totalAmount : null, 'currency'),
        styled(event.sourceType === 'fuel_slip' ? event.paymentMethod || '' : '', 'text'),
        styled(event.sourceType === 'fuel_slip' ? event.documentFileUrl || '' : '', 'text'),
        styled(event.sourceType === 'fuel_slip' ? event.fuelSlipReviewStatus || '' : '', 'text'),
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
      columns: [22, 22, 14, 22, 28, 16, 18, 18, 14, 22, 22, 13, 13, 20, 24, 24, 34, 22, 24, 34, 24, 26, 34, 42, 42, 24, 38, 28, 18, 22, 48, 28],
      merges: [
        { fromRow: 1, fromColumn: 1, toRow: 1, toColumn: movementHeader.length },
        { fromRow: 2, fromColumn: 1, toRow: 2, toColumn: movementHeader.length },
        { fromRow: 3, fromColumn: 1, toRow: 3, toColumn: movementHeader.length },
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
  const resolved = await resolveOwnerWorkspaceContext(request, { ledger: 'fuel' });
  if (!resolved.ok) return resolved.response;
  const workspace = resolved.context;

  const params = request.nextUrl.searchParams;
  const storageId = asText(params.get('storageId'));
  const year = parseReportYear(asText(params.get('year')));
  const month = year ? parseReportMonth(asText(params.get('month'))) : null;
  const format = parseReportFormat(asText(params.get('format')));
  const includeFuelSlips = asText(params.get('includeFuelSlips')).toLowerCase() !== 'false';
  const dateRange = buildReportDateRange(year, month);

  try {
    const [unfilteredLedger, unfilteredEvents, storage, workspaceAssetIds] = await Promise.all([
      listFuelLedger(workspace.ownerUserId),
      listFuelEventsForReport(workspace.ownerUserId, {
        storageId: storageId || undefined,
        fromIso: dateRange.fromIso,
        toIso: dateRange.toIso,
        includeFuelSlips,
      }),
      storageId ? getFuelStorageById(workspace.ownerUserId, storageId) : Promise.resolve(null),
      getWorkspaceAssetIds(workspace),
    ]);
    const ledger = await filterFuelLedgerForWorkspace(workspace, unfilteredLedger);
    const events = workspaceAssetIds
      ? unfilteredEvents.filter((event) => !event.assetId || workspaceAssetIds.has(event.assetId))
      : unfilteredEvents;

    if (storageId && !storage) {
      return NextResponse.json({ ok: false, error: 'Fuel storage not found.' }, { status: 404 });
    }

    const totalIssued = events
      .filter((event) => event.eventType === 'asset_issue')
      .reduce((sum, event) => sum + event.litres, 0);
    const totalWorkUseIssued = events
      .filter((event) => event.eventType === 'asset_issue' && !event.workUseExcluded)
      .reduce((sum, event) => sum + event.litres, 0);
    const totalExcludedIssued = events
      .filter((event) => event.eventType === 'asset_issue' && event.workUseExcluded)
      .reduce((sum, event) => sum + event.litres, 0);
    const totalStockIn = events
      .filter((event) => event.eventType === 'stock_in' || event.eventType === 'opening_balance')
      .reduce((sum, event) => sum + event.litres, 0);
    const ownerProfile = await getAccountProfile({
      id: workspace.ownerUserId,
      name: workspace.accountantAccess?.ownerName || workspace.actorName,
      email: workspace.accountantAccess ? '' : workspace.actorEmail,
    });
    const ownerDetails = buildOwnerReportDetails(ownerProfile, {
      name: workspace.accountantAccess?.ownerName || workspace.actorName,
      email: workspace.accountantAccess ? '' : workspace.actorEmail,
    });
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
    const rawLogoUrl = await getAssetRegisterReportLogoUrl(workspace.ownerUserId).catch(() => '');
    const logoUrl = await resolveReportLogoUrlForHtml(rawLogoUrl, request.url);
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
      totalWorkUseIssued,
      totalExcludedIssued,
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
