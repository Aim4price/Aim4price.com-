import { NextRequest, NextResponse } from 'next/server';
import { authorizeScanAccess } from '../../../../../lib/scan-auth';
import { listRecentScanEvents, normalizePublicAssetCode } from '../../../../../lib/scan-assets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: {
    publicAssetCode: string;
  };
};

export async function GET(request: NextRequest, context: RouteContext) {
  const publicAssetCode = normalizePublicAssetCode(context.params?.publicAssetCode);
  const access = await authorizeScanAccess(request, publicAssetCode);

  if (!access.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: access.error,
        pinRequired: access.pinRequired,
      },
      { status: access.status },
    );
  }

  const recentEvents = await listRecentScanEvents(access.asset.id, 8);

  return NextResponse.json({
    ok: true,
    accessMode: access.accessMode,
    asset: access.asset,
    recentEvents,
  });
}
