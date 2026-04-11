import { NextRequest, NextResponse } from 'next/server';
import { getAssetRegisterUploadById } from '../../../../../lib/asset-register-uploads';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: {
    uploadId: string;
  };
};

export async function GET(_request: NextRequest, context: RouteContext) {
  const uploadId = String(context.params?.uploadId ?? '').trim();

  if (!uploadId) {
    return new NextResponse('Not found.', { status: 404 });
  }

  const upload = await getAssetRegisterUploadById(uploadId);

  if (!upload?.fileBytes?.length) {
    return new NextResponse('Not found.', { status: 404 });
  }

  return new NextResponse(upload.fileBytes, {
    status: 200,
    headers: {
      'Content-Type': upload.contentType || 'application/octet-stream',
      'Content-Length': String(upload.byteSize || upload.fileBytes.length),
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
