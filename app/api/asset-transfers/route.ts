import { NextRequest, NextResponse } from 'next/server';
import { getServerSession, isAdminSupportSession, isDealerAppSession } from '../../../lib/auth-session';
import { getAssetRegisterAccountAccess } from '../../../lib/asset-register-account-access';
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

async function requireTransferSession() {
  const session = await getServerSession({ allowDealerApp: true });
  if (!session?.user?.id) return { response: unauthorized() } as const;
  if (isAdminSupportSession(session)) {
    return {
      response: NextResponse.json(
        { ok: false, error: 'Exit admin support mode before transferring an asset.' },
        { status: 403 },
      ),
    } as const;
  }
  const accountAccess = await getAssetRegisterAccountAccess(session);
  if (!accountAccess) {
    return {
      response: NextResponse.json(
        { ok: false, error: 'Asset transfers are available to Owner accounts and authorised Dealer inventory staff.' },
        { status: 403 },
      ),
    } as const;
  }
  return { session, accountAccess } as const;
}

function claimedAssetRedirect(input: {
  accountType: 'owner' | 'dealer';
  dealerAppSession: boolean;
  registerId: string;
  registerIsPrimary: boolean;
  assetId: string;
}): string {
  const params = new URLSearchParams();
  if (input.accountType === 'dealer') {
    params.set('dealerView', input.registerIsPrimary ? 'dealer' : 'client');
  }
  params.set('registerId', input.registerId);
  params.set('assetId', input.assetId);

  const basePath = input.accountType === 'dealer' && input.dealerAppSession
    ? '/dealer/inventory'
    : '/asset-register';
  return `${basePath}?${params.toString()}`;
}

function errorResponse(error: unknown) {
  const code = error instanceof Error ? error.message : '';
  const databaseCode = error && typeof error === 'object' && 'code' in error
    ? String((error as { code?: unknown }).code ?? '')
    : '';
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
  if (code === 'ASSET_TRANSFER_DEALER_ACCOUNT_REQUIRED') {
    return NextResponse.json(
      { ok: false, error: 'This trade-in code can only be claimed by an active Dealer account.' },
      { status: 400 },
    );
  }
  if (code === 'ASSET_TRANSFER_ACCOUNT_REQUIRED') {
    return NextResponse.json(
      { ok: false, error: 'Use an active Owner or Dealer account to claim this asset.' },
      { status: 403 },
    );
  }
  if (code === 'ASSET_TRANSFER_REGISTER_NOT_FOUND') {
    return NextResponse.json(
      { ok: false, error: 'Choose an Asset Register that belongs to this account.' },
      { status: 400 },
    );
  }
  if (code === 'ASSET_TRANSFER_NOT_FOUND') {
    return NextResponse.json({ ok: false, error: 'This pending transfer was not found.' }, { status: 404 });
  }
  if (databaseCode === '40P01' || databaseCode === '40001') {
    console.error('Asset transfer request hit transient database contention.', error);
    return NextResponse.json(
      { ok: false, error: 'The asset database is briefly busy. No changes were made; please try the transfer again.' },
      { status: 503 },
    );
  }
  console.error('Asset transfer request failed.', error);
  return NextResponse.json({ ok: false, error: 'The asset transfer could not be completed.' }, { status: 500 });
}

export async function GET() {
  const access = await requireTransferSession();
  if ('response' in access) return access.response;
  try {
    const outgoing = await listOutgoingAssetTransfers(access.session.user.id);
    return NextResponse.json({ ok: true, outgoing });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  const access = await requireTransferSession();
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
        targetRegisterId: body.targetRegisterId,
      });
      return NextResponse.json({
        ok: true,
        claimed: {
          ...claimed,
          redirectTo: claimedAssetRedirect({
            accountType: access.accountAccess.accountType,
            dealerAppSession: isDealerAppSession(access.session),
            registerId: claimed.registerId,
            registerIsPrimary: claimed.registerIsPrimary,
            assetId: claimed.assetId,
          }),
        },
      });
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
