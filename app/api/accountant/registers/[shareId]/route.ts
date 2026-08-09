import { NextRequest, NextResponse } from 'next/server';
import {
  accountantWorkspaceError,
  getAccountantRegisterData,
  removeAccountantRegisterAccess,
} from '../../../../../lib/accountant-workspace';
import { registerValueForAssets } from '../../../../../lib/asset-groups-shared';
import { getServerSession } from '../../../../../lib/auth-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: { shareId: string } };

function respond(error: unknown) {
  const mapped = accountantWorkspaceError(error);
  return NextResponse.json({ ok: false, error: mapped.message }, { status: mapped.status });
}

export async function GET(request: NextRequest, context: Context) {
  const session = await getServerSession();
  if (!session?.user?.id) return NextResponse.json({ ok: false, error: 'You must be signed in.' }, { status: 401 });
  try {
    const data = await getAccountantRegisterData(session.user.id, context.params.shareId, {
      registerId: request.nextUrl.searchParams.get('registerId'),
      combined: request.nextUrl.searchParams.get('scope') === 'combined',
    });
    return NextResponse.json({
      ok: true,
      ...data,
      summary: {
        count: data.items.length,
        totalValue: registerValueForAssets(data.items, data.groups),
      },
    });
  } catch (error) {
    console.error('accountant register GET failed', error);
    return respond(error);
  }
}

export async function DELETE(_request: NextRequest, context: Context) {
  const session = await getServerSession();
  if (!session?.user?.id) return NextResponse.json({ ok: false, error: 'You must be signed in.' }, { status: 401 });
  try {
    await removeAccountantRegisterAccess(session.user.id, context.params.shareId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('accountant register DELETE failed', error);
    return respond(error);
  }
}
