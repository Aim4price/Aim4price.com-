import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '../../../../lib/auth-session';
import { getAccountProfile, type AccountProfile } from '../../../../lib/account-profile';
import { getAssetRegisterItemById, type AssetRegisterItem } from '../../../../lib/asset-register-db';
import { getAssetRegisterReportLogoUrl } from '../../../../lib/asset-registers';
import { listScanEventsForAsset, type ScanEventRecord } from '../../../../lib/scan-assets';
import {
  buildDepreciationAnnualSummary,
  buildDepreciationLogSummary,
  listAssetDepreciationLogEntriesForAsset,
  type AssetDepreciationLogEntry,
  type DepreciationAnnualSummary,
  type DepreciationLogSummary,
} from '../../../../lib/asset-depreciation-timeline';
import { createXlsxWorkbook, type XlsxCellStyle, type XlsxCellValue, type XlsxPrimitiveCellValue, type XlsxSheet } from '../../../../lib/simple-xlsx';
import { resolveReportLogoUrlForHtml } from '../../../../lib/report-logo';
import { getDealerTrackedAsset } from '../../../../lib/dealer-maintenance-tracker';
import { getAssetGroupById } from '../../../../lib/asset-groups';
import { getOwnerAppAccess, ownerAppCanAccessAsset } from '../../../../lib/owner-app-access';
import { renderReportHtmlToPdf } from '../../../../lib/report-pdf';
import { resolveMaintenanceMeterReading } from '../../../../lib/usage-readings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PdfReportKind = 'fuel' | 'maintenance' | 'depreciation';
type ReportFormat = 'pdf' | 'xlsx' | 'html';
type ScopedScanEventRecord = ScanEventRecord & { reportAsset?: AssetRegisterItem };

type AssetStatusChoice = 'yes' | 'no' | 'unknown' | 'not_applicable';

type KeyValueRow = {
  label: string;
  value: string;
  valueHtml?: string;
  hyperlink?: string;
};

type OwnerReportDetails = {
  businessName: string;
  contactDetails: string;
  businessEmail: string;
  locationAddress: string;
};

type ReportSummary = {
  label: string;
  value: string;
  subtext: string;
  basis: string;
  updated: string;
};

type MaintenanceKind = 'checked' | 'serviced' | 'repaired';
type MaintenanceReportType = 'all' | MaintenanceKind;

type MaintenanceEntry = {
  kind: MaintenanceKind;
  label: string;
  items: string[];
  company: string;
  mechanic: string;
  notes: string;
  event: ScanEventRecord;
};

type FuelAverageUsageMetric = 'hours' | 'km';

type FuelAverageResult = {
  metric: FuelAverageUsageMetric | null;
  available: boolean;
  value: number | null;
  valueLabel: string;
  basisLabel: string;
  statusText: string;
  intervalsUsed: number;
  minimumIntervals: number;
  totalLitres: number | null;
  usageDelta: number | null;
};

type FuelFillEntry = {
  event: ScanEventRecord;
  litres: number;
  usage: number;
};

type FuelFillInterval = {
  previous: FuelFillEntry;
  current: FuelFillEntry;
  litres: number;
  usageDelta: number;
};

const MIN_FUEL_AVERAGE_INTERVALS = 5;
const REPORT_TIME_ZONE = 'Africa/Johannesburg';
const NOT_RECORDED = 'Not recorded';

const REPORT_LABELS: Record<PdfReportKind, string> = {
  fuel: 'Fuel Report',
  maintenance: 'Maintenance Report',
  depreciation: 'Depreciation Log',
};

const MAINTENANCE_TYPE_LABELS: Record<MaintenanceReportType, string> = {
  all: 'All',
  checked: 'Checked',
  serviced: 'Service',
  repaired: 'Repair',
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function displayValue(value: unknown, fallback = '-'): string {
  const text = normalizeSpaces(value);
  return text || fallback;
}

function recordedText(value: unknown): string {
  const text = normalizeSpaces(value);
  return !text || text === '-' ? NOT_RECORDED : text;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeAssetStatusChoice(value: unknown, fallback: AssetStatusChoice = 'unknown'): AssetStatusChoice {
  const normalized = String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');

  if (['yes', 'y', 'true', 'financed', 'insured', 'licensed', 'licenced'].includes(normalized)) {
    return 'yes';
  }

  if (['no', 'n', 'false', 'not_financed', 'not_insured', 'not_licensed', 'not_licenced', 'unfinanced', 'uninsured', 'unlicensed', 'unlicenced'].includes(normalized)) {
    return 'no';
  }

  if (['na', 'n_a', 'not_applicable', 'not_aplicable', 'not_relevant', 'does_not_apply'].includes(normalized)) {
    return 'not_applicable';
  }

  if (['unknown', 'not_sure', 'unsure', 'maybe', ''].includes(normalized)) {
    return normalized ? 'unknown' : fallback;
  }

  return fallback;
}

function readFinanceStatusChoice(asset: AssetRegisterItem): AssetStatusChoice {
  const specs = isPlainRecord(asset.specsJson) ? asset.specsJson : {};

  return normalizeAssetStatusChoice(
    specs.financeStatus ?? specs.finance_status ?? specs.financedStatus ?? specs.financed_status,
    asset.isFinanced ? 'yes' : 'no',
  );
}

function readInsuranceStatusChoice(asset: AssetRegisterItem): AssetStatusChoice {
  const specs = isPlainRecord(asset.specsJson) ? asset.specsJson : {};

  return normalizeAssetStatusChoice(
    specs.insuranceStatus ?? specs.insurance_status ?? specs.insuredStatus ?? specs.insured_status,
    asset.isInsured ? 'yes' : 'no',
  );
}

function readLicenseStatusChoice(asset: AssetRegisterItem): AssetStatusChoice {
  const specs = isPlainRecord(asset.specsJson) ? asset.specsJson : {};

  return normalizeAssetStatusChoice(
    specs.licenseStatus ??
      specs.license_status ??
      specs.licensedStatus ??
      specs.licensed_status ??
      specs.licenceStatus ??
      specs.licence_status ??
      specs.licencedStatus ??
      specs.licenced_status,
    asset.isLicensed ? 'yes' : 'no',
  );
}

function readLicenseRegistrationNumber(asset: AssetRegisterItem): string {
  const direct = normalizeSpaces(asset.licenseRegistrationNumber).toUpperCase();
  if (direct) return direct;

  const specs = isPlainRecord(asset.specsJson) ? asset.specsJson : {};

  return normalizeSpaces(
    specs.licenseRegistrationNumber ??
      specs.license_registration_number ??
      specs.licenceRegistrationNumber ??
      specs.licence_registration_number ??
      specs.licenseRegistration ??
      specs.license_registration ??
      specs.licenceRegistration ??
      specs.licence_registration ??
      specs.registrationNumber ??
      specs.registration_number ??
      specs.numberPlate ??
      specs.number_plate ??
      specs.numberplate,
  ).toUpperCase();
}

function licenseRegistrationRows(asset: AssetRegisterItem): KeyValueRow[] {
  const registration = readLicenseRegistrationNumber(asset);

  return readLicenseStatusChoice(asset) === 'yes' && registration
    ? [{ label: 'Registration', value: registration }]
    : [];
}

function statusChoiceReportLabel(value: AssetStatusChoice): string {
  const normalized = normalizeAssetStatusChoice(value);

  if (normalized === 'yes') return 'Yes';
  if (normalized === 'no') return 'No';
  if (normalized === 'not_applicable') return 'Not applicable';
  return 'Not sure';
}

function slugifyFileSegment(value: string): string {
  return (
    String(value ?? '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'asset'
  );
}

function normalizeReportKind(value: unknown): PdfReportKind | null {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-');

  if (normalized === 'fuel' || normalized === 'fuel-report') return 'fuel';
  if (
    normalized === 'maintenance' ||
    normalized === 'maintenance-report' ||
    normalized === 'maintainance' ||
    normalized === 'maintainance-report'
  ) {
    return 'maintenance';
  }

  if (
    normalized === 'depreciation' ||
    normalized === 'depreciation-report' ||
    normalized === 'depreciation-log' ||
    normalized === 'asset-depreciation-log' ||
    normalized === 'depreciation-timeline' ||
    normalized === 'market-depreciation' ||
    normalized === 'market-depreciation-timeline'
  ) {
    return 'depreciation';
  }

  return null;
}

function normalizeMaintenanceReportType(value: unknown): MaintenanceReportType {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[_\s-]+/g, '-');

  if (normalized === 'checked' || normalized === 'check') return 'checked';
  if (normalized === 'serviced' || normalized === 'service') return 'serviced';
  if (normalized === 'repaired' || normalized === 'repair') return 'repaired';
  return 'all';
}

function parseReportFormat(value: unknown): ReportFormat {
  const format = String(value ?? '').trim().toLowerCase();
  if (format === 'xlsx' || format === 'html') return format;
  return 'pdf';
}

function isPropertyLikeAsset(asset: Pick<AssetRegisterItem, 'kind'> | null | undefined): boolean {
  return asText(asset?.kind).toLowerCase() === 'property';
}

function isPropertyBlockedReportKind(reportKind: PdfReportKind): boolean {
  return reportKind === 'fuel' || reportKind === 'depreciation';
}

type ReportDateRange = {
  fromIso?: string;
  toIso?: string;
  label: string;
};

function parseReportYear(value: string): number | null {
  const normalized = value.trim();

  if (!/^\d{4}$/.test(normalized)) return null;

  const year = Number(normalized);
  return year >= 2000 && year <= 2100 ? year : null;
}

function parseReportMonth(value: string): number | null {
  const normalized = value.trim();

  if (!/^\d{1,2}$/.test(normalized)) return null;

  const month = Number(normalized);
  return month >= 1 && month <= 12 ? month : null;
}

function monthYearLabel(year: number, month: number): string {
  return new Intl.DateTimeFormat('en-ZA', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function johannesburgMonthBoundaryIso(year: number, zeroBasedMonth: number): string {
  const boundary = new Date(Date.UTC(year, zeroBasedMonth, 1));
  const boundaryYear = boundary.getUTCFullYear();
  const boundaryMonth = String(boundary.getUTCMonth() + 1).padStart(2, '0');
  return new Date(`${boundaryYear}-${boundaryMonth}-01T00:00:00+02:00`).toISOString();
}

function buildReportDateRange(year: number | null, month: number | null): ReportDateRange {
  if (!year) {
    return { label: 'All available entries' };
  }

  if (month) {
    return {
      fromIso: johannesburgMonthBoundaryIso(year, month - 1),
      toIso: johannesburgMonthBoundaryIso(year, month),
      label: monthYearLabel(year, month),
    };
  }

  return {
    fromIso: johannesburgMonthBoundaryIso(year, 0),
    toIso: johannesburgMonthBoundaryIso(year + 1, 0),
    label: String(year),
  };
}

function formatDate(value?: string | null): string {
  if (!value) return '-';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';

  return new Intl.DateTimeFormat('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: REPORT_TIME_ZONE,
  }).format(parsed);
}

function formatDateTime(value?: string | null): string {
  if (!value) return '-';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';

  return new Intl.DateTimeFormat('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: REPORT_TIME_ZONE,
  }).format(parsed);
}

function formatExcelDateTime(value?: string | null): Date | null {
  if (!value) return null;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  const parts = new Intl.DateTimeFormat('en-ZA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    hourCycle: 'h23',
    timeZone: REPORT_TIME_ZONE,
  }).formatToParts(parsed);

  const valueFor = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  const components = ['year', 'month', 'day', 'hour', 'minute', 'second'].map((type) => Number(valueFor(type as Intl.DateTimeFormatPartTypes)));
  if (components.some((component) => !Number.isFinite(component))) return null;

  return new Date(Date.UTC(
    components[0],
    components[1] - 1,
    components[2],
    components[3],
    components[4],
    components[5],
  ));
}

function formatInteger(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '-';
  }

  return Math.round(value).toLocaleString('en-ZA');
}

function formatNumber(value: number | null | undefined, digits = 0): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '-';
  }

  return value.toLocaleString('en-ZA', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function coercePositiveNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[^0-9.-]+/g, ''));
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return null;
}

function readAssetReplacementPriceExVat(asset: AssetRegisterItem): number | null {
  const direct = coercePositiveNumber(asset.replacementPriceExVat);
  if (direct !== null) return direct;

  const specs = isPlainRecord(asset.specsJson) ? asset.specsJson : {};

  return coercePositiveNumber(
    specs.replacementPriceExVat ??
      specs.replacement_price_ex_vat ??
      specs.replacementPrice ??
      specs.replacement_price ??
      specs.replacementPriceUsedExVat ??
      specs.replacement_price_used_ex_vat ??
      specs.userReplacementPriceExVat ??
      specs.user_replacement_price_ex_vat,
  );
}

function formatMoney(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return '-';
  }

  return `R ${formatNumber(value)}`;
}

function formatMoneyExVat(value: number | null | undefined): string {
  const formatted = formatMoney(value);
  return formatted === '-' ? '-' : `${formatted} excl. VAT`;
}

function formatSignedMoney(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '-';
  }

  if (Math.abs(value) < 0.005) {
    return 'R 0';
  }

  const prefix = value < 0 ? '-R ' : 'R ';
  return `${prefix}${formatNumber(Math.abs(value))}`;
}

function formatMovementPercent(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '-';
  }

  return `${formatNumber(value, 2)}%`;
}

function movementPercentForExcel(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;

  return Math.round((value / 100) * 1_000_000) / 1_000_000;
}

function formatDepreciationUsage(amount: number | null | undefined, metric: string): string {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    return '-';
  }

  const normalizedMetric = String(metric ?? '').trim().toLowerCase();
  if (normalizedMetric === 'percent') {
    return `${formatNumber(amount, Number.isInteger(amount) ? 0 : 1)}% worked`;
  }

  if (normalizedMetric === 'km') {
    return `${formatNumber(amount)} km`;
  }

  return `${formatNumber(amount)} hours`;
}

function formatDepreciationEventLabel(eventType: string): string {
  const normalized = String(eventType ?? '').trim().toLowerCase();

  return (
    {
      backfill_current_asset_state: 'Opening value',
      manual_asset_created: 'Opening value',
      manual_asset_updated: 'Manual asset update',
      valuation_asset_saved: 'Valuation saved',
      automatic_revaluation_saved: 'Revalue saved',
      qr_scan_update: 'QR scan update',
      asset_snapshot: 'Log entry',
    }[normalized] ?? displayValue(eventType, 'Log entry')
  );
}

function formatFuel(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '-';
  }

  return `${Math.max(0, Math.min(100, Math.round(value)))}%`;
}

function formatLitres(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return '-';
  }

  return `${value.toLocaleString('en-ZA', { maximumFractionDigits: 2 })} L`;
}

function roundLitres(value: number): number {
  return Math.round(value * 100) / 100;
}

function readFuelAverageUsageMetric(asset: AssetRegisterItem): FuelAverageUsageMetric | null {
  const specs = isPlainRecord(asset.specsJson) ? asset.specsJson : {};
  const rawUsage = String(
    specs.usageMetric ??
      specs.usage_metric ??
      specs.usageUnit ??
      specs.usage_unit ??
      specs.usageMetricType ??
      specs.usage_metric_type ??
      specs.selectedUsageMetric ??
      specs.selected_usage_metric ??
      '',
  )
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');

  if (['km', 'kms', 'kilometre', 'kilometres', 'kilometer', 'kilometers', 'odometer'].includes(rawUsage)) {
    return 'km';
  }

  if (['hour', 'hours', 'hr', 'hrs', 'engine_hours', 'engine-hours'].includes(rawUsage)) {
    return 'hours';
  }

  return null;
}

function fuelAverageUsageReading(event: ScanEventRecord, metric: FuelAverageUsageMetric | null): number | null {
  if (!metric) return null;
  if (event.assetUsageMetric === 'percentage' || event.assetUsageMetric === 'none') return null;
  if (event.assetUsageMetric && event.assetUsageMetric !== metric) return null;

  const reading = event.assetUsageReading ?? event.hours;
  if (typeof reading !== 'number' || !Number.isFinite(reading) || reading < 0) return null;
  return reading;
}

function formatFuelAverageUsageDelta(value: number | null | undefined, metric: FuelAverageUsageMetric | null): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || !metric) {
    return '-';
  }

  return metric === 'km' ? `${formatNumber(value)} km` : `${formatNumber(value)} hours`;
}

