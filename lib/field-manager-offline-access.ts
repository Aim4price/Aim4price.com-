import { NextRequest, NextResponse } from 'next/server';
import { isTrustedNotificationRequest } from './notification-request-origin';
import { requireActiveFieldManagerSession } from './field-manager-session';

export const offlineHeaders = { 'Cache-Control': 'private, no-store' };
export async function requireOfflineIdentity(request: NextRequest) {
  const access = await requireActiveFieldManagerSession(request);
  if (!access.ok) return { ok: false as const, response: NextResponse.json({ ok: false, error: access.error }, { status: access.status, headers: offlineHeaders }) };
  const identity = `${access.session.ownerUserId}:${access.session.managerId}`;
  if (request.method !== 'GET') {
    if (!isTrustedNotificationRequest(request)) {
      return { ok: false as const, response: NextResponse.json({ ok: false, error: 'Open offline work from Aim4price.' }, { status: 403, headers: offlineHeaders }) };
    }
    if (request.headers.get('x-aim4price-offline-identity') !== identity) {
      return { ok: false as const, response: NextResponse.json({ ok: false, error: 'Sign in to the Field Manager account that saved this work.' }, { status: 409, headers: offlineHeaders }) };
    }
  }
  return { ok: true as const, identity, session: access.session };
}
