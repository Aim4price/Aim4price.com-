import { NextRequest, NextResponse } from 'next/server';
import { getAccountProfile } from '../../../../lib/account-profile';
import { getServerSession } from '../../../../lib/auth-session';
import { deleteFieldManager, updateFieldManager } from '../../../../lib/field-manager';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: {
    managerId: string;
  };
};

function unauthorized() {
  return NextResponse.json({ ok: false, error: 'You must be signed in.' }, { status: 401 });
}

function forbidden() {
  return NextResponse.json({ ok: false, error: 'Field Manager is only available to owner accounts.' }, { status: 403 });
}

function extractErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

async function requireOwnerSession() {
  const session = await getServerSession();

  if (!session?.user?.id) {
    return { ok: false as const, response: unauthorized() };
  }

  const profile = await getAccountProfile({
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
  });

  if (profile.accountType !== 'owner') {
    return { ok: false as const, response: forbidden() };
  }

  return { ok: true as const, userId: session.user.id };
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const access = await requireOwnerSession();

  if (!access.ok) {
    return access.response;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Enter valid Field Manager details.' }, { status: 400 });
  }

  try {
    const manager = await updateFieldManager(
      access.userId,
      String(context.params?.managerId ?? ''),
      body && typeof body === 'object' ? body : {},
    );
    return NextResponse.json({ ok: true, manager });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: extractErrorMessage(error, 'Failed to update Field Manager login.') },
      { status: 400 },
    );
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const access = await requireOwnerSession();

  if (!access.ok) {
    return access.response;
  }

  try {
    await deleteFieldManager(access.userId, String(context.params?.managerId ?? ''));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: extractErrorMessage(error, 'Failed to delete Field Manager login.') },
      { status: 400 },
    );
  }
}

