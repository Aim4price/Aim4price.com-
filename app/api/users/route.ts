import { NextRequest, NextResponse } from 'next/server';
import { getAccountProfile } from '../../../lib/account-profile';
import { getServerSession } from '../../../lib/auth-session';
import {
  createContactDetailRequest,
  listIncomingContactRequestsForOwner,
  listOwnerDirectoryForRequester,
  normalizeContactAccessFilter,
} from '../../../lib/contact-requests';
import { listIncomingUserMessagesForOwner } from '../../../lib/user-messages';
import { normalizePartnerType } from '../../../lib/partner-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type CreateContactRequestBody = {
  ownerUserId?: unknown;
};

function unauthorized() {
  return NextResponse.json({ ok: false, error: 'You must be signed in.' }, { status: 401 });
}

function forbidden(message = 'Only finance, insurance and dealer accounts can request owner contact details.') {
  return NextResponse.json({ ok: false, error: message }, { status: 403 });
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asPositiveInt(value: unknown, fallback: number): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.trunc(numeric) : fallback;
}

function extractErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

export async function GET(request: NextRequest) {
  const session = await getServerSession();

  if (!session?.user?.id) {
    return unauthorized();
  }

  try {
    const profile = await getAccountProfile({
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
    });
    const partnerType = normalizePartnerType(profile.accountType);

    if (!partnerType) {
      const [contactRequests, incomingMessages] = await Promise.all([
        listIncomingContactRequestsForOwner(session.user.id),
        listIncomingUserMessagesForOwner(session.user.id),
      ]);

      return NextResponse.json({
        ok: true,
        mode: 'requests',
        accountType: profile.accountType,
        contactRequests,
        incomingMessages,
      });
    }

    const { searchParams } = request.nextUrl;
    const directory = await listOwnerDirectoryForRequester(session.user.id, {
      search: searchParams.get('search') ?? undefined,
      province: searchParams.get('province') ?? undefined,
      contactAccess: normalizeContactAccessFilter(searchParams.get('contactAccess')),
      page: asPositiveInt(searchParams.get('page'), 1),
      pageSize: asPositiveInt(searchParams.get('pageSize'), 10),
    });

    return NextResponse.json({
      ok: true,
      mode: 'directory',
      accountType: profile.accountType,
      ...directory,
    });
  } catch (error) {
    console.error('users GET failed', error);
    return NextResponse.json(
      { ok: false, error: extractErrorMessage(error, 'Failed to load users.') },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession();

  if (!session?.user?.id) {
    return unauthorized();
  }

  let body: CreateContactRequestBody;

  try {
    body = (await request.json()) as CreateContactRequestBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'Send a valid contact request.' }, { status: 400 });
  }

  const ownerUserId = asText(body.ownerUserId);

  try {
    const profile = await getAccountProfile({
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
    });

    if (!normalizePartnerType(profile.accountType)) {
      return forbidden();
    }

    const owner = await createContactDetailRequest({
      requesterUserId: session.user.id,
      ownerUserId,
    });

    return NextResponse.json({ ok: true, owner });
  } catch (error) {
    if (error instanceof Error && error.message === 'CONTACT_REQUEST_FORBIDDEN') {
      return forbidden();
    }

    if (error instanceof Error && error.message === 'CONTACT_REQUEST_OWNER_NOT_FOUND') {
      return NextResponse.json({ ok: false, error: 'Owner account not found.' }, { status: 404 });
    }

    return NextResponse.json(
      { ok: false, error: extractErrorMessage(error, 'Failed to send contact request.') },
      { status: 400 },
    );
  }
}
