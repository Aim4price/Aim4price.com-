import { NextRequest, NextResponse } from 'next/server';
import { getAccountProfile } from '../../../../../lib/account-profile';
import { getServerSession } from '../../../../../lib/auth-session';
import { buildAppAssetDirectoryGroups } from '../../../../../lib/app-asset-directory';
import { listAssetGroups } from '../../../../../lib/asset-groups';
import {
  getFieldManagerAccessSettings,
  listFieldManagerFuelStorages,
  updateFieldManagerAccessSettings,
} from '../../../../../lib/field-manager';
import { listAllOwnerAppAssets } from '../../../../../lib/owner-app-assets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function requireOwner() {
  const session = await getServerSession();
  if (!session?.user?.id) return null;
  const profile = await getAccountProfile({ id: session.user.id, name: session.user.name, email: session.user.email });
  return profile.accountType === 'owner' ? session.user.id : null;
}

export async function GET(_request: NextRequest, { params }: { params: { managerId: string } }) {
  const ownerUserId = await requireOwner();
  if (!ownerUserId) return NextResponse.json({ ok: false, error: 'Owner sign-in is required.' }, { status: 401 });
  try {
    const [settings, assetData, storages, assetGroups] = await Promise.all([
      getFieldManagerAccessSettings(ownerUserId, params.managerId),
      listAllOwnerAppAssets(ownerUserId),
      listFieldManagerFuelStorages(ownerUserId),
      listAssetGroups(ownerUserId),
    ]);
    return NextResponse.json({
      ok: true,
      settings,
      assets: assetData.items.map((asset) => ({ id: asset.id, title: asset.title, kind: asset.kind })),
      groups: buildAppAssetDirectoryGroups(assetGroups, assetData.items.map((asset) => asset.id)),
      storages: storages.map((storage) => ({ id: storage.id, name: storage.name, locationLabel: storage.locationLabel })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load Field Manager access.';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: { managerId: string } }) {
  const ownerUserId = await requireOwner();
  if (!ownerUserId) return NextResponse.json({ ok: false, error: 'Owner sign-in is required.' }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ ok: false, error: 'Enter valid Field Manager access.' }, { status: 400 });
  }
  try {
    const settings = await updateFieldManagerAccessSettings(ownerUserId, params.managerId, body as Record<string, unknown>);
    return NextResponse.json({ ok: true, settings });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save Field Manager access.';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
