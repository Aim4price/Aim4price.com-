import { NextResponse } from 'next/server';
import { getServerSession } from '../../../../lib/auth-session';
import { listAssetRegisterItems, type AssetRegisterItem } from '../../../../lib/asset-register-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type AssetStatusChoice = 'yes' | 'no' | 'unknown' | 'not_applicable';

type PrintableAsset = {
  number: number;
  title: string;
  plateLabel: string;
  publicAssetCode: string;
  serialNumber: string;
  assetTypeLabel: string;
  yearModel: string;
  replacementValue: string;
  fuel: string;
  financed: string;
  insured: string;
  licensed: string;
  licenseRegistrationNumber: string;
  usage: string;
  condition: string;
  lastScanned: string;
  locationText: string;
  latitude: number;
  longitude: number;
  latLngText: string;
};

function unauthorized() {
  return NextResponse.json({ ok: false, error: 'You must be signed in.' }, { status: 401 });
}

function asText(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeScriptJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}

function formatDate(value = new Date()): string {
  return new Intl.DateTimeFormat('en-ZA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(value);
}

function formatTime(value = new Date()): string {
  return new Intl.DateTimeFormat('en-ZA', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(value);
}

function formatDateTime(value?: string | null): string {
  if (!value) return 'Not scanned';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Not scanned';

  return new Intl.DateTimeFormat('en-ZA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
}

function formatFileDate(value = new Date()): string {
  return value.toISOString().slice(0, 10);
}

function formatFileSegment(value: string): string {
  return (
    asText(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 70) || 'asset'
  );
}

function buildReportFilename(assets: PrintableAsset[], generatedAt = new Date()): string {
  const dateSegment = formatFileDate(generatedAt);

  if (assets.length === 1) {
    const asset = assets[0];
    const assetSegment = formatFileSegment(`${asset.title}-${asset.publicAssetCode}`);
    return `aim4price-asset-map-${assetSegment}-${dateSegment}.html`;
  }

  return `aim4price-asset-map-${dateSegment}.html`;
}

function formatCondition(value: string): string {
  const normalized = asText(value).toLowerCase();

  return (
    {
      excellent: 'Excellent',
      good: 'Good',
      fair: 'Fair',
      used: 'Used',
      serious: 'Requires attention',
    }[normalized] ?? (asText(value) || 'Not saved')
  );
}

function formatFuel(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return 'Not saved';
  return `${Math.max(0, Math.min(100, Math.round(value)))}%`;
}

function formatNumber(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '';
  return new Intl.NumberFormat('en-ZA').format(Math.round(value));
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

function formatMoney(value: number | null): string {
  if (value === null || !Number.isFinite(value) || value <= 0) return 'Not saved';
  return `R ${formatNumber(value)}`;
}

function titleCase(value: string): string {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
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
  const direct = asText(asset.licenseRegistrationNumber).toUpperCase();
  if (direct) return direct;

  const specs = isPlainRecord(asset.specsJson) ? asset.specsJson : {};

  return asText(
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

function formatAssetStatusChoice(value: AssetStatusChoice): string {
  if (value === 'yes') return 'Yes';
  if (value === 'no') return 'No';
  if (value === 'not_applicable') return 'Not applicable';
  return 'Not sure';
}

function getUsageUnit(asset: AssetRegisterItem): 'hours' | 'km' {
  const specs = isPlainRecord(asset.specsJson) ? asset.specsJson : {};
  const rawUsage = String(
    specs.usageMetric ?? specs.usage_metric ?? specs.usageUnit ?? specs.usage_unit ?? specs.usageMetricType ?? specs.usage_metric_type ?? '',
  )
    .trim()
    .toLowerCase();

  if (asset.kind === 'vehicle') return 'km';
  if (rawUsage === 'km' || rawUsage === 'kms' || rawUsage === 'kilometres' || rawUsage === 'kilometers') return 'km';
  return 'hours';
}

function formatUsage(asset: AssetRegisterItem): string {
  if (typeof asset.hours === 'number' && Number.isFinite(asset.hours)) {
    return `${formatNumber(asset.hours)} ${getUsageUnit(asset)}`;
  }

  if (typeof asset.lifeWorkedPercent === 'number' && Number.isFinite(asset.lifeWorkedPercent)) {
    const percent = Math.max(0, Math.min(100, Math.round(asset.lifeWorkedPercent * 10) / 10));
    return `${Number.isInteger(percent) ? percent : percent.toFixed(1)}% worked`;
  }

  return 'Not saved';
}

function assetTypeLabel(asset: AssetRegisterItem): string {
  const family = asText(asset.equipmentFamilyLabel);
  if (family) return family;

  const kind = asText(asset.kind);
  if (kind) return titleCase(kind);

  return 'Asset';
}

function formatYearModel(value: number | null): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'Not saved';
  return String(Math.round(value));
}

function hasCoordinates(asset: AssetRegisterItem): boolean {
  const { lastKnownLat: lat, lastKnownLng: lng } = asset;
  if (lat === null || lng === null) return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return false;
  if (lat === 0 && lng === 0) return false;
  return true;
}

function sortByScanDate(left: AssetRegisterItem, right: AssetRegisterItem): number {
  const leftTime = left.lastScannedAtIso ? new Date(left.lastScannedAtIso).getTime() : 0;
  const rightTime = right.lastScannedAtIso ? new Date(right.lastScannedAtIso).getTime() : 0;

  if (rightTime !== leftTime) {
    return rightTime - leftTime;
  }

  return left.title.localeCompare(right.title, 'en', { sensitivity: 'base' });
}

function toPrintableAsset(asset: AssetRegisterItem, index: number): PrintableAsset {
  const latitude = typeof asset.lastKnownLat === 'number' ? asset.lastKnownLat : Number(asset.lastKnownLat);
  const longitude = typeof asset.lastKnownLng === 'number' ? asset.lastKnownLng : Number(asset.lastKnownLng);

  return {
    number: index + 1,
    title: asset.title || 'Saved asset',
    plateLabel: asset.plateLabel || asset.publicAssetCode || 'No plate label',
    publicAssetCode: asset.publicAssetCode,
    serialNumber: asset.serialNumber || 'Not saved',
    assetTypeLabel: assetTypeLabel(asset),
    yearModel: formatYearModel(asset.yearModel),
    replacementValue: formatMoney(readAssetReplacementPriceExVat(asset)),
    fuel: formatFuel(asset.fuelPercent),
    financed: formatAssetStatusChoice(readFinanceStatusChoice(asset)),
    insured: formatAssetStatusChoice(readInsuranceStatusChoice(asset)),
    licensed: formatAssetStatusChoice(readLicenseStatusChoice(asset)),
    licenseRegistrationNumber: readLicenseStatusChoice(asset) === 'yes' ? readLicenseRegistrationNumber(asset) : '',
    usage: formatUsage(asset),
    condition: formatCondition(asset.condition),
    lastScanned: formatDateTime(asset.lastScannedAtIso),
    locationText: asset.lastKnownLocationText || 'No written location note saved',
    latitude,
    longitude,
    latLngText: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
  };
}

type AssetReportSelection = {
  codes: string[];
  ids: string[];
};

function normalizeLookupKey(value: string): string {
  return asText(value).toLowerCase();
}

function appendUnique(target: string[], value: string | null): void {
  const normalized = asText(value);
  if (!normalized) return;

  if (!target.some((existing) => normalizeLookupKey(existing) === normalizeLookupKey(normalized))) {
    target.push(normalized);
  }
}

function splitListParam(value: string | null): string[] {
  return asText(value)
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function readAssetReportSelection(url: URL): AssetReportSelection {
  const codes: string[] = [];
  const ids: string[] = [];

  splitListParam(url.searchParams.get('codes')).forEach((code) => appendUnique(codes, code));
  appendUnique(codes, url.searchParams.get('assetCode'));
  appendUnique(codes, url.searchParams.get('publicAssetCode'));
  appendUnique(codes, url.searchParams.get('code'));

  splitListParam(url.searchParams.get('ids')).forEach((id) => appendUnique(ids, id));
  appendUnique(ids, url.searchParams.get('assetId'));
  appendUnique(ids, url.searchParams.get('id'));

  return { codes, ids };
}

function filterAssetsBySelection(assets: AssetRegisterItem[], selection: AssetReportSelection): AssetRegisterItem[] {
  const sortedAssets = [...assets].sort(sortByScanDate);

  if (!selection.codes.length && !selection.ids.length) {
    return sortedAssets;
  }

  const byCode = new Map(sortedAssets.map((asset) => [normalizeLookupKey(asset.publicAssetCode), asset]));
  const byId = new Map(sortedAssets.map((asset) => [normalizeLookupKey(asset.id), asset]));
  const selected: AssetRegisterItem[] = [];
  const seenIds = new Set<string>();

  const addAsset = (asset: AssetRegisterItem | undefined) => {
    if (!asset || seenIds.has(asset.id)) return;
    selected.push(asset);
    seenIds.add(asset.id);
  };

  selection.codes.forEach((code) => addAsset(byCode.get(normalizeLookupKey(code))));
  selection.ids.forEach((id) => addAsset(byId.get(normalizeLookupKey(id))));

  return selected;
}

function renderKeyRows(assets: PrintableAsset[]): string {
  if (!assets.length) {
    return `
      <div class="assetMapReportEmpty">
        <strong>No mapped assets in this report.</strong>
        <span>Go back to the asset map and choose at least one scanned asset with saved GPS coordinates.</span>
      </div>
    `;
  }

  return assets
    .map(
      (asset) => `
        <article class="assetMapReportKeyRow">
          <div class="assetMapReportMarkerNumber">${asset.number}</div>
          <div class="assetMapReportAssetCell">
            <strong>${escapeHtml(asset.title)}</strong>
            <span>${escapeHtml(asset.plateLabel)} · ${escapeHtml(asset.assetTypeLabel)}</span>
          </div>
          <div class="assetMapReportCell">
            <span>Year model</span>
            <strong>${escapeHtml(asset.yearModel)}</strong>
          </div>
          <div class="assetMapReportCell">
            <span>Replacement</span>
            <strong>${escapeHtml(asset.replacementValue)}</strong>
          </div>
          <div class="assetMapReportCell">
            <span>Serial</span>
            <strong>${escapeHtml(asset.serialNumber)}</strong>
          </div>
          <div class="assetMapReportCell">
            <span>Fuel</span>
            <strong>${escapeHtml(asset.fuel)}</strong>
          </div>
          <div class="assetMapReportCell">
            <span>Licensed</span>
            <strong>${escapeHtml(asset.licensed)}</strong>
            ${asset.licenseRegistrationNumber ? `<small>Reg: ${escapeHtml(asset.licenseRegistrationNumber)}</small>` : ''}
          </div>
          <div class="assetMapReportCell assetMapReportGpsCell">
            <span>GPS</span>
            <strong>${escapeHtml(asset.latLngText)}</strong>
          </div>
          <div class="assetMapReportCell">
            <span>Last scanned</span>
            <strong>${escapeHtml(asset.lastScanned)}</strong>
          </div>
        </article>
      `,
    )
    .join('');
}

function renderSelectedAssetRows(asset: PrintableAsset): string {
  const rows: Array<[string, string]> = [
    ['Asset type', asset.assetTypeLabel],
    ['Plate label', asset.plateLabel],
    ['Serial number', asset.serialNumber],
    ['Year model', asset.yearModel],
    ['Replacement price', asset.replacementValue],
    ['Usage', asset.usage],
    ['Fuel', asset.fuel],
    ['Condition', asset.condition],
    ['Financed', asset.financed],
    ['Insured', asset.insured],
    ['Licensed', asset.licensed],
    ...(asset.licenseRegistrationNumber ? [['Registration', asset.licenseRegistrationNumber] as [string, string]] : []),
    ['GPS location', asset.latLngText],
    ['Last scanned', asset.lastScanned],
  ];

  return rows
    .map(
      ([label, value]) => `
        <div class="assetMapReportDetailRow">
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(value)}</strong>
        </div>
      `,
    )
    .join('');
}

function buildReportHtml(assets: PrintableAsset[], generatedDate: string, generatedTime: string, ownerEmail: string): string {
  const singleAsset = assets.length === 1 ? assets[0] : null;
  const documentTitle = 'Asset Map Report';
  const heroTitle = singleAsset ? singleAsset.title : 'Fleet Location Map';
  const heroBadge = singleAsset ? singleAsset.assetTypeLabel : 'Mapped Assets';
  const heroMeta = singleAsset
    ? `${singleAsset.plateLabel} · Year model ${singleAsset.yearModel} · GPS ${singleAsset.latLngText}`
    : `${assets.length} mapped assets shown and numbered. Markers match the location key below.`;
  const mapData = safeScriptJson(assets);
  const rowsHtml = renderKeyRows(assets);
  const selectedAssetRows = singleAsset ? renderSelectedAssetRows(singleAsset) : '';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(singleAsset ? `${singleAsset.title} - Aim4price asset map` : 'Aim4price Asset Map Report')}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
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
        --brand: #103f35;
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
        font-size: 9.6px;
        line-height: 1.35;
      }

      .assetMapReportScreenBar {
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

      .assetMapReportScreenText {
        color: var(--muted);
        font-size: 13px;
      }

      .assetMapReportScreenActions {
        display: flex;
        gap: 10px;
      }

      .assetMapReportButton {
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

      .assetMapReportButtonPrimary {
        border-color: var(--strong);
        background: var(--strong);
        color: #ffffff;
      }

      .assetMapReportPage {
        width: min(100%, 297mm);
        min-height: 210mm;
        margin: 18px auto;
        padding: 9mm 10mm 8mm;
        background: var(--paper);
        box-shadow: 0 16px 44px rgba(17, 24, 39, 0.13);
      }

      .assetMapReportInner {
        display: grid;
        min-height: calc(210mm - 17mm);
        gap: 8px;
      }

      .assetMapReportHeader {
        display: grid;
        grid-template-columns: 22mm minmax(0, 1fr) 74mm;
        gap: 12px;
        align-items: center;
        padding-bottom: 9px;
        border-bottom: 1px solid var(--line-strong);
      }

      .assetMapReportLogoWrap {
        display: flex;
        align-items: center;
        justify-content: flex-start;
        min-height: 17mm;
      }

      .assetMapReportLogo {
        display: block;
        width: 18mm;
        height: auto;
        object-fit: contain;
      }

      .assetMapReportDocumentTitle strong {
        display: block;
        color: var(--strong);
        font-size: 16px;
        line-height: 1.05;
        font-weight: 800;
        letter-spacing: -0.025em;
      }

      .assetMapReportDocumentTitle span {
        display: block;
        margin-top: 5px;
        color: var(--muted);
        font-size: 8.9px;
        font-weight: 600;
        letter-spacing: 0.01em;
      }

      .assetMapReportHeaderMeta {
        display: grid;
        gap: 4px;
        color: var(--muted);
        font-size: 8.3px;
      }

      .assetMapReportMetaLine {
        display: grid;
        grid-template-columns: 23mm minmax(0, 1fr);
        gap: 7px;
        align-items: baseline;
      }

      .assetMapReportMetaLine span {
        color: var(--muted);
        font-weight: 600;
      }

      .assetMapReportMetaLine strong {
        color: var(--strong);
        font-weight: 700;
        text-align: right;
        word-break: break-word;
      }

      .assetMapReportOverview {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 74mm;
        align-items: stretch;
        border: 1px solid var(--line-strong);
        background: #ffffff;
      }

      .assetMapReportIdentity {
        min-width: 0;
        padding: 10px 13px 11px;
      }

      .assetMapReportKicker {
        margin: 0 0 6px;
        color: var(--muted);
        font-size: 8.1px;
        font-weight: 800;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }

      .assetMapReportTitle {
        margin: 0;
        color: var(--strong);
        font-size: 21.5px;
        line-height: 1.05;
        font-weight: 800;
        letter-spacing: -0.045em;
      }

      .assetMapReportHeroMeta {
        margin: 7px 0 0;
        color: #3f4652;
        font-size: 9.2px;
        line-height: 1.35;
        font-weight: 600;
      }

      .assetMapReportSummaryCard {
        display: flex;
        flex-direction: column;
        justify-content: center;
        padding: 10px 12px;
        border-left: 1px solid var(--line-strong);
        background: var(--soft-2);
      }

      .assetMapReportSummaryCard h2 {
        margin: 0 0 6px;
        color: #2b313b;
        font-size: 8.8px;
        line-height: 1.1;
        font-weight: 800;
        letter-spacing: 0.07em;
        text-transform: uppercase;
      }

      .assetMapReportCount {
        display: block;
        margin: 0;
        color: var(--strong);
        font-size: 30px;
        line-height: 0.96;
        font-weight: 800;
        letter-spacing: -0.055em;
        white-space: nowrap;
      }

      .assetMapReportCountLabel {
        display: block;
        margin-top: 4px;
        color: var(--muted);
        font-size: 8.5px;
        font-weight: 600;
      }

      .assetMapReportValueMeta {
        display: grid;
        gap: 4px;
        margin-top: 10px;
        padding-top: 8px;
        border-top: 1px solid var(--line);
      }

      .assetMapReportValueMeta div {
        display: grid;
        grid-template-columns: 22mm minmax(0, 1fr);
        gap: 7px;
        min-height: 17px;
        align-items: baseline;
      }

      .assetMapReportValueMeta span {
        color: var(--muted);
        font-size: 8.2px;
        font-weight: 700;
      }

      .assetMapReportValueMeta strong {
        color: var(--strong);
        font-size: 8.3px;
        font-weight: 700;
        text-align: right;
        word-break: break-word;
      }

      .assetMapReportContentGrid {
        display: grid;
        grid-template-columns: minmax(0, 1fr) ${singleAsset ? '74mm' : '0'};
        gap: ${singleAsset ? '12px' : '0'};
        align-items: stretch;
      }

      .assetMapReportMapSection,
      .assetMapReportSection,
      .assetMapReportSideCard {
        border: 1px solid var(--line-strong);
        background: #ffffff;
      }

      .assetMapReportMapSection {
        min-width: 0;
        display: grid;
        grid-template-rows: auto 1fr;
        overflow: hidden;
      }

      .assetMapReportSectionHeader {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 12px;
        padding: 8px 10px 7px;
        border-bottom: 1px solid var(--line);
      }

      .assetMapReportSectionHeader h2 {
        margin: 0;
        color: var(--strong);
        font-size: 10.8px;
        line-height: 1.1;
        font-weight: 800;
        letter-spacing: -0.01em;
      }

      .assetMapReportSectionHeader span {
        color: var(--muted);
        font-size: 8px;
        line-height: 1.2;
        font-weight: 700;
        text-align: right;
      }

      #map {
        width: 100%;
        height: 86mm;
        min-height: 86mm;
        background: #dfe8e2;
      }

      .assetMapReportSide {
        display: ${singleAsset ? 'grid' : 'none'};
        gap: 8px;
      }

      .assetMapReportSideCard {
        padding: 10px 10px 9px;
      }

      .assetMapReportSideCard h2,
      .assetMapReportSection h2 {
        margin: 0 0 8px;
        color: var(--strong);
        font-size: 10.8px;
        line-height: 1.1;
        font-weight: 800;
        letter-spacing: -0.01em;
      }

      .assetMapReportDetailRows {
        width: 100%;
        border-top: 1px solid var(--line);
      }

      .assetMapReportDetailRow {
        display: grid;
        grid-template-columns: 23mm minmax(0, 1fr);
        min-height: 18px;
        align-items: center;
        border-bottom: 1px solid var(--line);
      }

      .assetMapReportDetailRow span {
        color: #38404c;
        font-size: 8.1px;
        line-height: 1.3;
        font-weight: 600;
      }

      .assetMapReportDetailRow strong {
        color: var(--strong);
        font-size: 8.2px;
        line-height: 1.3;
        font-weight: 700;
        text-align: right;
        word-break: break-word;
      }

      .assetMapReportSection {
        display: grid;
        gap: 10px;
        padding: 10px 11px 12px;
        break-inside: avoid;
      }

      .assetMapReportKeyRows {
        display: grid;
        gap: 7px;
        border-top: 0;
      }

      .assetMapReportKeyRow {
        display: grid;
        grid-template-columns: 10mm minmax(38mm, 1fr) minmax(16mm, 0.35fr) minmax(20mm, 0.45fr) minmax(16mm, 0.35fr) minmax(18mm, 0.4fr) minmax(31mm, 0.65fr) minmax(31mm, 0.65fr);
        gap: 8px;
        min-height: 34px;
        align-items: center;
        padding: 7px 9px;
        border: 1px solid var(--line);
        background: var(--soft-2);
        break-inside: avoid;
      }

      .assetMapReportMarkerNumber {
        display: grid;
        place-items: center;
        width: 24px;
        height: 24px;
        border-radius: 999px;
        color: #ffffff;
        background: var(--brand);
        font-size: 8.7px;
        font-weight: 800;
      }

      .assetMapReportAssetCell,
      .assetMapReportCell {
        min-width: 0;
        display: grid;
        gap: 2px;
      }

      .assetMapReportAssetCell strong,
      .assetMapReportCell strong {
        min-width: 0;
        overflow-wrap: anywhere;
        color: var(--strong);
        font-size: 8.4px;
        line-height: 1.25;
        font-weight: 700;
      }

      .assetMapReportAssetCell span,
      .assetMapReportCell span {
        min-width: 0;
        overflow-wrap: anywhere;
        color: #38404c;
        font-size: 7.7px;
        line-height: 1.25;
        font-weight: 600;
      }

      .assetMapReportCell small {
        min-width: 0;
        overflow-wrap: anywhere;
        color: #5f7370;
        font-size: 7.2px;
        line-height: 1.25;
        font-weight: 700;
      }

      .assetMapReportGpsCell strong {
        font-size: 7.9px;
      }

      .assetMapReportEmpty {
        display: grid;
        place-items: center;
        gap: 5px;
        min-height: 35mm;
        text-align: center;
        color: var(--muted);
        font-size: 9px;
      }

      .assetMapReportEmpty strong {
        color: var(--strong);
      }

      .assetMapReportFooter {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 10px;
        align-items: end;
        padding-top: 8px;
        border-top: 1px solid var(--line-strong);
      }

      .assetMapReportPowered {
        margin: 0 0 4px;
        color: var(--strong);
        font-size: 8.2px;
        font-weight: 700;
      }

      .assetMapReportDisclaimer {
        max-width: 190mm;
        color: #323a45;
        font-size: 7.35px;
        line-height: 1.35;
        font-style: italic;
      }

      .assetMapReportPageNumber {
        color: var(--strong);
        font-size: 8px;
        font-weight: 700;
        white-space: nowrap;
      }

      .leaflet-container {
        font-family: inherit;
      }

      .leaflet-control-attribution {
        font-size: 7px;
      }

      .leaflet-popup-content-wrapper,
      .leaflet-popup-tip {
        border-radius: 0;
        box-shadow: none;
      }

      .reportMarker {
        background: transparent;
        border: 0;
      }

      .reportMarkerPin {
        position: relative;
        display: grid;
        place-items: center;
        width: 30px;
        height: 30px;
        border-radius: 999px;
        color: #ffffff;
        background: var(--brand);
        border: 3px solid #ffffff;
        box-shadow: 0 9px 18px rgba(16, 63, 53, 0.3);
      }

      .reportMarkerPin::after {
        content: '';
        position: absolute;
        left: 50%;
        bottom: -5px;
        width: 9px;
        height: 9px;
        border-right: 3px solid #ffffff;
        border-bottom: 3px solid #ffffff;
        background: var(--brand);
        transform: translateX(-50%) rotate(45deg);
        border-radius: 0 0 3px 0;
      }

      .reportMarkerPin b {
        position: relative;
        z-index: 2;
        font-size: 8.4px;
        font-weight: 800;
      }

      @media screen and (max-width: 900px) {
        .assetMapReportPage {
          width: min(100% - 24px, 297mm);
        }

        .assetMapReportHeader,
        .assetMapReportOverview,
        .assetMapReportContentGrid {
          grid-template-columns: 1fr;
        }

        .assetMapReportSummaryCard {
          border-left: 0;
          border-top: 1px solid var(--line-strong);
        }

        .assetMapReportHeaderMeta,
        .assetMapReportMetaLine strong,
        .assetMapReportValueMeta strong,
        .assetMapReportDetailRow strong {
          text-align: left;
        }
      }

      @media print {
        html,
        body {
          background: #ffffff;
        }

        .assetMapReportScreenBar {
          display: none !important;
        }

        .assetMapReportPage {
          width: auto;
          min-height: 0;
          margin: 0;
          padding: 0;
          box-shadow: none;
        }

        .assetMapReportInner {
          min-height: 0;
          gap: 7px;
        }

        .assetMapReportHeader {
          grid-template-columns: 22mm minmax(0, 1fr) 74mm;
        }

        .assetMapReportOverview {
          grid-template-columns: minmax(0, 1fr) 74mm;
        }

        .assetMapReportContentGrid {
          grid-template-columns: minmax(0, 1fr) ${singleAsset ? '74mm' : '0'};
          gap: ${singleAsset ? '12px' : '0'};
        }

        #map {
          height: ${singleAsset ? '89mm' : '94mm'};
          min-height: ${singleAsset ? '89mm' : '94mm'};
        }

        .assetMapReportSection {
          gap: 6px;
          padding: 8px 9px 9px;
        }

        .assetMapReportKeyRows {
          gap: 5px;
        }

        .assetMapReportKeyRow {
          min-height: 31px;
          padding: 6px 8px;
        }
      }
    </style>
  </head>
  <body>
    <div class="assetMapReportScreenBar">
      <div class="assetMapReportScreenText">Choose <strong>Save as PDF</strong> in the print dialog to download this asset map report.</div>
      <div class="assetMapReportScreenActions">
        <button type="button" class="assetMapReportButton" onclick="window.close()">Close</button>
        <button type="button" class="assetMapReportButton assetMapReportButtonPrimary" onclick="window.print()">Print / Save PDF</button>
      </div>
    </div>

    <main class="assetMapReportPage">
      <div class="assetMapReportInner">
        <header class="assetMapReportHeader">
          <div class="assetMapReportLogoWrap"><img class="assetMapReportLogo" src="/brand/aim4price-mark-black.png" alt="Aim4price" /></div>
          <div class="assetMapReportDocumentTitle">
            <strong>${escapeHtml(documentTitle)}</strong>
            <span>Aim4price fleet visibility</span>
          </div>
          <div class="assetMapReportHeaderMeta">
            <div class="assetMapReportMetaLine"><span>Generated</span><strong>${escapeHtml(generatedDate)}</strong></div>
            <div class="assetMapReportMetaLine"><span>Time</span><strong>${escapeHtml(generatedTime)}</strong></div>
            ${ownerEmail ? `<div class="assetMapReportMetaLine"><span>Email</span><strong>${escapeHtml(ownerEmail)}</strong></div>` : ''}
          </div>
        </header>

        <section class="assetMapReportOverview">
          <div class="assetMapReportIdentity">
            <p class="assetMapReportKicker">${escapeHtml(heroBadge)}</p>
            <h1 class="assetMapReportTitle">${escapeHtml(heroTitle)}</h1>
            <p class="assetMapReportHeroMeta">${escapeHtml(heroMeta)}</p>
          </div>

          <aside class="assetMapReportSummaryCard">
            <h2>Mapped assets</h2>
            <strong class="assetMapReportCount">${assets.length}</strong>
            <span class="assetMapReportCountLabel">${assets.length === 1 ? 'Selected mapped asset' : 'Visible mapped assets'}</span>
            <div class="assetMapReportValueMeta">
              <div><span>Report basis</span><strong>${assets.length === 1 ? 'Selected asset' : 'Current map view'}</strong></div>
              <div><span>Marker key</span><strong>${assets.length ? 'Numbered' : 'No markers'}</strong></div>
            </div>
          </aside>
        </section>

        <div class="assetMapReportContentGrid">
          <section class="assetMapReportMapSection">
            <div class="assetMapReportSectionHeader">
              <h2>Asset Location Map</h2>
              <span>${assets.length === 1 ? 'One GPS marker shown' : 'Markers are numbered to match the location key'}</span>
            </div>
            <div id="map" aria-label="Asset map report"></div>
          </section>

          <aside class="assetMapReportSide">
            <section class="assetMapReportSideCard">
              <h2>Selected Asset Details</h2>
              <div class="assetMapReportDetailRows">${selectedAssetRows}</div>
            </section>
          </aside>
        </div>

        <section class="assetMapReportSection">
          <h2>Location Key</h2>
          <div class="assetMapReportKeyRows">${rowsHtml}</div>
        </section>

        <footer class="assetMapReportFooter">
          <div>
            <p class="assetMapReportPowered">Powered by Aim4price.com</p>
            <div class="assetMapReportDisclaimer">This report reflects the latest saved QR scan GPS position for each mapped asset at the time it was generated. Use the coordinates and marker numbers as a location aid, not as a legal survey record.</div>
          </div>
          <div class="assetMapReportPageNumber">Page 1</div>
        </footer>
      </div>
    </main>

    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script>
      (function () {
        var assets = ${mapData};

        function initMap() {
          var mapEl = document.getElementById('map');
          if (!mapEl || !window.L) {
            return;
          }

          var map = L.map(mapEl, {
            zoomControl: false,
            attributionControl: true,
            scrollWheelZoom: false,
            dragging: false,
            doubleClickZoom: false,
            boxZoom: false,
            keyboard: false,
            tap: false,
          });

          var tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap contributors',
          }).addTo(map);

          if (!assets.length) {
            map.setView([-29.0, 24.0], 5);
            schedulePrint(tiles);
            return;
          }

          var bounds = [];
          var escapePopup = function (value) {
            return String(value == null ? '' : value)
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#39;');
          };

          assets.forEach(function (asset) {
            var icon = L.divIcon({
              className: 'reportMarker',
              html: '<span class="reportMarkerPin"><b>' + asset.number + '</b></span>',
              iconSize: [34, 40],
              iconAnchor: [17, 36],
              popupAnchor: [0, -31],
            });

            var marker = L.marker([asset.latitude, asset.longitude], { icon: icon }).addTo(map);
            marker.bindPopup('<strong>' + escapePopup(asset.title) + '</strong><br />' + escapePopup(asset.plateLabel) + '<br />GPS ' + escapePopup(asset.latLngText));
            bounds.push([asset.latitude, asset.longitude]);
          });

          if (bounds.length === 1) {
            map.setView(bounds[0], 13);
          } else {
            map.fitBounds(bounds, { padding: [44, 44], maxZoom: 13 });
          }

          schedulePrint(tiles);
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

        function schedulePrint(tiles) {
          var printed = false;
          var printReport = function () {
            if (printed) return;
            printed = true;
            waitForFonts().then(function () {
              window.setTimeout(function () {
                window.focus();
                window.print();
              }, 350);
            });
          };

          if (tiles && typeof tiles.once === 'function') {
            tiles.once('load', function () { window.setTimeout(printReport, 650); });
          }
          window.setTimeout(printReport, 2300);
        }

        if (document.readyState === 'complete') {
          initMap();
        } else {
          window.addEventListener('load', initMap, { once: true });
        }
      })();
    </script>
  </body>
</html>`;
}

export async function GET(request: Request) {
  const session = await getServerSession();

  if (!session?.user?.id) {
    return unauthorized();
  }

  try {
    const url = new URL(request.url);
    const selection = readAssetReportSelection(url);

    const items = await listAssetRegisterItems(session.user.id);
    const mappedItems = items.filter(hasCoordinates);
    const reportItems = filterAssetsBySelection(mappedItems, selection);
    const printableAssets = reportItems.map(toPrintableAsset);
    const now = new Date();
    const html = buildReportHtml(printableAssets, formatDate(now), formatTime(now), asText(session.user.email));
    const filename = buildReportFilename(printableAssets, now);

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('asset map report failed', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to build the asset map report.' },
      { status: 500 },
    );
  }
}
