import { NextResponse } from 'next/server';
import {
  createAssetRegisterSignedGetUrl,
  getLegacyAssetRegisterUploadResponse,
} from '../../../../../lib/asset-register-uploads';

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
