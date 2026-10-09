import type { NextRequest } from 'next/server';
import { assetPartsRequest } from '../../../../../../lib/asset-parts-api';
import { resolveAppPartsAccess } from '../../../../../../lib/asset-parts-app-access';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export function GET(request: NextRequest, { params }: { params: { assetId: string } }) {
  return assetPartsRequest(request, { appScope: () => resolveAppPartsAccess(request, 'field-manager', params.assetId) });
}
export const POST = GET;
