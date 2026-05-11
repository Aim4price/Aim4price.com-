import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '../../../../lib/auth-session';
import { getAccountProfile } from '../../../../lib/account-profile';
import { listAssetRegisterItems, type AssetRegisterItem } from '../../../../lib/asset-register-db';
import { createXlsxWorkbook, type XlsxCellStyle, type XlsxCellValue, type XlsxSheet } from '../../../../lib/simple-xlsx';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type AccountProfileResult = Awaited<ReturnType<typeof getAccountProfile>>;

type SheetDefinition = {
  name: string;
  description: string;
  items: AssetRegisterItem[];
  tabColor: string;
};

const TABLE_HEADER_ROW = 11;
const DATA_START_ROW = TABLE_HEADER_ROW + 1;
const TABLE_COLUMN_COUNT = 31;

const CURRENCY_COLUMN = 'V';
const FINANCE_STATUS_COLUMN = 'Q';
const INSURANCE_STATUS_COLUMN = 'S';
const DOCUMENTS_COUNT_COLUMN = 'T';

const TABLE_HEADERS = [
  'Asset #',
  'Asset title',
  'Asset type',
  'Brand',
  'Model / description',
  'Year model / built',
  'Serial / VIN',
  'Plate / QR code',
  'Tractor type',
  'Drive',
  'Cab',
  'Power kW',
  'Usage value',
  'Usage unit',
  'Life worked %',
  'Condition',
  'Finance status',
  'Finance notes',
  'Insurance status',
  'Documents count',
  'Documents',
  'Register value ex VAT',
  'Aim4price value ex VAT',
  'Market value ex VAT',
  'Selected method',
  'Last scanned',
  'Last known location',
  'Fuel %',
  'Notes',
  'Created',
  'Updated',
] as const;

const WORKBOOK_COLUMN_WIDTHS = [
  9,
  34,
  22,
  18,
  30,
  15,
  18,
  18,
  15,
  12,
  14,
  11,
  13,
  12,
  13,
  18,
  17,
  28,
  17,
  16,
  32,
  18,
  20,
  18,
  18,
  15,
  28,
  12,
  34,
  15,
  15,
];

const EXPORT_DISCLAIMER =
  'Values are indicative estimates based on saved Aim4price asset-register information and available pricing inputs. Values exclude VAT unless stated otherwise. This spreadsheet is intended as an editable offline asset register for owners, financiers and insurance companies. It is not a certified valuation, inspection report or guarantee of selling price.';

function unauthorized() {
  return NextResponse.json({ ok: false, error: 'You must be signed in.' }, { status: 401 });
}

function textCell(value: unknown, style: XlsxCellStyle = 'text'): XlsxCellValue {
  return { value: String(value ?? '').trim(), style };
}

function numberCell(value: unknown, style: 'integer' | 'decimal' = 'integer'): XlsxCellValue {
  const numeric = Number(value);
  return { value: Number.isFinite(numeric) ? numeric : null, style };
}

function moneyCell(value: unknown): XlsxCellValue {
  const numeric = Number(value);
  return { value: Number.isFinite(numeric) ? Math.round(numeric) : null, style: 'currency' };
}

function optionalMoneyCell(value: unknown): XlsxCellValue {
  const numeric = Number(value);
  return { value: Number.isFinite(numeric) ? Math.round(numeric) : null, style: 'currency' };
}

function percentCell(value: unknown): XlsxCellValue {
  const numeric = Number(value);
  return { value: Number.isFinite(numeric) ? numeric / 100 : null, style: 'percent' };
}

function dateCell(value?: string | Date | null): XlsxCellValue {
  const parsed = value instanceof Date ? value : value ? new Date(value) : null;
  return { value: parsed && !Number.isNaN(parsed.getTime()) ? parsed : null, style: 'date' };
}

function formulaCell(formula: string, value: number, style: 'integer' | 'currency' = 'integer'): XlsxCellValue {
  return { formula, value, style };
}

function statusCell(value: string, positive: boolean): XlsxCellValue {
  return { value, style: positive ? 'statusGood' : 'statusWarn' };
}

function blankCell(style: 'text' | 'currency' | 'integer' | 'decimal' | 'date' | 'percent' = 'text'): XlsxCellValue {
  return { value: null, style };
}

