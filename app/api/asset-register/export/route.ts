import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '../../../../lib/auth-session';
import { getAccountProfile } from '../../../../lib/account-profile';
import { listAssetRegisterItems, type AssetRegisterItem } from '../../../../lib/asset-register-db';
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
const SUMMARY_ROW_COUNT = 10;
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
        'Values are shown both excluding VAT and including VAT at 15%. This workbook is editable and intended for owners, financiers and insurance companies.',
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

function buildWorkbookSheets(items: AssetRegisterItem[], profile: AccountProfileResult | null): XlsxSheet[] {
  const generatedAt = new Date();
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

export async function GET(request: NextRequest) {
  const session = await getServerSession();

  if (!session?.user?.id) {
    return unauthorized();
  }

  const format = new URL(request.url).searchParams.get('format');

  if (format !== 'xlsx') {
    return NextResponse.json(
      { ok: false, error: 'Only XLSX export is available on this endpoint.' },
      { status: 400 },
    );
  }

  try {
    const items = await listAssetRegisterItems(session.user.id);

    let profile: AccountProfileResult | null = null;
    try {
      profile = await getAccountProfile({
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
      });
    } catch (profileError) {
      console.error('asset register export profile lookup failed', profileError);
    }

    const workbook = createXlsxWorkbook(buildWorkbookSheets(items, profile));
    const filenameDate = new Date().toISOString().slice(0, 10);
    const fileName = `aim4price-full-asset-register-${filenameDate}.xlsx`;

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
