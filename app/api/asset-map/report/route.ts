import { NextResponse } from 'next/server';
import { getServerSession } from '../../../../lib/auth-session';
import { listAssetRegisterItems, type AssetRegisterItem } from '../../../../lib/asset-register-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function unauthorized() {
  return NextResponse.json({ ok: false, error: 'You must be signed in.' }, { status: 401 });
}

function asText(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function formatDateTime(value?: string | null): string {
  if (!value) return '';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';

  return new Intl.DateTimeFormat('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
}

function formatReportDate(value = new Date()): string {
  return value.toISOString().slice(0, 10);
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
    }[normalized] ?? asText(value)
  );
}

function formatQrStatus(value: string): string {
  const normalized = asText(value).toLowerCase();

  return (
    {
      active: 'Active',
      transferred: 'Transferred',
      retired: 'Retired',
      deleted: 'Deleted',
    }[normalized] ?? 'Pending'
  );
}

function formatFuel(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '';
  return `${Math.max(0, Math.min(100, Math.round(value)))}%`;
}

function formatNumber(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '';
  return new Intl.NumberFormat('en-ZA').format(Math.round(value));
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

function formatUsage(asset: AssetRegisterItem): string {
  if (typeof asset.hours === 'number' && Number.isFinite(asset.hours)) {
    return `${formatNumber(asset.hours)} ${getUsageUnit(asset)}`;
  }

  if (typeof asset.lifeWorkedPercent === 'number' && Number.isFinite(asset.lifeWorkedPercent)) {
    const percent = Math.max(0, Math.min(100, Math.round(asset.lifeWorkedPercent * 10) / 10));
    return `${Number.isInteger(percent) ? percent : percent.toFixed(1)}% worked`;
  }

  return '';
}

function hasCoordinates(asset: AssetRegisterItem): boolean {
  const { lastKnownLat: lat, lastKnownLng: lng } = asset;
  if (lat === null || lng === null) return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return false;
  if (lat === 0 && lng === 0) return false;
  return true;
}

function googleMapsUrl(asset: AssetRegisterItem): string {
  return hasCoordinates(asset) ? `https://www.google.com/maps/search/?api=1&query=${asset.lastKnownLat},${asset.lastKnownLng}` : '';
}

function csvEscape(value: unknown): string {
  const text = String(value ?? '').replace(/\r?\n/g, ' ').trim();
  const escaped = text.replace(/"/g, '""');
  return /[",\r\n]/.test(escaped) ? `"${escaped}"` : escaped;
}

function buildCsvRow(values: unknown[]): string {
  return values.map(csvEscape).join(',');
}

function buildScannedAssetReport(assets: AssetRegisterItem[]): string {
  const headers = [
    'Asset Title',
    'Plate Label',
    'Public Asset Code',
    'Serial Number',
    'QR Status',
    'Asset Type',
    'Family',
    'Brand',
    'Model',
    'Usage',
    'Fuel',
    'Condition',
    'Last Scanned',
    'Location Text',
    'Latitude',
    'Longitude',
    'Location Saved',
    'Google Maps Link',
  ];

  const rows = assets.map((asset) => [
    asset.title,
    asset.plateLabel,
    asset.publicAssetCode,
    asset.serialNumber,
    formatQrStatus(asset.qrStatus),
    asset.kind,
    asset.equipmentFamilyLabel,
    asset.brandName,
    asset.modelName || asset.typedModelName,
    formatUsage(asset),
    formatFuel(asset.fuelPercent),
    formatCondition(asset.condition),
    formatDateTime(asset.lastScannedAtIso),
    asset.lastKnownLocationText,
    typeof asset.lastKnownLat === 'number' && Number.isFinite(asset.lastKnownLat) ? asset.lastKnownLat : '',
    typeof asset.lastKnownLng === 'number' && Number.isFinite(asset.lastKnownLng) ? asset.lastKnownLng : '',
    hasCoordinates(asset) ? 'Yes' : 'No',
    googleMapsUrl(asset),
  ]);

  return `\ufeff${[headers, ...rows].map(buildCsvRow).join('\r\n')}\r\n`;
}

export async function GET() {
  const session = await getServerSession();

  if (!session?.user?.id) {
    return unauthorized();
  }

  try {
    const items = await listAssetRegisterItems(session.user.id);
    const scannedAssets = items
      .filter((asset) => Boolean(asset.lastScannedAtIso))
      .sort((left, right) => {
        const leftTime = left.lastScannedAtIso ? new Date(left.lastScannedAtIso).getTime() : 0;
        const rightTime = right.lastScannedAtIso ? new Date(right.lastScannedAtIso).getTime() : 0;
        return rightTime - leftTime;
      });

    const csv = buildScannedAssetReport(scannedAssets);
    const filename = `aim4price-scanned-assets-${formatReportDate()}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('asset map report failed', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to build the scanned assets report.' },
      { status: 500 },
    );
  }
}
