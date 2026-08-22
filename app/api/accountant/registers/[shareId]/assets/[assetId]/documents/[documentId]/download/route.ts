import { NextRequest, NextResponse } from 'next/server';
import {
  accountantWorkspaceError,
  resolveAccountantAssetDocumentDownload,
} from '../../../../../../../../../../lib/accountant-workspace';
import { getServerSession } from '../../../../../../../../../../lib/auth-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = {
  params: { shareId: string; assetId: string; documentId: string };
};

function safeFileName(value: string): string {
  return value.replace(/[\r\n"\\/]+/g, '-').trim().slice(0, 240) || 'document';
}

export async function GET(request: NextRequest, context: Context) {
  const session = await getServerSession();
  if (!session?.user?.id) return new NextResponse('You must be signed in.', { status: 401 });

  try {
    const resolved = await resolveAccountantAssetDocumentDownload({
      accountantUserId: session.user.id,
      shareId: context.params.shareId,
      assetId: context.params.assetId,
      documentId: context.params.documentId,
    });
    if (resolved.status === 'not-found') return new NextResponse('Not found', { status: 404 });
    if (resolved.status === 'unavailable') {
      return new NextResponse('Document temporarily unavailable', {
        status: 503,
        headers: { 'Cache-Control': 'private, no-store', 'Retry-After': '60' },
      });
    }

    const fileName = safeFileName(resolved.upload.fileName);
    const forceDownload = request.nextUrl.searchParams.get('download') === '1';
    const disposition = forceDownload ? 'attachment' : resolved.upload.disposition;
    return new NextResponse(resolved.upload.data, {
      status: 200,
      headers: {
        'Content-Type': resolved.upload.mimeType || 'application/octet-stream',
        'Content-Length': String(resolved.upload.sizeBytes),
        'Content-Disposition': `${disposition}; filename="${encodeURIComponent(fileName)}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('accountant document download failed', error);
    const mapped = accountantWorkspaceError(error);
    if (mapped.status === 404) return new NextResponse('Not found', { status: 404 });
    if (mapped.status === 401 || mapped.status === 403) {
      return new NextResponse('Forbidden', { status: mapped.status });
    }
    return new NextResponse('Document temporarily unavailable', {
      status: 503,
      headers: { 'Cache-Control': 'private, no-store', 'Retry-After': '60' },
    });
  }
}
