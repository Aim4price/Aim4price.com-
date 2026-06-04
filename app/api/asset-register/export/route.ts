import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '../../../../lib/auth-session';
import { getAccountProfile } from '../../../../lib/account-profile';
import { listAssetRegisterItems, type AssetRegisterItem } from '../../../../lib/asset-register-db';
import { getAssetRegisterForUser, getSelectedAssetRegister } from '../../../../lib/asset-registers';
import { createXlsxWorkbook, type XlsxCellStyle, type XlsxCellValue, type XlsxSheet } from '../../../../lib/simple-xlsx';

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

type UsageDisplay = {
  value: number | null;
  unit: 'hours' | 'km' | 'percentage' | null;
};

const NA_VALUE = 'N/A';
const VAT_RATE = 0.15;
const VAT_MULTIPLIER = 1 + VAT_RATE;

const EXPORT_DETAILS_SECTION_ROW = 5;
const EXPORT_NOTE_SECTION_ROW = 13;
const EXPORT_NOTE_START_ROW = EXPORT_NOTE_SECTION_ROW + 1;
const SUMMARY_SECTION_ROW = 17;
const SUMMARY_ROW_COUNT = 12;
const TABLE_HEADER_ROW = SUMMARY_SECTION_ROW + 1 + SUMMARY_ROW_COUNT + 1;
const DATA_START_ROW = TABLE_HEADER_ROW + 1;

const REGISTER_VALUE_EX_VAT_COLUMN = 'M';
const REGISTER_VALUE_INCL_VAT_COLUMN = 'N';
const AIM4PRICE_VALUE_EX_VAT_COLUMN = 'O';
const AIM4PRICE_VALUE_INCL_VAT_COLUMN = 'P';
const MARKET_VALUE_EX_VAT_COLUMN = 'Q';
const MARKET_VALUE_INCL_VAT_COLUMN = 'R';
const FINANCE_STATUS_COLUMN = 'T';
const INSURANCE_STATUS_COLUMN = 'V';
const LICENSE_STATUS_COLUMN = 'X';
const REPLACEMENT_VALUE_EX_VAT_COLUMN = 'Z';
const REPLACEMENT_VALUE_INCL_VAT_COLUMN = 'AA';

const TABLE_HEADERS = [
  'Asset title',
  'Serial / VIN',
  'Asset #',
  'Asset type',
  'Brand',
  'Model / description',
  'Year model / built',
  'Plate / QR code',
  'Drive',
  'Usage value',
  'Usage unit',
  'Condition',
  'Register value ex VAT',
  'Register value incl VAT',
  'Aim4price value ex VAT',
  'Aim4price value incl VAT',
  'Market value ex VAT',
  'Market value incl VAT',
  'Selected method',
  'Finance status',
  'Finance notes',
  'Insurance status',
  'Insurance notes',
  'License status',
  'License registration',
  'Replacement price ex VAT',
  'Replacement price incl VAT',
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
  20,
  20,
  18,
  18,
  18,
  17,
  28,
  17,
  28,
  17,
  24,
  22,
  22,
];

function unauthorized() {
  return NextResponse.json({ ok: false, error: 'You must be signed in.' }, { status: 401 });
}

function cleanText(value: unknown): string {
  return String(value ?? '').trim();
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
    item.isInsured ? 'yes' : 'no',
  );
}

