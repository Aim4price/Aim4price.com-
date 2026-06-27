import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '../../../../lib/auth-session';
import { deleteMyInvoice, updateMyInvoice, type MyInvoiceDraftInput } from '../../../../lib/my-invoices';

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

  if (message === 'INVOICE_NOT_FOUND') return 'The selected invoice could not be found for this account.';
  if (message === 'ASSET_NOT_FOUND') return 'The selected asset could not be found for this account.';
  if (message === 'INVOICE_DOCUMENT_NOT_FOUND') return 'The selected invoice document could not be found for this asset.';
  if (typeof message === 'string' && message.trim()) return message;

  return 'The invoice could not be updated.';
}

async function currentUserId() {
  const session = await getServerSession({ requireActive: true });
  return session?.user?.id ?? '';
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const userId = await currentUserId();

  if (!userId) {
    return NextResponse.json({ ok: false, error: 'You must be signed in to update invoices.' }, { status: 401 });
  }

  let body: MyInvoiceDraftInput;

  try {
    body = (await request.json()) as MyInvoiceDraftInput;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid invoice payload.' }, { status: 400 });
  }

  try {
    const result = await updateMyInvoice(userId, context.params.invoiceId, body);
    return NextResponse.json({ ok: true, invoice: result.invoice, duplicateWarnings: result.duplicateWarnings });
  } catch (error) {
    console.error('Aim4price My Invoices PATCH failed.', error);
    const message = errorMessage(error);
    const status = message.includes('could not be found') ? 404 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const userId = await currentUserId();

  if (!userId) {
    return NextResponse.json({ ok: false, error: 'You must be signed in to delete invoices.' }, { status: 401 });
  }

  try {
    const deleted = await deleteMyInvoice(userId, context.params.invoiceId);

    if (!deleted) {
      return NextResponse.json({ ok: false, error: 'The selected invoice could not be found for this account.' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Aim4price My Invoices DELETE failed.', error);
    return NextResponse.json({ ok: false, error: errorMessage(error) }, { status: 500 });
  }
}
