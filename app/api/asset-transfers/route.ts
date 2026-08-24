import { NextRequest, NextResponse } from 'next/server';
import { getAccountProfile } from '../../../lib/account-profile';
import { getServerSession, isAdminSupportSession } from '../../../lib/auth-session';
import {
  cancelAssetTransfer,
  claimAssetTransfer,
  listOutgoingAssetTransfers,
  regenerateAssetTransferCode,
} from '../../../lib/asset-transfers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function unauthorized() {
  return NextResponse.json({ ok: false, error: 'You must be signed in.' }, { status: 401 });
}

async function requireOwnerSession() {
  const session = await getServerSession();
  if (!session?.user?.id) return { response: unauthorized() } as const;
  if (isAdminSupportSession(session)) {
    return {
      response: NextResponse.json(
        { ok: false, error: 'Exit admin support mode before transferring an asset.' },
        { status: 403 },
      ),
    } as const;
  }
  const profile = await getAccountProfile({ id: session.user.id, name: session.user.name, email: session.user.email });
  if (profile.accountType !== 'owner') {
    return {
      response: NextResponse.json(
        { ok: false, error: 'Asset transfers are only available to owner accounts.' },
        { status: 403 },
      ),
    } as const;
  }
  return { session } as const;
}

function errorResponse(error: unknown) {
  const code = error instanceof Error ? error.message : '';
  if (code === 'ASSET_TRANSFER_RATE_LIMITED') {
    return NextResponse.json(
      { ok: false, error: 'Too many unsuccessful attempts. Wait 15 minutes and try again.' },
      { status: 429 },
    );
  }
  if (code === 'ASSET_TRANSFER_SELF_CLAIM') {
    return NextResponse.json(
      { ok: false, error: 'The account that sent an asset cannot claim its own transfer.' },
      { status: 400 },
    );
  }
  if (code === 'ASSET_TRANSFER_INVALID_CREDENTIALS') {
    return NextResponse.json(
      { ok: false, error: 'The asset identifier and transfer code could not be verified, or the code has expired.' },
      { status: 400 },
    );
  }
  if (code === 'ASSET_TRANSFER_NOT_FOUND') {
    return NextResponse.json({ ok: false, error: 'This pending transfer was not found.' }, { status: 404 });
  }
  console.error('Asset transfer request failed.', error);
  return NextResponse.json({ ok: false, error: 'The asset transfer could not be completed.' }, { status: 500 });
}

export async function GET() {
  const access = await requireOwnerSession();
  if ('response' in access) return access.response;
  try {
    const outgoing = await listOutgoingAssetTransfers(access.session.user.id);
    return NextResponse.json({ ok: true, outgoing });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  const access = await requireOwnerSession();
  if ('response' in access) return access.response;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ ok: false, error: 'Send valid transfer details.' }, { status: 400 });
  const action = String(body.action ?? '').trim().toLowerCase();

  try {
    if (action === 'claim') {
      const claimed = await claimAssetTransfer({
        buyerUserId: access.session.user.id,
        buyerName: access.session.user.name,
        buyerEmail: access.session.user.email,
        assetIdentifier: body.assetIdentifier,
        transferCode: body.transferCode,
      });
      return NextResponse.json({ ok: true, claimed });
    }
    if (action === 'regenerate') {
      const transfer = await regenerateAssetTransferCode({
        sellerUserId: access.session.user.id,
        transferId: String(body.transferId ?? '').trim(),
      });
      return NextResponse.json({ ok: true, transfer });
    }
    if (action === 'cancel') {
      await cancelAssetTransfer({
        sellerUserId: access.session.user.id,
        transferId: String(body.transferId ?? '').trim(),
      });
      const outgoing = await listOutgoingAssetTransfers(access.session.user.id);
      return NextResponse.json({ ok: true, outgoing });
    }
    return NextResponse.json({ ok: false, error: 'Choose a valid transfer action.' }, { status: 400 });
  } catch (error) {
    return errorResponse(error);
  }
}