function readLicenseStatusChoice(item: AssetRegisterItem): AssetStatusChoice {
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

function methodLabel(value: AssetRegisterItem['selectedMethod']): string {
  return (
    {
      aim4price: 'Aim4price',
      market: 'Market',
      manual: 'Manual',
    }[value] ?? 'Manual'
  );
}

function kindLabel(asset: AssetRegisterItem): string {
  if (asset.equipmentFamilyLabel) return asset.equipmentFamilyLabel;
  if (asset.kind === 'tractor') return 'Tractor';
  if (asset.kind === 'equipment' || Boolean(asset.brandName && asset.modelName && asset.yearModel)) return 'Equipment';
  if (asset.kind === 'property') return 'Property/Buildings';
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
  const normalized = normalizedUsageMetric(item);
  const lifeWorkedPercent = numericValue(item.lifeWorkedPercent);

  if (
    ['percent', 'percentage', '%', 'percent_used', 'percent used', 'life_worked_percent', 'life worked percent'].includes(
      normalized,
    )
  ) {
    return {
      value: lifeWorkedPercent === null ? null : Math.round(lifeWorkedPercent),
      unit: 'percentage',
    };
  }

  const hours = numericValue(item.hours);
  if (hours !== null && hours > 0) {
    return { value: Math.round(hours), unit: item.kind === 'vehicle' ? 'km' : 'hours' };
  }

  if (lifeWorkedPercent !== null) {
    return { value: Math.round(lifeWorkedPercent), unit: 'percentage' };
  }

  const estimatedHours = numericValue(item.estimatedHours);
  if (estimatedHours !== null && estimatedHours > 0) {
    return { value: Math.round(estimatedHours), unit: item.kind === 'vehicle' ? 'km' : 'hours' };
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

function registerValueTotal(items: AssetRegisterItem[]): number {
  return items.reduce((sum, item) => sum + Math.round(numericValue(item.value) ?? 0), 0);
}

function registerValueInclVatTotal(items: AssetRegisterItem[]): number {
  return items.reduce((sum, item) => sum + moneyInclVatTotal(item.value), 0);
}

function replacementValueTotal(items: AssetRegisterItem[]): number {
  return items.reduce((sum, item) => sum + Math.round(replacementPriceExVat(item) ?? 0), 0);
}

function replacementValueInclVatTotal(items: AssetRegisterItem[]): number {
  return items.reduce((sum, item) => sum + moneyInclVatTotal(replacementPriceExVat(item)), 0);
}

function aim4priceValueTotal(items: AssetRegisterItem[]): number {
  return items.reduce((sum, item) => sum + Math.round(numericValue(item.aim4priceValueExVat) ?? 0), 0);
}

function aim4priceValueInclVatTotal(items: AssetRegisterItem[]): number {
  return items.reduce((sum, item) => sum + moneyInclVatTotal(item.aim4priceValueExVat), 0);
}

function marketValueTotal(items: AssetRegisterItem[]): number {
  return items.reduce((sum, item) => sum + Math.round(numericValue(item.marketMidExVat) ?? 0), 0);
}

function marketValueInclVatTotal(items: AssetRegisterItem[]): number {
  return items.reduce((sum, item) => sum + moneyInclVatTotal(item.marketMidExVat), 0);
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
  const aim4priceValue = numericValue(item.aim4priceValueExVat);
  const marketValue = numericValue(item.marketMidExVat);
  const financeStatus = readFinanceStatusChoice(item);
  const insuranceStatus = readInsuranceStatusChoice(item);
  const licenseStatus = readLicenseStatusChoice(item);
  const replacementPrice = replacementPriceExVat(item);

  return [
    textOrNaCell(item.title),
    textOrNaCell(item.serialNumber),
    numberCell(index + 1),
    textOrNaCell(kindLabel(item)),
    textOrNaCell(item.brandName),
    textOrNaCell(item.modelName || item.typedModelName),
    item.yearModel ? numberCell(item.yearModel) : naCell(),
    textOrNaCell(buildPlateOrQrCode(item)),
    textOrNaCell(formatDrive(item.drive)),
    usage.value === null ? naCell() : numberCell(usage.value),
    textOrNaCell(usage.unit),
    textOrNaCell(conditionLabel(item.condition)),
    moneyCell(item.value),
    vatIncludedFormulaCell(REGISTER_VALUE_EX_VAT_COLUMN, rowNumber, item.value),
    aim4priceValue === null ? naCell() : moneyCell(aim4priceValue),
    aim4priceValue === null ? naCell() : vatIncludedFormulaCell(AIM4PRICE_VALUE_EX_VAT_COLUMN, rowNumber, aim4priceValue),
    marketValue === null ? naCell() : moneyCell(marketValue),
    marketValue === null ? naCell() : vatIncludedFormulaCell(MARKET_VALUE_EX_VAT_COLUMN, rowNumber, marketValue),
    textOrNaCell(methodLabel(item.selectedMethod)),
    statusCellForChoice(financeStatus, 'Financed', 'Not financed'),
    textOrNaCell(item.financeNote, 'note'),
    statusCellForChoice(insuranceStatus, 'Insured', 'Not insured'),
    textOrNaCell(readInsuranceNote(item), 'note'),
    statusCellForChoice(licenseStatus, 'Licensed', 'Not licensed'),
    licenseStatus === 'yes' ? textOrNaCell(readLicenseRegistrationNumber(item)) : naCell(),
    replacementPrice === null ? naCell() : moneyCell(replacementPrice),
    replacementPrice === null ? naCell() : vatIncludedFormulaCell(REPLACEMENT_VALUE_EX_VAT_COLUMN, rowNumber, replacementPrice),
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
  const aim4priceValueExVatRange = buildFormulaRange(AIM4PRICE_VALUE_EX_VAT_COLUMN, items.length);
  const aim4priceValueInclVatRange = buildFormulaRange(AIM4PRICE_VALUE_INCL_VAT_COLUMN, items.length);
  const marketValueExVatRange = buildFormulaRange(MARKET_VALUE_EX_VAT_COLUMN, items.length);
  const marketValueInclVatRange = buildFormulaRange(MARKET_VALUE_INCL_VAT_COLUMN, items.length);
  const financeRange = buildFormulaRange(FINANCE_STATUS_COLUMN, items.length);
  const insuranceRange = buildFormulaRange(INSURANCE_STATUS_COLUMN, items.length);
  const licenseRange = buildFormulaRange(LICENSE_STATUS_COLUMN, items.length);
  const replacementValueExVatRange = buildFormulaRange(REPLACEMENT_VALUE_EX_VAT_COLUMN, items.length);
  const replacementValueInclVatRange = buildFormulaRange(REPLACEMENT_VALUE_INCL_VAT_COLUMN, items.length);

  return [
    [
      textCell('Total assets', 'metaLabel'),
      items.length > 0 ? formulaCell(`COUNTA(A${DATA_START_ROW}:A${DATA_START_ROW + items.length - 1})`, items.length) : numberCell(0),
    ],
    [
      textCell('Register value ex VAT', 'metaLabel'),
      registerValueExVatRange ? formulaCell(`SUM(${registerValueExVatRange})`, registerValueTotal(items), 'currency') : moneyCell(0),
    ],
    [
      textCell('Register value incl VAT', 'metaLabel'),
      registerValueInclVatRange
        ? formulaCell(`SUM(${registerValueInclVatRange})`, registerValueInclVatTotal(items), 'currency')
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
      textCell('Licensed assets', 'metaLabel'),
      licenseRange ? formulaCell(`COUNTIF(${licenseRange},"Licensed")`, countLicensed(items)) : numberCell(0),
    ],
    [
      textCell('Aim4price values ex VAT', 'metaLabel'),
      aim4priceValueExVatRange
        ? formulaCell(`SUM(${aim4priceValueExVatRange})`, aim4priceValueTotal(items), 'currency')
        : moneyCell(0),
    ],
    [
      textCell('Aim4price values incl VAT', 'metaLabel'),
      aim4priceValueInclVatRange
        ? formulaCell(`SUM(${aim4priceValueInclVatRange})`, aim4priceValueInclVatTotal(items), 'currency')
        : moneyCell(0),
    ],
    [
      textCell('Market values ex VAT', 'metaLabel'),
      marketValueExVatRange ? formulaCell(`SUM(${marketValueExVatRange})`, marketValueTotal(items), 'currency') : moneyCell(0),
    ],
    [
      textCell('Market values incl VAT', 'metaLabel'),
      marketValueInclVatRange
        ? formulaCell(`SUM(${marketValueInclVatRange})`, marketValueInclVatTotal(items), 'currency')
        : moneyCell(0),
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
    [textCell('Email', 'metaLabel'), textOrNaCell(ownerEmail, 'metaValue')],
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

function buildWorkbookSheets(items: AssetRegisterItem[], profile: AccountProfileResult | null, generatedAt = new Date()): XlsxSheet[] {
  const uniqueItems = dedupeAssetItems(items);
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

  return definitions.map((definition) => buildWorkbookSheet(definition, profile, generatedAt));
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

function addPdfPage(state: PdfBuildState, continued = false) {
  state.pages.push([]);
  state.y = PDF_PAGE_HEIGHT - PDF_MARGIN;

  if (continued) {
    drawPdfText(state, 'Full Asset Register continued', PDF_MARGIN, state.y, 12, 'F2');
    drawPdfText(state, 'Aim4price asset register PDF', PDF_PAGE_WIDTH - PDF_MARGIN - 160, state.y, 9, 'F1');
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

function ensurePdfSpace(state: PdfBuildState, requiredHeight: number) {
  if (state.y - requiredHeight < PDF_BOTTOM_MARGIN) {
    addPdfPage(state, true);
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
  const replacementSummary = replacementPrice === null
    ? 'Replacement price: N/A'
    : `Replacement price: ${formatPdfMoney(replacementPrice)} excl. VAT | ${formatPdfMoney(moneyInclVatTotal(replacementPrice))} incl. VAT`;

  return [
    { text: `${index + 1}. ${cleanText(item.title) || 'Asset'}`, font: 'F2', size: 11.2 },
    { text: `${kindLabel(item)} | ${assetModelPdfLabel(item)} | Year: ${year} | Usage: ${usagePdfLabel(item)} | Condition: ${condition}`, font: 'F1', size: 9.2 },
    { text: `Serial/VIN: ${serial} | Finance: ${financeStatus} | Insurance: ${insuranceStatus} | License: ${licenseStatus}${registration ? ` (${registration})` : ''}`, font: 'F1', size: 9.2 },
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

function buildFullRegisterPdf(items: AssetRegisterItem[], profile: AccountProfileResult | null, generatedAt = new Date()): Buffer {
  const state: PdfBuildState = { pages: [], y: 0 };
  const uniqueItems = dedupeAssetItems(items);
  const ownerName = buildOwnerName(profile);
  const ownerAddress = buildOwnerAddress(profile) || 'N/A';
  const ownerEmail = cleanText(profile?.email) || 'N/A';
  const ownerPhone = cleanText(profile?.phone) || 'N/A';
  const registerValue = registerValueTotal(uniqueItems);
  const registerValueInclVat = registerValueInclVatTotal(uniqueItems);
  const replacementValue = replacementValueTotal(uniqueItems);
  const replacementValueInclVat = replacementValueInclVatTotal(uniqueItems);

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
  drawPdfSummaryCard(state, 'Insured', String(countInsured(uniqueItems)), PDF_MARGIN + (cardWidth + cardGap) * 3, state.y, cardWidth);
  state.y -= 66;

  drawPdfText(state, 'Owner details', PDF_MARGIN, state.y, 13, 'F2');
  state.y -= 18;
  const detailsTop = state.y;
  drawPdfRect(state, PDF_MARGIN, detailsTop - 52, PDF_PAGE_WIDTH - PDF_MARGIN * 2, 52, '0.98 0.99 1.00');
  drawPdfKeyValue(state, 'Email', ownerEmail, PDF_MARGIN + 12, detailsTop - 14, 176);
  drawPdfKeyValue(state, 'Phone', ownerPhone, PDF_MARGIN + 205, detailsTop - 14, 126);
  drawPdfKeyValue(state, 'Replacement incl VAT', formatPdfMoney(replacementValueInclVat), PDF_MARGIN + 350, detailsTop - 14, 130);
  state.y -= 74;

  drawPdfText(state, 'Asset list', PDF_MARGIN, state.y, 14, 'F2');
  state.y -= 18;

  if (uniqueItems.length) {
    uniqueItems.forEach((item, index) => drawPdfAssetBlock(state, item, index));
  } else {
    drawPdfText(state, 'No assets were saved in this register at export time.', PDF_MARGIN, state.y, 10, 'F1');
    state.y -= 18;
  }

  ensurePdfSpace(state, 72);
  drawPdfRule(state, state.y);
  state.y -= 18;
  drawPdfWrappedText(
    state,
    'Values are indicative estimates based on saved Aim4price asset-register information and available pricing inputs. Values exclude VAT unless stated otherwise. This is not a certified valuation, inspection report or guarantee of selling price. Final values remain subject to physical inspection, documents, attachments, condition, location and live market demand.',
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
  const session = await getServerSession();

  if (!session?.user?.id) {
    return unauthorized();
  }

  const params = new URL(request.url).searchParams;
  const format = params.get('format');
  if (format !== 'xlsx' && format !== 'pdf') {
    return NextResponse.json(
      { ok: false, error: 'Only PDF and XLSX exports are available on this endpoint.' },
      { status: 400 },
    );
  }

  try {
    const profile = await getAccountProfile({
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
    });

    if (profile.accountType !== 'owner') {
      return NextResponse.json({ ok: false, error: 'Asset Register export is only available to owner accounts.' }, { status: 403 });
    }

    const requestedRegisterId = String(params.get('registerId') ?? '').trim();
    const register = requestedRegisterId
      ? await getAssetRegisterForUser(session.user.id, requestedRegisterId)
      : await getSelectedAssetRegister(session.user.id);

    if (!register) {
      return NextResponse.json({ ok: false, error: 'Asset register not found.' }, { status: 404 });
    }

    const registerLogoUrl = register.showLogosOnRegister !== false && Array.isArray(register.logoUrls)
      ? cleanText(register.logoUrls[0])
      : '';

    const exportProfile: AccountProfileResult = {
      ...profile,
      businessName: register.businessName || profile.businessName,
      phone: register.phone || profile.phone,
      email: register.email || profile.email,
      logoUrl: registerLogoUrl || profile.logoUrl,
      addressLine1: register.addressLine1 || profile.addressLine1,
      addressLine2: '',
    };

    const items = await listAssetRegisterItems(session.user.id, register.id);
    const generatedAt = new Date();
    const filenameDate = generatedAt.toISOString().slice(0, 10);

    if (format === 'pdf') {
      const reportKind = params.get('reportKind') || 'full';
      if (reportKind !== 'full') {
        return NextResponse.json({ ok: false, error: 'Only the full Asset Register PDF is available from this endpoint.' }, { status: 400 });
      }

      const pdf = buildFullRegisterPdf(items, exportProfile, generatedAt);
      const ownerSlug = pdfFileSlug(buildOwnerName(exportProfile));
      const fileName = `aim4price-full-asset-register-${ownerSlug}-${filenameDate}.pdf`;

      return new NextResponse(pdf, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${fileName}"`,
          'Content-Length': String(pdf.length),
          'Cache-Control': 'no-store',
        },
      });
    }

    const workbook = createXlsxWorkbook(buildWorkbookSheets(items, exportProfile, generatedAt));
    const ownerSlug = pdfFileSlug(buildOwnerName(exportProfile));
    const fileName = `aim4price-full-asset-register-${ownerSlug}-${filenameDate}.xlsx`;

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
