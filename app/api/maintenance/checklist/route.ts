import { NextRequest, NextResponse } from 'next/server';
import { isTrustedRequestOrigin } from '../../../../lib/trusted-request-origin';
import { getServerSession } from '../../../../lib/auth-session';
import { addAssetChecklistItem, listAssetChecklistItems, removeAssetChecklistItem } from '../../../../lib/asset-checklist-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };

async function handle(request: NextRequest, action: 'read' | 'add' | 'remove') {
  const session = await getServerSession({ requireActive: true });
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: 'Sign in to manage your checklists.' }, { status: 401, headers });
  if (action !== 'read' && !isTrustedRequestOrigin(request.headers.get('origin'), request.nextUrl.origin)) return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403, headers });
  const assetId = request.nextUrl.searchParams.get('assetId') || '';
  try {
    if (action === 'add') {
      const input = await request.json();
      const item = await addAssetChecklistItem(userId, assetId, input);
      return NextResponse.json({ item }, { status: 201, headers });
    }
    if (action === 'remove') {
      await removeAssetChecklistItem(userId, assetId, request.nextUrl.searchParams.get('itemId') || '');
      return NextResponse.json({ ok: true }, { headers });
    }
    return NextResponse.json({ items: await listAssetChecklistItems(userId, assetId) }, { headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'ASSET_NOT_FOUND' || message === 'ITEM_NOT_FOUND') return NextResponse.json({ error: 'The asset or checklist item could not be found for your account.' }, { status: 404, headers });
    if (error instanceof SyntaxError || /^(Choose inspection|Enter an item|Keep instructions|This asset already)/.test(message)) return NextResponse.json({ error: error instanceof SyntaxError ? 'Invalid checklist item.' : message }, { status: 400, headers });
    console.error('Asset checklist request failed.', error);
    return NextResponse.json({ error: 'Your checklist could not be loaded or saved. Please try again.' }, { status: 503, headers });
  }
}
export const GET = (request: NextRequest) => handle(request, 'read');
export const POST = (request: NextRequest) => handle(request, 'add');
export const DELETE = (request: NextRequest) => handle(request, 'remove');
