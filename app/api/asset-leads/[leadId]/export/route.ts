import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '../../../../../lib/auth-session';
import { listAssetLeadsForUser, type AssetLead } from '../../../../../lib/partner-access';
import { createXlsxWorkbook, type XlsxCellStyle, type XlsxCellValue, type XlsxSheet } from '../../../../../lib/simple-xlsx';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: {
    leadId: string;
  };
};

type SnapshotAsset = Record<string, unknown>;

const VAT_MULTIPLIER = 1.15;

function unauthorized() {
  return NextResponse.json({ ok: false, error: 'You must be signed in.' }, { status: 401 });
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asText(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function asNumber(value: unknown): number | null {
  if (value === null || typeof value === 'undefined' || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function asBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  const normalized = asText(value).toLowerCase();
  return ['yes', 'y', 'true', '1', 'financed', 'insured', 'licensed', 'licenced'].includes(normalized);
}

function numberCell(value: unknown): XlsxCellValue {
  const numeric = asNumber(value);
  return numeric === null ? { value: '—', style: 'muted' } : { value: Math.round(numeric), style: 'integer' };
}

function moneyCell(value: unknown): XlsxCellValue {
  const numeric = asNumber(value);
  return numeric === null ? { value: '—', style: 'muted' } : { value: Math.round(numeric), style: 'currency' };
}

function textCell(value: unknown, style: XlsxCellStyle = 'text'): XlsxCellValue {
  return { value: asText(value) || '—', style };
}

function dateCell(value: unknown): XlsxCellValue {
  const text = asText(value);
  const date = text ? new Date(text) : null;
  return date && !Number.isNaN(date.getTime()) ? { value: date, style: 'date' } : { value: '—', style: 'muted' };
}

function statusCell(value: unknown, positive: string, negative: string): XlsxCellValue {
  const isPositive = asBoolean(value);
  return {
    value: isPositive ? positive : negative,
    style: isPositive ? 'statusGood' : 'statusBad',
  };
}

function sanitizeFilePart(value: string): string {
  return (value || 'lead-report')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'lead-report';
}

function leadTypeLabel(lead: AssetLead): string {
  const sections = asRecord(lead.includedSections);
  const registerSnapshot = asRecord(sections.registerSnapshot);
  const registerLeadType = asText(sections.registerLeadType || registerSnapshot.registerLeadType).toLowerCase();

  if (registerLeadType === 'full_refinance' || (isFullRegisterLead(lead) && lead.leadType === 'finance')) return 'Full refinance lead';
  if (registerLeadType === 'full_insurance' || (isFullRegisterLead(lead) && lead.leadType === 'insurance')) return 'Full insurance lead';
  if (lead.leadType === 'finance') return 'Finance lead';
  if (lead.leadType === 'insurance') return 'Insurance lead';
  return 'Replacement quote lead';
}

function registerSnapshot(lead: AssetLead): Record<string, unknown> {
  return asRecord(asRecord(lead.includedSections).registerSnapshot);
}

function isFullRegisterLead(lead: AssetLead): boolean {
  const sections = asRecord(lead.includedSections);
  return sections.registerLead === true || Boolean(sections.registerSnapshot);
}

function registerAssets(lead: AssetLead): SnapshotAsset[] {
  const snapshot = registerSnapshot(lead);
  return asArray(snapshot.assets).filter((asset): asset is SnapshotAsset => Boolean(asset && typeof asset === 'object' && !Array.isArray(asset)));
}

function assetTitle(asset: SnapshotAsset): string {
  return (
    asText(asset.title) ||
    [asText(asset.brandName), asText(asset.modelName) || asText(asset.typedModelName)].filter(Boolean).join(' ') ||
    asText(asset.equipmentFamilyLabel) ||
    'Asset'
  );
}

function assetUsage(asset: SnapshotAsset): string {
  const hours = asNumber(asset.hours ?? asset.estimatedHours);
  if (hours !== null) {
    const kind = asText(asset.kind).toLowerCase();
    const unit = kind === 'vehicle' ? 'km' : 'hours';
    return `${new Intl.NumberFormat('en-ZA').format(hours)} ${unit}`;
  }

  const lifeWorked = asNumber(asset.lifeWorkedPercent);
  return lifeWorked === null ? '—' : `${Math.round(lifeWorked)}% worked`;
}

function assetValue(asset: SnapshotAsset): number {
  return Math.round(asNumber(asset.value ?? asset.selectedValueExVat) ?? 0);
}

function getSnapshotAssetsForLead(lead: AssetLead): SnapshotAsset[] {
  if (isFullRegisterLead(lead)) {
    return registerAssets(lead);
  }

  return [lead.assetSnapshot];
}

function ownerName(lead: AssetLead): string {
  return lead.ownerBusinessName || lead.ownerContactName || lead.ownerName || 'Aim4price owner';
}

function buildSummaryRows(lead: AssetLead, assets: SnapshotAsset[]): XlsxCellValue[][] {
  const snapshot = registerSnapshot(lead);
  const registerValue = Math.round(asNumber(snapshot.totalValue ?? lead.assetSnapshot.value ?? lead.assetSnapshot.selectedValueExVat) ?? assets.reduce((sum, asset) => sum + assetValue(asset), 0));
  const registerValueInclVat = Math.round(asNumber(snapshot.totalValueInclVat) ?? registerValue * VAT_MULTIPLIER);
  const aim4priceCount = Math.round(asNumber(snapshot.aim4priceAssetCount) ?? assets.filter((asset) => asText(asset.selectedMethod) === 'aim4price' || asNumber(asset.aim4priceValueExVat) !== null).length);
  const manualCount = Math.round(asNumber(snapshot.manualAssetCount) ?? assets.filter((asset) => asText(asset.selectedMethod) === 'manual').length);
  const financedCount = Math.round(asNumber(snapshot.financedAssetCount) ?? assets.filter((asset) => asBoolean(asset.isFinanced)).length);
  const insuredCount = Math.round(asNumber(snapshot.insuredAssetCount) ?? assets.filter((asset) => asBoolean(asset.isInsured)).length);
  const licensedCount = Math.round(asNumber(snapshot.licensedAssetCount) ?? assets.filter((asset) => asBoolean(asset.isLicensed)).length);

  return [
    [textCell('Aim4price Lead Report', 'title')],
    [textCell(leadTypeLabel(lead), 'section')],
    [textCell('Generated', 'metaLabel'), { value: new Date(), style: 'date' }],
    [textCell('Received', 'metaLabel'), dateCell(lead.createdAtIso)],
    [textCell('Lead status', 'metaLabel'), textCell(lead.status, 'metaValue')],
    [],
    [textCell('Client', 'section')],
    [textCell('Business name', 'metaLabel'), textCell(lead.ownerBusinessName || '—', 'metaValue')],
    [textCell('Contact person', 'metaLabel'), textCell(lead.ownerContactName || lead.ownerName || '—', 'metaValue')],
    [textCell('Contact number', 'metaLabel'), textCell(lead.ownerContactPhone || lead.ownerPhone || '—', 'metaValue')],
    [textCell('Email', 'metaLabel'), textCell(lead.ownerContactEmail || '—', 'metaValue')],
    [textCell('Location', 'metaLabel'), textCell([lead.ownerTownCity, lead.ownerProvince].filter(Boolean).join(', ') || '—', 'metaValue')],
    [],
    [textCell('Register summary', 'section')],
    [textCell('Register value ex VAT', 'metaLabel'), moneyCell(registerValue)],
    [textCell('Register value incl VAT', 'metaLabel'), moneyCell(registerValueInclVat)],
    [textCell('Total assets', 'metaLabel'), numberCell(assets.length)],
    [textCell('Aim4price assets', 'metaLabel'), numberCell(aim4priceCount)],
    [textCell('Manual assets', 'metaLabel'), numberCell(manualCount)],
    [textCell('Assets financed', 'metaLabel'), numberCell(financedCount)],
    [textCell('Assets insured', 'metaLabel'), numberCell(insuredCount)],
    [textCell('Assets licensed', 'metaLabel'), numberCell(licensedCount)],
    [],
    [textCell('Owner message', 'section')],
    [textCell(lead.ownerMessage || 'No owner message supplied.', 'subtitle')],
  ];
}

function buildAssetRows(assets: SnapshotAsset[]): XlsxCellValue[][] {
  const header = [
    'Asset title',
    'Asset type',
    'Brand',
    'Model / description',
    'Year model / built',
    'Usage',
    'Condition',
    'Serial / VIN',
    'Register value ex VAT',
    'Register value incl VAT',
    'Aim4price value ex VAT',
    'Selected method',
    'Financed',
    'Insured',
    'Licensed',
    'License registration',
    'Updated',
  ].map((label) => textCell(label, 'tableHeader'));

  const body = assets.map((asset) => {
    const value = assetValue(asset);
    return [
      textCell(assetTitle(asset)),
      textCell(asText(asset.equipmentFamilyLabel) || asText(asset.kind) || 'Asset'),
      textCell(asset.brandName),
      textCell(asText(asset.modelName) || asText(asset.typedModelName)),
      textCell(asset.yearModel),
      textCell(assetUsage(asset)),
      textCell(asset.condition),
      textCell(asset.serialNumber),
      moneyCell(value),
      moneyCell(Math.round(value * VAT_MULTIPLIER)),
      moneyCell(asset.aim4priceValueExVat),
      textCell(asset.selectedMethod),
      statusCell(asset.isFinanced, 'Financed', 'Not financed'),
      statusCell(asset.isInsured, 'Insured', 'Not insured'),
      statusCell(asset.isLicensed, 'Licensed', 'Not licensed'),
      textCell(asset.licenseRegistrationNumber),
      dateCell(asset.updatedAtIso || asset.createdAtIso),
    ];
  });

  return [header, ...body];
}

function buildWorkbook(lead: AssetLead): Buffer {
  const assets = getSnapshotAssetsForLead(lead);
  const sheets: XlsxSheet[] = [
    {
      name: 'Lead Summary',
      rows: buildSummaryRows(lead, assets),
      columns: [26, 34, 18, 18],
      tabColor: '10382F',
    },
    {
      name: isFullRegisterLead(lead) ? 'Full Asset Register' : 'Asset Lead',
      rows: buildAssetRows(assets),
      columns: [34, 20, 18, 28, 16, 16, 16, 18, 18, 18, 20, 18, 16, 16, 16, 24, 18],
      freezeRow: 1,
      autoFilter: assets.length
        ? {
            fromRow: 1,
            fromColumn: 1,
            toRow: assets.length + 1,
            toColumn: 17,
          }
        : undefined,
      tabColor: '0F6A46',
    },
  ];

  return createXlsxWorkbook(sheets);
}

export async function GET(request: NextRequest, context: RouteContext) {
  const session = await getServerSession();

  if (!session?.user?.id) {
    return unauthorized();
  }

  const params = new URL(request.url).searchParams;
  const format = asText(params.get('format')).toLowerCase();

  if (format !== 'xlsx') {
    return NextResponse.json({ ok: false, error: 'Only XLSX export is available on this endpoint.' }, { status: 400 });
  }

  try {
    const leads = await listAssetLeadsForUser(session.user.id);
    const lead = leads.find((candidate) => candidate.id === context.params.leadId);

    if (!lead) {
      return NextResponse.json({ ok: false, error: 'Lead not found.' }, { status: 404 });
    }

    const workbook = buildWorkbook(lead);
    const date = new Date().toISOString().slice(0, 10);
    const fileName = `aim4price-${sanitizeFilePart(ownerName(lead))}-${sanitizeFilePart(leadTypeLabel(lead))}-${date}.xlsx`;

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
    console.error('asset lead XLSX export failed', error);
    return NextResponse.json({ ok: false, error: 'Failed to export the lead XLSX report.' }, { status: 500 });
  }
}