function formatFuelAverageNumber(value: number): string {
  if (value >= 100) return formatNumber(value, 1);
  if (value >= 10) return formatNumber(value, 2);
  return formatNumber(value, 2);
}

function formatFuelAverageValue(value: number | null | undefined, metric: FuelAverageUsageMetric | null): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || !metric) {
    return 'Not enough data';
  }

  return metric === 'km'
    ? `${formatFuelAverageNumber(value)} km/L`
    : `${formatFuelAverageNumber(value)} L/hour`;
}

function isFuelReportEvent(event: ScanEventRecord): boolean {
  const hasFuelPercent = typeof event.fuelPercent === 'number' && Number.isFinite(event.fuelPercent);
  const hasFuelLitres = typeof event.fuelLitres === 'number' && Number.isFinite(event.fuelLitres) && event.fuelLitres > 0;

  return hasFuelPercent || hasFuelLitres || Boolean(asText(event.fuelStorageEventId)) || Boolean(asText(event.fuelSlipId));
}

function fuelEventTimestamp(event: ScanEventRecord): string {
  return asText(event.reportOccurredAtIso) || asText(event.createdAtIso);
}

function filterFuelReportEvents(events: ScanEventRecord[]): ScanEventRecord[] {
  return events.filter(isFuelReportEvent);
}

function isPositiveLitres(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function compareFuelFillEntries(left: FuelFillEntry, right: FuelFillEntry): number {
  const leftTime = new Date(fuelEventTimestamp(left.event)).getTime();
  const rightTime = new Date(fuelEventTimestamp(right.event)).getTime();

  if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) {
    return leftTime - rightTime;
  }

  return String(left.event.id).localeCompare(String(right.event.id));
}

function isRealFuelFillRecord(event: ScanEventRecord): boolean {
  if (!isPositiveLitres(event.fuelLitres)) {
    return false;
  }

  if (parseMaintenanceEvent(event)) {
    return false;
  }

  const ledgerEventType = asText(event.fuelLedgerEventType).toLowerCase();

  if (ledgerEventType && ledgerEventType !== 'asset_issue') {
    return false;
  }

  return true;
}

function buildFuelFillIntervals(fuelEvents: ScanEventRecord[], metric: FuelAverageUsageMetric | null): FuelFillInterval[] {
  const fillEntries = fuelEvents
    .map((event): FuelFillEntry | null => {
      const litres = event.fuelLitres;

      if (!isRealFuelFillRecord(event) || !isPositiveLitres(litres)) {
        return null;
      }

      const usage = fuelAverageUsageReading(event, metric);

      if (usage === null) {
        return null;
      }

      return {
        event,
        litres,
        usage,
      };
    })
    .filter((entry): entry is FuelFillEntry => entry !== null)
    .sort(compareFuelFillEntries);

  const intervals: FuelFillInterval[] = [];

  for (let index = 1; index < fillEntries.length; index += 1) {
    const previous = fillEntries[index - 1];
    const current = fillEntries[index];
    const usageDelta = current.usage - previous.usage;

    if (usageDelta <= 0 || !Number.isFinite(usageDelta)) {
      continue;
    }

    intervals.push({
      previous,
      current,
      litres: current.litres,
      usageDelta,
    });
  }

  return intervals;
}

function calculateFuelAverage(asset: AssetRegisterItem, fuelEvents: ScanEventRecord[]): FuelAverageResult {
  const metric = readFuelAverageUsageMetric(asset);
  const intervals = buildFuelFillIntervals(fuelEvents, metric);
  const selectedIntervals = intervals.slice(-MIN_FUEL_AVERAGE_INTERVALS);
  const intervalsUsed = selectedIntervals.length;
  const totalLitres = intervalsUsed ? selectedIntervals.reduce((sum, interval) => sum + interval.litres, 0) : null;
  const usageDelta = intervalsUsed ? selectedIntervals.reduce((sum, interval) => sum + interval.usageDelta, 0) : null;
  const basisLabel = `Latest ${MIN_FUEL_AVERAGE_INTERVALS} valid fuel-fill intervals`;

  if (!metric) {
    return {
      metric,
      available: false,
      value: null,
      valueLabel: 'Not enough data',
      basisLabel: 'Fuel average is only calculated for hours or kilometre usage.',
      statusText: 'Fuel average is only calculated for hours or kilometre usage.',
      intervalsUsed,
      minimumIntervals: MIN_FUEL_AVERAGE_INTERVALS,
      totalLitres,
      usageDelta,
    };
  }

  if (intervalsUsed < MIN_FUEL_AVERAGE_INTERVALS) {
    return {
      metric,
      available: false,
      value: null,
      valueLabel: 'Not enough data',
      basisLabel,
      statusText: `Available after ${MIN_FUEL_AVERAGE_INTERVALS} valid fuel-fill intervals.`,
      intervalsUsed,
      minimumIntervals: MIN_FUEL_AVERAGE_INTERVALS,
      totalLitres,
      usageDelta,
    };
  }

  if (typeof usageDelta !== 'number' || !Number.isFinite(usageDelta) || usageDelta <= 0 || !totalLitres || totalLitres <= 0) {
    return {
      metric,
      available: false,
      value: null,
      valueLabel: 'Not enough data',
      basisLabel,
      statusText: 'Needs positive usage movement across the latest valid fuel-fill intervals.',
      intervalsUsed,
      minimumIntervals: MIN_FUEL_AVERAGE_INTERVALS,
      totalLitres,
      usageDelta,
    };
  }

  const value = metric === 'km' ? usageDelta / totalLitres : totalLitres / usageDelta;

  return {
    metric,
    available: true,
    value,
    valueLabel: formatFuelAverageValue(value, metric),
    basisLabel,
    statusText: basisLabel,
    intervalsUsed,
    minimumIntervals: MIN_FUEL_AVERAGE_INTERVALS,
    totalLitres,
    usageDelta,
  };
}

function buildFuelAverageRows(average: FuelAverageResult): KeyValueRow[] {
  return [
    { label: 'Basis', value: average.basisLabel },
    { label: 'Records Used', value: `${formatNumber(average.intervalsUsed)} / ${formatNumber(average.minimumIntervals)} valid intervals` },
    { label: 'Litres Filled', value: formatLitres(average.totalLitres) },
    { label: 'Usage Change', value: formatFuelAverageUsageDelta(average.usageDelta, average.metric) },
  ];
}

function renderFuelAverageCard(asset: AssetRegisterItem, fuelEvents: ScanEventRecord[]): string {
  const average = calculateFuelAverage(asset, fuelEvents);
  const unitHeading = average.metric === 'km' ? 'KM PER LITRE' : average.metric === 'hours' ? 'LITRES PER HOUR' : 'FUEL AVERAGE';

  return `
    <section class="assetReportSideCard assetReportFuelAverageCard">
      <h2>Fuel Average</h2>
      <div class="assetReportFuelAverageHero ${average.available ? 'assetReportFuelAverageHeroReady' : 'assetReportFuelAverageHeroPending'}">
        <span>${escapeHtml(unitHeading)}</span>
        <strong>${escapeHtml(average.valueLabel)}</strong>
      </div>
      ${renderRows(buildFuelAverageRows(average), 'No fuel average details available.', 'assetReportFuelAverageRows')}
    </section>
  `;
}

function numberForExcel(value: number | null | undefined, digits = 2): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;

  const factor = 10 ** Math.max(0, digits);
  return Math.round(value * factor) / factor;
}

function percentForExcel(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;

  return Math.max(0, Math.min(100, value)) / 100;
}

function excelText(value: unknown): string {
  const text = normalizeSpaces(value);
  return text === '-' ? '' : text;
}

function excelRecordedText(value: unknown): string {
  return recordedText(value);
}

function calculateAssetDieselBeforeFill(event: ScanEventRecord): number | null {
  const litresIssued = event.fuelLitres;
  const beforePercent = event.assetFuelPercentBefore;
  const afterPercent = event.assetFuelPercentAfter ?? event.fuelPercent;

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

function fuelLedgerActivityLabel(event: ScanEventRecord): string {
  if (event.isLateEntry) return 'Late Entry · Asset filled';
  if (event.sourceType === 'fuel_slip' || event.fuelSlipId) return 'Fuel Slip · Asset filled';
  const normalized = asText(event.fuelLedgerEventType).toLowerCase();

  if (normalized === 'asset_issue') return 'Asset filled';
  if (normalized === 'stock_in') return 'Tank filled';
  if (normalized === 'opening_balance') return 'Opening balance';
  if (normalized === 'dip') return 'Tank dip / stock count';
  if (normalized === 'adjustment') return 'Manual correction';

  return event.fuelStorageEventId ? 'Fuel ledger entry' : 'QR fuel reading';
}

function fuelStorageLabel(event: ScanEventRecord): string {
  return asText(event.fuelStorageName)
    || asText(event.fuelSlipSupplierName)
    || (event.fuelStorageId ? 'Fuel storage' : event.fuelSlipId ? 'External fuel purchase' : '-');
}

function formatPercent(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '-';
  }

  const rounded = Math.max(0, Math.min(100, Math.round(value * 10) / 10));
  return `${Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)}%`;
}

function formatBoolean(value: boolean): string {
  return value ? 'Yes' : 'No';
}

function formatQrStatus(value: string): string {
  const normalized = String(value ?? '').trim().toLowerCase();

  return (
    {
      active: 'Active',
      transferred: 'Transferred',
      retired: 'Retired',
      deleted: 'Deleted',
    }[normalized] ?? 'Pending'
  );
}

function formatActorType(value: string): string {
  const normalized = String(value ?? '').trim().toLowerCase();

  return (
    {
      scan_pin: 'Farm PIN',
      owner_session: 'Owner session',
      admin_session: 'Manager / admin',
    }[normalized] ?? 'Farm PIN'
  );
}


function formatOperatorLabel(event: ScanEventRecord): string {
  return asText(event.operatorName) || formatActorType(event.actorType);
}

function formatEventActivity(event: ScanEventRecord): string {
  return asText(event.activityText) || '-';
}

function formatEventWorkArea(event: ScanEventRecord): string {
  return asText(event.workAreaText) || '-';
}

function fuelIssueDateTimeLabel(event: ScanEventRecord): string {
  if (!event.isLateEntry) return formatDateTime(fuelEventTimestamp(event));
  const date = asText(event.issueDate) || formatDate(fuelEventTimestamp(event));
  return event.issueTimeRecorded && asText(event.issueTime) ? `${date} ${asText(event.issueTime).slice(0, 5)}` : `${date} · Time not recorded`;
}

function fuelIssueDateTimeForExcel(event: ScanEventRecord): XlsxPrimitiveCellValue {
  if (!event.isLateEntry) return formatExcelDateTime(fuelEventTimestamp(event));

  const dateMatch = asText(event.issueDate).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const timeMatch = event.issueTimeRecorded ? asText(event.issueTime).match(/^(\d{2}):(\d{2})/) : null;
  if (!dateMatch || !timeMatch) return fuelIssueDateTimeLabel(event);

  return new Date(Date.UTC(
    Number(dateMatch[1]),
    Number(dateMatch[2]) - 1,
    Number(dateMatch[3]),
    Number(timeMatch[1]),
    Number(timeMatch[2]),
  ));
}

function fuelEntryAddedLabel(event: ScanEventRecord): string {
  return event.isLateEntry || event.sourceType === 'fuel_slip'
    ? formatDateTime(event.entryAddedAtIso)
    : '-';
}

function fuelAddedByLabel(event: ScanEventRecord): string {
  return event.isLateEntry ? asText(event.addedByName) || asText(event.addedByEmail) || '-' : '-';
}

function fuelEvidenceLabel(event: ScanEventRecord): string {
  if (event.sourceType === 'fuel_slip' || event.fuelSlipId) {
    return event.fuelSlipDocumentFileUrl ? 'Fuel slip document captured' : 'Fuel slip recorded without document';
  }
  return event.isLateEntry ? fuelEvidenceStatusLabel(event) : 'Captured live';
}

function fuelWorkUseLabel(event: ScanEventRecord): string {
  if (!event.workUseExcluded) return 'Included in work use';
  return event.workUseExclusionReason
    ? `Excluded · ${event.workUseExclusionReason}`
    : 'Excluded from work use';
}

function fuelEvidenceStatusLabel(event: ScanEventRecord): string {
  if (!event.isLateEntry) return '-';
  return event.evidenceStatus === 'evidence_supplied_review_required'
    ? 'Evidence supplied — review required'
    : 'Internal record only — supporting evidence not supplied';
}

function fuelBalanceTreatmentLabel(event: ScanEventRecord): string {
  if (!event.isLateEntry) return '-';
  if (event.tankBalanceTreatment === 'already_reflected') return 'Already reflected';
  if (event.tankBalanceTreatment === 'not_yet_reflected') return 'Not yet reflected — current correction recorded separately';
  if (event.tankBalanceTreatment === 'not_sure') return 'Not sure — reconciliation required';
  return '-';
}

function fuelHistoricalStorageLabel(event: ScanEventRecord, value: number | null): string {
  return event.isLateEntry ? 'Not recorded' : formatLitres(value);
}

function fuelGpsLabel(event: ScanEventRecord): string {
  if (event.isLateEntry) return 'GPS not captured — desktop late entry';
  return formatLocationText(event.locationText, event.latitude, event.longitude);
}

function fuelUsageMetricLabel(asset: AssetRegisterItem, event: ScanEventRecord): string {
  if (event.assetUsageMetric === 'km') return 'Kilometres';
  if (event.assetUsageMetric === 'percentage') return 'Percentage';
  if (event.assetUsageMetric === 'none') return 'No meter / Not recorded';
  if (event.assetUsageMetric === 'hours') return 'Hours';
  const inferredMetric = readFuelAverageUsageMetric(asset);
  if (inferredMetric === 'km') return 'Kilometres';
  if (inferredMetric === 'hours') return 'Hours';
  return 'Unspecified';
}

function formatPhotoCount(event: ScanEventRecord): string {
  const count = event.photoUrls.length;
  if (!count) return '-';
  return count === 1 ? '1 photo' : `${count} photos`;
}

function formatCondition(value: string): string {
  const normalized = String(value ?? '').trim().toLowerCase();

  return (
    {
      excellent: 'Excellent',
      good: 'Good',
      fair: 'Fair',
      used: 'Used',
      serious: 'Requires attention',
    }[normalized] ?? displayValue(value)
  );
}

function formatAssetKind(asset: AssetRegisterItem): string {
  if (asset.kind === 'vehicle') return 'Vehicle';
  if (asset.kind === 'tractor') return 'Tractor';
  if (asset.kind === 'equipment') return displayValue(asset.equipmentFamilyLabel, 'Equipment');
  if (asset.kind === 'tools') return 'Tools / implements';
  if (asset.kind === 'stock') return 'Stock';
  if (asset.kind === 'property') return 'Property / Land / Building';
  return 'Asset';
}

