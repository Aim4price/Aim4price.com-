import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '../../../lib/auth-session';
import { getAssetRegisterAccountAccess } from '../../../lib/asset-register-account-access';
import { createAssetShareLink, findAssetShareLink, revokeAssetShareLink } from '../../../lib/asset-share-links';
import { parseShareAssetIds } from '../../../lib/asset-share-snapshot';
import { isTrustedRequestOrigin } from '../../../lib/trusted-request-origin';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const respond = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } });
async function owner() {
  const session = await getServerSession({ requireActive: true, allowDealerApp: true, allowOwnerApp: true });
  return session?.user?.id && await getAssetRegisterAccountAccess(session) ? session.user.id : null;
}
export async function GET(request: NextRequest) {
  const userId = await owner();
  if (!userId) return respond({ error: 'Sign in to manage share links.' }, 401);
  let ids: string[];
  try { ids = parseShareAssetIds(request.nextUrl.searchParams.getAll('assetId')); }
  catch { return respond({ error: 'Select saved assets.' }, 400); }
  const share = await findAssetShareLink(userId, ids, request.nextUrl.searchParams.get('photos') === '1');
  return respond({ share });
}
export async function POST(request: NextRequest) {
  if (!isTrustedRequestOrigin(request.headers.get('origin'), request.nextUrl.origin)) return respond({ error: 'Invalid request origin.' }, 403);
  const userId = await owner();
  if (!userId) return respond({ error: 'Sign in to create a share link.' }, 401);
  let body: any;
  try { body = await request.json(); parseShareAssetIds(body?.assetIds); }
  catch { return respond({ error: 'Select between 1 and 100 saved assets.' }, 400); }
  try {
    const share = await createAssetShareLink(userId, body.assetIds, body.includePhotos === true);
    return respond({ share });
  } catch (error) {
    if (error instanceof Error && error.message === 'ASSET_SHARE_FORBIDDEN') return respond({ error: 'Only assets owned by your account can be shared by link.' }, 403);
    console.error('Asset share link creation failed');
    return respond({ error: 'The link could not be created. Please try again.' }, 500);
  }
}
export async function DELETE(request: NextRequest) {
  if (!isTrustedRequestOrigin(request.headers.get('origin'), request.nextUrl.origin)) return respond({ error: 'Invalid request origin.' }, 403);
  const userId = await owner();
  if (!userId) return respond({ error: 'Sign in to disable a share link.' }, 401);
  let token: unknown;
  try { token = (await request.json())?.token; } catch { /* invalid body */ }
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) return respond({ error: 'Invalid link.' }, 400);
  await revokeAssetShareLink(userId, token);
  return respond({ ok: true });
}
