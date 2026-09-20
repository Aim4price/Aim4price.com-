import { NextRequest, NextResponse } from 'next/server';
import { requireAppOfflineAccess, offlineError, offlineHeaders } from '../../../../../lib/app-offline-access';
import { ownerAppCanAccessAsset } from '../../../../../lib/owner-app-access';
import { getFieldManagerAssetForOpen } from '../../../../../lib/field-manager';
import { createAssetRegisterUpload, ALLOWED_ASSET_REGISTER_IMAGE_TYPES } from '../../../../../lib/asset-register-uploads';
import { POST as uploadScan } from '../../../scan/uploads/route';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest, { params }: { params: { app: string } }) {
  const auth = await requireAppOfflineAccess(request, params.app);
  if (!auth.ok) return auth.response;
  const a = auth.access;
  const assetId = request.nextUrl.searchParams.get('assetId') || '';
  const kind = request.nextUrl.searchParams.get('kind');
  if (a.app !== 'owner' && a.app !== 'field') return offlineError('Photos are not supported for this action.', 403);
  if (a.owner && !ownerAppCanAccessAsset(a.owner, assetId)) return offlineError('Asset not available.', 403);
  if (kind === 'work' && a.canWork) {
    const url = new URL('/api/scan/uploads', request.url);
    url.searchParams.set(a.app === 'owner' ? 'ownerApp' : 'fieldManager', '1'); url.searchParams.set('assetId', assetId);
    const headers = new Headers(request.headers); headers.delete('content-type'); headers.delete('content-length');
    return uploadScan(new NextRequest(url, { method: 'POST', headers, body: await request.formData() }));
  }
  if (kind !== 'fuel-slip' || !a.canFuel) return offlineError('Your login cannot upload this photo.', 403);
  if (a.owner && !ownerAppCanAccessAsset(a.owner, assetId)) return offlineError('Asset not available.', 403);
  if (a.managerId && !await getFieldManagerAssetForOpen({ ownerUserId: a.userId, managerId: a.managerId, assetId })) return offlineError('Asset not available.', 403);
  try {
    const file = (await request.formData()).get('files');
    if (!file || typeof file === 'string' || !ALLOWED_ASSET_REGISTER_IMAGE_TYPES.has(file.type) || !file.size || file.size > 5 * 1024 * 1024) return offlineError('Choose a JPG, PNG or WEBP photo up to 5 MB.');
    const upload = await createAssetRegisterUpload({ userId: a.userId, file, category: 'fuel-slip' });
    return NextResponse.json({ ok: true, uploads: [{ uploadId: upload.id, url: upload.url, fileName: upload.fileName, contentType: upload.contentType, byteSize: upload.byteSize }] }, { headers: offlineHeaders });
  } catch { return offlineError('Photo upload was interrupted. Retry when connected.', 503); }
}
