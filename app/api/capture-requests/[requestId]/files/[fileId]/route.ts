import { NextRequest, NextResponse } from 'next/server';
import { getAccountProfile } from '../../../../../../lib/account-profile';
import { getServerSession } from '../../../../../../lib/auth-session';
import { readVerifiedCaptureFileBytes } from '../../../../../../lib/capture-finalization';
import { getCaptureRequestDetail, getCaptureRequestFile } from '../../../../../../lib/capture-requests';
import {
  getOwnerAppAccess,
  ownerAppCanAccessAsset,
  type OwnerAppAccess,
} from '../../../../../../lib/owner-app-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: { requestId?: string; fileId?: string } };
const HIDDEN_TERMINAL_STATUSES = new Set(['cancelled', 'declined', 'rejected']);

function cleanText(value: unknown, maxLength = 500): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function safeFileName(value: string): string {
  return value
    .replace(/[\\/\0\r\n";]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 150) || 'capture-document';
}

async function ownerFileAccess(): Promise<{ ownerId: string; ownerAppAccess: OwnerAppAccess } | null> {
  const session = await getServerSession({ requireActive: true, allowOwnerApp: true });
  if (!session?.user?.id) return null;
  const profile = await getAccountProfile({
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
  });
  if (profile.accountType !== 'owner' || profile.accountStatus !== 'active') return null;
  const ownerAppAccess = await getOwnerAppAccess();
  if (!ownerAppAccess || ownerAppAccess.ownerUserId !== session.user.id) return null;
  return { ownerId: session.user.id, ownerAppAccess };
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const owner = await ownerFileAccess();
  if (!owner) return NextResponse.json({ ok: false, error: 'Owner sign-in is required.' }, { status: 401 });
  const ownerId = owner.ownerId;
  const requestId = cleanText(context.params.requestId, 80);
  const fileId = cleanText(context.params.fileId, 80);
  if (!requestId || !fileId) return NextResponse.json({ ok: false, error: 'Capture file not found.' }, { status: 404 });

  try {
    const [capture, file] = await Promise.all([
      getCaptureRequestDetail(requestId),
      getCaptureRequestFile(requestId, fileId),
    ]);
    if (
      !capture
      || !file
      || capture.ownerUserId !== ownerId
      || HIDDEN_TERMINAL_STATUSES.has(capture.status)
      || (
        owner.ownerAppAccess.sessionKind === 'owner-app-user'
        && owner.ownerAppAccess.assetScope === 'selected'
        && (!capture.assetId || !ownerAppCanAccessAsset(owner.ownerAppAccess, capture.assetId))
      )
      || file.securityStatus !== 'clean'
    ) {
      return NextResponse.json({ ok: false, error: 'Capture file not found.' }, { status: 404 });
    }
    const bytes = await readVerifiedCaptureFileBytes(file);
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        'Content-Type': file.contentType,
        'Content-Length': String(bytes.length),
        'Content-Disposition': `inline; filename="${safeFileName(file.originalFileName)}"`,
        'Cache-Control': 'private, no-store, max-age=0',
        'Content-Security-Policy': "sandbox; default-src 'none'",
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
      },
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    if (code.includes('NOT_FOUND')) {
      return NextResponse.json({ ok: false, error: 'Capture file not found.' }, { status: 404 });
    }
    console.error('Owner capture file preview failed.', error);
    return NextResponse.json({ ok: false, error: 'This capture file is temporarily unavailable.' }, { status: 503 });
  }
}
