import { NextRequest, NextResponse } from 'next/server';
import { deleteMyInvoice, getMyInvoiceById, updateMyInvoice, type MyInvoiceDraftInput } from '../../../../lib/my-invoices';
import { assertWorkspaceAssetAccess, resolveOwnerWorkspaceContext } from '../../../../lib/owner-workspace-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: {
    invoiceId: string;
  };
};

type ErrorWithMessage = {
  message?: string;
};

function errorMessage(error: unknown): string {
  const message = typeof error === 'object' && error !== null ? (error as ErrorWithMessage).message : '';

  if (message === 'INVOICE_NOT_FOUND') return 'The selected cost record could not be found for this account.';
  if (message === 'ASSET_NOT_FOUND') return 'The selected asset could not be found for this account.';
  if (message === 'INVOICE_DOCUMENT_NOT_FOUND') return 'The selected invoice/photo document could not be found for this asset.';
  if (typeof message === 'string' && message.trim()) return message;

  return 'The cost record could not be updated.';
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const resolved = await resolveOwnerWorkspaceContext(request, { ledger: 'cost' });
  if (!resolved.ok) return resolved.response;
  const workspace = resolved.context;

  let body: MyInvoiceDraftInput;

  try {
    body = (await request.json()) as MyInvoiceDraftInput;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid cost record payload.' }, { status: 400 });
  }

  try {
    await assertWorkspaceAssetAccess(workspace, body.assetId);
    const result = await updateMyInvoice(workspace.ownerUserId, context.params.invoiceId, body, {
      displayName: workspace.accountantAccess ? workspace.actorName : null,
    });
    return NextResponse.json({ ok: true, invoice: result.invoice, duplicateWarnings: result.duplicateWarnings });
  } catch (error) {
    console.error('Aim4price My Cost Ledger PATCH failed.', error);
    const message = errorMessage(error);
    const status = message.includes('could not be found') ? 404 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const resolved = await resolveOwnerWorkspaceContext(request, { ledger: 'cost' });
  if (!resolved.ok) return resolved.response;
  const workspace = resolved.context;

  try {
    const invoice = await getMyInvoiceById(workspace.ownerUserId, context.params.invoiceId);
    if (invoice) await assertWorkspaceAssetAccess(workspace, invoice.assetId);
    const deleted = await deleteMyInvoice(workspace.ownerUserId, context.params.invoiceId);

    if (!deleted) {
      return NextResponse.json({ ok: false, error: 'The selected cost record could not be found for this account.' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Aim4price My Cost Ledger DELETE failed.', error);
    return NextResponse.json({ ok: false, error: errorMessage(error) }, { status: 500 });
  }
}
