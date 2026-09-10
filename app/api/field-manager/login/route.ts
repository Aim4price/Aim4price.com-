import { cookies } from 'next/headers';
import { removePushDevice } from '../../../../lib/push-store';
import { isTrustedNotificationRequest } from '../../../../lib/notification-request-origin';
import { NextRequest, NextResponse } from 'next/server';
import { getAccountProfile } from '../../../../lib/account-profile';
import {
  getFieldManagerByUsername,
  isFieldManagerLoginLocked,
  markFieldManagerLastLogin,
  recordFieldManagerLoginFailure,
  verifyFieldManagerPassword,
} from '../../../../lib/field-manager';
import {
  applyFieldManagerSessionCookie,
  clearFieldManagerFuelScanCookie,
  clearFieldManagerScanCookie,
  clearFieldManagerSessionCookie,
} from '../../../../lib/field-manager-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type LoginRequest = {
  username?: unknown;
  password?: unknown;
};

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function extractErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

export async function POST(request: NextRequest) {
  let body: LoginRequest;

  try {
    body = (await request.json()) as LoginRequest;
  } catch {
    return NextResponse.json({ ok: false, error: 'Enter a valid Field Manager username and password.' }, { status: 400 });
  }

  const username = asText(body.username);
  const password = typeof body.password === 'string' ? body.password : '';

  if (!username || !password) {
    return NextResponse.json({ ok: false, error: 'Enter your Field Manager username and password.' }, { status: 400 });
  }

  try {
    const manager = await getFieldManagerByUsername(username);

    if (!manager || !manager.passwordHash) {
      return NextResponse.json({ ok: false, error: 'Incorrect Field Manager username or password.' }, { status: 401 });
    }

    if (isFieldManagerLoginLocked(manager)) {
      return NextResponse.json({ ok: false, error: 'Too many incorrect attempts. Try again in 15 minutes.' }, { status: 429 });
    }

    const passwordMatches = await verifyFieldManagerPassword(password, manager.passwordHash);

    if (!passwordMatches) {
      const locked = await recordFieldManagerLoginFailure(manager.id);
      if (locked) {
        return NextResponse.json({ ok: false, error: 'Too many incorrect attempts. Try again in 15 minutes.' }, { status: 429 });
      }
      return NextResponse.json({ ok: false, error: 'Incorrect Field Manager username or password.' }, { status: 401 });
    }

    if (!manager.isActive) {
      return NextResponse.json({ ok: false, error: 'This Field Manager login is inactive.' }, { status: 403 });
    }

    const profile = await getAccountProfile({ id: manager.ownerUserId, name: null, email: null });
    await markFieldManagerLastLogin(manager.id);

    const response = NextResponse.json({
      ok: true,
      manager: {
        id: manager.id,
        displayName: manager.displayName,
        username: manager.username,
      },
      welcome: {
        displayName: manager.displayName || manager.username,
        companyName: profile.businessName || profile.displayName || profile.name || 'Aim4price',
        logoUrl: profile.logoUrl || '/icon.png',
      },
      redirectTo: '/field-manager',
    });

    applyFieldManagerSessionCookie(response, manager);
    clearFieldManagerScanCookie(response);
    clearFieldManagerFuelScanCookie(response);
    return response;
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: extractErrorMessage(error, 'Failed to sign in to Field Manager.') },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  if (!isTrustedNotificationRequest(request)) return NextResponse.json({ ok: false }, { status: 403 });
  await removePushDevice('field', cookies().get('aim4price_push_field')?.value);
  const response = NextResponse.json({ ok: true });
  response.cookies.set('aim4price_push_field', '', { httpOnly: true, path: '/', maxAge: 0 });
  clearFieldManagerSessionCookie(response);
  clearFieldManagerScanCookie(response);
  clearFieldManagerFuelScanCookie(response);
  return response;
}
