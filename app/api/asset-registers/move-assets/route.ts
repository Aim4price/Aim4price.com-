import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '../../../../lib/auth-session';
import { getAssetRegisterAccountAccess } from '../../../../lib/asset-register-account-access';
import { moveAssetRegisterItems } from '../../../../lib/asset-registers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type MoveAssetsBody = {
  assetId?: unknown;
  assetIds?: unknown;
  targetRegisterId?: unknown;
};

function unauthorized() {
  return NextResponse.json({ ok: false, error: 'You must be signed in.' }, { status: 401 });
}

async function requireAssetRegisterAccount(session: Awaited<ReturnType<typeof getServerSession>>) {
  if (!await getAssetRegisterAccountAccess(session)) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Asset movement is available to active Owner accounts and authorised Dealer inventory staff.',
      },
      { status: 403 },
    );
  }

  return null;
}

function normalizeAssetIds(body: MoveAssetsBody): string[] {
  const rawValues = Array.isArray(body.assetIds) ? body.assetIds : [body.assetId];

  return rawValues
    .map((value) => String(value ?? '').trim())
    .filter(Boolean);
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession({ allowDealerApp: true });

  if (!session?.user?.id) {
    return unauthorized();
  }

  const ownerError = await requireAssetRegisterAccount(session);
  if (ownerError) return ownerError;

  try {
    const body = (await request.json()) as MoveAssetsBody;
    const assetIds = normalizeAssetIds(body);
    const targetRegisterId = String(body.targetRegisterId ?? '').trim();

    if (!assetIds.length) {
      return NextResponse.json({ ok: false, error: 'At least one asset id is required.' }, { status: 400 });
    }

    if (!targetRegisterId) {
      return NextResponse.json({ ok: false, error: 'Target asset register id is required.' }, { status: 400 });
    }

    const movedCount = await moveAssetRegisterItems({
      userId: session.user.id,
      assetIds,
      targetRegisterId,
    });

    return NextResponse.json({ ok: true, movedCount });
  } catch (error) {
    if (error instanceof Error && error.message === 'ASSET_REGISTER_NOT_FOUND') {
      return NextResponse.json({ ok: false, error: 'Target asset register not found.' }, { status: 404 });
    }

    if (error instanceof Error && error.message === 'ASSET_ID_REQUIRED') {
      return NextResponse.json({ ok: false, error: 'At least one asset id is required.' }, { status: 400 });
    }

    console.error('asset registers move failed', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Failed to move asset.' },
      { status: 500 },
    );
  }
}
