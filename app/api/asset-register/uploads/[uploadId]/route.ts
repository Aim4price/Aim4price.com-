import { NextResponse } from 'next/server';
import { getAccountDocumentUploadOwner } from '../../../../../lib/account-documents';
import {
  createAssetRegisterSignedGetUrl,
  getLegacyAssetRegisterUploadResponse,
  isBucketOnlyAssetRegisterUploadId,
  resolveBucketOnlyAssetRegisterDownload,
} from '../../../../../lib/asset-register-uploads';
import { getServerSession } from '../../../../../lib/auth-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: {
    uploadId: string;
  };
};

export async function GET(_request: Request, context: RouteContext) {
  const uploadId = String(context.params?.uploadId ?? '').trim();

  if (!uploadId) {
    return new NextResponse('Not found', { status: 404 });
  }

  // Asset photos and historical attachments use this shared route. Vault
  // uploads are stricter: even a leaked upload id must not bypass the
  // owner-scoped /api/documents/[documentId]/download endpoint.
  const documentOwnerUserId = await getAccountDocumentUploadOwner(uploadId);
  if (documentOwnerUserId) {
    const session = await getServerSession();
    if (!session?.user?.id || session.user.id !== documentOwnerUserId) {
      return new NextResponse('Not found', { status: 404 });
    }
  }

  if (isBucketOnlyAssetRegisterUploadId(uploadId)) {
    const bucketOnlyDownload = await resolveBucketOnlyAssetRegisterDownload(uploadId);

    if (bucketOnlyDownload.status === 'ready') {
      return NextResponse.redirect(bucketOnlyDownload.url, {
        status: 302,
        headers: {
          'Cache-Control': 'private, no-store',
        },
      });
    }

    if (bucketOnlyDownload.status === 'unavailable') {
      return new NextResponse('Upload temporarily unavailable', {
        status: 503,
        headers: {
          'Cache-Control': 'private, no-store',
          'Retry-After': '60',
        },
      });
    }

    return new NextResponse('Not found', { status: 404 });
  }

  const signedUrl = await createAssetRegisterSignedGetUrl(uploadId);

  if (signedUrl) {
    return NextResponse.redirect(signedUrl, {
      status: 302,
      headers: {
        'Cache-Control': 'private, no-store',
      },
    });
  }

  const legacyUpload = await getLegacyAssetRegisterUploadResponse(uploadId);

  if (!legacyUpload) {
    return new NextResponse('Not found', { status: 404 });
  }

  return new NextResponse(legacyUpload.data, {
    status: 200,
    headers: {
      'Content-Type': legacyUpload.mimeType || 'application/octet-stream',
      'Content-Length': String(legacyUpload.sizeBytes),
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Disposition': `${legacyUpload.disposition}; filename="${encodeURIComponent(legacyUpload.fileName)}"`,
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
