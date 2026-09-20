import { NextRequest, NextResponse } from 'next/server';
import { requireAppOfflineAccess, offlineError, offlineHeaders } from '../../../../lib/app-offline-access';
import { buildAppOfflineSnapshot } from '../../../../lib/app-offline-snapshot';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest, { params }: { params: { app: string } }) {
  const auth = await requireAppOfflineAccess(request, params.app);
  if (!auth.ok) return auth.response;
  if (request.nextUrl.searchParams.has('identityOnly')) return NextResponse.json({ ok: true, identity: auth.access.identity }, { headers: offlineHeaders });
  try { return NextResponse.json(await buildAppOfflineSnapshot(auth.access), { headers: offlineHeaders }); }
  catch (error) { console.error('Offline snapshot failed', error); return offlineError('Could not refresh your saved copy. It has not been changed.', 503); }
}
