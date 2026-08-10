import { NextRequest, NextResponse } from 'next/server';
import { buildAppAssetDirectoryGroups } from '../../../../lib/app-asset-directory';
import { listAssetGroups } from '../../../../lib/asset-groups';
import { listFieldManagerAssets } from '../../../../lib/field-manager';
import { requireActiveFieldManagerSession } from '../../../../lib/field-manager-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function extractErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

export async function GET(request: NextRequest) {
  const access = await requireActiveFieldManagerSession(request);

  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.error }, { status: access.status });
  }

  try {
    const [assets, assetGroups] = await Promise.all([
      listFieldManagerAssets(access.session.ownerUserId, access.session.managerId),
      listAssetGroups(access.session.ownerUserId),
    ]);
    return NextResponse.json({
      ok: true,
      assets,
      groups: buildAppAssetDirectoryGroups(assetGroups, assets.map((asset) => asset.id)),
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: extractErrorMessage(error, 'Failed to load Field Manager assets.') },
      { status: 500 },
    );
  }
}
