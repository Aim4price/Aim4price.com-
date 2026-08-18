import { NextRequest, NextResponse } from 'next/server';
import { isAim4priceAdminEmail } from '../../../../lib/account-constants';
import { getAnyServerSession } from '../../../../lib/auth-session';
import {
  ASSISTANCE_MASTER_DEFINITIONS,
  listAssistanceNetworkForAdmin,
  setAssistanceEnabled,
  type AssistanceServiceKey,
} from '../../../../lib/assistance-network';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function error(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

async function requireAdminSession() {
  const session = await getAnyServerSession();
  if (!session?.user?.id) return { session: null, response: error('Not authenticated.', 401) };
  if (!isAim4priceAdminEmail(session.user.email)) {
    return { session: null, response: error('Admin access required.', 403) };
  }
  return { session, response: null };
}

function isServiceKey(value: unknown): value is AssistanceServiceKey {
  return typeof value === 'string'
    && ASSISTANCE_MASTER_DEFINITIONS.some((entry) => entry.serviceKey === value);
}

export async function GET() {
  const authorization = await requireAdminSession();
  if (authorization.response) return authorization.response;
  try {
    const accounts = await listAssistanceNetworkForAdmin();
    return NextResponse.json({ ok: true, accounts });
  } catch (requestError) {
    console.error('assistance network admin GET failed', requestError);
    return error('Failed to load the assistance network.', 500);
  }
}

export async function PATCH(request: NextRequest) {
  const authorization = await requireAdminSession();
  if (authorization.response) return authorization.response;
  if (!authorization.session) return error('Not authenticated.', 401);

  let body: { serviceKey?: unknown; locationId?: unknown; enabled?: unknown };
  try {
    body = await request.json() as typeof body;
  } catch {
    return error('Send a valid update.', 400);
  }

  if (!isServiceKey(body.serviceKey) || typeof body.enabled !== 'boolean') {
    return error('Choose a valid service and enabled state.', 400);
  }
  if (typeof body.locationId !== 'undefined' && body.locationId !== null && typeof body.locationId !== 'string') {
    return error('Choose a valid service location.', 400);
  }

  try {
    await setAssistanceEnabled({
      actorUserId: authorization.session.user.id,
      serviceKey: body.serviceKey,
      locationId: typeof body.locationId === 'string' ? body.locationId : null,
      enabled: body.enabled,
    });
    const accounts = await listAssistanceNetworkForAdmin();
    return NextResponse.json({ ok: true, accounts });
  } catch (requestError) {
    console.error('assistance network admin PATCH failed', requestError);
    const message = requestError instanceof Error && requestError.message === 'ASSISTANCE_LOCATION_NOT_FOUND'
      ? 'Service location not found.'
      : 'Failed to update the assistance network.';
    return error(message, requestError instanceof Error && requestError.message === 'ASSISTANCE_LOCATION_NOT_FOUND' ? 404 : 500);
  }
}
