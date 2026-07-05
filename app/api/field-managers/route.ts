import { NextRequest, NextResponse } from 'next/server';
import { getAccountProfile } from '../../../lib/account-profile';
import { getServerSession } from '../../../lib/auth-session';
import { createFieldManager, listFieldManagers } from '../../../lib/field-manager';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

export async function GET() {
  const access = await requireOwnerSession();

  if (!access.ok) {
    return access.response;
  }

  try {
    const managers = await listFieldManagers(access.userId);
    return NextResponse.json({ ok: true, managers });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: extractErrorMessage(error, 'Failed to load Field Manager logins.') },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
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
    const manager = await createFieldManager(access.userId, body && typeof body === 'object' ? body : {});
    return NextResponse.json({ ok: true, manager });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: extractErrorMessage(error, 'Failed to create Field Manager login.') },
      { status: 400 },
    );
  }
}
