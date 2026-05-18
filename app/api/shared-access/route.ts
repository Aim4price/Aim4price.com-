import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '../../../lib/auth-session';
import {
  createSharedAccessRequest,
  listSharedAccessForOwner,
  normalizePartnerType,
} from '../../../lib/partner-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type CreateSharedAccessBody = {
  partnerUserId?: unknown;
  partnerType?: unknown;
  ownerMessage?: unknown;
  includeDocuments?: unknown;
  includeScanHistory?: unknown;
};

function unauthorized() {
  return NextResponse.json({ ok: false, error: 'You must be signed in.' }, { status: 401 });
}

function responseForError(error: unknown) {
  if (error instanceof Error) {
    if (error.message === 'PARTNER_NOT_FOUND') {
      return NextResponse.json({ ok: false, error: 'Selected partner could not be found.' }, { status: 404 });
    }

    if (error.message === 'CANNOT_SHARE_WITH_SELF') {
      return NextResponse.json({ ok: false, error: 'You cannot share a register with the same account.' }, { status: 400 });
    }
  }

  console.error('shared access failed', error);
  return NextResponse.json({ ok: false, error: 'Failed to update shared access.' }, { status: 500 });
}

export async function GET() {
  const session = await getServerSession();

  if (!session?.user?.id) {
    return unauthorized();
  }

  try {
    const grants = await listSharedAccessForOwner(session.user.id);
    return NextResponse.json({ ok: true, grants });
  } catch (error) {
    return responseForError(error);
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession();

  if (!session?.user?.id) {
    return unauthorized();
  }

  let body: CreateSharedAccessBody;

  try {
    body = (await request.json()) as CreateSharedAccessBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'Send a valid sharing request.' }, { status: 400 });
  }

  const partnerUserId = String(body.partnerUserId ?? '').trim();
  const partnerType = normalizePartnerType(body.partnerType);

  if (!partnerUserId || !partnerType) {
    return NextResponse.json({ ok: false, error: 'Choose a valid partner.' }, { status: 400 });
  }

  try {
    const grant = await createSharedAccessRequest({
      ownerUserId: session.user.id,
      partnerUserId,
      partnerType,
      ownerMessage: typeof body.ownerMessage === 'string' ? body.ownerMessage : null,
      includeDocuments: body.includeDocuments !== false,
      includeScanHistory: body.includeScanHistory !== false,
    });

    return NextResponse.json({ ok: true, grant });
  } catch (error) {
    return responseForError(error);
  }
}
