import { NextRequest, NextResponse } from 'next/server';
import { getAssetRegisterAccountAccess } from '../../../../../lib/asset-register-account-access';
import { getAccountDocumentUploadReference } from '../../../../../lib/account-documents';
import { resolveAssetRegisterUploadBytes } from '../../../../../lib/asset-register-uploads';
import { getServerSession } from '../../../../../lib/auth-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: {
    documentId: string;
  };
};

function safeFileName(value: string): string {
  return value.replace(/[\r\n"\\/]+/g, '-').trim().slice(0, 240) || 'document';
}

export async function GET(request: NextRequest, context: RouteContext) {
  const session = await getServerSession({ allowDealerApp: true });
  if (!session?.user?.id) return new NextResponse('You must be signed in.', { status: 401 });

  if (!await getAssetRegisterAccountAccess(session)) return new NextResponse('Forbidden', { status: 403 });

  const documentId = String(context.params?.documentId ?? '').trim();
  if (!documentId) return new NextResponse('Not found', { status: 404 });

  try {
    // Resolve the account-scoped metadata before touching the shared upload
    // catalog. Knowing an upload id is never enough to download a vault file.
    const reference = await getAccountDocumentUploadReference(session.user.id, documentId);
    if (!reference) return new NextResponse('Not found', { status: 404 });

    const resolved = await resolveAssetRegisterUploadBytes(reference.uploadId);
    if (resolved.status === 'not-found') return new NextResponse('Not found', { status: 404 });
    if (resolved.status === 'unavailable') {
      return new NextResponse('Document temporarily unavailable', {
        status: 503,
        headers: { 'Cache-Control': 'private, no-store', 'Retry-After': '60' },
      });
    }

    const fileName = safeFileName(reference.fileName || resolved.upload.fileName);
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
    console.error('Aim4price Document Vault download failed.', error);
    return new NextResponse('Document temporarily unavailable', {
      status: 503,
      headers: { 'Cache-Control': 'private, no-store', 'Retry-After': '60' },
    });
  }
}
