import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '../../../../../lib/auth-session';
import { normalizeContactDecision, updateContactDetailRequestStatus } from '../../../../../lib/contact-requests';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: {
    requestId: string;
  };
};

type UpdateContactRequestBody = {
  status?: unknown;
};

function unauthorized() {
  return NextResponse.json({ ok: false, error: 'You must be signed in.' }, { status: 401 });
}

function extractErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await getServerSession();

  if (!session?.user?.id) {
    return unauthorized();
  }

  let body: UpdateContactRequestBody;

  try {
    body = (await request.json()) as UpdateContactRequestBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'Send a valid contact request decision.' }, { status: 400 });
  }

  const status = normalizeContactDecision(body.status);

  if (!status) {
    return NextResponse.json({ ok: false, error: 'Choose Share contact details or Deny request.' }, { status: 400 });
  }

  try {
    const contactRequest = await updateContactDetailRequestStatus({
      ownerUserId: session.user.id,
      requestId: context.params.requestId,
      status,
    });

    return NextResponse.json({ ok: true, contactRequest });
  } catch (error) {
    if (error instanceof Error && error.message === 'CONTACT_REQUEST_NOT_FOUND') {
      return NextResponse.json({ ok: false, error: 'Contact request not found.' }, { status: 404 });
    }

    if (error instanceof Error && error.message === 'CONTACT_REQUEST_FORBIDDEN') {
      return NextResponse.json({ ok: false, error: 'You cannot update this contact request.' }, { status: 403 });
    }

    console.error('contact request PATCH failed', error);
    return NextResponse.json(
      { ok: false, error: extractErrorMessage(error, 'Failed to update contact request.') },
      { status: 500 },
    );
  }
}
