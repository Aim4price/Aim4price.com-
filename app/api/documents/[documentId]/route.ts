import { NextRequest, NextResponse } from 'next/server';
import { getAccountProfile } from '../../../../lib/account-profile';
import {
  moveAccountDocumentToRecycleBin,
  restoreAccountDocument,
  updateAccountDocument,
  type AccountDocumentInput,
} from '../../../../lib/account-documents';
import { getServerSession } from '../../../../lib/auth-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: {
    documentId: string;
  };
};

async function requireOwnerUser() {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return {
      ok: false as const,
      response: NextResponse.json({ ok: false, error: 'You must be signed in.' }, { status: 401 }),
    };
  }

  const profile = await getAccountProfile(session.user);
  if (profile.accountType !== 'owner') {
    return {
      ok: false as const,
      response: NextResponse.json(
        { ok: false, error: 'The Document Vault is only available to owner accounts.' },
        { status: 403 },
      ),
    };
  }

  return { ok: true as const, userId: session.user.id };
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  if (message === 'DOCUMENT_NOT_FOUND') {
    return NextResponse.json({ ok: false, error: 'Document not found.' }, { status: 404 });
  }
  if (message === 'DOCUMENT_TITLE_REQUIRED') {
    return NextResponse.json({ ok: false, error: 'Document title is required.' }, { status: 400 });
  }
  if (message === 'DOCUMENT_ASSET_NOT_FOUND') {
    return NextResponse.json({ ok: false, error: 'One of the selected assets could not be found.' }, { status: 404 });
  }
  if (message === 'DOCUMENT_EXPIRY_INVALID') {
    return NextResponse.json({ ok: false, error: 'Enter a valid expiry date.' }, { status: 400 });
  }

  return NextResponse.json({ ok: false, error: 'The document could not be updated.' }, { status: 500 });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const owner = await requireOwnerUser();
  if (!owner.ok) return owner.response;

  const documentId = String(context.params?.documentId ?? '').trim();
  if (!documentId) return NextResponse.json({ ok: false, error: 'Document not found.' }, { status: 404 });

  try {
    const body = await request.json() as AccountDocumentInput & { action?: unknown };
    const action = String(body.action ?? '').trim().toLowerCase();
    const document = action === 'restore'
      ? await restoreAccountDocument(owner.userId, documentId)
      : await updateAccountDocument(owner.userId, documentId, body);

    return NextResponse.json({ ok: true, document });
  } catch (error) {
    console.error('Aim4price Document Vault PATCH failed.', error);
    return errorResponse(error);
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const owner = await requireOwnerUser();
  if (!owner.ok) return owner.response;

  const documentId = String(context.params?.documentId ?? '').trim();
  if (!documentId) return NextResponse.json({ ok: false, error: 'Document not found.' }, { status: 404 });

  try {
    await moveAccountDocumentToRecycleBin(owner.userId, documentId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Aim4price Document Vault DELETE failed.', error);
    return errorResponse(error);
  }
}
