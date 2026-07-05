import { NextRequest, NextResponse } from 'next/server';
import { getFieldManagerAssetForOpen } from '../../../../../../lib/field-manager';
import {
  applyFieldManagerScanCookie,
  requireActiveFieldManagerSession,
} from '../../../../../../lib/field-manager-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: {
    assetId: string;
  };
};

function extractErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const access = await requireActiveFieldManagerSession(request);

  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.error }, { status: access.status });
  }

  try {
    const asset = await getFieldManagerAssetForOpen({
      ownerUserId: access.session.ownerUserId,
      managerId: access.session.managerId,
      assetId: String(context.params?.assetId ?? ''),
    });

    if (!asset) {
      return NextResponse.json({ ok: false, error: 'This asset is not available to this Field Manager login.' }, { status: 403 });
    }

    const redirectTo = `/scan/${encodeURIComponent(asset.publicAssetCode)}?fieldManager=1`;
    const response = NextResponse.json({ ok: true, redirectTo });

    applyFieldManagerScanCookie(response, {
      managerId: access.session.managerId,
      ownerUserId: access.session.ownerUserId,
      displayName: access.session.displayName,
      publicAssetCode: asset.publicAssetCode,
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: extractErrorMessage(error, 'Failed to open Field Manager asset update.') },
      { status: 500 },
    );
  }
}
