import { NextRequest, NextResponse } from 'next/server';
import { getAccountProfile } from '../../../../lib/account-profile';
import { listAssetGroups } from '../../../../lib/asset-groups';
import {
  assetCountsTowardRegisterTotalFromMeta,
  assetGroupValueModeLabel,
  decorateAssetsWithGroups,
  projectAssetGroupsToAssets,
  type AssetGroupExportMeta,
} from '../../../../lib/asset-groups-shared';
import { listAssetRegisterItems, type AssetRegisterItem } from '../../../../lib/asset-register-db';
import { getAssetRegisterForUser, getSelectedAssetRegister, getVisibleAssetRegisterLogoUrl, listAssetRegisters, type AssetRegisterSummary } from '../../../../lib/asset-registers';
import { createXlsxWorkbook, type XlsxCellStyle, type XlsxCellValue, type XlsxSheet } from '../../../../lib/simple-xlsx';
import { resolveReportLogoUrlForHtml } from '../../../../lib/report-logo';
import { renderReportHtmlToPdf } from '../../../../lib/report-pdf';
import { resolveOwnerWorkspaceContext } from '../../../../lib/owner-workspace-access';
import { getOwnerAppAccess, ownerAppCanAccessAsset } from '../../../../lib/owner-app-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type AccountProfileResult = Awaited<ReturnType<typeof getAccountProfile>>;

type AssetStatusChoice = 'yes' | 'no' | 'unknown' | 'not_applicable';

type SheetDefinition = {
  name: string;
  description: string;
  items: AssetRegisterItem[];
  tabColor: string;
};

type RegisterExportScope = 'all' | 'single' | 'combined';

type RegisterExportBundle = {
  register: AssetRegisterSummary;
  items: AssetRegisterItem[];
};

type SourceAssetRow = {
  register: AssetRegisterSummary;
  item: AssetRegisterItem;
};

type GroupAwareExportAsset = AssetRegisterItem & {
  assetGroup?: AssetGroupExportMeta | null;
};

type UsageDisplay = {
  value: number | null;
  unit: 'hours' | 'km' | 'percentage' | null;
};

type RegisterSummaryCountValue = {
  count: number;
  valueExVat: number;
};

type RegisterSummaryAssetTypeKey = 'property' | 'equipment' | 'tools' | 'stock' | 'vehicles';

type RegisterBasicExportSummary = {
  totalAssets: number;
  currentValueExVat: number;
  replacementValueExVat: number;
  replacementPricedAssets: number;
  insuredValueExVat: number;
  insuredAssetsValueExVat: number;
  financedValueExVat: number;
  licensedValueExVat: number;
  assetsInsured: number;
  assetsLicensed: number;
  assetsFinanced: number;
  aim4priceAssets: RegisterSummaryCountValue;
  manualAssets: RegisterSummaryCountValue;
  assetTypes: Record<RegisterSummaryAssetTypeKey, RegisterSummaryCountValue>;
  assetsMapped: number;
  assetsWithPhotos: number;
  assetsWithDocuments: number;
};

type RegisterSummaryXlsxSection = {
  title: string;
  hasValueColumn?: boolean;
  rows: XlsxCellValue[][];
};

type RegisterSummaryPdfSection = {
  title: string;
  hasValueColumn?: boolean;
  rows: Array<{ label: string; count?: string; valueExVat?: string; valueInclVat?: string }>;
};

const NA_VALUE = 'N/A';
const AIM4PRICE_REPORT_EMAIL = 'aim4price@gmail.com';
const VAT_RATE = 0.15;
const VAT_MULTIPLIER = 1 + VAT_RATE;
const PROPERTY_ASSET_LABEL = 'Property / Land / Building';
const PROPERTY_YEAR_LABEL = 'Year';
const PROPERTY_SIZE_SPEC_KEYS = ['propertySize', 'property_size', 'size', 'sizeText', 'size_text'] as const;

const EXPORT_DETAILS_SECTION_ROW = 5;
const EXPORT_NOTE_SECTION_ROW = 13;
const EXPORT_NOTE_START_ROW = EXPORT_NOTE_SECTION_ROW + 1;
const SUMMARY_SECTION_ROW = 17;
const SUMMARY_ROW_COUNT = 10;
const TABLE_HEADER_ROW = SUMMARY_SECTION_ROW + 1 + SUMMARY_ROW_COUNT + 1;
const DATA_START_ROW = TABLE_HEADER_ROW + 1;

const REGISTER_VALUE_EX_VAT_COLUMN = 'M';
const REGISTER_VALUE_INCL_VAT_COLUMN = 'N';
const FINANCE_STATUS_COLUMN = 'O';
const INSURANCE_STATUS_COLUMN = 'Q';
const INSURED_VALUE_EX_VAT_COLUMN = 'S';
const INSURED_VALUE_INCL_VAT_COLUMN = 'T';
const LICENSE_STATUS_COLUMN = 'U';
const REPLACEMENT_VALUE_EX_VAT_COLUMN = 'W';
const REPLACEMENT_VALUE_INCL_VAT_COLUMN = 'X';
const COUNTS_IN_REGISTER_TOTAL_COLUMN = 'AB';

const TABLE_HEADERS = [
  'Asset title',
  'Serial / VIN',
  'Asset #',
  'Asset type',
  'Brand',
  'Model / description',
  'Year',
  'Plate / QR code',
  'Drive',
  'Usage value',
  'Usage unit',
  'Condition',
  'Register value ex VAT',
  'Register value incl VAT',
  'Finance status',
  'Finance notes',
  'Insurance status',
  'Insurance notes',
  'Insured value ex VAT',
  'Insured value incl VAT',
  'License status',
  'License registration',
  'Replacement price ex VAT',
  'Replacement price incl VAT',
  'Asset group',
  'Group role',
  'Group value handling',
  'Counts in register total',
] as const;

const WORKBOOK_COLUMN_WIDTHS = [
  34,
  18,
  9,
  22,
  18,
  30,
  15,
  18,
  12,
  14,
  14,
  18,
  18,
  18,
  17,
  28,
  17,
  28,
  20,
  20,
  17,
  24,
  22,
  22,
  28,
  18,
  34,
  24,
];

function unauthorized() {
  return NextResponse.json({ ok: false, error: 'You must be signed in.' }, { status: 401 });
}

