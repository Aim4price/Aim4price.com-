import { NextResponse } from 'next/server';
import { getServerSession } from '../../../lib/auth-session';
import { listAssetRegisterItems } from '../../../lib/asset-register-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type AssetMapItem = {
  id: string;
  title: string;
  plateLabel: string;
  publicAssetCode: string;
  qrStatus: string;
  condition: string;
  hours: number | null;
  fuelPercent: number | null;
  serialNumber: string;
  lastScannedAtIso: string | null;
  lastKnownLat: number | null;
  lastKnownLng: number | null;
  lastKnownLocationText: string;
  updatedAtIso: string;
};

function unauthorized() {
  return NextResponse.json({ ok: false, error: 'You must be signed in.' }, { status: 401 });
}

function hasCoordinates(lat: number | null, lng: number | null): boolean {
  if (lat === null || lng === null) return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return false;
  if (lat === 0 && lng === 0) return false;
  return true;
}

function mapAssetForMap(item: Awaited<ReturnType<typeof listAssetRegisterItems>>[number]): AssetMapItem {
  return {
    id: item.id,
    title: item.title,
    plateLabel: item.plateLabel,
    publicAssetCode: item.publicAssetCode,
    qrStatus: item.qrStatus,
    condition: item.condition,
    hours: item.hours,
    fuelPercent: item.fuelPercent,
    serialNumber: item.serialNumber,
    lastScannedAtIso: item.lastScannedAtIso,
    lastKnownLat: item.lastKnownLat,
    lastKnownLng: item.lastKnownLng,
    lastKnownLocationText: item.lastKnownLocationText,
    updatedAtIso: item.updatedAtIso,
  };
}

export async function GET() {
  const session = await getServerSession();

  if (!session?.user?.id) {
    return unauthorized();
  }

  try {
    const items = await listAssetRegisterItems(session.user.id);
    const assets = items.map(mapAssetForMap);
    const mappedAssets = assets.filter((asset) => hasCoordinates(asset.lastKnownLat, asset.lastKnownLng));
    const activeMappedAssets = mappedAssets.filter((asset) => asset.qrStatus !== 'deleted');
    const recentlyScannedAssets = assets.filter((asset) => {
      if (!asset.lastScannedAtIso) return false;
      const scannedAt = new Date(asset.lastScannedAtIso).getTime();
      if (Number.isNaN(scannedAt)) return false;
      return Date.now() - scannedAt <= 1000 * 60 * 60 * 24 * 30;
    });

    return NextResponse.json({
      ok: true,
      assets,
      summary: {
        totalAssets: assets.length,
        assetsWithLocation: mappedAssets.length,
        assetsWithoutLocation: Math.max(0, assets.length - mappedAssets.length),
        activeMappedAssets: activeMappedAssets.length,
        scannedLast30Days: recentlyScannedAssets.length,
      },
    });
  } catch (error) {
    console.error('asset map GET failed', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to load the asset map.' },
      { status: 500 },
    );
  }
}
