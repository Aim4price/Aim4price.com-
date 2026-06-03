import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '../../../lib/auth-session';
import { getAccountProfile } from '../../../lib/account-profile';
import {
  createAssetRegister,
  listAssetRegisters,
  updateAssetRegister,
} from '../../../lib/asset-registers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type AssetRegisterBody = {
  registerId?: unknown;
  businessName?: unknown;
  email?: unknown;
  phone?: unknown;
  address?: unknown;
  addressLine1?: unknown;
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
        error: 'Asset Registers are only available to owner accounts.',
      },
      { status: 403 },
    );
  }

  return null;
}

function readRegisterInput(body: AssetRegisterBody) {
  return {
    businessName: String(body.businessName ?? '').trim(),
    email: String(body.email ?? '').trim(),
    phone: String(body.phone ?? '').trim(),
    addressLine1: String(body.addressLine1 ?? body.address ?? '').trim(),
  };
}

function errorResponse(error: unknown, fallback: string) {
  if (error instanceof Error) {
    if (error.message === 'ASSET_REGISTER_NAME_REQUIRED') {
      return NextResponse.json({ ok: false, error: 'Business name is required.' }, { status: 400 });
    }

    if (error.message === 'ASSET_REGISTER_NOT_FOUND') {
      return NextResponse.json({ ok: false, error: 'Asset register not found.' }, { status: 404 });
    }

    if (error.message) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: false, error: fallback }, { status: 500 });
}

export async function GET() {
  const session = await getServerSession();

  if (!session?.user?.id) {
    return unauthorized();
  }

  const ownerError = await requireOwnerAccount(session.user);
  if (ownerError) return ownerError;

  try {
    const registers = await listAssetRegisters(session.user.id);
    return NextResponse.json({ ok: true, registers });
  } catch (error) {
    console.error('asset registers GET failed', error);
    return errorResponse(error, 'Failed to load asset registers.');
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession();

  if (!session?.user?.id) {
    return unauthorized();
  }

  const ownerError = await requireOwnerAccount(session.user);
  if (ownerError) return ownerError;

  try {
    const body = (await request.json()) as AssetRegisterBody;
    const register = await createAssetRegister(session.user.id, readRegisterInput(body));
    const registers = await listAssetRegisters(session.user.id);
    return NextResponse.json({ ok: true, register, registers });
  } catch (error) {
    console.error('asset registers POST failed', error);
    return errorResponse(error, 'Failed to create asset register.');
  }
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession();

  if (!session?.user?.id) {
    return unauthorized();
  }

  const ownerError = await requireOwnerAccount(session.user);
  if (ownerError) return ownerError;

  try {
    const body = (await request.json()) as AssetRegisterBody;
    const registerId = String(body.registerId ?? '').trim();

    if (!registerId) {
      return NextResponse.json({ ok: false, error: 'Asset register id is required.' }, { status: 400 });
    }

    const register = await updateAssetRegister(session.user.id, registerId, readRegisterInput(body));
    const registers = await listAssetRegisters(session.user.id);
    return NextResponse.json({ ok: true, register, registers });
  } catch (error) {
    console.error('asset registers PUT failed', error);
    return errorResponse(error, 'Failed to update asset register.');
  }
}
