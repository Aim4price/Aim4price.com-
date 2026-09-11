import { NextRequest, NextResponse } from 'next/server';
import { requireOfflineIdentity, offlineHeaders } from '../../../../../lib/field-manager-offline-access';
import { POST as uploadScanPhoto } from '../../../scan/uploads/route';
import { fieldManagerCan } from '../../../../../lib/field-manager';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest) {
  const access = await requireOfflineIdentity(request);
  if (!access.ok) return access.response;
  if (!await fieldManagerCan(access.session.managerId, 'record_work')) return NextResponse.json({ ok: false, error: 'This login cannot record work.' }, { status: 403, headers: offlineHeaders });
  const url = new URL('/api/scan/uploads', request.url);
  url.searchParams.set('fieldManager', '1');
  url.searchParams.set('assetId', request.nextUrl.searchParams.get('assetId') || '');
  const form = await request.formData();
  const headers = new Headers(request.headers); headers.delete('content-type'); headers.delete('content-length');
  return uploadScanPhoto(new NextRequest(url, { method: 'POST', headers, body: form }));
}
