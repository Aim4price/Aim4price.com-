import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '../../../../../../lib/auth-session';
import { getAccountantRegisterAccess } from '../../../../../../lib/accountant-workspace';
import {
  createAssetRegister,
  deleteAssetRegister,
  getAssetRegisterForUser,
  listAssetRegisters,
  updateAssetRegister,
} from '../../../../../../lib/asset-registers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: { shareId: string } };
type Body = {
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

function input(body: Body) {
  return {
    businessName: String(body.businessName ?? '').trim(),
    email: String(body.email ?? '').trim(),
    phone: String(body.phone ?? '').trim(),
    addressLine1: String(body.addressLine1 ?? body.address ?? '').trim(),
    ...(Object.prototype.hasOwnProperty.call(body, 'logoUrls')
      ? { logoUrls: Array.isArray(body.logoUrls) ? body.logoUrls.map(String).filter(Boolean).slice(0, 1) : [] }
      : {}),
    ...(Object.prototype.hasOwnProperty.call(body, 'showLogosOnRegister')
      ? { showLogosOnRegister: Boolean(body.showLogosOnRegister) }
      : {}),
  };
}

function failure(error: unknown) {
  const message = error instanceof Error ? error.message : 'Failed to manage the client asset registers.';
  const status = message.includes('NOT_FOUND') ? 404 : message.includes('REQUIRED') || message.includes('LAST_REGISTER') || message.includes('INVALID') ? 400 : 500;
  return NextResponse.json({ ok: false, error: message }, { status });
}

async function ownerId(shareId: string) {
  const session = await getServerSession();
  if (!session?.user?.id) return { error: NextResponse.json({ ok: false, error: 'You must be signed in.' }, { status: 401 }) };
  const access = await getAccountantRegisterAccess({ accountantUserId: session.user.id, shareId });
  return { ownerUserId: access.ownerUserId, access };
}

export async function GET(_request: NextRequest, context: Context) {
  try {
    const resolved = await ownerId(context.params.shareId);
    if (resolved.error) return resolved.error;
    const registers = await listAssetRegisters(resolved.ownerUserId!);
    const selectedRegister = registers.find((entry) => entry.isSelected) ?? registers.find((entry) => entry.id === resolved.access!.registerId) ?? registers[0] ?? null;
    return NextResponse.json({ ok: true, registers, selectedRegister });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const resolved = await ownerId(context.params.shareId);
    if (resolved.error) return resolved.error;
    const body = (await request.json()) as Body;
    const register = await createAssetRegister(resolved.ownerUserId!, input(body));
    const registers = await listAssetRegisters(resolved.ownerUserId!);
    return NextResponse.json({ ok: true, register, registers, selectedRegister: register });
  } catch (error) {
    return failure(error);
  }
}

export async function PUT(request: NextRequest, context: Context) {
  try {
    const resolved = await ownerId(context.params.shareId);
    if (resolved.error) return resolved.error;
    const body = (await request.json()) as Body;
    const registerId = String(body.registerId ?? '').trim();
    const register = String(body.action ?? '').trim().toLowerCase() === 'select'
      ? await getAssetRegisterForUser(resolved.ownerUserId!, registerId)
      : await updateAssetRegister(resolved.ownerUserId!, registerId, input(body));
    if (!register) throw new Error('ASSET_REGISTER_NOT_FOUND');
    const registers = await listAssetRegisters(resolved.ownerUserId!);
    return NextResponse.json({ ok: true, register, registers, selectedRegister: register });
  } catch (error) {
    return failure(error);
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    const resolved = await ownerId(context.params.shareId);
    if (resolved.error) return resolved.error;
    const body = (await request.json().catch(() => ({}))) as Body;
    const result = await deleteAssetRegister({
      userId: resolved.ownerUserId!,
      registerId: String(body.registerId ?? '').trim(),
      targetRegisterId: String(body.targetRegisterId ?? '').trim() || null,
    });
    const registers = await listAssetRegisters(resolved.ownerUserId!);
    return NextResponse.json({ ok: true, ...result, registers, selectedRegister: result.selectedRegister });
  } catch (error) {
    return failure(error);
  }
}
