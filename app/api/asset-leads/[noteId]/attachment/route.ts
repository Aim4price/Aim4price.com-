import { NextResponse } from 'next/server';
import { getServerSession } from '../../../../../lib/auth-session';
import { getAssetPartnerNoteAttachmentForUser } from '../../../../../lib/partner-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: {
    noteId: string;
  };
};

function unauthorized() {
  return new NextResponse('You must be signed in.', { status: 401 });
}

function fallbackContentDispositionFileName(fileName: string): string {
  return fileName.replace(/[\\"\r\n]/g, '_');
}

function encodedContentDispositionFileName(fileName: string): string {
  return encodeURIComponent(fileName).replace(/[']/g, '%27').replace(/[()]/g, (match) => `%${match.charCodeAt(0).toString(16).toUpperCase()}`);
}

export async function GET(_request: Request, context: RouteContext) {
  const session = await getServerSession();

  if (!session?.user?.id) {
    return unauthorized();
  }

  try {
    const attachment = await getAssetPartnerNoteAttachmentForUser({
      currentUserId: session.user.id,
      noteId: context.params.noteId,
    });

    const fallbackName = fallbackContentDispositionFileName(attachment.fileName);
    const encodedName = encodedContentDispositionFileName(attachment.fileName);

    return new NextResponse(attachment.data, {
      status: 200,
      headers: {
        'Content-Type': attachment.contentType || 'application/pdf',
        'Content-Length': String(attachment.byteSize),
        'Content-Disposition': `inline; filename="${fallbackName}"; filename*=UTF-8''${encodedName}`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'ASSET_NOTE_FORBIDDEN') {
      return new NextResponse('Forbidden', { status: 403 });
    }

    if (error instanceof Error && (error.message === 'ASSET_NOTE_NOT_FOUND' || error.message === 'ASSET_NOTE_ATTACHMENT_NOT_FOUND')) {
      return new NextResponse('Not found', { status: 404 });
    }

    console.error('asset note attachment GET failed', error);
    return new NextResponse('Failed to open attachment.', { status: 500 });
  }
}
