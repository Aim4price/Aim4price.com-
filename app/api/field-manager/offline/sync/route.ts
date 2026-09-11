import { NextRequest, NextResponse } from 'next/server';
import { requireOfflineIdentity, offlineHeaders } from '../../../../../lib/field-manager-offline-access';
import { POST as saveScanEvent } from '../../../scan/assets/[publicAssetCode]/event/route';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest) {
  const access = await requireOfflineIdentity(request);
  if (!access.ok) return access.response;
  const assetId = request.nextUrl.searchParams.get('assetId');
  const code = request.nextUrl.searchParams.get('code');
  if (!assetId || !code) return NextResponse.json({ ok: false, error: 'Choose a saved asset.' }, { status: 400, headers: offlineHeaders });
  const body = await request.text();
  if (body.length > 64000) return NextResponse.json({ ok: false, error: 'Update too large.' }, { status: 413, headers: offlineHeaders });
  const url = new URL(`/api/scan/assets/${encodeURIComponent(code)}/event`, request.url);
  url.searchParams.set('fieldManager', '1'); url.searchParams.set('assetId', assetId);
  // Reuse exactly the authenticated request credentials. The existing handler
  // rechecks asset scope, record_work, usage and maintenance, and deduplicates clientEventId.
  return saveScanEvent(new NextRequest(url, { method: 'POST', headers: request.headers, body }), { params: { publicAssetCode: code } });
}
