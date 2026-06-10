import { NextResponse } from 'next/server';
import { getServerSession } from '../../../../../../lib/auth-session';
import { getUserMessageAttachment } from '../../../../../../lib/user-messages';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: {
    messageId: string;
  };
};

function unauthorized() {
  return NextResponse.json({ ok: false, error: 'You must be signed in.' }, { status: 401 });
}

export async function GET(_request: Request, context: RouteContext) {
  const session = await getServerSession();

  if (!session?.user?.id) {
    return unauthorized();
  }

  try {
    const attachment = await getUserMessageAttachment(session.user.id, context.params.messageId);

    if (!attachment) {
      return NextResponse.json({ ok: false, error: 'Image not found.' }, { status: 404 });
    }

    return new NextResponse(new Uint8Array(attachment.bytes), {
      headers: {
        'Content-Type': attachment.mimeType,
        'Content-Length': String(attachment.sizeBytes),
        'Cache-Control': 'private, max-age=300',
        'Content-Disposition': `inline; filename="${attachment.fileName.replace(/"/g, '')}"`,
      },
    });
  } catch (error) {
    console.error('user message image GET failed', error);
    return NextResponse.json({ ok: false, error: 'Failed to load image.' }, { status: 500 });
  }
}
