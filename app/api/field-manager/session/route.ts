import { isTrustedNotificationRequest } from '../../../../lib/notification-request-origin';
import { NextRequest, NextResponse } from 'next/server';
import { applyFieldManagerSessionCookie, requireActiveFieldManagerSession } from '../../../../lib/field-manager-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const access = await requireActiveFieldManagerSession(request);

  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.error }, { status: access.status });
  }

  return NextResponse.json({
    ok: true,
    manager: {
      id: access.session.managerId,
      displayName: access.session.displayName,
      username: access.session.username,
    },
  });
}

export async function POST(request: NextRequest) {
  if (!isTrustedNotificationRequest(request)) return NextResponse.json({ ok: false }, { status: 403 });
  const access = await requireActiveFieldManagerSession(request);
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: access.status });
  const response = NextResponse.json({ ok: true });
  applyFieldManagerSessionCookie(response, {
    id: access.session.managerId,
    ownerUserId: access.session.ownerUserId,
    username: access.session.username,
    displayName: access.session.displayName,
    sessionVersion: access.session.sessionVersion,
  }, access.session.sessionId);
  return response;
}
