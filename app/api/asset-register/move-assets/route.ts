import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '../../../../lib/auth-session';
import { getAccountProfile } from '../../../../lib/account-profile';
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

async function requireOwnerAccount(user: { id: string; name?: string | null; email?: string | null }) {
  const profile = await getAccountProfile(user);

  if (profile.accountType !== 'owner') {
    return NextResponse.json(
      {
        ok: false,
        error: 'Asset movement is only available to owner accounts.',
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
  const session = await getServerSession();

  if (!session?.user?.id) {
    return unauthorized();
  }

  const ownerError = await requireOwnerAccount(session.user);
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