function cleanText(value: unknown): string {
  return String(value ?? '').trim();
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function resolveReportLogoUrl(profile: AccountProfileResult | null, requestUrl: string): Promise<string> {
  return resolveReportLogoUrlForHtml(profile?.logoUrl, requestUrl);
}

function textOrNa(value: unknown): string {
  const cleaned = cleanText(value);
  return cleaned || NA_VALUE;
}

function textCell(value: unknown, style: XlsxCellStyle = 'text'): XlsxCellValue {
  return { value: cleanText(value), style };
}

function naCell(style: XlsxCellStyle = 'muted'): XlsxCellValue {
  return { value: NA_VALUE, style };
}

function textOrNaCell(value: unknown, style: XlsxCellStyle = 'text'): XlsxCellValue {
  return { value: textOrNa(value), style };
}

function numericValue(value: unknown): number | null {
  if (value === null || typeof value === 'undefined' || value === '') return null;

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function numberCell(value: unknown): XlsxCellValue {
  const numeric = numericValue(value);
  return numeric === null ? naCell() : { value: numeric, style: 'integer' };
}

function moneyCell(value: unknown): XlsxCellValue {
  const numeric = numericValue(value);
  return numeric === null ? naCell() : { value: Math.round(numeric), style: 'currency' };
}

function moneyInclVatTotal(value: unknown): number {
  const numeric = numericValue(value);
  return numeric === null ? 0 : Math.round(numeric * VAT_MULTIPLIER);
}

function vatIncludedFormulaCell(exVatColumn: string, rowNumber: number, exVatValue: unknown): XlsxCellValue {
  const numeric = numericValue(exVatValue);

  if (numeric === null) {
    return naCell();
  }

  return {
    formula: `ROUND(${exVatColumn}${rowNumber}*${VAT_MULTIPLIER},0)`,
    value: Math.round(numeric * VAT_MULTIPLIER),
    style: 'currency',
  };
}

function dateCell(value?: string | Date | null): XlsxCellValue {
  const parsed = value instanceof Date ? value : value ? new Date(value) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? { value: parsed, style: 'date' } : naCell();
}

function formulaCell(formula: string, value: number, style: 'integer' | 'currency' = 'integer'): XlsxCellValue {
  return { formula, value, style };
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

function statusCellForChoice(status: AssetStatusChoice, positiveLabel: string, negativeLabel: string): XlsxCellValue {
  const normalized = normalizeAssetStatusChoice(status);
  const value = normalized === 'yes'
    ? positiveLabel
    : normalized === 'no'
      ? negativeLabel
      : normalized === 'not_applicable'
        ? NA_VALUE
        : 'Not sure';
  const style: XlsxCellStyle = normalized === 'yes'
    ? 'statusGood'
    : normalized === 'no'
      ? 'statusBad'
      : normalized === 'not_applicable'
        ? 'statusInfo'
        : 'statusWarn';

  return { value, style };
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isMeaningfulText(value: string): boolean {
  const normalized = cleanText(value).toLowerCase();
  return Boolean(normalized && normalized !== '-' && normalized !== '—' && normalized !== 'unknown' && normalized !== 'n/a');
}

function readTextFromSpecs(specs: Record<string, unknown>, keys: readonly string[]): string {
  for (const key of keys) {
    const value = cleanText(specs[key]);
    if (isMeaningfulText(value)) return value;
  }

  return '';
}

function propertySizeDisplay(item: AssetRegisterItem): string {
  const specs = isPlainRecord(item.specsJson) ? item.specsJson : {};
  return readTextFromSpecs(specs, PROPERTY_SIZE_SPEC_KEYS) || NA_VALUE;
}

function readFinanceStatusChoice(item: AssetRegisterItem): AssetStatusChoice {
  const specs = isPlainRecord(item.specsJson) ? item.specsJson : {};

  return normalizeAssetStatusChoice(
    specs.financeStatus ?? specs.finance_status ?? specs.financedStatus ?? specs.financed_status,
    item.isFinanced ? 'yes' : 'no',
  );
}

function readInsuranceStatusChoice(item: AssetRegisterItem): AssetStatusChoice {
  const specs = isPlainRecord(item.specsJson) ? item.specsJson : {};

  return normalizeAssetStatusChoice(
    specs.insuranceStatus ?? specs.insurance_status ?? specs.insuredStatus ?? specs.insured_status,
    item.isInsured || insuredValueExVat(item) !== null ? 'yes' : 'no',
  );
}

function readLicenseStatusChoice(item: AssetRegisterItem): AssetStatusChoice {
  if (item.kind === 'property') {
    return 'not_applicable';
  }

  const specs = isPlainRecord(item.specsJson) ? item.specsJson : {};

  return normalizeAssetStatusChoice(
    specs.licenseStatus ??
      specs.license_status ??
      specs.licensedStatus ??
      specs.licensed_status ??
      specs.licenceStatus ??
      specs.licence_status ??
      specs.licencedStatus ??
      specs.licenced_status,
    item.isLicensed ? 'yes' : 'no',
  );
}

function readLicenseRegistrationNumber(item: AssetRegisterItem): string {
  const direct = cleanText(item.licenseRegistrationNumber).toUpperCase();
  if (direct) return direct;

  const specs = isPlainRecord(item.specsJson) ? item.specsJson : {};

  return cleanText(
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

const REPLACEMENT_PRICE_SPEC_KEYS = [
  'replacementPriceExVat',
  'replacement_price_ex_vat',
  'replacementPriceUsedExVat',
  'replacement_price_used_ex_vat',
  'userReplacementPriceExVat',
  'user_replacement_price_ex_vat',
  'officialReplacementPriceExVat',
  'official_replacement_price_ex_vat',
  'replacementPrice',
  'replacement_price',
] as const;

function replacementPriceExVat(item: AssetRegisterItem): number | null {
  const direct = numericValue(item.replacementPriceExVat);
  if (direct !== null && direct > 0) return Math.round(direct);

  const specs = isPlainRecord(item.specsJson) ? item.specsJson : {};

  for (const key of REPLACEMENT_PRICE_SPEC_KEYS) {
    const value = numericValue(specs[key]);
    if (value !== null && value > 0) return Math.round(value);
  }

  return null;
}

const INSURED_VALUE_SPEC_KEYS = [
  'insuredValueExVat',
  'insured_value_ex_vat',
  'insuranceValueExVat',
  'insurance_value_ex_vat',
  'insuredValue',
  'insured_value',
  'insuranceValue',
  'insurance_value',
] as const;

function insuredValueExVat(item: AssetRegisterItem): number | null {
  const direct = numericValue(item.insuredValueExVat);
  if (direct !== null && direct > 0) return Math.round(direct);

  const specs = isPlainRecord(item.specsJson) ? item.specsJson : {};

  for (const key of INSURED_VALUE_SPEC_KEYS) {
    const value = numericValue(specs[key]);
    if (value !== null && value > 0) return Math.round(value);
  }

  return null;
}

function methodLabel(value: AssetRegisterItem['selectedMethod'] | string | null | undefined): string {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'manual') return 'Manual';
  return 'Aim4price';
}

function kindLabel(asset: AssetRegisterItem): string {
  if (asset.equipmentFamilyLabel) return asset.equipmentFamilyLabel;
  if (asset.kind === 'tractor') return 'Tractor';
  if (asset.kind === 'stock') return 'Stock';
  if (asset.kind === 'equipment' || Boolean(asset.brandName && asset.modelName && asset.yearModel)) return 'Equipment';
  if (asset.kind === 'property') return PROPERTY_ASSET_LABEL;
  if (asset.kind === 'vehicle') return 'Vehicle';
  if (asset.kind === 'tools') return 'Tools';
  return 'Manual asset';
}

function conditionLabel(value: AssetRegisterItem['condition']): string {
  return (
    {
      excellent: 'Excellent',
      good: 'Good',
      fair: 'Fair',
      used: 'Used',
      serious: 'Requires attention',
      '': '',
    }[value] ?? ''
  );
}

function normalizedUsageMetric(item: AssetRegisterItem): string {
  if (item.kind === 'vehicle') {
    return 'km';
  }

  const specs = isPlainRecord(item.specsJson) ? item.specsJson : {};

  return String(
    specs.usageMetric ??
      specs.usage_metric ??
      specs.usageUnit ??
      specs.usage_unit ??
      specs.usageType ??
      specs.usage_type ??
      '',
  )
    .trim()
    .toLowerCase();
}

function usageDisplay(item: AssetRegisterItem): UsageDisplay {
  if (item.kind === 'property') {
    return { value: null, unit: null };
  }

  const specs = isPlainRecord(item.specsJson) ? item.specsJson : {};
  const rawUsageMode = String(
    specs.usageMode ??
      specs.usage_mode ??
      specs.usageMetricType ??
      specs.usage_metric_type ??
      specs.valuationMode ??
      specs.valuation_mode ??
      '',
  )
    .trim()
    .toLowerCase();
  const normalized = normalizedUsageMetric(item);
  const lifeWorkedPercent = numericValue(item.lifeWorkedPercent);
  const hours = numericValue(item.hours);

  if (item.kind === 'vehicle') {
    return hours !== null && hours > 0
      ? { value: Math.round(hours), unit: 'km' }
      : { value: null, unit: 'km' };
  }

  if (
    ['percent', 'percentage', '%', 'percent_used', 'percent used', 'life_worked_percent', 'life worked percent'].includes(
      normalized,
    ) ||
    ['percent', 'percentage', 'percent_used', 'percentage_depreciation', 'wear_class'].includes(rawUsageMode)
  ) {
    return {
      value: lifeWorkedPercent === null ? null : Math.round(lifeWorkedPercent),
      unit: 'percentage',
    };
  }

  if (hours !== null && hours > 0) {
    return { value: Math.round(hours), unit: 'hours' };
  }

  if (lifeWorkedPercent !== null) {
    return { value: Math.round(lifeWorkedPercent), unit: 'percentage' };
  }

  const estimatedHours = numericValue(item.estimatedHours);
  if (estimatedHours !== null && estimatedHours > 0) {
    return { value: Math.round(estimatedHours), unit: 'hours' };
  }

  if (normalized === 'km' || normalized === 'kms' || normalized === 'kilometres' || normalized === 'kilometers') {
    return { value: null, unit: 'km' };
  }

  return { value: null, unit: null };
}

function formatDrive(value: string): string {
  if (value === '4wd') return '4WD';
  if (value === '2wd') return '2WD';
  if (value === 'tracks') return 'Tracks';
  return value || '';
}

function readInsuranceNote(item: AssetRegisterItem): string {
  const specs = isPlainRecord(item.specsJson) ? item.specsJson : {};

  return cleanText(
    specs.insuranceNote ??
      specs.insurance_note ??
      specs.insuredNote ??
      specs.insured_note ??
      '',
  );
}

function buildOwnerName(profile: AccountProfileResult | null): string {
  if (!profile) return 'Aim4price account';
  return profile.businessName || profile.name || 'Aim4price account';
}

function buildOwnerAddress(profile: AccountProfileResult | null): string {
  if (!profile) return '';

  return [profile.addressLine1, profile.addressLine2, profile.townCity, profile.province]
    .map((part) => cleanText(part))
    .filter(Boolean)
    .join(', ');
}

function exportAssetGroup(item: AssetRegisterItem): AssetGroupExportMeta | null {
  return (item as GroupAwareExportAsset).assetGroup ?? null;
}

function exportAssetCountsTowardRegisterTotal(item: AssetRegisterItem): boolean {
  return assetCountsTowardRegisterTotalFromMeta(item as GroupAwareExportAsset);
}

function exportAssetGroupRoleLabel(item: AssetRegisterItem): string {
  const group = exportAssetGroup(item);
  if (!group) return '';
  if (group.role === 'primary') return 'Primary asset';
  if (group.role === 'linked') return 'Linked to primary';
  return 'Grouped asset';
}

function orderGroupedExportAssets(items: AssetRegisterItem[]): AssetRegisterItem[] {
  const originalIndex = new Map(items.map((item, index) => [item.id, index]));
  const groupFirstIndex = new Map<string, number>();

  items.forEach((item, index) => {
    const group = exportAssetGroup(item);
    if (group && !groupFirstIndex.has(group.id)) groupFirstIndex.set(group.id, index);
  });

  return items.slice().sort((left, right) => {
    const leftGroup = exportAssetGroup(left);
    const rightGroup = exportAssetGroup(right);
    const leftRank = leftGroup ? (groupFirstIndex.get(leftGroup.id) ?? originalIndex.get(left.id) ?? 0) : (originalIndex.get(left.id) ?? 0);
    const rightRank = rightGroup ? (groupFirstIndex.get(rightGroup.id) ?? originalIndex.get(right.id) ?? 0) : (originalIndex.get(right.id) ?? 0);

    if (leftRank !== rightRank) return leftRank - rightRank;
    if (leftGroup?.id && leftGroup.id === rightGroup?.id) {
      if (leftGroup.role !== rightGroup.role) return leftGroup.role === 'primary' ? -1 : 1;
    }

    return (originalIndex.get(left.id) ?? 0) - (originalIndex.get(right.id) ?? 0);
  });
}

function registerValueTotal(items: AssetRegisterItem[]): number {
  return items.reduce(
    (sum, item) => sum + (exportAssetCountsTowardRegisterTotal(item) ? Math.round(numericValue(item.value) ?? 0) : 0),
    0,
  );
}

function registerValueInclVatTotal(items: AssetRegisterItem[]): number {
  return items.reduce(
    (sum, item) => sum + (exportAssetCountsTowardRegisterTotal(item) ? moneyInclVatTotal(item.value) : 0),
    0,
  );
}

function replacementValueTotal(items: AssetRegisterItem[]): number {
  return items.reduce((sum, item) => sum + Math.round(replacementPriceExVat(item) ?? 0), 0);
}

function replacementValueInclVatTotal(items: AssetRegisterItem[]): number {
  return items.reduce((sum, item) => sum + moneyInclVatTotal(replacementPriceExVat(item)), 0);
}

function insuredValueTotal(items: AssetRegisterItem[]): number {
  return items.reduce((sum, item) => sum + Math.round(insuredValueExVat(item) ?? 0), 0);
}

function insuredValueInclVatTotal(items: AssetRegisterItem[]): number {
  return items.reduce((sum, item) => sum + moneyInclVatTotal(insuredValueExVat(item)), 0);
}

function countFinanced(items: AssetRegisterItem[]): number {
  return items.filter((item) => readFinanceStatusChoice(item) === 'yes').length;
}

function countInsured(items: AssetRegisterItem[]): number {
  return items.filter((item) => readInsuranceStatusChoice(item) === 'yes').length;
}

function countLicensed(items: AssetRegisterItem[]): number {
  return items.filter((item) => readLicenseStatusChoice(item) === 'yes').length;
}

function buildPlateOrQrCode(item: AssetRegisterItem): string {
  return item.plateLabel || item.publicAssetCode || '';
}

function assetDedupeKey(item: AssetRegisterItem): string {
  const primaryKey = cleanText(item.id || item.publicAssetCode || '');
  if (primaryKey) return primaryKey;

  return [item.title, item.serialNumber, item.plateLabel, item.brandName, item.modelName, item.yearModel]
    .map((part) => cleanText(part).toLowerCase())
    .join('|');
}

function dedupeAssetItems(items: AssetRegisterItem[]): AssetRegisterItem[] {
  const seen = new Set<string>();

  return items.filter((item) => {
    const key = assetDedupeKey(item);

    if (!key) return true;
    if (seen.has(key)) return false;

    seen.add(key);
    return true;
  });
}

function createRegisterSummaryCountValue(): RegisterSummaryCountValue {
  return { count: 0, valueExVat: 0 };
}

function createRegisterSummaryAssetTypes(): Record<RegisterSummaryAssetTypeKey, RegisterSummaryCountValue> {
  return {
    property: createRegisterSummaryCountValue(),
    equipment: createRegisterSummaryCountValue(),
    tools: createRegisterSummaryCountValue(),
    stock: createRegisterSummaryCountValue(),
    vehicles: createRegisterSummaryCountValue(),
  };
}

function addToRegisterSummaryCountValue(stats: RegisterSummaryCountValue, valueExVat: number): void {
  stats.count += 1;
  stats.valueExVat += valueExVat;
}

function exportPhotoCount(item: AssetRegisterItem): number {
  return Array.isArray(item.photos)
    ? item.photos.map((photo) => cleanText(photo)).filter(Boolean).length
    : 0;
}

function exportDocumentCount(item: AssetRegisterItem): number {
  return Array.isArray(item.documents)
    ? item.documents.filter((document) => Boolean(cleanText(document.fileName) || cleanText(document.url) || cleanText(document.id))).length
    : 0;
}

function isItemMapped(item: AssetRegisterItem): boolean {
  const latitude = Number(item.lastKnownLat);
  const longitude = Number(item.lastKnownLng);

  return Number.isFinite(latitude) && Number.isFinite(longitude);
}

function isAim4priceExportAsset(item: AssetRegisterItem): boolean {
  return Boolean(item.valuationRunId !== null || String(item.selectedMethod ?? '').trim().toLowerCase() === 'aim4price' || numericValue(item.aim4priceValueExVat) !== null);
}

function normalizeSummarySearchText(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function getRegisterSummaryAssetType(item: AssetRegisterItem): RegisterSummaryAssetTypeKey {
  if (item.kind === 'property') return 'property';
  if (item.kind === 'tools') return 'tools';
  if (item.kind === 'stock') return 'stock';
  if (item.kind === 'vehicle') return 'vehicles';

  const specs = isPlainRecord(item.specsJson) ? item.specsJson : {};
  const searchableText = normalizeSummarySearchText(
    [
      item.kind,
      item.equipmentFamilyKey,
      item.equipmentFamilyLabel,
      item.typedModelName,
      item.normalizedTypedModelName,
      item.brandName,
      item.modelName,
      specs.assetType,
      specs.asset_type,
      specs.category,
      specs.assetCategory,
      specs.asset_category,
      specs.sector,
      specs.sectorKey,
      specs.sector_key,
      specs.equipmentType,
      specs.equipment_type,
      specs.vehicleType,
      specs.vehicle_type,
    ]
      .map((part) => String(part ?? ''))
      .filter(Boolean)
      .join(' '),
  );
  const textWithSpaces = ` ${searchableText} `;
  const vehicleTokens = [
    'vehicle',
    'motor',
    'car',
    'cars',
    'bakkie',
    'bakkies',
    'ldv',
    'truck',
    'trucks',
    'trailer',
    'trailers',
    'bus',
    'buses',
    'motorcycle',
    'motorcycles',
    'quad',
    'quads',
    'atv',
    'utv',
    'sxs',
    'side by side',
    'suv',
    'sedan',
    'hatch',
    'hatchback',
    'van',
    'taxi',
  ];

  if (vehicleTokens.some((token) => textWithSpaces.includes(` ${normalizeSummarySearchText(token)} `))) {
    return 'vehicles';
  }

  return 'equipment';
}

function buildRegisterBasicExportSummary(items: AssetRegisterItem[]): RegisterBasicExportSummary {
  const uniqueItems = dedupeAssetItems(items);
  const assetTypes = createRegisterSummaryAssetTypes();
  const aim4priceAssets = createRegisterSummaryCountValue();
  const manualAssets = createRegisterSummaryCountValue();
  let currentValueExVat = 0;
  let replacementValueExVat = 0;
  let replacementPricedAssets = 0;
  let insuredValueTotalExVat = 0;
  let insuredAssetsValueExVat = 0;
  let financedValueExVat = 0;
  let licensedValueExVat = 0;
  let assetsInsured = 0;
  let assetsLicensed = 0;
  let assetsFinanced = 0;
  let assetsMapped = 0;
  let assetsWithPhotos = 0;
  let assetsWithDocuments = 0;

  uniqueItems.forEach((item) => {
    const valueExVat = Math.round(numericValue(item.value) ?? 0);
    const countedValueExVat = exportAssetCountsTowardRegisterTotal(item) ? valueExVat : 0;
    const replacementPrice = replacementPriceExVat(item);
    const insuredValue = insuredValueExVat(item);
    const isInsured = readInsuranceStatusChoice(item) === 'yes';
    const isFinanced = readFinanceStatusChoice(item) === 'yes';
    const isLicensed = readLicenseStatusChoice(item) === 'yes';
    const assetType = getRegisterSummaryAssetType(item);

    currentValueExVat += countedValueExVat;
    addToRegisterSummaryCountValue(assetTypes[assetType], countedValueExVat);

    if (isAim4priceExportAsset(item)) {
      addToRegisterSummaryCountValue(aim4priceAssets, countedValueExVat);
    } else {
      addToRegisterSummaryCountValue(manualAssets, countedValueExVat);
    }

    if (replacementPrice !== null) {
      replacementPricedAssets += 1;
      replacementValueExVat += replacementPrice;
    }

    if (insuredValue !== null) {
      insuredValueTotalExVat += insuredValue;
    }

    if (isFinanced) {
      assetsFinanced += 1;
      financedValueExVat += countedValueExVat;
    }

    if (isInsured) {
      assetsInsured += 1;
      insuredAssetsValueExVat += insuredValue ?? 0;
    }

    if (isLicensed) {
      assetsLicensed += 1;
      licensedValueExVat += countedValueExVat;
    }

    if (isItemMapped(item)) {
      assetsMapped += 1;
    }

    if (exportPhotoCount(item) > 0) {
      assetsWithPhotos += 1;
    }

    if (exportDocumentCount(item) > 0) {
      assetsWithDocuments += 1;
    }
  });

  return {
    totalAssets: uniqueItems.length,
    currentValueExVat,
    replacementValueExVat,
    replacementPricedAssets,
    insuredValueExVat: insuredValueTotalExVat,
    insuredAssetsValueExVat,
    financedValueExVat,
    licensedValueExVat,
    assetsInsured,
    assetsLicensed,
    assetsFinanced,
    aim4priceAssets,
    manualAssets,
    assetTypes,
    assetsMapped,
    assetsWithPhotos,
    assetsWithDocuments,
  };
}

function buildRegisterSummaryXlsxSections(summary: RegisterBasicExportSummary): RegisterSummaryXlsxSection[] {
  return [
    {
      title: 'Register Values',
      rows: [
        [textCell('Total assets', 'metaLabel'), numberCell(summary.totalAssets), moneyCell(summary.currentValueExVat), moneyCell(moneyInclVatTotal(summary.currentValueExVat))],
        [textCell('Replacement value', 'metaLabel'), numberCell(summary.replacementPricedAssets), moneyCell(summary.replacementValueExVat), moneyCell(moneyInclVatTotal(summary.replacementValueExVat))],
        [textCell('Insured value', 'metaLabel'), numberCell(summary.assetsInsured), moneyCell(summary.insuredAssetsValueExVat), moneyCell(moneyInclVatTotal(summary.insuredAssetsValueExVat))],
        [textCell('Financed value', 'metaLabel'), numberCell(summary.assetsFinanced), moneyCell(summary.financedValueExVat), moneyCell(moneyInclVatTotal(summary.financedValueExVat))],
      ],
    },
    {
      title: 'Register Status Counts',
      rows: [
        [textCell('Assets insured', 'metaLabel'), numberCell(summary.assetsInsured), moneyCell(summary.insuredAssetsValueExVat), moneyCell(moneyInclVatTotal(summary.insuredAssetsValueExVat))],
        [textCell('Assets licensed', 'metaLabel'), numberCell(summary.assetsLicensed), moneyCell(summary.licensedValueExVat), moneyCell(moneyInclVatTotal(summary.licensedValueExVat))],
        [textCell('Assets financed', 'metaLabel'), numberCell(summary.assetsFinanced), moneyCell(summary.financedValueExVat), moneyCell(moneyInclVatTotal(summary.financedValueExVat))],
      ],
    },
    {
      title: 'Valuation Source',
      rows: [
        [textCell('Aim4price assets', 'metaLabel'), numberCell(summary.aim4priceAssets.count), moneyCell(summary.aim4priceAssets.valueExVat), moneyCell(moneyInclVatTotal(summary.aim4priceAssets.valueExVat))],
        [textCell('Manual assets', 'metaLabel'), numberCell(summary.manualAssets.count), moneyCell(summary.manualAssets.valueExVat), moneyCell(moneyInclVatTotal(summary.manualAssets.valueExVat))],
      ],
    },
    {
      title: 'Asset Type Split',
      rows: [
        [textCell('Property', 'metaLabel'), numberCell(summary.assetTypes.property.count), moneyCell(summary.assetTypes.property.valueExVat), moneyCell(moneyInclVatTotal(summary.assetTypes.property.valueExVat))],
        [textCell('Equipment', 'metaLabel'), numberCell(summary.assetTypes.equipment.count), moneyCell(summary.assetTypes.equipment.valueExVat), moneyCell(moneyInclVatTotal(summary.assetTypes.equipment.valueExVat))],
        [textCell('Tools', 'metaLabel'), numberCell(summary.assetTypes.tools.count), moneyCell(summary.assetTypes.tools.valueExVat), moneyCell(moneyInclVatTotal(summary.assetTypes.tools.valueExVat))],
        [textCell('Stock', 'metaLabel'), numberCell(summary.assetTypes.stock.count), moneyCell(summary.assetTypes.stock.valueExVat), moneyCell(moneyInclVatTotal(summary.assetTypes.stock.valueExVat))],
        [textCell('Vehicles', 'metaLabel'), numberCell(summary.assetTypes.vehicles.count), moneyCell(summary.assetTypes.vehicles.valueExVat), moneyCell(moneyInclVatTotal(summary.assetTypes.vehicles.valueExVat))],
      ],
    },
    {
      title: 'Supporting Information',
      hasValueColumn: false,
      rows: [
        [textCell('Assets mapped', 'metaLabel'), numberCell(summary.assetsMapped)],
        [textCell('Assets with photos', 'metaLabel'), numberCell(summary.assetsWithPhotos)],
        [textCell('Assets with documents', 'metaLabel'), numberCell(summary.assetsWithDocuments)],
      ],
    },
  ];
}

function buildRegisterSummaryWorkbookSheets(items: AssetRegisterItem[], profile: AccountProfileResult | null, generatedAt = new Date()): XlsxSheet[] {
  const summary = buildRegisterBasicExportSummary(items);
  const ownerName = buildOwnerName(profile);
  const ownerAddress = buildOwnerAddress(profile);
  const ownerEmail = cleanText(profile?.email);
  const ownerPhone = cleanText(profile?.phone);
  const sectionRows = buildRegisterSummaryXlsxSections(summary).flatMap((section) => [
    [],
    [textCell(section.title, 'section')],
    section.hasValueColumn === false
      ? [textCell('Metric', 'tableHeader'), textCell('Count', 'tableHeader')]
      : [textCell('Metric', 'tableHeader'), textCell('Count', 'tableHeader'), textCell('Value excl. VAT', 'tableHeader'), textCell('Value incl. VAT', 'tableHeader')],
    ...section.rows,
  ]);
  const summaryRows: XlsxCellValue[][] = [
    [textCell('Asset Register Summary', 'title')],
    [textCell(ownerName, 'section')],
    [textCell('Basic overview of the selected asset register. Values are shown excluding and including VAT. No individual asset rows are included.', 'subtitle')],
    [],
    [textCell('Export details', 'section')],
    [textCell('Generated', 'metaLabel'), { value: generatedAt, style: 'date' }],
    [textCell('Owner / register', 'metaLabel'), textOrNaCell(ownerName, 'metaValue')],
    [textCell('Address', 'metaLabel'), textOrNaCell(ownerAddress, 'metaValue')],
    [textCell('Business email', 'metaLabel'), textOrNaCell(ownerEmail, 'metaValue')],
    [textCell('Phone', 'metaLabel'), textOrNaCell(ownerPhone, 'metaValue')],
    ...sectionRows,
  ];

  return [
    {
      name: 'Register Summary',
      tabColor: '10382F',
      columns: [32, 16, 20, 20],
      merges: [
        { fromRow: 1, fromColumn: 1, toRow: 1, toColumn: 4 },
        { fromRow: 2, fromColumn: 1, toRow: 2, toColumn: 4 },
        { fromRow: 3, fromColumn: 1, toRow: 3, toColumn: 4 },
      ],
      rows: summaryRows,
    },
  ];
}

function buildSheetMerges(): XlsxSheet['merges'] {
  return [
    { fromRow: 1, fromColumn: 1, toRow: 1, toColumn: 8 },
    { fromRow: 2, fromColumn: 1, toRow: 2, toColumn: 8 },
    { fromRow: 3, fromColumn: 1, toRow: 3, toColumn: 8 },
    { fromRow: EXPORT_DETAILS_SECTION_ROW, fromColumn: 1, toRow: EXPORT_DETAILS_SECTION_ROW, toColumn: 2 },
    { fromRow: EXPORT_NOTE_SECTION_ROW, fromColumn: 1, toRow: EXPORT_NOTE_SECTION_ROW, toColumn: 2 },
    { fromRow: EXPORT_NOTE_START_ROW, fromColumn: 1, toRow: EXPORT_NOTE_START_ROW, toColumn: 8 },
    { fromRow: EXPORT_NOTE_START_ROW + 1, fromColumn: 1, toRow: EXPORT_NOTE_START_ROW + 1, toColumn: 8 },
    { fromRow: SUMMARY_SECTION_ROW, fromColumn: 1, toRow: SUMMARY_SECTION_ROW, toColumn: 2 },
  ];
}

function buildTableHeaderRow(): XlsxCellValue[] {
  return TABLE_HEADERS.map((header) => textCell(header, 'tableHeader'));
}

function buildAssetRow(item: AssetRegisterItem, index: number): XlsxCellValue[] {
  const usage = usageDisplay(item);
  const rowNumber = DATA_START_ROW + index;
  const financeStatus = readFinanceStatusChoice(item);
  const insuranceStatus = readInsuranceStatusChoice(item);
  const licenseStatus = readLicenseStatusChoice(item);
  const insuredValue = insuredValueExVat(item);
  const replacementPrice = replacementPriceExVat(item);
  const isProperty = item.kind === 'property';
  const group = exportAssetGroup(item);

  return [
    textOrNaCell(item.title),
    isProperty ? naCell() : textOrNaCell(item.serialNumber),
    numberCell(index + 1),
    textOrNaCell(kindLabel(item)),
    isProperty ? naCell() : textOrNaCell(item.brandName),
    isProperty ? textOrNaCell(`Size: ${propertySizeDisplay(item)}`) : textOrNaCell(item.modelName || item.typedModelName),
    item.yearModel ? numberCell(item.yearModel) : naCell(),
    isProperty ? naCell() : textOrNaCell(buildPlateOrQrCode(item)),
    isProperty ? naCell() : textOrNaCell(formatDrive(item.drive)),
    usage.value === null ? naCell() : numberCell(usage.value),
    textOrNaCell(usage.unit),
    textOrNaCell(conditionLabel(item.condition)),
    moneyCell(item.value),
    vatIncludedFormulaCell(REGISTER_VALUE_EX_VAT_COLUMN, rowNumber, item.value),
    statusCellForChoice(financeStatus, 'Financed', 'Not financed'),
    textOrNaCell(item.financeNote, 'note'),
    statusCellForChoice(insuranceStatus, 'Insured', 'Not insured'),
    textOrNaCell(readInsuranceNote(item), 'note'),
    insuredValue === null ? naCell() : moneyCell(insuredValue),
    insuredValue === null ? naCell() : vatIncludedFormulaCell(INSURED_VALUE_EX_VAT_COLUMN, rowNumber, insuredValue),
    isProperty ? naCell() : statusCellForChoice(licenseStatus, 'Licensed', 'Not licensed'),
    !isProperty && licenseStatus === 'yes' ? textOrNaCell(readLicenseRegistrationNumber(item)) : naCell(),
    replacementPrice === null ? naCell() : moneyCell(replacementPrice),
    replacementPrice === null ? naCell() : vatIncludedFormulaCell(REPLACEMENT_VALUE_EX_VAT_COLUMN, rowNumber, replacementPrice),
    group ? textCell(group.name) : naCell(),
    group ? textCell(exportAssetGroupRoleLabel(item)) : naCell(),
    group ? textCell(assetGroupValueModeLabel(group)) : naCell(),
    textCell(exportAssetCountsTowardRegisterTotal(item) ? 'Yes' : 'No'),
  ];
}

function buildFormulaRange(column: string, dataRowCount: number): string | null {
  if (dataRowCount < 1) return null;
  const lastDataRow = DATA_START_ROW + dataRowCount - 1;
  return `${column}${DATA_START_ROW}:${column}${lastDataRow}`;
}

function buildSummaryRows(items: AssetRegisterItem[]): XlsxCellValue[][] {
  const registerValueExVatRange = buildFormulaRange(REGISTER_VALUE_EX_VAT_COLUMN, items.length);
  const registerValueInclVatRange = buildFormulaRange(REGISTER_VALUE_INCL_VAT_COLUMN, items.length);
  const financeRange = buildFormulaRange(FINANCE_STATUS_COLUMN, items.length);
  const insuranceRange = buildFormulaRange(INSURANCE_STATUS_COLUMN, items.length);
  const insuredValueExVatRange = buildFormulaRange(INSURED_VALUE_EX_VAT_COLUMN, items.length);
  const insuredValueInclVatRange = buildFormulaRange(INSURED_VALUE_INCL_VAT_COLUMN, items.length);
  const licenseRange = buildFormulaRange(LICENSE_STATUS_COLUMN, items.length);
  const replacementValueExVatRange = buildFormulaRange(REPLACEMENT_VALUE_EX_VAT_COLUMN, items.length);
  const replacementValueInclVatRange = buildFormulaRange(REPLACEMENT_VALUE_INCL_VAT_COLUMN, items.length);
  const countsInRegisterTotalRange = buildFormulaRange(COUNTS_IN_REGISTER_TOTAL_COLUMN, items.length);

  return [
    [
      textCell('Total assets', 'metaLabel'),
      items.length > 0 ? formulaCell(`COUNTA(A${DATA_START_ROW}:A${DATA_START_ROW + items.length - 1})`, items.length) : numberCell(0),
    ],
    [
      textCell('Register value ex VAT', 'metaLabel'),
      registerValueExVatRange && countsInRegisterTotalRange
        ? formulaCell(`SUMIF(${countsInRegisterTotalRange},"Yes",${registerValueExVatRange})`, registerValueTotal(items), 'currency')
        : moneyCell(0),
    ],
    [
      textCell('Register value incl VAT', 'metaLabel'),
      registerValueInclVatRange && countsInRegisterTotalRange
        ? formulaCell(`SUMIF(${countsInRegisterTotalRange},"Yes",${registerValueInclVatRange})`, registerValueInclVatTotal(items), 'currency')
        : moneyCell(0),
    ],
    [
      textCell('Financed assets', 'metaLabel'),
      financeRange ? formulaCell(`COUNTIF(${financeRange},"Financed")`, countFinanced(items)) : numberCell(0),
    ],
    [
      textCell('Insured assets', 'metaLabel'),
      insuranceRange ? formulaCell(`COUNTIF(${insuranceRange},"Insured")`, countInsured(items)) : numberCell(0),
    ],
    [
      textCell('Insured value ex VAT', 'metaLabel'),
      insuredValueExVatRange
        ? formulaCell(`SUM(${insuredValueExVatRange})`, insuredValueTotal(items), 'currency')
        : moneyCell(0),
    ],
    [
      textCell('Insured value incl VAT', 'metaLabel'),
      insuredValueInclVatRange
        ? formulaCell(`SUM(${insuredValueInclVatRange})`, insuredValueInclVatTotal(items), 'currency')
        : moneyCell(0),
    ],
    [
      textCell('Licensed assets', 'metaLabel'),
      licenseRange ? formulaCell(`COUNTIF(${licenseRange},"Licensed")`, countLicensed(items)) : numberCell(0),
    ],
    [
      textCell('Replacement value ex VAT', 'metaLabel'),
      replacementValueExVatRange
        ? formulaCell(`SUM(${replacementValueExVatRange})`, replacementValueTotal(items), 'currency')
        : moneyCell(0),
    ],
    [
      textCell('Replacement value incl VAT', 'metaLabel'),
      replacementValueInclVatRange
        ? formulaCell(`SUM(${replacementValueInclVatRange})`, replacementValueInclVatTotal(items), 'currency')
        : moneyCell(0),
    ],
  ];
}

function buildWorkbookSheet(definition: SheetDefinition, profile: AccountProfileResult | null, generatedAt: Date): XlsxSheet {
  const ownerName = buildOwnerName(profile);
  const ownerAddress = buildOwnerAddress(profile);
  const ownerEmail = profile?.email?.trim() || '';
  const ownerPhone = profile?.phone?.trim() || '';
  const ownerVatNumber = profile?.vatNumber?.trim() || '';
  const rows: XlsxCellValue[][] = [
    [textCell('Aim4price Asset Register', 'title')],
    [textCell(definition.name, 'section')],
    [textCell(definition.description, 'subtitle')],
    [],
    [textCell('Export details', 'section')],
    [textCell('Generated', 'metaLabel'), { value: generatedAt, style: 'date' }],
    [textCell('Owner', 'metaLabel'), textOrNaCell(ownerName, 'metaValue')],
    [textCell('Address', 'metaLabel'), textOrNaCell(ownerAddress, 'metaValue')],
    [textCell('Business email', 'metaLabel'), textOrNaCell(ownerEmail, 'metaValue')],
    [textCell('Phone', 'metaLabel'), textOrNaCell(ownerPhone, 'metaValue')],
    [textCell('VAT number', 'metaLabel'), textOrNaCell(ownerVatNumber, 'metaValue')],
    [],
    [textCell('Export note', 'section')],
    [
      textCell(
        'Values and replacement prices are shown both excluding VAT and including VAT at 15%. This workbook is editable and intended for owners, financiers and insurance companies.',
        'subtitle',
      ),
    ],
    [
      textCell(
        'Indicative estimates only. Not a certified valuation, inspection report or guarantee of selling price.',
        'subtitle',
      ),
    ],
    [],
    [textCell('Workbook summary', 'section')],
    ...buildSummaryRows(definition.items),
    [],
    buildTableHeaderRow(),
    ...definition.items.map(buildAssetRow),
  ];

  return {
    name: definition.name,
    rows,
    columns: WORKBOOK_COLUMN_WIDTHS,
    merges: buildSheetMerges(),
    tabColor: definition.tabColor,
  };
}

function buildAssetGroupsWorkbookSheet(items: AssetRegisterItem[], generatedAt: Date): XlsxSheet | null {
  const groupedItems = orderGroupedExportAssets(items).filter((item) => Boolean(exportAssetGroup(item)));
  if (!groupedItems.length) return null;

  const groups = new Map<string, AssetRegisterItem[]>();
  groupedItems.forEach((item) => {
    const group = exportAssetGroup(item);
    if (!group) return;
    const current = groups.get(group.id) ?? [];
    current.push(item);
    groups.set(group.id, current);
  });

  const detailRows = Array.from(groups.values()).flatMap((members) => {
    const firstGroup = exportAssetGroup(members[0]);
    if (!firstGroup) return [];
    const countedGroupValue = registerValueTotal(members);

    return members.map((item, index) => {
      const group = exportAssetGroup(item)!;
      return [
        index === 0 ? textCell(group.name) : textCell(''),
        index === 0 ? textCell(assetGroupValueModeLabel(group)) : textCell(''),
        index === 0 ? numberCell(group.memberCount) : textCell(''),
        index === 0 ? moneyCell(countedGroupValue) : textCell(''),
        textOrNaCell(item.title),
        textCell(exportAssetGroupRoleLabel(item)),
        moneyCell(item.value),
        textCell(exportAssetCountsTowardRegisterTotal(item) ? 'Yes' : 'No'),
      ];
    });
  });

  return {
    name: 'Asset Groups',
    tabColor: '168660',
    columns: [30, 38, 12, 24, 34, 22, 22, 24],
    freezeRow: 7,
    autoFilter: {
      fromRow: 7,
      fromColumn: 1,
      toRow: 7 + detailRows.length,
      toColumn: 8,
    },
    rows: [
      [textCell('Aim4price Asset Groups', 'title')],
      [textCell('Umbrella structure and register-value treatment for grouped assets.', 'subtitle')],
      [],
      [textCell('Generated', 'metaLabel'), { value: generatedAt, style: 'date' }],
      [textCell('Accounting note', 'metaLabel'), textCell('Rows marked No remain fully tracked but are excluded from register totals according to the saved umbrella setting.', 'subtitle')],
      [],
      [
        textCell('Group name', 'tableHeader'),
        textCell('Value handling', 'tableHeader'),
        textCell('Members', 'tableHeader'),
        textCell('Counted group value ex VAT', 'tableHeader'),
        textCell('Asset', 'tableHeader'),
        textCell('Role', 'tableHeader'),
        textCell('Asset value ex VAT', 'tableHeader'),
        textCell('Counts in register total', 'tableHeader'),
      ],
      ...detailRows,
    ],
  };
}

function buildWorkbookSheets(items: AssetRegisterItem[], profile: AccountProfileResult | null, generatedAt = new Date()): XlsxSheet[] {
  const uniqueItems = orderGroupedExportAssets(dedupeAssetItems(items));
  const definitions: SheetDefinition[] = [
    {
      name: 'Full Asset Register',
      description: 'Complete editable register with every saved asset and key supporting fields.',
      items: uniqueItems,
      tabColor: '10382F',
    },
    {
      name: 'Financed Sheet',
      description: 'Only assets marked as financed. Useful for finance agreements, lender checks and offline updates.',
      items: uniqueItems.filter((item) => readFinanceStatusChoice(item) === 'yes'),
      tabColor: '355FBA',
    },
    {
      name: 'Insured Sheet',
      description: 'Only assets marked as insured. Useful for insurance schedules and policy reviews.',
      items: uniqueItems.filter((item) => readInsuranceStatusChoice(item) === 'yes'),
      tabColor: '0F6A46',
    },
    {
      name: 'Licensed Sheet',
      description: 'Only assets marked as licensed. Useful for roadworthy and compliance follow-ups.',
      items: uniqueItems.filter((item) => readLicenseStatusChoice(item) === 'yes'),
      tabColor: '0284C7',
    },
    {
      name: 'Not Financed Sheet',
      description: 'Only assets currently marked as not financed.',
      items: uniqueItems.filter((item) => readFinanceStatusChoice(item) === 'no'),
      tabColor: '8A6500',
    },
    {
      name: 'Not Insured Sheet',
      description: 'Only assets currently marked as not insured. Useful for finding insurance gaps quickly.',
      items: uniqueItems.filter((item) => readInsuranceStatusChoice(item) === 'no'),
      tabColor: 'A3271B',
    },
    {
      name: 'Not Licensed Sheet',
      description: 'Only assets currently marked as not licensed.',
      items: uniqueItems.filter((item) => readLicenseStatusChoice(item) === 'no'),
      tabColor: 'BA3B1D',
    },
  ];

  const groupSheet = buildAssetGroupsWorkbookSheet(uniqueItems, generatedAt);
  return [
    ...definitions.map((definition) => buildWorkbookSheet(definition, profile, generatedAt)),
    ...(groupSheet ? [groupSheet] : []),
  ];
}


const PDF_PAGE_WIDTH = 595.28;
const PDF_PAGE_HEIGHT = 841.89;
const PDF_MARGIN = 42;
const PDF_BOTTOM_MARGIN = 44;

type PdfFontKey = 'F1' | 'F2';

type PdfBuildState = {
  pages: string[][];
  y: number;
};

function formatPdfDate(value: Date): string {
  return value.toLocaleDateString('en-ZA', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}

function formatPdfMoney(value: unknown): string {
  const numeric = numericValue(value) ?? 0;
  const rounded = Math.round(numeric);
  const formatted = Math.abs(rounded).toLocaleString('en-ZA').replace(/,/g, ' ');
  return `${rounded < 0 ? '-' : ''}R ${formatted}`;
}

function pdfFileSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'asset-register';
}

function sanitizePdfText(value: unknown): string {
  return String(value ?? '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/•/g, '-')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapePdfText(value: unknown): string {
  return sanitizePdfText(value)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function pdfNumber(value: number): string {
  return Number.isFinite(value) ? value.toFixed(2).replace(/\.00$/, '') : '0';
}

function currentPdfPage(state: PdfBuildState): string[] {
  if (!state.pages.length) {
    state.pages.push([]);
  }

  return state.pages[state.pages.length - 1];
}

function addPdfPage(
  state: PdfBuildState,
  continued = false,
  continuedTitle = 'Full Asset Register continued',
  continuedSubtitle = 'Aim4price asset register PDF',
) {
  state.pages.push([]);
  state.y = PDF_PAGE_HEIGHT - PDF_MARGIN;

  if (continued) {
    drawPdfText(state, continuedTitle, PDF_MARGIN, state.y, 12, 'F2');
    drawPdfText(state, continuedSubtitle, PDF_PAGE_WIDTH - PDF_MARGIN - 176, state.y, 9, 'F1');
    state.y -= 22;
    drawPdfRule(state, state.y);
    state.y -= 18;
  }
}

function drawPdfText(state: PdfBuildState, text: unknown, x: number, y: number, size = 10, font: PdfFontKey = 'F1') {
  currentPdfPage(state).push(`BT /${font} ${pdfNumber(size)} Tf ${pdfNumber(x)} ${pdfNumber(y)} Td (${escapePdfText(text)}) Tj ET`);
}

function drawPdfRule(state: PdfBuildState, y: number) {
  currentPdfPage(state).push(`q 0.78 0.82 0.86 RG 0.7 w ${pdfNumber(PDF_MARGIN)} ${pdfNumber(y)} m ${pdfNumber(PDF_PAGE_WIDTH - PDF_MARGIN)} ${pdfNumber(y)} l S Q`);
}

function drawPdfRect(state: PdfBuildState, x: number, y: number, width: number, height: number, fill = '0.96 0.98 0.97') {
  currentPdfPage(state).push(`q ${fill} rg ${pdfNumber(x)} ${pdfNumber(y)} ${pdfNumber(width)} ${pdfNumber(height)} re f Q`);
  currentPdfPage(state).push(`q 0.80 0.87 0.83 RG 0.6 w ${pdfNumber(x)} ${pdfNumber(y)} ${pdfNumber(width)} ${pdfNumber(height)} re S Q`);
}

function ensurePdfSpace(
  state: PdfBuildState,
  requiredHeight: number,
  continuedTitle = 'Full Asset Register continued',
  continuedSubtitle = 'Aim4price asset register PDF',
) {
  if (state.y - requiredHeight < PDF_BOTTOM_MARGIN) {
    addPdfPage(state, true, continuedTitle, continuedSubtitle);
  }
}

function wrapPdfText(text: unknown, maxChars: number): string[] {
  const words = sanitizePdfText(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  words.forEach((word) => {
    if (word.length > maxChars) {
      if (current) {
        lines.push(current);
        current = '';
      }

      for (let index = 0; index < word.length; index += maxChars) {
        lines.push(word.slice(index, index + maxChars));
      }
      return;
    }

    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  });

  if (current) {
    lines.push(current);
  }

  return lines.length ? lines : ['-'];
}

function drawPdfWrappedText(state: PdfBuildState, text: unknown, x: number, maxWidth: number, size = 10, font: PdfFontKey = 'F1', lineHeight = 13): number {
  const maxChars = Math.max(16, Math.floor(maxWidth / (size * 0.54)));
  const lines = wrapPdfText(text, maxChars);

  lines.forEach((line) => {
    drawPdfText(state, line, x, state.y, size, font);
    state.y -= lineHeight;
  });

  return lines.length;
}

function drawPdfWrappedTextAt(state: PdfBuildState, text: unknown, x: number, y: number, maxWidth: number, size = 10, font: PdfFontKey = 'F1', lineHeight = 13): number {
  const maxChars = Math.max(16, Math.floor(maxWidth / (size * 0.54)));
  const lines = wrapPdfText(text, maxChars);

  lines.forEach((line, index) => {
    drawPdfText(state, line, x, y - index * lineHeight, size, font);
  });

  return lines.length;
}

function usagePdfLabel(item: AssetRegisterItem): string {
  const usage = usageDisplay(item);

  if (usage.value === null) {
    return usage.unit === 'percentage' ? 'N/A %' : 'N/A';
  }

  if (usage.unit === 'percentage') return `${usage.value}%`;
  if (usage.unit === 'km') return `${usage.value.toLocaleString('en-ZA')} km`;
  if (usage.unit === 'hours') return `${usage.value.toLocaleString('en-ZA')} hours`;
  return String(usage.value);
}

function statusPdfLabel(status: AssetStatusChoice, positiveLabel: string, negativeLabel: string): string {
  const normalized = normalizeAssetStatusChoice(status);

  if (normalized === 'yes') return positiveLabel;
  if (normalized === 'no') return negativeLabel;
  if (normalized === 'not_applicable') return 'N/A';
  return 'Unknown';
}

function assetModelPdfLabel(item: AssetRegisterItem): string {
  if (item.kind === 'property') {
    return `Size: ${propertySizeDisplay(item)}`;
  }

  return [item.brandName, item.modelName || item.typedModelName]
    .map((part) => cleanText(part))
    .filter(Boolean)
    .join(' ') || 'N/A';
}

function drawPdfKeyValue(state: PdfBuildState, label: string, value: string, x: number, y: number, width: number) {
  drawPdfText(state, label.toUpperCase(), x, y, 7.6, 'F2');
  const lines = wrapPdfText(value, Math.max(12, Math.floor(width / 5.2)));
  drawPdfText(state, lines[0] ?? '-', x, y - 13, 11, 'F2');
  if (lines[1]) {
    drawPdfText(state, lines[1], x, y - 26, 8.5, 'F1');
  }
}

function drawPdfSummaryCard(state: PdfBuildState, label: string, value: string, x: number, y: number, width: number) {
  drawPdfRect(state, x, y - 48, width, 48, '0.97 0.99 0.98');
  drawPdfText(state, label.toUpperCase(), x + 11, y - 17, 7.5, 'F2');
  drawPdfText(state, value, x + 11, y - 34, 13, 'F2');
}

function drawPdfReportMark(state: PdfBuildState, x: number, y: number): void {
  drawPdfRect(state, x, y - 46, 46, 46, '1 1 1');
  drawPdfText(state, 'A4P', x + 10, y - 24, 12, 'F2');
  drawPdfText(state, 'REPORT', x + 8, y - 36, 5.4, 'F1');
}

function buildPdfAssetLines(item: AssetRegisterItem, index: number): Array<{ text: string; font: PdfFontKey; size: number }> {
  const financeStatus = statusPdfLabel(readFinanceStatusChoice(item), 'Financed', 'Not financed');
  const insuranceStatus = statusPdfLabel(readInsuranceStatusChoice(item), 'Insured', 'Not insured');
  const licenseStatus = statusPdfLabel(readLicenseStatusChoice(item), 'Licensed', 'Not licensed');
  const registration = readLicenseRegistrationNumber(item);
  const year = item.yearModel ? String(item.yearModel) : 'N/A';
  const condition = conditionLabel(item.condition) || 'N/A';
  const serial = cleanText(item.serialNumber) || 'N/A';
  const docs = Array.isArray(item.documents) ? item.documents.length : 0;
  const replacementPrice = replacementPriceExVat(item);
  const insuredValue = insuredValueExVat(item);
  const isProperty = item.kind === 'property';
  const insuredValueSummary = insuredValue === null
    ? 'Insured value: N/A'
    : `Insured value: ${formatPdfMoney(insuredValue)} excl. VAT | ${formatPdfMoney(moneyInclVatTotal(insuredValue))} incl. VAT`;
  const replacementSummary = replacementPrice === null
    ? 'Replacement price: N/A'
    : `Replacement price: ${formatPdfMoney(replacementPrice)} excl. VAT | ${formatPdfMoney(moneyInclVatTotal(replacementPrice))} incl. VAT`;
  const group = exportAssetGroup(item);
  const groupLines: Array<{ text: string; font: PdfFontKey; size: number }> = group
    ? [{
        text: `Asset group: ${group.name} | ${exportAssetGroupRoleLabel(item)} | ${assetGroupValueModeLabel(group)} | Counts in register total: ${exportAssetCountsTowardRegisterTotal(item) ? 'Yes' : 'No'}`,
        font: 'F1',
        size: 8.8,
      }]
    : [];

  if (isProperty) {
    return [
      { text: `${index + 1}. ${cleanText(item.title) || 'Asset'}`, font: 'F2', size: 11.2 },
      { text: `${kindLabel(item)} | ${PROPERTY_YEAR_LABEL}: ${year} | Size: ${propertySizeDisplay(item)} | Condition: ${condition}`, font: 'F1', size: 9.2 },
      ...groupLines,
      { text: `Finance: ${financeStatus} | Insurance: ${insuranceStatus} | ${insuredValueSummary}`, font: 'F1', size: 9.2 },
      { text: `Register value: ${formatPdfMoney(item.value)} excl. VAT | ${formatPdfMoney(moneyInclVatTotal(item.value))} incl. VAT | ${replacementSummary} | Method: ${methodLabel(item.selectedMethod)} | Documents: ${docs ? `${docs} saved` : 'None'}`, font: 'F2', size: 9.2 },
    ];
  }

  return [
    { text: `${index + 1}. ${cleanText(item.title) || 'Asset'}`, font: 'F2', size: 11.2 },
    { text: `${kindLabel(item)} | ${assetModelPdfLabel(item)} | Year: ${year} | Usage: ${usagePdfLabel(item)} | Condition: ${condition}`, font: 'F1', size: 9.2 },
    ...groupLines,
    { text: `Serial/VIN: ${serial} | Finance: ${financeStatus} | Insurance: ${insuranceStatus} | ${insuredValueSummary} | License: ${licenseStatus}${registration ? ` (${registration})` : ''}`, font: 'F1', size: 9.2 },
    { text: `Register value: ${formatPdfMoney(item.value)} excl. VAT | ${formatPdfMoney(moneyInclVatTotal(item.value))} incl. VAT | ${replacementSummary} | Method: ${methodLabel(item.selectedMethod)} | Documents: ${docs ? `${docs} saved` : 'None'}`, font: 'F2', size: 9.2 },
  ];
}

function drawPdfAssetBlock(state: PdfBuildState, item: AssetRegisterItem, index: number) {
  const contentWidth = PDF_PAGE_WIDTH - PDF_MARGIN * 2 - 22;
  const rawLines = buildPdfAssetLines(item, index);
  const measuredLineCount = rawLines.reduce((count, line) => {
    const maxChars = Math.max(18, Math.floor(contentWidth / (line.size * 0.54)));
    return count + wrapPdfText(line.text, maxChars).length;
  }, 0);
  const blockHeight = 22 + measuredLineCount * 12.4;

  ensurePdfSpace(state, blockHeight + 10);

  const topY = state.y;
  drawPdfRect(state, PDF_MARGIN, topY - blockHeight, PDF_PAGE_WIDTH - PDF_MARGIN * 2, blockHeight, index % 2 === 0 ? '0.985 0.992 0.988' : '0.965 0.981 0.974');
  state.y -= 17;

  rawLines.forEach((line) => {
    drawPdfWrappedText(state, line.text, PDF_MARGIN + 12, contentWidth, line.size, line.font, 12.4);
  });

  state.y = topY - blockHeight - 9;
}

function drawPdfAssetGroupHeading(state: PdfBuildState, group: AssetGroupExportMeta, members: AssetRegisterItem[]) {
  const height = 48;
  ensurePdfSpace(state, height + 8);
  const topY = state.y;
  drawPdfRect(state, PDF_MARGIN, topY - height, PDF_PAGE_WIDTH - PDF_MARGIN * 2, height, '0.925 0.970 0.950');
  drawPdfText(state, group.name, PDF_MARGIN + 12, topY - 17, 11.5, 'F2');
  drawPdfText(
    state,
    `${group.memberCount} grouped assets | ${assetGroupValueModeLabel(group)} | Counted group value ${formatPdfMoney(registerValueTotal(members))} excl. VAT`,
    PDF_MARGIN + 12,
    topY - 33,
    8.2,
    'F1',
  );
  state.y = topY - height - 8;
}

function buildFullRegisterPdf(items: AssetRegisterItem[], profile: AccountProfileResult | null, generatedAt = new Date()): Buffer {
  const state: PdfBuildState = { pages: [], y: 0 };
  const uniqueItems = orderGroupedExportAssets(dedupeAssetItems(items));
  const ownerName = buildOwnerName(profile);
  const ownerAddress = buildOwnerAddress(profile) || 'N/A';
  const ownerEmail = cleanText(profile?.email) || 'N/A';
  const ownerPhone = cleanText(profile?.phone) || 'N/A';
  const registerValue = registerValueTotal(uniqueItems);
  const registerValueInclVat = registerValueInclVatTotal(uniqueItems);
  const replacementValue = replacementValueTotal(uniqueItems);
  const replacementValueInclVat = replacementValueInclVatTotal(uniqueItems);
  const insuredScheduleValue = insuredValueTotal(uniqueItems);
  const insuredScheduleValueInclVat = insuredValueInclVatTotal(uniqueItems);

  addPdfPage(state, false);

  drawPdfText(state, 'Aim4price', PDF_MARGIN, state.y, 13, 'F2');
  drawPdfText(state, 'Full Asset Register PDF', PDF_MARGIN, state.y - 28, 24, 'F2');
  drawPdfText(state, `Generated ${formatPdfDate(generatedAt)}`, PDF_PAGE_WIDTH - PDF_MARGIN - 145, state.y, 9, 'F1');
  state.y -= 56;
  drawPdfRule(state, state.y);
  state.y -= 24;

  const heroTop = state.y;
  drawPdfRect(state, PDF_MARGIN, heroTop - 88, PDF_PAGE_WIDTH - PDF_MARGIN * 2, 88, '0.955 0.980 0.970');
  drawPdfText(state, 'ASSET OWNER', PDF_MARGIN + 14, heroTop - 22, 8, 'F2');
  const ownerLineCount = drawPdfWrappedTextAt(state, ownerName, PDF_MARGIN + 14, heroTop - 43, 300, 17, 'F2', 19);
  drawPdfWrappedTextAt(state, ownerAddress, PDF_MARGIN + 14, heroTop - 45 - ownerLineCount * 18, 300, 8.8, 'F1', 11);
  drawPdfText(state, 'REGISTER VALUE', PDF_PAGE_WIDTH - PDF_MARGIN - 166, heroTop - 22, 8, 'F2');
  drawPdfText(state, `${formatPdfMoney(registerValue)} excl. VAT`, PDF_PAGE_WIDTH - PDF_MARGIN - 166, heroTop - 43, 12, 'F2');
  drawPdfText(state, `${formatPdfMoney(registerValueInclVat)} incl. VAT`, PDF_PAGE_WIDTH - PDF_MARGIN - 166, heroTop - 57, 8.5, 'F1');
  drawPdfText(state, 'REPLACEMENT VALUE', PDF_PAGE_WIDTH - PDF_MARGIN - 166, heroTop - 71, 8, 'F2');
  drawPdfText(state, `${formatPdfMoney(replacementValue)} excl. VAT`, PDF_PAGE_WIDTH - PDF_MARGIN - 166, heroTop - 84, 9.2, 'F2');
  state.y = heroTop - 108;

  const cardGap = 8;
  const cardWidth = (PDF_PAGE_WIDTH - PDF_MARGIN * 2 - cardGap * 3) / 4;
  drawPdfSummaryCard(state, 'Assets', String(uniqueItems.length), PDF_MARGIN, state.y, cardWidth);
  drawPdfSummaryCard(state, 'Replacement', formatPdfMoney(replacementValue), PDF_MARGIN + cardWidth + cardGap, state.y, cardWidth);
  drawPdfSummaryCard(state, 'Financed', String(countFinanced(uniqueItems)), PDF_MARGIN + (cardWidth + cardGap) * 2, state.y, cardWidth);
  drawPdfSummaryCard(state, 'Insured value', formatPdfMoney(insuredScheduleValue), PDF_MARGIN + (cardWidth + cardGap) * 3, state.y, cardWidth);
  state.y -= 66;

  drawPdfText(state, 'Owner details', PDF_MARGIN, state.y, 13, 'F2');
  state.y -= 18;
  const detailsTop = state.y;
  drawPdfRect(state, PDF_MARGIN, detailsTop - 52, PDF_PAGE_WIDTH - PDF_MARGIN * 2, 52, '0.98 0.99 1.00');
  drawPdfKeyValue(state, 'Business email', ownerEmail, PDF_MARGIN + 12, detailsTop - 14, 176);
  drawPdfKeyValue(state, 'Phone', ownerPhone, PDF_MARGIN + 205, detailsTop - 14, 126);
  drawPdfKeyValue(state, 'Insured incl VAT', formatPdfMoney(insuredScheduleValueInclVat), PDF_MARGIN + 350, detailsTop - 14, 130);
  state.y -= 74;

  drawPdfText(state, 'Asset list', PDF_MARGIN, state.y, 14, 'F2');
  state.y -= 18;

  if (uniqueItems.length) {
    let previousGroupId = '';
    uniqueItems.forEach((item, index) => {
      const group = exportAssetGroup(item);
      if (group && group.id !== previousGroupId) {
        drawPdfAssetGroupHeading(
          state,
          group,
          uniqueItems.filter((candidate) => exportAssetGroup(candidate)?.id === group.id),
        );
      }
      previousGroupId = group?.id ?? '';
      drawPdfAssetBlock(state, item, index);
    });
  } else {
    drawPdfText(state, 'No assets were saved in this register at export time.', PDF_MARGIN, state.y, 10, 'F1');
    state.y -= 18;
  }

  ensurePdfSpace(state, 72);
  drawPdfRule(state, state.y);
  state.y -= 18;
  drawPdfWrappedText(
    state,
    'Values are indicative Aim4price estimates based on replacement price, saved asset information, age, usage, condition and available asset inputs. Values exclude VAT unless stated otherwise. This is not a certified valuation, inspection report or guarantee of selling price.',
    PDF_MARGIN,
    PDF_PAGE_WIDTH - PDF_MARGIN * 2,
    8.2,
    'F1',
    10.8,
  );

  state.pages.forEach((page, index) => {
    page.push(`BT /F1 8 Tf ${pdfNumber(PDF_MARGIN)} ${pdfNumber(24)} Td (${escapePdfText('Powered by Aim4price.com')}) Tj ET`);
    page.push(`BT /F1 8 Tf ${pdfNumber(PDF_PAGE_WIDTH - PDF_MARGIN - 62)} ${pdfNumber(24)} Td (${escapePdfText(`Page ${index + 1} of ${state.pages.length}`)}) Tj ET`);
  });

  return createPdfBuffer(state.pages.map((commands) => commands.join('\n')));
}

function buildRegisterSummaryPdfSections(summary: RegisterBasicExportSummary): RegisterSummaryPdfSection[] {
  const row = (label: string, count: number, valueExVat: number) => ({
    label,
    count: String(count),
    valueExVat: formatPdfMoney(valueExVat),
    valueInclVat: formatPdfMoney(moneyInclVatTotal(valueExVat)),
  });

  return [
    {
      title: 'Register Values',
      rows: [
        row('Total assets', summary.totalAssets, summary.currentValueExVat),
        row('Replacement value', summary.replacementPricedAssets, summary.replacementValueExVat),
        row('Insured value', summary.assetsInsured, summary.insuredAssetsValueExVat),
        row('Financed value', summary.assetsFinanced, summary.financedValueExVat),
      ],
    },
    {
      title: 'Register Status Counts',
      rows: [
        row('Assets insured', summary.assetsInsured, summary.insuredAssetsValueExVat),
        row('Assets licensed', summary.assetsLicensed, summary.licensedValueExVat),
        row('Assets financed', summary.assetsFinanced, summary.financedValueExVat),
      ],
    },
    {
      title: 'Valuation Source',
      rows: [
        row('Aim4price assets', summary.aim4priceAssets.count, summary.aim4priceAssets.valueExVat),
        row('Manual assets', summary.manualAssets.count, summary.manualAssets.valueExVat),
      ],
    },
    {
      title: 'Asset Type Split',
      rows: [
        row('Property', summary.assetTypes.property.count, summary.assetTypes.property.valueExVat),
        row('Equipment', summary.assetTypes.equipment.count, summary.assetTypes.equipment.valueExVat),
        row('Tools', summary.assetTypes.tools.count, summary.assetTypes.tools.valueExVat),
        row('Stock', summary.assetTypes.stock.count, summary.assetTypes.stock.valueExVat),
        row('Vehicles', summary.assetTypes.vehicles.count, summary.assetTypes.vehicles.valueExVat),
      ],
    },
    {
      title: 'Supporting Information',
      hasValueColumn: false,
      rows: [
        { label: 'Assets mapped', count: String(summary.assetsMapped) },
        { label: 'Assets with photos', count: String(summary.assetsWithPhotos) },
        { label: 'Assets with documents', count: String(summary.assetsWithDocuments) },
      ],
    },
  ];
}


function renderRegisterSummaryReportSection(section: RegisterSummaryPdfSection): string {
  const hasValueColumn = section.hasValueColumn !== false;
  const rows = section.rows.length
    ? section.rows
        .map((row) => {
          if (!hasValueColumn) {
            return `
              <div class="assetReportSummaryRow">
                <span>${escapeHtml(row.label)}</span>
                <strong>${escapeHtml(row.count ?? '')}</strong>
              </div>
            `;
          }

          return `
            <div class="assetReportSummaryRow">
              <span>${escapeHtml(row.label)}</span>
              <strong>${escapeHtml(row.count ?? '')}</strong>
              <small>${escapeHtml(row.valueExVat ?? '')}</small>
              <b>${escapeHtml(row.valueInclVat ?? '')}</b>
            </div>
          `;
        })
        .join('')
    : `<div class="assetReportEmpty">No summary rows available.</div>`;

  return `
    <section class="assetReportSection assetReportSummarySection">
      <h2>${escapeHtml(section.title)}</h2>
      <div class="assetReportSummaryTable${hasValueColumn ? '' : ' assetReportSummaryTableCountOnly'}">
        <div class="assetReportSummaryHeader">
          <span>Metric</span>
          <span>Count</span>
          ${hasValueColumn ? '<span>Value excl. VAT</span><span>Value incl. VAT</span>' : ''}
        </div>
        ${rows}
      </div>
    </section>
  `;
}

async function renderRegisterSummaryReportHtml(
  items: AssetRegisterItem[],
  profile: AccountProfileResult | null,
  generatedAt: Date,
  requestUrl: string,
): Promise<string> {
  const summary = buildRegisterBasicExportSummary(items);
  const ownerName = buildOwnerName(profile);
  const ownerAddress = buildOwnerAddress(profile);
  const ownerEmail = cleanText(profile?.email || profile?.marketplaceEmail) || AIM4PRICE_REPORT_EMAIL;
  const logoUrl = await resolveReportLogoUrl(profile, requestUrl);
  const sections = buildRegisterSummaryPdfSections(summary);
  const generatedLabel = formatPdfDate(generatedAt);
  const registerValueExVat = formatPdfMoney(summary.currentValueExVat);
  const registerValueInclVat = formatPdfMoney(moneyInclVatTotal(summary.currentValueExVat));
  const safeTitle = escapeHtml(`${ownerName} - Asset Register Summary`);
  const heroMeta = ownerAddress || 'Selected Aim4price asset register';
  const footerDisclaimer =
    'This summary is calculated from grouped asset-register data saved in Aim4price at export time. It excludes individual asset rows, photos and asset-level valuation details. Values are shown excluding VAT and including VAT at 15%. This is not a certified valuation, inspection report or guarantee of selling price.';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeTitle}</title>
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
        size: A4;
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
        width: min(100%, 210mm);
        min-height: 297mm;
        margin: 18px auto;
        padding: 11mm 11mm 9mm;
        background: var(--paper);
        box-shadow: 0 16px 44px rgba(17, 24, 39, 0.13);
      }

      .assetReportInner {
        position: relative;
        min-height: calc(297mm - 20mm);
        padding-bottom: 20mm;
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
        font-size: 25px;
        line-height: 0.98;
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

      .assetReportValueMeta div {
        display: grid;
        grid-template-columns: 22mm minmax(0, 1fr);
        gap: 7px;
        min-height: 17px;
        align-items: baseline;
      }

      .assetReportValueMeta span {
        color: var(--muted);
        font-size: 8.2px;
        font-weight: 700;
      }

      .assetReportValueMeta strong {
        color: var(--strong);
        font-size: 8.3px;
        font-weight: 700;
        text-align: right;
        word-break: break-word;
      }

      .assetReportSummaryStack {
        display: grid;
        gap: 10px;
        margin-top: 12px;
      }

      .assetReportSection {
        break-inside: avoid;
        padding: 10px 11px 11px;
        border: 1px solid var(--line-strong);
        background: #ffffff;
      }

      .assetReportSection h2 {
        margin: 0 0 8px;
        color: var(--strong);
        font-size: 10.8px;
        line-height: 1.1;
        font-weight: 800;
        letter-spacing: -0.01em;
      }

      .assetReportSummaryTable {
        width: 100%;
        border-top: 1px solid var(--line);
      }

      .assetReportSummaryHeader,
      .assetReportSummaryRow {
        display: grid;
        grid-template-columns: minmax(0, 1.45fr) 17mm 35mm 35mm;
        gap: 8px;
        align-items: center;
        min-height: 19px;
        border-bottom: 1px solid var(--line);
      }

      .assetReportSummaryTableCountOnly .assetReportSummaryHeader,
      .assetReportSummaryTableCountOnly .assetReportSummaryRow {
        grid-template-columns: minmax(0, 1fr) 22mm;
      }

      .assetReportSummaryHeader {
        min-height: 17px;
        background: var(--soft-2);
      }

      .assetReportSummaryHeader span {
        color: var(--muted);
        font-size: 7.1px;
        line-height: 1.2;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .assetReportSummaryHeader span:nth-child(2),
      .assetReportSummaryRow strong {
        text-align: center;
      }

      .assetReportSummaryHeader span:nth-child(3),
      .assetReportSummaryHeader span:nth-child(4),
      .assetReportSummaryRow small,
      .assetReportSummaryRow b {
        text-align: right;
      }

      .assetReportSummaryRow span {
        color: #38404c;
        font-size: 8.5px;
        line-height: 1.3;
        font-weight: 600;
      }

      .assetReportSummaryRow strong,
      .assetReportSummaryRow small,
      .assetReportSummaryRow b {
        color: var(--strong);
        font-size: 8.7px;
        line-height: 1.3;
        font-weight: 700;
        word-break: break-word;
      }

      .assetReportSummaryRow small {
        color: var(--muted);
      }

      .assetReportEmpty {
        padding: 6px 0;
        color: var(--muted);
        font-size: 8.8px;
      }

      .assetReportFooter {
        position: absolute;
        right: 0;
        bottom: 0;
        left: 0;
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 10px;
        align-items: end;
        padding-top: 8px;
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
        .assetReportOverview {
          grid-template-columns: 1fr;
        }

        .assetReportValuationCard {
          border-left: 0;
          border-top: 1px solid var(--line-strong);
        }

        .assetReportHeaderMeta,
        .assetReportMetaLine strong,
        .assetReportValueMeta strong {
          text-align: left;
        }

        .assetReportSummaryHeader {
          display: none;
        }

        .assetReportSummaryRow {
          grid-template-columns: 1fr;
          gap: 2px;
          min-height: 0;
          padding: 5px 0;
        }

        .assetReportSummaryRow strong,
        .assetReportSummaryRow small,
        .assetReportSummaryRow b {
          text-align: left;
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
          height: 281mm;
          min-height: 0;
          margin: 0;
          padding: 0;
          box-shadow: none;
          overflow: hidden;
        }

        .assetReportInner {
          height: 281mm;
          min-height: 0;
          padding-bottom: 21mm;
        }

        .assetReportHeader {
          grid-template-columns: 22mm minmax(0, 1fr) 62mm;
        }

        .assetReportOverview {
          grid-template-columns: minmax(0, 1fr) 62mm;
        }
      }
    </style>
  </head>
  <body>
    <div class="assetReportScreenBar">
      <div class="assetReportScreenText">Save or print this asset register summary. In the print dialog, choose <strong>Save as PDF</strong>.</div>
      <div class="assetReportScreenActions">
        <button type="button" class="assetReportButton" onclick="window.close()">Close</button>
        <button type="button" class="assetReportButton assetReportButtonPrimary" onclick="window.print()">Save PDF / Print</button>
      </div>
    </div>

    <main class="assetReportPage">
      <div class="assetReportInner">
        <header class="assetReportHeader">
          <div class="assetReportLogoWrap">${logoUrl ? `<img class="assetReportLogo" src="${escapeHtml(logoUrl)}" alt="Aim4price logo" />` : ''}</div>
          <div class="assetReportDocumentTitle">
            <strong>Asset Register Summary</strong>
            <span>Aim4price asset register</span>
          </div>
          <div class="assetReportHeaderMeta">
            <div class="assetReportMetaLine"><span>Generated</span><strong>${escapeHtml(generatedLabel)}</strong></div>
            <div class="assetReportMetaLine"><span>Email</span><strong>${escapeHtml(ownerEmail)}</strong></div>
          </div>
        </header>

        <section class="assetReportOverview">
          <div class="assetReportIdentity">
            <p class="assetReportKicker">Asset Register Summary</p>
            <h1 class="assetReportTitle">${escapeHtml(ownerName)}</h1>
            <p class="assetReportMeta">${escapeHtml(heroMeta)}</p>
          </div>

          <aside class="assetReportValuationCard">
            <h2>Register Value</h2>
            <strong class="assetReportValue">${escapeHtml(registerValueExVat)}</strong>
            <span class="assetReportVat">VAT excluded</span>
            <div class="assetReportValueMeta">
              <div><span>Incl. VAT</span><strong>${escapeHtml(registerValueInclVat)}</strong></div>
              <div><span>Total assets</span><strong>${escapeHtml(String(summary.totalAssets))}</strong></div>
            </div>
          </aside>
        </section>

        <div class="assetReportSummaryStack">
          ${sections.map(renderRegisterSummaryReportSection).join('')}
        </div>

        <footer class="assetReportFooter">
          <div>
            <p class="assetReportPowered">Powered by Aim4price.com</p>
            <div class="assetReportDisclaimer">${escapeHtml(footerDisclaimer)}</div>
          </div>
          <div class="assetReportPageNumber">Page 1 of 1</div>
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


function parseRegisterIds(params: URLSearchParams): string[] {
  const combinedIds = cleanText(params.get('registerIds'));
  const legacyId = cleanText(params.get('registerId'));
  const rawValue = combinedIds || legacyId;

  if (!rawValue) return [];

  const seen = new Set<string>();
  const ids: string[] = [];

  rawValue.split(',').forEach((entry) => {
    const id = cleanText(entry);
    if (!id || seen.has(id)) return;
    seen.add(id);
    ids.push(id);
  });

  return ids;
}

const MAX_ASSET_EXPORT_IDS = 200;
const MAX_ASSET_EXPORT_ID_LENGTH = 128;
const ASSET_EXPORT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;

type RequestedAssetIds = {
  requested: boolean;
  ids: string[];
  error: 'invalid' | 'too_many' | null;
};

type OwnerAppExportAccess = {
  sessionKind: 'account' | 'owner-app-user';
};

function validateOwnerAppAssetSelection(
  access: OwnerAppExportAccess | null,
  selection: RequestedAssetIds,
  canAccessAsset: (assetId: string) => boolean,
): 'allowed' | 'asset_ids_required' | 'not_found' {
  if (access?.sessionKind !== 'owner-app-user') return 'allowed';
  if (!selection.requested) return 'asset_ids_required';
  return selection.ids.every(canAccessAsset) ? 'allowed' : 'not_found';
}

function parseRequestedAssetIds(params: URLSearchParams): RequestedAssetIds {
  if (!params.has('assetIds')) {
    return { requested: false, ids: [], error: null };
  }

  const seen = new Set<string>();
  const ids: string[] = [];
  const rawIds = params.getAll('assetIds').flatMap((value) => value.split(','));

  for (const rawId of rawIds) {
    const id = rawId.trim();

    if (!id || id.length > MAX_ASSET_EXPORT_ID_LENGTH || !ASSET_EXPORT_ID_PATTERN.test(id)) {
      return { requested: true, ids: [], error: 'invalid' };
    }

    if (seen.has(id)) continue;
    if (ids.length >= MAX_ASSET_EXPORT_IDS) {
      return { requested: true, ids: [], error: 'too_many' };
    }

    seen.add(id);
    ids.push(id);
  }

  if (!ids.length) {
    return { requested: true, ids: [], error: 'invalid' };
  }

  return { requested: true, ids, error: null };
}

function selectAuthorizedAssetIds(
  authorizedItems: Array<{ id: string }>,
  selection: RequestedAssetIds,
): Set<string> | null {
  const authorizedIds = new Set(authorizedItems.map((item) => item.id));

  if (!selection.requested) {
    return authorizedIds;
  }

  if (selection.error || selection.ids.some((id) => !authorizedIds.has(id))) {
    return null;
  }

  return new Set(selection.ids);
}

function requestedAssetsNotFound() {
  return NextResponse.json(
    { ok: false, error: 'One or more requested assets could not be found.' },
    { status: 404 },
  );
}

function registerContactLine(register: AssetRegisterSummary): string {
  return [register.phone, register.email, register.addressLine1]
    .map((part) => cleanText(part))
    .filter(Boolean)
    .join(' • ') || 'No contact details saved';
}

function registerSummaryAssets(register: AssetRegisterSummary, items: AssetRegisterItem[]): AssetRegisterItem[] {
  const uniqueItems = dedupeAssetItems(items);
  return uniqueItems.length || !register.assetCount ? uniqueItems : items;
}

function buildScopedExportProfile(
  profile: AccountProfileResult,
  scope: RegisterExportScope,
  registers: AssetRegisterSummary[],
  entityName: string,
): AccountProfileResult {
  const selectedRegister = scope === 'single' ? registers[0] ?? null : null;
  const selectedRegisterLogoUrl = selectedRegister ? getVisibleAssetRegisterLogoUrl(selectedRegister) : '';
  const exportEmail = selectedRegister?.email || profile.marketplaceEmail || profile.email || '';

  return {
    ...profile,
    businessName: entityName || selectedRegister?.businessName || profile.businessName,
    phone: selectedRegister?.phone || profile.phone,
    email: exportEmail,
    marketplaceEmail: exportEmail,
    logoUrl: selectedRegisterLogoUrl || profile.logoUrl,
    addressLine1: selectedRegister?.addressLine1 || profile.addressLine1,
    addressLine2: selectedRegister ? '' : profile.addressLine2,
  };
}

function buildDefaultScopedEntityName(scope: RegisterExportScope, registers: AssetRegisterSummary[]): string {
  if (scope === 'single' && registers[0]) return registers[0].businessName || 'Asset Register';
  if (scope === 'combined') return 'Combined Asset Registers';
  return 'All Asset Registers';
}

function buildScopedDescription(scope: RegisterExportScope, registers: AssetRegisterSummary[]): string {
  if (scope === 'single' && registers[0]) {
    return `Asset register export for ${registers[0].businessName}.`;
  }

  if (scope === 'combined') {
    return `Combined export for ${registers.length} selected asset registers.`;
  }

  return `Full export across ${registers.length} saved asset registers.`;
}

function flattenSourceAssetRows(bundles: RegisterExportBundle[]): SourceAssetRow[] {
  return bundles.flatMap((bundle) =>
    orderGroupedExportAssets(dedupeAssetItems(bundle.items)).map((item) => ({ register: bundle.register, item })),
  );
}

function buildSourceAssetHeaderRow(): XlsxCellValue[] {
  return [
    textCell('Source asset register', 'tableHeader'),
    ...TABLE_HEADERS.map((header) => textCell(header, 'tableHeader')),
  ];
}

function buildSourceAssetRow(row: SourceAssetRow, index: number): XlsxCellValue[] {
  const item = row.item;
  const usage = usageDisplay(item);
  const financeStatus = readFinanceStatusChoice(item);
  const insuranceStatus = readInsuranceStatusChoice(item);
  const licenseStatus = readLicenseStatusChoice(item);
  const insuredValue = insuredValueExVat(item);
  const replacementPrice = replacementPriceExVat(item);
  const isProperty = item.kind === 'property';
  const registerValue = numericValue(item.value);
  const group = exportAssetGroup(item);

  return [
    textOrNaCell(row.register.businessName),
    textOrNaCell(item.title),
    isProperty ? naCell() : textOrNaCell(item.serialNumber),
    numberCell(index + 1),
    textOrNaCell(kindLabel(item)),
    isProperty ? naCell() : textOrNaCell(item.brandName),
    isProperty ? textOrNaCell(`Size: ${propertySizeDisplay(item)}`) : textOrNaCell(item.modelName || item.typedModelName),
    item.yearModel ? numberCell(item.yearModel) : naCell(),
    isProperty ? naCell() : textOrNaCell(buildPlateOrQrCode(item)),
    isProperty ? naCell() : textOrNaCell(formatDrive(item.drive)),
    usage.value === null ? naCell() : numberCell(usage.value),
    textOrNaCell(usage.unit),
    textOrNaCell(conditionLabel(item.condition)),
    moneyCell(item.value),
    registerValue === null ? naCell() : moneyCell(moneyInclVatTotal(registerValue)),
    statusCellForChoice(financeStatus, 'Financed', 'Not financed'),
    textOrNaCell(item.financeNote, 'note'),
    statusCellForChoice(insuranceStatus, 'Insured', 'Not insured'),
    textOrNaCell(readInsuranceNote(item), 'note'),
    insuredValue === null ? naCell() : moneyCell(insuredValue),
    insuredValue === null ? naCell() : moneyCell(moneyInclVatTotal(insuredValue)),
    isProperty ? naCell() : statusCellForChoice(licenseStatus, 'Licensed', 'Not licensed'),
    !isProperty && licenseStatus === 'yes' ? textOrNaCell(readLicenseRegistrationNumber(item)) : naCell(),
    replacementPrice === null ? naCell() : moneyCell(replacementPrice),
    replacementPrice === null ? naCell() : moneyCell(moneyInclVatTotal(replacementPrice)),
    group ? textCell(group.name) : naCell(),
    group ? textCell(exportAssetGroupRoleLabel(item)) : naCell(),
    group ? textCell(assetGroupValueModeLabel(group)) : naCell(),
    textCell(exportAssetCountsTowardRegisterTotal(item) ? 'Yes' : 'No'),
  ];
}

function buildRegisterCollectionSummarySheet(
  bundles: RegisterExportBundle[],
  profile: AccountProfileResult,
  scope: RegisterExportScope,
  entityName: string,
  generatedAt: Date,
): XlsxSheet {
  const sourceRows = flattenSourceAssetRows(bundles);
  const allItems = sourceRows.map((row) => row.item);
  const registerValue = registerValueTotal(allItems);
  const registerValueInclVat = registerValueInclVatTotal(allItems);
  const replacementValue = replacementValueTotal(allItems);
  const replacementValueInclVat = replacementValueInclVatTotal(allItems);
  const summaryHeader = [
    textCell('Asset register', 'tableHeader'),
    textCell('Contact', 'tableHeader'),
    textCell('Assets', 'tableHeader'),
    textCell('Register value ex VAT', 'tableHeader'),
    textCell('Register value incl VAT', 'tableHeader'),
    textCell('Replacement value ex VAT', 'tableHeader'),
    textCell('Replacement value incl VAT', 'tableHeader'),
  ];
  const registerRows = bundles.map((bundle) => {
    const items = registerSummaryAssets(bundle.register, bundle.items);

    return [
      textOrNaCell(bundle.register.businessName),
      textOrNaCell(registerContactLine(bundle.register), 'metaValue'),
      numberCell(dedupeAssetItems(bundle.items).length || bundle.register.assetCount),
      moneyCell(registerValueTotal(items)),
      moneyCell(registerValueInclVatTotal(items)),
      moneyCell(replacementValueTotal(items)),
      moneyCell(replacementValueInclVatTotal(items)),
    ];
  });

  return {
    name: 'Register Summary',
    tabColor: '10382F',
    columns: [32, 44, 12, 22, 22, 26, 26],
    rows: [
      [textCell('Aim4price Asset Registers Export', 'title')],
      [textCell(entityName, 'section')],
      [textCell(buildScopedDescription(scope, bundles.map((bundle) => bundle.register)), 'subtitle')],
      [],
      [textCell('Export details', 'section')],
      [textCell('Generated', 'metaLabel'), { value: generatedAt, style: 'date' }],
      [textCell('Report name', 'metaLabel'), textOrNaCell(entityName, 'metaValue')],
      [textCell('Owner', 'metaLabel'), textOrNaCell(buildOwnerName(profile), 'metaValue')],
      [textCell('Included registers', 'metaLabel'), numberCell(bundles.length)],
      [textCell('Total assets', 'metaLabel'), numberCell(sourceRows.length)],
      [textCell('Register value ex VAT', 'metaLabel'), moneyCell(registerValue)],
      [textCell('Register value incl VAT', 'metaLabel'), moneyCell(registerValueInclVat)],
      [textCell('Replacement value ex VAT', 'metaLabel'), moneyCell(replacementValue)],
      [textCell('Replacement value incl VAT', 'metaLabel'), moneyCell(replacementValueInclVat)],
      [],
      [textCell('Included asset registers', 'section')],
      summaryHeader,
      ...registerRows,
      [],
      [textCell('Export note', 'section')],
      [
        textCell(
          'Values and replacement prices are shown both excluding VAT and including VAT at 15%. Each asset row in the Assets sheet includes its source asset register.',
          'subtitle',
        ),
      ],
      [
        textCell(
          'Indicative estimates only. Not a certified valuation, inspection report or guarantee of selling price.',
          'subtitle',
        ),
      ],
    ],
  };
}

function buildRegisterCollectionAssetsSheet(
  bundles: RegisterExportBundle[],
  scope: RegisterExportScope,
  entityName: string,
  generatedAt: Date,
): XlsxSheet {
  const sourceRows = flattenSourceAssetRows(bundles);
  const headerRow = 10;

  return {
    name: 'Assets',
    tabColor: '0F6A46',
    columns: [32, ...WORKBOOK_COLUMN_WIDTHS],
    freezeRow: headerRow,
    autoFilter: sourceRows.length
      ? {
          fromRow: headerRow,
          fromColumn: 1,
          toRow: headerRow + sourceRows.length,
          toColumn: TABLE_HEADERS.length + 1,
        }
      : undefined,
    rows: [
      [textCell('Aim4price Asset Registers Export', 'title')],
      [textCell(entityName, 'section')],
      [textCell(buildScopedDescription(scope, bundles.map((bundle) => bundle.register)), 'subtitle')],
      [],
      [textCell('Generated', 'metaLabel'), { value: generatedAt, style: 'date' }],
      [textCell('Included registers', 'metaLabel'), numberCell(bundles.length)],
      [textCell('Total assets', 'metaLabel'), numberCell(sourceRows.length)],
      [],
      [textCell('Asset rows', 'section')],
      buildSourceAssetHeaderRow(),
      ...sourceRows.map(buildSourceAssetRow),
    ],
  };
}

function safeSheetNameFragment(value: string, fallback: string): string {
  const cleaned = value
    .replace(/[\\/?*\[\]:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return (cleaned || fallback).slice(0, 31);
}

function buildRegisterSpecificCollectionSheet(
  bundle: RegisterExportBundle,
  profile: AccountProfileResult,
  generatedAt: Date,
  index: number,
): XlsxSheet {
  const registerName = cleanText(bundle.register.businessName) || `Asset Register ${index + 1}`;
  const sheetName = safeSheetNameFragment(`${index + 1}. ${registerName}`, `Register ${index + 1}`);
  const registerProfile = buildScopedExportProfile(profile, 'single', [bundle.register], registerName);

  return buildWorkbookSheet(
    {
      name: sheetName,
      description: `Complete editable asset register export for ${registerName}.`,
      items: dedupeAssetItems(bundle.items),
      tabColor: '10382F',
    },
    registerProfile,
    generatedAt,
  );
}

function buildRegisterCollectionWorkbookSheets(
  bundles: RegisterExportBundle[],
  profile: AccountProfileResult,
  scope: RegisterExportScope,
  entityName: string,
  generatedAt: Date,
): XlsxSheet[] {
  const groupSheet = buildAssetGroupsWorkbookSheet(
    bundles.flatMap((bundle) => bundle.items),
    generatedAt,
  );

  return [
    buildRegisterCollectionSummarySheet(bundles, profile, scope, entityName, generatedAt),
    buildRegisterCollectionAssetsSheet(bundles, scope, entityName, generatedAt),
    ...(groupSheet ? [groupSheet] : []),
    ...bundles.map((bundle, index) => buildRegisterSpecificCollectionSheet(bundle, profile, generatedAt, index)),
  ];
}

function drawPdfSourceAssetBlock(state: PdfBuildState, register: AssetRegisterSummary, item: AssetRegisterItem, index: number) {
  const contentWidth = PDF_PAGE_WIDTH - PDF_MARGIN * 2 - 22;
  const rawLines = [
    { text: `Source register: ${register.businessName}`, font: 'F2' as const, size: 8.8 },
    ...buildPdfAssetLines(item, index),
  ];
  const measuredLineCount = rawLines.reduce((count, line) => {
    const maxChars = Math.max(18, Math.floor(contentWidth / (line.size * 0.54)));
    return count + wrapPdfText(line.text, maxChars).length;
  }, 0);
  const blockHeight = 24 + measuredLineCount * 12.2;

  ensurePdfSpace(state, blockHeight + 10, 'Asset Registers export continued', 'Aim4price asset registers PDF');

  const topY = state.y;
  drawPdfRect(state, PDF_MARGIN, topY - blockHeight, PDF_PAGE_WIDTH - PDF_MARGIN * 2, blockHeight, index % 2 === 0 ? '0.985 0.992 0.988' : '0.965 0.981 0.974');
  state.y -= 17;

  rawLines.forEach((line) => {
    drawPdfWrappedText(state, line.text, PDF_MARGIN + 12, contentWidth, line.size, line.font, 12.2);
  });

  state.y = topY - blockHeight - 9;
}

function drawRegisterSummaryPdfRow(state: PdfBuildState, bundle: RegisterExportBundle) {
  const items = dedupeAssetItems(bundle.items);
  const height = 60;

  ensurePdfSpace(state, height + 8, 'Asset Registers export continued', 'Aim4price asset registers PDF');

  const topY = state.y;
  drawPdfRect(state, PDF_MARGIN, topY - height, PDF_PAGE_WIDTH - PDF_MARGIN * 2, height, '0.975 0.990 0.982');
  drawPdfWrappedTextAt(state, bundle.register.businessName, PDF_MARGIN + 12, topY - 17, 190, 11.2, 'F2', 13);
  drawPdfWrappedTextAt(state, registerContactLine(bundle.register), PDF_MARGIN + 12, topY - 34, 260, 8.2, 'F1', 10);
  drawPdfKeyValue(state, 'Assets', String(items.length || bundle.register.assetCount), PDF_MARGIN + 300, topY - 16, 60);
  drawPdfKeyValue(state, 'Register value', formatPdfMoney(registerValueTotal(items)), PDF_MARGIN + 372, topY - 16, 88);
  drawPdfKeyValue(state, 'Replacement', formatPdfMoney(replacementValueTotal(items)), PDF_MARGIN + 468, topY - 16, 78);
  state.y = topY - height - 8;
}

function buildAssetRegistersPdf(
  bundles: RegisterExportBundle[],
  profile: AccountProfileResult,
  scope: RegisterExportScope,
  entityName: string,
  generatedAt = new Date(),
): Buffer {
  const state: PdfBuildState = { pages: [], y: 0 };
  const sourceRows = flattenSourceAssetRows(bundles);
  const allItems = sourceRows.map((row) => row.item);
  const ownerName = buildOwnerName(profile);
  const ownerAddress = buildOwnerAddress(profile) || 'N/A';
  const registerValue = registerValueTotal(allItems);
  const registerValueInclVat = registerValueInclVatTotal(allItems);
  const replacementValue = replacementValueTotal(allItems);
  const replacementValueInclVat = replacementValueInclVatTotal(allItems);

  addPdfPage(state, false);

  drawPdfText(state, 'Aim4price', PDF_MARGIN, state.y, 13, 'F2');
  drawPdfText(state, 'Asset Registers Export', PDF_MARGIN, state.y - 28, 24, 'F2');
  drawPdfText(state, `Generated ${formatPdfDate(generatedAt)}`, PDF_PAGE_WIDTH - PDF_MARGIN - 145, state.y, 9, 'F1');
  state.y -= 56;
  drawPdfRule(state, state.y);
  state.y -= 24;

  const heroTop = state.y;
  drawPdfRect(state, PDF_MARGIN, heroTop - 96, PDF_PAGE_WIDTH - PDF_MARGIN * 2, 96, '0.955 0.980 0.970');
  drawPdfText(state, 'REPORT NAME', PDF_MARGIN + 14, heroTop - 22, 8, 'F2');
  const entityLineCount = drawPdfWrappedTextAt(state, entityName || ownerName, PDF_MARGIN + 14, heroTop - 43, 300, 17, 'F2', 19);
  drawPdfWrappedTextAt(state, ownerAddress, PDF_MARGIN + 14, heroTop - 45 - entityLineCount * 18, 300, 8.8, 'F1', 11);
  drawPdfText(state, 'REGISTER VALUE', PDF_PAGE_WIDTH - PDF_MARGIN - 166, heroTop - 22, 8, 'F2');
  drawPdfText(state, `${formatPdfMoney(registerValue)} excl. VAT`, PDF_PAGE_WIDTH - PDF_MARGIN - 166, heroTop - 43, 12, 'F2');
  drawPdfText(state, `${formatPdfMoney(registerValueInclVat)} incl. VAT`, PDF_PAGE_WIDTH - PDF_MARGIN - 166, heroTop - 57, 8.5, 'F1');
  drawPdfText(state, 'REPLACEMENT VALUE', PDF_PAGE_WIDTH - PDF_MARGIN - 166, heroTop - 75, 8, 'F2');
  drawPdfText(state, `${formatPdfMoney(replacementValue)} excl. VAT`, PDF_PAGE_WIDTH - PDF_MARGIN - 166, heroTop - 89, 9.2, 'F2');
  drawPdfText(state, `${formatPdfMoney(replacementValueInclVat)} incl. VAT`, PDF_PAGE_WIDTH - PDF_MARGIN - 166, heroTop - 101, 7.8, 'F1');
  state.y = heroTop - 118;

  const cardGap = 8;
  const cardWidth = (PDF_PAGE_WIDTH - PDF_MARGIN * 2 - cardGap * 3) / 4;
  drawPdfSummaryCard(state, 'Registers', String(bundles.length), PDF_MARGIN, state.y, cardWidth);
  drawPdfSummaryCard(state, 'Assets', String(sourceRows.length), PDF_MARGIN + cardWidth + cardGap, state.y, cardWidth);
  drawPdfSummaryCard(state, 'Register value', formatPdfMoney(registerValue), PDF_MARGIN + (cardWidth + cardGap) * 2, state.y, cardWidth);
  drawPdfSummaryCard(state, 'Replacement', formatPdfMoney(replacementValue), PDF_MARGIN + (cardWidth + cardGap) * 3, state.y, cardWidth);
  state.y -= 66;

  drawPdfText(state, 'Included asset registers', PDF_MARGIN, state.y, 14, 'F2');
  state.y -= 18;
  bundles.forEach((bundle) => drawRegisterSummaryPdfRow(state, bundle));

  ensurePdfSpace(state, 46, 'Asset Registers export continued', 'Aim4price asset registers PDF');
  drawPdfText(state, 'Asset list by source register', PDF_MARGIN, state.y, 14, 'F2');
  state.y -= 18;

  if (sourceRows.length) {
    let globalIndex = 0;

    bundles.forEach((bundle) => {
      const items = orderGroupedExportAssets(dedupeAssetItems(bundle.items));
      ensurePdfSpace(state, 48, 'Asset Registers export continued', 'Aim4price asset registers PDF');
      const sourceTop = state.y;
      drawPdfRect(state, PDF_MARGIN, sourceTop - 38, PDF_PAGE_WIDTH - PDF_MARGIN * 2, 38, '0.925 0.970 0.950');
      drawPdfText(state, bundle.register.businessName, PDF_MARGIN + 12, sourceTop - 15, 11.5, 'F2');
      drawPdfText(
        state,
        `${items.length} assets | Register value ${formatPdfMoney(registerValueTotal(items))} excl. VAT | Replacement ${formatPdfMoney(replacementValueTotal(items))} excl. VAT`,
        PDF_MARGIN + 12,
        sourceTop - 29,
        8.2,
        'F1',
      );
      state.y = sourceTop - 48;

      if (items.length) {
        let previousGroupId = '';
        items.forEach((item) => {
          const group = exportAssetGroup(item);
          if (group && group.id !== previousGroupId) {
            drawPdfAssetGroupHeading(
              state,
              group,
              items.filter((candidate) => exportAssetGroup(candidate)?.id === group.id),
            );
          }
          previousGroupId = group?.id ?? '';
          drawPdfSourceAssetBlock(state, bundle.register, item, globalIndex);
          globalIndex += 1;
        });
      } else {
        drawPdfText(state, 'No assets were saved in this register at export time.', PDF_MARGIN + 12, state.y, 9, 'F1');
        state.y -= 18;
      }
    });
  } else {
    drawPdfText(state, 'No assets were saved in the selected asset register(s) at export time.', PDF_MARGIN, state.y, 10, 'F1');
    state.y -= 18;
  }

  ensurePdfSpace(state, 72, 'Asset Registers export continued', 'Aim4price asset registers PDF');
  drawPdfRule(state, state.y);
  state.y -= 18;
  drawPdfWrappedText(
    state,
    'Values are indicative Aim4price estimates based on replacement price, saved asset information, age, usage, condition and available asset inputs. Values exclude VAT unless stated otherwise. This is not a certified valuation, inspection report or guarantee of selling price.',
    PDF_MARGIN,
    PDF_PAGE_WIDTH - PDF_MARGIN * 2,
    8.2,
    'F1',
    10.8,
  );

  state.pages.forEach((page, index) => {
    page.push(`BT /F1 8 Tf ${pdfNumber(PDF_MARGIN)} ${pdfNumber(24)} Td (${escapePdfText('Powered by Aim4price.com')}) Tj ET`);
    page.push(`BT /F1 8 Tf ${pdfNumber(PDF_PAGE_WIDTH - PDF_MARGIN - 62)} ${pdfNumber(24)} Td (${escapePdfText(`Page ${index + 1} of ${state.pages.length}`)}) Tj ET`);
  });

  return createPdfBuffer(state.pages.map((commands) => commands.join('\n')));
}

function createPdfBuffer(pageContents: string[]): Buffer {
  const objects: string[] = [];
  const addObject = (body: string) => {
    objects.push(body);
    return objects.length;
  };

  const catalogId = addObject('');
  const pagesId = addObject('');
  const regularFontId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const boldFontId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
  const pageIds: number[] = [];

  pageContents.forEach((content) => {
    const contentLength = Buffer.byteLength(content, 'utf8');
    const contentId = addObject(`<< /Length ${contentLength} >>\nstream\n${content}\nendstream`);
    const pageId = addObject(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PDF_PAGE_WIDTH} ${PDF_PAGE_HEIGHT}] /Resources << /Font << /F1 ${regularFontId} 0 R /F2 ${boldFontId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    pageIds.push(pageId);
  });

  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((pageId) => `${pageId} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;

  const chunks: string[] = ['%PDF-1.4\n'];
  const offsets: number[] = [0];
  let position = Buffer.byteLength(chunks[0], 'utf8');

  objects.forEach((body, index) => {
    const objectText = `${index + 1} 0 obj\n${body}\nendobj\n`;
    offsets.push(position);
    chunks.push(objectText);
    position += Buffer.byteLength(objectText, 'utf8');
  });

  const xrefOffset = position;
  const xrefRows = offsets
    .map((offset, index) => (index === 0 ? '0000000000 65535 f ' : `${String(offset).padStart(10, '0')} 00000 n `))
    .join('\n');
  const trailer = `xref\n0 ${objects.length + 1}\n${xrefRows}\ntrailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  chunks.push(trailer);
  return Buffer.from(chunks.join(''), 'utf8');
}

export async function GET(request: NextRequest) {
  const resolved = await resolveOwnerWorkspaceContext(request);
  if (!resolved.ok) return resolved.response;
  const workspace = resolved.context;
  const ownerUserId = workspace.ownerUserId;

  const params = new URL(request.url).searchParams;
  const format = params.get('format');
  if (format !== 'xlsx' && format !== 'pdf') {
    return NextResponse.json(
      { ok: false, error: 'Only PDF and XLSX exports are available on this endpoint.' },
      { status: 400 },
    );
  }
  const assetIdSelection = parseRequestedAssetIds(params);

  if (assetIdSelection.error) {
    return NextResponse.json(
      {
        ok: false,
        error: assetIdSelection.error === 'too_many'
          ? `Choose no more than ${MAX_ASSET_EXPORT_IDS} assets to export.`
          : 'Choose valid assets to export.',
      },
      { status: 400 },
    );
  }

  try {
    const ownerAppAccess = await getOwnerAppAccess();
    const ownerAppSelection = validateOwnerAppAssetSelection(
      ownerAppAccess,
      assetIdSelection,
      (assetId) => Boolean(ownerAppAccess && ownerAppCanAccessAsset(ownerAppAccess, assetId)),
    );

    if (ownerAppSelection === 'asset_ids_required') {
      return NextResponse.json(
        { ok: false, error: 'Choose the assets to export.' },
        { status: 400 },
      );
    }

    if (ownerAppSelection === 'not_found') {
      return requestedAssetsNotFound();
    }

    const profile = await getAccountProfile({
      id: ownerUserId,
      name: workspace.accountantAccess?.ownerName || workspace.actorName,
      email: workspace.accountantAccess ? '' : workspace.actorEmail,
    });

    if (!workspace.accountantAccess && profile.accountType !== 'owner') {
      return NextResponse.json({ ok: false, error: 'Asset Register export is only available to owner accounts.' }, { status: 403 });
    }

    const scopeParam = cleanText(params.get('scope')).toLowerCase();
    const isScopedExport = scopeParam === 'all' || scopeParam === 'single' || scopeParam === 'combined';

    if (scopeParam && !isScopedExport) {
      return NextResponse.json({ ok: false, error: 'Invalid asset register export scope.' }, { status: 400 });
    }

    const reportKind = cleanText(params.get('reportKind')).toLowerCase() || 'full';
    const requestedGroupId = cleanText(params.get('groupId'));

    if (reportKind !== 'full' && reportKind !== 'summary') {
      return NextResponse.json({ ok: false, error: 'Invalid asset register export type.' }, { status: 400 });
    }

    if (isScopedExport) {
      const scope = scopeParam as RegisterExportScope;
      const allRegisters = await listAssetRegisters(ownerUserId);
      const registerIds = parseRegisterIds(params);
      const registerById = new Map(allRegisters.map((register) => [register.id, register]));
      let selectedRegisters: AssetRegisterSummary[] = [];

      if (scope === 'all') {
        selectedRegisters = allRegisters;
      } else {
        if (scope === 'single' && registerIds.length !== 1) {
          return NextResponse.json({ ok: false, error: 'Choose one asset register to export.' }, { status: 400 });
        }

        if (scope === 'combined' && registerIds.length < 2) {
          return NextResponse.json({ ok: false, error: 'Choose at least two asset registers to combine.' }, { status: 400 });
        }

        const missingRegisterIds = registerIds.filter((registerId) => !registerById.has(registerId));
        if (missingRegisterIds.length) {
          return NextResponse.json({ ok: false, error: 'One or more requested asset registers could not be found for this account.' }, { status: 404 });
        }

        selectedRegisters = registerIds
          .map((registerId) => registerById.get(registerId))
          .filter((register): register is AssetRegisterSummary => Boolean(register));
      }

      if (!selectedRegisters.length) {
        return NextResponse.json({ ok: false, error: 'No asset registers were found to export.' }, { status: 404 });
      }

      const defaultEntityName = buildDefaultScopedEntityName(scope, selectedRegisters);
      const entityName = cleanText(params.get('entityName')).slice(0, 160) || defaultEntityName;
      const generatedAt = new Date();
      const filenameDate = generatedAt.toISOString().slice(0, 10);
      const exportProfile = buildScopedExportProfile(profile, scope, selectedRegisters, entityName);
      const [rawBundles, allGroups] = await Promise.all([
        Promise.all(selectedRegisters.map(async (register) => ({
          register,
          items: await listAssetRegisterItems(ownerUserId, register.id),
        }))),
        listAssetGroups(ownerUserId),
      ]);
      const requestedGroup = requestedGroupId
        ? allGroups.find((group) => group.id === requestedGroupId) ?? null
        : null;

      if (requestedGroupId && !requestedGroup) {
        return NextResponse.json({ ok: false, error: 'The requested umbrella could not be found.' }, { status: 404 });
      }

      const requestedGroupAssetIds = new Set(requestedGroup?.members.map((member) => member.assetId) ?? []);
      const scopedRawBundles = requestedGroup
        ? rawBundles
            .map((bundle) => ({
              ...bundle,
              items: bundle.items.filter((item) => requestedGroupAssetIds.has(item.id)),
            }))
            .filter((bundle) => bundle.items.length > 0)
        : rawBundles;

      if (requestedGroup && !scopedRawBundles.some((bundle) => bundle.items.length > 0)) {
        return NextResponse.json({ ok: false, error: 'No grouped assets from this umbrella are available in the selected Asset Register scope.' }, { status: 404 });
      }

      const selectedAssetIds = selectAuthorizedAssetIds(
        scopedRawBundles.flatMap((bundle) => bundle.items),
        assetIdSelection,
      );

      if (!selectedAssetIds) {
        return requestedAssetsNotFound();
      }

      const selectedRawBundles = assetIdSelection.requested
        ? scopedRawBundles
            .map((bundle) => ({
              ...bundle,
              items: bundle.items.filter((item) => selectedAssetIds.has(item.id)),
            }))
            .filter((bundle) => bundle.items.length > 0)
        : scopedRawBundles;
      const combinedAssets = selectedRawBundles.flatMap((bundle) => bundle.items);
      const combinedGroups = scope === 'combined'
        ? projectAssetGroupsToAssets(allGroups, combinedAssets)
        : [];
      const bundles: RegisterExportBundle[] = selectedRawBundles.map((bundle) => ({
        register: bundle.register,
        items: decorateAssetsWithGroups(
          bundle.items,
          scope === 'combined'
            ? combinedGroups
            : projectAssetGroupsToAssets(allGroups, bundle.items),
        ),
      }));
      const ownerSlug = pdfFileSlug(entityName || buildOwnerName(exportProfile));

      if (format === 'pdf') {
        if (reportKind === 'summary') {
          const summaryItems = bundles.flatMap((bundle) => registerSummaryAssets(bundle.register, bundle.items));
          const html = await renderRegisterSummaryReportHtml(summaryItems, exportProfile, generatedAt, request.url);
          const pdf = await renderReportHtmlToPdf(html, {
            baseUrl: request.url,
            cookie: request.headers.get('cookie') ?? '',
          });
          const fileName = `aim4price-register-summary-${ownerSlug}-${filenameDate}.pdf`;

          return new NextResponse(pdf, {
            status: 200,
            headers: {
              'Content-Type': 'application/pdf',
              'Content-Disposition': `inline; filename="${fileName}"`,
              'Content-Length': String(pdf.length),
              'Cache-Control': 'no-store',
            },
          });
        }

        const pdf = buildAssetRegistersPdf(bundles, exportProfile, scope, entityName, generatedAt);
        const fileName = `aim4price-asset-registers-${ownerSlug}-${filenameDate}.pdf`;

        return new NextResponse(pdf, {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename="${fileName}"`,
            'Content-Length': String(pdf.length),
            'Cache-Control': 'no-store',
          },
        });
      }

      const workbookSheets = reportKind === 'summary'
        ? buildRegisterSummaryWorkbookSheets(
            bundles.flatMap((bundle) => registerSummaryAssets(bundle.register, bundle.items)),
            exportProfile,
            generatedAt,
          )
        : scope === 'single'
          ? buildWorkbookSheets(dedupeAssetItems(bundles[0]?.items ?? []), exportProfile, generatedAt)
          : buildRegisterCollectionWorkbookSheets(bundles, exportProfile, scope, entityName, generatedAt);
      const workbook = createXlsxWorkbook(workbookSheets);
      const fileName = reportKind === 'summary'
        ? `aim4price-register-summary-${ownerSlug}-${filenameDate}.xlsx`
        : `aim4price-asset-registers-${ownerSlug}-${filenameDate}.xlsx`;

      return new NextResponse(workbook, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${fileName}"`,
          'Content-Length': String(workbook.length),
          'Cache-Control': 'no-store',
        },
      });
    }

    const requestedRegisterId = workspace.accountantAccess
      ? workspace.accountantAccess.registerId
      : String(params.get('registerId') ?? '').trim();
    const register = requestedRegisterId
      ? await getAssetRegisterForUser(ownerUserId, requestedRegisterId)
      : await getSelectedAssetRegister(ownerUserId);

    if (!register) {
      return NextResponse.json({ ok: false, error: 'Asset register not found.' }, { status: 404 });
    }

    const registerLogoUrl = getVisibleAssetRegisterLogoUrl(register);

    const exportProfile: AccountProfileResult = {
      ...profile,
      businessName: register.businessName || profile.businessName,
      phone: register.phone || profile.phone,
      email: register.email || profile.marketplaceEmail || profile.email || '',
      marketplaceEmail: register.email || profile.marketplaceEmail || profile.email || '',
      logoUrl: registerLogoUrl || profile.logoUrl,
      addressLine1: register.addressLine1 || profile.addressLine1,
      addressLine2: '',
    };

    const [rawItems, groups] = await Promise.all([
      listAssetRegisterItems(ownerUserId, register.id),
      listAssetGroups(ownerUserId, register.id),
    ]);
    const requestedGroup = requestedGroupId
      ? groups.find((group) => group.id === requestedGroupId) ?? null
      : null;

    if (requestedGroupId && !requestedGroup) {
      return NextResponse.json({ ok: false, error: 'The requested umbrella could not be found in this Asset Register.' }, { status: 404 });
    }

    const requestedGroupAssetIds = new Set(requestedGroup?.members.map((member) => member.assetId) ?? []);
    const scopedRawItems = requestedGroup
      ? rawItems.filter((item) => requestedGroupAssetIds.has(item.id))
      : rawItems;

    if (requestedGroup && !scopedRawItems.length) {
      return NextResponse.json({ ok: false, error: 'No grouped assets from this umbrella are available to export.' }, { status: 404 });
    }

    const selectedAssetIds = selectAuthorizedAssetIds(scopedRawItems, assetIdSelection);

    if (!selectedAssetIds) {
      return requestedAssetsNotFound();
    }

    const selectedRawItems = assetIdSelection.requested
      ? scopedRawItems.filter((item) => selectedAssetIds.has(item.id))
      : scopedRawItems;
    const items = decorateAssetsWithGroups(selectedRawItems, projectAssetGroupsToAssets(groups, selectedRawItems));
    const generatedAt = new Date();
    const filenameDate = generatedAt.toISOString().slice(0, 10);
    if (format === 'pdf') {
      const ownerSlug = pdfFileSlug(buildOwnerName(exportProfile));

      if (reportKind === 'summary') {
        const html = await renderRegisterSummaryReportHtml(items, exportProfile, generatedAt, request.url);
        const pdf = await renderReportHtmlToPdf(html, {
          baseUrl: request.url,
          cookie: request.headers.get('cookie') ?? '',
        });
        const fileName = `aim4price-register-summary-${ownerSlug}-${filenameDate}.pdf`;

        return new NextResponse(pdf, {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename="${fileName}"`,
            'Content-Length': String(pdf.length),
            'Cache-Control': 'no-store',
          },
        });
      }

      const pdf = buildFullRegisterPdf(items, exportProfile, generatedAt);
      const fileName = `aim4price-full-asset-register-${ownerSlug}-${filenameDate}.pdf`;

      return new NextResponse(pdf, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="${fileName}"`,
          'Content-Length': String(pdf.length),
          'Cache-Control': 'no-store',
        },
      });
    }

    const workbookSheets = reportKind === 'summary'
      ? buildRegisterSummaryWorkbookSheets(items, exportProfile, generatedAt)
      : buildWorkbookSheets(items, exportProfile, generatedAt);
    const workbook = createXlsxWorkbook(workbookSheets);
    const ownerSlug = pdfFileSlug(buildOwnerName(exportProfile));
    const fileName = reportKind === 'summary'
      ? `aim4price-register-summary-${ownerSlug}-${filenameDate}.xlsx`
      : `aim4price-full-asset-register-${ownerSlug}-${filenameDate}.xlsx`;

    return new NextResponse(workbook, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': String(workbook.length),
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('asset register export failed', error);
    return NextResponse.json({ ok: false, error: 'Failed to export the asset register.' }, { status: 500 });
  }
}