function formatCoordinates(latitude: number | null, longitude: number | null): string {
  if (
    typeof latitude !== 'number' ||
    !Number.isFinite(latitude) ||
    typeof longitude !== 'number' ||
    !Number.isFinite(longitude)
  ) {
    return '';
  }

  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

function formatLocationText(locationText: string, latitude: number | null, longitude: number | null): string {
  const normalized = asText(locationText);
  const coordinates = formatCoordinates(latitude, longitude);

  if (normalized && coordinates) {
    if (/-?\d{1,3}\.\d{3,}\s*,\s*-?\d{1,3}\.\d{3,}/.test(normalized)) {
      return normalized;
    }

    return /^gps$/i.test(normalized) ? `GPS ${coordinates}` : `${normalized} (${coordinates})`;
  }

  if (normalized) {
    return normalized;
  }

  return coordinates ? `GPS ${coordinates}` : NOT_RECORDED;
}

function buildGoogleMapsUrl(latitude: number | null, longitude: number | null): string | null {
  if (
    typeof latitude !== 'number' ||
    !Number.isFinite(latitude) ||
    typeof longitude !== 'number' ||
    !Number.isFinite(longitude)
  ) {
    return null;
  }

  return `https://www.google.com/maps?q=${latitude},${longitude}`;
}

function getUsageUnit(asset: AssetRegisterItem): 'hours' | 'km' {
  const specs = asset.specsJson && typeof asset.specsJson === 'object' ? asset.specsJson : {};
  const rawUsage = String(
    specs.usageMetric ?? specs.usage_metric ?? specs.usageUnit ?? specs.usage_unit ?? specs.usageMetricType ?? specs.usage_metric_type ?? '',
  )
    .trim()
    .toLowerCase();

  if (asset.kind === 'vehicle') return 'km';
  if (rawUsage === 'km' || rawUsage === 'kms' || rawUsage === 'kilometres' || rawUsage === 'kilometers') return 'km';
  return 'hours';
}

function extractLifeWorkedPercentFromNote(note: string): number | null {
  const match = asText(note).match(/lifetime\s+worked\s+updated\s+to\s+(\d+(?:\.\d+)?)%/i);
  const parsed = match ? Number(match[1]) : NaN;

  return Number.isFinite(parsed) ? Math.max(0, Math.min(100, parsed)) : null;
}

function formatEventUsage(
  asset: AssetRegisterItem,
  event: ScanEventRecord,
  options: { fallbackToLatest?: boolean } = {},
): string {
  if (typeof event.assetUsageReading === 'number' && Number.isFinite(event.assetUsageReading)) {
    if (event.assetUsageMetric === 'km') {
      return `${formatNumber(event.assetUsageReading)} km`;
    }

    if (event.assetUsageMetric === 'percentage') {
      return `${formatNumber(event.assetUsageReading)}% worked`;
    }

    if (event.assetUsageMetric === 'hours') {
      return `${formatNumber(event.assetUsageReading)} hours`;
    }
  }

  if (event.assetUsageMetric === 'none') {
    return 'Not recorded';
  }

  const latestHours = typeof asset.hours === 'number' && Number.isFinite(asset.hours) ? asset.hours : null;

  if (typeof event.hours === 'number' && Number.isFinite(event.hours)) {
    if (event.hours > 0 || !options.fallbackToLatest || latestHours === null || latestHours <= 0) {
      return `${formatInteger(event.hours)} ${getUsageUnit(asset)}`;
    }
  }

  const lifeWorkedPercent = extractLifeWorkedPercentFromNote(event.note);
  if (lifeWorkedPercent !== null) {
    return `${formatPercent(lifeWorkedPercent)} worked`;
  }

  if (options.fallbackToLatest) {
    if (latestHours !== null && latestHours > 0) {
      return `${formatInteger(latestHours)} ${getUsageUnit(asset)}`;
    }

    if (typeof asset.lifeWorkedPercent === 'number' && Number.isFinite(asset.lifeWorkedPercent)) {
      return `${formatPercent(asset.lifeWorkedPercent)} worked`;
    }
  }

  return '-';
}

function formatMaintenanceEventUsage(asset: AssetRegisterItem, event: ScanEventRecord): string {
  const reading = resolveMaintenanceMeterReading(event, getUsageUnit(asset));

  if (reading) {
    return `${formatNumber(reading.value)} ${reading.unit}`;
  }

  return formatEventUsage(asset, event);
}

function formatLatestUsage(asset: AssetRegisterItem): string {
  if (typeof asset.hours === 'number' && Number.isFinite(asset.hours)) {
    return `${formatInteger(asset.hours)} ${getUsageUnit(asset)}`;
  }

  if (typeof asset.lifeWorkedPercent === 'number' && Number.isFinite(asset.lifeWorkedPercent)) {
    return `${formatPercent(asset.lifeWorkedPercent)} worked`;
  }

  return '-';
}

function formatAssetHeroMeta(asset: AssetRegisterItem): string {
  const parts: string[] = [];

  if (typeof asset.yearModel === 'number' && Number.isFinite(asset.yearModel)) {
    parts.push(`Model year: ${asset.yearModel}`);
  }

  const usage = formatLatestUsage(asset);
  if (usage !== '-') {
    parts.push(`Usage: ${usage}`);
  }

  const condition = formatCondition(asset.condition);
  if (condition !== '-') {
    parts.push(`Condition: ${condition}`);
  }

  return parts.length ? parts.join(' • ') : 'QR asset register operational report';
}

function splitItems(value: string): string[] {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function extractLabeledValue(text: string, label: string): string {
  const labels = ['Checked items', 'Work done', 'Repair details', 'Company', 'Mechanic', 'Notes/Problems', 'Notes'];
  const normalizedLabel = label.toLowerCase();
  const targetLabels = normalizedLabel === 'notes' || normalizedLabel === 'notes/problems'
    ? ['Notes/Problems', 'Notes']
    : [label];
  const targetSet = new Set(targetLabels.map((entry) => entry.toLowerCase()));
  const otherLabels = labels
    .filter((entry) => !targetSet.has(entry.toLowerCase()))
    .map((entry) => `${escapeRegExp(entry)}:`)
    .join('|');
  const targetPattern = targetLabels.map((entry) => escapeRegExp(entry)).join('|');
  const pattern = new RegExp(`(?:${targetPattern}):\\s*([\\s\\S]*?)(?=\\s+(?:${otherLabels})|$)`, 'i');
  const match = text.match(pattern);

  return normalizeSpaces(match?.[1] ?? '');
}

function parseMaintenanceEvent(event: ScanEventRecord): MaintenanceEntry | null {
  const note = asText(event.note);
  if (!note) return null;

  const compactNote = normalizeSpaces(note);
  const firstLine = note
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)[0]
    ?.toLowerCase() ?? '';

  let kind: MaintenanceKind | null = null;

  if (/^checked\b/i.test(compactNote) || firstLine.includes('checked') || /checked items:/i.test(compactNote)) {
    kind = 'checked';
  }

  if (/^serviced\b/i.test(compactNote) || firstLine.includes('serviced') || /work done:/i.test(compactNote)) {
    kind = 'serviced';
  }

  if (/^repaired\b/i.test(compactNote) || firstLine.includes('repaired') || /repair details:/i.test(compactNote)) {
    kind = 'repaired';
  }

  if (!kind) {
    return null;
  }

  const checkedItems = extractLabeledValue(note, 'Checked items');
  const workDone = extractLabeledValue(note, 'Work done');
  const repairDetails = extractLabeledValue(note, 'Repair details');
  const items = kind === 'checked'
    ? splitItems(checkedItems)
    : kind === 'repaired'
      ? [repairDetails].filter(Boolean)
      : splitItems(workDone);
  const company = extractLabeledValue(note, 'Company');
  const mechanic = extractLabeledValue(note, 'Mechanic');
  const notes = extractLabeledValue(note, 'Notes/Problems');

  return {
    kind,
    label: kind === 'checked' ? 'Checked' : kind === 'repaired' ? 'Repaired' : 'Serviced',
    items,
    company,
    mechanic,
    notes,
    event,
  };
}

function renderRows(rows: KeyValueRow[], emptyText = 'No details available.', className = ''): string {
  const visibleRows = rows.filter((row) => String(row.label ?? '').trim());
  const rowsClassName = ['assetReportRows', className.trim()].filter(Boolean).join(' ');

  if (!visibleRows.length) {
    return `<div class="assetReportEmpty">${escapeHtml(emptyText)}</div>`;
  }

  return `
    <div class="${escapeHtml(rowsClassName)}">
      ${visibleRows
        .map(
          (row) => `
            <div class="assetReportRow">
              <span>${escapeHtml(row.label)}</span>
              <strong>${row.valueHtml ?? escapeHtml(displayValue(row.value))}</strong>
            </div>
          `,
        )
        .join('')}
    </div>
  `;
}

function renderTable(options: { className?: string; headers: string[]; rows: string[][]; emptyText: string }): string {
  if (!options.rows.length) {
    return `<div class="assetReportEmpty">${escapeHtml(options.emptyText)}</div>`;
  }

  return `
    <div class="assetReportTableWrap ${escapeHtml(options.className ?? '')}">
      <table class="assetReportTable">
        <thead>
          <tr>${options.headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${options.rows
            .map(
              (row) => `
                <tr>
                  ${row.map((cell) => `<td>${cell}</td>`).join('')}
                </tr>
              `,
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

function buildAssetDetailRows(asset: AssetRegisterItem): KeyValueRow[] {
  return [
    { label: 'Category', value: formatAssetKind(asset) },
    { label: 'Brand', value: asset.brandName || asset.title || NOT_RECORDED },
    { label: 'Model', value: asset.modelName || asset.typedModelName || NOT_RECORDED },
    { label: 'Model year', value: typeof asset.yearModel === 'number' ? String(asset.yearModel) : NOT_RECORDED },
    { label: 'Usage', value: formatLatestUsage(asset) === '-' ? NOT_RECORDED : formatLatestUsage(asset) },
    { label: 'Condition', value: formatCondition(asset.condition) === '-' ? NOT_RECORDED : formatCondition(asset.condition) },
    { label: 'Replacement price (excl. VAT)', value: recordedText(formatMoneyExVat(readAssetReplacementPriceExVat(asset))) },
    { label: 'Serial number', value: asset.serialNumber || NOT_RECORDED },
    { label: 'Financed', value: statusChoiceReportLabel(readFinanceStatusChoice(asset)) },
    { label: 'Insured', value: statusChoiceReportLabel(readInsuranceStatusChoice(asset)) },
    { label: 'Licensed', value: statusChoiceReportLabel(readLicenseStatusChoice(asset)) },
    ...licenseRegistrationRows(asset),
  ];
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
  asset?: AssetRegisterItem,
): OwnerReportDetails {
  const fallbackEmail = asText(fallbackUser.email);
  const businessName =
    asText(profile?.businessName) ||
    asText(profile?.marketplaceSellerName) ||
    asText(profile?.displayName) ||
    asText(profile?.name) ||
    asText(fallbackUser.name) ||
    fallbackEmail ||
    'Aim4price client';
  const contactDetails = asText(profile?.marketplacePhone) || asText(profile?.phone) || asText(asset?.sellerPhone);
  const businessEmail = asText(profile?.marketplaceEmail) || asText(profile?.email) || fallbackEmail;
  const locationAddress = buildOwnerLocationAddress(profile);

  return {
    businessName,
    contactDetails,
    businessEmail,
    locationAddress,
  };
}

function buildClientRows(ownerDetails: OwnerReportDetails): KeyValueRow[] {
  return [
    { label: 'Business name', value: ownerDetails.businessName || NOT_RECORDED },
    { label: 'Contact details', value: ownerDetails.contactDetails || NOT_RECORDED },
    { label: 'Business email', value: ownerDetails.businessEmail || NOT_RECORDED },
    { label: 'Location / address', value: ownerDetails.locationAddress || NOT_RECORDED },
  ];
}

function buildLocationRows(asset: AssetRegisterItem): KeyValueRow[] {
  const mapsUrl = buildGoogleMapsUrl(asset.lastKnownLat, asset.lastKnownLng);

  return [
    { label: 'Last Scanned', value: recordedText(formatDateTime(asset.lastScannedAtIso)) },
    { label: 'Last Location', value: formatLocationText(asset.lastKnownLocationText, asset.lastKnownLat, asset.lastKnownLng) },
    {
      label: 'Map link',
      value: mapsUrl ? 'Open latest position' : NOT_RECORDED,
      valueHtml: mapsUrl ? `<a href="${escapeHtml(mapsUrl)}" target="_blank" rel="noreferrer">Open latest position</a>` : undefined,
      hyperlink: mapsUrl ?? undefined,
    },
  ];
}

function buildFuelRecordRows(asset: AssetRegisterItem, fuelEvents: ScanEventRecord[], dateRangeLabel = 'All available entries'): KeyValueRow[] {
  const latestFuelEvent = fuelEvents[0];
  const litreValues = fuelEvents
    .map((event) => event.fuelLitres)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0);
  const totalLitres = litreValues.length ? litreValues.reduce((sum, value) => sum + value, 0) : null;
  return [
    { label: 'Report Period', value: dateRangeLabel },
    { label: 'Fuel Entries', value: String(fuelEvents.length) },
    { label: 'Total Litres Filled', value: formatLitres(totalLitres) },
    { label: 'Latest fuel source / storage', value: latestFuelEvent ? recordedText(fuelStorageLabel(latestFuelEvent)) : NOT_RECORDED },
    { label: 'Latest fuel entry', value: recordedText(latestFuelEvent ? formatDateTime(fuelEventTimestamp(latestFuelEvent)) : formatDateTime(asset.lastScannedAtIso)) },
    { label: 'Updated', value: recordedText(formatDate(latestFuelEvent ? fuelEventTimestamp(latestFuelEvent) : asset.lastScannedAtIso || asset.updatedAtIso)) },
  ];
}

function buildMaintenanceRecordRows(
  asset: AssetRegisterItem,
  entries: MaintenanceEntry[],
  dateRangeLabel = 'All available entries',
  maintenanceTypeLabel = 'All',
): KeyValueRow[] {
  const checkedCount = entries.filter((entry) => entry.kind === 'checked').length;
  const servicedCount = entries.filter((entry) => entry.kind === 'serviced').length;
  const repairedCount = entries.filter((entry) => entry.kind === 'repaired').length;
  const gpsCount = entries.filter(
    (entry) =>
      typeof entry.event.latitude === 'number' &&
      Number.isFinite(entry.event.latitude) &&
      typeof entry.event.longitude === 'number' &&
      Number.isFinite(entry.event.longitude),
  ).length;
  const photoCount = entries.filter((entry) => entry.event.photoUrls.length > 0).length;
  const latestEntry = entries[0] ?? null;
  const latestMeter = latestEntry
    ? formatMaintenanceEventUsage(asset, latestEntry.event)
    : NOT_RECORDED;

  return [
    { label: 'Report Type', value: maintenanceTypeLabel },
    { label: 'Report Period', value: dateRangeLabel },
    { label: 'Total records', value: String(entries.length) },
    { label: 'Checks', value: String(checkedCount) },
    { label: 'Services', value: String(servicedCount) },
    { label: 'Repairs', value: String(repairedCount) },
    { label: 'Latest record', value: latestEntry ? formatDateTime(latestEntry.event.createdAtIso) : NOT_RECORDED },
    { label: getUsageUnit(asset) === 'km' ? 'Latest kilometre reading' : 'Latest hour meter', value: latestMeter === '-' ? NOT_RECORDED : latestMeter },
    { label: 'Records with GPS', value: String(gpsCount) },
    { label: 'Records with photos', value: String(photoCount) },
    { label: 'Updated', value: formatDate(entries[0]?.event.createdAtIso || asset.lastScannedAtIso || asset.updatedAtIso) },
  ];
}

function buildFuelReportSummary(asset: AssetRegisterItem, fuelEvents: ScanEventRecord[]): ReportSummary {
  return {
    label: 'Fuel Entries',
    value: formatNumber(fuelEvents.length),
    subtext: fuelEvents.length === 1 ? 'recorded fuel entry' : 'recorded fuel entries',
    basis: 'QR Fuel Ledger',
    updated: formatDate(fuelEvents[0] ? fuelEventTimestamp(fuelEvents[0]) : asset.lastScannedAtIso || asset.updatedAtIso),
  };
}

function buildMaintenanceReportSummary(asset: AssetRegisterItem, entries: MaintenanceEntry[]): ReportSummary {
  return {
    label: 'Maintenance',
    value: formatNumber(entries.length),
    subtext: entries.length === 1 ? 'check, service or repair record' : 'checks, services and repairs',
    basis: 'QR Maintenance',
    updated: formatDate(entries[0]?.event.createdAtIso || asset.lastScannedAtIso || asset.updatedAtIso),
  };
}

function reportAssetForEvent(event: ScanEventRecord, fallbackAsset: AssetRegisterItem): AssetRegisterItem {
  return (event as ScopedScanEventRecord).reportAsset ?? fallbackAsset;
}

function reportAssetTitleForEvent(event: ScanEventRecord, fallbackAsset: AssetRegisterItem): string {
  return reportAssetForEvent(event, fallbackAsset).title || fallbackAsset.title || 'Asset';
}

function buildFuelBody(asset: AssetRegisterItem, events: ScanEventRecord[]): string {
  const totalLitres = events
    .filter(isRealFuelFillRecord)
    .map((event) => event.fuelLitres)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0)
    .reduce((sum, value) => sum + value, 0);
  const rows = events.map((event) => {
    const eventAsset = reportAssetForEvent(event, asset);
    const noteParts = [
      normalizeSpaces(event.note),
      event.fuelSlipSupplierName ? `Supplier: ${event.fuelSlipSupplierName}` : '',
      typeof event.fuelSlipTotalAmount === 'number' ? `Total incl. VAT: ${formatMoney(event.fuelSlipTotalAmount)}` : '',
      event.evidenceFileName ? `Evidence: ${event.evidenceFileName}` : '',
      event.evidenceReference ? `Reference: ${event.evidenceReference}` : '',
      fuelWorkUseLabel(event),
    ].filter(Boolean);
    const note = noteParts.join(' · ') || '-';

    return [
      `<strong>${escapeHtml(reportAssetTitleForEvent(event, asset))}</strong>`,
      escapeHtml(fuelIssueDateTimeLabel(event)),
      event.isLateEntry ? '<span class="assetReportLateBadge">Late Entry</span><br/>Asset filled' : escapeHtml(fuelLedgerActivityLabel(event)),
      escapeHtml(fuelStorageLabel(event)),
      `<strong>${escapeHtml(formatLitres(event.fuelLitres))}</strong>`,
      `<strong>${escapeHtml(formatLitres(calculateAssetDieselBeforeFill(event)))}</strong>`,
      escapeHtml(formatEventUsage(eventAsset, event)),
      escapeHtml(formatOperatorLabel(event)),
      escapeHtml(formatEventActivity(event)),
      escapeHtml(formatEventWorkArea(event)),
      escapeHtml(fuelGpsLabel(event)),
      escapeHtml(note.length > 180 ? `${note.slice(0, 177)}...` : note),
    ];
  });

  return `
    <section class="assetReportSection assetReportWideSection">
      <div class="assetReportSectionHeading">
        <div>
          <h2>Fuel Movement Records</h2>
          <p>Late entries preserve the historical issue date separately from the real date added. Historical tank levels remain Not recorded and GPS remains Not captured.</p>
        </div>
        <strong>${escapeHtml(formatNumber(events.length))} ${events.length === 1 ? 'entry' : 'entries'}${totalLitres > 0 ? ` • ${escapeHtml(formatLitres(totalLitres))}` : ''}</strong>
      </div>
      ${renderTable({
        className: 'assetReportFuelTable',
        headers: [
          'Asset', 'Fuel Issued On', 'Source / Activity', 'Storage Unit', 'Litres Issued', 'Before Fill',
          'Usage Reading', 'Operator', 'Activity', 'Work Area', 'GPS', 'Notes / Evidence',
        ],
        rows,
        emptyText: 'No fuel readings have been recorded for this asset yet.',
      })}
    </section>
  `;
}

function renderMaintenanceCards(asset: AssetRegisterItem, entries: MaintenanceEntry[]): string {
  if (!entries.length) {
    return '<div class="assetReportEmpty">No maintenance records have been captured for this asset yet.</div>';
  }

  return `
    <div class="assetReportMaintenanceList">
      ${entries
        .map((entry) => {
          const detailLabel = entry.kind === 'checked' ? 'Checked Items' : entry.kind === 'repaired' ? 'Repair Details' : 'Work Completed';
          const detailText = entry.items.length ? entry.items.join(', ') : NOT_RECORDED;
          const location = formatLocationText(entry.event.locationText, entry.event.latitude, entry.event.longitude);
          const notes = entry.notes || 'No problems or notes recorded';
          const photos = formatPhotoCount(entry.event);
          const meterLabel = getUsageUnit(asset) === 'km' ? 'Kilometre reading' : 'Hour meter';
          const providerDetailsHtml = entry.kind === 'checked'
            ? ''
            : `
                <div class="assetReportMaintenanceDetail">
                  <span>Service provider</span>
                  <strong>${escapeHtml(entry.company || NOT_RECORDED)}</strong>
                </div>
                <div class="assetReportMaintenanceDetail">
                  <span>Technician</span>
                  <strong>${escapeHtml(entry.mechanic || NOT_RECORDED)}</strong>
                </div>
              `;
          const photoGridHtml = entry.event.photoUrls.length
            ? `
                <div class="assetReportMaintenanceDetail">
                  <span>Photos</span>
                  <strong>${escapeHtml(photos)} attached</strong>
                </div>
                <div class="assetReportMaintenancePhotos">
                  <div class="assetReportMaintenancePhotosHeader">
                    <span>Photo evidence</span>
                    <strong>${escapeHtml(photos)}</strong>
                  </div>
                  <div class="assetReportMaintenancePhotoGrid">
                    ${entry.event.photoUrls
                      .map((url, index) => `
                        <figure class="assetReportMaintenancePhoto">
                          <img src="${escapeHtml(url)}" alt="Maintenance photo ${index + 1}" />
                          <figcaption>Photo ${index + 1}</figcaption>
                        </figure>
                      `)
                      .join('')}
                  </div>
                </div>
              `
            : `
                <div class="assetReportMaintenanceDetail">
                  <span>Photos</span>
                  <strong>No photos attached</strong>
                </div>
              `;

          return `
            <article class="assetReportMaintenanceCard">
              <div class="assetReportMaintenanceHeader">
                <div>
                  <span>Record Type</span>
                  <strong>${escapeHtml(entry.label)}</strong>
                </div>
                <div>
                  <span>Recorded on (SAST)</span>
                  <strong>${escapeHtml(formatDateTime(entry.event.createdAtIso))}</strong>
                </div>
                <div>
                  <span>Captured by</span>
                  <strong>${escapeHtml(formatOperatorLabel(entry.event))}</strong>
                </div>
                <div>
                  <span>${escapeHtml(meterLabel)}</span>
                  <strong>${escapeHtml(recordedText(formatMaintenanceEventUsage(asset, entry.event)))}</strong>
                </div>
              </div>

              <div class="assetReportMaintenanceDetails">
                <div class="assetReportMaintenanceDetail assetReportMaintenanceDetailWide">
                  <span>${escapeHtml(detailLabel)}</span>
                  <strong>${escapeHtml(detailText)}</strong>
                </div>
                ${providerDetailsHtml}
                <div class="assetReportMaintenanceDetail assetReportMaintenanceDetailWide">
                  <span>Notes / problems</span>
                  <strong>${escapeHtml(notes)}</strong>
                </div>
                <div class="assetReportMaintenanceDetail">
                  <span>Recorded location</span>
                  <strong>${escapeHtml(location)}</strong>
                </div>
                ${photoGridHtml}
              </div>
            </article>
          `;
        })
        .join('')}
    </div>
  `;
}


function buildMaintenanceBody(asset: AssetRegisterItem, entries: MaintenanceEntry[]): string {
  return `
    <section class="assetReportSection assetReportWideSection">
      <div class="assetReportSectionHeading">
        <div>
          <h2>Maintenance Records</h2>
          <p>Newest first. The header identifies what happened, when it was recorded in South African time, who captured it and the meter reading. Work, provider, notes, location and photo evidence follow below.</p>
        </div>
        <strong>${escapeHtml(formatNumber(entries.length))} ${entries.length === 1 ? 'record' : 'records'}</strong>
      </div>
      ${renderMaintenanceCards(asset, entries)}
    </section>
  `;
}

function buildDepreciationReportSummary(
  asset: AssetRegisterItem,
  summary: DepreciationLogSummary,
): ReportSummary {
  return {
    label: 'Latest Saved Value',
    value: formatMoney(summary.currentValueExVat ?? asset.selectedValueExVat ?? asset.value),
    subtext: 'VAT excluded',
    basis: 'Saved update-log entries',
    updated: formatDate(summary.latestLogEntryDateIso || asset.updatedAtIso),
  };
}

function buildDepreciationRecordRows(
  asset: AssetRegisterItem,
  entries: AssetDepreciationLogEntry[],
  summary: DepreciationLogSummary,
  dateRangeLabel = 'All available entries',
): KeyValueRow[] {
  return [
    { label: 'Report Period', value: dateRangeLabel },
    { label: 'Log entries', value: String(entries.length) },
    { label: 'Opening value', value: formatMoney(summary.openingLogValueExVat) },
    { label: 'Latest saved value', value: formatMoney(summary.currentValueExVat ?? asset.selectedValueExVat ?? asset.value) },
    { label: 'Total difference', value: formatSignedMoney(summary.totalDifferenceExVat) },
    { label: 'Difference %', value: formatMovementPercent(summary.totalMovementPercent) },
    { label: 'First update', value: formatDate(summary.firstLogEntryDateIso) },
    { label: 'Latest update', value: formatDate(summary.latestLogEntryDateIso) },
    { label: 'Latest usage', value: formatDepreciationUsage(summary.latestUsageAmount, summary.latestUsageMetric) },
    { label: 'Latest condition', value: formatCondition(summary.latestCondition || asset.condition) },
    { label: 'Replacement price', value: formatMoneyExVat(summary.replacementPriceUsedExVat ?? readAssetReplacementPriceExVat(asset)) },
    { label: 'Updated', value: formatDate(summary.latestLogEntryDateIso || asset.updatedAtIso) },
  ];
}

function buildDepreciationSummaryRows(summary: DepreciationLogSummary): KeyValueRow[] {
  return [
    { label: 'Opening log value', value: formatMoney(summary.openingLogValueExVat) },
    { label: 'Latest saved value', value: formatMoney(summary.currentValueExVat) },
    { label: 'Total difference', value: formatSignedMoney(summary.totalDifferenceExVat) },
    { label: 'Difference %', value: formatMovementPercent(summary.totalMovementPercent) },
    { label: 'First update date', value: formatDateTime(summary.firstLogEntryDateIso) },
    { label: 'Latest update date', value: formatDateTime(summary.latestLogEntryDateIso) },
    { label: 'Log entries', value: String(summary.logEntryCount) },
    { label: 'Latest usage', value: formatDepreciationUsage(summary.latestUsageAmount, summary.latestUsageMetric) },
    { label: 'Latest condition', value: formatCondition(summary.latestCondition) },
    { label: 'Replacement price used', value: formatMoneyExVat(summary.replacementPriceUsedExVat) },
  ];
}

function readLogReasonMetadata(entry: AssetDepreciationLogEntry): string[] {
  const metadata = isPlainRecord(entry.metadataJson) ? entry.metadataJson : {};
  const candidates = [
    metadata.reason,
    metadata.depreciationReason,
    metadata.updateReason,
    metadata.logEventReasons,
    metadata.depreciationRelevantReasons,
    metadata.valuationRelevantReasons,
    metadata.valuationStaleReasons,
  ];

  const values = candidates.flatMap((candidate) => {
    if (Array.isArray(candidate)) return candidate.map((item) => displayValue(item, '')).filter(Boolean);
    const text = displayValue(candidate, '');
    return text ? [text] : [];
  });

  return Array.from(new Set(values));
}

function formatDepreciationLogSource(entry: AssetDepreciationLogEntry): string {
  const event = formatDepreciationEventLabel(entry.eventType);
  const normalizedSource = asText(entry.eventSource).toLowerCase().replace(/[\s_]+/g, '-');
  const source = ({
    'asset-register-qr-scan': 'Asset Register QR scan',
    'asset-register': 'Asset Register',
    'valuation': 'Valuation',
    'automatic-revaluation': 'Automatic revaluation',
    'opening-backfill': 'Opening record',
  } as Record<string, string>)[normalizedSource] ?? displayValue(entry.eventSource, '');
  return source && source !== '-' ? `${event} · ${source}` : event;
}

function formatDepreciationLogReason(entry: AssetDepreciationLogEntry): string {
  const reasons = readLogReasonMetadata(entry).map((reason) => {
    const normalized = normalizeSpaces(reason).toLowerCase();
    const knownReason = ({
      'usage changed; life worked changed': 'Usage and lifetime worked updated',
      'usage changed': 'Usage reading updated',
      'life worked changed': 'Lifetime worked updated',
      'condition changed': 'Condition updated',
      'replacement price changed': 'Replacement price updated',
      'selected value changed': 'Saved value updated',
    } as Record<string, string>)[normalized];

    if (knownReason) return knownReason;
    const readable = normalizeSpaces(reason).replace(/[_-]+/g, ' ');
    return readable ? `${readable.charAt(0).toUpperCase()}${readable.slice(1)}` : '';
  }).filter(Boolean);

  return Array.from(new Set(reasons)).join('; ') || 'No reason recorded';
}

function buildDepreciationLogBodyRows(entries: AssetDepreciationLogEntry[]): string[][] {
  return entries.map((entry) => [
    escapeHtml(formatDateTime(entry.capturedAtIso)),
    escapeHtml(formatDepreciationLogSource(entry)),
    escapeHtml(formatMoney(entry.previousValueExVat)),
    `<strong>${escapeHtml(formatMoney(entry.newValueExVat))}</strong>`,
    `<strong>${escapeHtml(formatSignedMoney(entry.differenceValueExVat))}</strong>`,
    escapeHtml(formatMovementPercent(entry.differencePercent)),
    escapeHtml(formatDepreciationUsage(entry.usageAmount, entry.usageMetric)),
    escapeHtml(formatCondition(entry.condition)),
    escapeHtml(formatMoneyExVat(entry.replacementPriceExVat)),
    escapeHtml(formatDepreciationLogReason(entry)),
  ]);
}

function buildDepreciationAnnualBodyRows(annualSummaries: DepreciationAnnualSummary[]): string[][] {
  return annualSummaries.map((summary) => {
    const usageCondition = [
      formatDepreciationUsage(summary.latestUsageAmount, summary.latestUsageMetric),
      formatCondition(summary.latestCondition),
    ].filter((value) => value && value !== '-').join(' / ') || '-';

    return [
      escapeHtml(String(summary.year)),
      escapeHtml(formatMoney(summary.openingValueExVat)),
      `<strong>${escapeHtml(formatMoney(summary.closingValueExVat))}</strong>`,
      `<strong>${escapeHtml(formatSignedMoney(summary.yearlyDifferenceExVat))}</strong>`,
      escapeHtml(formatMovementPercent(summary.yearlyMovementPercent)),
      escapeHtml(formatNumber(summary.logEntryCount)),
      escapeHtml(usageCondition),
    ];
  });
}

function buildDepreciationBody(
  entries: AssetDepreciationLogEntry[],
  summary: DepreciationLogSummary,
  annualSummaries: DepreciationAnnualSummary[],
): string {
  return `
    <section class="assetReportSection assetReportWideSection">
      <div class="assetReportSectionHeading">
        <div>
          <h2>Depreciation Log Summary</h2>
          <p>Based only on saved Asset Register updates that changed value or depreciation-relevant information.</p>
        </div>
        <strong>${escapeHtml(formatNumber(summary.logEntryCount))} ${summary.logEntryCount === 1 ? 'entry' : 'entries'}</strong>
      </div>
      ${renderRows(
        buildDepreciationSummaryRows(summary),
        'No depreciation log summary available yet.',
        'assetReportDepreciationSummaryRows',
      )}
    </section>

    <section class="assetReportSection assetReportWideSection">
      <div class="assetReportSectionHeading">
        <div>
          <h2>Depreciation Log</h2>
          <p>Each line is a saved update with the previous value, new value and difference recorded at the update timestamp.</p>
        </div>
        <strong>${escapeHtml(formatNumber(entries.length))} ${entries.length === 1 ? 'entry' : 'entries'}</strong>
      </div>
      ${renderTable({
        className: 'assetReportDepreciationLogTable',
        headers: [
          'Updated',
          'Update source',
          'Previous value',
          'New value',
          'Difference',
          'Difference %',
          'Usage',
          'Condition',
          'Replacement price',
          'Notes / reason',
        ],
        rows: buildDepreciationLogBodyRows(entries),
        emptyText: 'No depreciation log entries have been recorded for this asset yet.',
      })}
    </section>

    <section class="assetReportSection assetReportWideSection">
      <div class="assetReportSectionHeading">
        <div>
          <h2>Annual Summary</h2>
          <p>Year-by-year opening value, closing value and difference calculated only from saved depreciation log entries.</p>
        </div>
        <strong>${escapeHtml(formatNumber(annualSummaries.length))} ${annualSummaries.length === 1 ? 'year' : 'years'}</strong>
      </div>
      ${renderTable({
        className: 'assetReportAnnualTable',
        headers: [
          'Year',
          'Opening value',
          'Closing value',
          'Yearly difference',
          'Yearly difference %',
          'Entries',
          'Latest usage / condition',
        ],
        rows: buildDepreciationAnnualBodyRows(annualSummaries),
        emptyText: 'No annual depreciation log summary is available yet.',
      })}
    </section>
  `;
}

function buildDepreciationReport(
  asset: AssetRegisterItem,
  entries: AssetDepreciationLogEntry[],
  ownerDetails: OwnerReportDetails,
  generatedAt: string,
  logoUrl: string,
  dateRangeLabel = 'All available entries',
  scopeAssets: AssetRegisterItem[] = [asset],
): string {
  const summary = buildDepreciationLogSummary(entries, asset);
  const annualSummaries = buildDepreciationAnnualSummary(entries);
  const isUmbrellaReport = scopeAssets.length > 1 || entries.some((entry) => entry.assetTitle !== asset.title);

  return buildReportHtml({
    reportKind: 'depreciation',
    asset,
    ownerDetails,
    generatedAt,
    logoUrl,
    summary: buildDepreciationReportSummary(asset, summary),
    recordRows: buildDepreciationRecordRows(asset, entries, summary, dateRangeLabel),
    bodyHtml: buildDepreciationBody(entries, summary, annualSummaries),
    identityKicker: isUmbrellaReport ? 'Asset umbrella' : undefined,
    heroMeta: isUmbrellaReport ? `${scopeAssets.length} linked assets · every value movement retains its asset name` : undefined,
    detailHeading: isUmbrellaReport ? 'Umbrella Scope' : undefined,
    detailRows: isUmbrellaReport
      ? [
          { label: 'Umbrella', value: asset.title },
          { label: 'Linked Assets', value: formatNumber(scopeAssets.length) },
          { label: 'Value history entries', value: formatNumber(entries.length) },
          { label: 'Report Period', value: dateRangeLabel },
        ]
      : undefined,
    locationHeading: isUmbrellaReport ? 'Entry Attribution' : undefined,
    locationRows: isUmbrellaReport
      ? [{ label: 'Asset Identity', value: 'Shown on every depreciation entry' }]
      : undefined,
  });
}

function buildReportDisclaimer(reportKind: PdfReportKind): string {
  if (reportKind === 'fuel') {
    return 'Fuel readings, litres and before-fill values are operational records captured from asset QR updates and Fuel Ledger storage QR entries. Before-fill litres are calculated from litres issued and the asset fuel percentage movement, and final fuel use remains subject to physical verification.';
  }

  if (reportKind === 'depreciation') {
    return 'Values are indicative market estimates based on saved Aim4price asset-register information and available pricing inputs. This depreciation log is based on saved Asset Register update entries only and is not a certified valuation, inspection report, SARS tax-depreciation calculation or guarantee of selling price. Final value remains subject to physical inspection, documentation, attachments, condition, location and live market demand.';
  }

  return 'Maintenance records are based on QR updates saved as checked, serviced or repaired. This is an operational maintenance trail and not a certified mechanical inspection report.';
}

function buildReportHtml(options: {
  reportKind: PdfReportKind;
  asset: AssetRegisterItem;
  ownerDetails: OwnerReportDetails;
  generatedAt: string;
  logoUrl: string;
  summary: ReportSummary;
  recordRows: KeyValueRow[];
  bodyHtml: string;
  sideExtraHtml?: string;
  identityKicker?: string;
  heroMeta?: string;
  detailHeading?: string;
  detailRows?: KeyValueRow[];
  locationHeading?: string;
  locationRows?: KeyValueRow[];
}): string {
  const reportTitle = REPORT_LABELS[options.reportKind];
  const asset = options.asset;
  const safeTitle = escapeHtml(asset.title || 'Asset');
  const disclaimer = buildReportDisclaimer(options.reportKind);
  const isWideReport = options.reportKind === 'fuel' || options.reportKind === 'depreciation';
  const printInstruction = options.reportKind === 'depreciation'
    ? 'Save or print this depreciation log.'
    : `Save or print this ${reportTitle.toLowerCase()}.`;
  const pageSize = isWideReport ? 'A4 landscape' : 'A4';
  const pageWidth = isWideReport ? '297mm' : '210mm';
  const pageMinHeight = isWideReport ? '210mm' : '297mm';
  const pageMargin = isWideReport ? '6mm 6mm 7mm' : '8mm 9mm 8mm';
  const pagePadding = isWideReport ? '7mm 6mm 7mm' : '11mm 11mm 9mm';
  const innerMinHeight = isWideReport ? 'calc(210mm - 14mm)' : 'calc(297mm - 20mm)';
  const printPageMinHeight = isWideReport ? '197mm' : '281mm';
  const printInnerMinHeight = '0';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeTitle} - Aim4price ${escapeHtml(reportTitle)}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
    <style>
      :root {
        color-scheme: light;
        --ink: #111827;
        --strong: #070b12;
        --muted: #5f6b7a;
        --faint: #8b95a3;
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
        size: ${pageSize};
        margin: ${pageMargin};
      }

      html,
      body {
        margin: 0;
        padding: 0;
        background: #eef1f4;
        color: var(--ink);
        font-family: "Montserrat", "Segoe UI", Arial, Helvetica, sans-serif;
        font-size: 9.6px;
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
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex: 0 0 auto;
        min-height: 42px;
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
      }

      .assetReportButtonPrimary {
        min-width: 150px;
        border-color: var(--strong);
        background: var(--strong);
        color: #ffffff;
        box-shadow: 0 12px 22px rgba(7, 11, 18, 0.18);
      }

      .assetReportButton:focus-visible {
        outline: 3px solid rgba(17, 24, 39, 0.18);
        outline-offset: 2px;
      }

      .assetReportPage {
        width: min(100%, ${pageWidth});
        min-height: ${pageMinHeight};
        margin: 18px auto;
        padding: ${pagePadding};
        background: var(--paper);
        box-shadow: 0 16px 44px rgba(17, 24, 39, 0.13);
      }

      .assetReportInner {
        position: relative;
        display: flex;
        min-height: ${innerMinHeight};
        flex-direction: column;
      }

      .assetReportHeader {
        display: grid;
        grid-template-columns: 22mm minmax(0, 1fr) 62mm;
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
        grid-template-columns: 21mm minmax(0, 1fr);
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
        grid-template-columns: minmax(0, 1fr) 62mm;
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
        grid-template-columns: 22mm minmax(0, 1fr);
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
        grid-template-columns: minmax(0, 1fr) 62mm;
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
        grid-template-columns: 30mm minmax(0, 1fr);
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

      .assetReportDepreciationSummaryRows .assetReportRow {
        grid-template-columns: 60mm minmax(0, 1fr);
        column-gap: 10px;
        min-height: 18px;
      }

      .assetReportDepreciationSummaryRows .assetReportRow span,
      .assetReportDepreciationSummaryRows .assetReportRow strong {
        white-space: nowrap;
        word-break: keep-all;
        overflow-wrap: normal;
        hyphens: none;
      }

      .assetReportTechnical .assetReportRows {
        display: grid;
        grid-template-columns: 1fr;
        border-top: 1px solid var(--line);
      }

      .assetReportTechnical .assetReportRow {
        grid-template-columns: 31mm minmax(0, 1fr);
        min-height: 21px;
      }

      .assetReportClientCard .assetReportRow {
        grid-template-columns: 31mm minmax(0, 1fr);
        min-height: 20px;
        align-items: start;
        padding: 3px 0;
      }

      .assetReportClientCard .assetReportRow span,
      .assetReportClientCard .assetReportRow strong {
        line-height: 1.35;
      }

      .assetReportEmpty {
        padding: 6px 0;
        color: var(--muted);
        font-size: 8.8px;
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

      .assetReportSideCard .assetReportRows {
        border-top: 1px solid var(--line);
      }

      .assetReportSideCard .assetReportRow {
        grid-template-columns: 21mm minmax(0, 1fr);
        min-height: 17.5px;
      }

      .assetReportSideCard .assetReportRow span {
        font-size: 8.1px;
      }

      .assetReportSideCard .assetReportRow strong {
        font-size: 8.2px;
      }

      .assetReportFuelAverageCard {
        min-height: 38mm;
      }

      .assetReportFuelAverageHero {
        display: grid;
        gap: 5px;
        align-items: center;
        justify-items: center;
        margin-bottom: 8px;
        padding: 10px 8px;
        border: 1px solid var(--line);
        background: var(--soft-2);
        text-align: center;
      }

      .assetReportFuelAverageHero span {
        color: var(--muted);
        font-size: 7.4px;
        line-height: 1.15;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .assetReportFuelAverageHero strong {
        color: var(--strong);
        font-size: 16.5px;
        line-height: 1;
        font-weight: 800;
        letter-spacing: -0.04em;
      }

      .assetReportFuelAverageHero small {
        max-width: 44mm;
        color: var(--muted);
        font-size: 7.1px;
        line-height: 1.3;
        font-weight: 600;
      }

      .assetReportFuelAverageHeroReady {
        border-color: var(--line-strong);
        background: #fbfdfc;
      }

      .assetReportFuelAverageRows .assetReportRow {
        grid-template-columns: 21mm minmax(0, 1fr);
        min-height: 16.5px;
      }

      .assetReportFuelAverageRows .assetReportRow span {
        font-size: 7.8px;
      }

      .assetReportFuelAverageRows .assetReportRow strong {
        font-size: 7.9px;
      }

      .assetReportRecordRows .assetReportRows {
        display: grid;
        gap: 0;
      }

      .assetReportRecordRows .assetReportRow:last-child {
        border-bottom: 0;
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
        max-width: 140mm;
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
        padding: 6px 6px 6px 0;
        border-bottom: 1px solid var(--line);
        color: #38404c;
        font-size: 8px;
        line-height: 1.42;
        text-align: left;
        vertical-align: top;
        overflow-wrap: break-word;
        word-break: normal;
        hyphens: auto;
      }

      .assetReportTable th {
        color: var(--strong);
        font-size: 7.35px;
        line-height: 1.2;
        font-weight: 800;
        letter-spacing: 0.045em;
        text-transform: uppercase;
      }

      .assetReportTable td strong {
        color: var(--strong);
        font-weight: 800;
      }

      .assetReportLateBadge {
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

      .assetReportFuelTable th,
      .assetReportFuelTable td {
        padding: 6px 4.5px 6px 0;
        font-size: 5.75px;
        line-height: 1.32;
      }

      .assetReportFuelTable th {
        font-size: 5.25px;
        line-height: 1.18;
      }

      .assetReportFuelTable th:nth-child(1),
      .assetReportFuelTable td:nth-child(1) { width: 20mm; }
      .assetReportFuelTable th:nth-child(2),
      .assetReportFuelTable td:nth-child(2) { width: 17mm; }
      .assetReportFuelTable th:nth-child(3),
      .assetReportFuelTable td:nth-child(3) { width: 19mm; }
      .assetReportFuelTable th:nth-child(4),
      .assetReportFuelTable td:nth-child(4) { width: 14mm; }
      .assetReportFuelTable th:nth-child(5),
      .assetReportFuelTable td:nth-child(5) { width: 15mm; }
      .assetReportFuelTable th:nth-child(6),
      .assetReportFuelTable td:nth-child(6) { width: 16mm; }
      .assetReportFuelTable th:nth-child(7),
      .assetReportFuelTable td:nth-child(7) { width: 16mm; }
      .assetReportFuelTable th:nth-child(8),
      .assetReportFuelTable td:nth-child(8),
      .assetReportFuelTable th:nth-child(9),
      .assetReportFuelTable td:nth-child(9) { width: 10mm; }
      .assetReportFuelTable th:nth-child(10),
      .assetReportFuelTable td:nth-child(10) { width: 15mm; }
      .assetReportFuelTable th:nth-child(11),
      .assetReportFuelTable td:nth-child(11) { width: 16mm; }
      .assetReportFuelTable th:nth-child(12),
      .assetReportFuelTable td:nth-child(12) { width: 27mm; }
      .assetReportFuelTable th:nth-child(13),
      .assetReportFuelTable td:nth-child(13) { width: 20mm; }
      .assetReportFuelTable th:nth-child(14),
      .assetReportFuelTable td:nth-child(14) { width: 18mm; }
      .assetReportFuelTable th:nth-child(15),
      .assetReportFuelTable td:nth-child(15) { width: 35mm; }

      .assetReportTable tr {
        break-inside: avoid;
        page-break-inside: avoid;
      }

      .assetReportDepreciationLogTable th,
      .assetReportDepreciationLogTable td {
        padding: 6px 4.5px 6px 0;
        font-size: 6.25px;
        line-height: 1.32;
      }

      .assetReportDepreciationLogTable th {
        font-size: 5.65px;
        line-height: 1.18;
      }

      .assetReportDepreciationLogTable th:nth-child(1),
      .assetReportDepreciationLogTable td:nth-child(1) { width: 23mm; }
      .assetReportDepreciationLogTable th:nth-child(2),
      .assetReportDepreciationLogTable td:nth-child(2) { width: 30mm; }
      .assetReportDepreciationLogTable th:nth-child(3),
      .assetReportDepreciationLogTable td:nth-child(3),
      .assetReportDepreciationLogTable th:nth-child(4),
      .assetReportDepreciationLogTable td:nth-child(4),
      .assetReportDepreciationLogTable th:nth-child(5),
      .assetReportDepreciationLogTable td:nth-child(5) { width: 22mm; }
      .assetReportDepreciationLogTable th:nth-child(6),
      .assetReportDepreciationLogTable td:nth-child(6) { width: 16mm; }
      .assetReportDepreciationLogTable th:nth-child(7),
      .assetReportDepreciationLogTable td:nth-child(7) { width: 18mm; }
      .assetReportDepreciationLogTable th:nth-child(8),
      .assetReportDepreciationLogTable td:nth-child(8) { width: 18mm; }
      .assetReportDepreciationLogTable th:nth-child(9),
      .assetReportDepreciationLogTable td:nth-child(9) { width: 22mm; }
      .assetReportDepreciationLogTable th:nth-child(10),
      .assetReportDepreciationLogTable td:nth-child(10) { width: 34mm; }

      .assetReportAnnualTable th,
      .assetReportAnnualTable td {
        padding: 6px 5px 6px 0;
        font-size: 7px;
        line-height: 1.34;
      }

      .assetReportAnnualTable th {
        font-size: 6.35px;
      }

      .assetReportAnnualTable th:nth-child(1),
      .assetReportAnnualTable td:nth-child(1) { width: 18mm; }
      .assetReportAnnualTable th:nth-child(2),
      .assetReportAnnualTable td:nth-child(2),
      .assetReportAnnualTable th:nth-child(3),
      .assetReportAnnualTable td:nth-child(3),
      .assetReportAnnualTable th:nth-child(4),
      .assetReportAnnualTable td:nth-child(4) { width: 29mm; }
      .assetReportAnnualTable th:nth-child(5),
      .assetReportAnnualTable td:nth-child(5) { width: 24mm; }
      .assetReportAnnualTable th:nth-child(6),
      .assetReportAnnualTable td:nth-child(6) { width: 18mm; }

      .assetReportScanTable th:nth-child(1),
      .assetReportScanTable td:nth-child(1) {
        width: 25mm;
      }

      .assetReportScanTable th:nth-child(2),
      .assetReportScanTable td:nth-child(2) {
        width: 25mm;
      }

      .assetReportScanTable th:nth-child(3),
      .assetReportScanTable td:nth-child(3) {
        width: 22mm;
      }

      .assetReportScanTable th:nth-child(4),
      .assetReportScanTable td:nth-child(4) {
        width: 13mm;
      }

      .assetReportScanTable th:nth-child(6),
      .assetReportScanTable td:nth-child(6) {
        width: 43mm;
      }

      .assetReportMaintenanceList {
        display: grid;
        gap: 8px;
      }

      .assetReportMaintenanceCard {
        break-inside: avoid;
        border: 1px solid var(--line);
        background: #ffffff;
      }

      .assetReportMaintenanceHeader {
        display: grid;
        grid-template-columns: 31mm 36mm 35mm minmax(0, 1fr);
        gap: 0;
        border-bottom: 1px solid var(--line);
        background: var(--soft-2);
      }

      .assetReportMaintenanceHeader div {
        min-width: 0;
        padding: 7px 8px;
        border-right: 1px solid var(--line);
      }

      .assetReportMaintenanceHeader div:last-child {
        border-right: 0;
      }

      .assetReportMaintenanceHeader span,
      .assetReportMaintenanceDetail span,
      .assetReportMaintenancePhotosHeader span {
        display: block;
        margin-bottom: 3px;
        color: var(--muted);
        font-size: 7.3px;
        line-height: 1.15;
        font-weight: 800;
        letter-spacing: 0.045em;
        text-transform: uppercase;
      }

      .assetReportMaintenanceHeader strong,
      .assetReportMaintenanceDetail strong,
      .assetReportMaintenancePhotosHeader strong {
        display: block;
        color: var(--strong);
        font-size: 8.6px;
        line-height: 1.35;
        font-weight: 700;
        overflow-wrap: anywhere;
      }

      .assetReportMaintenanceDetails {
        display: grid;
        grid-template-columns: 1fr 1fr;
      }

      .assetReportMaintenanceDetail {
        min-width: 0;
        padding: 7px 8px;
        border-right: 1px solid var(--line);
        border-bottom: 1px solid var(--line);
      }

      .assetReportMaintenanceDetail:nth-child(2n) {
        border-right: 0;
      }

      .assetReportMaintenanceDetailWide {
        grid-column: 1 / -1;
        border-right: 0;
      }

      .assetReportMaintenanceDetail:last-child {
        border-bottom: 0;
      }

      .assetReportMaintenancePhotos {
        grid-column: 1 / -1;
        padding: 7px 8px 8px;
        border-bottom: 0;
        background: #fbfdfc;
      }

      .assetReportMaintenancePhotosHeader {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        margin-bottom: 6px;
      }

      .assetReportMaintenancePhotoGrid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 6px;
      }

      .assetReportMaintenancePhoto {
        min-width: 0;
        margin: 0;
      }

      .assetReportMaintenancePhoto img {
        display: block;
        width: 100%;
        aspect-ratio: 4 / 3;
        object-fit: cover;
        border-radius: 6px;
        border: 1px solid var(--line);
        background: #eef4f1;
      }

      .assetReportMaintenancePhoto figcaption {
        margin-top: 3px;
        color: var(--muted);
        font-size: 6.8px;
        line-height: 1.15;
        font-weight: 800;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }

      a {
        color: var(--strong);
        font-weight: 700;
        text-decoration: none;
      }

      a:hover {
        text-decoration: underline;
      }

      .assetReportFooter {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
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
        max-width: 166mm;
        color: #323a45;
        font-size: 7.35px;
        line-height: 1.35;
        font-style: italic;
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
          grid-template-columns: minmax(0, 0.75fr) minmax(0, 1.25fr);
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
          min-width: 0;
        }

        .assetReportPage {
          padding: 24px;
        }

        .assetReportHeader,
        .assetReportOverview,
        .assetReportContentGrid {
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

        .assetReportMaintenanceHeader,
        .assetReportMaintenanceDetails,
        .assetReportSectionHeading {
          grid-template-columns: 1fr;
        }

        .assetReportMaintenanceHeader div,
        .assetReportMaintenanceDetail {
          border-right: 0;
        }

        .assetReportMaintenancePhotoGrid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }

      @media screen and (max-width: 380px) {
        .assetReportScreenActions {
          grid-template-columns: 1fr;
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
          min-height: ${printPageMinHeight};
          margin: 0;
          padding: 0;
          box-shadow: none;
          overflow: visible;
        }

        .assetReportInner {
          min-height: ${printInnerMinHeight};
        }

        .assetReportFooter {
          margin-top: 12px;
        }

        .assetReportHeader {
          grid-template-columns: 22mm minmax(0, 1fr) 62mm;
        }

        .assetReportOverview,
        .assetReportContentGrid {
          grid-template-columns: minmax(0, 1fr) 62mm;
        }
      }
    </style>
  </head>
  <body>
    <div class="assetReportScreenBar">
      <div class="assetReportScreenText">${escapeHtml(printInstruction)} In the print dialog, choose <strong>Save as PDF</strong>.</div>
      <div class="assetReportScreenActions">
        <button type="button" class="assetReportButton" onclick="window.close()">Close</button>
        <button type="button" class="assetReportButton assetReportButtonPrimary" onclick="window.print()">Save PDF / Print</button>
      </div>
    </div>

    <main class="assetReportPage">
      <div class="assetReportInner">
        <header class="assetReportHeader">
          <div class="assetReportLogoWrap">${options.logoUrl ? `<img class="assetReportLogo" src="${escapeHtml(options.logoUrl)}" alt="Logo" />` : ''}</div>
          <div class="assetReportDocumentTitle">
            <strong>${escapeHtml(reportTitle)}</strong>
            <span>Aim4price asset register</span>
          </div>
          <div class="assetReportHeaderMeta">
            <div class="assetReportMetaLine"><span>Generated</span><strong>${escapeHtml(options.generatedAt)}</strong></div>
            ${options.ownerDetails.businessEmail ? `<div class="assetReportMetaLine"><span>Business Email</span><strong>${escapeHtml(options.ownerDetails.businessEmail)}</strong></div>` : ''}
          </div>
        </header>

        <section class="assetReportOverview">
          <div class="assetReportIdentity">
            <p class="assetReportKicker">${escapeHtml(options.identityKicker ?? formatAssetKind(asset))}</p>
            <h1 class="assetReportTitle">${safeTitle}</h1>
            <p class="assetReportMeta">${escapeHtml(options.heroMeta ?? formatAssetHeroMeta(asset))}</p>
          </div>

          <aside class="assetReportValuationCard">
            <h2>${escapeHtml(options.summary.label)}</h2>
            <strong class="assetReportValue">${escapeHtml(options.summary.value)}</strong>
            <span class="assetReportVat">${escapeHtml(options.summary.subtext)}</span>
            <div class="assetReportValueMeta">
              <div><span>Updated</span><strong>${escapeHtml(options.summary.updated)}</strong></div>
            </div>
          </aside>
        </section>

        <div class="assetReportContentGrid">
          <div class="assetReportMainStack">
            <section class="assetReportSection assetReportTechnical">
              <h2>${escapeHtml(options.detailHeading ?? 'Asset Details')}</h2>
              ${renderRows(options.detailRows ?? buildAssetDetailRows(asset), 'No asset details available.')}
            </section>

            <section class="assetReportSection assetReportClientCard">
              <h2>Client / Asset Owner</h2>
              ${renderRows(buildClientRows(options.ownerDetails), 'No client details available.')}
            </section>
          </div>

          <aside class="assetReportSide">
            <section class="assetReportSideCard assetReportRecordRows">
              <h2>Record Summary</h2>
              ${renderRows(options.recordRows, 'No record details available.')}
            </section>

            <section class="assetReportSideCard assetReportRecordRows">
              <h2>${escapeHtml(options.locationHeading ?? 'Latest Location')}</h2>
              ${renderRows(options.locationRows ?? buildLocationRows(asset), 'No location captured yet.')}
            </section>

            ${options.sideExtraHtml ?? ''}
          </aside>
        </div>

        <div class="assetReportFullStack">
          ${options.bodyHtml}
        </div>

        <footer class="assetReportFooter">
          <div>
            <p class="assetReportPowered">Powered by Aim4price.com</p>
            <div class="assetReportDisclaimer">${escapeHtml(disclaimer)}</div>
          </div>
        </footer>
      </div>
    </main>

    <script>
      (function () {
        function waitForImages() {
          var images = Array.prototype.slice.call(document.images || []);
          if (!images.length) {
            return Promise.resolve();
          }

          return Promise.all(images.map(function (image) {
            if (image.complete) {
              return Promise.resolve();
            }

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

function buildFuelReport(
  asset: AssetRegisterItem,
  events: ScanEventRecord[],
  ownerDetails: OwnerReportDetails,
  generatedAt: string,
  logoUrl: string,
  dateRangeLabel = 'All available entries',
  scopeAssets: AssetRegisterItem[] = [asset],
): string {
  const fuelEvents = filterFuelReportEvents(events);
  const isUmbrellaReport = scopeAssets.length > 1 || fuelEvents.some((event) => Boolean((event as ScopedScanEventRecord).reportAsset));
  const assetsWithFuel = new Set(fuelEvents.map((event) => reportAssetForEvent(event, asset).id)).size;

  return buildReportHtml({
    reportKind: 'fuel',
    asset,
    ownerDetails,
    generatedAt,
    logoUrl,
    summary: buildFuelReportSummary(asset, fuelEvents),
    recordRows: buildFuelRecordRows(asset, fuelEvents, dateRangeLabel),
    bodyHtml: buildFuelBody(asset, fuelEvents),
    sideExtraHtml: isUmbrellaReport ? undefined : renderFuelAverageCard(asset, fuelEvents),
    identityKicker: isUmbrellaReport ? 'Asset umbrella' : undefined,
    heroMeta: isUmbrellaReport ? `${scopeAssets.length} linked assets · each fuel entry is attributed to its actual asset` : undefined,
    detailHeading: isUmbrellaReport ? 'Umbrella Scope' : undefined,
    detailRows: isUmbrellaReport
      ? [
          { label: 'Umbrella', value: asset.title },
          { label: 'Linked Assets', value: formatNumber(scopeAssets.length) },
          { label: 'Assets with Fuel Records', value: formatNumber(assetsWithFuel) },
          { label: 'Report Period', value: dateRangeLabel },
        ]
      : undefined,
    locationHeading: isUmbrellaReport ? 'Entry Locations' : undefined,
    locationRows: isUmbrellaReport
      ? [{ label: 'Location Source', value: 'Shown separately on each fuel entry' }]
      : undefined,
  });
}

function buildMaintenanceReport(
  asset: AssetRegisterItem,
  events: ScanEventRecord[],
  ownerDetails: OwnerReportDetails,
  generatedAt: string,
  logoUrl: string,
  dateRangeLabel = 'All available entries',
  maintenanceReportType: MaintenanceReportType = 'all',
): string {
  const allMaintenanceEntries = events.map((event) => parseMaintenanceEvent(event)).filter((entry): entry is MaintenanceEntry => Boolean(entry));
  const maintenanceEntries = maintenanceReportType === 'all'
    ? allMaintenanceEntries
    : allMaintenanceEntries.filter((entry) => entry.kind === maintenanceReportType);
  const maintenanceTypeLabel = MAINTENANCE_TYPE_LABELS[maintenanceReportType];

  return buildReportHtml({
    reportKind: 'maintenance',
    asset,
    ownerDetails,
    generatedAt,
    logoUrl,
    summary: buildMaintenanceReportSummary(asset, maintenanceEntries),
    recordRows: buildMaintenanceRecordRows(asset, maintenanceEntries, dateRangeLabel, maintenanceTypeLabel),
    bodyHtml: buildMaintenanceBody(asset, maintenanceEntries),
  });
}

function styled(value: XlsxPrimitiveCellValue, style: XlsxCellStyle): XlsxCellValue {
  return { value, style };
}

function linked(value: XlsxPrimitiveCellValue, hyperlink: string | null | undefined, style: XlsxCellStyle = 'link'): XlsxCellValue {
  return hyperlink ? { value, style, hyperlink } : styled(value, style === 'link' ? 'text' : style);
}

function fullWidthRow(value: XlsxPrimitiveCellValue, style: XlsxCellStyle, columnCount: number): XlsxCellValue[] {
  return [styled(value, style), ...Array.from({ length: Math.max(0, columnCount - 1) }, () => '')];
}

function keyValueWorkbookRows(rows: KeyValueRow[]): XlsxCellValue[][] {
  return rows.map((row) => [
    styled(row.label, 'metaLabel'),
    row.hyperlink
      ? linked(excelText(row.value), row.hyperlink)
      : styled(excelText(row.value), 'metaValue'),
  ]);
}

function pairedKeyValueWorkbookRows(leftRows: KeyValueRow[], rightRows: KeyValueRow[]): XlsxCellValue[][] {
  const left = keyValueWorkbookRows(leftRows);
  const right = keyValueWorkbookRows(rightRows);
  const rowCount = Math.max(left.length, right.length);

  return Array.from({ length: rowCount }, (_, index) => [
    left[index]?.[0] ?? '',
    left[index]?.[1] ?? '',
    right[index]?.[0] ?? '',
    right[index]?.[1] ?? '',
  ]);
}

function buildReportSummaryWorkbookSheet(options: {
  reportKind: PdfReportKind;
  asset: AssetRegisterItem;
  ownerDetails: OwnerReportDetails;
  generatedAt: string;
  dateRangeLabel: string;
  recordRows: KeyValueRow[];
}): XlsxSheet {
  const title = `${options.asset.title || 'Asset'} - ${REPORT_LABELS[options.reportKind]}`;
  const subtitle = `${formatAssetHeroMeta(options.asset)} • ${options.dateRangeLabel}`;
  const clientRows = buildClientRows(options.ownerDetails);
  const assetRows = buildAssetDetailRows(options.asset);
  const locationRows = buildLocationRows(options.asset);
  const firstPanelRows = pairedKeyValueWorkbookRows(clientRows, options.recordRows);
  const secondPanelHeadingRow = 9 + firstPanelRows.length;
  const secondPanelRows = pairedKeyValueWorkbookRows(assetRows, locationRows);
  const rows: XlsxCellValue[][] = [
    [styled(title, 'title'), '', '', ''],
    [styled(subtitle, 'subtitle'), '', '', ''],
    [],
    [
      styled('Generated', 'metaLabel'), styled(options.generatedAt, 'metaValue'),
      styled('Report period', 'metaLabel'), styled(options.dateRangeLabel, 'metaValue'),
    ],
    [styled('Report type', 'metaLabel'), styled(REPORT_LABELS[options.reportKind], 'metaValue'), '', ''],
    [],
    [styled('Client', 'section'), '', styled('Report summary', 'section'), ''],
    ...firstPanelRows,
    [],
    [styled('Asset', 'section'), '', styled('Latest location', 'section'), ''],
    ...secondPanelRows,
  ];

  return {
    name: 'Summary',
    rows,
    columns: [24, 34, 24, 34],
    merges: [
      { fromRow: 1, fromColumn: 1, toRow: 1, toColumn: 4 },
      { fromRow: 2, fromColumn: 1, toRow: 2, toColumn: 4 },
      { fromRow: 7, fromColumn: 1, toRow: 7, toColumn: 2 },
      { fromRow: 7, fromColumn: 3, toRow: 7, toColumn: 4 },
      { fromRow: secondPanelHeadingRow, fromColumn: 1, toRow: secondPanelHeadingRow, toColumn: 2 },
      { fromRow: secondPanelHeadingRow, fromColumn: 3, toRow: secondPanelHeadingRow, toColumn: 4 },
    ],
    orientation: 'portrait',
    tabColor: options.reportKind === 'fuel' ? '176B4F' : '10382F',
  };
}

function buildFuelReportWorkbook(
  asset: AssetRegisterItem,
  events: ScanEventRecord[],
  ownerDetails: OwnerReportDetails,
  generatedAt: string,
  dateRangeLabel = 'All available entries',
): XlsxSheet[] {
  const fuelEvents = filterFuelReportEvents(events);
  const fuelAverage = calculateFuelAverage(asset, fuelEvents);
  const recordRows = [
    ...buildFuelRecordRows(asset, fuelEvents, dateRangeLabel),
    { label: 'Fuel Average', value: fuelAverage.valueLabel },
    ...buildFuelAverageRows(fuelAverage),
  ];
  const recordHeaders = [
    'Asset', 'Fuel issued on (SAST)', 'Entry type', 'Fuel source / storage', 'Litres issued', 'Before fill litres',
    'Meter reading', 'Operator', 'Activity', 'Work area', 'Supplier', 'Total incl. VAT', 'Work use', 'Recorded location',
    'Entry added on (late entry / slip, SAST)', 'Evidence / review', 'Document', 'Notes',
  ];
  const auditHeaders = [
    'Asset', 'Fuel issued on (SAST)', 'Source / Activity', 'Storage Unit', 'Litres Issued', 'Before Fill Litres', 'Usage Reading', 'Usage Metric', 'Usage Display',
    'Historical Storage Before', 'Historical Storage After', 'Fuel % Before', 'Fuel % After', 'Operator',
    'Activity', 'Work Area', 'GPS', 'Latitude', 'Longitude', 'Entry Added On (SAST)', 'Added By',
    'Evidence / Review Status', 'Evidence Type', 'Evidence Reference', 'Evidence File', 'Tank Balance Treatment',
    'Late-entry Reason', 'Notes', 'Record Source', 'Source Label', 'Fuel Slip ID', 'Supplier', 'Total incl. VAT',
    'Work Use Status', 'Work Use Exclusion Reason', 'Fuel Slip Document',
  ];
  const headerRow = 7;
  const recordSheetRows: XlsxCellValue[][] = [
    fullWidthRow(`${asset.title || 'Asset'} - Fuel Report`, 'title', recordHeaders.length),
    fullWidthRow(`Filtered report: ${dateRangeLabel}`, 'subtitle', recordHeaders.length),
    fullWidthRow('Use this sheet for day-to-day review. The Fuel Audit sheet retains every source, evidence and tank-balance field.', 'note', recordHeaders.length),
    [],
    [
      styled('Asset', 'metaLabel'), styled(asset.title || NOT_RECORDED, 'metaValue'),
      styled('Serial number', 'metaLabel'), styled(asset.serialNumber || NOT_RECORDED, 'metaValue'),
      styled('Plate / QR', 'metaLabel'), styled(asset.plateLabel || asset.publicAssetCode || NOT_RECORDED, 'metaValue'),
    ],
    [],
    recordHeaders.map((header) => styled(header, 'tableHeader')),
    ...fuelEvents.map((event) => {
      const eventAsset = reportAssetForEvent(event, asset);
      const issuedOn = fuelIssueDateTimeForExcel(event);
      const addedOn = event.isLateEntry || event.sourceType === 'fuel_slip' ? formatExcelDateTime(event.entryAddedAtIso) : null;
      const mapUrl = event.isLateEntry ? null : buildGoogleMapsUrl(event.latitude, event.longitude);
      const evidence = fuelEvidenceLabel(event);
      const notes = [event.isLateEntry ? event.lateEntryReason : '', event.note].map(normalizeSpaces).filter(Boolean).join(' · ');

      return [
        styled(reportAssetTitleForEvent(event, asset), 'text'),
        styled(issuedOn, issuedOn instanceof Date ? 'dateTime' : 'text'),
        styled(fuelLedgerActivityLabel(event), event.isLateEntry ? 'statusInfo' : 'text'),
        styled(excelRecordedText(fuelStorageLabel(event)), 'text'),
        styled(numberForExcel(event.fuelLitres), 'decimal'),
        styled(numberForExcel(calculateAssetDieselBeforeFill(event)), 'decimal'),
        styled(excelRecordedText(formatEventUsage(eventAsset, event)), 'text'),
        styled(excelRecordedText(formatOperatorLabel(event)), 'text'),
        styled(excelRecordedText(formatEventActivity(event)), 'text'),
        styled(excelRecordedText(formatEventWorkArea(event)), 'text'),
        styled(event.fuelSlipSupplierName || NOT_RECORDED, 'text'),
        styled(numberForExcel(event.fuelSlipTotalAmount), 'currency'),
        styled(fuelWorkUseLabel(event), event.workUseExcluded ? 'statusInfo' : 'statusGood'),
        linked(excelRecordedText(fuelGpsLabel(event)), mapUrl),
        styled(addedOn, 'dateTime'),
        styled(excelRecordedText(evidence), event.isLateEntry || event.sourceType === 'fuel_slip' ? 'statusInfo' : 'statusGood'),
        linked(event.fuelSlipDocumentFileUrl ? 'Open fuel slip' : NOT_RECORDED, event.fuelSlipDocumentFileUrl),
        styled(notes || NOT_RECORDED, 'note'),
      ];
    }),
  ];
  const auditSheetRows: XlsxCellValue[][] = [
    fullWidthRow(`${asset.title || 'Asset'} - Fuel Audit`, 'title', auditHeaders.length),
    fullWidthRow(`Filtered report: ${dateRangeLabel}`, 'subtitle', auditHeaders.length),
    fullWidthRow('Complete export for audit and reconciliation. Late entries keep their historical issue date separate from the actual date added; historical tank levels are never inferred from current stock.', 'note', auditHeaders.length),
    [],
    [
      styled('Asset', 'metaLabel'), styled(asset.title || NOT_RECORDED, 'metaValue'),
      styled('Serial number', 'metaLabel'), styled(asset.serialNumber || NOT_RECORDED, 'metaValue'),
      styled('Plate / QR', 'metaLabel'), styled(asset.plateLabel || asset.publicAssetCode || NOT_RECORDED, 'metaValue'),
    ],
    [],
    auditHeaders.map((header) => styled(header, 'tableHeader')),
    ...fuelEvents.map((event) => {
      const eventAsset = reportAssetForEvent(event, asset);
      const issuedOn = fuelIssueDateTimeForExcel(event);
      const mapUrl = event.isLateEntry ? null : buildGoogleMapsUrl(event.latitude, event.longitude);
      return [
        styled(reportAssetTitleForEvent(event, asset), 'text'),
        styled(issuedOn, issuedOn instanceof Date ? 'dateTime' : 'text'),
        styled(fuelLedgerActivityLabel(event), event.isLateEntry ? 'statusInfo' : 'text'),
        styled(excelRecordedText(fuelStorageLabel(event)), 'text'),
        styled(numberForExcel(event.fuelLitres), 'decimal'),
        styled(numberForExcel(calculateAssetDieselBeforeFill(event)), 'decimal'),
        styled(numberForExcel(event.assetUsageReading ?? event.hours), 'decimal'),
        styled(fuelUsageMetricLabel(eventAsset, event), 'text'),
        styled(excelRecordedText(formatEventUsage(eventAsset, event)), 'text'),
        styled(event.isLateEntry ? NOT_RECORDED : numberForExcel(event.fuelStorageLevelBefore), event.isLateEntry ? 'text' : 'decimal'),
        styled(event.isLateEntry ? NOT_RECORDED : numberForExcel(event.fuelStorageLevelAfter), event.isLateEntry ? 'text' : 'decimal'),
        styled(percentForExcel(event.assetFuelPercentBefore), 'percent'),
        styled(percentForExcel(event.assetFuelPercentAfter ?? event.fuelPercent), 'percent'),
        styled(excelRecordedText(formatOperatorLabel(event)), 'text'),
        styled(excelRecordedText(formatEventActivity(event)), 'text'),
        styled(excelRecordedText(formatEventWorkArea(event)), 'text'),
        linked(excelRecordedText(fuelGpsLabel(event)), mapUrl),
        styled(event.isLateEntry ? null : numberForExcel(event.latitude, 6), 'decimal'),
        styled(event.isLateEntry ? null : numberForExcel(event.longitude, 6), 'decimal'),
        styled(event.isLateEntry || event.sourceType === 'fuel_slip' ? formatExcelDateTime(event.entryAddedAtIso) : null, 'dateTime'),
        styled(excelRecordedText(fuelAddedByLabel(event)), 'text'),
        styled(excelRecordedText(fuelEvidenceLabel(event)), 'text'),
        styled(event.evidenceType || NOT_RECORDED, 'text'),
        styled(event.evidenceReference || NOT_RECORDED, 'text'),
        linked(event.evidenceFileName || NOT_RECORDED, event.evidenceFileUrl),
        styled(excelRecordedText(fuelBalanceTreatmentLabel(event)), 'text'),
        styled(event.isLateEntry ? event.lateEntryReason || NOT_RECORDED : 'Not applicable', 'note'),
        styled(normalizeSpaces(event.note) || NOT_RECORDED, 'note'),
        styled(event.sourceType || NOT_RECORDED, 'text'),
        styled(event.sourceLabel || NOT_RECORDED, 'text'),
        styled(event.fuelSlipId || NOT_RECORDED, 'text'),
        styled(event.fuelSlipSupplierName || NOT_RECORDED, 'text'),
        styled(numberForExcel(event.fuelSlipTotalAmount), 'currency'),
        styled(fuelWorkUseLabel(event), event.workUseExcluded ? 'statusInfo' : 'statusGood'),
        styled(event.workUseExclusionReason || NOT_RECORDED, 'note'),
        linked(event.fuelSlipDocumentFileUrl ? 'Open fuel slip' : NOT_RECORDED, event.fuelSlipDocumentFileUrl),
      ];
    }),
  ];

  return [
    buildReportSummaryWorkbookSheet({
      reportKind: 'fuel',
      asset,
      ownerDetails,
      generatedAt,
      dateRangeLabel,
      recordRows,
    }),
    {
      name: 'Fuel Records',
      rows: recordSheetRows,
      columns: [28, 22, 24, 24, 16, 18, 20, 22, 24, 24, 28, 18, 30, 34, 24, 36, 24, 42],
      merges: [
        { fromRow: 1, fromColumn: 1, toRow: 1, toColumn: recordHeaders.length },
        { fromRow: 2, fromColumn: 1, toRow: 2, toColumn: recordHeaders.length },
        { fromRow: 3, fromColumn: 1, toRow: 3, toColumn: recordHeaders.length },
      ],
      freezeRow: headerRow,
      autoFilter: {
        fromRow: headerRow,
        fromColumn: 1,
        toRow: Math.max(headerRow, headerRow + fuelEvents.length),
        toColumn: recordHeaders.length,
      },
      tabColor: '176B4F',
    },
    {
      name: 'Fuel Audit',
      rows: auditSheetRows,
      columns: [30, 22, 24, 24, 16, 18, 18, 16, 22, 23, 23, 14, 14, 22, 24, 24, 36, 14, 14, 22, 24, 36, 24, 26, 26, 36, 42, 42, 24, 24, 38, 28, 18, 30, 34, 36],
      merges: [
        { fromRow: 1, fromColumn: 1, toRow: 1, toColumn: auditHeaders.length },
        { fromRow: 2, fromColumn: 1, toRow: 2, toColumn: auditHeaders.length },
        { fromRow: 3, fromColumn: 1, toRow: 3, toColumn: auditHeaders.length },
      ],
      freezeRow: headerRow,
      autoFilter: {
        fromRow: headerRow,
        fromColumn: 1,
        toRow: Math.max(headerRow, headerRow + fuelEvents.length),
        toColumn: auditHeaders.length,
      },
      tabColor: '5D7F6B',
    },
  ];
}

function buildMaintenanceReportWorkbook(
  asset: AssetRegisterItem,
  events: ScanEventRecord[],
  ownerDetails: OwnerReportDetails,
  generatedAt: string,
  dateRangeLabel = 'All available entries',
  maintenanceReportType: MaintenanceReportType = 'all',
): XlsxSheet[] {
  const allMaintenanceEntries = events.map((event) => parseMaintenanceEvent(event)).filter((entry): entry is MaintenanceEntry => Boolean(entry));
  const maintenanceEntries = maintenanceReportType === 'all'
    ? allMaintenanceEntries
    : allMaintenanceEntries.filter((entry) => entry.kind === maintenanceReportType);
  const maintenanceTypeLabel = MAINTENANCE_TYPE_LABELS[maintenanceReportType];
  const recordRows = buildMaintenanceRecordRows(asset, maintenanceEntries, dateRangeLabel, maintenanceTypeLabel);
  const isCheckedOnlyReport = maintenanceReportType === 'checked';
  const meterHeading = getUsageUnit(asset) === 'km' ? 'Kilometre reading' : 'Hour meter';
  const headers = isCheckedOnlyReport
    ? [
        'Recorded on (SAST)',
        'Record type',
        'Checked items',
        meterHeading,
        'Captured by',
        'Recorded location',
        'Photo evidence',
        'Notes / problems',
      ]
    : [
        'Recorded on (SAST)',
        'Record type',
        'Work / items',
        'Service provider',
        'Technician',
        meterHeading,
        'Captured by',
        'Recorded location',
        'Photo evidence',
        'Notes / problems',
      ];
  const columns = isCheckedOnlyReport
    ? [22, 16, 38, 20, 22, 34, 22, 42]
    : [22, 16, 38, 24, 24, 20, 22, 34, 22, 42];
  const headerRow = 7;
  const maintenanceRecordRows = maintenanceEntries.map((entry) => {
    const recordStyle: XlsxCellStyle = entry.kind === 'repaired' ? 'statusWarn' : entry.kind === 'serviced' ? 'statusGood' : 'statusInfo';
    const mapUrl = buildGoogleMapsUrl(entry.event.latitude, entry.event.longitude);
    const photoCount = entry.event.photoUrls.length;
    const photoLabel = photoCount ? `Open ${photoCount === 1 ? '1 photo' : `first of ${photoCount} photos`}` : 'No photos';
    const photoUrl = entry.event.photoUrls[0] ?? null;
    const commonStart = [
      styled(formatExcelDateTime(entry.event.createdAtIso), 'dateTime'),
      styled(entry.label, recordStyle),
      styled(entry.items.join(', ') || NOT_RECORDED, 'text'),
    ];
    const commonEnd = [
      styled(excelRecordedText(formatMaintenanceEventUsage(asset, entry.event)), 'text'),
      styled(excelRecordedText(formatOperatorLabel(entry.event)), 'text'),
      linked(excelRecordedText(formatLocationText(entry.event.locationText, entry.event.latitude, entry.event.longitude)), mapUrl),
      linked(photoLabel, photoUrl),
      styled(entry.notes || 'No problems or notes recorded', 'note'),
    ];

    if (isCheckedOnlyReport) {
      return [...commonStart, ...commonEnd];
    }

    return [
      ...commonStart,
      styled(entry.kind === 'checked' ? 'Not applicable' : entry.company || NOT_RECORDED, 'text'),
      styled(entry.kind === 'checked' ? 'Not applicable' : entry.mechanic || NOT_RECORDED, 'text'),
      ...commonEnd,
    ];
  });
  const recordSheetRows: XlsxCellValue[][] = [
    fullWidthRow(`${asset.title || 'Asset'} - Maintenance Report`, 'title', headers.length),
    fullWidthRow(`Filtered report: ${dateRangeLabel} • Type: ${maintenanceTypeLabel}`, 'subtitle', headers.length),
    fullWidthRow('Newest first. Dates are South African time; blue underlined locations and photo evidence are clickable.', 'note', headers.length),
    [],
    [
      styled('Asset', 'metaLabel'),
      styled(asset.title || '', 'metaValue'),
      styled('Serial number', 'metaLabel'),
      styled(asset.serialNumber || '', 'metaValue'),
      styled('Plate / QR', 'metaLabel'),
      styled(asset.plateLabel || asset.publicAssetCode || '', 'metaValue'),
    ],
    [],
    headers.map((header) => styled(header, 'tableHeader')),
    ...maintenanceRecordRows,
  ];

  return [
    buildReportSummaryWorkbookSheet({
      reportKind: 'maintenance',
      asset,
      ownerDetails,
      generatedAt,
      dateRangeLabel,
      recordRows,
    }),
    {
      name: 'Maintenance Records',
      rows: recordSheetRows,
      columns,
      merges: [
        { fromRow: 1, fromColumn: 1, toRow: 1, toColumn: headers.length },
        { fromRow: 2, fromColumn: 1, toRow: 2, toColumn: headers.length },
        { fromRow: 3, fromColumn: 1, toRow: 3, toColumn: headers.length },
      ],
      freezeRow: headerRow,
      autoFilter: {
        fromRow: headerRow,
        fromColumn: 1,
        toRow: Math.max(headerRow, headerRow + maintenanceEntries.length),
        toColumn: headers.length,
      },
      tabColor: '10382F',
    },
  ];
}

function buildDepreciationReportWorkbook(
  asset: AssetRegisterItem,
  entries: AssetDepreciationLogEntry[],
  annualSummaries: DepreciationAnnualSummary[],
  summary: DepreciationLogSummary,
  ownerDetails: OwnerReportDetails,
  generatedAt: string,
  dateRangeLabel = 'All available entries',
): XlsxSheet[] {
  const recordRows = buildDepreciationRecordRows(asset, entries, summary, dateRangeLabel);
  const logHeaders = [
    'Updated',
    'Event/update source',
    'Asset title',
    'Brand',
    'Model',
    'Year model',
    'Previous value excl. VAT',
    'New value excl. VAT',
    'Difference excl. VAT',
    'Difference %',
    'Usage amount',
    'Usage metric',
    'Condition',
    'Replacement price excl. VAT',
    'Selected method',
    'Valuation run id',
    'Notes / reason',
  ];
  const logHeaderRow = 7;
  const logRows: XlsxCellValue[][] = [
    fullWidthRow(`${asset.title || 'Asset'} - Depreciation Log`, 'title', logHeaders.length),
    fullWidthRow(`Filtered report: ${dateRangeLabel}`, 'subtitle', logHeaders.length),
    fullWidthRow('Saved value-change log entries exported from the Aim4price Asset Register.', 'note', logHeaders.length),
    [],
    [
      styled('Asset', 'metaLabel'),
      styled(asset.title || '', 'metaValue'),
      styled('Serial number', 'metaLabel'),
      styled(asset.serialNumber || '', 'metaValue'),
      styled('Plate / QR', 'metaLabel'),
      styled(asset.plateLabel || asset.publicAssetCode || '', 'metaValue'),
    ],
    [],
    logHeaders.map((header) => styled(header, 'tableHeader')),
    ...entries.map((entry) => [
      styled(formatExcelDateTime(entry.capturedAtIso), 'dateTime'),
      styled(formatDepreciationLogSource(entry), 'text'),
      styled(entry.assetTitle, 'text'),
      styled(entry.brandName, 'text'),
      styled(entry.modelName, 'text'),
      styled(numberForExcel(entry.yearModel, 0), 'year'),
      styled(numberForExcel(entry.previousValueExVat), 'currency'),
      styled(numberForExcel(entry.newValueExVat), 'currency'),
      styled(numberForExcel(entry.differenceValueExVat), 'currency'),
      styled(movementPercentForExcel(entry.differencePercent), 'percent'),
      styled(numberForExcel(entry.usageAmount), 'decimal'),
      styled(entry.usageMetric, 'text'),
      styled(formatCondition(entry.condition), 'text'),
      styled(numberForExcel(entry.replacementPriceExVat), 'currency'),
      styled(entry.selectedMethod, 'text'),
      styled(numberForExcel(entry.valuationRunId, 0), 'integer'),
      styled(formatDepreciationLogReason(entry), 'text'),
    ]),
  ];

  const annualHeaders = [
    'Year',
    'Opening value',
    'Closing value',
    'Yearly difference',
    'Yearly difference %',
    'Entries',
    'Latest usage / condition',
  ];
  const annualHeaderRow = 7;
  const annualRows: XlsxCellValue[][] = [
    fullWidthRow(`${asset.title || 'Asset'} - Annual Summary`, 'title', annualHeaders.length),
    fullWidthRow(`Filtered report: ${dateRangeLabel}`, 'subtitle', annualHeaders.length),
    fullWidthRow('Year-by-year movement calculated from saved depreciation log entries only.', 'note', annualHeaders.length),
    [],
    [
      styled('Asset', 'metaLabel'),
      styled(asset.title || '', 'metaValue'),
      styled('Latest saved value', 'metaLabel'),
      styled(numberForExcel(summary.currentValueExVat), 'currency'),
      styled('Difference %', 'metaLabel'),
      styled(movementPercentForExcel(summary.totalMovementPercent), 'percent'),
    ],
    [],
    annualHeaders.map((header) => styled(header, 'tableHeader')),
    ...annualSummaries.map((item) => {
      const usageCondition = [
        formatDepreciationUsage(item.latestUsageAmount, item.latestUsageMetric),
        formatCondition(item.latestCondition),
      ].filter((value) => value && value !== '-').join(' / ');

      return [
        styled(item.year, 'year'),
        styled(numberForExcel(item.openingValueExVat), 'currency'),
        styled(numberForExcel(item.closingValueExVat), 'currency'),
        styled(numberForExcel(item.yearlyDifferenceExVat), 'currency'),
        styled(movementPercentForExcel(item.yearlyMovementPercent), 'percent'),
        styled(item.logEntryCount, 'integer'),
        styled(usageCondition, 'text'),
      ];
    }),
  ];

  return [
    buildReportSummaryWorkbookSheet({
      reportKind: 'depreciation',
      asset,
      ownerDetails,
      generatedAt,
      dateRangeLabel,
      recordRows,
    }),
    {
      name: 'Log',
      rows: logRows,
      columns: [20, 34, 30, 18, 22, 14, 22, 22, 22, 16, 16, 14, 18, 24, 18, 16, 42],
      merges: [
        { fromRow: 1, fromColumn: 1, toRow: 1, toColumn: logHeaders.length },
        { fromRow: 2, fromColumn: 1, toRow: 2, toColumn: logHeaders.length },
        { fromRow: 3, fromColumn: 1, toRow: 3, toColumn: logHeaders.length },
      ],
      freezeRow: logHeaderRow,
      autoFilter: {
        fromRow: logHeaderRow,
        fromColumn: 1,
        toRow: Math.max(logHeaderRow, logHeaderRow + entries.length),
        toColumn: logHeaders.length,
      },
      tabColor: '10382F',
    },
    {
      name: 'Annual Summary',
      rows: annualRows,
      columns: [14, 22, 22, 24, 20, 14, 34],
      merges: [
        { fromRow: 1, fromColumn: 1, toRow: 1, toColumn: annualHeaders.length },
        { fromRow: 2, fromColumn: 1, toRow: 2, toColumn: annualHeaders.length },
        { fromRow: 3, fromColumn: 1, toRow: 3, toColumn: annualHeaders.length },
      ],
      freezeRow: annualHeaderRow,
      autoFilter: {
        fromRow: annualHeaderRow,
        fromColumn: 1,
        toRow: Math.max(annualHeaderRow, annualHeaderRow + annualSummaries.length),
        toColumn: annualHeaders.length,
      },
      tabColor: '176B4F',
    },
  ];
}

async function buildReportDocumentResponse(
  html: string,
  request: NextRequest,
  baseFileName: string,
  format: Extract<ReportFormat, 'pdf' | 'html'>,
): Promise<NextResponse> {
  if (format === 'html') {
    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'private, no-store',
        'Content-Disposition': `inline; filename="${baseFileName}.html"`,
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }

  const pdf = await renderReportHtmlToPdf(html, {
    baseUrl: request.url,
    cookie: request.headers.get('cookie') ?? '',
  });

  return new NextResponse(pdf, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Length': String(pdf.length),
      'Cache-Control': 'private, no-store',
      'Content-Disposition': `inline; filename="${baseFileName}.pdf"`,
      'X-Content-Type-Options': 'nosniff',
    },
  });
}


export async function GET(request: NextRequest) {
  const session = await getServerSession({ allowOwnerApp: true, allowDealerApp: true });

  if (!session?.user?.id) {
    return NextResponse.redirect(new URL('/auth', request.url), { status: 302 });
  }

  const assetId = asText(request.nextUrl.searchParams.get('assetId'));
  const groupId = asText(request.nextUrl.searchParams.get('groupId'));
  const dealerAccessId = asText(request.nextUrl.searchParams.get('accessId'));
  const reportKind = normalizeReportKind(
    request.nextUrl.searchParams.get('report') ?? request.nextUrl.searchParams.get('reportType') ?? request.nextUrl.searchParams.get('type'),
  );
  const maintenanceReportType = normalizeMaintenanceReportType(
    request.nextUrl.searchParams.get('maintenanceType') ??
      request.nextUrl.searchParams.get('maintenanceKind') ??
      (reportKind === 'maintenance' ? request.nextUrl.searchParams.get('type') : null),
  );
  const reportFormat = parseReportFormat(request.nextUrl.searchParams.get('format'));
  const reportYear = parseReportYear(asText(request.nextUrl.searchParams.get('year')));
  const reportMonth = reportYear ? parseReportMonth(asText(request.nextUrl.searchParams.get('month'))) : null;
  const reportDateRange = buildReportDateRange(reportYear, reportMonth);
  const ownerAppAccess = await getOwnerAppAccess();

  if (
    ownerAppAccess?.sessionKind === 'owner-app-user'
    && (!assetId || Boolean(groupId) || !ownerAppCanAccessAsset(ownerAppAccess, assetId))
  ) {
    return NextResponse.json(
      { ok: false, error: 'The requested asset report could not be found.' },
      { status: 404 },
    );
  }

  if (!assetId && !groupId) {
    return NextResponse.json({ ok: false, error: 'Asset or umbrella ID is required.' }, { status: 400 });
  }

  if (assetId && groupId) {
    return NextResponse.json({ ok: false, error: 'Choose either an asset or an umbrella report.' }, { status: 400 });
  }

  if (!reportKind) {
    return NextResponse.json({ ok: false, error: 'Report type must be fuel, maintenance or depreciation.' }, { status: 400 });
  }

  let ownerUserId = session.user.id;
  let isDealerMaintenanceReport = false;

  if (dealerAccessId) {
    if (groupId || reportKind !== 'maintenance' || !UUID_PATTERN.test(dealerAccessId)) {
      return NextResponse.json({ ok: false, error: 'Dealer tracking access only supports maintenance reports for one asset.' }, { status: 403 });
    }

    const trackedAsset = await getDealerTrackedAsset(session.user.id, dealerAccessId);
    if (
      !trackedAsset
      || trackedAsset.assetId !== assetId
      || !trackedAsset.permissions.canViewMaintenanceReports
    ) {
      return NextResponse.json({ ok: false, error: 'Maintenance report access is no longer active for this asset.' }, { status: 403 });
    }

    ownerUserId = trackedAsset.ownerUserId;
    isDealerMaintenanceReport = true;
  }

  let groupName = '';
  let reportAssets: AssetRegisterItem[] = [];

  if (groupId) {
    const group = await getAssetGroupById(ownerUserId, groupId);
    if (!group) {
      return NextResponse.json({ ok: false, error: 'Umbrella not found.' }, { status: 404 });
    }

    groupName = group.name;
    const resolvedAssets = await Promise.all(
      group.members.map((member) => getAssetRegisterItemById(ownerUserId, member.assetId)),
    );
    reportAssets = resolvedAssets.filter((entry): entry is AssetRegisterItem => Boolean(entry));

    if (isPropertyBlockedReportKind(reportKind)) {
      reportAssets = reportAssets.filter((entry) => !isPropertyLikeAsset(entry));
    }

    if (!reportAssets.length) {
      return NextResponse.json(
        { ok: false, error: isPropertyBlockedReportKind(reportKind)
          ? 'This umbrella has no assets eligible for fuel or depreciation reports.'
          : 'This umbrella has no available assets.' },
        { status: 400 },
      );
    }
  } else {
    const singleAsset = await getAssetRegisterItemById(ownerUserId, assetId);
    if (!singleAsset) {
      return NextResponse.json({ ok: false, error: 'Asset not found.' }, { status: 404 });
    }

    if (isPropertyLikeAsset(singleAsset) && isPropertyBlockedReportKind(reportKind)) {
      return NextResponse.json(
        { ok: false, error: 'Fuel and depreciation reports are not available for property, land or building assets.' },
        { status: 400 },
      );
    }

    reportAssets = [singleAsset];
  }

  const primaryAsset = reportAssets[0];
  const combinedValue = reportAssets.reduce(
    (sum, entry) => sum + Math.round(Number(entry.selectedValueExVat ?? entry.value) || 0),
    0,
  );
  const combinedReplacementValue = reportAssets.reduce(
    (sum, entry) => sum + Math.round(Number(entry.replacementPriceExVat) || 0),
    0,
  );
  // An umbrella is a reporting scope, not a substitute for its designated primary asset.
  // Start from a real item only to satisfy the complete record shape, then neutralise every
  // asset-specific display field so no primary-asset metadata can leak into the report.
  const asset: AssetRegisterItem = groupId
    ? {
        ...primaryAsset,
        id: groupId,
        registerId: null,
        valuationRunId: null,
        sectorId: null,
        equipmentFamilyId: null,
        equipmentFamilyKey: '',
        equipmentFamilyLabel: '',
        equipmentModelId: null,
        typedModelName: '',
        normalizedTypedModelName: '',
        specsJson: {},
        depreciationMethodUsed: '',
        lifeWorkedPercent: null,
        lifeRemainingPercent: null,
        estimatedHours: null,
        maxLifetimeHours: null,
        kind: 'manual',
        title: groupName,
        value: combinedValue,
        selectedMethod: 'manual',
        selectedValueExVat: combinedValue,
        replacementPriceExVat: combinedReplacementValue || null,
        brandName: 'Asset umbrella',
        modelName: `${reportAssets.length} linked assets`,
        drive: '',
        tractorType: '',
        cab: '',
        powerKw: null,
        yearModel: null,
        hours: null,
        condition: '',
        aim4priceValueExVat: null,
        marketMidExVat: null,
        note: '',
        serialNumber: '',
        isFinanced: false,
        isInsured: false,
        insuredValueExVat: null,
        isLicensed: false,
        licenseRegistrationNumber: '',
        financeNote: '',
        sellerPhone: '',
        marketplaceNotes: '',
        marketplaceStatus: '',
        marketplacePriceExVat: null,
        marketplaceSellerName: '',
        marketplaceSellerCompany: '',
        marketplaceSellerEmail: '',
        marketplaceProvince: '',
        marketplaceArea: '',
        photos: [],
        documents: [],
        plateLabel: '',
        publicAssetCode: '',
        qrStatus: '',
        lastScannedAtIso: null,
        lastKnownLat: null,
        lastKnownLng: null,
        lastKnownLocationText: '',
        fuelPercent: null,
      }
    : primaryAsset;

  const ownerProfile = await getAccountProfile({
    id: ownerUserId,
    name: isDealerMaintenanceReport ? undefined : session.user.name,
    email: isDealerMaintenanceReport ? undefined : session.user.email,
  });
  const ownerDetails = buildOwnerReportDetails(
    ownerProfile,
    isDealerMaintenanceReport
      ? { name: ownerProfile.businessName || ownerProfile.displayName || ownerProfile.name, email: ownerProfile.email }
      : session.user,
    asset,
  );
  const generatedAt = formatDate(new Date().toISOString());
  const rawLogoUrl = groupId
    ? String(ownerProfile.logoUrl ?? '').trim() || await getAssetRegisterReportLogoUrl(ownerUserId).catch(() => '')
    : await getAssetRegisterReportLogoUrl(ownerUserId, asset.registerId).catch(() => '');
  const logoUrl = await resolveReportLogoUrlForHtml(rawLogoUrl, request.url);
  const scopeLabel = groupId ? 'Umbrella' : asset.plateLabel || asset.publicAssetCode || asset.id;
  const baseFileName = `${slugifyFileSegment(asset.title)}-${slugifyFileSegment(scopeLabel)}-${slugifyFileSegment(REPORT_LABELS[reportKind])}`;

  if (reportKind === 'depreciation') {
    const logEntries = (
      await Promise.all(
        reportAssets.map((entry) => listAssetDepreciationLogEntriesForAsset({
          userId: ownerUserId,
          assetId: entry.id,
          fromIso: reportDateRange.fromIso,
          toIso: reportDateRange.toIso,
        })),
      )
    ).flat().sort((left, right) => String(right.capturedAtIso).localeCompare(String(left.capturedAtIso)));
    const logSummary = buildDepreciationLogSummary(logEntries, asset);
    const annualSummary = buildDepreciationAnnualSummary(logEntries);

    if (reportFormat === 'xlsx') {
      const workbook = createXlsxWorkbook(
        buildDepreciationReportWorkbook(asset, logEntries, annualSummary, logSummary, ownerDetails, generatedAt, reportDateRange.label),
      );

      return new NextResponse(workbook, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${baseFileName}.xlsx"`,
          'Content-Length': String(workbook.length),
          'Cache-Control': 'private, no-store',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    }

    const html = buildDepreciationReport(asset, logEntries, ownerDetails, generatedAt, logoUrl, reportDateRange.label, reportAssets);

    return buildReportDocumentResponse(html, request, baseFileName, reportFormat);
  }

  const eventGroups = await Promise.all(
    reportAssets.map(async (entry) => {
      const sourceEvents = await listScanEventsForAsset(entry.id, null, {
        fromIso: reportDateRange.fromIso,
        toIso: reportDateRange.toIso,
        onlyFuel: reportKind === 'fuel',
      });

      if (!groupId) return sourceEvents;

      return sourceEvents.map((event): ScopedScanEventRecord => ({
        ...event,
        reportAsset: entry,
      }));
    }),
  );
  const events = eventGroups
    .flat()
    .sort((left, right) => String(
      reportKind === 'fuel' ? fuelEventTimestamp(right) : right.createdAtIso,
    ).localeCompare(String(
      reportKind === 'fuel' ? fuelEventTimestamp(left) : left.createdAtIso,
    )));

  if (reportFormat === 'xlsx') {
    const workbook = createXlsxWorkbook(
      reportKind === 'fuel'
        ? buildFuelReportWorkbook(asset, events, ownerDetails, generatedAt, reportDateRange.label)
        : buildMaintenanceReportWorkbook(asset, events, ownerDetails, generatedAt, reportDateRange.label, maintenanceReportType),
    );

    return new NextResponse(workbook, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${baseFileName}.xlsx"`,
        'Content-Length': String(workbook.length),
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }

  const html = reportKind === 'fuel'
    ? buildFuelReport(asset, events, ownerDetails, generatedAt, logoUrl, reportDateRange.label, reportAssets)
    : buildMaintenanceReport(asset, events, ownerDetails, generatedAt, logoUrl, reportDateRange.label, maintenanceReportType);

  return buildReportDocumentResponse(html, request, baseFileName, reportFormat);
}
