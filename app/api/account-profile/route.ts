import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '../../../lib/auth-session';
import {
  getAccountProfile,
  upsertAccountProfile,
  type UpsertAccountProfileInput,
} from '../../../lib/account-profile';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function unauthorized() {
  return NextResponse.json({ ok: false, error: 'You must be signed in.' }, { status: 401 });
}

export async function GET() {
  const session = await getServerSession();

  if (!session?.user?.id) {
    return unauthorized();
  }

  const profile = await getAccountProfile({
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
  });

  return NextResponse.json({ ok: true, profile });
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession();

  if (!session?.user?.id) {
    return unauthorized();
  }

  const body = (await request.json()) as UpsertAccountProfileInput;

  const profile = await upsertAccountProfile(
    {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
    },
    body,
  );

  return NextResponse.json({ ok: true, profile });
}
