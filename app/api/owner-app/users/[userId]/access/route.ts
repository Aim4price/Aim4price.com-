import { NextRequest, NextResponse } from 'next/server';
import { getAccountProfile } from '../../../../../../lib/account-profile';
import { getServerSession, isOwnerAppSession } from '../../../../../../lib/auth-session';
import { buildAppAssetDirectoryGroups } from '../../../../../../lib/app-asset-directory';
import { listAssetGroups } from '../../../../../../lib/asset-groups';
import {
  getOwnerAppAssetAccessSettings,
  updateOwnerAppAssetAccessSettings,
} from '../../../../../../lib/owner-app';
import { listAllOwnerAppAssets } from '../../../../../../lib/owner-app-assets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function requireManagingOwner() {
  const session = await getServerSession();
  if (!session?.user?.id || isOwnerAppSession(session)) return null;
  const profile = await getAccountProfile({ id: session.user.id, name: session.user.name, email: session.user.email });
  return profile.accountType === 'owner' && profile.accountStatus === 'active' ? session.user.id : null;
}

export async function GET(_request: NextRequest, { params }: { params: { userId: string } }) {
  const ownerUserId = await requireManagingOwner();
  if (!ownerUserId) {
    return NextResponse.json({ ok: false, error: 'Owner sign-in is required.' }, { status: 401 });
  }

  try {
    const [settings, assetData, assetGroups] = await Promise.all([
      getOwnerAppAssetAccessSettings(ownerUserId, params.userId),
      listAllOwnerAppAssets(ownerUserId),
      listAssetGroups(ownerUserId),
    ]);
    return NextResponse.json({
      ok: true,
      settings,
      assets: assetData.items.map((asset) => ({ id: asset.id, title: asset.title, kind: asset.kind })),
      groups: buildAppAssetDirectoryGroups(assetGroups, assetData.items.map((asset) => asset.id)),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load Owner App access.';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: { userId: string } }) {
  const ownerUserId = await requireManagingOwner();
  if (!ownerUserId) {
    return NextResponse.json({ ok: false, error: 'Owner sign-in is required.' }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ ok: false, error: 'Enter valid Owner App access.' }, { status: 400 });
  }

  try {
    const settings = await updateOwnerAppAssetAccessSettings(
      ownerUserId,
      params.userId,
      body as Record<string, unknown>,
    );
    return NextResponse.json({ ok: true, settings });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save Owner App access.';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