function formatDate(value?: string | null): string {
  if (!value) return '—';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';

  return new Intl.DateTimeFormat('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(parsed);
}

function wasUpdatedAfterCreate(asset: AssetRegisterItem): boolean {
  const createdAt = new Date(asset.createdAtIso).getTime();
  const updatedAt = new Date(asset.updatedAtIso).getTime();

  if (!Number.isFinite(createdAt) || !Number.isFinite(updatedAt)) {
    return false;
  }

  return updatedAt - createdAt > 1000;
}

function assetStatusDateLabel(asset: AssetRegisterItem): string {
  return wasUpdatedAfterCreate(asset)
    ? `Updated ${formatDate(asset.updatedAtIso)}`
    : `Saved ${formatDate(asset.createdAtIso)}`;
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

function usageUnit(item: AssetRegisterItem): 'hours' | 'km' {
  const specs = item.specsJson && typeof item.specsJson === 'object' && !Array.isArray(item.specsJson) ? item.specsJson : {};
  const normalized = String(
    specs.usageMetric ?? specs.usage_metric ?? specs.usageUnit ?? specs.usage_unit ?? '',
  )
    .trim()
    .toLowerCase();

  if (normalized === 'km' || normalized === 'kms' || normalized === 'kilometres' || normalized === 'kilometers') {
    return 'km';
  }

  return item.kind === 'vehicle' ? 'km' : 'hours';
}

function usageAmount(item: AssetRegisterItem): number | null {
  const hours = Number(item.hours);
  if (Number.isFinite(hours) && hours > 0) return Math.round(hours);

  const estimatedHours = Number(item.estimatedHours);
  if (Number.isFinite(estimatedHours) && estimatedHours > 0) return Math.round(estimatedHours);

  return null;
}

function formatDrive(value: string): string {
  if (value === '4wd') return '4WD';
  if (value === '2wd') return '2WD';
  if (value === 'tracks') return 'Tracks';
  return value || '';
}

function formatCab(value: string): string {
  if (value === 'open-station') return 'Open station';
  if (value === 'cab') return 'Cab';
  return value || '';
}

function formatTractorType(value: string): string {
  if (value === 'field') return 'Field';
  if (value === 'orchard') return 'Orchard';
  return value || '';
}

function buildOwnerName(profile: AccountProfileResult | null): string {
  if (!profile) return 'Aim4price account';
  return profile.businessName || profile.name || 'Aim4price account';
}

function buildOwnerAddress(profile: AccountProfileResult | null): string {
  if (!profile) return '';

  return [profile.addressLine1, profile.addressLine2, profile.townCity, profile.province]
    .map((part) => String(part ?? '').trim())
    .filter(Boolean)
    .join(', ');
}

function buildOwnerMeta(profile: AccountProfileResult | null): string {
  if (!profile) return 'Aim4price asset register export';

  const location = [profile.townCity, profile.province].filter(Boolean).join(', ');
  const address = [profile.addressLine1, profile.addressLine2].filter(Boolean).join(', ');
  const parts = [profile.email, profile.phone, location, address].filter(Boolean);

  return parts.join(' • ') || 'Aim4price asset register export';
}

function documentSummary(item: AssetRegisterItem): string {
  if (!item.documents.length) return '';
  return item.documents.map((document) => document.fileName).filter(Boolean).join(', ') || `${item.documents.length} document${item.documents.length === 1 ? '' : 's'}`;
}

function registerValueTotal(items: AssetRegisterItem[]): number {
  return items.reduce((sum, item) => sum + Math.round(Number(item.value || 0)), 0);
}

function aim4priceValueTotal(items: AssetRegisterItem[]): number {
  return items.reduce((sum, item) => sum + Math.round(Number(item.aim4priceValueExVat || 0)), 0);
}

function marketValueTotal(items: AssetRegisterItem[]): number {
  return items.reduce((sum, item) => sum + Math.round(Number(item.marketMidExVat || 0)), 0);
}

function countFinanced(items: AssetRegisterItem[]): number {
  return items.filter((item) => item.isFinanced).length;
}

function countInsured(items: AssetRegisterItem[]): number {
  return items.filter((item) => item.isInsured).length;
}

function countDocuments(items: AssetRegisterItem[]): number {
  return items.reduce((sum, item) => sum + item.documents.length, 0);
}

function buildLocationText(item: AssetRegisterItem): string {
  const locationText = String(item.lastKnownLocationText ?? '').trim();
  if (locationText) return locationText;

  const lat = Number(item.lastKnownLat);
  const lng = Number(item.lastKnownLng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  }

  return '';
}

function buildPlateOrQrCode(item: AssetRegisterItem): string {
  return item.plateLabel || item.publicAssetCode || '';
}

function buildSheetMerges(): XlsxSheet['merges'] {
  return [
    { fromRow: 1, fromColumn: 1, toRow: 1, toColumn: 7 },
    { fromRow: 1, fromColumn: 8, toRow: 1, toColumn: 12 },
    { fromRow: 2, fromColumn: 1, toRow: 2, toColumn: 12 },
    { fromRow: 8, fromColumn: 1, toRow: 8, toColumn: 6 },
  ];
}

function buildTableHeaderRow(): XlsxCellValue[] {
  return TABLE_HEADERS.map((header) => textCell(header, 'tableHeader'));
}

function buildAssetRow(item: AssetRegisterItem, index: number): XlsxCellValue[] {
  const amount = usageAmount(item);
  const fuelPercent = Number(item.fuelPercent);
  const lifeWorkedPercent = Number(item.lifeWorkedPercent);

  return [
    numberCell(index + 1),
    textCell(item.title),
    textCell(kindLabel(item)),
    textCell(item.brandName || ''),
    textCell(item.modelName || item.typedModelName || ''),
    item.yearModel ? numberCell(item.yearModel) : blankCell('integer'),
    textCell(item.serialNumber || ''),
    textCell(buildPlateOrQrCode(item)),
    textCell(formatTractorType(item.tractorType)),
    textCell(formatDrive(item.drive)),
    textCell(formatCab(item.cab)),
    item.powerKw === null || typeof item.powerKw === 'undefined' ? blankCell('decimal') : numberCell(item.powerKw, 'decimal'),
    amount === null ? blankCell('integer') : numberCell(amount),
    textCell(amount === null ? '' : usageUnit(item)),
    Number.isFinite(lifeWorkedPercent) ? percentCell(lifeWorkedPercent) : blankCell('percent'),
    textCell(conditionLabel(item.condition)),
    statusCell(item.isFinanced ? 'Financed' : 'Not financed', item.isFinanced),
    textCell(item.financeNote || '', 'note'),
    statusCell(item.isInsured ? 'Insured' : 'Not insured', item.isInsured),
    numberCell(item.documents.length),
    textCell(documentSummary(item), 'note'),
    moneyCell(item.value),
    item.aim4priceValueExVat === null ? blankCell('currency') : optionalMoneyCell(item.aim4priceValueExVat),
    item.marketMidExVat === null ? blankCell('currency') : optionalMoneyCell(item.marketMidExVat),
    textCell(methodLabel(item.selectedMethod)),
    item.lastScannedAtIso ? dateCell(item.lastScannedAtIso) : blankCell('date'),
    textCell(buildLocationText(item), 'note'),
    Number.isFinite(fuelPercent) ? percentCell(fuelPercent) : blankCell('percent'),
    textCell(item.note || '', 'note'),
    dateCell(item.createdAtIso),
    dateCell(item.updatedAtIso),
  ];
}

function buildFormulaRange(column: string, dataRowCount: number): string | null {
  if (dataRowCount < 1) return null;
  const lastDataRow = DATA_START_ROW + dataRowCount - 1;
  return `${column}${DATA_START_ROW}:${column}${lastDataRow}`;
}

function buildSummaryMetricCells(items: AssetRegisterItem[]): XlsxCellValue[] {
  const valueRange = buildFormulaRange(CURRENCY_COLUMN, items.length);
  const financeRange = buildFormulaRange(FINANCE_STATUS_COLUMN, items.length);
  const insuranceRange = buildFormulaRange(INSURANCE_STATUS_COLUMN, items.length);
  const documentsRange = buildFormulaRange(DOCUMENTS_COUNT_COLUMN, items.length);

  return [
    textCell('Assets', 'metaLabel'),
    items.length > 0 ? formulaCell(`COUNTA(B${DATA_START_ROW}:B${DATA_START_ROW + items.length - 1})`, items.length) : numberCell(0),
    textCell('Register value ex VAT', 'metaLabel'),
    valueRange ? formulaCell(`SUM(${valueRange})`, registerValueTotal(items), 'currency') : moneyCell(0),
    textCell('Financed assets', 'metaLabel'),
    financeRange ? formulaCell(`COUNTIF(${financeRange},"Financed")`, countFinanced(items)) : numberCell(0),
    textCell('Insured assets', 'metaLabel'),
    insuranceRange ? formulaCell(`COUNTIF(${insuranceRange},"Insured")`, countInsured(items)) : numberCell(0),
    textCell('Documents', 'metaLabel'),
    documentsRange ? formulaCell(`SUM(${documentsRange})`, countDocuments(items)) : numberCell(0),
    textCell('Aim4price values', 'metaLabel'),
    moneyCell(aim4priceValueTotal(items)),
    textCell('Market values', 'metaLabel'),
    moneyCell(marketValueTotal(items)),
  ];
}

function buildWorkbookSheet(definition: SheetDefinition, profile: AccountProfileResult | null, generatedAt: Date): XlsxSheet {
  const ownerName = buildOwnerName(profile);
  const ownerAddress = buildOwnerAddress(profile);
  const ownerMeta = buildOwnerMeta(profile);
  const ownerEmail = profile?.email?.trim() || '';
  const ownerPhone = profile?.phone?.trim() || '';
  const ownerVatNumber = profile?.vatNumber?.trim() || '';
  const rows: XlsxCellValue[][] = [
    [textCell('Aim4price Asset Register', 'title'), null, null, null, null, null, null, textCell(definition.name, 'section')],
    [textCell(definition.description, 'subtitle')],
    [],
    [
      textCell('Generated', 'metaLabel'),
      { value: generatedAt, style: 'date' },
      textCell('Owner', 'metaLabel'),
      textCell(ownerName, 'metaValue'),
      textCell('Email', 'metaLabel'),
      textCell(ownerEmail, 'metaValue'),
      textCell('Phone', 'metaLabel'),
      textCell(ownerPhone, 'metaValue'),
    ],
    [
      textCell('Address', 'metaLabel'),
      textCell(ownerAddress, 'metaValue'),
      textCell('VAT number', 'metaLabel'),
      textCell(ownerVatNumber, 'metaValue'),
      textCell('Owner details', 'metaLabel'),
      textCell(ownerMeta, 'metaValue'),
    ],
    [],
    [textCell(EXPORT_DISCLAIMER, 'subtitle')],
    [textCell('Workbook summary', 'section')],
    buildSummaryMetricCells(definition.items),
    [],
    buildTableHeaderRow(),
    ...definition.items.map(buildAssetRow),
  ];

  const lastRow = Math.max(TABLE_HEADER_ROW, DATA_START_ROW + definition.items.length - 1);

  return {
    name: definition.name,
    rows,
    columns: WORKBOOK_COLUMN_WIDTHS,
    merges: buildSheetMerges(),
    freezeRow: TABLE_HEADER_ROW,
    autoFilter: {
      fromRow: TABLE_HEADER_ROW,
      fromColumn: 1,
      toRow: lastRow,
      toColumn: TABLE_COLUMN_COUNT,
    },
    tabColor: definition.tabColor,
  };
}

function buildWorkbookSheets(items: AssetRegisterItem[], profile: AccountProfileResult | null): XlsxSheet[] {
  const generatedAt = new Date();
  const definitions: SheetDefinition[] = [
    {
      name: 'Full Asset Register',
      description: 'Complete editable register with every saved asset and key supporting fields.',
      items,
      tabColor: '10382F',
    },
    {
      name: 'Financed Sheet',
      description: 'Only assets marked as financed. Useful for finance agreements, lender checks and offline updates.',
      items: items.filter((item) => item.isFinanced),
      tabColor: '355FBA',
    },
    {
      name: 'Insured Sheet',
      description: 'Only assets marked as insured. Useful for insurance schedules and policy reviews.',
      items: items.filter((item) => item.isInsured),
      tabColor: '0F6A46',
    },
    {
      name: 'Not Financed Sheet',
      description: 'Only assets currently marked as not financed.',
      items: items.filter((item) => !item.isFinanced),
      tabColor: '8A6500',
    },
    {
      name: 'Not Insured Sheet',
      description: 'Only assets currently marked as not insured. Useful for finding insurance gaps quickly.',
      items: items.filter((item) => !item.isInsured),
      tabColor: 'A3271B',
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
