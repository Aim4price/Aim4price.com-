import { Buffer } from 'node:buffer';
import { NextRequest, NextResponse } from 'next/server';
import { getAccountProfile } from '../../../../lib/account-profile';
import { getServerSession } from '../../../../lib/auth-session';
import { createUserMessage, type UserMessageType } from '../../../../lib/user-messages';
import { normalizePartnerType } from '../../../../lib/partner-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function unauthorized() {
  return NextResponse.json({ ok: false, error: 'You must be signed in.' }, { status: 401 });
}

function forbidden(message = 'Only finance, insurance and dealer accounts can send owners messages or ads.') {
  return NextResponse.json({ ok: false, error: message }, { status: 403 });
}

function asText(value: FormDataEntryValue | null): string {
  return typeof value === 'string' ? value.trim() : '';
}

function extractErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

function normalizeMessageType(value: string): UserMessageType {
  return value.toLowerCase() === 'ad' ? 'ad' : 'message';
}

export async function POST(request: NextRequest) {
  const session = await getServerSession();

  if (!session?.user?.id) {
    return unauthorized();
  }

  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: 'Send a valid message or ad.' }, { status: 400 });
  }

  const ownerUserId = asText(formData.get('ownerUserId'));
  const messageType = normalizeMessageType(asText(formData.get('messageType')));
  const imageEntry = formData.get('image');
  const documentEntry = formData.get('document');

  try {
    const profile = await getAccountProfile({
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
    });

    if (!normalizePartnerType(profile.accountType)) {
      return forbidden();
    }

    const imageFile = imageEntry instanceof File && imageEntry.size > 0 ? imageEntry : null;
    const imageBytes = imageFile ? Buffer.from(await imageFile.arrayBuffer()) : null;
    const documentFile = documentEntry instanceof File && documentEntry.size > 0 ? documentEntry : null;
    const documentBytes = documentFile ? Buffer.from(await documentFile.arrayBuffer()) : null;

    const message = await createUserMessage({
      senderUserId: session.user.id,
      ownerUserId,
      messageType,
      messageText: formData.get('message'),
      adCaption: formData.get('caption'),
      imageFileName: imageFile?.name ?? '',
      imageMimeType: imageFile?.type ?? '',
      imageBytes,
      documentFileName: documentFile?.name ?? '',
      documentMimeType: documentFile?.type ?? '',
      documentBytes,
    });

    return NextResponse.json({ ok: true, message });
  } catch (error) {
    console.error('user message POST failed', error);
    return NextResponse.json(
      { ok: false, error: extractErrorMessage(error, 'Failed to send message.') },
      { status: 400 },
    );
  }
}
