import { NextRequest, NextResponse } from 'next/server';
import { getAccountProfile } from '../../../../../../lib/account-profile';
import { getServerSession } from '../../../../../../lib/auth-session';
import { listFuelLedger, recordMissingFuelAssetIssue } from '../../../../../../lib/fuel-ledger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: { storageId: string } };

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

async function requireOwnerSession() {
  const session = await getServerSession({ requireActive: true });
  if (!session?.user?.id) {
    return { ok: false as const, response: NextResponse.json({ ok: false, error: 'You must be signed in.' }, { status: 401 }) };
  }
  const profile = await getAccountProfile({ id: session.user.id, name: session.user.name, email: session.user.email });
  if (String(profile.accountType).toLowerCase() !== 'owner') {
    return { ok: false as const, response: NextResponse.json({ ok: false, error: 'Missing fuel entries are only available to owner accounts.' }, { status: 403 }) };
  }
  return { ok: true as const, session };
}

export async function POST(request: NextRequest, context: RouteContext) {
  const access = await requireOwnerSession();
  if (!access.ok) return access.response;

  let payload: Record<string, unknown> = {};
  let evidenceFile: File | null = null;

  try {
    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const rawPayload = formData.get('payload');
      if (typeof rawPayload !== 'string') throw new Error('Missing entry details were not supplied.');
      payload = JSON.parse(rawPayload) as Record<string, unknown>;
      const candidate = formData.get('evidence');
      evidenceFile = candidate instanceof File && candidate.size > 0 ? candidate : null;
    } else {
      const body = await request.json();
      payload = body && typeof body === 'object' ? body as Record<string, unknown> : {};
    }
  } catch (error) {
    return NextResponse.json({ ok: false, error: errorMessage(error, 'Enter valid missing fuel entry details.') }, { status: 400 });
  }

  try {
    const result = await recordMissingFuelAssetIssue({
      ...payload,
      userId: access.session.user.id,
      addedByName: access.session.user.name,
      addedByEmail: access.session.user.email,
      storageId: context.params.storageId,
      evidenceFile,
    });
    const ledger = await listFuelLedger(access.session.user.id);
    return NextResponse.json({ ok: true, ...result, ...ledger, message: 'Missing fuel entry saved' });
  } catch (error) {
    return NextResponse.json({ ok: false, error: errorMessage(error, 'Failed to save the missing fuel entry.') }, { status: 400 });
  }
}
