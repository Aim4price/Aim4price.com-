import { NextRequest, NextResponse } from 'next/server';
import { getDealerCostRequestContext } from '../../../../../lib/dealer-cost-request';
import {
  deleteDealerCost,
  updateDealerCost,
} from '../../../../../lib/dealer-costs';
import type { MyInvoiceDraftInput } from '../../../../../lib/my-invoices';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: {
    invoiceId: string;
  };
};

function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  if (message === 'INVOICE_NOT_FOUND') return 'This dealership cost record could not be found.';
  if (message === 'DEALER_COST_ASSET_FORBIDDEN') {
    return 'This asset is not currently shared with your dealership.';
  }
  if (message === 'INVOICE_DOCUMENT_NOT_FOUND') {
    return 'The selected invoice/photo could not be found for this shared asset.';
  }
  if (message === 'DEALER_FUEL_COST_NOT_ALLOWED') {
    return 'Fuel slips cannot be saved from the dealer cost screen.';
  }
  return message || 'The cost record could not be updated.';
}

export async function PATCH(request: NextRequest, route: RouteContext) {
  const context = await getDealerCostRequestContext();
  if (!context) {
    return NextResponse.json({ ok: false, error: 'Dealer sign-in is required.' }, { status: 401 });
  }

  let body: MyInvoiceDraftInput;
  try {
    body = (await request.json()) as MyInvoiceDraftInput;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid cost record payload.' }, { status: 400 });
  }

  try {
    const result = await updateDealerCost(context.actor, route.params.invoiceId, body);
    return NextResponse.json({
      ok: true,
      invoice: result.invoice,
      duplicateWarnings: result.duplicateWarnings,
    });
  } catch (error) {
    console.error('Aim4price Dealer Costs PATCH failed.', error);
    const message = errorMessage(error);
    const status = message.includes('not found') || message.includes('not currently shared') ? 404 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function DELETE(_request: NextRequest, route: RouteContext) {
  const context = await getDealerCostRequestContext();
  if (!context) {
    return NextResponse.json({ ok: false, error: 'Dealer sign-in is required.' }, { status: 401 });
  }

  try {
    const deleted = await deleteDealerCost(context.actor, route.params.invoiceId);
    if (!deleted) {
      return NextResponse.json({ ok: false, error: 'This dealership cost record could not be found.' }, { status: 404 });
    }
    return NextResponse.json({
      ok: true,
      message: 'Cost removed from your dealer records. The owner has been asked whether to keep or delete their copy.',
    });
  } catch (error) {
    console.error('Aim4price Dealer Costs DELETE failed.', error);
    return NextResponse.json({ ok: false, error: errorMessage(error) }, { status: 403 });
  }
}
