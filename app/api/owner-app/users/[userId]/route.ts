import { NextRequest, NextResponse } from 'next/server';
import { getAccountProfile } from '../../../../../lib/account-profile';
import { getServerSession, isOwnerAppSession } from '../../../../../lib/auth-session';
import { deleteOwnerAppUser, updateOwnerAppUser } from '../../../../../lib/owner-app';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function requireManagingOwner() {
  const session = await getServerSession();
  if (!session?.user?.id || isOwnerAppSession(session)) return null;
  const profile = await getAccountProfile({ id: session.user.id, name: session.user.name, email: session.user.email });
  return profile.accountType === 'owner' && profile.accountStatus === 'active' ? session.user.id : null;
}

function errorResponse(error: unknown, fallback: string) {
  const message = error instanceof Error && error.message ? error.message : fallback;
  const status = /not found/i.test(message) ? 404 : /username|password|passcode|display name|enter/i.test(message) ? 400 : 500;
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function PATCH(request: NextRequest, { params }: { params: { userId: string } }) {
  const ownerUserId = await requireManagingOwner();
  if (!ownerUserId) {
    return NextResponse.json({ ok: false, error: 'Owner App access is available to active owner accounts only.' }, { status: 403 });
  }

  try {
    const user = await updateOwnerAppUser(ownerUserId, params.userId, await request.json() as Record<string, unknown>);
    return NextResponse.json({ ok: true, user });
  } catch (error) {
    console.error('Owner App user PATCH failed.', error);
    return errorResponse(error, 'Failed to update Owner App user.');
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { userId: string } }) {
  const ownerUserId = await requireManagingOwner();
  if (!ownerUserId) {
    return NextResponse.json({ ok: false, error: 'Owner App access is available to active owner accounts only.' }, { status: 403 });
  }

  try {
    await deleteOwnerAppUser(ownerUserId, params.userId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Owner App user DELETE failed.', error);
    return errorResponse(error, 'Failed to delete Owner App user.');
  }
}
