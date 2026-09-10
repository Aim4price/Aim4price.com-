import { NextRequest, NextResponse } from 'next/server';
import { resolveOwnerWorkspaceContext, assertWorkspaceAssetAccess } from '../../../../../lib/owner-workspace-access';
import { getDb } from '../../../../../lib/db';
import { resolveAssetRegisterUploadBytes } from '../../../../../lib/asset-register-uploads';
import { getInvoiceDocumentUpload } from '../../../../../lib/my-invoices';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const workspace = await resolveOwnerWorkspaceContext(request, { ledger: 'fuel' });
  if (!workspace.ok) return workspace.response;
  const source = request.nextUrl.searchParams.get('source')?.trim() || '';
  if (!source || source.length > 4096) return new NextResponse('Not found', { status: 404 });
  try {
    // Only a file already attached to this owner's ledger may be resolved.
    // Never fetch an arbitrary URL supplied by the browser.
    const rows = await getDb().query<{ asset_id: string | null; upload_id: string | null }>(`
      select asset_register_item_id::text as asset_id, upload_id from public.fuel_slips
      where user_id = $1 and document_file_url = $2
      union
      select asset_register_item_id::text as asset_id, null::text as upload_id from public.fuel_storage_events
      where user_id = $1 and document_file_url = $2
    `, [workspace.context.ownerUserId, source]);
    if (!rows.rows.length) return new NextResponse('Not found', { status: 404 });
    let allowed = false;
    let uploadReference = source;
    for (const row of rows.rows) {
      try { await assertWorkspaceAssetAccess(workspace.context, row.asset_id); allowed = true; uploadReference = row.upload_id || source; break; }
      catch { /* A shared file must be attached to an asset in this workspace. */ }
    }
    if (!allowed) return new NextResponse('Not found', { status: 404 });
    const path = new URL(uploadReference, request.nextUrl.origin).pathname;
    const invoiceId = path.match(/^\/api\/my-invoices\/documents\/([^/]+)\/download$/)?.[1];
    const invoice = invoiceId ? await getInvoiceDocumentUpload({userId:workspace.context.ownerUserId,documentId:invoiceId}) : null;
    const result = invoiceId ? null : await resolveAssetRegisterUploadBytes(uploadReference);
    if (result?.status === 'unavailable') return new NextResponse('File temporarily unavailable', {status:503,headers:{'Cache-Control':'private, no-store'}});
    const upload = invoice ? { data:invoice.data,mimeType:invoice.contentType,fileName:invoice.fileName }
      : result?.status === 'ready' ? result.upload : null;
    if (!upload) return new NextResponse('Original file not found', {status:404});
    return new NextResponse(upload.data, {headers:{
      'Content-Type':upload.mimeType || 'application/octet-stream',
      'Content-Length':String(upload.data.length),
      'Content-Disposition':`inline; filename*=UTF-8''${encodeURIComponent(upload.fileName)}`,
      'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff',
    }});
  } catch (error) {
    console.error('Fuel document download failed', error);
    return new NextResponse('File temporarily unavailable', {status:503,headers:{'Cache-Control':'private, no-store','Retry-After':'60'}});
  }
}
