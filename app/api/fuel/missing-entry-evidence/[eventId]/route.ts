import { NextResponse } from 'next/server';
import { getAccountProfile } from '../../../../../lib/account-profile';
import { getServerSession } from '../../../../../lib/auth-session';
import { getFuelLateEntryEvidence } from '../../../../../lib/fuel-ledger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: { eventId: string } };

function contentDispositionFileName(fileName: string): string {
  const safe = fileName.replace(/[\r\n"\\]/g, '_').slice(0, 180) || 'fuel-entry-evidence';
  return `inline; filename="${safe}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

export async function GET(_request: Request, context: RouteContext) {
  const session = await getServerSession({ requireActive: true });
  if (!session?.user?.id) return NextResponse.json({ ok: false, error: 'You must be signed in.' }, { status: 401 });

  const profile = await getAccountProfile({ id: session.user.id, name: session.user.name, email: session.user.email });
  if (String(profile.accountType).toLowerCase() !== 'owner') {
    return NextResponse.json({ ok: false, error: 'Evidence is only available to the owner account.' }, { status: 403 });
  }

  const file = await getFuelLateEntryEvidence(session.user.id, context.params.eventId);
  if (!file) return NextResponse.json({ ok: false, error: 'Supporting evidence was not found.' }, { status: 404 });

  return new NextResponse(file.data, {
    status: 200,
    headers: {
      'Content-Type': file.contentType,
      'Content-Length': String(file.byteSize),
      'Content-Disposition': contentDispositionFileName(file.fileName),
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
