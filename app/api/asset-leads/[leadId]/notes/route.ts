import { Buffer } from 'node:buffer';
import { NextRequest, NextResponse } from 'next/server';
import { recordAdminUsageEventSafely } from '../../../../../lib/admin-usage-events';
import { getServerSession, isAdminSupportSession } from '../../../../../lib/auth-session';
import { createAssetLeadNote } from '../../../../../lib/partner-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_LEAD_NOTE_PDF_BYTES = 12 * 1024 * 1024;
const PDF_HEADER = Buffer.from('%PDF-');

type RouteContext = {
  params: {
    leadId: string;
  };
};

type CreateLeadNoteBody = {
  note?: unknown;
  noteText?: unknown;
};

type PreparedPdfAttachment = {
  fileName: string;
  contentType: string;
  byteSize: number;
  data: Buffer;
};

function unauthorized() {
  return NextResponse.json({ ok: false, error: 'You must be signed in.' }, { status: 401 });
}

function getUsageUserId(session: Awaited<ReturnType<typeof getServerSession>>): string | null {
  if (!session?.user?.id || isAdminSupportSession(session)) {
    return null;
  }

  return session.user.id;
}

function isFile(value: FormDataEntryValue | null): value is File {
  return Boolean(value) && typeof value !== 'string';
}

function sanitizePdfFileName(value: unknown): string {
  const raw = String(value ?? '').trim().replace(/[\\/]/g, '-');
  const withoutControlCharacters = raw.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  const safeName = withoutControlCharacters || 'asset-quote.pdf';
  return safeName.toLowerCase().endsWith('.pdf') ? safeName : `${safeName}.pdf`;
}

async function preparePdfAttachment(file: File): Promise<PreparedPdfAttachment> {
  const fileName = sanitizePdfFileName(file.name);
  const contentType = String(file.type ?? '').trim().toLowerCase() || 'application/pdf';

  if (!file.size) {
    throw new Error('PDF_EMPTY');
  }

  if (file.size > MAX_LEAD_NOTE_PDF_BYTES) {
    throw new Error('PDF_TOO_LARGE');
  }

  const data = Buffer.from(await file.arrayBuffer());
  const hasPdfHeader = data.length >= PDF_HEADER.length && data.subarray(0, PDF_HEADER.length).equals(PDF_HEADER);

  if (!hasPdfHeader) {
    throw new Error('PDF_INVALID');
  }

  return {
    fileName,
    contentType: contentType === 'application/pdf' ? contentType : 'application/pdf',
    byteSize: data.length,
    data,
  };
}

async function readCreateLeadNoteRequest(request: NextRequest): Promise<{ noteText: unknown; attachment: PreparedPdfAttachment | null }> {
  const contentType = String(request.headers.get('content-type') ?? '').toLowerCase();

  if (!contentType.includes('multipart/form-data')) {
    const body = (await request.json()) as CreateLeadNoteBody;
    return { noteText: body.noteText ?? body.note, attachment: null };
  }

  const formData = await request.formData();
  const rawAttachment = formData.get('attachment') ?? formData.get('pdf') ?? formData.get('file');
  const attachmentFile = isFile(rawAttachment) && (rawAttachment.size > 0 || rawAttachment.name.trim()) ? rawAttachment : null;

  return {
    noteText: formData.get('noteText') ?? formData.get('note'),
    attachment: attachmentFile ? await preparePdfAttachment(attachmentFile) : null,
  };
}

export async function POST(request: NextRequest, context: RouteContext) {
  const session = await getServerSession();

  if (!session?.user?.id) {
    return unauthorized();
  }

  let body: { noteText: unknown; attachment: PreparedPdfAttachment | null };

  try {
    body = await readCreateLeadNoteRequest(request);
  } catch (error) {
    if (error instanceof Error && error.message === 'PDF_EMPTY') {
      return NextResponse.json({ ok: false, error: 'Select a PDF quote before saving.' }, { status: 400 });
    }

    if (error instanceof Error && error.message === 'PDF_TOO_LARGE') {
      return NextResponse.json({ ok: false, error: 'The PDF quote must be 12 MB or smaller.' }, { status: 400 });
    }

    if (error instanceof Error && error.message === 'PDF_INVALID') {
      return NextResponse.json({ ok: false, error: 'Upload a valid PDF quote.' }, { status: 400 });
    }

    return NextResponse.json({ ok: false, error: 'Send a valid note.' }, { status: 400 });
  }

  try {
    const note = await createAssetLeadNote({
      currentUserId: session.user.id,
      leadId: context.params.leadId,
      noteText: body.noteText,
      attachment: body.attachment,
    });

    const usageUserId = getUsageUserId(session);
    if (usageUserId) {
      await recordAdminUsageEventSafely({
        userId: usageUserId,
        eventType: 'message_sent_leave_note',
        eventSource: 'asset-lead-note',
        metadata: {
          leadId: context.params.leadId,
          noteId: note.id,
          hasAttachment: Boolean(body.attachment),
        },
      });
    }

    return NextResponse.json({ ok: true, note });
  } catch (error) {
    if (error instanceof Error && error.message === 'NOTE_REQUIRED') {
      return NextResponse.json({ ok: false, error: 'Write a note or attach a PDF quote before saving.' }, { status: 400 });
    }

    if (error instanceof Error && error.message === 'LEAD_NOT_FOUND') {
      return NextResponse.json({ ok: false, error: 'Lead not found.' }, { status: 404 });
    }

    if (error instanceof Error && (error.message === 'LEAD_FORBIDDEN' || error.message === 'PARTNER_NOTE_FORBIDDEN')) {
      return NextResponse.json({ ok: false, error: 'You cannot leave a note on this lead.' }, { status: 403 });
    }

    console.error('asset lead note POST failed', error);
    return NextResponse.json({ ok: false, error: 'Failed to save note.' }, { status: 500 });
  }
}
