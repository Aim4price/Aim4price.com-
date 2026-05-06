import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '../../../../lib/auth-session';
import { getAccountProfile } from '../../../../lib/account-profile';
import { listAssetRegisterItems, type AssetRegisterItem } from '../../../../lib/asset-register-db';
import { createXlsxWorkbook, type XlsxCellValue } from '../../../../lib/simple-xlsx';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function unauthorized() {
  return NextResponse.json({ ok: false, error: 'You must be signed in.' }, { status: 401 });
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
  if (asset.kind === 'tractor') return 'Tractor';
  if (asset.kind === 'equipment' || Boolean(asset.brandName && asset.modelName && asset.yearModel)) return 'Equipment';
  if (asset.kind === 'property') return 'Property';
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
      '': '—',
    }[value] ?? '—'
  );
}

function formatDrive(value: string): string {
  if (value === '4wd') return '4WD';
  if (value === '2wd') return '2WD';
  if (value === 'tracks') return 'Tracks';
  return value || '—';
}

function formatCab(value: string): string {
  if (value === 'open-station') return 'Open station';
  if (value === 'cab') return 'Cab';
  return value || '—';
}

function formatTractorType(value: string): string {
  if (value === 'field') return 'Field';
  if (value === 'orchard') return 'Orchard';
  return value || '—';
}

function buildOwnerName(profile: Awaited<ReturnType<typeof getAccountProfile>> | null): string {
  if (!profile) return 'Aim4price account';
  return profile.businessName || profile.name || 'Aim4price account';
}

function buildOwnerMeta(profile: Awaited<ReturnType<typeof getAccountProfile>> | null): string {
  if (!profile) return 'Aim4price asset register export';

  const location = [profile.townCity, profile.province].filter(Boolean).join(', ');
  const address = [profile.addressLine1, profile.addressLine2].filter(Boolean).join(', ');
  const parts = [profile.email, profile.phone, location, address].filter(Boolean);

  return parts.join(' • ') || 'Aim4price asset register export';
}

function buildRows(items: AssetRegisterItem[], ownerName: string, ownerMeta: string): XlsxCellValue[][] {
  const totalValue = items.reduce((sum, item) => sum + Math.round(Number(item.value || 0)), 0);
  const equipmentCount = items.filter(
    (item) => item.kind === 'tractor' || Boolean(item.brandName && item.modelName && item.yearModel),
  ).length;
  const generatedAt = new Date();

  const rows: XlsxCellValue[][] = [
    ['Aim4price Asset Register'],
    ['Generated', generatedAt.toISOString()],
    ['Owner', ownerName],
    ['Owner details', ownerMeta],
    ['Register value ex VAT', totalValue],
    ['Total assets', items.length],
    ['Equipment assets', equipmentCount],
    [],
    [
      'Asset',
      'Type',
      'Method',
      'Brand',
      'Model',
      'Tractor type',
      'Drive',
      'Cab',
      'Power kW',
      'Year model',
      'Hours',
      'Condition',
      'Serial number',
      'Finance status',
      'Finance note',
      'Register value ex VAT',
      'Aim4price ex VAT',
      'Market ex VAT',
      'Notes',
      'Status',
      'Created',
      'Updated',
    ],
  ];

  items.forEach((item) => {
    rows.push([
      item.title,
      kindLabel(item),
      methodLabel(item.selectedMethod),
      item.brandName || '—',
      item.modelName || '—',
      formatTractorType(item.tractorType),
      formatDrive(item.drive),
      formatCab(item.cab),
      item.powerKw ?? '—',
      item.yearModel ?? '—',
      item.hours ?? '—',
      conditionLabel(item.condition),
      item.serialNumber || '—',
      item.isFinanced ? 'Financed' : 'Not financed',
      item.financeNote || '—',
      Math.round(Number(item.value || 0)),
      item.aim4priceValueExVat ?? '—',
      item.marketMidExVat ?? '—',
      item.note || '—',
      assetStatusDateLabel(item),
      item.createdAtIso,
      item.updatedAtIso,
    ]);
  });

  return rows;
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

    let profile: Awaited<ReturnType<typeof getAccountProfile>> | null = null;
    try {
      profile = await getAccountProfile({
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
      });
    } catch (profileError) {
      console.error('asset register export profile lookup failed', profileError);
    }

    const ownerName = buildOwnerName(profile);
    const ownerMeta = buildOwnerMeta(profile);
    const rows = buildRows(items, ownerName, ownerMeta);
    const workbook = createXlsxWorkbook([
      {
        name: 'Asset Register',
        rows,
      },
    ]);

    const filenameDate = new Date().toISOString().slice(0, 10);
    const fileName = `aim4price-asset-register-${filenameDate}.xlsx`;

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
