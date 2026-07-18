import { NextRequest, NextResponse } from 'next/server';
import { getAccountProfile } from '../../../../lib/account-profile';
import { getServerSession, isOwnerAppSession } from '../../../../lib/auth-session';
import { createOwnerAppUser, listOwnerAppUsers } from '../../../../lib/owner-app';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function requireManagingOwner() {
  const session = await getServerSession();
  if (!session?.user?.id || isOwnerAppSession(session)) return null;
  const profile = await getAccountProfile({
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
  });
  return profile.accountType === 'owner' && profile.accountStatus === 'active'
    ? session.user.id
    : null;
}

function errorResponse(error: unknown, fallback: string) {
  const message = error instanceof Error && error.message ? error.message : fallback;
  const status = /username|password|passcode|display name|enter/i.test(message) ? 400 : 500;
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function GET() {
  const ownerUserId = await requireManagingOwner();
  if (!ownerUserId) {
    return NextResponse.json({ ok: false, error: 'Owner App access is available to active owner accounts only.' }, { status: 403 });
  }

  try {
    return NextResponse.json({ ok: true, users: await listOwnerAppUsers(ownerUserId) });
  } catch (error) {
    console.error('Owner App users GET failed.', error);
    return errorResponse(error, 'Failed to load Owner App users.');
  }
}

export async function POST(request: NextRequest) {
  const ownerUserId = await requireManagingOwner();
  if (!ownerUserId) {
    return NextResponse.json({ ok: false, error: 'Owner App access is available to active owner accounts only.' }, { status: 403 });
  }

  try {
    const user = await createOwnerAppUser(ownerUserId, await request.json() as Record<string, unknown>);
    return NextResponse.json({ ok: true, user }, { status: 201 });
  } catch (error) {
    console.error('Owner App user POST failed.', error);
    return errorResponse(error, 'Failed to create Owner App user.');
  }
}
