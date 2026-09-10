import { NextResponse } from 'next/server';
import { getDealerCostRequestContext } from '../../../../../../lib/dealer-cost-request';
import {
  getInvoiceDocumentUpload,
  getInvoiceDocumentUploadForActor,
} from '../../../../../../lib/my-invoices';
import {
  assertWorkspaceAssetAccess,
  resolveOwnerWorkspaceContext,
} from '../../../../../../lib/owner-workspace-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: {
    documentId: string;
  };
};

function downloadResponse(upload: {
  data: Buffer;
  contentType: string;
  fileName: string;
}): NextResponse {
  const encodedFileName = encodeURIComponent(upload.fileName || 'invoice-document');
  return new NextResponse(upload.data, {
    status: 200,
    headers: {
      'Content-Type': upload.contentType || 'application/octet-stream',
      'Content-Length': String(upload.data.length),
      'Content-Disposition': `inline; filename*=UTF-8''${encodedFileName}`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    },
  });
}

export async function GET(request: Request, context: RouteContext) {
  const documentId = String(context.params?.documentId ?? '').trim();
  if (!documentId) return new NextResponse('Not found', { status: 404 });

  try {
    const workspace = await resolveOwnerWorkspaceContext(request, { ledger: 'cost' });
    if (workspace.ok) {
      const upload = await getInvoiceDocumentUpload({
        userId: workspace.context.ownerUserId,
        documentId,
      });
      if (upload) {
        await assertWorkspaceAssetAccess(workspace.context, upload.document.assetId);
        return downloadResponse(upload);
      }
    }

    const dealer = await getDealerCostRequestContext();
    if (dealer) {
      const upload = await getInvoiceDocumentUploadForActor({
        actorUserId: dealer.actor.dealerUserId,
        documentId,
      });
      if (upload) return downloadResponse(upload);
    }
  } catch (error) {
    console.error('Aim4price invoice document download failed.', error);
    if (error instanceof Error && error.message === 'INVOICE_DOCUMENT_UPLOAD_UNAVAILABLE') {
      return new NextResponse('Document temporarily unavailable', {
        status: 503, headers: { 'Cache-Control': 'private, no-store', 'Retry-After': '60' },
      });
    }
  }

  // Use the same response for missing and forbidden documents so IDs cannot
  // be used to discover another account's financial records.
  return new NextResponse('Not found', { status: 404 });
}
