import { NextRequest, NextResponse } from 'next/server';
import { recordAdminUsageEventSafely } from '../../../lib/admin-usage-events';
import { getServerSession, isAdminSupportSession } from '../../../lib/auth-session';
import { getAssetRegisterAccountAccess } from '../../../lib/asset-register-account-access';
import {
  createAssetRegister,
  deleteAssetRegister,
  getSelectedAssetRegister,
  listAssetRegisters,
  selectAssetRegister,
  updateAssetRegister,
} from '../../../lib/asset-registers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type AssetRegisterBody = {
  action?: unknown;
  registerId?: unknown;
  targetRegisterId?: unknown;
  businessName?: unknown;
  email?: unknown;
  phone?: unknown;
  address?: unknown;
  addressLine1?: unknown;
  logoUrls?: unknown;
  showLogosOnRegister?: unknown;
};

function unauthorized() {
  return NextResponse.json({ ok: false, error: 'You must be signed in.' }, { status: 401 });
}

async function requireAssetRegisterAccount(session: Awaited<ReturnType<typeof getServerSession>>) {
  if (!await getAssetRegisterAccountAccess(session)) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Asset Registers are available to active Owner accounts and authorised Dealer inventory staff.',
      },
      { status: 403 },
    );
  }

  return null;
}

function readRegisterInput(body: AssetRegisterBody) {
  const input: {
    businessName: string;
    email: string;
    phone: string;
    addressLine1: string;
    logoUrls?: string[] | null;
    showLogosOnRegister?: boolean | null;
  } = {
    businessName: String(body.businessName ?? '').trim(),
    email: String(body.email ?? '').trim(),
    phone: String(body.phone ?? '').trim(),
    addressLine1: String(body.addressLine1 ?? body.address ?? '').trim(),
  };

  if (Object.prototype.hasOwnProperty.call(body, 'logoUrls')) {
    input.logoUrls = Array.isArray(body.logoUrls)
      ? body.logoUrls.map((logoUrl) => String(logoUrl ?? '').trim()).filter(Boolean).slice(0, 1)
      : [];
  }

  if (Object.prototype.hasOwnProperty.call(body, 'showLogosOnRegister')) {
    const normalizedVisibility = String(body.showLogosOnRegister ?? '').trim().toLowerCase();
    input.showLogosOnRegister = typeof body.showLogosOnRegister === 'boolean'
      ? body.showLogosOnRegister
      : !['false', '0', 'no', 'off', 'hide', 'hidden'].includes(normalizedVisibility);
  }

  return input;
}

function getUsageUserId(session: Awaited<ReturnType<typeof getServerSession>>): string | null {
  if (!session?.user?.id || isAdminSupportSession(session)) {
    return null;
  }

  return session.user.id;
}

function errorResponse(error: unknown, fallback: string) {
  if (error instanceof Error) {
    if (error.message === 'ASSET_REGISTER_NAME_REQUIRED') {
      return NextResponse.json({ ok: false, error: 'Business name is required.' }, { status: 400 });
    }

    if (error.message === 'ASSET_REGISTER_NOT_FOUND') {
      return NextResponse.json({ ok: false, error: 'Asset register not found.' }, { status: 404 });
    }

    if (error.message === 'ASSET_REGISTER_LAST_REGISTER') {
      return NextResponse.json({ ok: false, error: 'You must keep at least one asset register on the account.' }, { status: 400 });
    }

    if (error.message === 'ASSET_REGISTER_DELETE_TARGET_REQUIRED') {
      return NextResponse.json(
        { ok: false, error: 'Choose another asset register to receive these assets before removing this register.' },
        { status: 400 },
      );
    }

    if (error.message === 'ASSET_REGISTER_DELETE_TARGET_INVALID') {
      return NextResponse.json({ ok: false, error: 'Choose a different target asset register.' }, { status: 400 });
    }

    if (error.message) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: false, error: fallback }, { status: 500 });
}

export async function GET() {
  const session = await getServerSession({ allowDealerApp: true });

  if (!session?.user?.id) {
    return unauthorized();
  }

  const ownerError = await requireAssetRegisterAccount(session);
  if (ownerError) return ownerError;

  try {
    const registers = await listAssetRegisters(session.user.id);
    const selectedRegister = registers.find((register) => register.isSelected) ?? await getSelectedAssetRegister(session.user.id);
    return NextResponse.json({ ok: true, registers, selectedRegister });
  } catch (error) {
    console.error('asset registers GET failed', error);
    return errorResponse(error, 'Failed to load asset registers.');
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession({ allowDealerApp: true });

  if (!session?.user?.id) {
    return unauthorized();
  }

  const ownerError = await requireAssetRegisterAccount(session);
  if (ownerError) return ownerError;

  try {
    const body = (await request.json()) as AssetRegisterBody;
    const register = await createAssetRegister(session.user.id, readRegisterInput(body));
    await recordAdminUsageEventSafely({
      userId: getUsageUserId(session),
      eventType: 'asset_register_created',
      eventSource: 'asset-registers',
      metadata: { registerId: register.id },
    });
    const registers = await listAssetRegisters(session.user.id);
    const selectedRegister = registers.find((entry) => entry.isSelected) ?? await getSelectedAssetRegister(session.user.id);
    return NextResponse.json({ ok: true, register, registers, selectedRegister });
  } catch (error) {
    console.error('asset registers POST failed', error);
    return errorResponse(error, 'Failed to create asset register.');
  }
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession({ allowDealerApp: true });

  if (!session?.user?.id) {
    return unauthorized();
  }

  const ownerError = await requireAssetRegisterAccount(session);
  if (ownerError) return ownerError;

  try {
    const body = (await request.json()) as AssetRegisterBody;
    const registerId = String(body.registerId ?? '').trim();

    if (!registerId) {
      return NextResponse.json({ ok: false, error: 'Asset register id is required.' }, { status: 400 });
    }

    const action = String(body.action ?? '').trim().toLowerCase();
    const register = action === 'select'
      ? await selectAssetRegister(session.user.id, registerId)
      : await updateAssetRegister(session.user.id, registerId, readRegisterInput(body));
    const registers = await listAssetRegisters(session.user.id);
    const selectedRegister = registers.find((entry) => entry.isSelected) ?? await getSelectedAssetRegister(session.user.id);
    return NextResponse.json({ ok: true, register, registers, selectedRegister });
  } catch (error) {
    console.error('asset registers PUT failed', error);
    return errorResponse(error, 'Failed to update asset register.');
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getServerSession({ allowDealerApp: true });

  if (!session?.user?.id) {
    return unauthorized();
  }

  const ownerError = await requireAssetRegisterAccount(session);
  if (ownerError) return ownerError;

  try {
    const body = (await request.json().catch(() => ({}))) as AssetRegisterBody;
    const registerId = String(body.registerId ?? '').trim();
    const targetRegisterId = String(body.targetRegisterId ?? '').trim();

    if (!registerId) {
      return NextResponse.json({ ok: false, error: 'Asset register id is required.' }, { status: 400 });
    }

    const result = await deleteAssetRegister({
      userId: session.user.id,
      registerId,
      targetRegisterId: targetRegisterId || null,
    });
    const registers = await listAssetRegisters(session.user.id);
    const selectedRegister = registers.find((entry) => entry.isSelected) ?? result.selectedRegister;

    return NextResponse.json({
      ok: true,
      deletedRegisterId: result.deletedRegisterId,
      movedCount: result.movedCount,
      registers,
      selectedRegister,
    });
  } catch (error) {
    console.error('asset registers DELETE failed', error);
    return errorResponse(error, 'Failed to remove asset register.');
  }
}
