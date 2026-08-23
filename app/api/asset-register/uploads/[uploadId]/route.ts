import { NextResponse } from 'next/server';
import { getAccountDocumentUploadOwner } from '../../../../../lib/account-documents';
import {
  createAssetRegisterSignedGetUrl,
  getLegacyAssetRegisterUploadResponse,
  isBucketOnlyAssetRegisterUploadId,
  resolveAssetRegisterUploadBytes,
  resolveBucketOnlyAssetRegisterDownload,
} from '../../../../../lib/asset-register-uploads';
import { isProtectedCaptureUpload } from '../../../../../lib/capture-requests';
import { isProtectedInvoiceUpload } from '../../../../../lib/my-invoices';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: {
    uploadId: string;
  };
};

export async function GET(request: Request, context: RouteContext) {
  const uploadId = String(context.params?.uploadId ?? '').trim();

  if (!uploadId) {
    return new NextResponse('Not found', { status: 404 });
  }

  // Vault uploads must only be served through the owner-scoped Documents
  // endpoint, even when somebody learns the shared upload id.
  const documentOwnerUserId = await getAccountDocumentUploadOwner(uploadId);
  if (documentOwnerUserId) {
    return new NextResponse('Not found', {
      status: 404,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  }

  // Financial capture files may only be downloaded through an actor-authorised
  // invoice or capture-file route, never through the shared upload catalogue.
  const [protectedInvoice, protectedCapture] = await Promise.all([
    isProtectedInvoiceUpload(uploadId),
    isProtectedCaptureUpload(uploadId),
  ]);
  if (protectedInvoice || protectedCapture) {
    return new NextResponse('Not found', {
      status: 404,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  }

  const shareBytesRequested = (() => {
    try {
      return new URL(request.url).searchParams.get('share') === '1';
    } catch {
      return false;
    }
  })();

  if (shareBytesRequested) {
    const resolved = await resolveAssetRegisterUploadBytes(uploadId);

    if (resolved.status === 'ready') {
      const encodedFileName = encodeURIComponent(resolved.upload.fileName);
      return new NextResponse(resolved.upload.data, {
        status: 200,
        headers: {
          'Content-Type': resolved.upload.mimeType || 'application/octet-stream',
          'Content-Length': String(resolved.upload.sizeBytes),
          'Content-Disposition': `${resolved.upload.disposition}; filename="${encodedFileName}"; filename*=UTF-8''${encodedFileName}`,
          'Cache-Control': 'private, no-store',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    }

    if (resolved.status === 'unavailable') {
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
